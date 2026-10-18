@echo off
cd /d "%~dp0\.."
if not exist "web\out\index.html" (
  echo Building static frontend...
  call npm run build
  if errorlevel 1 exit /b 1
)
echo.
echo Starting bridge. Copy the Join code. Open the printed http:// URL in Safari.
echo.
call npm start
