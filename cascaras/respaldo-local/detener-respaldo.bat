@echo off
REM Cierra Edge del kiosco y el servidor local (Caddy o PowerShell).
taskkill /FI "WINDOWTITLE eq pma-juveternal-servidor*" /T /F >nul 2>&1
taskkill /IM caddy.exe /F >nul 2>&1
taskkill /IM msedge.exe /F >nul 2>&1
