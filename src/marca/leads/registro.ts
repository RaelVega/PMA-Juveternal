/**
 * Un lead tal como se guarda: los datos del visitante y el catálogo que vio
 * (para que ventas sepa qué marca le interesó). Nunca pasa por la telemetría, que es anónima.
 */
export interface RegistroLead {
  /** Uno por sesión: si el visitante reenvía, se actualiza el mismo. */
  readonly id: string;
  /** ISO 8601 en hora local con su desfase. */
  readonly fecha: string;
  readonly nombre: string;
  readonly correo: string;
  readonly empresa: string;
  /** Texto de consentimiento que vio el visitante al enviar. */
  readonly consentimiento: string;
  /** Catálogo (marca) del que venía: «anahuac» o «juveternal». */
  readonly marca: string;
}

/** Columnas del CSV, en orden. */
export const COLUMNAS_LEAD: readonly (keyof RegistroLead)[] = ['id', 'fecha', 'nombre', 'correo', 'empresa', 'consentimiento', 'marca'];

/**
 * Celda CSV. Entre comillas si hace falta, y con «'» delante si empieza por
 * = + - @ (Excel lo tomaría como fórmula: inyección de CSV).
 */
export function celdaCsv(valor: string): string {
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return /[",;\r\n]/.test(seguro) ? `"${seguro.replaceAll('"', '""')}"` : seguro;
}

export function filaCsv(registro: RegistroLead): string {
  return COLUMNAS_LEAD.map((columna) => celdaCsv(registro[columna])).join(',');
}

export const CABECERA_CSV = COLUMNAS_LEAD.join(',');

/** CSV completo con BOM (Excel abre así los acentos) y saltos CRLF. */
export function documentoCsv(registros: readonly RegistroLead[]): string {
  return `﻿${[CABECERA_CSV, ...registros.map(filaCsv)].join('\r\n')}\r\n`;
}
