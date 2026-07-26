@echo off
REM RCT 카피자 동기화 단일 exe 빌드
REM 사전: pip install -r requirements.txt  (websocket-client, pyinstaller)

cd /d "%~dp0"
echo PyInstaller 로 exe 빌드 중...
pyinstaller --onefile --noconsole --name "RCT카피자동기화" rct_sync.py

echo.
echo 완료: dist\RCT카피자동기화.exe
echo config.ini 를 exe 와 같은 폴더에 두고 실행하세요.
pause
