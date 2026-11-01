@echo off
chcp 65001 > nul
title Onco Tracker
python --version > nul 2>&1
if %errorlevel% neq 0 (
    echo Python is not installed. Install it from https://python.org
    pause
    exit /b 1
)
start "" cmd /c "timeout /t 2 /nobreak > nul && start http://localhost:8000"
echo Onco Tracker is running at http://localhost:8000  (Ctrl+C to stop)
cd /d "%~dp0"
python -m http.server 8000
