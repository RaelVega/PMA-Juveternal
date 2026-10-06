// Convierte un export «HTML5 de diseño fijo» de InDesign en contenido de la app:
//   contenido/catalogos/<id>/paginas/pagina-NN.html  fragmento limpio de cada página (sin scripts ni on*)
//   contenido/catalogos/<id>/img/*.webp               cada imagen al tamaño al que se dibuja
//   contenido/catalogos/<id>/video/*.mp4              sin pista de audio
//   contenido/catalogos/<id>/estilos.css              el CSS de InDesign acotado a su catálogo, con nuestras fuentes
//   contenido/catalogos/<id>/catalogo.json            orden de páginas e imágenes por página (para la precarga)
//   pruebas/visual/referencias/<id>/pagina-NN.png     el export original en Chrome, ya animado: la «página completa»
// Las acciones de los botones (data-clickactions…) se conservan tal cual: las interpreta
// src/marca/catalogo/acciones.ts sin eval. Si aparece una acción desconocida, la ingesta falla.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const ACCIONES_CONOCIDAS = new Set(['onShow', 'onHide', 'goToDestination', 'playAnimation', 'onMediaStart']);
const ATRIBUTOS_ACCION = ['data-clickactions', 'data-releaseactions', 'data-animationonpageloadactions', 'data-animationonstateloadactions', 'data-animationonselfclickactions', 'data-mediaonpageloadactions'];

/** Busca un archivo comparando cada tramo en NFC (macOS guarda los acentos en NFD). */
function resolverNfc(base, relativa) {
  let ruta = base;
  for (const tramo of relativa.split('/').filter(Boolean)) {
    if (tramo === '..') { ruta = path.dirname(ruta); continue; }
    const buscado = tramo.normalize('NFC');
    const hallado = readdirSync(ruta).find((n) => n.normalize('NFC') === buscado);
    if (!hallado) throw new Error(`No existe ${path.join(ruta, tramo)}`);
    ruta = path.join(ruta, hallado);
  }
  return ruta;
}

