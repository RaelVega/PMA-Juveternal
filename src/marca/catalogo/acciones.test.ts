import { describe, expect, it } from 'vitest';
import { interpretarAcciones, paginaDeDestino } from './acciones';

describe('acciones de InDesign', () => {
  it('mostrar y ocultar, en orden', () => {
    expect(interpretarAcciones("onHide('_idContainer051');onShow('_idContainer064');")).toEqual([
      { tipo: 'ocultar', id: '_idContainer051' },
      { tipo: 'mostrar', id: '_idContainer064' },
    ]);
  });

  it('el botón de inicio (marcado por la ingesta) va al selector', () => {
    expect(interpretarAcciones("goToDestination('inicio');")).toEqual([{ tipo: 'inicio' }]);
  });

  it('ir a la portada o a una página', () => {
    expect(interpretarAcciones("goToDestination('publication.html');")).toEqual([{ tipo: 'irA', pagina: 0 }]);
    expect(interpretarAcciones("goToDestination('publication-25.html');")).toEqual([{ tipo: 'irA', pagina: 25 }]);
    expect(paginaDeDestino('otra.html')).toBeNull();
  });

  it('animación de entrada sobre el propio contenedor', () => {
    expect(interpretarAcciones("playAnimation(selfContainerID,'_idGenPlayAnimation-7',0,'');")).toEqual([
      { tipo: 'animar', id: null, clase: '_idGenPlayAnimation-7', retrasoS: 0, ocultarAlTerminar: false },
    ]);
  });

  it('video con retraso', () => {
    expect(interpretarAcciones('onMediaStart(selfContainerID,0.00,1.75);')).toEqual([{ tipo: 'reproducir', id: null, desdeS: 0, retrasoS: 1.75 }]);
  });

  it('sin texto o con algo desconocido no lanza', () => {
    expect(interpretarAcciones(null)).toEqual([]);
    expect(interpretarAcciones("alert('x');")).toEqual([]);
  });
});
