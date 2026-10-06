import { crearMaquina, type DefinicionFlujo, type Maquina } from '../motor/maquina/maquina';
import { CAMPOS_LEAD, leadCompleto, type CampoLead } from './leads/campos';

/**
 * Flujo de la pantalla dual: salvapantallas (video; un toque) → selector de
 * marca → catálogo de esa marca → leads (una sola pantalla para las dos marcas, al final de cualquier
 * catálogo) → despedida → salvapantallas. La página del catálogo y los datos
 * del lead son parte de la sesión: el reinicio los borra sin estado suelto.
 */
export type PasoDual = 'portada' | 'selector' | 'catalogo' | 'leads' | 'despedida';

export interface LeadSesion {
  readonly nombre: string;
  readonly correo: string;
  readonly empresa: string;
  /** OMITIR: se avanza sin datos (y se borra lo escrito). */
  readonly omitido: boolean;
}

export interface SesionDual {
  /** Id del catálogo elegido (la marca), o null en el salvapantallas. */
  readonly catalogo: string | null;
  readonly pagina: number;
  readonly lead: LeadSesion;
}

const LEAD_VACIO: LeadSesion = Object.freeze({ nombre: '', correo: '', empresa: '', omitido: false });
export const SESION_INICIAL: SesionDual = Object.freeze({ catalogo: null, pagina: 0, lead: LEAD_VACIO });

/** Valor de `elegir` para ir a una página del catálogo. */
export const valorPagina = (pagina: number): string => `pagina:${pagina}`;
/** Valor de `elegir` en los leads para seguir sin dejar datos. */
export const OMITIR_LEAD = 'omitir';

export interface LimitesLead {
  readonly maxCaracteres: Readonly<Record<CampoLead, number>>;
}

/** Páginas de cada catálogo disponible: solo se puede elegir un catálogo que exista. */
export function crearMaquinaDual(paginasPorCatalogo: Readonly<Record<string, number>>, limites: LimitesLead): Maquina<PasoDual, SesionDual> {
  const totalDe = (s: SesionDual): number => (s.catalogo ? (paginasPorCatalogo[s.catalogo] ?? 0) : 0);
  const definicion: DefinicionFlujo<PasoDual, SesionDual> = {
    orden: ['portada', 'selector', 'catalogo', 'leads', 'despedida'],
    sesionInicial: SESION_INICIAL,
    pasos: {
      // El video: cualquier toque avanza; ahí no cuenta la inactividad.
      portada: { tipo: 'portada' },
      // En el selector sí: si nadie elige marca, a los 55 s vuelve al video.
      selector: {
        tipo: 'eleccion',
        elegir: (s, valor) => ((paginasPorCatalogo[valor] ?? 0) > 0 ? { ...s, catalogo: valor, pagina: 0 } : null),
        puedeAvanzar: (s) => s.catalogo !== null,
      },
      catalogo: {
        tipo: 'informativo',
        elegir: (s, valor) => {
          const m = /^pagina:(\d+)$/.exec(valor);
          if (!m) return null;
          const pagina = Number(m[1]);
          return pagina < totalDe(s) && pagina !== s.pagina ? { ...s, pagina } : null;
        },
        // A los leads solo se llega desde la última página del catálogo.
        puedeAvanzar: (s) => s.pagina === totalDe(s) - 1,
      },
      leads: {
        tipo: 'texto',
        escribir: (s, texto, campo) => {
          if (!campo || !(CAMPOS_LEAD as readonly string[]).includes(campo)) return null;
          const clave = campo as CampoLead;
          if (texto.length > limites.maxCaracteres[clave]) return null;
          return { ...s, lead: { ...s.lead, [clave]: texto, omitido: false } };
        },
        elegir: (s, valor) => (valor === OMITIR_LEAD ? { ...s, lead: { ...LEAD_VACIO, omitido: true } } : null),
        puedeAvanzar: (s) => s.lead.omitido || leadCompleto(s.lead),
      },
      despedida: { tipo: 'cierre' },
    },
  };
  return crearMaquina(definicion);
}
