import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useMovimientoReducido } from '../../motor/movimiento/useMovimientoReducido';
import { interpretarAcciones, type Accion } from './acciones';
import estilos from './PaginaInDesign.module.css';

const OCULTO = '_idGenStateHide';
const SELECTOR_BOTON = '[data-clickactions], [data-releaseactions], [data-animationonselfclickactions]';

interface Propiedades {
  /** HTML de la página generado por la ingesta (sin scripts ni on*). */
  html: string;
  /** Id del catálogo: su CSS va acotado a `.indesign[data-catalogo="<id>"]`. */
  catalogo: string;
  alIrA: (pagina: number) => void;
  /** Botón de inicio del diseño: vuelve al selector de empresa. */
  alInicio: () => void;
  /** Avisa si hay alguna ficha abierta (algo que estaba oculto al cargar la página y ahora se ve). */
  alCambiarFicha?: (abierta: boolean) => void;
}

/**
 * Una página exportada de InDesign, con su comportamiento reescrito sin su JS:
 * las animaciones de entrada (las clases y keyframes de su CSS), los botones
 * que muestran y ocultan fichas, «ir a» y el video. Las fichas aparecen con un
 * fundido (solo opacity: sus contenedores ya llevan transform propio).
 */
export function PaginaInDesign({ html, catalogo, alIrA, alInicio, alCambiarFicha }: Propiedades): ReactNode {
  const refRaiz = useRef<HTMLDivElement>(null);
  const refIrA = useRef(alIrA);
  refIrA.current = alIrA;
  const refInicio = useRef(alInicio);
  refInicio.current = alInicio;
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
          case 'inicio':
            refInicio.current();
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

    /*
     * Eventos como en el motor de InDesign: las acciones «clic» (data-clickactions) se ejecutan al
     * PRESIONAR el botón y las de «soltar» (data-releaseactions y las de la propia animación) sobre lo
     * que haya bajo el dedo al LEVANTARLO. Importa: al presionar una ✕ la ficha y la ✕ se ocultan, y al
     * soltar ya no hay ✕ debajo, así que su «soltar» (que vuelve a animarla) no debe ejecutarse. Si se
     * ejecutaban las dos al soltar, la ✕ volvía a aparecer flotando (Juveternal, págs. 4 y 5).
     */
    const presionados = new Set<Element>();
    // El gesto pertenece a la página donde empezó: si al presionar se cambió de página (las flechas de
    // Juveternal navegan al presionar), la página nueva no debe recibir el «soltar» y saltarse otra.
    let presionDentro = false;
    const soltarTodo = (): void => {
      for (const el of presionados) el.classList.remove(estilos.presionado ?? '');
      presionados.clear();
    };
    const botonEn = (objetivo: EventTarget | Element | null): HTMLElement | null => {
      const boton = objetivo instanceof Element ? objetivo.closest<HTMLElement>(SELECTOR_BOTON) : null;
      return boton && raiz.contains(boton) && !boton.classList.contains(OCULTO) ? boton : null;
    };
    const alPresionar = (evento: PointerEvent): void => {
      presionDentro = true;
      const boton = botonEn(evento.target);
      if (!boton) return;
      boton.classList.add(estilos.presionado ?? '');
      presionados.add(boton);
      ejecutar(interpretarAcciones(boton.getAttribute('data-clickactions')), boton);
      avisarFicha();
    };
    const alSoltar = (evento: PointerEvent): void => {
      soltarTodo();
      if (!presionDentro) return;
      presionDentro = false;
      // Con touch, pointerup llega al elemento donde empezó el toque: se busca lo que hay debajo AHORA.
      const boton = botonEn(document.elementFromPoint(evento.clientX, evento.clientY));
      if (!boton) return;
      ejecutar(
        [...interpretarAcciones(boton.getAttribute('data-releaseactions')), ...interpretarAcciones(boton.getAttribute('data-animationonselfclickactions'))],
        boton,
      );
      avisarFicha();
    };
    raiz.addEventListener('pointerdown', alPresionar);
    window.addEventListener('pointerup', alSoltar);
    const cancelar = (): void => {
      presionDentro = false;
      soltarTodo();
    };
    window.addEventListener('pointercancel', cancelar);

    return () => {
      for (const id of temporizadores) window.clearTimeout(id);
      raiz.removeEventListener('pointerdown', alPresionar);
      window.removeEventListener('pointerup', alSoltar);
      window.removeEventListener('pointercancel', cancelar);
      // Sin esto los buffers del video se acumulan en sesiones largas (misma regla que VideoBucle).
      for (const video of videos) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
      raiz.innerHTML = '';
    };
  }, [html, reducido]);

  return <div ref={refRaiz} className={`indesign ${estilos.pagina}`} data-catalogo={catalogo} />;
}
