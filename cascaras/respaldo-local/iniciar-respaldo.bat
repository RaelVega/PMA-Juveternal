@echo off
REM Via B: servidor local (Caddy) + Edge en modo kiosco. Doble clic para usar.
REM Salir del kiosco: Alt+F4. Detener todo: detener-respaldo.bat
setlocal
cd /d "%~dp0"

start "pma-juveternal-servidor" /min caddy.exe run --config Caddyfile --adapter caddyfile
timeout /t 2 /nobreak >nul
call "%~dp0abrir-edge.bat"
endlocal
