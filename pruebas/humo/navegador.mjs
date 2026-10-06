// Corre la prueba de humo en Chrome contra una URL y resume el resultado.
// Uso: node pruebas/humo/navegador.mjs <url> [carpeta-de-perfil]
// Con la misma carpeta de perfil en dos corridas se comprueba que IndexedDB persiste.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

const [url, perfil = mkdtempSync(path.join(tmpdir(), 'humo-'))] = process.argv.slice(2);
if (!url) {
  console.error('Uso: node pruebas/humo/navegador.mjs <url> [carpeta-de-perfil]');
  process.exit(2);
}

const contexto = await chromium.launchPersistentContext(perfil, {
  channel: 'chrome',
  headless: true,
  viewport: { width: 540, height: 960 },
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const pagina = contexto.pages()[0] ?? (await contexto.newPage());

let informe = null;
pagina.on('console', (mensaje) => {
  const texto = mensaje.text();
  if (texto.startsWith('HUMO_RESULTADO ')) informe = JSON.parse(texto.slice('HUMO_RESULTADO '.length));
  else if (mensaje.type() === 'error') console.log(`[página] ${texto}`);
});
pagina.on('pageerror', (error) => console.log(`[error de página] ${error.message}`));

// La prueba técnica vive en ?humo: la raíz abre la experiencia real.
const destino = new URL(url);
destino.searchParams.set('humo', '');
await pagina.goto(destino.href);
try {
  await pagina.waitForFunction(() => document.title.startsWith('HUMO:'), null, { timeout: 60_000 });
} catch {
  console.log('La prueba no terminó en 60 s');
}
await contexto.close();

if (!informe) process.exit(1);
console.log(`${url} → ${informe.ok ? 'TODO BIEN' : 'HAY FALLOS'}`);
for (const r of informe.resultados) console.log(`  ${r.ok ? '✓' : '✗'} ${r.nombre} — ${r.detalle}`);
process.exit(informe.ok ? 0 : 1);
