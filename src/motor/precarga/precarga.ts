/**
 * Precarga todo antes de la portada: después de esto no hay carga perezosa
 * en toda la sesión. Una imagen rota o una fuente que no llega nunca cuelga
 * el arranque: cada pieza se resuelve sola y hay un techo de tiempo.
 */

/** Las imágenes decodificadas se retienen para que el navegador no las descarte a media sesión. */
const retenidas: HTMLImageElement[] = [];

function precargarImagen(url: string): Promise<string | null> {
  const imagen = new Image();
  imagen.decoding = 'async';
  imagen.src = url;
  retenidas.push(imagen);
  return imagen.decode().then(
    () => null,
    () => url,
  );
}

async function precargarFuente(descriptor: string): Promise<string | null> {
  try {
    const caras = await document.fonts.load(descriptor);
    return caras.length > 0 ? null : descriptor;
  } catch {
    return descriptor;
  }
}

const esperar = (ms: number): Promise<void> => new Promise((resolver) => setTimeout(resolver, ms));

export interface OpcionesPrecarga {
  imagenes: readonly string[];
  /** Descriptores de `document.fonts.load`, p. ej. `800 73.7px "Interfaz"`. */
  fuentes: readonly string[];
  /** Tiempo mínimo en pantalla de arranque, para que no parpadee. */
  minimoMs: number;
  /** Nunca esperar más que esto, aunque algo no termine. */
  maximoMs: number;
}

export interface ResultadoPrecarga {
  /** Lo que no cargó (se registra; la app sigue). */
  fallidas: string[];
  agotoTiempo: boolean;
}

export async function precargar(opciones: OpcionesPrecarga): Promise<ResultadoPrecarga> {
  const carga = Promise.all([...opciones.imagenes.map(precargarImagen), ...opciones.fuentes.map(precargarFuente)]).then((resultados) => ({
    fallidas: resultados.filter((r): r is string => r !== null),
    agotoTiempo: false,
  }));
  const techo = esperar(opciones.maximoMs).then((): ResultadoPrecarga => ({ fallidas: [], agotoTiempo: true }));
  const [resultado] = await Promise.all([Promise.race([carga, techo]), esperar(opciones.minimoMs)]);
  return resultado;
}
