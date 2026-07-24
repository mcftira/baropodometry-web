@echo off
title Baropodometry Analyzer (Production)
color 0A

echo ========================================
echo    BAROPODOMETRY ANALYZER - PRODUCTION
echo    Hermann Dental Clinic
echo ========================================
echo.

:: Navigate to application directory
cd /d "%~dp0"

echo [1/5] Checking for updates from GitHub...
git pull origin master
if %errorlevel% neq 0 (
    echo.
    echo WARNING: Could not fetch updates - running in offline mode
    echo.
    pause
) else (
    echo Updates downloaded successfully!
)

echo.
echo [2/5] Installing/updating dependencies...
call npm install --silent

echo.
echo [3/5] Building production version...
echo This may take a minute...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Build failed!
    echo Please contact support.
    pause
    exit /b 1
)

echo.
echo [4/5] Starting production server...
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

echo [5/5] Running application (Production Mode)...
echo.

:: Start the production server
call npm start

:: If the app crashes or is closed
echo.
echo ========================================
echo    Application has stopped
echo ========================================
echo.
echo Press any key to exit...
pause >nul
