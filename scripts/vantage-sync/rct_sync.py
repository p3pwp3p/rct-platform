# -*- coding: utf-8 -*-
"""
RCT 카피자 동기화 (단일 프로그램)

- Playwright 없이 Chrome 디버그 포트(CDP)에 직접 연결 → 가벼운 단일 exe.
- GUI 모드(기본): 창을 띄워 버튼으로 실행.
- 자동 모드(--auto): 창 없이 1회 실행(작업 스케줄러용).

설정은 exe(또는 이 파일) 옆의 config.ini 에서 읽는다.
"""
import os
import sys
import json
import time
import threading
import subprocess
import configparser
import urllib.request
import urllib.error

try:
    from websocket import create_connection  # websocket-client
except Exception:
    create_connection = None

APP_NAME = "RCT 카피자 동기화"

# ── 경로/설정 ────────────────────────────────────────────────────────────────
def base_dir():
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))

def load_config():
    cfg = configparser.ConfigParser()
    path = os.path.join(base_dir(), "config.ini")
    defaults = {
        "api_url": "http://localhost:3000",
        "internal_secret": "",
        "strategy_url": "https://secure.vantagemarkets.com/copyTrading/discover/discoverDetail?strategyId=1289377&tab=2",
        "login_url": "https://secure.vantagemarkets.com/login",
        "apply": "false",
        "debug_port": "9222",
        "chrome_path": r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        "profile_dir": ".chrome-profile",
    }
    if os.path.exists(path):
        cfg.read(path, encoding="utf-8")
        if cfg.has_section("rct"):
            for k in defaults:
                if cfg.has_option("rct", k):
                    defaults[k] = cfg.get("rct", k)
    return defaults

# ── 추출 JS (카피자 표) ──────────────────────────────────────────────────────
EXTRACT_JS = r"""
(() => {
  const text = document.body.innerText;
  const rows = [];
  const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const idm = lines[i].match(/ID:\s*(\d{5,})(?:\((\d+)\))?/);
    if (!idm) continue;
    const nick = (lines[i-1] || '').replace(/\s+\d{5,}$/, '');
    const win = lines.slice(i, i + 8).join(' | ');
    const usd = [...win.matchAll(/(-?[\d,]+\.\d{2})\s*USD/g)].map(m => parseFloat(m[1].replace(/,/g,'')));
    rows.push({
      nickname: nick, masterAccountNo: idm[1], subAccountNo: idm[2] || null,
      feeBalance: usd.length>0?usd[0]:null, realizedProfit: usd.length>1?usd[1]:null,
      group: (win.match(/권하다\s*\d+/)||[null])[0],
    });
  }
  return rows;
})()
"""
READY_JS = "(() => /ID:\\s*\\d{5,}/.test(document.body.innerText))()"

