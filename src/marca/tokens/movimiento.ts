/**
 * Tokens de movimiento: única fuente de curvas y duraciones (Motion y CSS).
 * Regla del motor: solo transform y opacity, y como mucho 2 elementos animando a la vez.
 */
export const CURVA_ESTANDAR = [0.2, 0, 0, 1] as const;
export const CURVA_SALIDA = [0.4, 0, 1, 1] as const;

export const DURACION = {
  entrada: 240,
  salida: 160,
  presion: 80,
  /** Cambio de página del catálogo. */
  pagina: 320,
  /** Aparición de una ficha del catálogo. */
  ficha: 220,
} as const;

/** Desplazamiento horizontal de la página que entra (0 con movimiento reducido). */
export const DESPLAZAMIENTO_PAGINA = 80;

export function aplicarTokensMovimiento(raiz: HTMLElement = document.documentElement): void {
  raiz.style.setProperty('--curva-estandar', `cubic-bezier(${CURVA_ESTANDAR.join(', ')})`);
  for (const [nombre, ms] of Object.entries(DURACION)) raiz.style.setProperty(`--dur-${nombre}`, `${ms}ms`);
}
