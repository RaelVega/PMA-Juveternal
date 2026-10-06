// Icono del ejecutable y favicon: PROVISIONAL (marketing no mandó uno para la pantalla dual).
// Un círculo partido con los dos colores de marca. Uso: npm run icono
import path from 'node:path';
import sharp from 'sharp';

const RAIZ = path.resolve(import.meta.dirname, '..');
const svg = (lado, margen) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 100 100">
  <defs><clipPath id="c"><circle cx="50" cy="50" r="${50 - margen}"/></clipPath></defs>
  <g clip-path="url(#c)"><rect width="50" height="100" fill="#28b2a9"/><rect x="50" width="50" height="100" fill="#e94e1a"/></g>
  <circle cx="50" cy="50" r="${50 - margen - 1.5}" fill="none" stroke="#fff" stroke-width="3"/>
</svg>`);
await sharp(svg(1024, 2)).png().toFile(path.join(RAIZ, 'cascaras/icono/icono.png'));
// macOS: margen para que el icono no toque los bordes del dock.
await sharp(svg(1024, 10)).png().toFile(path.join(RAIZ, 'cascaras/icono/icono-mac.png'));
console.log('Icono provisional en cascaras/icono/');
