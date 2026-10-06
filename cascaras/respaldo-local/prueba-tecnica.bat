@echo off
REM Prueba tecnica de la via B: igual que iniciar-respaldo.bat pero abre la
REM lista de verificaciones en lugar de la experiencia.
setlocal
cd /d "%~dp0"
start "pma-juveternal-servidor" /min caddy.exe run --config Caddyfile --adapter caddyfile
timeout /t 2 /nobreak >nul
call "%~dp0abrir-edge.bat" "?humo"
endlocal
