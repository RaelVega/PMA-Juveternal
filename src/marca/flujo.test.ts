import { describe, expect, it } from 'vitest';
import type { EstadoFlujo, EventoFlujo } from '../motor/maquina/maquina';
import { crearMaquinaDual, OMITIR_LEAD, valorPagina, type PasoDual, type SesionDual } from './flujo';

const maquina = crearMaquinaDual({ anahuac: 26, juveternal: 3 }, { maxCaracteres: { nombre: 40, correo: 60, empresa: 40 } });
type Estado = EstadoFlujo<PasoDual, SesionDual>;
const aplicar = (estado: Estado, ...eventos: EventoFlujo[]): Estado => eventos.reduce((e, ev) => maquina.transicion(e, ev).estado, estado);
const AVANZAR: EventoFlujo = { tipo: 'avanzar', origen: 'visitante' };
const elegir = (valor: string): EventoFlujo => ({ tipo: 'elegir', valor });
const escribir = (campo: string, texto: string): EventoFlujo => ({ tipo: 'escribir', campo, texto });
const enCatalogo = aplicar(maquina.inicial(), elegir('anahuac'), AVANZAR);
const enLeads = aplicar(enCatalogo, elegir(valorPagina(25)), AVANZAR);

describe('flujo de la pantalla dual', () => {
  it('elegir Anáhuac abre su catálogo en la portada del catálogo', () => {
    expect(enCatalogo.paso).toBe('catalogo');
    expect(enCatalogo.sesion).toMatchObject({ catalogo: 'anahuac', pagina: 0 });
  });

  it('un catálogo que no existe no se puede elegir ni avanza', () => {
    expect(maquina.transicion(maquina.inicial(), elegir('otra')).efecto).toBe('sinCambio');
    expect(maquina.transicion(maquina.inicial(), AVANZAR).efecto).toBe('sinCambio');
  });

  it('se navega entre páginas dentro del rango', () => {
    expect(aplicar(enCatalogo, elegir(valorPagina(5))).sesion.pagina).toBe(5);
    expect(maquina.transicion(enCatalogo, elegir(valorPagina(26))).efecto).toBe('sinCambio');
  });

  it('a los leads solo se llega desde la última página, de cualquier catálogo', () => {
    expect(maquina.transicion(aplicar(enCatalogo, elegir(valorPagina(24))), AVANZAR).efecto).toBe('sinCambio');
    expect(enLeads.paso).toBe('leads');
    const juveternal = aplicar(maquina.inicial(), elegir('juveternal'), AVANZAR, elegir(valorPagina(2)), AVANZAR);
    expect(juveternal.paso).toBe('leads');
    expect(juveternal.sesion.catalogo).toBe('juveternal');
  });

  it('leads: nombre y correo válidos para avanzar; la empresa es opcional', () => {
    expect(maquina.transicion(enLeads, AVANZAR).efecto).toBe('sinCambio');
    const conNombre = aplicar(enLeads, escribir('nombre', 'Ana López'), escribir('correo', 'ana@gmail'));
    expect(maquina.transicion(conNombre, AVANZAR).efecto).toBe('sinCambio');
    const completo = aplicar(conNombre, escribir('correo', 'ana@gmail.com'));
    expect(aplicar(completo, AVANZAR).paso).toBe('despedida');
  });

  it('leads: OMITIR borra lo escrito y deja avanzar', () => {
    const omitido = aplicar(enLeads, escribir('nombre', 'Ana'), elegir(OMITIR_LEAD));
    expect(omitido.sesion.lead).toEqual({ nombre: '', correo: '', empresa: '', omitido: true });
    expect(aplicar(omitido, AVANZAR).paso).toBe('despedida');
  });

  it('leads: campo desconocido o demasiado largo no se acepta', () => {
    expect(maquina.transicion(enLeads, escribir('telefono', '55')).efecto).toBe('sinCambio');
    expect(maquina.transicion(enLeads, escribir('nombre', 'x'.repeat(41))).efecto).toBe('sinCambio');
  });

  it('de la despedida solo se sale reiniciando, con la sesión limpia', () => {
    const despedida = aplicar(enLeads, elegir(OMITIR_LEAD), AVANZAR);
    expect(maquina.transicion(despedida, AVANZAR).efecto).toBe('sinCambio');
    expect(aplicar(despedida, { tipo: 'reiniciar', motivo: 'fin' })).toEqual(maquina.inicial());
  });

  it('retroceder desde el catálogo vuelve al salvapantallas con la sesión limpia', () => {
    expect(aplicar(enCatalogo, elegir(valorPagina(3)), { tipo: 'retroceder' })).toEqual(maquina.inicial());
  });

  it('la inactividad avisa y reinicia', () => {
    const avisado = aplicar(enLeads, escribir('nombre', 'Ana'), { tipo: 'avisarInactividad' });
    expect(avisado.avisoInactividad).toBe(true);
    expect(aplicar(avisado, { tipo: 'reiniciar', motivo: 'inactividad' })).toEqual(maquina.inicial());
  });
});
