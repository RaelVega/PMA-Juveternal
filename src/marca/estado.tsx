import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { urlContenido } from '../motor/contenido/cargar';
import type { AlmacenFlujo } from '../motor/maquina/almacen';
import type { EstadoFlujo, EventoFlujo } from '../motor/maquina/maquina';
import type { ContenidoCargado } from './contenido/cargar';
import type { ImagenesEscena } from './componentes/EscenaDual';
import type { Contenido } from './contenido/esquema';
import type { PasoDual, SesionDual } from './flujo';

export interface Recursos extends ContenidoCargado {
  almacen: AlmacenFlujo<PasoDual, SesionDual>;
}

const ContextoRecursos = createContext<Recursos | null>(null);

export function ProveedorRecursos({ recursos, children }: { recursos: Recursos; children: ReactNode }): ReactNode {
  return <ContextoRecursos.Provider value={recursos}>{children}</ContextoRecursos.Provider>;
}

export function useRecursos(): Recursos {
  const recursos = useContext(ContextoRecursos);
  if (!recursos) throw new Error('useRecursos fuera de ProveedorRecursos');
  return recursos;
}

/** Lee del flujo. El selector debe devolver un valor estable (primitivo o parte del estado), nunca un objeto nuevo. */
export function useFlujo<T>(selector: (flujo: EstadoFlujo<PasoDual, SesionDual>) => T): T {
  const { almacen } = useRecursos();
  return useStore(almacen, (estado) => selector(estado.flujo));
}

export function useDespachar(): (evento: EventoFlujo) => void {
  const { almacen } = useRecursos();
  return useStore(almacen, (estado) => estado.despachar);
}

export function useContenido(): Contenido {
  return useRecursos().contenido;
}

export interface ImagenResuelta {
  url: string;
  ancho: number;
  alto: number;
}

/** Imagen del manifiesto con su URL resuelta. Lanza si no existe: el contenido ya se validó al arrancar. */
export function useImagen(id: string): ImagenResuelta {
  const imagen = useRecursos().manifiesto.imagenes[id];
  if (!imagen) throw new Error(`La imagen «${id}» no está en el manifiesto`);
  return { url: urlContenido(imagen.archivo), ancho: imagen.ancho, alto: imagen.alto };
}

/** Fondo y bandas del salvapantallas, para las pantallas que comparten su identidad (leads, despedida, aviso). */
export function useImagenesEscena(): ImagenesEscena {
  const { portada } = useContenido();
  const fondo = useImagen(portada.fondo.imagen);
  const sup = useImagen(portada.bandaSuperior.imagen);
  const inf = useImagen(portada.bandaInferior.imagen);
  return {
    fondo: fondo.url,
    bandaSuperior: { url: sup.url, x: portada.bandaSuperior.x, y: portada.bandaSuperior.y, ancho: sup.ancho, alto: sup.alto },
    bandaInferior: { url: inf.url, x: portada.bandaInferior.x, y: portada.bandaInferior.y, ancho: inf.ancho, alto: inf.alto },
  };
}
