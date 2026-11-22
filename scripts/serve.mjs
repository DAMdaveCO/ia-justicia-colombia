/**
 * serve.mjs — Servidor local de pruebas, sin dependencias.
 * ---------------------------------------------------------------------------
 *  1. Ejecuta el build con SITE_URL=http://localhost:PUERTO (las etiquetas OG
 *     apuntan a tu máquina para poder inspeccionarlas).
 *  2. Sirve dist/ con:
 *     - Peticiones Range (206 Partial Content): IMPRESCINDIBLE para que Safari
 *       iOS reproduzca audio y para saltar a cualquier minuto.
 *     - Las MISMAS cabeceras definidas en netlify.toml (CSP incluida), leídas
 *       de ese archivo: si algo viola la CSP, lo verás aquí antes que en
 *       producción.
 *
 * Uso:  node scripts/serve.mjs  [--port 8080] [--host 0.0.0.0]
 *       --host 0.0.0.0 permite abrirlo desde tu móvil en la misma red Wi-Fi.
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const PORT = Number(arg('port', process.env.PORT || 8080));
const HOST = arg('host', '127.0.0.1');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
};

/**
 * Lector mínimo de los bloques [[headers]] de netlify.toml.
 * Soporta: for = "...", Clave = "valor" y cadenas multilínea """ con
 * continuación de línea "\" (la sintaxis que usamos para la CSP).
 */
async function loadNetlifyHeaders(file) {
  const toml = await readFile(file, 'utf8');
  const rules = [];
  for (const block of toml.split(/^\s*\[\[headers\]\]\s*$/m).slice(1)) {
    const body = block.split(/^\s*\[(?!headers\.values)[^\]]+\]\s*$/m)[0];
    const path = /^\s*for\s*=\s*"([^"]+)"/m.exec(body)?.[1];
    if (!path) continue;
    const values = {};
    const re = /^\s*([A-Za-z0-9-]+)\s*=\s*("""([\s\S]*?)"""|"([^"]*)")/gm;
    for (const m of body.matchAll(re)) {
      values[m[1]] = m[3] !== undefined
        ? m[3].replace(/\\\r?\n\s*/g, '').trim() // continuación de línea TOML
        : m[4];
    }
    const pattern = new RegExp(`^${path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
    rules.push({ pattern, values });
  }
  return rules;
}

const ROOT_DIR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const siteUrl = `http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`;
const { outDir } = await build({ siteUrl, quiet: true });
const headerRules = await loadNetlifyHeaders(join(ROOT_DIR, 'netlify.toml'));

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, siteUrl);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';

    // Anti path traversal: la ruta resuelta debe quedar dentro de dist/.
    const filePath = normalize(join(outDir, pathname));
    if (!filePath.startsWith(outDir + sep)) { res.writeHead(403).end('Prohibido'); return; }

    let info;
    try { info = await stat(filePath); } catch { info = null; }
    if (!info?.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 · No encontrado');
      return;
    }

    // Cabeceras de netlify.toml que aplican a esta ruta (en orden).
    const headers = { 'Content-Type': MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream' };
    for (const rule of headerRules) if (rule.pattern.test(url.pathname)) Object.assign(headers, rule.values);
    delete headers['Strict-Transport-Security']; // HSTS no tiene sentido en http://localhost
    headers['Accept-Ranges'] = 'bytes';

    // Range: "bytes=inicio-fin"
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
    if (range) {
      let start = range[1] === '' ? info.size - Number(range[2]) : Number(range[1]);
      let end = range[1] !== '' && range[2] !== '' ? Number(range[2]) : info.size - 1;
      end = Math.min(end, info.size - 1);
      if (start > end || start < 0) {
        res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end();
        return;
      }
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${info.size}`, 'Content-Length': end - start + 1 });
      if (req.method === 'HEAD') { res.end(); return; }
      createReadStream(filePath, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, { ...headers, 'Content-Length': info.size });
    if (req.method === 'HEAD') { res.end(); return; }
    createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error(error);
    res.writeHead(500).end('Error interno');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n  🎧  Sitio local:  ${siteUrl}`);
  if (HOST === '0.0.0.0') {
    const ips = Object.values(networkInterfaces()).flat().filter((n) => n?.family === 'IPv4' && !n.internal);
    ips.forEach((n) => console.log(`  📱  Desde el móvil: http://${n.address}:${PORT}`));
  }
  console.log('  Cabeceras de netlify.toml aplicadas (CSP incluida). Ctrl+C para salir.\n');
});
