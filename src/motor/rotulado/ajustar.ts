/**
 * Ajuste del nombre del producto a su caja, por ancho medido y no por número
 * de caracteres: «WWWWWWW» mide casi el doble que «IIIIIII». Se busca el
 * cuerpo más grande con el que el texto cabe en la caja respetando el máximo
 * de líneas, partiendo por palabras.
 */

/** Ancho en píxeles de `texto` dibujado a `cuerpo` px con la fuente del estilo. */
export type Medidor = (texto: string, cuerpo: number) => number;

export interface OpcionesAjuste {
  texto: string;
  ancho: number;
  alto: number;
  maxLineas: number;
  cuerpoInicial: number;
  cuerpoMinimo: number;
  /** Múltiplo del cuerpo entre líneas. */
  interlineado: number;
  medir: Medidor;
}

export interface Ajuste {
  lineas: string[];
  cuerpo: number;
  /** false si ni al cuerpo mínimo cabe: el llamador decide (p. ej. no aceptar la tecla). */
  cabe: boolean;
}

/** Parte por palabras sin pasarse del ancho. Devuelve null si alguna palabra sola no cabe. */
function partir(palabras: string[], cuerpo: number, ancho: number, medir: Medidor): string[] | null {
  const lineas: string[] = [];
  let actual = '';
  for (const palabra of palabras) {
    if (medir(palabra, cuerpo) > ancho) return null;
    const candidata = actual ? `${actual} ${palabra}` : palabra;
    if (medir(candidata, cuerpo) <= ancho) {
      actual = candidata;
    } else {
      lineas.push(actual);
      actual = palabra;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

function cabeEn(lineas: string[] | null, cuerpo: number, opciones: OpcionesAjuste): lineas is string[] {
  if (!lineas || lineas.length > opciones.maxLineas) return false;
  const altoTexto = cuerpo + (lineas.length - 1) * cuerpo * opciones.interlineado;
  return altoTexto <= opciones.alto;
}

export function ajustarTexto(opciones: OpcionesAjuste): Ajuste {
  const palabras = opciones.texto.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return { lineas: [], cuerpo: opciones.cuerpoInicial, cabe: true };

  // Búsqueda binaria en décimas de píxel: el mayor cuerpo con el que cabe.
  let bajo = Math.round(opciones.cuerpoMinimo * 10);
  let alto = Math.round(opciones.cuerpoInicial * 10);
  let mejor: Ajuste | null = null;
  while (bajo <= alto) {
    const medio = Math.floor((bajo + alto) / 2);
    const cuerpo = medio / 10;
    const lineas = partir(palabras, cuerpo, opciones.ancho, opciones.medir);
    if (cabeEn(lineas, cuerpo, opciones)) {
      mejor = { lineas, cuerpo, cabe: true };
      bajo = medio + 1;
    } else {
      alto = medio - 1;
    }
  }
  if (mejor) return mejor;

  const lineas = partir(palabras, opciones.cuerpoMinimo, opciones.ancho, opciones.medir) ?? palabras;
  return { lineas, cuerpo: opciones.cuerpoMinimo, cabe: false };
}

/** Medidor real con canvas. `fuente` es el shorthand sin tamaño, p. ej. `italic 900 "Interfaz"`. */
export function crearMedidorCanvas(fuente: (cuerpo: number) => string): Medidor {
  const contexto = document.createElement('canvas').getContext('2d');
  if (!contexto) throw new Error('Canvas 2D no disponible para medir texto');
  return (texto, cuerpo) => {
    contexto.font = fuente(cuerpo);
    return contexto.measureText(texto).width;
  };
}
