import { describe, expect, it } from 'vitest';
import type { EstadoFlujo, EventoFlujo } from '../motor/maquina/maquina';
import { crearMaquinaDual, valorPagina, type PasoDual, type SesionDual } from './flujo';

const maquina = crearMaquinaDual({ anahuac: 26 });
const aplicar = (estado: EstadoFlujo<PasoDual, SesionDual>, ...eventos: EventoFlujo[]): EstadoFlujo<PasoDual, SesionDual> =>
  eventos.reduce((e, ev) => maquina.transicion(e, ev).estado, estado);
const AVANZAR: EventoFlujo = { tipo: 'avanzar', origen: 'visitante' };
const enCatalogo = aplicar(maquina.inicial(), { tipo: 'elegir', valor: 'anahuac' }, AVANZAR);

describe('flujo de la pantalla dual', () => {
  it('elegir Anáhuac abre su catálogo en la portada del catálogo', () => {
    expect(enCatalogo.paso).toBe('catalogo');
    expect(enCatalogo.sesion).toEqual({ catalogo: 'anahuac', pagina: 0 });
  });

  it('un catálogo que no existe (Juveternal, pendiente) no se puede elegir ni avanza', () => {
    const r = maquina.transicion(maquina.inicial(), { tipo: 'elegir', valor: 'juveternal' });
    expect(r.efecto).toBe('sinCambio');
    expect(maquina.transicion(maquina.inicial(), AVANZAR).efecto).toBe('sinCambio');
  });

  it('se navega entre páginas dentro del rango', () => {
    expect(aplicar(enCatalogo, { tipo: 'elegir', valor: valorPagina(5) }).sesion.pagina).toBe(5);
    expect(maquina.transicion(enCatalogo, { tipo: 'elegir', valor: valorPagina(26) }).efecto).toBe('sinCambio');
    expect(maquina.transicion(enCatalogo, { tipo: 'elegir', valor: 'otra' }).efecto).toBe('sinCambio');
  });

  it('retroceder desde el catálogo vuelve al salvapantallas con la sesión limpia', () => {
    const vuelta = aplicar(enCatalogo, { tipo: 'elegir', valor: valorPagina(3) }, { tipo: 'retroceder' });
    expect(vuelta).toEqual(maquina.inicial());
  });

  it('la inactividad avisa en el catálogo y reinicia', () => {
    const avisado = aplicar(enCatalogo, { tipo: 'avisarInactividad' });
    expect(avisado.avisoInactividad).toBe(true);
    expect(aplicar(avisado, { tipo: 'reiniciar', motivo: 'inactividad' })).toEqual(maquina.inicial());
  });
});
