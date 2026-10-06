import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearTemporizadorInactividad } from './inactividad';
import { programarRespaldo } from './respaldo';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('inactividad', () => {
  function crear() {
    const alAvisar = vi.fn();
    const alReiniciar = vi.fn();
    const temporizador = crearTemporizadorInactividad({ avisoMs: 45_000, reinicioMs: 55_000, alAvisar, alReiniciar });
    return { temporizador, alAvisar, alReiniciar };
  }

  it('avisa a los 45 s y reinicia a los 55 s', () => {
    const { temporizador, alAvisar, alReiniciar } = crear();
    temporizador.armar();
    vi.advanceTimersByTime(44_999);
    expect(alAvisar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(alAvisar).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(9_999);
    expect(alReiniciar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(alReiniciar).toHaveBeenCalledOnce();
  });

  it('cada toque (armar) vuelve a contar desde cero', () => {
    const { temporizador, alAvisar } = crear();
    temporizador.armar();
    vi.advanceTimersByTime(40_000);
    temporizador.armar();
    vi.advanceTimersByTime(40_000);
    expect(alAvisar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5_000);
    expect(alAvisar).toHaveBeenCalledOnce();
  });

  it('desarmado no dispara nada', () => {
    const { temporizador, alAvisar, alReiniciar } = crear();
    temporizador.armar();
    temporizador.desarmar();
    vi.advanceTimersByTime(120_000);
    expect(alAvisar).not.toHaveBeenCalled();
    expect(alReiniciar).not.toHaveBeenCalled();
    expect(temporizador.armado).toBe(false);
  });
});

describe('respaldo de animaciones', () => {
  it('si la animación termina, avanza una sola vez y el respaldo ya no dispara', () => {
    const alTerminar = vi.fn();
    const respaldo = programarRespaldo(alTerminar, 6_000);
    vi.advanceTimersByTime(4_400);
    respaldo.terminar();
    respaldo.terminar();
    vi.advanceTimersByTime(10_000);
    expect(alTerminar).toHaveBeenCalledOnce();
  });

  it('si la animación nunca termina, el respaldo avanza', () => {
    const alTerminar = vi.fn();
    programarRespaldo(alTerminar, 6_000);
    vi.advanceTimersByTime(6_000);
    expect(alTerminar).toHaveBeenCalledOnce();
  });

  it('cancelado no avanza', () => {
    const alTerminar = vi.fn();
    const respaldo = programarRespaldo(alTerminar, 6_000);
    respaldo.cancelar();
    respaldo.terminar();
    vi.advanceTimersByTime(10_000);
    expect(alTerminar).not.toHaveBeenCalled();
  });
});
