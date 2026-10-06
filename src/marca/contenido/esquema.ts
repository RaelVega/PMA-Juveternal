import * as v from 'valibot';

const texto = v.pipe(v.string(), v.minLength(1));
const pieza = v.object({ imagen: texto, x: v.number(), y: v.number() });
/** Título en dos líneas, como «CONOCE NUESTROS / PRODUCTOS» del salvapantallas (la segunda en negrita). */
const dosLineas = v.tuple([texto, texto]);
const campoLead = v.object({ etiqueta: texto, maxCaracteres: v.pipe(v.number(), v.integer(), v.minValue(1)) });
const teclado = v.object({ filas: v.array(v.array(texto)), borrar: texto, espacio: texto });

export const esquemaContenido = v.object({
  version: v.number(),
  portada: v.object({
    fondo: pieza,
    bandaSuperior: pieza,
    bandaInferior: pieza,
    titulo: pieza,
    marcas: v.pipe(
      v.array(
        v.object({
          id: texto,
          lado: v.picklist(['izquierda', 'derecha']),
          logo: pieza,
          click: pieza,
          mano: pieza,
          /** Zona táctil [x, y, ancho, alto] en px del lienzo. */
          zona: v.tuple([v.number(), v.number(), v.number(), v.number()]),
          /** Id del catálogo que abre, o null si aún no existe (toca y no pasa nada). */
          catalogo: v.nullable(texto),
        }),
      ),
      v.length(2),
    ),
  }),
  catalogo: v.object({ anterior: texto, siguiente: texto, finalizar: texto }),
  aviso: v.object({ titulo: dosLineas, texto }),
  leads: v.object({
    titulo: dosLineas,
    texto,
    campos: v.object({ nombre: campoLead, correo: campoLead, empresa: campoLead }),
    consentimiento: texto,
    enviar: texto,
    omitir: texto,
    teclado,
    tecladoCorreo: teclado,
    dominios: v.array(texto),
    terminaciones: v.array(texto),
    maxSugerencias: v.pipe(v.number(), v.integer(), v.minValue(0)),
  }),
  despedida: v.object({ titulo: dosLineas, texto, segundos: v.pipe(v.number(), v.minValue(1)) }),
  exportacion: v.object({ hecha: texto, destinoEjecutable: texto, destinoNavegador: texto, fallo: texto, falloDetalle: texto }),
});
export type Contenido = v.InferOutput<typeof esquemaContenido>;
export type MarcaPortada = Contenido['portada']['marcas'][number];
export type Pieza = v.InferOutput<typeof pieza>;

export const esquemaManifiesto = v.object({
  version: v.number(),
  imagenes: v.record(v.string(), v.object({ archivo: v.string(), ancho: v.number(), alto: v.number() })),
  videos: v.record(v.string(), v.object({ archivo: v.string() })),
  fuentes: v.record(v.string(), v.object({ archivo: v.string(), familia: v.string(), peso: v.optional(v.string()) })),
  catalogos: v.record(v.string(), v.object({ archivo: v.string() })),
});
export type Manifiesto = v.InferOutput<typeof esquemaManifiesto>;

export const esquemaCatalogo = v.object({
  version: v.number(),
  estilos: texto,
  paginas: v.pipe(
    v.array(v.object({ archivo: texto, origen: texto, imagenes: v.array(v.string()), videos: v.array(v.string()) })),
    v.minLength(1),
  ),
});
export type IndiceCatalogo = v.InferOutput<typeof esquemaCatalogo>;

/** Comprobaciones que el esquema no expresa: cada imagen y catálogo citado existe en el manifiesto. */
export function validarReferencias(contenido: Contenido, manifiesto: Manifiesto): string[] {
  const problemas: string[] = [];
  const { portada } = contenido;
  const piezas = [portada.fondo, portada.bandaSuperior, portada.bandaInferior, portada.titulo, ...portada.marcas.flatMap((m) => [m.logo, m.click, m.mano])];
  for (const p of piezas) if (!manifiesto.imagenes[p.imagen]) problemas.push(`la imagen «${p.imagen}» no está en el manifiesto`);
  for (const m of portada.marcas) if (m.catalogo && !manifiesto.catalogos[m.catalogo]) problemas.push(`el catálogo «${m.catalogo}» de ${m.id} no está en el manifiesto`);
  return problemas;
}
