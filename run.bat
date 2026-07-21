@echo off
chcp 65001 >nul
title UMC Meal System - Launcher
cd /d "%~dp0"

echo ============================================
echo   UMC Viet Nam - He thong quan ly suat an
echo ============================================
echo.

REM Kill tien trinh dang chiem port 5000 va 5173
echo [*] Giai phong port 5000 va 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo [*] Xong.
echo.

REM Cai dependencies neu chua co (lan dau)
if not exist "server\node_modules" (
    echo [Server] Cai dat dependencies...
    pushd server
    call npm install
    popd
)
if not exist "client\node_modules" (
    echo [Client] Cai dat dependencies...
    pushd client
    call npm install
    popd
)

REM Canh bao neu thieu file .env
if not exist "server\.env" echo [CANH BAO] Thieu file server\.env !
if not exist "client\.env" echo [CANH BAO] Thieu file client\.env !

REM Mo 2 cua so terminal rieng
start "UMC Server (API :5000)" cmd /k "cd /d "%~dp0server" & call npm run dev & echo. & echo [Server da dung - xem loi o tren] & pause"

REM Cho server khoi dong truoc (3 giay)
timeout /t 3 /nobreak >nul

start "UMC Client (Web :5173)" cmd /k "cd /d "%~dp0client" & call npm run dev & echo. & echo [Client da dung - xem loi o tren] & pause"

echo.
echo  Server API : http://localhost:5000
echo  Client Web : http://localhost:5173
echo.
echo  Da mo 2 cua so terminal. Dong cua so do de tat tung dich vu.
echo.
pause
