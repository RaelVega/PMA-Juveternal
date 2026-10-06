import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import estilos from './Lienzo.module.css';

export const ANCHO_LIENZO = 1080;
export const ALTO_LIENZO = 1920;

/**
 * Lienzo fijo de 1080×1920 escalado como bloque, centrado y con bandas si la
 * ventana tiene otra proporción. Nunca rota: la rotación la hace Windows.
 */
export function Lienzo({ children }: { children: ReactNode }): ReactNode {
  const refMarco = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);

  useLayoutEffect(() => {
    const marco = refMarco.current;
    if (!marco) return;
    const recalcular = (): void => {
      const valor = Math.min(marco.clientWidth / ANCHO_LIENZO, marco.clientHeight / ALTO_LIENZO);
      setEscala(valor > 0 ? valor : 1);
    };
    recalcular();
    const observador = new ResizeObserver(recalcular);
    observador.observe(marco);
    return () => observador.disconnect();
  }, []);

  return (
    <div ref={refMarco} className={estilos.marco}>
      <div className={estilos.lienzo} style={{ transform: `translate(-50%, -50%) scale(${escala})` }}>
        {children}
      </div>
    </div>
  );
}
