# CLAUDE.md — PMA-Juveternal

Pantalla táctil dual (vertical 1080×1920, `.exe` en Windows) para el stand de Grupo AB en Expo FAC 2026: **Plantas Medicinales Anáhuac (PMA)** y **Juveternal**. Usa el motor de Biocaps (`../Biocaps Screens`). Material recibido y faltantes: `contexto/00-material-recibido.md`.

**Todo en español:** respuestas, comentarios, identificadores y mensajes de commit. Los commits van sin línea de coautoría.

## Fuente de verdad

- **El diseño es de marketing y se replica tal cual:** el salvapantallas (piezas de `assets-fuente/portada/`, posiciones medidas contra `fondo_anahuacjuveternal.png`) y los catálogos exportados de InDesign. No se proponen cambios de diseño.
- Lo que el diseño no dibuja se pregunta, no se inventa. Lista viva: `_pendientes` de `contenido/contenido.json`. Decidido con Rael (05-10): las animaciones del salvapantallas, las flechas ← → del primer prototipo para pasar de página y que las dinámicas (trivia, memorama…) queden fuera. El 06-10: las fuentes que faltan se sustituyen por las libres más parecidas, el icono provisional se queda, y el aviso de inactividad, la pantalla de fallo, los **leads** y la **despedida** llevan la identidad del salvapantallas.
- El prototipo anterior (`~/Prototipos/kiosko-dual/`) es solo referencia: nunca se importa código de ahí.

## Material y rutas

- `entrada/` recibe lo que manda marketing, sin ordenar. Al revisarlo se mueve a `assets-fuente/` **sin renombrar**. Las dos carpetas van sin versionar.
- La ruta tiene acentos en el espejo (`TIPOGRAFÍAS`…): toda comparación de nombres se hace con `.normalize('NFC')` por tramo (macOS guarda NFD).
- `contenido/img/`, `contenido/catalogos/`, `contenido/manifiesto.json` y `pruebas/visual/referencias/` los genera `npm run ingesta`: **no se editan a mano**. `contenido/contenido.json` y `contenido/fuentes/` sí son nuestros.

## Catálogos de InDesign (`ingesta/catalogo-indesign.mjs`)

- El export «HTML5 de diseño fijo» se convierte, no se incrusta: Chrome lee cada `publication*.html` sin JS, se guarda el HTML limpio (sin `<script>` ni `on*`), cada imagen pasa a WebP **al tamaño al que se dibuja**, el video pierde el audio y el CSS se acota a `.indesign`. De paso guarda la «página completa» de cada página (el export original, ya animado) en `pruebas/visual/referencias/<id>/`.
- Las acciones de InDesign (`data-clickactions`, `onShow`/`onHide`, `goToDestination`, `playAnimation`, `onMediaStart`) las interpreta `src/marca/catalogo/acciones.ts` **sin `eval`**. Si un export trae otra, la ingesta falla: se añade ahí con su prueba.
- `PaginaInDesign.tsx` reproduce el comportamiento: animaciones de entrada (sus keyframes son solo `transform`/`opacity`), fichas que aparecen con fundido (solo `opacity`: sus contenedores ya tienen `transform`), «INICIO» a la portada del catálogo y video con las reglas de `VideoBucle`.
- Páginas: `publication.html` es la 0; `publication-N.html`, la N. Desde la página 0, «anterior» vuelve al salvapantallas y reinicia la sesión. Con una ficha abierta, las flechas se ocultan.
- Fuentes: el CSS pide «Montserrat Thin» con `font-variation-settings`; la cubre `contenido/fuentes/Montserrat-Variable.ttf` (OFL, se llama así por dentro). Las que el export pide y no vinieron se sirven **con su mismo nombre de familia** desde la libre más parecida (`sustitutas` en `ingesta/equivalencias.json`): Speeday → Rubik Black Italic (forzada a «wght» 850), Brush Script MT → Yellowtail. La referencia se genera con las mismas sustitutas.
- Juveternal: cuando llegue su export, se añade a `catalogos` en `ingesta/equivalencias.json`, se pone `"catalogo": "juveternal"` en su marca de `contenido.json` y la flecha toma su color.

## Leads, despedida, aviso y fallo

