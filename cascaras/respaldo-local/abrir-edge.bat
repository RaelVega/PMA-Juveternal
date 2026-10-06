@echo off
REM Abre Edge (viene con Windows 10/11) en kiosco a pantalla completa contra el
REM servidor local. Perfil propio junto a esta carpeta: los datos viajan con la USB
REM y los flags de kiosco aplican aunque Edge ya este abierto.
REM Parametro opcional: sufijo de la URL (p. ej. "?humo" para la prueba tecnica).
start "" msedge ^
  --kiosk "http://localhost:4173/%~1" ^
  --edge-kiosk-type=fullscreen ^
  --user-data-dir="%~dp0datos-edge" ^
  --no-first-run ^
  --disable-pinch ^
  --overscroll-history-navigation=0 ^
  --autoplay-policy=no-user-gesture-required ^
  --disable-features=TranslateUI
