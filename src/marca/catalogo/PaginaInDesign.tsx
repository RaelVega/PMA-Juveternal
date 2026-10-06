import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useMovimientoReducido } from '../../motor/movimiento/useMovimientoReducido';
import { interpretarAcciones, type Accion } from './acciones';
import estilos from './PaginaInDesign.module.css';

const OCULTO = '_idGenStateHide';
const SELECTOR_BOTON = '[data-clickactions], [data-releaseactions], [data-animationonselfclickactions]';

interface Propiedades {
  /** HTML de la página generado por la ingesta (sin scripts ni on*). */
  html: string;
  alIrA: (pagina: number) => void;
  /** Avisa si hay alguna ficha abierta (algo que estaba oculto al cargar la página y ahora se ve). */
  alCambiarFicha?: (abierta: boolean) => void;
}

/**
 * Una página exportada de InDesign, con su comportamiento reescrito sin su JS:
 * las animaciones de entrada (las clases y keyframes de su CSS), los botones
 * que muestran y ocultan fichas, «ir a» y el video. Las fichas aparecen con un
 * fundido (solo opacity: sus contenedores ya llevan transform propio).
 */
export function PaginaInDesign({ html, alIrA, alCambiarFicha }: Propiedades): ReactNode {
  const refRaiz = useRef<HTMLDivElement>(null);
  const refIrA = useRef(alIrA);
  refIrA.current = alIrA;
  const refFicha = useRef(alCambiarFicha);
  refFicha.current = alCambiarFicha;
  const reducido = useMovimientoReducido();

  useLayoutEffect(() => {
    const raiz = refRaiz.current;
    if (!raiz) return;
    raiz.innerHTML = html;
    const temporizadores: number[] = [];
    const porId = (id: string): HTMLElement | null => raiz.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`);
    // Lo que InDesign deja oculto al cargar son las fichas (y sus ✕): si alguno se ve, hay una ficha abierta.
    const ocultosAlCargar = [...raiz.querySelectorAll('._idGenButton.' + OCULTO)];
    const avisarFicha = (): void => refFicha.current?.(ocultosAlCargar.some((el) => !el.classList.contains(OCULTO)));
    avisarFicha();

    /** playAnimation de InDesign: estado inicial → clase de animación (tras el retraso) → estado final. */
    const animar = (el: HTMLElement, clase: string, retrasoS: number, ocultarAlTerminar: boolean): void => {
      const inicio = el.getAttribute('data-idgenanimationstartstate');
      const fin = el.getAttribute('data-idgenanimationendstate');
      const terminar = (): void => {
        el.classList.remove(clase);
        if (inicio) el.classList.remove(inicio);
        if (fin) el.classList.add(fin);
        if (ocultarAlTerminar) el.classList.add(OCULTO);
      };
      if (reducido) {
        el.classList.remove(OCULTO);
        terminar();
        return;
      }
      if (fin) el.classList.remove(fin);
      if (inicio) el.classList.add(inicio);
      temporizadores.push(
        window.setTimeout(() => {
          el.classList.remove(OCULTO);
          el.addEventListener('animationend', (evento) => evento.target === el && terminar(), { once: true });
          el.classList.add(clase);
        }, retrasoS * 1000),
      );
    };

    const reproducir = (video: HTMLVideoElement, desdeS: number, retrasoS: number): void => {
      temporizadores.push(
        window.setTimeout(() => {
          video.currentTime = desdeS;
          void video.play().catch(() => {
            // Si el autoplay falla, el primer toque lo arranca de todos modos.
          });
        }, retrasoS * 1000),
      );
    };

    const ejecutar = (acciones: readonly Accion[], propio: HTMLElement): void => {
      for (const accion of acciones) {
        switch (accion.tipo) {
          case 'mostrar': {
            const el = porId(accion.id);
            if (!el || !el.classList.contains(OCULTO)) break;
            el.classList.remove(OCULTO);
            if (!reducido) {
              el.classList.add(estilos.aparece ?? '');
              el.addEventListener('animationend', () => el.classList.remove(estilos.aparece ?? ''), { once: true });
            }
            break;
          }
          case 'ocultar':
            porId(accion.id)?.classList.add(OCULTO);
            break;
          case 'irA':
            refIrA.current(accion.pagina);
            break;
          case 'animar': {
            const el = accion.id ? porId(accion.id) : propio;
            if (el) animar(el, accion.clase, accion.retrasoS, accion.ocultarAlTerminar);
            break;
          }
          case 'reproducir': {
            const el = accion.id ? porId(accion.id) : propio;
            const video = el instanceof HTMLVideoElement ? el : el?.querySelector('video');
            if (video) reproducir(video, accion.desdeS, accion.retrasoS);
            break;
          }
        }
      }
    };

    // Video: siempre muted + playsInline, como VideoBucle (sin audio y sin controles).
    const videos = [...raiz.querySelectorAll('video')];
    for (const video of videos) {
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      const fuente = video.getAttribute('data-src');
      if (fuente) video.src = fuente;
    }

    // Lo que InDesign hace al cargar la página.
    for (const el of raiz.querySelectorAll<HTMLElement>('[data-animationonpageloadactions]')) ejecutar(interpretarAcciones(el.getAttribute('data-animationonpageloadactions')), el);
    for (const el of raiz.querySelectorAll<HTMLElement>('[data-mediaonpageloadactions]')) ejecutar(interpretarAcciones(el.getAttribute('data-mediaonpageloadactions')), el);

    // Respuesta visual en pointerdown (< 100 ms) y acción al soltar, como el click de InDesign.
    const presionados = new Set<Element>();
    const soltarTodo = (): void => {
      for (const el of presionados) el.classList.remove(estilos.presionado ?? '');
      presionados.clear();
    };
    const alPresionar = (evento: PointerEvent): void => {
      const boton = (evento.target as Element | null)?.closest(SELECTOR_BOTON);
      if (!boton || !raiz.contains(boton)) return;
      boton.classList.add(estilos.presionado ?? '');
      presionados.add(boton);
    };
    const alClic = (evento: MouseEvent): void => {
      const boton = (evento.target as Element | null)?.closest<HTMLElement>(SELECTOR_BOTON);
      if (!boton || !raiz.contains(boton)) return;
      ejecutar(
        [
          ...interpretarAcciones(boton.getAttribute('data-clickactions')),
          ...interpretarAcciones(boton.getAttribute('data-releaseactions')),
          ...interpretarAcciones(boton.getAttribute('data-animationonselfclickactions')),
        ],
        boton,
      );
      avisarFicha();
    };
    raiz.addEventListener('pointerdown', alPresionar);
    raiz.addEventListener('click', alClic);
    window.addEventListener('pointerup', soltarTodo);
    window.addEventListener('pointercancel', soltarTodo);

    return () => {
      for (const id of temporizadores) window.clearTimeout(id);
      raiz.removeEventListener('pointerdown', alPresionar);
      raiz.removeEventListener('click', alClic);
      window.removeEventListener('pointerup', soltarTodo);
      window.removeEventListener('pointercancel', soltarTodo);
      // Sin esto los buffers del video se acumulan en sesiones largas (misma regla que VideoBucle).
      for (const video of videos) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
      raiz.innerHTML = '';
    };
  }, [html, reducido]);

  return <div ref={refRaiz} className={`indesign ${estilos.pagina}`} />;
}
