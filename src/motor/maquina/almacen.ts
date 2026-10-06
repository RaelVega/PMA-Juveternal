import { createStore, type StoreApi } from 'zustand/vanilla';
import { crearTemporizadorInactividad } from '../temporizadores/inactividad';
import type { Reloj } from '../temporizadores/reloj';
import type { Efecto, EstadoFlujo, EventoFlujo, Maquina } from './maquina';

export interface RegistroTransicion<P extends string> {
  readonly ts: number;
  readonly desde: P;
  readonly hacia: P;
  readonly evento: EventoFlujo['tipo'];
  readonly efecto: Efecto;
  readonly motivo?: string;
}

export interface EstadoAlmacen<P extends string, S> {
  readonly flujo: EstadoFlujo<P, S>;
  /** Único punto de entrada para cambiar el flujo. */
  despachar(evento: EventoFlujo): void;
}

export interface OpcionesAlmacen<P extends string> {
  avisoMs?: number;
  reinicioMs?: number;
  reloj?: Reloj;
  ahora?: () => number;
  /** Para telemetría y depuración: se llama con cada evento, también con los ignorados. */
  alRegistrar?: (registro: RegistroTransicion<P>) => void;
}

export interface AlmacenFlujo<P extends string, S> extends StoreApi<EstadoAlmacen<P, S>> {
  /** Últimos eventos, incluidos los no-op (anillo de 200). */
  historial(): readonly RegistroTransicion<P>[];
  /** Detiene los temporizadores (pruebas, desmontaje). */
  destruir(): void;
}

const TAMANO_HISTORIAL = 200;

/**
 * Conecta la máquina pura con React (Zustand) y con los temporizadores de
 * inactividad: aviso a los 45 s, reinicio a los 55 s, sin cuenta en la
 * portada ni en los pasos automáticos.
 */
export function crearAlmacenFlujo<P extends string, S>(maquina: Maquina<P, S>, opciones: OpcionesAlmacen<P> = {}): AlmacenFlujo<P, S> {
  const ahora = opciones.ahora ?? Date.now;
  const historial: RegistroTransicion<P>[] = [];

  const temporizador = crearTemporizadorInactividad({
    avisoMs: opciones.avisoMs ?? 45_000,
    reinicioMs: opciones.reinicioMs ?? 55_000,
    alAvisar: () => almacen.getState().despachar({ tipo: 'avisarInactividad' }),
    alReiniciar: () => almacen.getState().despachar({ tipo: 'reiniciar', motivo: 'inactividad' }),
    ...(opciones.reloj ? { reloj: opciones.reloj } : {}),
  });

  const sincronizarTemporizador = (paso: P, evento: EventoFlujo, efecto: Efecto): void => {
    const tipo = maquina.tipoDe(paso);
    if (tipo === 'portada' || tipo === 'automatico') {
      temporizador.desarmar();
      return;
    }
    // El aviso no reinicia la cuenta: si no, el reinicio de los 55 s nunca llegaría.
    if (evento.tipo === 'avisarInactividad') return;
    const tocoElVisitante = evento.tipo !== 'reiniciar' && !(evento.tipo === 'avanzar' && evento.origen === 'sistema');
    if (tocoElVisitante || efecto === 'cambioPaso' || efecto === 'reinicio' || !temporizador.armado) temporizador.armar();
  };

  const almacen = createStore<EstadoAlmacen<P, S>>()((set, get) => ({
    flujo: maquina.inicial(),
    despachar(evento) {
      const antes = get().flujo;
      const { estado, efecto, motivo } = maquina.transicion(antes, evento);
      if (estado !== antes) set({ flujo: estado });

      const registro: RegistroTransicion<P> = {
        ts: ahora(),
        desde: antes.paso,
        hacia: estado.paso,
        evento: evento.tipo,
        efecto,
        ...(motivo ? { motivo } : {}),
      };
      historial.push(registro);
      if (historial.length > TAMANO_HISTORIAL) historial.shift();
      opciones.alRegistrar?.(registro);

      sincronizarTemporizador(estado.paso, evento, efecto);
    },
  }));

  return Object.assign(almacen, {
    historial: () => [...historial],
    destruir: () => temporizador.desarmar(),
  });
}
