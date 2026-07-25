# -*- coding: utf-8 -*-
"""
Vantage 카피자 크롤러 — 3차 (이미 로그인된 Chrome 에 '붙어서' 크롤링)

Cloudflare 봇 검사 때문에 스크립트가 로그인하지 않는다.
대신 관리자가 미리 로그인해 둔 Chrome 에 CDP(디버그 포트)로 접속해 화면을 읽는다.

준비(최초/매 실행 전):
  1) start-chrome.bat 더블클릭  → 디버그 포트 9222 로 Chrome 이 뜸
  2) 그 Chrome 에서 Vantage 에 로그인 (Cloudflare '사람 확인'도 통과)
  3) (.venv) 터미널에서:  python sync_copiers.py

결과: copiers.json / copiers.csv.  셀렉터가 안 맞으면 debug.png / debug.html 저장.
DB 연결 없이 '긁는 것'만 성공시키는 단계.
"""
import os
import sys
import csv
import json
import urllib.request
import urllib.error
from pathlib import Path

from dotenv import load_dotenv
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

HERE = Path(__file__).parent
load_dotenv(HERE / ".env")

STRATEGY_URL = os.getenv(
    "VANTAGE_STRATEGY_URL",
    "https://secure.vantagemarkets.com/copyTrading/discover/discoverDetail?strategyId=1289377&tab=2",
).strip()
CDP_URL = os.getenv("CDP_URL", "http://localhost:9222").strip()

# 우리 서버 전송(선택). 값이 있으면 크롤링 후 import-copiers 로 전송한다.
RCT_API_URL = os.getenv("RCT_API_URL", "").strip().rstrip("/")   # 예: http://localhost:3000
RCT_INTERNAL_SECRET = os.getenv("RCT_INTERNAL_SECRET", "").strip()
APPLY = os.getenv("APPLY", "false").lower() == "true"            # false=시뮬레이션(리포트만)

OUT_JSON = HERE / "copiers.json"
OUT_CSV = HERE / "copiers.csv"
DEBUG_PNG = HERE / "debug.png"
DEBUG_HTML = HERE / "debug.html"

TABLE_READY_JS = "() => /ID:\\s*\\d{5,}/.test(document.body.innerText)"


def log(*a):
    print("[sync]", *a, flush=True)


def save_debug(page, tag=""):
    try:
        page.screenshot(path=str(DEBUG_PNG), full_page=True)
        DEBUG_HTML.write_text(page.content(), encoding="utf-8")
        log(f"디버그 저장: {DEBUG_PNG.name}, {DEBUG_HTML.name} {tag}")
    except Exception as e:
        log("디버그 저장 실패:", e)


def find_vantage_page(browser):
    """열려있는 탭 중 Vantage 탭을 찾는다. 없으면 새 탭을 연다."""
    for ctx in browser.contexts:
        for pg in ctx.pages:
            if "vantagemarkets.com" in (pg.url or ""):
                log("Vantage 탭 발견:", pg.url)
                return pg
    # 없으면 기존 컨텍스트에 새 탭
    ctx = browser.contexts[0] if browser.contexts else browser.new_context()
    pg = ctx.new_page()
    log("Vantage 탭이 없어 새 탭을 엽니다.")
    return pg


def extract_rows(page):
    # 컬럼 순서(확인됨):
    #   ID(sub) | 복사모드 | 승수 | [수수료잔고]USD | [실현수익]USD | 권하다N | 삭제 | (다음행 닉네임)
    js = r"""
    () => {
      const text = document.body.innerText;
      const rows = [];
      const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
      for (let i = 0; i < lines.length; i++) {
        const idm = lines[i].match(/ID:\s*(\d{5,})(?:\((\d+)\))?/);
        if (!idm) continue;
        const nick = (lines[i-1] || '').replace(/\s+\d{5,}$/, '');
        const win = lines.slice(i, i + 8);
        const winStr = win.join(' | ');
        const usd = [...winStr.matchAll(/(-?[\d,]+\.\d{2})\s*USD/g)].map(m => parseFloat(m[1].replace(/,/g, '')));
        const grp = (winStr.match(/권하다\s*\d+/) || [null])[0];
        const feeBalance = usd.length > 0 ? usd[0] : null;       // 수수료 잔고
        const realizedProfit = usd.length > 1 ? usd[1] : null;   // 실현 수익
        const allowedNodes = feeBalance != null ? Math.floor(feeBalance / 3000) : null;
        rows.push({
          nickname: nick,
          masterAccountNo: idm[1],
          subAccountNo: idm[2] || null,
          feeBalance,
          realizedProfit,
          allowedNodes,
          group: grp,
          raw: winStr,
        });
      }
      return rows;
    }
    """
    rows = page.evaluate(js)
    log(f"추출된 행 수: {len(rows)}")
    # 잔고/실현수익 누락 행 경고
    bad = [r for r in rows if r.get("feeBalance") is None or r.get("realizedProfit") is None]
    if bad:
        log(f"경고: 금액 누락 행 {len(bad)}개 — debug.html 확인 필요")
    save_debug(page, "(ok)" if rows else "(zero-rows)")
    return rows


