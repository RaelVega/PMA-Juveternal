// Cloudflare Pages: construye y sube dist/ al proyecto pma-juveternal → https://pma-juveternal.pages.dev
// Requiere una sesión: npx wrangler login (una sola vez). Crea el proyecto si no existe.
// Uso: npm run publicar:cloudflare
import { execFileSync } from 'node:child_process';

const PROYECTO = 'pma-juveternal';
const WRANGLER = ['--yes', 'wrangler@4'];
const RAIZ = new URL('../..', import.meta.url).pathname;
const correr = (comando, args, opciones = {}) => execFileSync(comando, args, { cwd: RAIZ, stdio: 'inherit', ...opciones });

correr('npm', ['run', 'build']);
const existentes = execFileSync('npx', [...WRANGLER, 'pages', 'project', 'list', '--json'], { cwd: RAIZ, encoding: 'utf8' });
const proyectos = new Set(JSON.parse(existentes).map((p) => p['Project Name'] ?? p.name ?? p.project_name));
// Desde wrangler 4.138, «project create» intenta crear un Worker y falla con una carpeta estática: --force.
if (!proyectos.has(PROYECTO)) {
  try {
    correr('npx', [...WRANGLER, 'pages', 'project', 'create', PROYECTO, '--production-branch', 'main', '--force']);
  } catch {
    console.warn(`No se pudo crear ${PROYECTO}; se intenta publicar igual.`);
  }
}
correr('npx', [...WRANGLER, 'pages', 'deploy', 'dist', '--project-name', PROYECTO, '--branch', 'main', '--commit-dirty=true']);
console.log(`\nPublicado: https://${PROYECTO}.pages.dev`);
