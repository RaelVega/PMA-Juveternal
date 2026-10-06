import { relojDelSistema, type Reloj } from './reloj';

/**
 * Blindaje de animaciones: `alTerminar` se ejecuta una sola vez, sea porque
 * la animación avisó que terminó o porque venció el respaldo. Si la
 * animación falla o se cuelga, el flujo sigue igual.
 */
export interface Respaldo {
  /** Llamar desde el fin real de la animación. */
  terminar(): void;
  /** Cancela sin ejecutar (p. ej. al desmontar la pantalla). */
  cancelar(): void;
}

export function programarRespaldo(alTerminar: () => void, respaldoMs: number, reloj: Reloj = relojDelSistema): Respaldo {
  let pendiente = true;
  const id = reloj.setTimeout(() => {
    if (!pendiente) return;
    pendiente = false;
    alTerminar();
  }, respaldoMs);

  return {
    terminar() {
      if (!pendiente) return;
      pendiente = false;
      reloj.clearTimeout(id);
      alTerminar();
    },
    cancelar() {
      pendiente = false;
      reloj.clearTimeout(id);
    },
  };
}
