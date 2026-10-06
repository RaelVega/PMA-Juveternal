import { describe, expect, it } from 'vitest';
import { crearMaquina, type DefinicionFlujo, type EstadoFlujo, type EventoFlujo } from './maquina';

// Flujo mínimo de prueba, sin marca: portada → elegir → texto → info → auto → cierre.
type Paso = 'portada' | 'elegir' | 'texto' | 'info' | 'auto' | 'cierre';
interface Sesion {
  opcion: string | null;
  texto: string;
}

const definicion: DefinicionFlujo<Paso, Sesion> = {
  orden: ['portada', 'elegir', 'texto', 'info', 'auto', 'cierre'],
  sesionInicial: { opcion: null, texto: '' },
  pasos: {
    portada: { tipo: 'portada' },
    elegir: {
      tipo: 'eleccion',
      elegir: (s, valor) => (['a', 'b'].includes(valor) ? { ...s, opcion: valor } : null),
      puedeAvanzar: (s) => s.opcion !== null,
    },
    texto: {
      tipo: 'texto',
      escribir: (s, texto) => (texto.length <= 5 ? { ...s, texto } : null),
      puedeAvanzar: (s) => s.texto.length > 0,
    },
    info: { tipo: 'informativo' },
    auto: { tipo: 'automatico' },
    cierre: { tipo: 'cierre' },
  },
};

const maquina = crearMaquina(definicion);
const AVANZAR: EventoFlujo = { tipo: 'avanzar', origen: 'visitante' };
const AVANZAR_SISTEMA: EventoFlujo = { tipo: 'avanzar', origen: 'sistema' };

/** Aplica eventos en cadena y devuelve el estado final. */
function aplicar(estado: EstadoFlujo<Paso, Sesion>, ...eventos: EventoFlujo[]): EstadoFlujo<Paso, Sesion> {
  return eventos.reduce((actual, evento) => maquina.transicion(actual, evento).estado, estado);
}

describe('transiciones válidas', () => {
  it('recorre el flujo completo', () => {
    const final = aplicar(
      maquina.inicial(),
      AVANZAR,
      { tipo: 'elegir', valor: 'b' },
      AVANZAR,
      { tipo: 'escribir', texto: 'HOLA' },
      AVANZAR,
      AVANZAR,
      AVANZAR_SISTEMA,
    );
    expect(final).toEqual({ paso: 'cierre', sesion: { opcion: 'b', texto: 'HOLA' }, avisoInactividad: false });
  });

  it('elegir otra opción en el mismo paso la reemplaza', () => {
    const estado = aplicar(maquina.inicial(), AVANZAR, { tipo: 'elegir', valor: 'a' }, { tipo: 'elegir', valor: 'b' });
    expect(estado.sesion.opcion).toBe('b');
  });

  it('informa el efecto de cada transición', () => {
    const inicio = maquina.inicial();
    expect(maquina.transicion(inicio, AVANZAR).efecto).toBe('cambioPaso');
    const enElegir = aplicar(inicio, AVANZAR);
    expect(maquina.transicion(enElegir, { tipo: 'elegir', valor: 'a' }).efecto).toBe('cambioSesion');
  });
});

