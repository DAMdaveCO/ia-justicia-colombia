/**
 * build.mjs — Generador estático sin dependencias (solo Node ≥ 18).
 * ---------------------------------------------------------------------------
 * Netlify lo ejecuta en cada despliegue (ver netlify.toml). Hace:
 *  1. Copia public/ → dist/.
 *  2. Resuelve la URL absoluta del sitio. Open Graph EXIGE URLs absolutas: si
 *     og:image es relativa, WhatsApp y LinkedIn no muestran la imagen.
 *     Prioridad: SITE_URL (manual) > URL (la inyecta Netlify) > site.config.json
 *  3. Pre-renderiza notas.md con el MISMO parser seguro del navegador, de modo
 *     que el contenido existe en el HTML para SEO y sin JavaScript.
 *  4. Sustituye {{CLAVES}} escapando valores (defensa en profundidad: aunque
 *     el config sea nuestro, nunca concatenamos texto sin escapar en HTML).
 *  5. Concatena los CSS atómicos en un único main.css (sin cascada de @import,
 *     que en móvil añade viajes de red en serie y retrasa el primer pintado).
 *  6. Genera sitemap.xml, robots.txt y site.webmanifest con la URL final.
 */
import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderMarkdown, escapeHtml } from '../public/js/lib/markdown.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'public');
const OUT = join(ROOT, 'dist');

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const humanDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
};
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Resuelve @import recursivamente para generar un único CSS. */
async function bundleCss(file, seen = new Set()) {
  if (seen.has(file)) return '';
  seen.add(file);
  const css = await readFile(file, 'utf8');
  const parts = [];
  let last = 0;
  for (const m of css.matchAll(/@import\s+(?:url\()?['"]([^'"]+)['"]\)?\s*;/g)) {
    parts.push(css.slice(last, m.index), await bundleCss(join(dirname(file), m[1]), seen));
    last = m.index + m[0].length;
  }
  parts.push(css.slice(last));
  return parts.join('');
}

/** Minificación prudente: quita comentarios y espacios redundantes. */
const minifyCss = (css) => css
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ')
  // No tocamos ":" para no fusionar ".a :focus" (descendiente) en ".a:focus".
  .replace(/\s*([{};,>])\s*/g, '$1')
  .replace(/;}/g, '}')
  .trim();

