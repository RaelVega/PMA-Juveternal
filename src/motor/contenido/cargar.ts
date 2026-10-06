import * as v from 'valibot';

/**
 * Resuelve una ruta dentro de `contenido/` relativa al documento. Nunca una
 * ruta absoluta: la misma build debe funcionar en app://, en localhost y en
 * una subruta de un hosting.
 */
export function urlContenido(ruta: string): string {
  return new URL(`contenido/${ruta}`, document.baseURI).href;
}

export class ErrorContenido extends Error {
  override readonly name = 'ErrorContenido';
}

/** Descarga y valida un JSON de `contenido/`. Si falla, lanza un error legible, nunca un `undefined` silencioso. */
export async function cargarJson<E extends v.GenericSchema>(ruta: string, esquema: E): Promise<v.InferOutput<E>> {
  let respuesta: Response;
  try {
    respuesta = await fetch(urlContenido(ruta), { cache: 'no-store' });
  } catch (error) {
    throw new ErrorContenido(`No se pudo leer contenido/${ruta}: ${String(error)}`);
  }
  if (!respuesta.ok) throw new ErrorContenido(`contenido/${ruta} respondió ${respuesta.status}`);

  let datos: unknown;
  try {
    datos = await respuesta.json();
  } catch {
    throw new ErrorContenido(`contenido/${ruta} no es un JSON válido`);
  }

  const resultado = v.safeParse(esquema, datos);
  if (!resultado.success) {
    const detalle = resultado.issues
      .slice(0, 5)
      .map((problema) => `${v.getDotPath(problema) ?? '(raíz)'}: ${problema.message}`)
      .join('; ');
    throw new ErrorContenido(`contenido/${ruta} tiene errores: ${detalle}`);
  }
  return resultado.output;
}
