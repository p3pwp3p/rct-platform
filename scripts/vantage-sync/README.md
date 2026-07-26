# Vantage 카피자 크롤러

## ⭐ 단일 프로그램 (rct_sync.py → exe)
Playwright 없이 Chrome 디버그 포트(CDP)에 직접 붙는 **가벼운 단일 프로그램**.
`websocket-client` 하나만 의존. GUI 모드 + 자동 모드(--auto) 지원.

**빌드 (exe 만들기)**
```powershell
cd "scripts/vantage-sync"
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy config.ini.example config.ini   # config.ini 에 internal_secret 등 입력
build_exe.bat                        # → dist\RCT카피자동기화.exe
```

**사용**
- `dist\RCT카피자동기화.exe` 를 `config.ini` 와 같은 폴더에 두고 실행.
- GUI 창 → "동기화 실행". 처음엔 뜬 Chrome 에서 Vantage 로그인(1회, 세션 유지).
- "실제 적용" 체크를 켜면 정지/재활성이 실제 반영(기본은 시뮬레이션).

**매시간 자동 실행 (작업 스케줄러)**
- 프로그램: `...\dist\RCT카피자동기화.exe`, 인수: `--auto`
- 창 없이 조용히 1회 실행, 결과는 `sync_log.txt` 에 기록.
- 전제: config.ini 의 apply=true(자동 적용 원할 때) + 로그인된 Chrome 프로필 유지.

---

## (구) Playwright 스크립트 버전

Vantage 포털에서 카피자 목록(계정번호·수수료 잔고·실현수익)을 긁어오는 스크립트.
API가 없어서 실제 브라우저(Playwright)로 로그인 후 화면을 읽는다.

## 이번 단계 목표
DB 연결 없이 **"긁는 것"만 성공**시키기. 결과를 `copiers.json` / `copiers.csv` 로 저장하고,
셀렉터가 안 맞으면 `debug.png` / `debug.html` 을 남긴다.

## 실행 (Windows PowerShell)
```powershell
cd "scripts/vantage-sync"
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m playwright install chromium
copy .env.example .env
# .env 를 열어 VANTAGE_EMAIL / VANTAGE_PASSWORD / VANTAGE_STRATEGY_URL 입력
python sync_copiers.py
```

브라우저 창이 뜨고 자동 로그인 → 카피자 탭 이동 → 표를 읽는다.
자동 로그인이 안 되면 창에서 **직접 로그인**한 뒤 터미널에서 Enter.

## 실행 후 보내줄 것
아래 4개 파일을 확인해서 결과를 알려주세요:
- `copiers.json` — 추출된 행(비어있으면 셀렉터 안 맞은 것)
- `copiers.csv`
- `debug.png` — 그 순간 화면 스크린샷
- `debug.html` — 그 순간 실제 DOM (이걸로 다음 버전 셀렉터를 정확히 맞춤)

특히 `copiers.json` 이 비어 있거나 숫자 순서(수수료잔고/실현수익)가 뒤섞였으면,
`debug.html` 을 보고 정확한 셀렉터로 다음 버전을 고친다.

## 서버 전송 (import-copiers)
`.env` 에 아래를 설정하면 크롤링 후 우리 서버로 전송해 잔고 갱신 + 노드 통제(유예 예고)를 수행한다.
```
RCT_API_URL=http://localhost:3000        # 배포 시 배포 도메인
RCT_INTERNAL_SECRET=<프로젝트 .env.local 의 INTERNAL_API_SECRET 과 동일>
APPLY=false                              # false=시뮬레이션(리포트만), true=실제 적용
```
- 결과 대사표가 `reconciliation.json` 으로 저장된다.
- **APPLY=false 로 먼저 돌려** 누가 예고/정지/재활성 대상인지 확인한 뒤, 괜찮으면 `APPLY=true`.

## 매시간 자동 실행 (Windows 작업 스케줄러)
전제: `start-chrome.ps1` 로 띄운 디버그 Chrome 이 **로그인된 채 떠 있어야** 한다(전용 프로필이라 세션 유지됨).
1. `작업 스케줄러` → `기본 작업 만들기`
2. 트리거: 매일 → 반복 `1시간`, 기간 `무기한`
3. 동작: 프로그램 시작
   - 프로그램: `C:\Folder Tree\Coding\rct-platform\scripts\vantage-sync\.venv\Scripts\python.exe`
   - 인수: `sync_copiers.py`
   - 시작 위치: `C:\Folder Tree\Coding\rct-platform\scripts\vantage-sync`

## 보안
- 이메일/비밀번호는 로컬 `.env` 에서만 읽는다. 코드·DB·서버에 저장하지 않는다.
- `.env`, `copiers.*`, `debug.*`, `reconciliation.json` 은 커밋하지 않는다(.gitignore 참고).
