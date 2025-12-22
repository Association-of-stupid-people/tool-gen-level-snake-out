@echo off
SET PATH=C:\Program Files\nodejs;C:\Users\DMOBIN\AppData\Local\Programs\Python\Python311;C:\Users\DMOBIN\AppData\Local\Programs\Python\Python311\Scripts;%PATH%

echo ========================================
echo    Starting Ngrok Tunnel for Backend
echo ========================================
echo.

REM Check if ngrok.exe exists in current directory first
if exist "%~dp0ngrok.exe" (
    SET NGROK_CMD=%~dp0ngrok.exe
    echo Found ngrok.exe in project folder.
) else (
    where ngrok >nul 2>nul
    if %errorlevel% neq 0 (
        echo [ERROR] ngrok not found!
        echo Please download ngrok from https://ngrok.com/download
        echo and place ngrok.exe in this folder.
        pause
        exit /b 1
    )
    SET NGROK_CMD=ngrok
)

echo Starting Flask server in background...
start "Flask Server" cmd /c "cd server && python run.py"

REM Wait a bit for server to start
timeout /t 3 /nobreak >nul

echo.
echo Starting ngrok tunnel on port 5000...
echo.
echo Copy the "Forwarding" URL below and set it as VITE_API_URL in client/.env
echo ========================================
%NGROK_CMD% http 5000
