import type { AlmacenFlujo } from '../../motor/maquina/almacen';
import type { PasoDual, SesionDual } from '../flujo';
import { guardarLeadLocal, leerLeadsLocales } from './almacen';
import { CABECERA_CSV, documentoCsv, filaCsv, type RegistroLead } from './registro';

/** ISO 8601 en hora local con su desfase («2026-10-06T11:09:57-06:00»): es lo que lee el staff en Excel. */
export function fechaLocal(fecha: Date): string {
  const dos = (n: number): string => String(Math.trunc(Math.abs(n))).padStart(2, '0');
  const desfase = -fecha.getTimezoneOffset();
  const dia = `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
  const hora = `${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:${dos(fecha.getSeconds())}`;
  return `${dia}T${hora}${desfase >= 0 ? '+' : '-'}${dos(desfase / 60)}:${dos(desfase % 60)}`;
}

export function crearRegistroLead(id: string, fecha: Date, sesion: SesionDual, consentimiento: string): RegistroLead {
  return {
    id,
    fecha: fechaLocal(fecha),
    nombre: sesion.lead.nombre.trim(),
    correo: sesion.lead.correo,
    empresa: sesion.lead.empresa.trim(),
    consentimiento,
    marca: sesion.catalogo ?? '',
  };
}

/**
 * Guarda el lead al pasar de «leads» a «despedida» (si no se omitió): en
 * IndexedDB siempre y, en el ejecutable, además en un CSV junto al .exe. La
 * máquina sigue siendo pura: esto es un suscriptor del almacén. Un fallo al
 * guardar se registra y nunca interrumpe la experiencia.
 */
export function iniciarGuardadoLeads(almacen: AlmacenFlujo<PasoDual, SesionDual>, consentimiento: string): () => void {
  let idSesion: string | null = null;

  return almacen.subscribe((estado, anterior) => {
    const { paso, sesion } = estado.flujo;
    // Una sesión nueva (tras reiniciar o volver al salvapantallas) es otro visitante.
    if (paso === 'portada') idSesion = null;
    if (anterior.flujo.paso !== 'leads' || paso !== 'despedida' || sesion.lead.omitido) return;

    idSesion ??= crypto.randomUUID();
    const registro = crearRegistroLead(idSesion, new Date(), sesion, consentimiento);
    guardarLeadLocal(registro).catch((error: unknown) => console.error('No se pudo guardar el lead en IndexedDB', error));
    window.kiosco?.anexarLead?.(CABECERA_CSV, filaCsv(registro)).catch((error: unknown) => console.error('No se pudo anexar el lead al CSV', error));
  });
}

/** Lo que ve el staff tras Ctrl+Shift+E. */
export type ResultadoExportacion = { readonly ok: true; readonly cantidad: number; readonly destino: 'ejecutable' | 'navegador' } | { readonly ok: false };

/**
 * Ctrl+Shift+E: exporta todos los leads de esta vía a CSV. En el ejecutable
 * se escribe junto al .exe (sin diálogos que saquen del kiosco); en el
 * navegador se descarga. `alTerminar` recibe el resultado para avisar en pantalla.
 */
export function iniciarExportacionLeads(alTerminar: (resultado: ResultadoExportacion) => void): () => void {
  const alTeclear = (evento: KeyboardEvent): void => {
    if (!(evento.ctrlKey && evento.shiftKey && evento.key.toLowerCase() === 'e')) return;
    evento.preventDefault();
    exportarLeads().then(alTerminar, (error: unknown) => {
      console.error('No se pudieron exportar los leads', error);
      alTerminar({ ok: false });
    });
  };
  window.addEventListener('keydown', alTeclear);
  return () => window.removeEventListener('keydown', alTeclear);
}

async function exportarLeads(): Promise<ResultadoExportacion> {
  const registros = await leerLeadsLocales();
  const csv = documentoCsv(registros);
  if (window.kiosco?.exportarLeads) {
    console.info('Leads exportados en', await window.kiosco.exportarLeads(csv));
    return { ok: true, cantidad: registros.length, destino: 'ejecutable' };
  }
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { ok: true, cantidad: registros.length, destino: 'navegador' };
}
