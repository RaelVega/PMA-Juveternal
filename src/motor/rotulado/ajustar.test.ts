import { describe, expect, it } from 'vitest';
import { ajustarTexto, type Medidor } from './ajustar';

// Medidor falso y determinista: la W es el doble de ancha que el resto.
const medir: Medidor = (texto, cuerpo) => [...texto].reduce((suma, letra) => suma + (letra === 'W' ? 1.2 : letra === ' ' ? 0.3 : 0.6), 0) * cuerpo;
const base = { ancho: 300, alto: 140, maxLineas: 2, cuerpoInicial: 64, cuerpoMinimo: 20, interlineado: 1.1, medir };

describe('ajustarTexto', () => {
  it('un nombre corto se queda en el cuerpo inicial y en una línea', () => {
    expect(ajustarTexto({ ...base, texto: 'FLORIL' })).toEqual({ lineas: ['FLORIL'], cuerpo: 64, cabe: true });
  });

  it('mide por ancho, no por caracteres: siete W quedan más chicas que siete I', () => {
    const w = ajustarTexto({ ...base, texto: 'WWWWWWW' });
    const i = ajustarTexto({ ...base, texto: 'IIIIIII' });
    expect(w.cuerpo).toBeLessThan(i.cuerpo);
    expect(medir('WWWWWWW', w.cuerpo)).toBeLessThanOrEqual(base.ancho);
  });

  it('parte en dos líneas antes de achicar de más', () => {
    const ajuste = ajustarTexto({ ...base, texto: 'RELAX FLOW' });
    expect(ajuste.lineas).toEqual(['RELAX', 'FLOW']);
    expect(ajuste.cuerpo).toBeGreaterThan(50);
  });

  it('nunca pasa del máximo de líneas', () => {
    const ajuste = ajustarTexto({ ...base, texto: 'UNO DOS TRES CUATRO CINCO', maxLineas: 2 });
    expect(ajuste.lineas.length).toBeLessThanOrEqual(2);
    for (const linea of ajuste.lineas) expect(medir(linea, ajuste.cuerpo)).toBeLessThanOrEqual(base.ancho);
  });

  it('respeta el alto de la caja', () => {
    const ajuste = ajustarTexto({ ...base, texto: 'RELAX FLOW', alto: 80 });
    expect(ajuste.cuerpo + (ajuste.lineas.length - 1) * ajuste.cuerpo * base.interlineado).toBeLessThanOrEqual(80);
  });

  it('si ni al mínimo cabe, lo dice', () => {
    expect(ajustarTexto({ ...base, texto: 'W'.repeat(40) }).cabe).toBe(false);
  });

  it('texto vacío o solo espacios no rompe', () => {
    expect(ajustarTexto({ ...base, texto: '   ' })).toEqual({ lineas: [], cuerpo: 64, cabe: true });
  });
});
