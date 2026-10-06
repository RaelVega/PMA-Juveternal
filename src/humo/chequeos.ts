import Dexie, { type EntityTable } from 'dexie';
import * as v from 'valibot';
import { cargarJson, urlContenido } from '../motor/contenido/cargar';
import { detectarVia } from '../motor/kiosco/entorno';

/**
 * Prueba de humo de distribución (paso 0 del plan). Temporal: se borra
 * cuando empiecen las pantallas reales. Cada chequeo se resuelve solo,
 * nunca lanza, y tiene su propio techo de tiempo.
 */

export interface ResultadoChequeo {
  id: string;
  nombre: string;
  ok: boolean;
  detalle: string;
}

const esquemaManifiesto = v.object({
  version: v.number(),
  imagenes: v.record(v.string(), v.object({ archivo: v.string(), ancho: v.number(), alto: v.number() })),
  videos: v.record(v.string(), v.object({ archivo: v.string() })),
  fuentes: v.record(v.string(), v.object({ archivo: v.string(), familia: v.string() })),
});
export type Manifiesto = v.InferOutput<typeof esquemaManifiesto>;

function conTecho<T>(promesa: Promise<T>, ms: number, motivo: string): Promise<T> {
  return Promise.race([
    promesa,
    new Promise<T>((_, rechazar) => setTimeout(() => rechazar(new Error(`${motivo} (más de ${ms} ms)`)), ms)),
  ]);
}

async function chequear(id: string, nombre: string, prueba: () => Promise<string>, techoMs = 5000): Promise<ResultadoChequeo> {
  try {
    return { id, nombre, ok: true, detalle: await conTecho(prueba(), techoMs, 'sin respuesta') };
  } catch (error) {
    return { id, nombre, ok: false, detalle: error instanceof Error ? error.message : String(error) };
  }
}

export function chequearOrigen(): Promise<ResultadoChequeo> {
  return chequear('origen', 'Origen y vía', async () => {
    const via = detectarVia();
    if (via === 'archivo') throw new Error('Abierta con file:// — nunca abrir el index.html con doble clic');
    return `${via} · ${window.location.origin || window.location.protocol}`;
  });
}

export async function chequearManifiesto(): Promise<{ resultado: ResultadoChequeo; manifiesto: Manifiesto | null }> {
  let manifiesto: Manifiesto | null = null;
  const resultado = await chequear('contenido', 'JSON de contenido (fuera del bundle)', async () => {
    manifiesto = await cargarJson('manifiesto.json', esquemaManifiesto);
    return `manifiesto v${manifiesto.version} validado`;
  });
  return { resultado, manifiesto };
}

export function chequearImagen(archivo: string): Promise<ResultadoChequeo> {
  return chequear('imagen', 'Imagen WebP desde contenido/', async () => {
    const imagen = new Image();
    imagen.src = urlContenido(archivo);
    await imagen.decode();
    return `${imagen.naturalWidth}×${imagen.naturalHeight}`;
  });
}

/** La interfaz de esta pantalla usa la Montserrat de contenido/ (la misma del catálogo de InDesign). */
export function chequearFuenteInterfaz(): Promise<ResultadoChequeo> {
  return chequear('fuente-ui', 'Fuente de interfaz', async () => {
    const caras = await document.fonts.load('800 64px "Montserrat Thin"');
    if (caras.length === 0) throw new Error('la fuente «Montserrat Thin» no cargó');
    return `${caras.length} cara(s) · Montserrat`;
  });
}

export function chequearFuenteEtiqueta(archivo: string, familia: string): Promise<ResultadoChequeo> {
  return chequear('fuente-contenido', 'Fuente de etiqueta desde contenido/', async () => {
    const cara = new FontFace(familia, `url("${urlContenido(archivo)}")`);
    await cara.load();
    document.fonts.add(cara);
    return `«${familia}» cargada`;
  });
}

