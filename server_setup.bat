@echo off
REM server_setup.bat
REM WBS Management Tool: Server Setup Script

echo ================================
echo  WBS Management Tool Setup
echo ================================
echo Running setup in PowerShell as administrator...

powershell -ExecutionPolicy Bypass -File "%~dp0server_setup.ps1"

echo.
if %errorlevel% neq 0 (
    echo [ERROR] Setup failed! Please check the output above.
    pause
    exit /b %errorlevel%
)

echo [SUCCESS] Setup completed!
pause