/** Nombre de archivo seguro: sin acentos ni espacios. */
function slug(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\.[a-z0-9]+$/i, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

/**
 * Acota cada regla a su catálogo (`.indesign[data-catalogo="<id>"]`) y pone el id delante de los nombres de
 * @keyframes: cada export de InDesign numera desde cero (#_idContainer043, _idGenKeyFrames-2…) y con dos
 * catálogos cargados a la vez sus reglas chocarían.
 */
function acotarCss(css, reescribirUrl, id) {
  const raiz = `.indesign[data-catalogo="${id}"]`;
  let salida = '';
  let i = 0;
  while (i < css.length) {
    const abre = css.indexOf('{', i);
    if (abre === -1) break;
    const cabecera = css.slice(i, abre).trim();
    // Bloque completo, contando llaves anidadas (@keyframes, @media).
    let nivel = 1, j = abre + 1;
    while (j < css.length && nivel > 0) { if (css[j] === '{') nivel++; else if (css[j] === '}') nivel--; j++; }
    const cuerpo = css.slice(abre + 1, j - 1);
    i = j;
    if (/^@font-face/i.test(cabecera)) continue; // las fuentes las pone la app
    if (/^@(-webkit-)?keyframes/i.test(cabecera)) { salida += `${cabecera.replace(/(keyframes\s+)(\S+)/i, `$1${id}-$2`)} {${cuerpo}}\n`; continue; }
    if (/^@media/i.test(cabecera)) { salida += `${cabecera} {\n${acotarCss(cuerpo, reescribirUrl, id)}}\n`; continue; }
    const selectores = cabecera.split(',').map((s) => s.trim()).filter(Boolean).map((s) => (/^(html|body)\b/i.test(s) ? s.replace(/^(html|body)\b/i, raiz) : `${raiz} ${s}`));
    // Las animaciones apuntan a los @keyframes renombrados.
    const conAnimacion = reescribirUrl(cuerpo).replace(/((?:-webkit-)?animation(?:-name)?\s*:\s*)(_idGenKeyFrames-\d+)/gi, `$1${id}-$2`);
    salida += `${selectores.join(', ')} {${conAnimacion}}\n`;
  }
  return salida;
}

export async function ingerirCatalogo({ id, exportDir, RAIZ, fuentes, sustitutas = {}, mover = [], noMostrarAlCargar = [], corregirAcciones = [], imagenInicio = null, insertarLogo = null }) {
  const recursos = resolverNfc(exportDir, 'publication-web-resources');
  const dirHtml = path.join(recursos, 'html');
  const salida = path.join(RAIZ, 'contenido', 'catalogos', id);
  const dirImg = path.join(salida, 'img');
  const dirPaginas = path.join(salida, 'paginas');
  const dirVideo = path.join(salida, 'video');
  const dirRef = path.join(RAIZ, 'pruebas', 'visual', 'referencias', id);
  rmSync(salida, { recursive: true, force: true });
  rmSync(dirRef, { recursive: true, force: true });
  for (const d of [dirImg, dirPaginas, dirVideo, dirRef]) mkdirSync(d, { recursive: true });

  // publication.html es la portada; luego publication-1 … publication-N.
  const numeradas = readdirSync(dirHtml).map((n) => /^publication-(\d+)\.html$/.exec(n)).filter(Boolean).map((m) => Number(m[1])).sort((a, b) => a - b);
  const paginas = ['publication.html', ...numeradas.map((n) => `publication-${n}.html`)];
  // Páginas que marketing dejó fuera de su sitio: se mueven detrás de la indicada (equivalencias.json).
  for (const { pagina, despuesDe } of mover) {
    const desde = paginas.indexOf(pagina);
    if (desde === -1 || !paginas.includes(despuesDe)) throw new Error(`${id}: no existe ${pagina} o ${despuesDe} para reordenar`);
    paginas.splice(desde, 1);
    paginas.splice(paginas.indexOf(despuesDe) + 1, 0, pagina);
  }
  const numeroDe = (archivo) => (archivo === 'publication.html' ? 0 : Number(/publication-(\d+)\.html/.exec(archivo)?.[1]));
  const indiceNuevo = new Map(paginas.map((archivo, i) => [numeroDe(archivo), i]));
  const nombreDe = (i) => (i === 0 ? 'publication.html' : `publication-${i}.html`);
  /**
   * Con páginas movidas, los destinos de «ir a» se reescriben al orden nuevo: las flechas del diseño
   * apuntan a la página contigua del orden original, y deben ir a la contigua del orden nuevo; el
   * resto (inicio → portada) va a donde quedó su página. Sin mover nada, todo queda igual.
   */
  const reescribirDestinos = (html, origen, i) =>
    html.replace(/goToDestination\('(publication(?:-\d+)?\.html)'\)/g, (_, destino) => {
      const delta = numeroDe(destino) - numeroDe(origen);
      const nuevo = delta === 1 || delta === -1 ? i + delta : indiceNuevo.get(numeroDe(destino));
      return `goToDestination('${nombreDe(nuevo)}')`;
    });

  const navegador = await chromium.launch({ channel: 'chrome' });
  // El export pide ../../font/*.ttf, que no vino: se sirve nuestra Montserrat para que la referencia salga con su letra.
  const montserrat = readFileSync(path.join(RAIZ, 'contenido', fuentes.montserrat));
  // Las sustitutas también en la referencia, para que la «página completa» salga con la misma letra que la app.
  const porArchivo = Object.entries(sustitutas).map(([familia, s]) => [familia.replace(/\s+/g, '').toLowerCase(), readFileSync(path.join(RAIZ, 'contenido', s.archivo))]);
  const enrutarFuentes = (contexto) =>
    contexto.route('**/font/**', (ruta) => {
      const archivo = decodeURIComponent(ruta.request().url().split('/').pop() ?? '').toLowerCase();
      if (/montserrat/.test(archivo)) return ruta.fulfill({ body: montserrat, contentType: 'font/ttf' });
      const sustituta = porArchivo.find(([clave]) => archivo.startsWith(clave));
      return sustituta ? ruta.fulfill({ body: sustituta[1], contentType: 'font/ttf' }) : ruta.abort();
    });
  const ctxRef = await navegador.newContext({ viewport: { width: 1080, height: 1920 } });
  await enrutarFuentes(ctxRef);
  // Sin JS: el DOM tal como lo escribió InDesign, sin los cambios de su script.
  const ctxLimpio = await navegador.newContext({ viewport: { width: 1080, height: 1920 }, javaScriptEnabled: false });
  await enrutarFuentes(ctxLimpio);

  const imagenes = new Map(); // clave origen+tamaño → archivo webp
  const accionesVistas = new Set();
  const indice = [];
  let bytesImg = 0;

  const convertirImagen = async (origen, buffer, ancho, alto) => {
    const meta = await sharp(buffer).metadata();
    // Al tamaño al que se dibuja (nunca más grande que el original); 0×0 si el elemento no se ve: tamaño original.
    const w = ancho > 0 ? Math.min(meta.width, Math.ceil(ancho)) : meta.width;
    const h = alto > 0 ? Math.min(meta.height, Math.ceil(alto)) : meta.height;
    const clave = `${origen}|${w}x${h}`;
    if (imagenes.has(clave)) return imagenes.get(clave);
    const base = origen.startsWith('data:') ? `incrustada-${createHash('sha1').update(buffer).digest('hex').slice(0, 10)}` : slug(path.basename(origen));
    const nombre = `${base}-${w}x${h}.webp`;
    const datos = await sharp(buffer).resize(w, h, { fit: 'fill' }).webp({ quality: 84, alphaQuality: 90, effort: 5 }).toBuffer();
    writeFileSync(path.join(dirImg, nombre), datos);
    bytesImg += datos.length;
    imagenes.set(clave, nombre);
    return nombre;
  };

  for (const [indicePagina, archivo] of paginas.entries()) {
    const url = pathToFileURL(path.join(dirHtml, archivo)).href;
    const numero = String(indicePagina).padStart(2, '0');

    const t0 = Date.now();
    // 1. Referencia: el export original, con su script, ya terminada la animación de entrada.
    const ref = await ctxRef.newPage();
    await ref.goto(url, { waitUntil: 'load' });
    await Promise.race([ref.evaluate(() => document.fonts.ready), ref.waitForTimeout(3000)]);
    await ref.waitForTimeout(3500);
    // La referencia con las mismas correcciones que la app.
    for (const { pagina: p, elemento } of noMostrarAlCargar) if (p === archivo) await ref.evaluate((e) => document.getElementById(e)?.classList.add('_idGenStateHide'), elemento);
    await ref.screenshot({ path: path.join(dirRef, `pagina-${numero}.png`) });
    await ref.close();
    const tRef = Date.now() - t0;

    // 2. Estructura limpia.
    const pagina = await ctxLimpio.newPage();
    await pagina.goto(url, { waitUntil: 'load' });
    const extraido = await pagina.evaluate((atributosAccion) => {
      const cuerpo = document.body;
      const copia = cuerpo.cloneNode(true);
      // Para medir: todo visible y sin animación.
      const estilo = document.createElement('style');
      estilo.textContent = '*{animation:none!important;transition:none!important} ._idGenStateHide{display:block!important}';
      document.head.appendChild(estilo);
      for (const el of document.querySelectorAll('._idGenStateHide')) el.classList.remove('_idGenStateHide');
      const medidas = [...cuerpo.querySelectorAll('img')].map((img) => ({ src: img.getAttribute('src') ?? '', ancho: img.offsetWidth, alto: img.offsetHeight }));
      // Limpieza del fragmento.
      for (const s of copia.querySelectorAll('script')) s.remove();
      const acciones = [];
      for (const el of copia.querySelectorAll('*')) {
        for (const a of Array.from(el.attributes)) {
          if (a.name.startsWith('on')) el.removeAttribute(a.name);
          else if (atributosAccion.includes(a.name)) acciones.push(a.value);
        }
      }
      [...copia.querySelectorAll('img')].forEach((img, k) => img.setAttribute('src', `__IMG_${k}__`));
      const videos = [];
      for (const v of copia.querySelectorAll('video')) {
        const fuente = v.getAttribute('src') ?? v.querySelector('source')?.getAttribute('src') ?? '';
        for (const s of v.querySelectorAll('source')) s.remove();
        v.removeAttribute('src');
        v.removeAttribute('controls');
        v.setAttribute('data-src', `__VIDEO_${videos.length}__`);
        videos.push(fuente);
      }
      return { html: copia.innerHTML, estilo: cuerpo.getAttribute('style') ?? '', idCuerpo: cuerpo.id, medidas, videos, acciones };
    }, ATRIBUTOS_ACCION);
    await pagina.close();

    for (const texto of extraido.acciones) for (const m of texto.matchAll(/([A-Za-z_]\w*)\s*\(/g)) accionesVistas.add(m[1]);

    let html = extraido.html;
    const imagenesPagina = [];
    for (const [k, medida] of extraido.medidas.entries()) {
      const buffer = medida.src.startsWith('data:') ? Buffer.from(medida.src.split(',')[1], 'base64') : readFileSync(resolverNfc(dirHtml, decodeURI(medida.src)));
      const nombre = await convertirImagen(medida.src.startsWith('data:') ? medida.src.slice(0, 200) + buffer.length : medida.src, buffer, medida.ancho, medida.alto);
      html = html.replace(`__IMG_${k}__`, `contenido/catalogos/${id}/img/${nombre}`);
      if (!imagenesPagina.includes(`catalogos/${id}/img/${nombre}`)) imagenesPagina.push(`catalogos/${id}/img/${nombre}`);
    }
    const videosPagina = [];
    for (const [k, fuente] of extraido.videos.entries()) {
      const origen = resolverNfc(dirHtml, decodeURI(fuente));
      const nombre = `${slug(path.basename(origen))}.mp4`;
      const destino = path.join(dirVideo, nombre);
      // Sin audio (regla del motor) y con el arranque al principio del archivo para que empiece al instante.
      if (!existsSync(destino)) execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', origen, '-an', '-c:v', 'copy', '-movflags', '+faststart', destino]);
      html = html.replace(`__VIDEO_${k}__`, `contenido/catalogos/${id}/video/${nombre}`);
      videosPagina.push(`catalogos/${id}/video/${nombre}`);
    }
    const nombrePagina = `pagina-${numero}.html`;
    // Botón de inicio (la casa): va al selector de empresa, no a la portada del catálogo → goToDestination('inicio').
    if (imagenInicio) {
      const marcaImagen = `img/${slug(imagenInicio)}`;
      html = html.replace(/<div id="_idContainer\d+" class="_idGenButton[^"]*"[^>]*>[\s\S]*?(?=<div id="_idContainer\d+" class="_idGenButton|$)/g, (bloque) => {
        const [cabecera] = bloque.match(/^<div[^>]*>/) ?? [''];
        if (!bloque.includes(marcaImagen) || !cabecera.includes("goToDestination('publication.html')")) return bloque;
        return cabecera.replaceAll("goToDestination('publication.html')", "goToDestination('inicio')") + bloque.slice(cabecera.length);
      });
    }
    if (insertarLogo && insertarLogo.pagina === archivo) {
      const alto = Math.round((insertarLogo.ancho * insertarLogo.recorte[3]) / insertarLogo.recorte[2]);
      html += `\n<div class="logo-insertado" style="position:absolute;left:${insertarLogo.x}px;top:${insertarLogo.y}px;width:${insertarLogo.ancho}px;height:${alto}px"><img src="contenido/catalogos/${id}/img/logo-${id}.webp" alt="" style="display:block;width:100%;height:100%"></div>`;
    }
    // Correcciones del export: acciones mal copiadas en un botón (solo en ese botón).
    for (const { pagina: p, elemento, de, a } of corregirAcciones) {
      if (p !== archivo) continue;
      const antes = html;
      html = html.replace(new RegExp(`<div id="${elemento}"[^>]*>`), (cabecera) => cabecera.replaceAll(de, a));
      if (html === antes) throw new Error(`${id}: no encuentro «${de}» en ${elemento} de ${archivo}`);
    }
    // Correcciones del export: sin la acción que muestra el elemento al cargar (sigue oculto hasta que un botón lo abra).
    for (const { pagina: p, elemento } of noMostrarAlCargar) {
      if (p !== archivo) continue;
      const antes = html;
      html = html.replace(new RegExp(`(<div id="${elemento}"[^>]*?) data-animationonpageloadactions="[^"]*"`), '$1');
      if (html === antes) throw new Error(`${id}: no encuentro la animación de carga de ${elemento} en ${archivo}`);
    }
    writeFileSync(path.join(dirPaginas, nombrePagina), reescribirDestinos(html, archivo, indicePagina).trim() + '\n');
    indice.push({ archivo: `catalogos/${id}/paginas/${nombrePagina}`, origen: archivo, imagenes: imagenesPagina, videos: videosPagina });
    console.log(`  ${id} ${numero} ${archivo.padEnd(22)} ${imagenesPagina.length} img${videosPagina.length ? ` · ${videosPagina.length} video` : ''} · ${((Date.now() - t0) / 1000).toFixed(1)} s (referencia ${(tRef / 1000).toFixed(1)} s)`);
  }
  await navegador.close();

  const desconocidas = [...accionesVistas].filter((a) => !ACCIONES_CONOCIDAS.has(a) && a !== 'selfContainerID');
  if (desconocidas.length) throw new Error(`Acciones de InDesign sin interpretar: ${desconocidas.join(', ')}. Hay que añadirlas en src/marca/catalogo/acciones.ts`);

  // Logo recortado de una imagen del export (viene dentro de un fondo): el fondo casi blanco se vuelve transparente.
  if (insertarLogo) {
    const [rx, ry, rw, rh] = insertarLogo.recorte;
    const { data, info } = await sharp(resolverNfc(path.join(recursos, 'image'), insertarLogo.desde)).resize(1080, 1920, { fit: 'fill' }).extract({ left: rx, top: ry, width: rw, height: rh }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    // Color del logo: el píxel más oscuro; fondo: la media del borde del recorte. Cada píxel = mezcla de los dos → alfa.
    let oscuro = [255, 255, 255];
    const claro = [0, 0, 0];
    let bordes = 0;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * 3;
        if (data[i] + data[i + 1] + data[i + 2] < oscuro[0] + oscuro[1] + oscuro[2]) oscuro = [data[i], data[i + 1], data[i + 2]];
        if (x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1) {
          for (let c = 0; c < 3; c++) claro[c] += data[i + c];
          bordes++;
        }
      }
    }
    for (let c = 0; c < 3; c++) claro[c] /= bordes;
    const rgba = Buffer.alloc(info.width * info.height * 4);
    for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
      let alfa = 0;
      for (let c = 0; c < 3; c++) alfa = Math.max(alfa, (claro[c] - data[i + c]) / Math.max(1, claro[c] - oscuro[c]));
      // Restos del fondo (casi transparentes) fuera, y el resto reescalado.
      alfa = Math.min(1, Math.max(0, (alfa - 0.06) / 0.94));
      rgba[j] = oscuro[0]; rgba[j + 1] = oscuro[1]; rgba[j + 2] = oscuro[2]; rgba[j + 3] = Math.round(alfa * 255);
    }
    await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).resize(insertarLogo.ancho).webp({ quality: 90, alphaQuality: 95 }).toFile(path.join(dirImg, `logo-${id}.webp`));
  }

  // CSS: acotado, con las imágenes de fondo convertidas y nuestras fuentes.
  const cssOrigen = readFileSync(path.join(recursos, 'css', 'idGeneratedStyles.css'), 'utf8');
  const fondos = new Map();
  for (const m of cssOrigen.matchAll(/url\((["']?)(\.\.\/image\/[^"')]+)\1\)/g)) {
    const buffer = readFileSync(resolverNfc(path.join(recursos, 'css'), decodeURI(m[2])));
    fondos.set(m[2], await convertirImagen(m[2], buffer, 0, 0));
  }
  const conVariacion = (cuerpo) => {
    for (const [familia, s] of Object.entries(sustitutas)) {
      if (s.variacion && new RegExp(`font-family:\\s*"?${familia}"?`, 'i').test(cuerpo)) cuerpo += `\n\tfont-variation-settings:${s.variacion};`;
    }
    return cuerpo;
  };
  const css = acotarCss(cssOrigen, (cuerpo) => conVariacion(cuerpo.replace(/url\((["']?)(\.\.\/image\/[^"')]+)\1\)/g, (_, _c, ruta) => `url("img/${fondos.get(ruta)}")`)), id);
  const cara = (familia, archivo, peso) => `@font-face { font-family: "${familia}"; src: url("../../${archivo}") format("truetype"); ${peso ? `font-weight: ${peso}; ` : ''}font-display: block; }\n`;
  const caras =
    '/* Generado por ingesta/catalogo-indesign.mjs: no editar a mano. */\n' +
    cara('Montserrat Thin', fuentes.montserrat, '100 900') +
    Object.entries(sustitutas).map(([familia, s]) => `/* ${familia}: ${s.motivo} */\n` + cara(familia, s.archivo, s.peso)).join('');
  writeFileSync(path.join(salida, 'estilos.css'), caras + css);

  const catalogo = { version: 1, generado: 'ingesta/catalogo-indesign.mjs — no editar a mano', estilos: `catalogos/${id}/estilos.css`, paginas: indice };
  writeFileSync(path.join(salida, 'catalogo.json'), `${JSON.stringify(catalogo, null, 2)}\n`);
  console.log(`  ${id}: ${indice.length} páginas · ${imagenes.size} imágenes · ${(bytesImg / 1024 / 1024).toFixed(1)} MB`);
  return catalogo;
}
