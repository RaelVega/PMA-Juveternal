# Material recibido (05-10)

Pantalla dual PMA (Plantas Medicinales Anáhuac) × Juveternal. Vertical 1080×1920, táctil, `.exe` en Windows.

`entrada/` sirve para dejar material nuevo sin ordenar. Al revisarlo se mueve a `assets-fuente/` **sin renombrar** (sin versionar, igual que en Biocaps).

| Pieza | Dónde | Estado |
|---|---|---|
| Portada / salvapantallas | `assets-fuente/portada/` | Composición final (`fondo_anahuacjuveternal.png`) y, desde el 05-10, sus 10 piezas por separado (`FONDO FLUJO ANAHUAC-JUVETERNAL TOUCH/`). Ya construida y animada |
| Video del salvapantallas | `assets-fuente/portada/FONDO FLUJO…/SALVAPANTALLAS.mp4` | 06-10. H.264 720×1260, 39,8 s, con audio vacío. Va antes del selector de marca; convertido sin audio y con el bucle cerrado (49 → 12,6 MB) |
| Catálogo Anáhuac | `assets-fuente/anahuac/CATALOGO PANTALLA TOUCH/` | Export HTML5 de diseño fijo de InDesign: portada + 24 páginas + contraportada, 1080×1920, con fichas, ✕ e inicio. **Convertido** (05-10): 94 MB de PNG → 5,2 MB de WebP; 25 de 26 páginas iguales a la referencia (la 0 difiere solo por el fotograma del video) |
| Catálogo Juveternal | `assets-fuente/juveternal/PDF juveternal….pdf` | **Referencia**: 29 páginas de Illustrator (1,1 GB). Tiene inicio, ← → y «VER MÁS», pero faltan las fichas y el proyecto de InDesign. Miniaturas en `contexto/juveternal-miniaturas.jpg` |
| Prototipo anterior | `~/Prototipos/kiosko-dual/` (fuera del proyecto, solo lectura) | Metía el catálogo en un `iframe` con Volver, Inicio y Continuar encima; además, dinámicas (dispensador, fórmula, trivia, memorama) y salvapantallas dual |

## Faltantes que hay que pedir

1. ~~Fuentes de Anáhuac~~: resuelto el 06-10 con las libres más parecidas (Speeday → Rubik Black Italic, Brush Script MT → Yellowtail; Montserrat, la variable OFL). Minion Pro se declara pero ninguna página la usa.
3. ~~Icono del ejecutable~~: se queda el provisional (Rael, 06-10).
4. Textos de leads, despedida, aviso y fallo, y el aviso de privacidad para los leads: revisión de marketing y del cliente.
2. Juveternal: el proyecto o export de InDesign y las fichas.

## Observaciones del export de InDesign (Anáhuac)

- Las páginas de producto solo traen el botón de inicio: **no hay ← →** (en el export las pone el visor genérico de InDesign). Se añadieron las flechas del primer prototipo, a media altura en los bordes.
- Su JS usa `eval` y la CSP del motor lo bloquea: por eso se convierte (ver `CLAUDE.md`) en vez de incrustarse en un `iframe`.
