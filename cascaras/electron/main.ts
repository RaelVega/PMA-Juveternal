import { accessSync, appendFileSync, constants, createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { app, BrowserWindow, ipcMain, powerSaveBlocker, protocol, screen } from 'electron';

/**
 * Cáscara del ejecutable portable (vía A). Sirve la misma `dist/` que las
 * otras vías por un protocolo propio `app://`, nunca por `file://`: con
 * `file://` el almacenamiento local y las peticiones por rango del video se
 * rompen en silencio.
 */

const ESQUEMA = 'app';
const HOST = 'pma-juveternal';
/** --humo (o HUMO_SALIR=1) abre la prueba técnica de distribución en lugar de la experiencia. */
const HUMO = process.argv.includes('--humo') || process.env['HUMO_SALIR'] === '1';
/** --cursor muestra el cursor (en el kiosco va oculto): para probar con mouse en una laptop sin pantalla táctil. */
const CURSOR = process.argv.includes('--cursor');
const PARAMETROS = [HUMO && 'humo', CURSOR && 'cursor=1'].filter(Boolean).join('&');
const URL_INICIO = `${ESQUEMA}://${HOST}/index.html${PARAMETROS ? `?${PARAMETROS}` : ''}`;

const EMPAQUETADO = app.isPackaged;

function puedeEscribir(dir: string): boolean {
  try {
    mkdirSync(dir, { recursive: true });
    accessSync(dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Carpeta donde van datos-kiosco/, telemetria/ y leads/: junto al .exe (o al .exe
 * portable, que se descomprime en %TEMP% y avisa su origen real). En macOS el
 * ejecutable está dentro del paquete (`X.app/Contents/MacOS/`), así que se usa la
 * carpeta que contiene el `.app`. Si no admite escritura (una USB bloqueada, o el
 * `.app` en cuarentena, que macOS abre desde una copia de solo lectura), van a
 * Documentos/<nombre del ejecutable> («PMA-Juveternal»).
 */
function carpetaBase(): string {
  if (!EMPAQUETADO) return process.cwd();
  const dirEjecutable = path.dirname(app.getPath('exe'));
  const preferida = process.env['PORTABLE_EXECUTABLE_DIR']
    ?? (process.platform === 'darwin' ? path.resolve(dirEjecutable, '../../..') : dirEjecutable);
  return puedeEscribir(preferida) ? preferida : path.join(app.getPath('documents'), path.parse(app.getPath('exe')).name);
}

const DIR_BASE = carpetaBase();
const DIR_DIST = path.join(app.getAppPath(), 'dist');
// Sin empaquetar, DIR_CONTENIDO permite usar el contenido ya superpuesto de una variante (`dist/contenido`).
const DIR_CONTENIDO = EMPAQUETADO
  ? path.join(process.resourcesPath, 'contenido')
  : path.resolve(app.getAppPath(), process.env['DIR_CONTENIDO'] ?? 'contenido');
const DIR_TELEMETRIA = path.join(DIR_BASE, 'telemetria');
/** Datos personales (leads de la variante principal): CSV que se abre en Excel y se importa al CRM al cierre del evento. */
const DIR_LEADS = path.join(DIR_BASE, 'leads');
/** BOM: sin él, Excel abre el CSV en UTF-8 con los acentos rotos. */
const BOM = '\uFEFF';
const MODO_KIOSCO = process.env['KIOSCO_VENTANA'] !== '1' && (EMPAQUETADO || process.env['KIOSCO'] === '1');

const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

// Los datos del navegador (IndexedDB, localStorage) viajan con la carpeta del
// ejecutable. Si esa carpeta no admite escritura, se quedan en el perfil del usuario.
const dirDatos = path.join(DIR_BASE, 'datos-kiosco');
if (puedeEscribir(dirDatos)) app.setPath('userData', dirDatos);

app.commandLine.appendSwitch('disable-pinch');
app.commandLine.appendSwitch('overscroll-history-navigation', '0');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

protocol.registerSchemesAsPrivileged([
  { scheme: ESQUEMA, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true } },
]);

function resolverArchivo(url: URL): string | null {
  let relativa = decodeURIComponent(url.pathname);
  let raiz = DIR_DIST;
  if (relativa.startsWith('/contenido/')) {
    raiz = DIR_CONTENIDO;
    relativa = relativa.slice('/contenido'.length);
  }
  if (relativa === '/' || relativa === '') relativa = '/index.html';
  const archivo = path.normalize(path.join(raiz, relativa));
  return archivo.startsWith(raiz + path.sep) ? archivo : null;
}

function responderArchivo(peticion: Request): Response {
  const url = new URL(peticion.url);
  if (url.host !== HOST) return new Response('No encontrado', { status: 404 });
  const archivo = resolverArchivo(url);
  if (!archivo) return new Response('Prohibido', { status: 403 });

  let tamano: number;
  try {
    const datos = statSync(archivo);
    if (!datos.isFile()) return new Response('No encontrado', { status: 404 });
    tamano = datos.size;
  } catch {
    return new Response('No encontrado', { status: 404 });
  }

  const tipo = TIPOS[path.extname(archivo).toLowerCase()] ?? 'application/octet-stream';
  const cabeceras: Record<string, string> = { 'Content-Type': tipo, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
  const rango = /^bytes=(\d*)-(\d*)$/.exec(peticion.headers.get('range') ?? '');

  if (rango) {
    const [, desdeTexto = '', hastaTexto = ''] = rango;
    let inicio = desdeTexto === '' ? tamano - Number(hastaTexto) : Number(desdeTexto);
    let fin = desdeTexto !== '' && hastaTexto !== '' ? Number(hastaTexto) : tamano - 1;
    inicio = Math.max(0, inicio);
    fin = Math.min(fin, tamano - 1);
    if (inicio > fin) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${tamano}` } });
    }
    const flujo = Readable.toWeb(createReadStream(archivo, { start: inicio, end: fin })) as ReadableStream<Uint8Array>;
    return new Response(flujo, {
      status: 206,
      headers: { ...cabeceras, 'Content-Range': `bytes ${inicio}-${fin}/${tamano}`, 'Content-Length': String(fin - inicio + 1) },
    });
  }

  const flujo = Readable.toWeb(createReadStream(archivo)) as ReadableStream<Uint8Array>;
  return new Response(flujo, { status: 200, headers: { ...cabeceras, 'Content-Length': String(tamano) } });
}

function fechaHoy(): string {
  const ahora = new Date();
  const dos = (n: number): string => String(n).padStart(2, '0');
  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`;
}

function registrarIpc(): void {
  ipcMain.handle('telemetria:anexar', (_evento, linea: unknown) => {
    if (typeof linea !== 'string' || linea.length > 10_000 || linea.includes('\n')) throw new Error('Línea de telemetría inválida');
    mkdirSync(DIR_TELEMETRIA, { recursive: true });
    const archivo = path.join(DIR_TELEMETRIA, `${fechaHoy()}.ndjson`);
    appendFileSync(archivo, `${linea}\n`, 'utf8');
    return archivo;
  });

  ipcMain.handle('leads:anexar', (_evento, cabecera: unknown, fila: unknown) => {
    const valida = (texto: unknown): texto is string => typeof texto === 'string' && texto.length > 0 && texto.length <= 10_000 && !/[\r\n]/.test(texto);
    if (!valida(cabecera) || !valida(fila)) throw new Error('Fila de leads inválida');
    mkdirSync(DIR_LEADS, { recursive: true });
    const archivo = path.join(DIR_LEADS, `leads-${fechaHoy()}.csv`);
    if (!existsSync(archivo)) writeFileSync(archivo, `${BOM}${cabecera}\r\n`, 'utf8');
    appendFileSync(archivo, `${fila}\r\n`, 'utf8');
    return archivo;
  });

  ipcMain.handle('leads:exportar', (_evento, csv: unknown) => {
    if (typeof csv !== 'string' || csv.length > 50_000_000) throw new Error('Exportación de leads inválida');
    mkdirSync(DIR_LEADS, { recursive: true });
    const archivo = path.join(DIR_LEADS, `exportacion-${fechaHoy()}-${Date.now()}.csv`);
    writeFileSync(archivo, csv, 'utf8');
    return archivo;
  });

  ipcMain.on('humo:resultado', (_evento, json: unknown) => {
    if (typeof json !== 'string') return;
    process.stdout.write(`HUMO_RESULTADO ${json}\n`);
    if (process.env['HUMO_SALIR'] === '1') setTimeout(() => app.quit(), 200);
  });
}

/**
 * Con una laptop y la pantalla táctil conectadas, el kiosco tiene que abrir en la
 * táctil aunque no sea la principal: se elige la primera pantalla en vertical.
 */
function pantallaDelKiosco(): Electron.Display {
  return screen.getAllDisplays().find((p) => p.bounds.height > p.bounds.width) ?? screen.getPrimaryDisplay();
}

function crearVentana(): BrowserWindow {
  const { bounds } = pantallaDelKiosco();
  const ventana = new BrowserWindow({
    width: 540,
    height: 960,
    x: bounds.x + Math.max(0, Math.round((bounds.width - 540) / 2)),
    y: bounds.y + Math.max(0, Math.round((bounds.height - 960) / 2)),
    kiosk: MODO_KIOSCO,
    fullscreen: MODO_KIOSCO,
    autoHideMenuBar: true,
    backgroundColor: '#FFFFFF',
    show: false,
    icon: path.join(import.meta.dirname, 'icono.png'),
    webPreferences: {
      preload: path.join(import.meta.dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });

  const contenidoWeb = ventana.webContents;
  void contenidoWeb.setVisualZoomLevelLimits(1, 1);
  contenidoWeb.setWindowOpenHandler(() => ({ action: 'deny' }));
  contenidoWeb.on('will-navigate', (evento, destino) => {
    if (!destino.startsWith(`${ESQUEMA}://${HOST}/`)) evento.preventDefault();
  });
  contenidoWeb.on('before-input-event', (evento, entrada) => {
    // Salida de emergencia del kiosco para el staff: Ctrl+Shift+Q.
    if (entrada.type === 'keyDown' && entrada.control && entrada.shift && entrada.key.toLowerCase() === 'q') {
      evento.preventDefault();
      app.quit();
    }
  });
  // Si el proceso de la página muere o se cuelga, se recarga en lugar de quedar en blanco.
  contenidoWeb.on('render-process-gone', () => setTimeout(() => void ventana.loadURL(URL_INICIO), 1000));
  ventana.on('unresponsive', () => contenidoWeb.reload());
  contenidoWeb.on('console-message', (detalles) => {
    if (process.env['HUMO_SALIR'] === '1' && detalles.level !== 'info') process.stdout.write(`[pagina] ${detalles.message}\n`);
  });

  ventana.once('ready-to-show', () => ventana.show());
  void ventana.loadURL(URL_INICIO);
  return ventana;
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  void app.whenReady().then(() => {
    protocol.handle(ESQUEMA, responderArchivo);
    registrarIpc();
    powerSaveBlocker.start('prevent-display-sleep');
    const ventana = crearVentana();
    app.on('second-instance', () => {
      if (ventana.isMinimized()) ventana.restore();
      ventana.focus();
    });
  });
  app.on('window-all-closed', () => app.quit());
}
