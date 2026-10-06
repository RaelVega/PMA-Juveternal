import type { ReactNode } from 'react';
import { Presionable } from '../componentes/Presionable';
import estilos from './Teclado.module.css';

interface PropiedadesTeclado {
  /** Filas de teclas; la última se completa con ESPACIO (salvo `sinEspacio`) y BORRAR. */
  filas: readonly (readonly string[])[];
  etiquetaEspacio: string;
  etiquetaBorrar: string;
  alTecla: (caracter: string) => void;
  alBorrar: () => void;
  /** Fila de autocompletado encima de las teclas: cada sugerencia se envía entera con `alSugerencia`. */
  sugerencias?: readonly string[] | undefined;
  alSugerencia?: ((texto: string) => void) | undefined;
  sinEspacio?: boolean | undefined;
  className?: string | undefined;
}

/**
 * Teclado propio en pantalla: el de Windows tapa la interfaz y saca del modo
 * kiosco. Teclas de 88 px como mínimo. El estilo sale de las variables
 * `--tecla-*` que define la marca.
 */
export function Teclado({
  filas,
  etiquetaEspacio,
  etiquetaBorrar,
  alTecla,
  alBorrar,
  sugerencias,
  alSugerencia,
  sinEspacio = false,
  className,
}: PropiedadesTeclado): ReactNode {
  const ultima = filas.length - 1;
  return (
    <div className={[estilos.teclado, className].filter(Boolean).join(' ')}>
      {sugerencias !== undefined && (
        // La fila existe aunque esté vacía, para que el teclado no salte de alto al cambiar las sugerencias.
        <div className={`${estilos.fila} ${estilos.sugerencias}`}>
          {sugerencias.map((sugerencia) => (
            <Presionable key={sugerencia} className={`${estilos.tecla} ${estilos.sugerencia}`} alActivar={() => alSugerencia?.(sugerencia)} etiqueta={sugerencia}>
              <span className={estilos.texto}>{sugerencia}</span>
            </Presionable>
          ))}
        </div>
      )}
      {filas.map((fila, indice) => (
        <div key={indice} className={estilos.fila}>
          {fila.map((caracter) => (
            <Presionable key={caracter} className={estilos.tecla} alActivar={() => alTecla(caracter)} etiqueta={caracter}>
              <span className={estilos.texto}>{caracter}</span>
            </Presionable>
          ))}
          {indice === ultima && (
            <>
              {!sinEspacio && (
                <Presionable className={`${estilos.tecla} ${estilos.ancha}`} alActivar={() => alTecla(' ')} etiqueta={etiquetaEspacio}>
                  <span className={estilos.texto}>{etiquetaEspacio}</span>
                </Presionable>
              )}
              <Presionable className={`${estilos.tecla} ${estilos.ancha} ${estilos.borrar}`} alActivar={alBorrar} etiqueta={etiquetaBorrar}>
                <svg className={estilos.icono} viewBox="0 0 32 24" aria-hidden="true">
                  <path d="M10 2h19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H10L1 12z M15 8l8 8 M23 8l-8 8" />
                </svg>
                <span className={estilos.texto}>{etiquetaBorrar}</span>
              </Presionable>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
