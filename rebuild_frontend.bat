@echo off
setlocal

echo ========================================
echo   WBS Management Tool - Frontend Build
echo ========================================

set FRONTEND_ROOT=frontend

if not exist %FRONTEND_ROOT% (
    echo Error: %FRONTEND_ROOT% directory not found.
    exit /b 1
)

echo.
echo Building for production...
pushd %FRONTEND_ROOT%
call npm run build
if %ERRORLEVEL% neq 0 (
    echo.
    echo Error: Build failed.
    popd
    exit /b 1
)
popd

echo.
echo ========================================
echo   Frontend Build Completed!
echo ========================================
pause
