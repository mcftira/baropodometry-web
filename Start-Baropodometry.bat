@echo off
title Baropodometry Analyzer
color 0A

echo ========================================
echo    BAROPODOMETRY ANALYZER
echo    Hermann Dental Clinic
echo ========================================
echo.

:: Navigate to application directory
cd /d "%~dp0"

echo [1/4] Checking for updates from GitHub...
git pull origin master
if %errorlevel% neq 0 (
    echo.
    echo WARNING: Could not fetch updates - running in offline mode
    echo This might be because:
    echo  - No internet connection
    echo  - GitHub is unreachable
    echo  - Local changes conflict with remote
    echo.
    echo Press any key to continue with current version...
    pause >nul
) else (
    echo Updates downloaded successfully!
)

echo.
echo [2/4] Installing/updating dependencies...
call npm install --silent
if %errorlevel% neq 0 (
    echo.
    echo WARNING: Could not update dependencies
    echo The application will still run with existing packages
    echo.
    pause
)

echo.
echo [3/4] Starting application server...
echo.
echo ========================================
echo    Application is starting...
echo    
echo    It will open automatically at:
echo    http://localhost:3001
echo    
echo    DO NOT CLOSE THIS WINDOW
echo    (minimize it if needed)
echo ========================================
echo.

:: Wait a moment for the server to start
timeout /t 3 /nobreak >nul

:: Open browser
start http://localhost:3001

echo [4/4] Running application...
echo.

:: Start the application
call npm run dev

:: If the app crashes or is closed
echo.
echo ========================================
echo    Application has stopped
echo ========================================
echo.
echo Press any key to exit...
pause >nul
