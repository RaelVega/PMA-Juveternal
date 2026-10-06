import { motion, type TargetAndTransition, type Transition } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { useMovimientoReducido } from '../../motor/movimiento/useMovimientoReducido';
import type { MarcaPortada, Pieza } from '../contenido/esquema';
import { useContenido, useDespachar, useImagen } from '../estado';
import { CURVA_ESTANDAR } from '../tokens/movimiento';
import estilos from './Portada.module.css';

/**
 * Salvapantallas y elección de marca: Juveternal a la izquierda, Anáhuac a la
 * derecha. Las piezas de marketing van en su posición exacta (contenido.json).
 *
 * Coreografía, siempre con 2 elementos animando como mucho:
 * - Entrada (≈2 s): bandas desde los lados → título → logos → «click aquí» → manos.
 * - Bucle de CICLO s: Juveternal (la mano toca, el logo late), luego Anáhuac,
 *   luego un brillo cruza el título.
 */
const CICLO = 6;
const FIN_ENTRADA = 2;
/** Tramo del ciclo de cada lado (fracciones de CICLO) y del brillo. */
const TRAMO = { izquierda: 0.02, derecha: 0.42, brillo: 0.8 } as const;

const entrada = (retraso: number, duracion = 0.45): Transition => ({ delay: retraso, duration: duracion, ease: CURVA_ESTANDAR });

/** Bucle infinito: la animación ocupa el 40 % del ciclo empezando en `inicio`, y el resto queda quieta. */
function bucle(inicio: number, valores: Record<string, number[]>): TargetAndTransition {
  const pasos = valores[Object.keys(valores)[0] ?? '']?.length ?? 2;
  const tiempos = Array.from({ length: pasos }, (_, k) => inicio + (0.4 * k) / (pasos - 1));
  const conBordes = (lista: number[]): number[] => [lista[0] ?? 0, ...lista, lista[lista.length - 1] ?? 0];
  return {
    ...Object.fromEntries(Object.entries(valores).map(([k, v]) => [k, conBordes(v)])),
    transition: { duration: CICLO, times: [0, ...tiempos, 1], repeat: Infinity, ease: 'easeInOut', delay: FIN_ENTRADA },
  };
}

function Imagen({ pieza, className }: { pieza: Pieza; className?: string | undefined }): ReactNode {
  const imagen = useImagen(pieza.imagen);
  return <img src={imagen.url} width={imagen.ancho} height={imagen.alto} alt="" draggable={false} className={className} />;
}

