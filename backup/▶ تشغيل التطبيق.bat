@echo off
title Oncology Workflow System
chcp 65001 > nul

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║      نظام تنسيق الأورام - تشغيل التطبيق      ║
echo  ╚══════════════════════════════════════════════╝
echo.
echo  ⏳ جاري تشغيل الخادم المحلي...
echo.

:: Check if Python is available
python --version > nul 2>&1
if %errorlevel% neq 0 (
    echo  ❌ خطأ: Python غير مثبت على هذا الجهاز.
    echo     يرجى تثبيت Python من: https://python.org
    pause
    exit /b 1
)

:: Start browser after 2 seconds in background
start "" cmd /c "timeout /t 2 /nobreak > nul && start http://localhost:8000"

:: Start the server
echo  ✅ تم تشغيل الخادم على: http://localhost:8000
echo.
echo  📌 اضغط Ctrl+C لإيقاف الخادم عند الانتهاء
echo  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

cd /d "%~dp0frontend"
python -m http.server 8000
