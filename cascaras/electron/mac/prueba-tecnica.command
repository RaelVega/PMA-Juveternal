#!/bin/bash
# Prueba técnica de la vía A en Mac: abre la app de esta carpeta (PMA-Juveternal.app)
# en modo prueba (lista de verificaciones en pantalla).
# Salir: Ctrl+Shift+Q o Cmd+Q.
cd "$(dirname "$0")" || exit 1
for app in PMA-Juveternal*.app; do
  nohup "$app"/Contents/MacOS/* --humo >/dev/null 2>&1 &
  break
done