export function chequearRangos(archivo: string): Promise<ResultadoChequeo> {
  return chequear('rangos', 'Peticiones por rango (video)', async () => {
    const respuesta = await fetch(urlContenido(archivo), { headers: { Range: 'bytes=0-99' }, cache: 'no-store' });
    const cuerpo = await respuesta.arrayBuffer();
    if (respuesta.status !== 206) throw new Error(`respondió ${respuesta.status}, se esperaba 206`);
    if (cuerpo.byteLength !== 100) throw new Error(`llegaron ${cuerpo.byteLength} bytes, se esperaban 100`);
    return `206 · ${respuesta.headers.get('content-range') ?? 'sin Content-Range'}`;
  });
}

/** El video debe arrancar solo y dar al menos una vuelta completa del bucle. */
export function chequearVideo(video: HTMLVideoElement): Promise<ResultadoChequeo> {
  return chequear(
    'video',
    'Video en bucle (autoplay, sin audio)',
    () =>
      new Promise<string>((resolver, rechazar) => {
        let tiempoAnterior = -1;
        const alActualizar = (): void => {
          if (tiempoAnterior > 1 && video.currentTime < tiempoAnterior - 1) {
            video.removeEventListener('timeupdate', alActualizar);
            resolver(`${video.videoWidth}×${video.videoHeight} · dio la vuelta al bucle`);
          }
          tiempoAnterior = video.currentTime;
        };
        video.addEventListener('timeupdate', alActualizar);
        video.addEventListener('error', () => rechazar(new Error(`error de video: ${video.error?.message ?? 'desconocido'}`)), {
          once: true,
        });
      }),
    9000,
  );
}

interface Contador {
  clave: string;
  valor: number;
}

export function chequearAlmacenamiento(): Promise<ResultadoChequeo> {
  return chequear('almacenamiento', 'IndexedDB + localStorage', async () => {
    const db = new Dexie('kiosco-humo') as Dexie & { contadores: EntityTable<Contador, 'clave'> };
    db.version(1).stores({ contadores: 'clave' });
    const actual = (await db.contadores.get('arranques'))?.valor ?? 0;
    await db.contadores.put({ clave: 'arranques', valor: actual + 1 });
    db.close();

    window.localStorage.setItem('kiosco-humo', String(Date.now()));
    if (!window.localStorage.getItem('kiosco-humo')) throw new Error('localStorage no guarda');

    const persistente = (await navigator.storage?.persist?.()) ?? false;
    return `arranque n.º ${actual + 1} · persistente: ${persistente ? 'sí' : 'no'}`;
  });
}

export function chequearTelemetriaArchivo(): Promise<ResultadoChequeo> {
  return chequear('telemetria-archivo', 'Telemetría a archivo junto al .exe', async () => {
    if (!window.kiosco) return 'no aplica fuera del ejecutable';
    const ruta = await window.kiosco.anexarTelemetria(JSON.stringify({ ts: Date.now(), tipo: 'humo' }));
    return ruta;
  });
}

export interface MedicionFotogramas {
  fps: number;
  p95Ms: number;
  lentos: number;
  total: number;
}

/** Mide los intervalos entre fotogramas mientras corre una animación. */
export function medirFotogramas(duracionMs: number): Promise<MedicionFotogramas> {
  return new Promise((resolver) => {
    const intervalos: number[] = [];
    let anterior = performance.now();
    const inicio = anterior;
    const paso = (ahora: number): void => {
      intervalos.push(ahora - anterior);
      anterior = ahora;
      if (ahora - inicio < duracionMs) requestAnimationFrame(paso);
      else {
        const ordenados = [...intervalos].sort((a, b) => a - b);
        const p95 = ordenados[Math.floor(ordenados.length * 0.95)] ?? 0;
        resolver({
          fps: Math.round((intervalos.length / (ahora - inicio)) * 1000),
          p95Ms: Math.round(p95 * 10) / 10,
          lentos: intervalos.filter((ms) => ms > 25).length,
          total: intervalos.length,
        });
      }
    };
    requestAnimationFrame(paso);
  });
}
