// Revisa TODAS las fichas de los catálogos usando el export original de InDesign como juez: en cada
// página, abre cada «VER MÁS» y la cierra con su ✕, a la vez en el original (con su propio JS) y en la
// app, y compara qué queda visible y cómo se ve. También avisa si una ficha no muestra ✕ o si la ✕ no
// deja la página como estaba. Uso: node pruebas/visual/fichas.mjs [url]   (contra `npm run preview`, 4183)
// Capturas de los fallos en pruebas/visual/resultados/fichas/.
import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const URL = process.argv[2] ?? 'http://localhost:4183/';
const RAIZ = path.resolve(import.meta.dirname, '../..');
const SALIDA = path.join(RAIZ, 'pruebas/visual/resultados/fichas');
rmSync(SALIDA, { recursive: true, force: true });
mkdirSync(SALIDA, { recursive: true });
const contenido = JSON.parse(readFileSync(path.join(RAIZ, 'contenido/contenido.json'), 'utf8'));
const equivalencias = JSON.parse(readFileSync(path.join(RAIZ, 'ingesta/equivalencias.json'), 'utf8'));
const navegador = await chromium.launch({ channel: 'chrome' });
let problemas = 0;
let revisadas = 0;

const enEspejo = (relativa) => relativa.split('/').reduce((ruta, tramo) => path.join(ruta, readdirSync(ruta).find((n) => n.normalize('NFC') === tramo.normalize('NFC'))), path.join(RAIZ, 'assets-fuente'));
const visibles = (p, prefijo) => p.evaluate((prefijo) => [...document.querySelectorAll(`${prefijo}._idGenButton`)].filter((e) => !e.classList.contains('_idGenStateHide')).map((e) => e.id).sort().join(' '), prefijo);
async function diferencia(a, b) {
  const [x, y] = await Promise.all([a, b].map((img) => sharp(img).resize(270, 480).removeAlpha().raw().toBuffer()));
  let suma = 0;
  for (let i = 0; i < x.length; i++) suma += Math.abs(x[i] - y[i]);
  return suma / x.length;
}
/** Toca el centro del elemento como un dedo (presionar y soltar en el mismo punto). */
async function tocar(p, selector) {
  const caja = await p.locator(selector).first().boundingBox();
  if (!caja) return false;
  await p.mouse.click(caja.x + caja.width / 2, caja.y + caja.height / 2);
  return true;
}