interface Caja {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Caja posicionada con las medidas de la imagen de la pieza. */
function useCaja(pieza: Pieza): Caja {
  const imagen = useImagen(pieza.imagen);
  return { left: pieza.x, top: pieza.y, width: imagen.ancho, height: imagen.alto };
}

function LadoMarca({ marca, indice, reducido }: { marca: MarcaPortada; indice: number; reducido: boolean }): ReactNode {
  const despachar = useDespachar();
  const [presionada, setPresionada] = useState(false);
  const cajaLogo = useCaja(marca.logo);
  const cajaClick = useCaja(marca.click);
  const cajaMano = useCaja(marca.mano);
  const inicio = TRAMO[marca.lado];
  // La mano apunta hacia su botón: arriba a la derecha (izquierda) o arriba a la izquierda (derecha).
  const haciaX = marca.lado === 'izquierda' ? 10 : -10;
  const [x, y, ancho, alto] = marca.zona;

  const elegir = (): void => {
    if (!marca.catalogo) return; // Juveternal aún sin catálogo (pendiente): el toque solo da respuesta visual.
    despachar({ tipo: 'elegir', valor: marca.catalogo });
    despachar({ tipo: 'avanzar', origen: 'visitante' });
  };

  return (
    <>
      <motion.div
        className={estilos.pieza}
        style={cajaLogo}
        initial={{ opacity: 0, y: reducido ? 0 : 40 }}
        animate={{ opacity: 1, y: 0, transition: entrada(0.85 + indice * 0.05) }}
      >
        <motion.div animate={presionada ? { scale: 0.95, transition: { duration: 0.08 } } : reducido ? {} : bucle(inicio, { scale: [1, 1.05, 1, 1.05, 1] })}>
          <Imagen pieza={marca.logo} />
        </motion.div>
      </motion.div>
      <motion.div className={estilos.pieza} style={cajaClick} initial={{ opacity: 0, scale: reducido ? 1 : 0.8 }} animate={{ opacity: 1, scale: 1, transition: entrada(1.3, 0.35) }}>
        <Imagen pieza={marca.click} />
      </motion.div>
      <motion.div className={estilos.pieza} style={cajaMano} initial={{ opacity: 0, y: reducido ? 0 : 30 }} animate={{ opacity: 1, y: 0, transition: entrada(1.65, 0.35) }}>
        <motion.div animate={reducido ? {} : bucle(inicio, { x: [0, haciaX, 0, haciaX, 0], y: [0, -12, 0, -12, 0] })}>
          <Imagen pieza={marca.mano} />
        </motion.div>
      </motion.div>
      <button
        type="button"
        aria-label={marca.id}
        className={estilos.zona}
        style={{ left: x, top: y, width: ancho, height: alto }}
        onPointerDown={() => setPresionada(true)}
        onPointerUp={() => setPresionada(false)}
        onPointerLeave={() => setPresionada(false)}
        onPointerCancel={() => setPresionada(false)}
        onClick={elegir}
      />
    </>
  );
}

export function Portada(): ReactNode {
  const { portada } = useContenido();
  const reducido = useMovimientoReducido();
  const cajaBandaSup = useCaja(portada.bandaSuperior);
  const cajaBandaInf = useCaja(portada.bandaInferior);
  const cajaTitulo = useCaja(portada.titulo);

  return (
    <div className={estilos.portada}>
      <Imagen pieza={portada.fondo} className={estilos.fondo} />
      <motion.div className={estilos.pieza} style={cajaBandaSup} initial={{ opacity: 0, x: reducido ? 0 : -cajaBandaSup.width }} animate={{ opacity: 1, x: 0, transition: entrada(0.1) }}>
        <Imagen pieza={portada.bandaSuperior} />
      </motion.div>
      <motion.div className={estilos.pieza} style={cajaBandaInf} initial={{ opacity: 0, x: reducido ? 0 : cajaBandaInf.width }} animate={{ opacity: 1, x: 0, transition: entrada(0.1) }}>
        <Imagen pieza={portada.bandaInferior} />
      </motion.div>
      {/* Brillo que cruza el título: va recortado a la franja de las bandas. */}
      {!reducido && (
        <div className={estilos.franjaBrillo} style={{ top: cajaBandaSup.top, height: cajaBandaInf.top + cajaBandaInf.height - cajaBandaSup.top }}>
          <motion.div
            className={estilos.carrilBrillo}
            initial={{ x: -400 }}
            animate={{
              x: [-400, -400, 1180, 1180],
              transition: { duration: CICLO, times: [0, TRAMO.brillo, TRAMO.brillo + 0.18, 1], repeat: Infinity, ease: 'easeInOut', delay: FIN_ENTRADA },
            }}
          >
            <div className={estilos.brillo} />
          </motion.div>
        </div>
      )}
      <motion.div className={estilos.pieza} style={cajaTitulo} initial={{ opacity: 0, scale: reducido ? 1 : 0.94 }} animate={{ opacity: 1, scale: 1, transition: entrada(0.5, 0.4) }}>
        <Imagen pieza={portada.titulo} />
      </motion.div>
      {portada.marcas.map((marca, indice) => (
        <LadoMarca key={marca.id} marca={marca} indice={indice} reducido={reducido} />
      ))}
    </div>
  );
}
