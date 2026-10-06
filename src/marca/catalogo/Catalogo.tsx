import { AnimatePresence, motion, type Variants } from 'motion/react';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { urlContenido } from '../../motor/contenido/cargar';
import { useMovimientoReducido } from '../../motor/movimiento/useMovimientoReducido';
import { useContenido, useDespachar, useFlujo, useRecursos } from '../estado';
import { valorPagina } from '../flujo';
import { CURVA_ESTANDAR, DESPLAZAMIENTO_PAGINA, DURACION } from '../tokens/movimiento';
import { Flecha } from './Flecha';
import { PaginaInDesign } from './PaginaInDesign';
import estilos from './Catalogo.module.css';

/** Imágenes decodificadas de las páginas vecinas, retenidas solo mientras se está cerca de ellas. */
const vecinas = new Map<string, HTMLImageElement>();

function decodificarVecinas(urls: readonly string[]): void {
  const quedan = new Set(urls);
  for (const url of vecinas.keys()) if (!quedan.has(url)) vecinas.delete(url);
  for (const url of urls) {
    if (vecinas.has(url)) continue;
    const imagen = new Image();
    imagen.decoding = 'async';
    imagen.src = url;
    vecinas.set(url, imagen);
    imagen.decode().catch(() => vecinas.delete(url));
  }
}

/** La página entra desde el lado hacia el que se avanza; la anterior solo se desvanece (2 elementos animando como mucho). */
function variantes(reducido: boolean): Variants {
  const desplazamiento = reducido ? 0 : DESPLAZAMIENTO_PAGINA;
  return {
    entra: (direccion: number) => ({ opacity: 0, x: direccion * desplazamiento }),
    visible: { opacity: 1, x: 0, transition: { duration: DURACION.pagina / 1000, ease: CURVA_ESTANDAR } },
    sale: { opacity: 0, transition: { duration: DURACION.salida / 1000, ease: CURVA_ESTANDAR } },
  };
}

export function Catalogo(): ReactNode {
  const id = useFlujo((f) => f.sesion.catalogo);
  const pagina = useFlujo((f) => f.sesion.pagina);
  const despachar = useDespachar();
  const textos = useContenido().catalogo;
  const catalogo = useRecursos().catalogos[id ?? ''];
  const marca = useContenido().selector.marcas.find((m) => m.catalogo === id);
  const todas = marca?.flechas !== 'extremos';
  const reducido = useMovimientoReducido();
  // Con una ficha abierta las flechas se apartan: no tapan la ficha y se cierra con su ✕.
  const [fichaAbierta, setFichaAbierta] = useState(false);
  const anterior = useRef(pagina);
  const direccion = pagina >= anterior.current ? 1 : -1;
  useEffect(() => {
    anterior.current = pagina;
  }, [pagina]);

  const paginas = catalogo?.paginas ?? [];
  useEffect(() => {
    decodificarVecinas([pagina - 1, pagina + 1].flatMap((n) => paginas[n]?.imagenes ?? []).map(urlContenido));
  }, [pagina, paginas]);
  useEffect(() => () => vecinas.clear(), []);

  const actual = paginas[pagina];
  if (!actual) return null;
  const irA = (n: number): void => despachar({ tipo: 'elegir', valor: valorPagina(n) });
  // Desde la portada del catálogo, «anterior» vuelve al selector de marca.
  const retroceder = (): void => (pagina === 0 ? despachar({ tipo: 'retroceder' }) : irA(pagina - 1));

  return (
    <div className={estilos.catalogo} style={marca ? ({ '--color-flecha': marca.color } as CSSProperties) : undefined}>
      <AnimatePresence mode="popLayout" initial={false} custom={direccion}>
        <motion.div key={pagina} className={estilos.capa} custom={direccion} variants={variantes(reducido)} initial="entra" animate="visible" exit="sale">
          <PaginaInDesign html={actual.html} catalogo={catalogo?.id ?? ''} alIrA={irA} alCambiarFicha={setFichaAbierta} />
        </motion.div>
      </AnimatePresence>
      <AnimatePresence>
        {!fichaAbierta && (
          <motion.div
            key="flechas"
            className={estilos.flechas}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: DURACION.entrada / 1000, ease: CURVA_ESTANDAR } }}
            exit={{ opacity: 0, transition: { duration: DURACION.salida / 1000, ease: CURVA_ESTANDAR } }}
          >
            {/* Si el diseño trae sus flechas (Juveternal), las nuestras solo donde él no da salida: ← en la portada, → al final. */}
            {(todas || pagina === 0) && <Flecha sentido="anterior" etiqueta={textos.anterior} alTocar={retroceder} />}
            {/* En la última página, «siguiente» lleva a los leads (la misma pantalla al final de cualquier catálogo). */}
            {pagina < paginas.length - 1 ? (
              todas && <Flecha sentido="siguiente" etiqueta={textos.siguiente} alTocar={() => irA(pagina + 1)} />
            ) : (
              <Flecha sentido="siguiente" etiqueta={textos.finalizar} alTocar={() => despachar({ tipo: 'avanzar', origen: 'visitante' })} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