- **Identidad del salvapantallas** en todas: `componentes/EscenaDual.tsx` (su fondo partido turquesa | naranja, las dos bandas en y 307 / 407 y un título blanco en itálica de dos líneas, la segunda en negrita, como «CONOCE NUESTROS / PRODUCTOS»). Sin imágenes (pantalla de fallo) se dibuja en CSS (`--fondo-dual-*`, `--banda-*`).
- La letra de esos títulos es la **Montserrat Italic** variable, empaquetada en `src/marca/fuentes-ui/` (no en `contenido/`): la pantalla de fallo aparece justo cuando el contenido no cargó.
- **Leads: una sola pantalla para las dos marcas.** Se llega con la → de la última página de cualquier catálogo («Ir a dejar mis datos»). Nombre y correo obligatorios, empresa opcional, OMITIR sigue sin datos y borra lo escrito. Teclado del motor (el del correo, sin espacio y con autocompletado de dominios: `leads/campos.ts`, copiado de Biocaps).
- Se guardan al pasar a la despedida (suscriptor `leads/guardar.ts`): IndexedDB (`pma-juveternal-leads`) y, en el ejecutable, `leads/leads-AAAA-MM-DD.csv` junto al `.exe` (BOM, CRLF, a prueba de fórmulas). Cada lead lleva la **marca** de la que venía. `Ctrl+Shift+E` exporta (aviso abajo, 3,5 s). **Son datos personales:** nunca van a la telemetría; el consentimiento es provisional.
- **Despedida:** vuelve sola al salvapantallas a los `despedida.segundos` (10) o al tocar.
- Textos de todas en `contenido.json` (pendientes de revisión de marketing).

## Motor (copia sincronizada de Biocaps)

- `src/motor/` es **idéntico** al de Biocaps (`src/motor/ORIGEN.json` dice de qué commit). No se edita aquí sin llevar el cambio al otro lado: `npm run motor:comparar` (lista las diferencias) y `npm run motor:traer` (copia el de Biocaps). Cada cambio de motor se prueba en los dos proyectos.
- El motor es agnóstico de marca: nunca importa de `src/marca/`.

## Reglas heredadas de Biocaps (siguen valiendo)

- **Contenido fuera del bundle:** nunca `import` de un JSON de `contenido/`; todo con `cargarJson()`/`urlContenido()` y validado con Valibot. Nunca rutas absolutas. Ninguna cadena visible en un componente.
- **Nunca `file://`.** Vías: A · Electron (`app://pma-juveternal/`, `cascaras/electron/`), B/B′ · Caddy o PowerShell + Edge (`cascaras/respaldo-local/`, solo en 127.0.0.1). Un tipo de archivo nuevo se da de alta en `TIPOS` de `main.ts` y en `$tipos` de `servir.ps1`. Los `.bat`/`.ps1` van con CRLF (y el `.ps1` con BOM).
- **Lienzo** fijo de 1080×1920 escalado como bloque (`Lienzo` del motor); la pantalla se rota desde Windows, nunca por CSS. Touch = clic; respuesta visual en `pointerdown` en < 100 ms. Sin `alert`/`confirm`/`prompt`.
- **Máquina de estados** pura (`src/marca/flujo.ts`: `portada` → `catalogo` → `leads` → `despedida`; la página y el lead son parte de la sesión). Inactividad: aviso a los 45 s y vuelta al salvapantallas a los 55 s. Reiniciar deja el estado idéntico al del arranque.
- **Movimiento:** solo `transform` y `opacity`, como mucho 2 elementos animando a la vez (la coreografía del salvapantallas está pensada para eso), `prefers-reduced-motion` sin desplazamientos.
- **Precarga:** el salvapantallas y las dos primeras páginas de cada catálogo se decodifican al arrancar. El resto se decodifica al acercarse (página ±1): retener ~170 imágenes costaría cientos de MB. Las páginas (HTML) se leen todas al arrancar.
- Todas las dependencias en `devDependencies`. El binario de Electron se baja con `npx install-electron`.

## Comandos

```
npm run dev                # http://localhost:5183 (Biocaps usa 5173)
npm run build              # tsc estricto + vite → dist/
npm test                   # Vitest
npm run lint               # oxlint
npm run ingesta            # assets-fuente/ → contenido/ + referencias (≈2 min con el catálogo de Anáhuac)
npm run preview            # dist/ en http://localhost:4183
npm run visual [-- <url>]  # recorrido completo contra 4183 + comparación con InDesign → pruebas/visual/resultados/
npm run electron:dev       # build + Electron en ventana
npm run empaquetar:win     # paquetes/win-unpacked/PMA-Juveternal.exe
npm run armar:usb          # paquetes/PMA-Juveternal-USB (vías A, B y B′ + LEEME)
npm run motor:comparar     # ¿el motor sigue igual al de Biocaps?
HUMO_SALIR=1 DIR_CONTENIDO=dist/contenido npx electron .   # prueba técnica en Electron
```

Antes de dar algo por terminado: `npm run build`, `npm test`, `npm run lint` y `npm run visual` en verde (sin errores de consola).
