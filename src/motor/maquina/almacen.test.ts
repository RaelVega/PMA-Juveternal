import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearAlmacenFlujo, type AlmacenFlujo } from './almacen';
import { crearMaquina } from './maquina';

type Paso = 'portada' | 'elegir' | 'auto' | 'info';
interface Sesion {
  opcion: string | null;
}

const maquina = crearMaquina<Paso, Sesion>({
  orden: ['portada', 'elegir', 'auto', 'info'],
  sesionInicial: { opcion: null },
  pasos: {
    portada: { tipo: 'portada' },
    elegir: { tipo: 'eleccion', elegir: (s, valor) => ({ ...s, opcion: valor }), puedeAvanzar: (s) => s.opcion !== null },
    auto: { tipo: 'automatico' },
    info: { tipo: 'informativo' },
  },
});

let almacen: AlmacenFlujo<Paso, Sesion>;
const flujo = () => almacen.getState().flujo;
const despachar = (...args: Parameters<ReturnType<typeof almacen.getState>['despachar']>) => almacen.getState().despachar(...args);

beforeEach(() => {
  vi.useFakeTimers();
  almacen = crearAlmacenFlujo(maquina);
});
afterEach(() => {
  almacen.destruir();
  vi.useRealTimers();
});

describe('inactividad conectada al flujo', () => {
  it('en la portada no corre la cuenta', () => {
    vi.advanceTimersByTime(10 * 60_000);
    expect(flujo().paso).toBe('portada');
    expect(flujo().avisoInactividad).toBe(false);
  });

  it('a los 45 s avisa y a los 55 s vuelve a la portada con la sesión limpia', () => {
    despachar({ tipo: 'avanzar', origen: 'visitante' });
    despachar({ tipo: 'elegir', valor: 'secreto' });
    vi.advanceTimersByTime(45_000);
    expect(flujo().avisoInactividad).toBe(true);
    vi.advanceTimersByTime(10_000);
    expect(flujo()).toEqual(maquina.inicial());
  });

  it('un toque durante el aviso lo quita y reinicia la cuenta completa', () => {
    despachar({ tipo: 'avanzar', origen: 'visitante' });
    vi.advanceTimersByTime(50_000);
    expect(flujo().avisoInactividad).toBe(true);
    despachar({ tipo: 'actividad' });
    expect(flujo().avisoInactividad).toBe(false);
    vi.advanceTimersByTime(44_000);
    expect(flujo().paso).toBe('elegir');
    expect(flujo().avisoInactividad).toBe(false);
  });

  it('en un paso automático la cuenta se pausa y se reanuda al salir', () => {
    despachar({ tipo: 'avanzar', origen: 'visitante' });
    despachar({ tipo: 'elegir', valor: 'a' });
    despachar({ tipo: 'avanzar', origen: 'visitante' });
    expect(flujo().paso).toBe('auto');
    vi.advanceTimersByTime(5 * 60_000);
    expect(flujo().paso).toBe('auto');

    despachar({ tipo: 'avanzar', origen: 'sistema' });
    expect(flujo().paso).toBe('info');
    vi.advanceTimersByTime(55_000);
    expect(flujo().paso).toBe('portada');
  });
});

describe('historial', () => {
  it('registra también los eventos ignorados, con su motivo', () => {
    const alRegistrar = vi.fn();
    almacen.destruir();
    almacen = crearAlmacenFlujo(maquina, { alRegistrar, ahora: () => 1000 });
    despachar({ tipo: 'avanzar', origen: 'visitante' });
    despachar({ tipo: 'avanzar', origen: 'visitante' });

    expect(almacen.historial()).toEqual([
      { ts: 1000, desde: 'portada', hacia: 'elegir', evento: 'avanzar', efecto: 'cambioPaso' },
      { ts: 1000, desde: 'elegir', hacia: 'elegir', evento: 'avanzar', efecto: 'sinCambio', motivo: 'falta_eleccion' },
    ]);
    expect(alRegistrar).toHaveBeenCalledTimes(2);
  });

  it('se queda con los últimos 200', () => {
    for (let i = 0; i < 250; i++) despachar({ tipo: 'actividad' });
    expect(almacen.historial()).toHaveLength(200);
  });
});
