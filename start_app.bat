@echo off
echo ============================================
echo       FlashDeck AI - Starting Application
echo ============================================
echo.

:: Start Backend
echo [1/2] Starting Backend Server (Port 8000)...
start "FlashDeck Backend" cmd /k "cd /d %~dp0backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000"

:: Wait a moment for backend to initialize
timeout /t 3 /nobreak > nul

:: Start Frontend
echo [2/2] Starting Frontend Server (Port 5173)...
start "FlashDeck Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ============================================
echo       Servers Starting...
echo ============================================
echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo.
echo Close this window or press any key to exit.
pause > nul
