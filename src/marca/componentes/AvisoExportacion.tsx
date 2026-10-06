import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';
import { useContenido } from '../estado';
import { iniciarExportacionLeads, type ResultadoExportacion } from '../leads/guardar';
import { CURVA_ESTANDAR, DURACION } from '../tokens/movimiento';
import estilos from './AvisoExportacion.module.css';

/** Cuánto se ve el aviso antes de desvanecerse. */
const VISIBLE_MS = 3500;

/**
 * Atiende Ctrl+Shift+E y confirma al staff cuántos leads se exportaron y
 * dónde quedaron. Es un aviso pasivo: no se toca, no interrumpe al visitante
 * y se va solo. Nunca un `alert`.
 */
export function AvisoExportacion(): ReactNode {
  const { exportacion } = useContenido();
  // Cada exportación es un aviso nuevo (clave distinta): repetir el atajo reinicia la cuenta.
  const [aviso, setAviso] = useState<{ clave: number; resultado: ResultadoExportacion } | null>(null);

  useEffect(() => iniciarExportacionLeads((resultado) => setAviso((previo) => ({ clave: (previo?.clave ?? 0) + 1, resultado }))), []);

  useEffect(() => {
    if (!aviso) return;
    const id = setTimeout(() => setAviso(null), VISIBLE_MS);
    return () => clearTimeout(id);
  }, [aviso]);

  const lineas = !aviso
    ? null
    : aviso.resultado.ok
      ? [exportacion.hecha.replace('{n}', String(aviso.resultado.cantidad)), aviso.resultado.destino === 'ejecutable' ? exportacion.destinoEjecutable : exportacion.destinoNavegador]
      : [exportacion.fallo, exportacion.falloDetalle];

  return (
    <AnimatePresence>
      {aviso && lineas && (
        <motion.div
          key={aviso.clave}
          className={aviso.resultado.ok ? estilos.aviso : `${estilos.aviso} ${estilos.fallo}`}
          role="status"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: DURACION.entrada / 1000, ease: CURVA_ESTANDAR } }}
          exit={{ opacity: 0, transition: { duration: DURACION.salida / 1000, ease: CURVA_ESTANDAR } }}
        >
          <span className={estilos.titulo}>{lineas[0]}</span>
          <span className={estilos.detalle}>{lineas[1]}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
