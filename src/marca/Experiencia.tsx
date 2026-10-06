import { AnimatePresence, motion } from 'motion/react';
import { useEffect, type ReactNode } from 'react';
import { LimiteErrores } from '../motor/kiosco/LimiteErrores';
import { Catalogo } from './catalogo/Catalogo';
import { AvisoExportacion } from './componentes/AvisoExportacion';
import { AvisoInactividad } from './componentes/AvisoInactividad';
import { Despedida } from './despedida/Despedida';
import { Leads } from './leads/Leads';
import { AVISO_INACTIVIDAD_MS, REINICIO_INACTIVIDAD_MS } from './configuracion';
import { useDespachar, useFlujo } from './estado';
import type { PasoDual } from './flujo';
import { Portada } from './portada/Portada';
import { CURVA_ESTANDAR, DURACION } from './tokens/movimiento';
import estilos from './Experiencia.module.css';

const PANTALLAS: Record<PasoDual, () => ReactNode> = { portada: Portada, catalogo: Catalogo, leads: Leads, despedida: Despedida };

export function Experiencia(): ReactNode {
  const paso = useFlujo((f) => f.paso);
  const despachar = useDespachar();
  const Pantalla = PANTALLAS[paso];

  // Cualquier toque, en cualquier parte, cuenta como actividad (y quita el aviso).
  useEffect(() => {
    const alTocar = (): void => despachar({ tipo: 'actividad' });
    window.addEventListener('pointerdown', alTocar, { capture: true });
    return () => window.removeEventListener('pointerdown', alTocar, { capture: true });
  }, [despachar]);

  return (
    <>
      <LimiteErrores alFallar={() => despachar({ tipo: 'reiniciar', motivo: 'error' })}>
        {/* Entre salvapantallas y catálogo solo un fundido: cada pantalla trae su propia entrada.
            initial sin desactivar: si no, la entrada del salvapantallas no se vería al arrancar. */}
        <AnimatePresence mode="popLayout">
          <motion.div
            key={paso}
            className={estilos.pantalla}
            data-paso={paso}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: DURACION.entrada / 1000, ease: CURVA_ESTANDAR } }}
            exit={{ opacity: 0, transition: { duration: DURACION.salida / 1000, ease: CURVA_ESTANDAR } }}
          >
            <Pantalla />
          </motion.div>
        </AnimatePresence>
      </LimiteErrores>
      <AvisoInactividad segundosParaReinicio={(REINICIO_INACTIVIDAD_MS - AVISO_INACTIVIDAD_MS) / 1000} />
      <AvisoExportacion />
    </>
  );
}
