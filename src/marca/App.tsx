import { useEffect, useState, type ReactNode } from 'react';
import { urlContenido } from '../motor/contenido/cargar';
import { crearAlmacenFlujo } from '../motor/maquina/almacen';
import { registrarFuentesDeContenido } from '../motor/precarga/fuentes';
import { precargar } from '../motor/precarga/precarga';
import { AVISO_INACTIVIDAD_MS, REINICIO_INACTIVIDAD_MS, REINTENTO_FALLO_MS, TEXTO_FALLO_CONTENIDO } from './configuracion';
import { cargarContenido, type CatalogoCargado } from './contenido/cargar';
import { ProveedorRecursos, type Recursos } from './estado';
import { Experiencia } from './Experiencia';
import { crearMaquinaDual } from './flujo';
import estilos from './App.module.css';

type Carga = { fase: 'cargando' } | { fase: 'lista'; recursos: Recursos } | { fase: 'fallo'; detalle: string };

/** Pesos de la interfaz que se usan (aviso de inactividad): se cargan antes de la portada. */
const FUENTES_INTERFAZ = ['800 64px "Montserrat Thin"', '500 34px "Montserrat Thin"'];

/** El CSS de InDesign de cada catálogo, enlazado una vez y esperado: ninguna página aparece sin estilo. */
function enlazarEstilos(catalogo: CatalogoCargado): Promise<void> {
  return new Promise((resolver, rechazar) => {
    const enlace = document.createElement('link');
    enlace.rel = 'stylesheet';
    enlace.href = urlContenido(catalogo.estilos);
    enlace.dataset['catalogo'] = catalogo.id;
    enlace.onload = () => resolver();
    enlace.onerror = () => rechazar(new Error(`No cargó el estilo del catálogo ${catalogo.id}`));
    document.head.appendChild(enlace);
  });
}

async function iniciar(): Promise<Recursos> {
  const cargado = await cargarContenido();
  const { manifiesto, catalogos } = cargado;
  const fuentesFallidas = await registrarFuentesDeContenido(manifiesto.fuentes);
  await Promise.all(Object.values(catalogos).map(enlazarEstilos));
  // Portada completa y las dos primeras páginas de cada catálogo, decodificadas y retenidas. El resto de páginas
  // (≈ 270 imágenes) se decodifica al acercarse a ellas: retenerlas todas costaría cientos de MB de memoria.
  const imagenesCatalogo = Object.values(catalogos).flatMap((c) => c.paginas.slice(0, 2).flatMap((p) => p.imagenes));
  const { fallidas, agotoTiempo } = await precargar({
    imagenes: [...Object.values(manifiesto.imagenes).map((i) => i.archivo), ...imagenesCatalogo].map(urlContenido),
    fuentes: FUENTES_INTERFAZ,
    minimoMs: 400,
    maximoMs: 8000,
  });
  if (fuentesFallidas.length || fallidas.length || agotoTiempo) console.warn('Precarga incompleta', { fuentesFallidas, fallidas, agotoTiempo });

  const paginas = Object.fromEntries(Object.values(catalogos).map((c) => [c.id, c.paginas.length]));
  const almacen = crearAlmacenFlujo(crearMaquinaDual(paginas), { avisoMs: AVISO_INACTIVIDAD_MS, reinicioMs: REINICIO_INACTIVIDAD_MS });
  return { ...cargado, almacen };
}

/** Arranque: contenido validado y precargado antes del salvapantallas. Nunca termina en pantalla blanca. */
export function App(): ReactNode {
  const [carga, setCarga] = useState<Carga>({ fase: 'cargando' });

  useEffect(() => {
    // ?fallo muestra la pantalla de fallo sin romper nada (para revisarla). En el kiosco nunca hay parámetros.
    if (new URLSearchParams(window.location.search).has('fallo')) {
      setCarga({ fase: 'fallo', detalle: 'Simulación con ?fallo: el contenido no se pudo leer.' });
      return;
    }
    let vigente = true;
    iniciar().then(
      (recursos) => vigente && setCarga({ fase: 'lista', recursos }),
      (error: unknown) => vigente && setCarga({ fase: 'fallo', detalle: error instanceof Error ? error.message : String(error) }),
    );
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    if (carga.fase !== 'fallo') return;
    console.error('No se pudo arrancar:', carga.detalle);
    const id = setTimeout(() => window.location.reload(), REINTENTO_FALLO_MS);
    return () => clearTimeout(id);
  }, [carga]);

  if (carga.fase === 'cargando') return <div className={estilos.arranque} />;
  if (carga.fase === 'fallo') {
    return (
      <div className={estilos.fallo}>
        <p className={estilos.falloTitulo}>{TEXTO_FALLO_CONTENIDO.titulo}</p>
        <p className={estilos.falloTexto}>{TEXTO_FALLO_CONTENIDO.texto}</p>
        <p className={estilos.falloDetalle}>{carga.detalle}</p>
      </div>
    );
  }
  return (
    <ProveedorRecursos recursos={carga.recursos}>
      <Experiencia />
    </ProveedorRecursos>
  );
}
