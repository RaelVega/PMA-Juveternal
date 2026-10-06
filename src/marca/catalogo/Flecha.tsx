import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import estilos from './Flecha.module.css';

interface Propiedades {
  sentido: 'anterior' | 'siguiente';
  /** Nombre accesible (no se ve): sin texto visible, es lo único que dice qué hace. */
  etiqueta: string;
  alTocar: () => void;
}

/**
 * Flecha para pasar de página: la del primer prototipo de la pantalla dual
 * (botón circular con borde y flecha de trazo, que se encoge al tocar), sobre
 * una superficie clara para leerse encima de cualquier página.
 */
export function Flecha({ sentido, etiqueta, alTocar }: Propiedades): ReactNode {
  return (
    <motion.button
      type="button"
      aria-label={etiqueta}
      className={`${estilos.flecha} ${sentido === 'anterior' ? estilos.anterior : estilos.siguiente}`}
      whileTap={{ scale: 0.92 }}
      transition={{ duration: 0.08 }}
      onClick={alTocar}
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden focusable="false" className={sentido === 'siguiente' ? estilos.espejo : undefined}>
        <path d="M19 12H5M5 12L11 6M5 12L11 18" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </motion.button>
  );
}
