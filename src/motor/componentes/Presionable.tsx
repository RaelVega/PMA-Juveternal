import { useState, type CSSProperties, type ReactNode } from 'react';
import estilos from './Presionable.module.css';

interface PropiedadesPresionable {
  alActivar: () => void;
  children?: ReactNode;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  desactivado?: boolean;
  seleccionado?: boolean;
  etiqueta?: string;
}

/**
 * Base de todo lo tocable. La respuesta visual va en `pointerdown` (menos de
 * 100 ms, antes de soltar); la acción, al soltar dentro (`click`), que es lo
 * que emulan las pantallas táctiles del stand. Sin hover.
 */
export function Presionable({ alActivar, children, className, style, desactivado = false, seleccionado = false, etiqueta }: PropiedadesPresionable): ReactNode {
  const [presionado, setPresionado] = useState(false);
  const soltar = (): void => setPresionado(false);

  return (
    <button
      type="button"
      className={[estilos.presionable, className].filter(Boolean).join(' ')}
      style={style}
      data-presionado={presionado || undefined}
      data-seleccionado={seleccionado || undefined}
      aria-pressed={seleccionado}
      aria-disabled={desactivado || undefined}
      aria-label={etiqueta}
      onPointerDown={() => {
        if (!desactivado) setPresionado(true);
      }}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      onPointerLeave={soltar}
      onClick={() => {
        if (!desactivado) alActivar();
      }}
    >
      {children}
    </button>
  );
}
