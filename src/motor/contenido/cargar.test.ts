import * as v from 'valibot';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cargarJson, ErrorContenido, urlContenido } from './cargar';

const esquema = v.object({ version: v.number(), titulo: v.string() });

function simularRespuesta(cuerpo: string, estado = 200): void {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(cuerpo, { status: estado })));
}

afterEach(() => vi.unstubAllGlobals());

describe('cargarJson', () => {
  it('devuelve el contenido validado', async () => {
    simularRespuesta('{"version":1,"titulo":"SELECCIONA EL INGREDIENTE"}');
    await expect(cargarJson('contenido.json', esquema)).resolves.toEqual({ version: 1, titulo: 'SELECCIONA EL INGREDIENTE' });
  });

  it('un JSON mal escrito da un error legible, nunca undefined', async () => {
    simularRespuesta('{"version":1,');
    await expect(cargarJson('contenido.json', esquema)).rejects.toThrow(new ErrorContenido('contenido/contenido.json no es un JSON válido'));
  });

  it('un campo con el tipo equivocado dice qué campo es', async () => {
    simularRespuesta('{"version":"uno","titulo":"x"}');
    await expect(cargarJson('contenido.json', esquema)).rejects.toThrow(/version/);
  });

  it('un archivo que falta dice qué archivo y qué respondió', async () => {
    simularRespuesta('', 404);
    await expect(cargarJson('falta.json', esquema)).rejects.toThrow('contenido/falta.json respondió 404');
  });
});

describe('urlContenido', () => {
  it('resuelve relativo al documento, nunca desde la raíz del dominio', () => {
    expect(urlContenido('img/frasco.webp')).toBe(new URL('contenido/img/frasco.webp', document.baseURI).href);
    expect(urlContenido('img/frasco.webp')).not.toMatch(/^\/contenido/);
  });
});
