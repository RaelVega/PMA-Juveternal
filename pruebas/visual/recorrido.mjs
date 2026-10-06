// Recorrido completo en Chrome a 1080×1920, como un visitante, contra `npm run preview` (4183):
// salvapantallas (entrada y bucle) → Juveternal (aún sin catálogo) → Anáhuac → todas las páginas,
// comparadas con su referencia de InDesign → una ficha abierta y cerrada → INICIO → anterior → salvapantallas.
// Uso: node pruebas/visual/recorrido.mjs [url]   Resultados en pruebas/visual/resultados/
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const URL = process.argv[2] ?? 'http://localhost:4183/';
const RAIZ = path.resolve(import.meta.dirname, '../..');
const SALIDA = path.join(RAIZ, 'pruebas/visual/resultados');
const REF = path.join(RAIZ, 'pruebas/visual/referencias');
/** Diferencia media tolerada contra la referencia de InDesign (0–255 por canal). */
const TOLERANCIA = 6;
const TOLERANCIA_VIDEO = 14;

rmSync(SALIDA, { recursive: true, force: true });
mkdirSync(SALIDA, { recursive: true });

async function diferencia(a, b) {
  const [x, y] = await Promise.all([a, b].map((img) => sharp(img).resize(270, 480).removeAlpha().raw().toBuffer()));
  let suma = 0;
  for (let i = 0; i < x.length; i++) suma += Math.abs(x[i] - y[i]);
  return suma / x.length;
}

const navegador = await chromium.launch({ channel: 'chrome' });
const pagina = await navegador.newPage({ viewport: { width: 1080, height: 1920 } });
const errores = [];
pagina.on('pageerror', (e) => errores.push(e.message));
pagina.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
let fallos = 0;
const comprobar = (bien, texto) => { if (!bien) fallos++; console.log(`  ${bien ? '✓' : '✗'} ${texto}`); };
const paso = () => pagina.getAttribute('[data-paso]:not([style*="opacity: 0"])', 'data-paso').catch(() => '?');
const captura = (nombre) => pagina.screenshot({ path: path.join(SALIDA, `${nombre}.png`) });
const flecha = (nombre) => pagina.getByRole('button', { name: nombre, exact: true });

await pagina.goto(URL);
await pagina.waitForSelector('[data-paso="portada"]', { timeout: 15_000 });
await pagina.waitForTimeout(250);
await captura('portada-entrando');
await pagina.waitForTimeout(2300);
await captura('portada');
comprobar((await diferencia(path.join(SALIDA, 'portada.png'), path.join(REF, 'portada.png'))) < TOLERANCIA, 'salvapantallas igual a la composición de marketing');
await pagina.waitForTimeout(2600);
await captura('portada-bucle');

await pagina.mouse.click(270, 1000);
await pagina.waitForTimeout(400);
comprobar((await paso()) === 'portada', 'Juveternal (sin catálogo aún) no sale del salvapantallas');

await pagina.mouse.click(810, 1000);
await pagina.waitForTimeout(600);
comprobar((await paso()) === 'catalogo', 'Anáhuac abre su catálogo');

const total = JSON.parse(readFileSync(path.join(RAIZ, 'contenido/catalogos/anahuac/catalogo.json'), 'utf8')).paginas.length;
for (let n = 0; n < total; n++) {
  if (n > 0) await flecha('Página siguiente').click();
  await pagina.waitForTimeout(3600); // animaciones de entrada de InDesign
  const nombre = `anahuac-${String(n).padStart(2, '0')}`;
  // Sin las flechas, para comparar solo la página.
  await pagina.addStyleTag({ content: 'button[aria-label^="Página"]{visibility:hidden}' }).then((h) => h.evaluate((e) => e.setAttribute('data-temporal', '')));
  await captura(`${nombre}-sin-flechas`);
  await pagina.evaluate(() => document.querySelector('style[data-temporal]')?.remove());
  await captura(nombre);
  const d = await diferencia(path.join(SALIDA, `${nombre}-sin-flechas.png`), path.join(REF, 'anahuac', `pagina-${String(n).padStart(2, '0')}.png`));
  // Con video, el fotograma capturado nunca es el mismo que el de la referencia: se tolera más.
  const conVideo = await pagina.evaluate(() => !!document.querySelector('.indesign video'));
  comprobar(d < (conVideo ? TOLERANCIA_VIDEO : TOLERANCIA), `página ${n} igual a InDesign (diferencia ${d.toFixed(1)}${conVideo ? ', con video' : ''})`);
  rmSync(path.join(SALIDA, `${nombre}-sin-flechas.png`));
}
comprobar((await flecha('Página siguiente').count()) === 0, 'en la última página no hay «siguiente»');

// Ficha: la página 2 (tés) abre «Té Árnica» y se cierra con la ✕.
await pagina.evaluate(() => undefined);
for (let n = total - 1; n > 2; n--) { await flecha('Página anterior').click(); await pagina.waitForTimeout(120); }
await pagina.waitForTimeout(3600);
const visibles = () => pagina.evaluate(() => [...document.querySelectorAll('.indesign ._idGenButton')].filter((e) => !e.classList.contains('_idGenStateHide')).length);
const antes = await visibles();
await pagina.locator('.indesign ._idGenButton:not(._idGenStateHide)[data-clickactions*="onShow"]').first().click();
await pagina.waitForTimeout(400);
await captura('anahuac-02-ficha');
const conFicha = await pagina.evaluate(() => [...document.querySelectorAll('.indesign ._idGenButton')].some((e) => !e.classList.contains('_idGenStateHide') && e.querySelector('img[src*="equis"]')));
comprobar(conFicha, 'tocar un producto abre su ficha con ✕');
comprobar((await flecha('Página anterior').count()) === 0, 'con la ficha abierta las flechas se apartan');
await pagina.locator('.indesign ._idGenButton:not(._idGenStateHide):has(img[src*="equis"])').first().click();
await pagina.waitForTimeout(400);
comprobar((await visibles()) === antes, 'la ✕ cierra la ficha y vuelven los botones');
await pagina.waitForTimeout(300);
comprobar((await flecha('Página anterior').count()) === 1, 'al cerrar la ficha vuelven las flechas');

// INICIO del diseño → portada del catálogo; «anterior» desde ahí → salvapantallas.
await pagina.locator('.indesign ._idGenButton:not(._idGenStateHide)[data-clickactions*="goToDestination"]').first().click();
await pagina.waitForTimeout(600);
const enPortadaCatalogo = await pagina.evaluate(() => !!document.querySelector('.indesign video'));
comprobar(enPortadaCatalogo, 'INICIO lleva a la portada del catálogo');
await flecha('Página anterior').click();
await pagina.waitForTimeout(600);
comprobar((await paso()) === 'portada', '«anterior» desde la portada del catálogo vuelve al salvapantallas');

// Captura en horizontal (laptop): el lienzo se escala como bloque.
await pagina.setViewportSize({ width: 1440, height: 900 });
await pagina.waitForTimeout(500);
await captura('horizontal-1440x900');
await navegador.close();

if (errores.length) {
  console.log(`\nErrores de consola (${errores.length}):`);
  for (const e of errores) console.log(`  - ${e}`);
}
console.log(errores.length || fallos ? `\n${fallos} comprobaciones fallidas, ${errores.length} errores. Resultados en pruebas/visual/resultados/` : '\nTodo bien, sin errores de consola. Resultados en pruebas/visual/resultados/');
process.exitCode = errores.length || fallos ? 1 : 0;
