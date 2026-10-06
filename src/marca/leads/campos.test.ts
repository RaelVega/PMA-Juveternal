import { describe, expect, it } from 'vitest';
import { aplicarSugerencia, correoValido, normalizarCorreo, normalizarPersona, sugerenciasCorreo } from './campos';

const OPCIONES = {
  dominios: ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com'],
  terminaciones: ['.com', '.com.mx', '.mx', '.org', '.net'],
  maximo: 4,
};

describe('normalización', () => {
  it('nombre y empresa en tipo título, con acentos y sin espacios de más', () => {
    expect(normalizarPersona('  ANA  MARÍA LÓPEZ-ÑÚÑEZ')).toBe('Ana María López-Ñúñez');
  });

  it('correo en minúsculas, sin espacios y con una sola @', () => {
    expect(normalizarCorreo('Ana @Gmail.com@')).toBe('ana@gmail.com');
  });

  it.each([
    ['ana@gmail.com', true],
    ['a.b+c@empresa.com.mx', true],
    ['ana@empresa', false],
    ['@gmail.com', false],
    ['ana@.com', false],
  ])('%s es válido: %s', (correo, valido) => {
    expect(correoValido(correo)).toBe(valido);
  });
});

describe('autocompletado del correo', () => {
  it('sin nada escrito no sugiere nada', () => {
    expect(sugerenciasCorreo('', OPCIONES)).toEqual([]);
  });

  it('antes de la @ ofrece los dominios comunes', () => {
    expect(sugerenciasCorreo('ana', OPCIONES)).toEqual(['@gmail.com', '@hotmail.com', '@outlook.com', '@yahoo.com']);
  });

  it('tras la @ filtra por lo escrito y añade terminaciones para correos de empresa', () => {
    expect(sugerenciasCorreo('ana@', OPCIONES)).toEqual(['@gmail.com', '@hotmail.com', '@outlook.com', '@yahoo.com']);
    expect(sugerenciasCorreo('ana@ho', OPCIONES)).toEqual(['@hotmail.com', '.com', '.com.mx', '.mx']);
    expect(sugerenciasCorreo('ana@biocaps', OPCIONES)).toEqual(['.com', '.com.mx', '.mx', '.org']);
    expect(sugerenciasCorreo('ana@biocaps.co', OPCIONES)).toEqual(['.com', '.com.mx']);
  });

  it('nunca sugiere lo que ya está escrito', () => {
    expect(sugerenciasCorreo('ana@gmail.com', OPCIONES)).toEqual([]);
    expect(sugerenciasCorreo('ana@biocaps.com.mx', OPCIONES)).toEqual([]);
  });

  it('aplica la sugerencia en su sitio', () => {
    expect(aplicarSugerencia('ana', '@gmail.com')).toBe('ana@gmail.com');
    expect(aplicarSugerencia('ana@ho', '@hotmail.com')).toBe('ana@hotmail.com');
    expect(aplicarSugerencia('ana@biocaps', '.com.mx')).toBe('ana@biocaps.com.mx');
    expect(aplicarSugerencia('ana@biocaps.co', '.com')).toBe('ana@biocaps.com');
  });
});
