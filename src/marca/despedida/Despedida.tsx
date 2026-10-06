import { motion } from 'motion/react';
import { useEffect, type ReactNode } from 'react';
import { useMovimientoReducido } from '../../motor/movimiento/useMovimientoReducido';
import { EscenaDual } from '../componentes/EscenaDual';
import { useContenido, useDespachar, useImagen, useImagenesEscena } from '../estado';
import { CURVA_ESTANDAR } from '../tokens/movimiento';
import estilos from './Despedida.module.css';

/** Uno de los logos del salvapantallas, en su sitio. */
function Logo({ imagen, x, y, retraso }: { imagen: string; x: number; y: number; retraso: number }): ReactNode {
  const { url, ancho, alto } = useImagen(imagen);
  const reducido = useMovimientoReducido();
  return (
    <motion.img
      className={estilos.logo}
      src={url}
      width={ancho}
      height={alto}
      alt=""
      draggable={false}
      style={{ left: x, top: y }}
      initial={{ opacity: 0, y: reducido ? 0 : 40 }}
      animate={{ opacity: 1, y: 0, transition: { delay: retraso, duration: 0.45, ease: CURVA_ESTANDAR } }}
    />
  );
}

/**
 * Despedida tras los leads, con la identidad del salvapantallas: su fondo, las
 * bandas con el título y los dos logos donde estaban. Vuelve sola al
 * salvapantallas tras unos segundos (la barra los cuenta) o al tocar.
 */
export function Despedida(): ReactNode {
  const { despedida, selector } = useContenido();
  const imagenes = useImagenesEscena();
  const despachar = useDespachar();

  useEffect(() => {
    const id = window.setTimeout(() => despachar({ tipo: 'reiniciar', motivo: 'fin' }), despedida.segundos * 1000);
    return () => window.clearTimeout(id);
  }, [despachar, despedida.segundos]);

  return (
    <EscenaDual titulo={despedida.titulo} imagenes={imagenes}>
      <motion.p
        className={estilos.texto}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: 0.8, duration: 0.4, ease: CURVA_ESTANDAR } }}
      >
        {despedida.texto}
      </motion.p>
      {selector.marcas.map((marca, i) => (
        <Logo key={marca.id} imagen={marca.logo.imagen} x={marca.logo.x} y={marca.logo.y} retraso={1.1 + i * 0.15} />
      ))}
      <div className={estilos.pista}>
        <div className={estilos.barra} style={{ animationDuration: `${despedida.segundos}s` }} />
      </div>
      {/* Todo toque vuelve antes al salvapantallas. */}
      <button type="button" aria-label={despedida.titulo.join(' ')} className={estilos.toque} onClick={() => despachar({ tipo: 'reiniciar', motivo: 'fin' })} />
    </EscenaDual>
  );
}
