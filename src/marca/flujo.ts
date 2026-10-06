import { crearMaquina, type DefinicionFlujo, type Maquina } from '../motor/maquina/maquina';

/**
 * Flujo de la pantalla dual: el salvapantallas (elegir marca) y el catálogo de
 * la marca. Dentro del catálogo, la página es parte de la sesión: así la
 * inactividad y el reinicio la devuelven a la portada sin estado suelto.
 */
export type PasoDual = 'portada' | 'catalogo';

export interface SesionDual {
  /** Id del catálogo elegido (la marca), o null en el salvapantallas. */
  readonly catalogo: string | null;
  readonly pagina: number;
}

export const SESION_INICIAL: SesionDual = Object.freeze({ catalogo: null, pagina: 0 });

/** Valor de `elegir` para ir a una página del catálogo. */
export const valorPagina = (pagina: number): string => `pagina:${pagina}`;

/** Páginas de cada catálogo disponible: solo se puede elegir un catálogo que exista. */
export function crearMaquinaDual(paginasPorCatalogo: Readonly<Record<string, number>>): Maquina<PasoDual, SesionDual> {
  const definicion: DefinicionFlujo<PasoDual, SesionDual> = {
    orden: ['portada', 'catalogo'],
    sesionInicial: SESION_INICIAL,
    pasos: {
      portada: {
        tipo: 'portada',
        elegir: (s, valor) => ((paginasPorCatalogo[valor] ?? 0) > 0 ? { ...s, catalogo: valor, pagina: 0 } : null),
        puedeAvanzar: (s) => s.catalogo !== null,
      },
      catalogo: {
        tipo: 'informativo',
        elegir: (s, valor) => {
          const m = /^pagina:(\d+)$/.exec(valor);
          const total = s.catalogo ? (paginasPorCatalogo[s.catalogo] ?? 0) : 0;
          if (!m) return null;
          const pagina = Number(m[1]);
          return pagina < total && pagina !== s.pagina ? { ...s, pagina } : null;
        },
      },
    },
  };
  return crearMaquina(definicion);
}
