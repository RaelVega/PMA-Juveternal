import { useSyncExternalStore } from 'react';

const CONSULTA = '(prefers-reduced-motion: reduce)';

function suscribir(avisar: () => void): () => void {
  const lista = window.matchMedia(CONSULTA);
  lista.addEventListener('change', avisar);
  return () => lista.removeEventListener('change', avisar);
}

/** true si el sistema pide movimiento reducido: mismas duraciones, sin desplazamientos. */
export function useMovimientoReducido(): boolean {
  return useSyncExternalStore(suscribir, () => window.matchMedia(CONSULTA).matches, () => false);
}