describe('transiciones inválidas: no-op con motivo, nunca excepción', () => {
  const enElegir = aplicar(maquina.inicial(), AVANZAR);

  it.each<[string, EstadoFlujo<Paso, Sesion>, EventoFlujo, string]>([
    ['avanzar sin elegir', enElegir, AVANZAR, 'falta_eleccion'],
    ['opción que no existe', enElegir, { tipo: 'elegir', valor: 'z' }, 'opcion_invalida:z'],
    ['escribir en un paso de elección', enElegir, { tipo: 'escribir', texto: 'x' }, 'paso_sin_texto'],
    ['elegir en la portada', maquina.inicial(), { tipo: 'elegir', valor: 'a' }, 'paso_sin_eleccion'],
    ['avance del sistema fuera de un paso automático', enElegir, AVANZAR_SISTEMA, 'avance_de_sistema_fuera_de_paso_automatico'],
  ])('%s', (_nombre, estado, evento, motivo) => {
    const resultado = maquina.transicion(estado, evento);
    expect(resultado.efecto).toBe('sinCambio');
    expect(resultado.motivo).toBe(motivo);
    expect(resultado.estado).toBe(estado);
  });

  it('texto que la marca no acepta', () => {
    const enTexto = aplicar(maquina.inicial(), AVANZAR, { tipo: 'elegir', valor: 'a' }, AVANZAR);
    const resultado = maquina.transicion(enTexto, { tipo: 'escribir', texto: 'DEMASIADO' });
    expect(resultado).toMatchObject({ efecto: 'sinCambio', motivo: 'texto_invalido' });
  });

  it('el visitante no puede adelantar un paso automático', () => {
    const enAuto = aplicar(maquina.inicial(), AVANZAR, { tipo: 'elegir', valor: 'a' }, AVANZAR, { tipo: 'escribir', texto: 'X' }, AVANZAR, AVANZAR);
    expect(enAuto.paso).toBe('auto');
    expect(maquina.transicion(enAuto, AVANZAR)).toMatchObject({ efecto: 'sinCambio', motivo: 'paso_automatico' });
  });

  it('un segundo avance del sistema (fin de animación + respaldo) no se salta pasos', () => {
    const enAuto = aplicar(maquina.inicial(), AVANZAR, { tipo: 'elegir', valor: 'a' }, AVANZAR, { tipo: 'escribir', texto: 'X' }, AVANZAR, AVANZAR);
    const tras = aplicar(enAuto, AVANZAR_SISTEMA, AVANZAR_SISTEMA);
    expect(tras.paso).toBe('cierre');
  });

  it('del cierre solo se sale reiniciando', () => {
    const enCierre = aplicar(maquina.inicial(), AVANZAR, { tipo: 'elegir', valor: 'a' }, AVANZAR, { tipo: 'escribir', texto: 'X' }, AVANZAR, AVANZAR, AVANZAR_SISTEMA);
    expect(maquina.transicion(enCierre, AVANZAR)).toMatchObject({ efecto: 'sinCambio', motivo: 'fin_del_flujo' });
  });
});

describe('reinicio', () => {
  it.each(['inactividad', 'error', 'fin'] as const)('por %s deja el estado idéntico al del arranque', (motivo) => {
    const avanzado = aplicar(maquina.inicial(), AVANZAR, { tipo: 'elegir', valor: 'a' }, AVANZAR, { tipo: 'escribir', texto: 'SECRE' });
    const resultado = maquina.transicion(avanzado, { tipo: 'reiniciar', motivo });
    expect(resultado.efecto).toBe('reinicio');
    expect(resultado.estado).toEqual(maquina.inicial());
    expect(resultado.estado.sesion.texto).toBe('');
  });
});

describe('aviso de inactividad', () => {
  const enElegir = aplicar(maquina.inicial(), AVANZAR);

  it('se activa en pasos interactivos', () => {
    expect(maquina.transicion(enElegir, { tipo: 'avisarInactividad' })).toMatchObject({ efecto: 'aviso', estado: { avisoInactividad: true } });
  });

  it('no se activa en la portada ni en pasos automáticos', () => {
    expect(maquina.transicion(maquina.inicial(), { tipo: 'avisarInactividad' }).efecto).toBe('sinCambio');
    const enAuto = aplicar(enElegir, { tipo: 'elegir', valor: 'a' }, AVANZAR, { tipo: 'escribir', texto: 'X' }, AVANZAR, AVANZAR);
    expect(maquina.transicion(enAuto, { tipo: 'avisarInactividad' }).efecto).toBe('sinCambio');
  });

  it('cualquier toque lo quita, incluso uno que no cambia nada', () => {
    const conAviso = aplicar(enElegir, { tipo: 'avisarInactividad' });
    expect(aplicar(conAviso, { tipo: 'actividad' }).avisoInactividad).toBe(false);
    const trasToqueInvalido = maquina.transicion(conAviso, AVANZAR);
    expect(trasToqueInvalido.estado).toMatchObject({ paso: 'elegir', avisoInactividad: false });
  });
});

