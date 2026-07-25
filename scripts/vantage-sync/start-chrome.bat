@echo off
REM Vantage 크롤링용 Chrome 실행 (디버그 포트 9222 + 전용 프로필)
REM 이 창에서 Vantage 에 로그인해두고, 그 상태로 python sync_copiers.py 를 실행하면
REM 스크립트가 이 브라우저에 붙어서 크롤링한다. (전용 프로필이라 로그인도 유지됨)

set "PROFILE=%~dp0.chrome-profile"

set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" (
  echo [오류] Chrome 을 찾을 수 없습니다. chrome.exe 경로를 이 배치파일에서 수정하세요.
  pause
  exit /b 1
)

echo Chrome 을 디버그 포트 9222 로 실행합니다...
echo 이 창에서 Vantage 에 로그인한 뒤, 새 터미널에서  python sync_copiers.py  를 실행하세요.
start "" "%CHROME%" --remote-debugging-port=9222 --user-data-dir="%PROFILE%" https://secure.vantagemarkets.com/login
