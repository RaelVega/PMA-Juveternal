/** Reloj inyectable: en producción es el del navegador; en pruebas, uno falso. */
export interface Reloj {
  setTimeout(funcion: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

export const relojDelSistema: Reloj = {
  setTimeout: (funcion, ms) => globalThis.setTimeout(funcion, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id as ReturnType<typeof setTimeout>),
};