describe('retroceder', () => {
  const RETROCEDER: EventoFlujo = { tipo: 'retroceder' };
  const enTexto = aplicar(maquina.inicial(), AVANZAR, { tipo: 'elegir', valor: 'a' }, AVANZAR, { tipo: 'escribir', texto: 'HOLA' });

  it('vuelve al paso anterior conservando la sesión', () => {
    const resultado = maquina.transicion(enTexto, RETROCEDER);
    expect(resultado.efecto).toBe('cambioPaso');
    expect(resultado.estado).toEqual({ paso: 'elegir', sesion: { opcion: 'a', texto: 'HOLA' }, avisoInactividad: false });
  });

  it('volver a la portada reinicia: el siguiente visitante no hereda nada', () => {
    const enElegir = aplicar(maquina.inicial(), AVANZAR, { tipo: 'elegir', valor: 'b' });
    const resultado = maquina.transicion(enElegir, RETROCEDER);
    expect(resultado.efecto).toBe('reinicio');
    expect(resultado.estado).toEqual(maquina.inicial());
  });

  it('salta los pasos automáticos', () => {
    // Desde el paso siguiente al automático se vuelve al de antes del automático.
    const conSiguiente = crearMaquina({ ...definicion, orden: ['portada', 'elegir', 'auto', 'info', 'cierre'] });
    const enInfoTrasAuto = { paso: 'info' as const, sesion: { opcion: 'a', texto: '' }, avisoInactividad: false };
    expect(conSiguiente.transicion(enInfoTrasAuto, RETROCEDER).estado.paso).toBe('elegir');
  });

  it.each<[string, Paso]>([
    ['en la portada', 'portada'],
    ['en un paso automático', 'auto'],
    ['en el cierre', 'cierre'],
  ])('es un no-op %s', (_nombre, paso) => {
    const estado = { paso, sesion: { opcion: 'a', texto: 'X' }, avisoInactividad: false };
    const resultado = maquina.transicion(estado, RETROCEDER);
    expect(resultado.efecto).toBe('sinCambio');
    expect(resultado.estado).toBe(estado);
  });

  it('quita el aviso de inactividad', () => {
    const conAviso = aplicar(enTexto, { tipo: 'avisarInactividad' });
    expect(aplicar(conAviso, RETROCEDER).avisoInactividad).toBe(false);
  });
});

describe('pasos omitidos', () => {
  // El paso `elegir` se omite cuando ya viene elegido (una sola opción, aplicada antes).
  const conOmision = crearMaquina<Paso, Sesion>({
    ...definicion,
    sesionInicial: { opcion: 'unica', texto: '' },
    pasos: { ...definicion.pasos, elegir: { ...definicion.pasos.elegir, omitir: (s) => s.opcion === 'unica' } },
  });

  it('avanzar lo salta', () => {
    const tras = conOmision.transicion(conOmision.inicial(), AVANZAR);
    expect(tras.estado.paso).toBe('texto');
  });

  it('retroceder lo salta (y aquí llega a la portada, así que reinicia)', () => {
    const enTexto = conOmision.transicion(conOmision.inicial(), AVANZAR).estado;
    expect(conOmision.transicion(enTexto, { tipo: 'retroceder' })).toMatchObject({ efecto: 'reinicio', estado: { paso: 'portada' } });
  });
});

describe('escribir con campo', () => {
  it('pasa el campo a la regla de la marca', () => {
    const conCampos = crearMaquina<Paso, Sesion>({
      ...definicion,
      pasos: { ...definicion.pasos, texto: { tipo: 'texto', escribir: (s, texto, campo) => ({ ...s, texto: `${campo ?? '-'}:${texto}` }) } },
    });
    const enTexto = { paso: 'texto' as const, sesion: { opcion: 'a', texto: '' }, avisoInactividad: false };
    expect(conCampos.transicion(enTexto, { tipo: 'escribir', texto: 'ana', campo: 'nombre' }).estado.sesion.texto).toBe('nombre:ana');
    expect(conCampos.transicion(enTexto, { tipo: 'escribir', texto: 'ana' }).estado.sesion.texto).toBe('-:ana');
  });
});

describe('definición del flujo', () => {
  it('rechaza un flujo vacío, con pasos repetidos o que no empieza en la portada', () => {
    expect(() => crearMaquina({ ...definicion, orden: [] })).toThrow('no tiene pasos');
    expect(() => crearMaquina({ ...definicion, orden: ['portada', 'elegir', 'elegir'] })).toThrow('repite pasos');
    expect(() => crearMaquina({ ...definicion, orden: ['elegir', 'portada'] })).toThrow('portada');
  });
});
