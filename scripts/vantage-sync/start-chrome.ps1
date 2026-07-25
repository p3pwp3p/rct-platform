# Vantage 크롤링용 Chrome 실행 (디버그 포트 9222 + 전용 프로필)
# 사용법: 이 파일 우클릭 → "PowerShell에서 실행"
#        또는 터미널에서:  powershell -ExecutionPolicy Bypass -File start-chrome.ps1
#
# 이 창에서 Vantage 에 로그인해두고, 새 터미널에서  python sync_copiers.py  실행.
# (일반 Chrome과 분리된 전용 프로필이라 로그인이 유지됨)

$profileDir = Join-Path $PSScriptRoot ".chrome-profile"

$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chrome)) { $chrome = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" }
if (-not (Test-Path $chrome)) {
  Write-Host "[오류] Chrome 을 찾을 수 없습니다. 이 스크립트의 `$chrome 경로를 수정하세요." -ForegroundColor Red
  Read-Host "Enter 를 눌러 종료"
  exit 1
}

Write-Host "Chrome 을 디버그 포트 9222 로 실행합니다..." -ForegroundColor Cyan
Start-Process $chrome -ArgumentList `
  "--remote-debugging-port=9222",
  "--user-data-dir=`"$profileDir`"",
  "https://secure.vantagemarkets.com/login"

Start-Sleep -Seconds 4
try {
  $r = Invoke-WebRequest -Uri "http://localhost:9222/json/version" -UseBasicParsing -TimeoutSec 5
  Write-Host "OK — 디버그 포트 9222 가 열렸습니다. 이제 이 Chrome 에서 로그인하세요." -ForegroundColor Green
} catch {
  Write-Host "경고: 포트 9222 응답이 없습니다. 기존 Chrome 을 모두 닫고 다시 실행하세요." -ForegroundColor Yellow
}
