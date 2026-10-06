import type { ReactNode } from 'react';
import { urlContenido } from '../../motor/contenido/cargar';
import { VideoBucle } from '../../motor/video/VideoBucle';
import { useContenido, useDespachar, useRecursos } from '../estado';
import estilos from './Portada.module.css';

/**
 * Salvapantallas: el video de marketing en bucle (ya trae «Toca la pantalla
 * para comenzar»). Cualquier toque lleva al selector de marca.
 */
export function Portada(): ReactNode {
  const { portada } = useContenido();
  const video = useRecursos().manifiesto.videos[portada.video];
  const despachar = useDespachar();
  if (!video) return null;
  return (
    <div className={estilos.portada}>
      <VideoBucle src={urlContenido(video.archivo)} className={estilos.video} />
      <button type="button" aria-label="Comenzar" className={estilos.toque} onClick={() => despachar({ tipo: 'avanzar', origen: 'visitante' })} />
    </div>
  );
}
