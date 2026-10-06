@echo off
REM SOLO PARA PROBAR en una computadora normal: abre el ejecutable de esta carpeta
REM en una ventana (no en kiosco) y con el cursor visible, para usarlo con mouse.
REM En el evento se abre el .exe con doble clic, sin este archivo.
set KIOSCO_VENTANA=1
for %%f in ("%~dp0PMA-Juveternal*.exe") do start "" "%%f" --cursor