def send_to_server(rows):
    """긁은 데이터를 우리 서버 import-copiers 로 전송하고 대사결과를 출력한다."""
    if not RCT_API_URL or not RCT_INTERNAL_SECRET:
        log("서버 전송 건너뜀(RCT_API_URL / RCT_INTERNAL_SECRET 미설정). 파일만 저장됨.")
        return
    copiers = [
        {"vantageCt": r["masterAccountNo"], "feeBalance": r.get("feeBalance"), "realizedProfit": r.get("realizedProfit")}
        for r in rows if r.get("feeBalance") is not None
    ]
    payload = json.dumps({"copiers": copiers, "apply": APPLY, "graceByDeposit": True}).encode("utf-8")
    url = f"{RCT_API_URL}/api/admin/import-copiers"
    log(f"서버 전송: {url}  (apply={APPLY}, {len(copiers)}건)")
    req = urllib.request.Request(url, data=payload, method="POST", headers={
        "Content-Type": "application/json",
        "x-internal-secret": RCT_INTERNAL_SECRET,
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        log("전송 실패(HTTP):", e.code, e.read().decode("utf-8", "ignore")[:300])
        return
    except Exception as e:
        log("전송 실패:", e)
        return

    s = body.get("summary", {})
    log(f"대사결과: 매칭 {s.get('matched')} / 미매칭 {s.get('unmatched')} / "
        f"예고시작 {s.get('graceStart')} / 정지 {s.get('toSuspend')} / "
        f"예고해제 {s.get('graceCancel')} / 재활성 {s.get('toReactivate')}  (적용={s.get('applied')})")
    # 대사 상세를 파일로도 저장
    recon_path = HERE / "reconciliation.json"
    recon_path.write_text(json.dumps(body.get("reconciliation", []), ensure_ascii=False, indent=2), encoding="utf-8")
    log("대사 상세 저장:", recon_path.name)
    if not APPLY:
        log("※ 시뮬레이션 모드(apply=false). 실제 정지/재활성은 안 됨. .env 의 APPLY=true 로 실제 적용.")


def main():
    log("시작. CDP 접속 시도:", CDP_URL)
    with sync_playwright() as p:
        try:
            browser = p.chromium.connect_over_cdp(CDP_URL)
        except Exception as e:
            log("=" * 60)
            log("Chrome 에 붙지 못했습니다:", e)
            log("먼저 start-chrome.bat 을 실행하고 그 창에서 Vantage 에 로그인했는지 확인하세요.")
            log("(디버그 포트 9222 로 켜진 Chrome 이 떠 있어야 합니다)")
            log("=" * 60)
            sys.exit(1)

        page = find_vantage_page(browser)

        # 카피자 탭으로 이동
        log("카피자 탭으로 이동:", STRATEGY_URL)
        page.goto(STRATEGY_URL, wait_until="domcontentloaded")
        page.wait_for_timeout(4000)

        try:
            page.wait_for_function(TABLE_READY_JS, timeout=30000)
            log("표 감지 OK.")
        except PWTimeout:
            log("표를 시간 내 못 찾음(로그인 안 됐거나 화면이 다름).")
            save_debug(page, "(table-not-found)")

        rows = extract_rows(page)

        OUT_JSON.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
        log("저장:", OUT_JSON.name)
        with OUT_CSV.open("w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(["nickname", "masterAccountNo", "subAccountNo",
                        "feeBalance", "realizedProfit", "allowedNodes", "group"])
            for r in rows:
                w.writerow([r["nickname"], r["masterAccountNo"], r["subAccountNo"],
                            r.get("feeBalance"), r.get("realizedProfit"),
                            r.get("allowedNodes"), r.get("group")])
        log("저장:", OUT_CSV.name)

        # CDP 연결만 끊는다(관리자 Chrome 은 닫지 않음)
        browser.close()

    # 서버 전송(설정된 경우)
    if rows:
        send_to_server(rows)
    log("완료. copiers.json / reconciliation.json / debug.html 을 확인하세요.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log("오류:", e)
        sys.exit(1)
