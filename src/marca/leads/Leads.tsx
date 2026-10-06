import { motion } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { Presionable } from '../../motor/componentes/Presionable';
import { useMovimientoReducido } from '../../motor/movimiento/useMovimientoReducido';
import { Teclado } from '../../motor/teclado/Teclado';
import { EscenaDual } from '../componentes/EscenaDual';
import { useContenido, useDespachar, useFlujo, useImagenesEscena } from '../estado';
import { OMITIR_LEAD } from '../flujo';
import { CURVA_ESTANDAR } from '../tokens/movimiento';
import { aplicarSugerencia, CAMPOS_LEAD, caracteresValidos, correoValido, leadCompleto, normalizarCampo, sugerenciasCorreo, type CampoLead } from './campos';
import estilos from './Leads.module.css';

/**
 * Leads: una sola pantalla para las dos marcas, al final de cualquier catálogo,
 * con la identidad del salvapantallas. Nombre y correo obligatorios, empresa
 * opcional; teclado propio que cambia con el campo (el del correo, con
 * autocompletado de dominios y sin espacio). OMITIR sigue sin dejar datos.
 */
export function Leads(): ReactNode {
  const { leads } = useContenido();
  const imagenes = useImagenesEscena();
  const despachar = useDespachar();
  const lead = useFlujo((f) => f.sesion.lead);
  const reducido = useMovimientoReducido();
  const [activo, setActivo] = useState<CampoLead>('nombre');
  // Cada rechazo vuelve a disparar el temblor del campo activo.
  const [rechazos, setRechazos] = useState(0);
  const valor = lead[activo];
  const completo = leadCompleto(lead);

  const escribir = (texto: string): void => {
    const candidato = normalizarCampo(activo, texto);
    if (candidato === valor) return;
    if (candidato.length > leads.campos[activo].maxCaracteres || !caracteresValidos(activo, candidato)) {
      setRechazos((n) => n + 1);
      return;
    }
    despachar({ tipo: 'escribir', campo: activo, texto: candidato });
  };

  const enviar = (): void => {
    if (completo) {
      despachar({ tipo: 'avanzar', origen: 'visitante' });
      return;
    }
    // Incompleto: se lleva al visitante al primer campo que falta.
    setActivo(lead.nombre.trim().length < 2 ? 'nombre' : 'correo');
    setRechazos((n) => n + 1);
  };

  const omitir = (): void => {
    despachar({ tipo: 'elegir', valor: OMITIR_LEAD });
    despachar({ tipo: 'avanzar', origen: 'visitante' });
  };

  const esCorreo = activo === 'correo';
  const teclado = esCorreo ? leads.tecladoCorreo : leads.teclado;
  const sugerencias = esCorreo ? sugerenciasCorreo(lead.correo, { dominios: leads.dominios, terminaciones: leads.terminaciones, maximo: leads.maxSugerencias }) : [];
  // El formulario entra cuando el título ya está (dos elementos animando como mucho).
  const entrada = { initial: { opacity: 0, y: reducido ? 0 : 30 }, animate: { opacity: 1, y: 0, transition: { delay: 0.8, duration: 0.4, ease: CURVA_ESTANDAR } } };

  return (
    <EscenaDual titulo={leads.titulo} imagenes={imagenes}>
      <motion.div className={estilos.formulario} {...entrada}>
        <p className={estilos.texto}>{leads.texto}</p>
        {CAMPOS_LEAD.map((campo) => {
          const esActivo = campo === activo;
          const clases = [estilos.campo, esActivo && rechazos > 0 && estilos.rechazo, campo === 'correo' && lead.correo && !correoValido(lead.correo) && estilos.incompleto];
          return (
            <Presionable
              key={esActivo ? `${campo}-${rechazos}` : campo}
              className={clases.filter(Boolean).join(' ')}
              seleccionado={esActivo}
              etiqueta={leads.campos[campo].etiqueta}
              alActivar={() => setActivo(campo)}
            >
              <span className={estilos.etiqueta}>{leads.campos[campo].etiqueta}</span>
              <span className={estilos.valor}>
                {lead[campo]}
                {esActivo && <span className={estilos.cursor} aria-hidden="true" />}
              </span>
            </Presionable>
          );
        })}
        <p className={estilos.consentimiento}>{leads.consentimiento}</p>
        <Teclado
          className={estilos.teclado}
          filas={teclado.filas}
          etiquetaEspacio={teclado.espacio}
          etiquetaBorrar={teclado.borrar}
          sinEspacio={esCorreo}
          // Siempre una fila de sugerencias (vacía fuera del correo): el teclado no cambia de alto al cambiar de campo.
          sugerencias={sugerencias}
          alSugerencia={(s) => escribir(aplicarSugerencia(lead.correo, s))}
          alTecla={(c) => escribir(valor + c)}
          alBorrar={() => despachar({ tipo: 'escribir', campo: activo, texto: valor.slice(0, -1) })}
        />
        <div className={estilos.botones}>
          <Presionable className={`${estilos.boton} ${estilos.omitir}`} etiqueta={leads.omitir} alActivar={omitir}>
            {leads.omitir}
          </Presionable>
          <Presionable className={`${estilos.boton} ${estilos.enviar}`} etiqueta={leads.enviar} seleccionado={completo} alActivar={enviar}>
            {leads.enviar}
          </Presionable>
        </div>
      </motion.div>
    </EscenaDual>
  );
}
