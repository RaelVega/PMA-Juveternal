import Dexie, { type EntityTable } from 'dexie';
import type { RegistroLead } from './registro';

/**
 * Leads en IndexedDB: funciona sin internet en las tres vías y sobrevive a
 * reinicios. Cada vía es un origen distinto y tiene su propia base: al cierre
 * del evento se exportan todas (Ctrl+Shift+E).
 */
const base = new Dexie('pma-juveternal-leads') as Dexie & { leads: EntityTable<RegistroLead, 'id'> };
base.version(1).stores({ leads: 'id, fecha' });

export async function guardarLeadLocal(registro: RegistroLead): Promise<void> {
  await base.leads.put(registro);
}

export async function leerLeadsLocales(): Promise<RegistroLead[]> {
  return base.leads.orderBy('fecha').toArray();
}
