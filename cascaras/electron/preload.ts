import { contextBridge, ipcRenderer } from 'electron';

/** Lo único que la página puede pedirle al proceso principal. Ver `src/motor/kiosco/entorno.ts`. */
contextBridge.exposeInMainWorld('kiosco', {
  via: 'ejecutable',
  versionElectron: process.versions['electron'] ?? '',
  anexarTelemetria: (linea: string): Promise<string> => ipcRenderer.invoke('telemetria:anexar', linea),
  anexarLead: (cabecera: string, fila: string): Promise<string> => ipcRenderer.invoke('leads:anexar', cabecera, fila),
  exportarLeads: (csv: string): Promise<string> => ipcRenderer.invoke('leads:exportar', csv),
  informarHumo: (json: string): void => ipcRenderer.send('humo:resultado', json),
});
