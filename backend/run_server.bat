@echo off
REM backend/run_server.bat
REM WBS Management Tool: Backend Runner Script

cd /d "%~dp0"
echo Starting WBS Management Tool Backend...

if not exist "venv" (
    echo [ERROR] Virtual environment 'venv' not found!
    echo Please run 'server_setup.bat' in the project root first.
    pause
    exit /b 1
)

.\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000

if %errorlevel% neq 0 (
    echo [ERROR] Backend failed to start!
    pause
    exit /b %errorlevel%
)
