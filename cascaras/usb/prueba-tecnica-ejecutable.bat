@echo off
REM Prueba tecnica de la via A: abre el ejecutable de esta carpeta (PMA-Juveternal.exe)
REM en modo prueba (lista de verificaciones en pantalla).
REM Salir: Ctrl+Shift+Q o Alt+F4.
for %%f in ("%~dp0PMA-Juveternal*.exe") do start "" "%%f" --humo
