/** Puente que expone el preload de Electron. Solo existe dentro del ejecutable. */
export interface PuenteKiosco {
  readonly via: 'ejecutable';
  readonly versionElectron: string;
  anexarTelemetria: (linea: string) => Promise<string>;
  /** Anexa una fila al CSV de leads del día junto al ejecutable (escribe la cabecera si el archivo es nuevo). Devuelve la ruta. */
  anexarLead?: (cabecera: string, fila: string) => Promise<string>;
  /** Escribe una exportación completa de leads junto al ejecutable. Devuelve la ruta. */
  exportarLeads?: (csv: string) => Promise<string>;
  informarHumo: (json: string) => void;
}

declare global {
  interface Window {
    kiosco?: PuenteKiosco;
  }
}

/** Las tres vías de distribución de la misma build (más `archivo`, que está prohibida). */
export type Via = 'ejecutable' | 'local' | 'web' | 'archivo';

export function detectarVia(): Via {
  if (window.kiosco) return 'ejecutable';
  const { protocol, hostname } = window.location;
  if (protocol === 'file:') return 'archivo';
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'local';
  return 'web';
}
