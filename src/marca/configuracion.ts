/** Plazos de inactividad, los mismos que Biocaps: aviso a los 45 s sin tocar y vuelta al salvapantallas a los 55 s. */
export const AVISO_INACTIVIDAD_MS = 45_000;
export const REINICIO_INACTIVIDAD_MS = 55_000;

/**
 * Textos de emergencia: solo para cuando `contenido.json` no se pudo leer, que
 * es justo cuando no hay de dónde sacar el texto. Todo lo demás vive en el JSON.
 */
export const TEXTO_FALLO_CONTENIDO = {
  titulo: 'VOLVEMOS EN UN MOMENTO',
  texto: 'La pantalla se está reiniciando',
} as const;

/** Si el contenido no carga, se reintenta sola tras este tiempo. */
export const REINTENTO_FALLO_MS = 20_000;
