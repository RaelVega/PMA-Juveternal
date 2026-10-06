/**
 * Las acciones que InDesign escribe en los atributos de sus botones y animaciones
 * (`data-clickactions`, `data-animationOnPageLoadActions`…), interpretadas sin
 * `eval`. Solo se reconocen las que usa el export; la ingesta falla si aparece
 * otra, así que aquí nunca llega una desconocida sin que se sepa.
 */
export type Accion =
  | { readonly tipo: 'mostrar'; readonly id: string }
  | { readonly tipo: 'ocultar'; readonly id: string }
  | { readonly tipo: 'irA'; readonly pagina: number }
  /** Botón de inicio (la casa): al selector de empresa. La ingesta lo marca como goToDestination('inicio'). */
  | { readonly tipo: 'inicio' }
  | { readonly tipo: 'animar'; readonly id: string | null; readonly clase: string; readonly retrasoS: number; readonly ocultarAlTerminar: boolean }
  | { readonly tipo: 'reproducir'; readonly id: string | null; readonly desdeS: number; readonly retrasoS: number };

/** `publication.html` es la portada (0); `publication-N.html`, la página N. */
export function paginaDeDestino(ref: string): number | null {
  if (/^publication\.html$/.test(ref)) return 0;
  const m = /^publication-(\d+)\.html$/.exec(ref);
  return m ? Number(m[1]) : null;
}

/** Argumentos de una llamada: cadenas entre comillas simples, números o `selfContainerID` (→ null). */
function argumentos(texto: string): (string | number | null)[] {
  const salida: (string | number | null)[] = [];
  for (const m of texto.matchAll(/'([^']*)'|(-?\d+(?:\.\d+)?)|(selfContainerID)|\b(true|false)\b/g)) {
    if (m[1] !== undefined) salida.push(m[1]);
    else if (m[2] !== undefined) salida.push(Number(m[2]));
    else if (m[4] !== undefined) salida.push(m[4] === 'true' ? 'true' : '');
    else salida.push(null);
  }
  return salida;
}

/** Convierte el texto de un atributo de acciones en una lista. Lo que no se reconoce se ignora. */
export function interpretarAcciones(texto: string | null): Accion[] {
  if (!texto) return [];
  const acciones: Accion[] = [];
  for (const m of texto.matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const [, nombre = '', resto = ''] = m;
    const args = argumentos(resto);
    const texto0 = typeof args[0] === 'string' ? args[0] : null;
    switch (nombre) {
      case 'onShow':
        if (texto0) acciones.push({ tipo: 'mostrar', id: texto0 });
        break;
      case 'onHide':
        if (texto0) acciones.push({ tipo: 'ocultar', id: texto0 });
        break;
      case 'goToDestination': {
        if (texto0 === 'inicio') {
          acciones.push({ tipo: 'inicio' });
          break;
        }
        const pagina = texto0 ? paginaDeDestino(texto0) : null;
        if (pagina !== null) acciones.push({ tipo: 'irA', pagina });
        break;
      }
      case 'playAnimation': {
        const clase = typeof args[1] === 'string' ? args[1] : null;
        if (!clase) break;
        acciones.push({
          tipo: 'animar',
          id: texto0,
          clase,
          retrasoS: typeof args[2] === 'number' ? args[2] : 0,
          // InDesign escribe '' o 'true' como cuarto argumento.
          ocultarAlTerminar: args[3] === 'true',
        });
        break;
      }
      case 'onMediaStart':
        // onMediaStart(id, segundo de inicio, retraso en segundos).
        acciones.push({ tipo: 'reproducir', id: texto0, desdeS: typeof args[1] === 'number' ? args[1] : 0, retrasoS: typeof args[2] === 'number' ? args[2] : 0 });
        break;
    }
  }
  return acciones;
}
