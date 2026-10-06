/** Reglas puras de los campos de leads: normalización, validación y autocompletado del correo. */

export type CampoLead = 'nombre' | 'correo' | 'empresa';
export const CAMPOS_LEAD: readonly CampoLead[] = ['nombre', 'correo', 'empresa'];

/** Letras (con acentos y Ñ), números y la poca puntuación del teclado de nombre. */
const CARACTERES_PERSONA = /^[\p{L}0-9 &.'-]*$/u;
const CARACTERES_CORREO = /^[a-z0-9@._+-]*$/;
const CORREO_VALIDO = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

/** Nombre o empresa: sin espacios al inicio ni dobles, y en tipo título («ANA LÓPEZ» → «Ana López»). */
export function normalizarPersona(texto: string): string {
  return texto
    .replace(/^\s+/, '')
    .replace(/\s{2,}/g, ' ')
    .toLocaleLowerCase('es-MX')
    .replace(/(^|[\s-])(\p{L})/gu, (_, antes: string, letra: string) => antes + letra.toLocaleUpperCase('es-MX'));
}

/** Correo: minúsculas, sin espacios y con una sola «@». */
export function normalizarCorreo(texto: string): string {
  const limpio = texto.toLocaleLowerCase('es-MX').replace(/\s/g, '');
  const arroba = limpio.indexOf('@');
  return arroba === -1 ? limpio : limpio.slice(0, arroba + 1) + limpio.slice(arroba + 1).replaceAll('@', '');
}

export function normalizarCampo(campo: CampoLead, texto: string): string {
  return campo === 'correo' ? normalizarCorreo(texto) : normalizarPersona(texto);
}

export function caracteresValidos(campo: CampoLead, texto: string): boolean {
  return (campo === 'correo' ? CARACTERES_CORREO : CARACTERES_PERSONA).test(texto);
}

export function correoValido(correo: string): boolean {
  return CORREO_VALIDO.test(correo);
}

/** Nombre (2 letras o más) y correo válido son obligatorios; la empresa es opcional. */
export function leadCompleto(lead: { nombre: string; correo: string }): boolean {
  return lead.nombre.trim().length >= 2 && correoValido(lead.correo);
}

export interface OpcionesSugerencias {
  dominios: readonly string[];
  terminaciones: readonly string[];
  maximo: number;
}

/**
 * Sugerencias para lo que va escrito del correo:
 * - sin «@» (y con algo escrito): «@gmail.com», «@hotmail.com»…
 * - tras la «@»: los dominios que empiezan como lo escrito;
 * - con un dominio propio («ana@empresa»): «.com», «.com.mx», «.mx»… para correos de empresa.
 * Nunca se sugiere lo que ya está escrito.
 */
export function sugerenciasCorreo(correo: string, { dominios, terminaciones, maximo }: OpcionesSugerencias): string[] {
  const arroba = correo.indexOf('@');
  if (arroba === -1) return correo.length > 0 ? dominios.slice(0, maximo).map((d) => `@${d}`) : [];

  const dominio = correo.slice(arroba + 1);
  const comunes = dominios.filter((d) => d.startsWith(dominio) && d !== dominio).map((d) => `@${d}`);
  const punto = dominio.indexOf('.');
  const nombreDominio = punto === -1 ? dominio : dominio.slice(0, punto);
  const cola = punto === -1 ? '' : dominio.slice(punto);
  const propias = nombreDominio.length > 0 && !dominios.includes(dominio) ? terminaciones.filter((t) => t.startsWith(cola) && t !== cola) : [];
  return [...comunes, ...propias].slice(0, maximo);
}

/** Aplica una sugerencia: «@…» sustituye todo lo que va tras la «@»; «.…» sustituye la terminación del dominio. */
export function aplicarSugerencia(correo: string, sugerencia: string): string {
  const arroba = correo.indexOf('@');
  if (sugerencia.startsWith('@')) return (arroba === -1 ? correo : correo.slice(0, arroba)) + sugerencia;
  if (arroba === -1) return correo + sugerencia;
  const dominio = correo.slice(arroba + 1);
  const punto = dominio.indexOf('.');
  return correo.slice(0, arroba + 1) + (punto === -1 ? dominio : dominio.slice(0, punto)) + sugerencia;
}
