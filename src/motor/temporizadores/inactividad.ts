import { relojDelSistema, type Reloj } from './reloj';

export interface OpcionesInactividad {
  avisoMs: number;
  reinicioMs: number;
  alAvisar: () => void;
  alReiniciar: () => void;
  reloj?: Reloj;
}

export interface TemporizadorInactividad {
  /** (Re)inicia la cuenta desde cero: se llama con cada toque. */
  armar(): void;
  /** Detiene la cuenta (portada, paso automático). */
  desarmar(): void;
  readonly armado: boolean;
}

/** Aviso y reinicio por inactividad. Los dos plazos cuentan desde el último toque. */
export function crearTemporizadorInactividad(opciones: OpcionesInactividad): TemporizadorInactividad {
  const reloj = opciones.reloj ?? relojDelSistema;
  let aviso: unknown = null;
  let reinicio: unknown = null;

  const desarmar = (): void => {
    if (aviso !== null) reloj.clearTimeout(aviso);
    if (reinicio !== null) reloj.clearTimeout(reinicio);
    aviso = null;
    reinicio = null;
  };

  return {
    armar() {
      desarmar();
      aviso = reloj.setTimeout(() => {
        aviso = null;
        opciones.alAvisar();
      }, opciones.avisoMs);
      reinicio = reloj.setTimeout(() => {
        reinicio = null;
        opciones.alReiniciar();
      }, opciones.reinicioMs);
    },
    desarmar,
    get armado() {
      return aviso !== null || reinicio !== null;
    },
  };
}
