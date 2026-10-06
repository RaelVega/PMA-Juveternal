// Arma la carpeta que se copia a la USB, con las tres vías de arranque:
//   paquetes/PMA-Juveternal-USB/1-EJECUTABLE   vía A (Electron, win-unpacked)
//   paquetes/PMA-Juveternal-USB/2-RESPALDO     vías B y B' (Caddy o PowerShell + Edge)
// Requiere haber corrido antes `npm run empaquetar:win`. Descarga Caddy para
// Windows la primera vez y lo guarda en paquetes/.cache (no se versiona).
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '../..');
const PAQUETES = path.join(RAIZ, 'paquetes');
const DESTINO = path.join(PAQUETES, 'PMA-Juveternal-USB');
const WIN = path.join(PAQUETES, 'win-unpacked');
const CACHE_CADDY = path.join(PAQUETES, '.cache', 'caddy.exe');
const URL_CADDY = 'https://caddyserver.com/api/download?os=windows&arch=amd64';

if (!existsSync(path.join(WIN, 'PMA-Juveternal.exe'))) {
  console.error('Falta paquetes/win-unpacked/PMA-Juveternal.exe: corre antes `npm run empaquetar:win`.');
  process.exit(1);
}

if (!existsSync(CACHE_CADDY)) {
  console.log('Descargando Caddy para Windows…');
  const respuesta = await fetch(URL_CADDY);
  if (!respuesta.ok) throw new Error(`No se pudo descargar Caddy: ${respuesta.status}`);
  const binario = Buffer.from(await respuesta.arrayBuffer());
  if (binario.subarray(0, 2).toString() !== 'MZ') throw new Error('La descarga de Caddy no es un ejecutable de Windows');
  mkdirSync(path.dirname(CACHE_CADDY), { recursive: true });
  writeFileSync(CACHE_CADDY, binario);
}

rmSync(DESTINO, { recursive: true, force: true });
const ejecutable = path.join(DESTINO, '1-EJECUTABLE');
const respaldo = path.join(DESTINO, '2-RESPALDO');

/**
 * cmd y PowerShell 5.1 necesitan CRLF, y PowerShell además BOM para leer bien
 * los acentos. Se fuerza al copiar, sin depender de cómo esté el archivo en disco.
 */
function copiarParaWindows(origen, destino) {
  const texto = readFileSync(origen, 'utf8').replace(/^﻿/, '').replace(/\r?\n/g, '\r\n');
  writeFileSync(destino, destino.endsWith('.ps1') ? `﻿${texto}` : texto);
}

cpSync(WIN, ejecutable, { recursive: true });
cpSync(path.join(RAIZ, 'dist'), path.join(respaldo, 'web'), { recursive: true });
cpSync(CACHE_CADDY, path.join(respaldo, 'caddy.exe'));
cpSync(path.join(RAIZ, 'cascaras/respaldo-local/Caddyfile'), path.join(respaldo, 'Caddyfile'));
for (const archivo of ['servir.ps1', 'iniciar-respaldo.bat', 'iniciar-sin-exe.bat', 'abrir-edge.bat', 'detener-respaldo.bat', 'prueba-tecnica.bat']) {
  copiarParaWindows(path.join(RAIZ, 'cascaras/respaldo-local', archivo), path.join(respaldo, archivo));
}
copiarParaWindows(path.join(RAIZ, 'cascaras/usb/prueba-tecnica-ejecutable.bat'), path.join(ejecutable, 'prueba-tecnica.bat'));
// El Bloc de notas de Windows antiguo también necesita CRLF.
copiarParaWindows(path.join(RAIZ, 'cascaras/usb/LEEME.txt'), path.join(DESTINO, 'LEEME.txt'));

console.log(`Listo: ${path.relative(RAIZ, DESTINO)}`);
