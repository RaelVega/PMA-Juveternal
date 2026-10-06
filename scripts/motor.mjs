// Sincroniza src/motor/ con el de Biocaps, que es su origen.
//   npm run motor:comparar   lista lo que difiere (no toca nada)
//   npm run motor:traer      copia el motor de Biocaps encima del de aquí y anota el commit de origen
// La ruta de Biocaps se puede cambiar con MOTOR_ORIGEN. Regla: un cambio de motor se hace en
// un lado, se trae al otro y se prueba en los dos (npm test y npm run visual).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const ORIGEN_REPO = path.resolve(process.env.MOTOR_ORIGEN ?? path.join(RAIZ, '..', 'Biocaps Screens'));
const ORIGEN = path.join(ORIGEN_REPO, 'src', 'motor');
const DESTINO = path.join(RAIZ, 'src', 'motor');
const NOTA = 'ORIGEN.json';

if (!existsSync(ORIGEN)) throw new Error(`No encuentro el motor de origen en ${ORIGEN} (ajusta MOTOR_ORIGEN)`);

/** Archivos de un árbol con su hash, sin la nota de origen. */
function inventario(dir) {
  const salida = new Map();
  const recorrer = (actual) => {
    for (const nombre of readdirSync(actual)) {
      const ruta = path.join(actual, nombre);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (nombre !== NOTA && nombre !== '.DS_Store') salida.set(path.relative(dir, ruta).normalize('NFC'), createHash('sha1').update(readFileSync(ruta)).digest('hex'));
    }
  };
  if (existsSync(dir)) recorrer(dir);
  return salida;
}

const commitOrigen = () => {
  try {
    return execFileSync('git', ['-C', ORIGEN_REPO, 'log', '-1', '--format=%h %s', '--', 'src/motor'], { encoding: 'utf8' }).trim();
  } catch {
    return 'desconocido';
  }
};

const accion = process.argv[2];
if (accion === 'comparar') {
  const a = inventario(ORIGEN);
  const b = inventario(DESTINO);
  const difieren = [...new Set([...a.keys(), ...b.keys()])].sort().filter((k) => a.get(k) !== b.get(k));
  if (difieren.length === 0) {
    console.log(`Motor idéntico al de Biocaps (${commitOrigen()}).`);
  } else {
    for (const k of difieren) console.log(`  ${!a.has(k) ? 'solo aquí   ' : !b.has(k) ? 'solo Biocaps' : 'distinto    '} ${k}`);
    console.log(`\n${difieren.length} archivo(s) difieren. Lleva el cambio al otro lado (o npm run motor:traer) y prueba en los dos.`);
    process.exitCode = 1;
  }
} else if (accion === 'traer') {
  rmSync(DESTINO, { recursive: true, force: true });
  cpSync(ORIGEN, DESTINO, { recursive: true, filter: (ruta) => path.basename(ruta) !== '.DS_Store' });
  const nota = { origen: 'Biocaps Screens/src/motor', commit: commitOrigen(), traido: new Date().toISOString().slice(0, 10) };
  writeFileSync(path.join(DESTINO, NOTA), `${JSON.stringify(nota, null, 2)}\n`);
  console.log(`Motor traído de Biocaps (${nota.commit}).`);
} else {
  console.error('Uso: node scripts/motor.mjs comparar|traer');
  process.exitCode = 1;
}