for (const marca of contenido.selector.marcas.filter((m) => m.catalogo)) {
  const { export: exportRel } = equivalencias.catalogos.find((c) => c.id === marca.catalogo);
  const dirHtml = path.join(enEspejo(exportRel), 'publication-web-resources', 'html');
  const indice = JSON.parse(readFileSync(path.join(RAIZ, `contenido/catalogos/${marca.catalogo}/catalogo.json`), 'utf8'));
  const app = await navegador.newPage({ viewport: { width: 1080, height: 1920 } });
  await app.goto(URL);
  await app.waitForSelector('[data-paso="portada"]');
  await app.mouse.click(540, 960);
  await app.waitForSelector('[data-paso="selector"]');
  const [zx, zy, za, zh] = marca.zona;
  await app.mouse.click(zx + za / 2, zy + zh / 2);
  await app.waitForSelector('[data-paso="catalogo"]');

  for (const [n, pagina] of indice.paginas.entries()) {
    if (n > 0) {
      const nuestra = app.getByRole('button', { name: 'Página siguiente', exact: true });
      if (await nuestra.count()) await nuestra.click();
      else await tocar(app, `.indesign ._idGenButton:not(._idGenStateHide)[data-clickactions*="'publication-${n}.html'"]`);
    }
    // Los «VER MÁS»: botones visibles al cargar que muestran o animan algo (no los de navegación).
    const html = readFileSync(path.join(RAIZ, 'contenido', pagina.archivo), 'utf8');
    const verMas = [...html.matchAll(/<div id="(_idContainer\d+)" class="_idGenButton"([^>]*)>/g)]
      .filter(([, , attrs]) => /onShow|playAnimation/.test(attrs) && !/goToDestination/.test(attrs))
      .map(([, id]) => id);
    if (!verMas.length) continue;

    const original = await navegador.newPage({ viewport: { width: 1080, height: 1920 } });
    await original.goto(pathToFileURL(path.join(dirHtml, pagina.origen)).href);
    await Promise.all([original.waitForTimeout(3500), app.waitForTimeout(3500)]);
    // Al original se le aplican las mismas correcciones del export que a la app (ingesta/equivalencias.json).
    const { noMostrarAlCargar = [] } = equivalencias.catalogos.find((c) => c.id === marca.catalogo);
    for (const { pagina: p, elemento } of noMostrarAlCargar) if (p === pagina.origen) await original.evaluate((e) => document.getElementById(e)?.classList.add('_idGenStateHide'), elemento);
    const { corregirAcciones = [] } = equivalencias.catalogos.find((c) => c.id === marca.catalogo);
    for (const { pagina: p, elemento, de, a: por } of corregirAcciones) {
      if (p !== pagina.origen) continue;
      await original.evaluate(({ elemento, de, por }) => {
        const el = document.getElementById(elemento);
        for (const atributo of ['data-clickactions', 'data-releaseactions']) {
          const valor = el?.getAttribute(atributo);
          if (valor) el.setAttribute(atributo, valor.replaceAll(de.replace('_idContainer', '').replace('_idContainer', ''), por).replaceAll(de, por));
        }
      }, { elemento, de, por });
    }
    const inicialApp = await visibles(app, '.indesign ');

    for (const id of verMas) {
      revisadas++;
      const fallos = [];
      // Abrir.
      await Promise.all([tocar(original, `[id="${id}"]`), tocar(app, `.indesign [id="${id}"]`)]);
      await Promise.all([original.waitForTimeout(2300), app.waitForTimeout(2300)]);
      const [vo, va] = [await visibles(original, ''), await visibles(app, '.indesign ')];
      if (vo !== va) fallos.push(`al abrir, visibles distintos (original: ${vo} · app: ${va})`);
      const nombre = `${marca.catalogo}-pag${n + 1}-${id}`;
      await original.screenshot({ path: path.join(SALIDA, `${nombre}-original.png`) });
      const ocultarFlechas = await app.addStyleTag({ content: 'button[aria-label^="Página"],button[aria-label^="Ir a"]{visibility:hidden}' });
      await app.screenshot({ path: path.join(SALIDA, `${nombre}-app.png`) });
      await ocultarFlechas.evaluate((e) => e.remove());
      const d = await diferencia(path.join(SALIDA, `${nombre}-original.png`), path.join(SALIDA, `${nombre}-app.png`));
      if (d > 8) fallos.push(`al abrir se ve distinto que el original (diferencia ${d.toFixed(1)})`);
      // La ✕: lo más pequeño que apareció al abrir.
      const equis = await app.evaluate((antes) => {
        const previos = new Set(antes.split(' '));
        const nuevos = [...document.querySelectorAll('.indesign ._idGenButton:not(._idGenStateHide)')].filter((e) => !previos.has(e.id));
        return nuevos.map((e) => ({ id: e.id, area: e.getBoundingClientRect().width * e.getBoundingClientRect().height })).sort((a, b) => a.area - b.area)[0]?.id ?? null;
      }, inicialApp);
      if (!equis) fallos.push('no aparece ninguna ✕');
      else {
        await Promise.all([tocar(original, `[id="${equis}"]`), tocar(app, `.indesign [id="${equis}"]`)]);
        await Promise.all([original.waitForTimeout(2300), app.waitForTimeout(2300)]);
        const [co, ca] = [await visibles(original, ''), await visibles(app, '.indesign ')];
        if (co !== ca) fallos.push(`al cerrar, visibles distintos (original: ${co} · app: ${ca})`);
        // No debe quedar nada de la ficha (ni la ✕) a la vista.
        const quedan = ca.split(' ').filter((x) => x && !inicialApp.split(' ').includes(x));
        if (quedan.length) fallos.push(`tras cerrar sigue visible: ${quedan.join(' ')}`);
      }
      if (fallos.length) problemas++;
      else for (const lado of ['original', 'app']) rmSync(path.join(SALIDA, `${nombre}-${lado}.png`));
      console.log(`${fallos.length ? '  ✗' : '  ✓'} ${marca.catalogo} pág. ${n + 1} (${pagina.origen}) · ${id}${fallos.length ? `: ${fallos.join('; ')}` : ''}`);
    }
    await original.close();
  }
  await app.close();
}
await navegador.close();
console.log(problemas ? `\n${problemas} de ${revisadas} fichas con problemas (capturas en pruebas/visual/resultados/fichas/)` : `\nLas ${revisadas} fichas abren y cierran igual que en InDesign`);
process.exitCode = problemas ? 1 : 0;