# ── CDP 클라이언트 ───────────────────────────────────────────────────────────
class CDP:
    def __init__(self, ws_url, timeout=30):
        # 최신 Chrome 은 Origin 헤더가 있으면 ws 연결을 거부(403) → Origin 을 안 보냄
        self.ws = create_connection(ws_url, max_size=None, suppress_origin=True)
        self.ws.settimeout(timeout)
        self._id = 0
    def cmd(self, method, params=None, timeout=30):
        self._id += 1
        mid = self._id
        self.ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
        deadline = time.time() + timeout
        while time.time() < deadline:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == mid:
                if "error" in msg:
                    raise RuntimeError(msg["error"].get("message", str(msg["error"])))
                return msg.get("result", {})
        raise TimeoutError(method)
    def evaluate(self, expr, timeout=30):
        r = self.cmd("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True}, timeout)
        res = r.get("result", {})
        if res.get("subtype") == "error":
            raise RuntimeError(res.get("description", "JS error"))
        return res.get("value")
    def close(self):
        try: self.ws.close()
        except Exception: pass

# ── Chrome 기동/탐지 ─────────────────────────────────────────────────────────
def debug_alive(port):
    try:
        with urllib.request.urlopen(f"http://localhost:{port}/json/version", timeout=2):
            return True
    except Exception:
        return False

def launch_chrome(cfg, log):
    chrome = cfg["chrome_path"]
    if not os.path.exists(chrome):
        alt = r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
        chrome = alt if os.path.exists(alt) else chrome
    if not os.path.exists(chrome):
        raise FileNotFoundError("Chrome 실행 파일을 찾을 수 없습니다. config.ini 의 chrome_path 를 확인하세요.")
    profile = cfg["profile_dir"]
    if not os.path.isabs(profile):
        profile = os.path.join(base_dir(), profile)
    log(f"Chrome 실행(포트 {cfg['debug_port']})…")
    subprocess.Popen([chrome, f"--remote-debugging-port={cfg['debug_port']}",
                      "--remote-allow-origins=*",
                      f"--user-data-dir={profile}", cfg["login_url"]])
    for _ in range(20):
        if debug_alive(cfg["debug_port"]):
            return
        time.sleep(1)
    raise RuntimeError("Chrome 디버그 포트가 안 열렸습니다. 열려있는 모든 Chrome 창(작업관리자 chrome.exe 포함)을 닫고 다시 시도하세요.")

def find_page_ws(port):
    with urllib.request.urlopen(f"http://localhost:{port}/json", timeout=5) as r:
        targets = json.loads(r.read().decode("utf-8"))
    pages = [t for t in targets if t.get("type") == "page" and t.get("webSocketDebuggerUrl")]
    for t in pages:
        if "vantagemarkets.com" in (t.get("url") or ""):
            return t["webSocketDebuggerUrl"]
    return pages[0]["webSocketDebuggerUrl"] if pages else None

# ── 서버 전송 ────────────────────────────────────────────────────────────────
def send_to_server(cfg, rows, log):
    api, secret = cfg["api_url"].rstrip("/"), cfg["internal_secret"]
    if not api or not secret:
        log("서버 전송 건너뜀(api_url/internal_secret 미설정).")
        return None
    copiers = [{"vantageCt": r["masterAccountNo"], "feeBalance": r.get("feeBalance"), "realizedProfit": r.get("realizedProfit")}
               for r in rows if r.get("feeBalance") is not None]
    apply = str(cfg.get("apply", "false")).lower() == "true"
    payload = json.dumps({"copiers": copiers, "apply": apply, "graceByDeposit": True}).encode("utf-8")
    req = urllib.request.Request(f"{api}/api/admin/import-copiers", data=payload, method="POST",
                                 headers={"Content-Type": "application/json", "x-internal-secret": secret})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        log(f"전송 실패(HTTP {e.code}): {e.read().decode('utf-8','ignore')[:200]}")
        return None
    except Exception as e:
        log(f"전송 실패: {e}")
        return None
    s = body.get("summary", {})
    log(f"대사: 매칭 {s.get('matched')} / 미매칭 {s.get('unmatched')} / 예고시작 {s.get('graceStart')} / "
        f"정지 {s.get('toSuspend')} / 재활성 {s.get('toReactivate')}  (적용={s.get('applied')})")
    return body

# ── 동기화 1회 ───────────────────────────────────────────────────────────────
def run_sync(cfg, log, allow_launch=True):
    if create_connection is None:
        raise RuntimeError("websocket-client 미설치. pip install websocket-client")
    port = cfg["debug_port"]
    if not debug_alive(port):
        if not allow_launch:
            raise RuntimeError("Chrome 이 열려있지 않습니다. 먼저 [Chrome 열기] 를 눌러 로그인한 뒤 다시 실행하세요.")
        launch_chrome(cfg, log)
        log("※ 처음이면 열린 Chrome 에서 Vantage 로그인 후 다시 실행하세요.")
    ws = find_page_ws(port)
    if not ws:
        raise RuntimeError("Chrome 페이지 탭을 찾지 못했습니다.")
    cdp = CDP(ws)
    try:
        log("카피자 탭으로 이동…")
        cdp.cmd("Page.navigate", {"url": cfg["strategy_url"]})
        # 표 로딩 대기(최대 30초)
        ready = False
        for _ in range(30):
            time.sleep(1)
            try:
                if cdp.evaluate(READY_JS):
                    ready = True; break
            except Exception:
                pass
        if not ready:
            log("표를 찾지 못함(로그인 안 됐거나 화면이 다름).")
            return None
        rows = cdp.evaluate(EXTRACT_JS) or []
        log(f"추출된 카피자: {len(rows)}명")
        # 파일 저장
        out = os.path.join(base_dir(), "copiers.json")
        with open(out, "w", encoding="utf-8") as f:
            json.dump(rows, f, ensure_ascii=False, indent=2)
        if rows:
            send_to_server(cfg, rows, log)
        log("완료.")
        return rows
    finally:
        cdp.close()

# ── GUI ──────────────────────────────────────────────────────────────────────
def run_gui(cfg):
    import tkinter as tk
    from tkinter import scrolledtext

    root = tk.Tk()
    root.title(APP_NAME)
    root.geometry("560x440")
    root.minsize(460, 360)
    root.configure(bg="#11141b")

    # 상단(제목 + 체크박스)
    top = tk.Frame(root, bg="#11141b"); top.pack(side="top", fill="x", padx=14, pady=(14, 6))
    tk.Label(top, text=APP_NAME, fg="#e0e6ed", bg="#11141b", font=("Malgun Gothic", 13, "bold")).pack(side="left")
    apply_var = tk.BooleanVar(value=str(cfg.get("apply", "false")).lower() == "true")
    tk.Checkbutton(top, text="실제 적용(정지/재활성)", variable=apply_var, fg="#94a3b8", bg="#11141b",
                   selectcolor="#11141b", activebackground="#11141b", activeforeground="#e0e6ed").pack(side="right")

    # 하단(버튼 + 상태) — 로그보다 먼저 배치해 항상 보이도록 고정
    btns = tk.Frame(root, bg="#11141b"); btns.pack(side="bottom", fill="x", padx=14, pady=(4, 14))
    run_btn = tk.Button(btns, text="동기화 실행", bg="#4db6ac", fg="#07080a",
                        font=("Malgun Gothic", 10, "bold"), relief="flat", padx=18, pady=8)
    run_btn.pack(side="right")
    chrome_btn = tk.Button(btns, text="Chrome 열기", bg="#242a35", fg="#e0e6ed",
                           font=("Malgun Gothic", 10), relief="flat", padx=14, pady=8)
    chrome_btn.pack(side="right", padx=(0, 8))
    status = tk.Label(btns, text="대기 중", fg="#64748b", bg="#11141b", font=("Malgun Gothic", 9))
    status.pack(side="left")

    # 로그(가운데, 남는 공간 채움)
    logbox = scrolledtext.ScrolledText(root, bg="#0a0c10", fg="#94a3b8", insertbackground="#94a3b8",
                                       font=("Consolas", 9), relief="flat")
    logbox.pack(side="top", fill="both", expand=True, padx=14, pady=6)

    def log(msg):
        logbox.insert("end", msg + "\n"); logbox.see("end"); root.update_idletasks()

    busy = {"v": False}
    def do_run():
        if busy["v"]:
            return
        busy["v"] = True; status.config(text="동기화 중…", fg="#4db6ac")
        run_cfg = dict(cfg); run_cfg["apply"] = "true" if apply_var.get() else "false"
        def work():
            try:
                run_sync(run_cfg, log, allow_launch=False)   # GUI 에선 [Chrome 열기] 버튼으로 명시 실행
                status.config(text="완료", fg="#34d399")
            except Exception as e:
                log(f"오류: {e}"); status.config(text="오류", fg="#f87171")
            finally:
                busy["v"] = False
        threading.Thread(target=work, daemon=True).start()

    def do_chrome():
        if busy["v"]:
            return
        busy["v"] = True; status.config(text="Chrome 여는 중…", fg="#4db6ac")
        def work():
            try:
                if debug_alive(cfg["debug_port"]):
                    log("Chrome 이 이미 열려있습니다(디버그 포트 활성).")
                else:
                    launch_chrome(cfg, log)
                    log("Chrome 을 열었습니다. Vantage 에 로그인한 뒤 '동기화 실행'을 누르세요.")
                status.config(text="대기 중", fg="#64748b")
            except Exception as e:
                log(f"오류: {e}"); status.config(text="오류", fg="#f87171")
            finally:
                busy["v"] = False
        threading.Thread(target=work, daemon=True).start()

    run_btn.config(command=do_run)
    chrome_btn.config(command=do_chrome)

    log("준비됨. 처음이면 [Chrome 열기] → 로그인 → [동기화 실행] 순서로 하세요.")
    log(f"서버: {cfg['api_url']}  · 적용기본: {cfg.get('apply')}")
    root.mainloop()

# ── 진입점 ───────────────────────────────────────────────────────────────────
def main():
    cfg = load_config()
    if "--auto" in sys.argv:
        # 자동 모드: 창 없이 1회 실행 + 로그를 파일에 기록(스케줄러용)
        logpath = os.path.join(base_dir(), "sync_log.txt")
        def log(m):
            line = f"{time.strftime('%Y-%m-%d %H:%M:%S')} {m}"
            print("[sync]", m, flush=True)
            try:
                with open(logpath, "a", encoding="utf-8") as f:
                    f.write(line + "\n")
            except Exception:
                pass
        try:
            run_sync(cfg, log)
        except Exception as e:
            log(f"오류: {e}"); sys.exit(1)
    else:
        run_gui(cfg)

if __name__ == "__main__":
    main()
