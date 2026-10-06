import { animate } from 'motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { urlContenido } from '../motor/contenido/cargar';
import { VideoBucle } from '../motor/video/VideoBucle';
import {
  chequearAlmacenamiento,
  chequearFuenteEtiqueta,
  chequearFuenteInterfaz,
  chequearImagen,
  chequearManifiesto,
  chequearOrigen,
  chequearRangos,
  chequearTelemetriaArchivo,
  chequearVideo,
  medirFotogramas,
  type Manifiesto,
  type ResultadoChequeo,
} from './chequeos';
import estilos from './PruebaHumo.module.css';

const DURACION_ANIMACION_MS = 4000;

/** La primera entrada de un registro del manifiesto: la prueba no depende de ids concretos. */
function primero<T>(registro: Record<string, T>): T | undefined {
  return Object.values(registro)[0];
}

export function PruebaHumo(): ReactNode {
  const [resultados, setResultados] = useState<ResultadoChequeo[]>([]);
  const [manifiesto, setManifiesto] = useState<Manifiesto | null>(null);
  const [terminado, setTerminado] = useState(false);
  const refVideo = useRef<HTMLVideoElement | null>(null);
  const refFrasco = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let cancelado = false;
    const anotar = (resultado: ResultadoChequeo): void => {
      if (!cancelado) setResultados((previos) => [...previos, resultado]);
    };

    void (async () => {
      const todos: ResultadoChequeo[] = [];
      const registrar = (resultado: ResultadoChequeo): void => {
        todos.push(resultado);
        anotar(resultado);
      };

      registrar(await chequearOrigen());
      const { resultado, manifiesto: datos } = await chequearManifiesto();
      registrar(resultado);
      if (datos) {
        setManifiesto(datos);
        const imagen = primero(datos.imagenes);
        const video = primero(datos.videos);
        const fuente = primero(datos.fuentes);
        if (imagen) registrar(await chequearImagen(imagen.archivo));
        if (fuente) registrar(await chequearFuenteEtiqueta(fuente.archivo, fuente.familia));
        if (video) registrar(await chequearRangos(video.archivo));
      }
      registrar(await chequearFuenteInterfaz());
      registrar(await chequearAlmacenamiento());
      registrar(await chequearTelemetriaArchivo());

      // Animación de prueba: el frasco cruza el lienzo solo con transform, como en PAG 09.
      const frasco = refFrasco.current;
      if (frasco) {
        const controles = animate(frasco, { x: [0, 640, 0], rotate: [0, 8, 0] }, { duration: DURACION_ANIMACION_MS / 1000, ease: 'easeInOut' });
        const medicion = await medirFotogramas(DURACION_ANIMACION_MS);
        controles.stop();
        registrar({
          id: 'animacion',
          nombre: 'Animación (transform, 60 fps)',
          ok: medicion.fps >= 55 && medicion.lentos <= Math.ceil(medicion.total * 0.02),
          detalle: `${medicion.fps} fps · p95 ${medicion.p95Ms} ms · ${medicion.lentos}/${medicion.total} fotogramas lentos`,
        });
      }

      const videoElemento = refVideo.current;
      if (videoElemento) registrar(await chequearVideo(videoElemento));

      if (cancelado) return;
      const informe = JSON.stringify({ ok: todos.every((r) => r.ok), version: __VERSION__, resultados: todos });
      console.info(`HUMO_RESULTADO ${informe}`);
      window.kiosco?.informarHumo(informe);
      document.title = todos.every((r) => r.ok) ? 'HUMO:OK' : 'HUMO:FALLO';
      setTerminado(true);
    })();

    return () => {
      cancelado = true;
    };
  }, []);

  const imagen = manifiesto ? primero(manifiesto.imagenes) : undefined;
  const video = manifiesto ? primero(manifiesto.videos) : undefined;
  const fuente = manifiesto ? primero(manifiesto.fuentes) : undefined;

  return (
    <div className={estilos.pantalla}>
      {video && <VideoBucle src={urlContenido(video.archivo)} className={estilos.video} refExterna={refVideo} />}
      <div className={estilos.panel}>
        <h1 className={estilos.titulo}>PRUEBA DE HUMO</h1>
        <p className={estilos.version}>v{__VERSION__}</p>
        <ul className={estilos.lista}>
          {resultados.map((r) => (
            <li key={r.id} className={r.ok ? estilos.ok : estilos.fallo}>
              <span className={estilos.marca}>{r.ok ? '✓' : '✗'}</span>
              <span className={estilos.nombre}>{r.nombre}</span>
              <span className={estilos.detalle}>{r.detalle}</span>
            </li>
          ))}
        </ul>
        {fuente && (
          <p className={estilos.etiqueta} style={{ fontFamily: `"${fuente.familia}", serif` }}>
            {fuente.familia} · fuente desde contenido/
          </p>
        )}
        {terminado && <p className={estilos.estado}>{resultados.every((r) => r.ok) ? 'TODO BIEN' : 'HAY FALLOS'}</p>}
      </div>
      {imagen && <img ref={refFrasco} className={estilos.frasco} src={urlContenido(imagen.archivo)} width={imagen.ancho} height={imagen.alto} alt="" />}
    </div>
  );
}