export async function build({ siteUrl: forcedUrl, quiet = false } = {}) {
  const config = JSON.parse(await readFile(join(ROOT, 'site.config.json'), 'utf8'));
  const siteUrl = (forcedUrl || process.env.SITE_URL || process.env.URL || config.fallbackSiteUrl).replace(/\/+$/, '');
  if (!/^https?:\/\//.test(siteUrl)) throw new Error(`URL de sitio inválida: ${siteUrl}`);
  const pageUrl = `${siteUrl}/`;

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  // Copia todo salvo la plantilla y los CSS fuente (se procesan abajo).
  await cp(SRC, OUT, {
    recursive: true,
    filter: (src) => !src.endsWith(`${join('public', 'index.html')}`) && !/[\\/]css[\\/](atoms|molecules|organisms|templates|tokens|base)/.test(src),
  });

  // --- CSS -----------------------------------------------------------------
  const css = minifyCss(await bundleCss(join(SRC, 'css', 'main.css')));
  await writeFile(join(OUT, 'css', 'main.css'), css);

  // --- Notas pre-renderizadas ---------------------------------------------
  const notesMd = await readFile(join(SRC, 'content', 'notas.md'), 'utf8');
  const notes = renderMarkdown(notesMd, { maxSeconds: config.durationSeconds, idPrefix: 'notas-' });
  const toc = notes.headings
    .filter((h) => h.level === 3)
    .map((h) => `<li><a href="#${escapeHtml(h.id)}">${escapeHtml(h.text.replace(/^\d+\.\s*/, ''))}</a></li>`)
    .join('\n');

  // --- JSON-LD (Schema.org PodcastEpisode) --------------------------------
  const durationIso = `PT${Math.floor(config.durationSeconds / 60)}M${config.durationSeconds % 60}S`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'PodcastEpisode',
    '@id': `${pageUrl}#episodio`,
    url: pageUrl,
    name: config.episodeTitle,
    episodeNumber: config.episodeNumber,
    description: config.longDescription,
    abstract: config.shortDescription,
    datePublished: config.datePublished,
    inLanguage: config.lang,
    timeRequired: durationIso,
    image: `${siteUrl}${config.ogImagePath}`,
    keywords: 'inteligencia artificial, justicia, Colombia, tutela, Claude Code, litigio, contratación pública, legal tech',
    associatedMedia: {
      '@type': 'MediaObject',
      contentUrl: `${siteUrl}${config.audioPath}`,
      encodingFormat: config.audioMime,
      duration: durationIso,
    },
    partOfSeries: { '@type': 'PodcastSeries', name: config.seriesName, url: pageUrl },
    author: { '@type': 'Person', name: config.authorName, url: config.authorUrl },
    about: {
      '@type': 'Event',
      name: 'IA, Estado, justicia y litigio',
      startDate: config.eventDate,
      location: { '@type': 'Place', name: 'Instituto Colombiano de Derecho Procesal (ICDP)', address: 'Bogotá, Colombia' },
    },
  };
  // Escapar "<" impide que un valor cierre la etiqueta </script> (inyección).
  const jsonLdSafe = JSON.stringify(jsonLd).replace(/</g, '\\u003c');

  // --- Enlaces para compartir (absolutos; funcionan sin JS) ---------------
  const shareText = `🎧 ${config.episodeTitle} — ${config.seriesName}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${pageUrl}`)}`;
  const linkedin = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`;

  // --- Versión para invalidar caché del CSS/JS ----------------------------
  const version = createHash('sha256').update(css).update(await readFile(join(SRC, 'js', 'main.js'))).update(notesMd)
    .digest('hex').slice(0, 10);

  const values = {
    LANG: config.lang,
    LOCALE: config.locale,
    TITLE_FULL: `${config.episodeTitle} | ${config.seriesName}`,
    EPISODE_TITLE: config.episodeTitle,
    EPISODE_NUMBER: config.episodeNumber,
    SERIES: config.seriesName,
    DESCRIPTION: config.shortDescription,
    LONG_DESCRIPTION: config.longDescription,
    AUTHOR: config.authorName,
    AUTHOR_URL: config.authorUrl,
    COMMUNITY: config.communityName,
    COMMUNITY_URL: config.communityUrl,
    PAGE_URL: pageUrl,
    OG_IMAGE: `${siteUrl}${config.ogImagePath}`,
    OG_IMAGE_ALT: config.ogImageAlt,
    AUDIO_URL: `${siteUrl}${config.audioPath}`,
    AUDIO_PATH: config.audioPath,
    AUDIO_MIME: config.audioMime,
    THEME_COLOR: config.themeColor,
    DATE_ISO: config.datePublished,
    DATE_HUMAN: humanDate(config.datePublished),
    EVENT_DATE_HUMAN: humanDate(config.eventDate),
    DURATION_ISO: durationIso,
    DURATION_SECONDS: config.durationSeconds,
    DURATION_CLOCK: clock(config.durationSeconds),
    DURATION_HUMAN: `${Math.round(config.durationSeconds / 60)} min`,
    DURATION_TEXT: `${Math.floor(config.durationSeconds / 60)} minutos ${config.durationSeconds % 60} segundos`,
    WHATSAPP_SHARE: whatsapp,
    LINKEDIN_SHARE: linkedin,
    BUILD: version,
    YEAR: config.datePublished.slice(0, 4),
  };
  const raw = { NOTES_HTML: notes.html, TOC_HTML: toc, JSON_LD: jsonLdSafe };

  let html = await readFile(join(SRC, 'index.html'), 'utf8');
  html = html.replace(/\{\{\{(\w+)\}\}\}/g, (_, k) => {
    if (!(k in raw)) throw new Error(`Clave HTML sin definir: ${k}`);
    return raw[k];
  });
  html = html.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!(k in values)) throw new Error(`Clave sin definir: ${k}`);
    return escapeHtml(values[k]);
  });
  await writeFile(join(OUT, 'index.html'), html);

  // --- Archivos auxiliares de SEO / PWA ------------------------------------
  await writeFile(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /content/\n\nSitemap: ${siteUrl}/sitemap.xml\n`);
  await writeFile(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${escapeHtml(pageUrl)}</loc><lastmod>${config.datePublished}</lastmod></url>
</urlset>
`);
  await writeFile(join(OUT, 'site.webmanifest'), JSON.stringify({
    name: config.seriesName,
    short_name: 'IA y Justicia',
    lang: config.lang,
    start_url: '/',
    display: 'standalone',
    background_color: '#121212',
    theme_color: config.themeColor,
    icons: [
      { src: '/assets/img/cover-192.jpg', sizes: '192x192', type: 'image/jpeg' },
      { src: '/assets/img/cover-512.jpg', sizes: '512x512', type: 'image/jpeg' },
    ],
  }, null, 2));

  if (!quiet) console.log(`✔ Build listo en dist/  ·  URL: ${pageUrl}  ·  v=${version}`);
  return { siteUrl, outDir: OUT };
}

// Ejecutable directo: `node scripts/build.mjs`
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  build().catch((err) => { console.error('✖ Error de build:', err); process.exit(1); });
}
