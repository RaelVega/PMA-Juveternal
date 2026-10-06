import { urlContenido } from '../contenido/cargar';

/**
 * Registra las fuentes que viven en `contenido/` (las del nombre del producto
 * por estilo), para que se puedan sustituir sin recompilar. Una fuente que
 * falla no detiene el arranque: se usa la de respaldo del estilo.
 *
 * `peso` es el de la cara («700», o «100 900» si es variable). Sin él la cara
 * queda registrada como 400 y el navegador simula la negrita al pedir otra.
 */
export async function registrarFuentesDeContenido(fuentes: Record<string, { archivo: string; familia: string; peso?: string | undefined }>): Promise<string[]> {
  const fallidas: string[] = [];
  await Promise.all(
    Object.values(fuentes).map(async ({ archivo, familia, peso }) => {
      try {
        const cara = new FontFace(familia, `url("${urlContenido(archivo)}")`, { display: 'block', ...(peso ? { weight: peso } : {}) });
        await cara.load();
        document.fonts.add(cara);
      } catch {
        fallidas.push(archivo);
      }
    }),
  );
  return fallidas;
}
