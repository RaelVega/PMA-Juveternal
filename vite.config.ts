/// <reference types="vitest/config" />
import { cpSync, existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const RAIZ = import.meta.dirname;
const { version } = JSON.parse(readFileSync(resolve(RAIZ, 'package.json'), 'utf8')) as { version: string };

/**
 * `contenido/` vive fuera del bundler para poder sustituir textos e imágenes
 * sin recompilar. Al construir se copia tal cual a `dist/contenido/`. En
 * desarrollo Vite lo sirve desde la raíz del proyecto.
 */
function copiarContenido(): Plugin {
  return {
    name: 'copiar-contenido',
    configureServer(servidor) {
      // El contenido se lee con fetch al arrancar, no es un módulo: si cambia, la recarga en caliente
      // dejaría código nuevo con contenido viejo en memoria. Se recarga la página entera.
      const vigilados = [resolve(RAIZ, 'contenido')];
      servidor.watcher.add(vigilados);
      const alCambiar = (archivo: string): void => {
        if (vigilados.some((dir) => !relative(dir, archivo).startsWith('..'))) servidor.ws.send({ type: 'full-reload' });
      };
      servidor.watcher.on('change', alCambiar);
      servidor.watcher.on('add', alCambiar);
      servidor.watcher.on('unlink', alCambiar);
    },
    closeBundle() {
      const origen = resolve(RAIZ, 'contenido');
      const destino = resolve(RAIZ, 'dist/contenido');
      if (existsSync(origen)) cpSync(origen, destino, { recursive: true });
      // Cabeceras para Cloudflare Pages (noindex, sin caché). GitHub Pages no las lee: ahí van como <meta>.
      cpSync(resolve(RAIZ, 'cascaras/web/_headers'), resolve(RAIZ, 'dist/_headers'));
    },
  };
}

/** Todo local: ninguna vía puede cargar nada de fuera. Los estilos en línea son de Motion. */
const POLITICA_CONTENIDO = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

/**
 * En desarrollo, un cambio en un módulo de lógica (`.ts` de `src/`: flujo,
 * catálogo, máquina, esquemas…) recarga la página entera. Esos módulos se
 * usan una sola vez al arrancar (crean la máquina y el almacén): la recarga en
 * caliente dejaría pantallas nuevas con una máquina vieja, que puede llevar a
 * un paso que ya no existe. Los componentes y el CSS siguen en caliente.
 */
function recargarLogica(): Plugin {
  const src = resolve(RAIZ, 'src');
  return {
    name: 'recargar-logica',
    apply: 'serve',
    handleHotUpdate({ file, server }) {
      if (!file.endsWith('.ts') || file.endsWith('.test.ts') || relative(src, file).startsWith('..')) return;
      server.ws.send({ type: 'full-reload' });
      return [];
    },
  };
}

/** La CSP solo se inyecta en la build: el servidor de desarrollo necesita scripts en línea. */
function politicaContenido(): Plugin {
  return {
    name: 'politica-contenido',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: POLITICA_CONTENIDO }, injectTo: 'head-prepend' },
    ],
  };
}

export default defineConfig({
  plugins: [react(), copiarContenido(), recargarLogica(), politicaContenido()],
  define: { __VERSION__: JSON.stringify(version) },
  // Rutas relativas: la misma build funciona en app://, en localhost y en una subruta de Netlify.
  base: './',
  publicDir: false,
  build: { target: 'chrome120', assetsInlineLimit: 0 },
  // Puertos propios para poder correr a la vez que Biocaps (5173/4173).
  server: { host: 'localhost', port: 5183, strictPort: true },
  preview: { host: 'localhost', port: 4183, strictPort: true },
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'] },
});
