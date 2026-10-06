import { cargarJson, ErrorContenido, urlContenido } from '../../motor/contenido/cargar';
import { esquemaCatalogo, esquemaContenido, esquemaManifiesto, validarReferencias, type Contenido, type Manifiesto } from './esquema';

export interface PaginaCatalogo {
  /** HTML limpio de la página (generado por la ingesta, sin scripts). */
  html: string;
  imagenes: readonly string[];
  videos: readonly string[];
}

export interface CatalogoCargado {
  id: string;
  /** Ruta dentro de contenido/ del CSS de InDesign acotado a `.indesign`. */
  estilos: string;
  paginas: readonly PaginaCatalogo[];
}

export interface ContenidoCargado {
  contenido: Contenido;
  manifiesto: Manifiesto;
  catalogos: Readonly<Record<string, CatalogoCargado>>;
}

async function leerTexto(ruta: string): Promise<string> {
  const respuesta = await fetch(urlContenido(ruta), { cache: 'no-store' });
  if (!respuesta.ok) throw new ErrorContenido(`contenido/${ruta} respondió ${respuesta.status}`);
  return respuesta.text();
}

/** Todo el contenido, validado, y el HTML de todas las páginas en memoria: después no se lee nada más del disco salvo imágenes. */
export async function cargarContenido(): Promise<ContenidoCargado> {
  const [contenido, manifiesto] = await Promise.all([cargarJson('contenido.json', esquemaContenido), cargarJson('manifiesto.json', esquemaManifiesto)]);
  const problemas = validarReferencias(contenido, manifiesto);
  if (problemas.length) throw new ErrorContenido(`Contenido incoherente: ${problemas.join('; ')}`);

  const catalogos: Record<string, CatalogoCargado> = {};
  await Promise.all(
    Object.entries(manifiesto.catalogos).map(async ([id, { archivo }]) => {
      const indice = await cargarJson(archivo, esquemaCatalogo);
      const paginas = await Promise.all(indice.paginas.map(async (p) => ({ html: await leerTexto(p.archivo), imagenes: p.imagenes, videos: p.videos })));
      catalogos[id] = { id, estilos: indice.estilos, paginas };
    }),
  );
  return { contenido, manifiesto, catalogos };
}
