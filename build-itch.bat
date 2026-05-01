@echo off
setlocal
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
    echo npm not found on PATH. Install Node.js from https://nodejs.org/ and try again.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo npm install failed.
        pause
        exit /b 1
    )
)

echo Building Pilfur for itch.io...
call npm run package:itch
if errorlevel 1 (
    echo Build failed.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo Build complete: "%~dp0pilfur-digital.zip"
echo Upload this zip to itch.io as an HTML5 game and check
echo "This file will be played in the browser".
echo ============================================================
echo.
pause

endlocal
