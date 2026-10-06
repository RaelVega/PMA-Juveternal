// Ingesta: assets-fuente/ (espejo de marketing, sin versionar) → contenido/ (lo que carga la app).
//   npm run ingesta
// Portada: cada pieza a WebP con su id (equivalencias.json). Catálogos: ver catalogo-indesign.mjs.
// Escribe contenido/manifiesto.json (no se edita a mano) y las referencias de pruebas/visual/referencias/.
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ingerirCatalogo } from './catalogo-indesign.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const ESPEJO = path.join(RAIZ, 'assets-fuente');
const DIR_IMG = path.join(RAIZ, 'contenido', 'img');
const DIR_REF = path.join(RAIZ, 'pruebas', 'visual', 'referencias');
const equivalencias = JSON.parse(readFileSync(path.join(import.meta.dirname, 'equivalencias.json'), 'utf8'));
const LIENZO = { ancho: 1080, alto: 1920 };

/** Ruta dentro del espejo comparando cada tramo en NFC (macOS guarda los acentos en NFD). */
function enEspejo(relativa) {
  let ruta = ESPEJO;
  for (const tramo of relativa.split('/')) {
    const hallado = readdirSync(ruta).find((n) => n.normalize('NFC') === tramo.normalize('NFC'));
    if (!hallado) throw new Error(`No existe en assets-fuente/: ${relativa} (falta «${tramo}»)`);
    ruta = path.join(ruta, hallado);
  }
  return ruta;
}

rmSync(DIR_IMG, { recursive: true, force: true });
mkdirSync(DIR_IMG, { recursive: true });
mkdirSync(DIR_REF, { recursive: true });

const imagenes = {};
console.log('Portada');
for (const [id, relativa] of Object.entries(equivalencias.portada)) {
  if (id.startsWith('_')) continue;
  let pieza = sharp(enEspejo(relativa));
  const meta = await pieza.metadata();
  // El fondo viene de 1080×1923: se recorta al lienzo (alineado arriba, comprobado contra la composición).
  if (meta.width === LIENZO.ancho && meta.height > LIENZO.alto) pieza = pieza.extract({ left: 0, top: 0, width: LIENZO.ancho, height: LIENZO.alto });
  const archivo = `img/portada-${id}.webp`;
  const { width, height, size } = await pieza.webp({ quality: 86, alphaQuality: 92, effort: 5 }).toFile(path.join(RAIZ, 'contenido', archivo));
  imagenes[`portada-${id}`] = { archivo, ancho: width, alto: height };
  console.log(`  ${id.padEnd(18)} ${width}×${height} ${(size / 1024).toFixed(0).padStart(5)} KB`);
}

for (const [id, relativa] of Object.entries(equivalencias.referencias)) {
  await sharp(enEspejo(relativa)).png().toFile(path.join(DIR_REF, `${id}.png`));
}

console.log('Catálogos');
const catalogos = {};
const fuentes = { montserrat: equivalencias.fuentes.montserrat.archivo };
for (const { id, export: exportRel } of equivalencias.catalogos) {
  await ingerirCatalogo({ id, exportDir: enEspejo(exportRel), RAIZ, fuentes, sustitutas: Object.fromEntries(Object.entries(equivalencias.sustitutas ?? {}).filter(([k]) => !k.startsWith('_'))) });
  catalogos[id] = { archivo: `catalogos/${id}/catalogo.json` };
}

const manifiesto = {
  version: 1,
  generado: 'ingesta/ingerir.mjs — no editar a mano',
  imagenes,
  videos: {},
  fuentes: Object.fromEntries(Object.entries(equivalencias.fuentes).filter(([k]) => !k.startsWith('_'))),
  catalogos,
};
writeFileSync(path.join(RAIZ, 'contenido', 'manifiesto.json'), `${JSON.stringify(manifiesto, null, 2)}\n`);

const tamano = (dir) => readdirSync(dir).reduce((suma, n) => { const r = path.join(dir, n); const s = statSync(r); return suma + (s.isDirectory() ? tamano(r) : s.size); }, 0);
console.log(`\ncontenido/: ${(tamano(path.join(RAIZ, 'contenido')) / 1024 / 1024).toFixed(1)} MB · referencias en ${path.relative(RAIZ, DIR_REF)}/`);
