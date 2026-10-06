#!/bin/bash
# SOLO PARA PROBAR en una Mac normal: abre la app de esta carpeta en una ventana
# (no en kiosco) y con el cursor visible, para usarla con mouse o trackpad.
# En el evento se abre el .app con doble clic, sin este archivo.
cd "$(dirname "$0")" || exit 1
for app in PMA-Juveternal*.app; do
  KIOSCO_VENTANA=1 nohup "$app"/Contents/MacOS/* --cursor >/dev/null 2>&1 &
  break
done
