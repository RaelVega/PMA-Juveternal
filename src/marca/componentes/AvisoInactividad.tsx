import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useContenido, useFlujo, useImagenesEscena } from '../estado';
import { CURVA_ESTANDAR, DURACION } from '../tokens/movimiento';
import { EscenaDual } from './EscenaDual';
import estilos from './AvisoInactividad.module.css';

/**
 * Aviso a los 45 s sin tocar, con la identidad del salvapantallas. Cubre la
 * pantalla para que el toque que lo quita no active nada debajo. La barra se
 * vacía en los segundos que faltan para volver al salvapantallas.
 */
export function AvisoInactividad({ segundosParaReinicio }: { segundosParaReinicio: number }): ReactNode {
  const activo = useFlujo((f) => f.avisoInactividad);
  const { aviso } = useContenido();
  const imagenes = useImagenesEscena();

  return (
    <AnimatePresence>
      {activo && (
        <motion.div
          className={estilos.capa}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: DURACION.entrada / 1000, ease: CURVA_ESTANDAR } }}
          exit={{ opacity: 0, transition: { duration: DURACION.salida / 1000, ease: CURVA_ESTANDAR } }}
        >
          {/* Las bandas entran cuando la capa ya se ve: dos elementos animando como mucho. */}
          <EscenaDual titulo={aviso.titulo} imagenes={imagenes} retraso={DURACION.entrada / 1000}>
            <p className={estilos.texto}>{aviso.texto}</p>
            <div className={estilos.pista}>
              <div className={estilos.barra} style={{ animationDuration: `${segundosParaReinicio}s` }} />
            </div>
          </EscenaDual>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
