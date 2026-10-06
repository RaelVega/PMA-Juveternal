// Arma el .zip para compartir el ejecutable sin USB (Drive, WeTransfer, GitHub Releases):
//   paquetes/compartir/PMA-Juveternal-win.zip
// Cada zip lleva la carpeta win-unpacked completa, los .bat de prueba y LEEME-PRUEBA.txt.
// Uso: npm run empaquetar:zips
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '../..');
const SALIDA = path.join(RAIZ, 'paquetes', 'compartir');
const VARIANTES = [
  { nombre: 'PMA-Juveternal', empaquetar: 'empaquetar:win', origen: 'paquetes/win-unpacked' },
];
const BATS = { 'probar-en-ventana.bat': 'cascaras/electron/probar-en-ventana.bat', 'prueba-tecnica.bat': 'cascaras/usb/prueba-tecnica-ejecutable.bat' };

/** cmd necesita CRLF: se fuerza al copiar, sin depender de cómo esté el archivo en disco. */
const aWindows = (texto) => texto.replace(/^﻿/, '').replace(/\r?\n/g, '\r\n');

// Solo se borra lo propio: en la misma carpeta van los zips de Mac (empaquetar-mac.mjs).
mkdirSync(SALIDA, { recursive: true });
for (const { nombre, empaquetar, origen } of VARIANTES) {
  console.log(`\n== ${nombre}`);
  rmSync(path.join(SALIDA, nombre), { recursive: true, force: true });
  rmSync(path.join(SALIDA, `${nombre}-win.zip`), { force: true });
  execFileSync('npm', ['run', empaquetar], { cwd: RAIZ, stdio: 'inherit' });
  if (!existsSync(path.join(RAIZ, origen))) throw new Error(`No se generó ${origen}`);
  const carpeta = path.join(SALIDA, nombre);
  cpSync(path.join(RAIZ, origen), carpeta, { recursive: true });
  for (const [destino, fuente] of Object.entries(BATS)) writeFileSync(path.join(carpeta, destino), aWindows(readFileSync(path.join(RAIZ, fuente), 'utf8')));
  writeFileSync(path.join(carpeta, 'LEEME-PRUEBA.txt'), aWindows(readFileSync(path.join(RAIZ, 'cascaras/electron/LEEME-PRUEBA.txt'), 'utf8')));
  // -X: sin metadatos de macOS; -y: conserva los enlaces simbólicos si los hubiera.
  execFileSync('zip', ['-r', '-q', '-X', '-y', `${nombre}-win.zip`, nombre], { cwd: SALIDA, stdio: 'inherit' });
  rmSync(carpeta, { recursive: true, force: true });
}
console.log(`\nListo: ${SALIDA}`);
