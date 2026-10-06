import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useMovimientoReducido } from '../../motor/movimiento/useMovimientoReducido';
import { CURVA_ESTANDAR } from '../tokens/movimiento';
import estilos from './EscenaDual.module.css';

export interface ImagenesEscena {
  fondo: string;
  bandaSuperior: { url: string; x: number; y: number; ancho: number; alto: number };
  bandaInferior: { url: string; x: number; y: number; ancho: number; alto: number };
}

interface Propiedades {
  /** Las dos líneas del título: la primera ligera y la segunda en negrita, como en el salvapantallas. */
  titulo: readonly [string, string];
  /** Piezas del salvapantallas. Sin ellas (pantalla de fallo: el contenido no cargó) se dibujan en CSS. */
  imagenes?: ImagenesEscena | undefined;
  /** Retraso de la entrada, en segundos. */
  retraso?: number;
  children?: ReactNode;
}

/**
 * La identidad del salvapantallas para cualquier pantalla: su fondo partido
 * (Juveternal turquesa | Anáhuac naranja), las dos bandas en el mismo sitio y
 * un título blanco en itálica sobre ellas. Las bandas entran desde los lados
 * y luego el título (dos elementos animando como mucho).
 */
export function EscenaDual({ titulo, imagenes, retraso = 0, children }: Propiedades): ReactNode {
  const reducido = useMovimientoReducido();
  const entrada = (desde: number, demora: number) => ({
    initial: { opacity: 0, x: reducido ? 0 : desde },
    animate: { opacity: 1, x: 0, transition: { delay: retraso + demora, duration: 0.45, ease: CURVA_ESTANDAR } },
  });
  const sup = imagenes?.bandaSuperior;
  const inf = imagenes?.bandaInferior;
  // Sin imágenes, las bandas en CSS van donde las del salvapantallas (y 307 y 407).
  const cajaSup = sup ? { left: sup.x, top: sup.y, width: sup.ancho, height: sup.alto } : { left: 0, top: 307 };
  const cajaInf = inf ? { left: inf.x, top: inf.y, width: inf.ancho, height: inf.alto } : { left: 0, top: 407 };

  return (
    <div className={estilos.escena}>
      {imagenes ? <img className={estilos.fondo} src={imagenes.fondo} alt="" draggable={false} /> : <div className={`${estilos.fondo} ${estilos.fondoCss}`} />}
      <motion.div className={estilos.banda} style={cajaSup} {...entrada(-900, 0)}>
        {sup ? <img src={sup.url} alt="" draggable={false} /> : <div className={`${estilos.bandaCss} ${estilos.bandaCssSuperior}`} />}
      </motion.div>
      <motion.div className={estilos.banda} style={cajaInf} {...entrada(900, 0)}>
        {inf ? <img src={inf.url} alt="" draggable={false} /> : <div className={`${estilos.bandaCss} ${estilos.bandaCssInferior}`} />}
      </motion.div>
      <motion.div
        className={estilos.titulo}
        initial={{ opacity: 0, scale: reducido ? 1 : 0.94 }}
        animate={{ opacity: 1, scale: 1, transition: { delay: retraso + 0.4, duration: 0.4, ease: CURVA_ESTANDAR } }}
      >
        <span className={estilos.linea1}>{titulo[0]}</span>
        <span className={estilos.linea2}>{titulo[1]}</span>
      </motion.div>
      {children}
    </div>
  );
}
