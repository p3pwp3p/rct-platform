@echo off
REM RCT 카피자 동기화 단일 exe 빌드
REM 사전: pip install -r requirements.txt  (websocket-client, pyinstaller)

cd /d "%~dp0"
echo PyInstaller 로 exe 빌드 중...
pyinstaller --onefile --noconsole --collect-submodules openpyxl --name "RCT카피자동기화" rct_sync.py

echo.
echo config.ini 를 exe 옆에 복사...
if exist config.ini copy /Y config.ini dist\config.ini

echo.
echo 완료: dist\RCT카피자동기화.exe  (config.ini 동봉됨)
echo 직원 배포 시 dist\ 폴더의 exe + config.ini 를 함께 주세요.
pause
