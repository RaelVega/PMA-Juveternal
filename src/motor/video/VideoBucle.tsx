import { useEffect, useRef, type ReactNode, type Ref } from 'react';

interface PropiedadesVideoBucle {
  src: string;
  className?: string | undefined;
  refExterna?: Ref<HTMLVideoElement> | undefined;
}

/**
 * Video en bucle para sesiones de 8 horas. Siempre `muted` + `playsInline`
 * (si no, no arranca solo). Al desmontar se pausa, se quita el `src` y se
 * recarga el elemento: sin eso los buffers se acumulan hasta tumbar el
 * navegador a las pocas horas.
 */
export function VideoBucle({ src, className, refExterna }: PropiedadesVideoBucle): ReactNode {
  const refVideo = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = refVideo.current;
    if (!video) return;
    video.src = src;
    void video.play().catch(() => {
      // Si el autoplay falla, el primer toque del visitante lo arranca de todos modos.
    });
    return () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [src]);

  return (
    <video
      ref={(nodo) => {
        refVideo.current = nodo;
        if (typeof refExterna === 'function') refExterna(nodo);
        else if (refExterna) refExterna.current = nodo;
      }}
      className={className}
      muted
      playsInline
      loop
      autoPlay
      preload="auto"
      disablePictureInPicture
    />
  );
}
