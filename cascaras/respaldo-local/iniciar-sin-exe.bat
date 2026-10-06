@echo off
REM Via B': igual que iniciar-respaldo.bat pero sin ningun .exe propio, para
REM cuando Windows bloquea los ejecutables sin firma. Usa PowerShell + Edge.
setlocal
cd /d "%~dp0"

start "pma-juveternal-servidor" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servir.ps1"
timeout /t 3 /nobreak >nul
call "%~dp0abrir-edge.bat"
endlocal
