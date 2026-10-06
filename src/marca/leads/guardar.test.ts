import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearAlmacenFlujo } from '../../motor/maquina/almacen';
import type { EventoFlujo } from '../../motor/maquina/maquina';
import { crearMaquinaDual, OMITIR_LEAD, valorPagina } from '../flujo';
import { fechaLocal, iniciarGuardadoLeads } from './guardar';
import { documentoCsv, type RegistroLead } from './registro';

const guardados: RegistroLead[] = [];
vi.mock('./almacen', () => ({
  guardarLeadLocal: (registro: RegistroLead) => {
    guardados.push(registro);
    return Promise.resolve();
  },
  leerLeadsLocales: () => Promise.resolve([...guardados]),
}));

const AVANZAR: EventoFlujo = { tipo: 'avanzar', origen: 'visitante' };

function almacenEnLeads(marca: string) {
  const almacen = crearAlmacenFlujo(crearMaquinaDual({ anahuac: 2, juveternal: 2 }, { maxCaracteres: { nombre: 40, correo: 60, empresa: 40 } }));
  for (const e of [AVANZAR, { tipo: 'elegir', valor: marca }, AVANZAR, { tipo: 'elegir', valor: valorPagina(1) }, AVANZAR] as EventoFlujo[]) almacen.getState().despachar(e);
  expect(almacen.getState().flujo.paso).toBe('leads');
  return almacen;
}

describe('guardado de leads', () => {
  afterEach(() => {
    guardados.length = 0;
  });

  it('al pasar a la despedida guarda el lead con la marca de la que venía', () => {
    const almacen = almacenEnLeads('juveternal');
    iniciarGuardadoLeads(almacen, 'Acepto');
    const { despachar } = almacen.getState();
    despachar({ tipo: 'escribir', campo: 'nombre', texto: 'Ana López' });
    despachar({ tipo: 'escribir', campo: 'correo', texto: 'ana@gmail.com' });
    despachar(AVANZAR);
    expect(guardados).toHaveLength(1);
    expect(guardados[0]).toMatchObject({ nombre: 'Ana López', correo: 'ana@gmail.com', empresa: '', marca: 'juveternal', consentimiento: 'Acepto' });
  });

  it('OMITIR no guarda nada', () => {
    const almacen = almacenEnLeads('anahuac');
    iniciarGuardadoLeads(almacen, 'Acepto');
    almacen.getState().despachar({ tipo: 'elegir', valor: OMITIR_LEAD });
    almacen.getState().despachar(AVANZAR);
    expect(almacen.getState().flujo.paso).toBe('despedida');
    expect(guardados).toHaveLength(0);
  });

  it('CSV con BOM, CRLF y a prueba de fórmulas de Excel', () => {
    const csv = documentoCsv([{ id: '1', fecha: fechaLocal(new Date(2026, 9, 6, 10, 0, 0)), nombre: '=HYPERLINK()', correo: 'a@b.mx', empresa: 'X, S.A.', consentimiento: 'ok', marca: 'anahuac' }]);
    expect(csv.startsWith('﻿id,fecha,nombre,correo,empresa,consentimiento,marca\r\n')).toBe(true);
    expect(csv).toContain("'=HYPERLINK()");
    expect(csv).toContain('"X, S.A."');
  });
});
