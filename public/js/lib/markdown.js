/**
 * markdown.js — Conversor Markdown → HTML seguro por construcción.
 * ---------------------------------------------------------------------------
 * POR QUÉ UN PARSER PROPIO (y no marked + DOMPurify):
 *  - El sitio es 100 % estático y sin dependencias: cero riesgo de cadena de
 *    suministro (supply chain) y nada que auditar fuera de este archivo.
 *  - Es ISOMÓRFICO: el mismo módulo se ejecuta en Node (scripts/build.mjs
 *    pre-renderiza las notas para SEO y para quien navega sin JS) y en el
 *    navegador (pestañas que se cargan bajo demanda).
 *
 * MODELO DE SEGURIDAD (anti-XSS):
 *  1. TODO el texto del .md se escapa (& < > " ') ANTES de aplicar formato.
 *     Por eso el HTML crudo dentro del .md se muestra como texto, nunca se
 *     interpreta: no existe una "lista negra" que se pueda evadir.
 *  2. Solo este código emite etiquetas, y solo de una lista blanca fija
 *     (h2-h6, p, ul, ol, li, blockquote, table…, strong, em, code, a, hr).
 *  3. Los enlaces solo aceptan esquemas seguros (https, http, mailto, #, /).
 *     `javascript:`, `data:`, `vbscript:` y similares se descartan.
 *  4. Los atributos que emitimos siempre van entre comillas dobles y con su
 *     contenido escapado, así que no se puede "romper" el atributo.
 *  5. Los marcadores internos usan caracteres del Área de Uso Privado de
 *     Unicode, que se eliminan de la entrada para impedir que un .md
 *     malicioso falsifique un marcador.
 *
 * Las pruebas de este contrato están en scripts/test-markdown.mjs.
 */

/* ------------------------------------------------------------------------ */
/* Utilidades de escape                                                      */
/* ------------------------------------------------------------------------ */

const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapa texto para insertarlo como contenido o como valor de atributo. */
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}

/* Delimitadores de marcadores (Área de Uso Privado: nunca aparecen en texto real). */
const PH_OPEN = '';
const PH_CLOSE = '';
const PH_PATTERN = /(\d+)/g;
const PRIVATE_USE = /[]/g;

/** Esquemas de URL permitidos en enlaces. Todo lo demás se descarta. */
const SAFE_URL = /^(https?:\/\/|mailto:|#|\/(?!\/))/i;

/**
 * Convierte "mm:ss" o "hh:mm:ss" a segundos.
 * @returns {number|null}
 */
export function timestampToSeconds(stamp) {
  const parts = stamp.split(':').map(Number);
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 2) {
    const [m, s] = parts;
    return s < 60 ? m * 60 + s : null;
  }
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return m < 60 && s < 60 ? h * 3600 + m * 60 + s : null;
  }
  return null;
}

/**
 * Crea un "slug" estable para los id de los encabezados (anclas y TOC).
 * Se normaliza el Unicode para quitar tildes: "Tutelatón" → "tutelaton".
 */
function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'seccion';
}

/* ------------------------------------------------------------------------ */
/* Inline: negrita, cursiva, código, enlaces y marcas de tiempo              */
/* ------------------------------------------------------------------------ */

/**
 * Renderiza formato en línea de forma segura.
 * Estrategia: los fragmentos que NO deben reprocesarse (código, enlaces) se
 * guardan en una tabla y se sustituyen por marcadores; el resto se escapa y
 * luego se formatea; al final se restauran los marcadores.
 */
function renderInline(raw, opts) {
  const store = [];
  const hold = (html) => `${PH_OPEN}${store.push(html) - 1}${PH_CLOSE}`;

  let text = raw.replace(PRIVATE_USE, '');

  // 1) Código en línea: su contenido es literal (sin negritas ni enlaces).
  text = text.replace(/`([^`]+)`/g, (_, code) => hold(`<code>${escapeHtml(code)}</code>`));

  // 2) Enlaces [texto](url). El texto admite formato; la URL se valida.
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
    const inner = renderInline(label, { ...opts, timestamps: false });
    if (!SAFE_URL.test(url)) return hold(inner); // URL peligrosa → solo texto
    const external = /^https?:\/\//i.test(url);
    // Enlaces externos: pestaña nueva + noopener/noreferrer (evita tabnabbing
    // y no filtra la URL de origen a terceros).
    const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
    const hint = external ? '<span class="visually-hidden"> (se abre en una pestaña nueva)</span>' : '';
    return hold(`<a href="${escapeHtml(url)}"${attrs}>${inner}${hint}</a>`);
  });

  // 3) Escapar TODO lo demás. A partir de aquí el texto es inerte.
  text = escapeHtml(text);

  // 4) Énfasis. Se aplica sobre texto ya escapado (los * no se escapan).
  text = text
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*(?=\S)([^*]*?\S)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_(?=\S)([^_]*?\S)_(?!\w)/g, '$1<em>$2</em>');

  // 5) Marcas de tiempo clicables (02:15, 1:02:15). Se excluyen horas del
  //    día ("6:00 a.m.") y tiempos mayores que la duración del audio.
  //    Nota: sin lookbehind (?<!) para compatibilidad con iOS < 16.4.
  if (opts.timestamps) {
    text = text.replace(
      /(^|[^\d:])((?:\d{1,2}:)?\d{1,2}:\d{2})(?![\d:])(?!\s*(?:a\.?\s?m|p\.?\s?m|h\b|hrs?\b|horas?\b))/gi,
      (match, lead, stamp) => {
        const seconds = timestampToSeconds(stamp);
        if (seconds === null || (opts.maxSeconds && seconds > opts.maxSeconds)) return match;
        return `${lead}<a class="timestamp" href="#t=${seconds}" data-seek="${seconds}" aria-label="Reproducir desde ${stamp}">${stamp}</a>`;
      },
    );
  }

  // 6) Restaurar marcadores (repetido por si hay anidación enlace→código).
  let prev;
  do {
    prev = text;
    text = text.replace(PH_PATTERN, (_, i) => store[Number(i)] ?? '');
  } while (text !== prev);
  return text;
}

/* ------------------------------------------------------------------------ */
/* Bloques                                                                   */
/* ------------------------------------------------------------------------ */

const RE = {
  heading: /^(#{1,6})\s+(.+?)\s*#*\s*$/,
  hr: /^\s{0,3}([-*_])(\s*\1){2,}\s*$/,
  quote: /^\s{0,3}>\s?(.*)$/,
  list: /^(\s*)([*+-]|\d{1,9}[.)])\s+(.*)$/,
  tableRow: /^\s*\|.*\|\s*$/,
  tableSep: /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/,
  blank: /^\s*$/,
};

function splitRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

/** Tabla accesible: scope en cabeceras, región desplazable con foco. */
function renderTable(lines, opts) {
  const head = splitRow(lines[0]);
  const align = splitRow(lines[1]).map((c) =>
    c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : '',
  );
  const cls = (i) => (align[i] ? ` class="align-${align[i]}"` : '');
  const th = head.map((c, i) => `<th scope="col"${cls(i)}>${renderInline(c, opts)}</th>`).join('');
  const rows = lines.slice(2).map((l) => {
    const cells = splitRow(l);
    // La primera celda funciona como cabecera de fila (lectores de pantalla
    // anuncian "Creador, Tamiz de Tutelas…" al moverse por la tabla).
    return `<tr>${head.map((_, i) => (i === 0
      ? `<th scope="row"${cls(i)}>${renderInline(cells[i] ?? '', opts)}</th>`
      : `<td${cls(i)}>${renderInline(cells[i] ?? '', opts)}</td>`)).join('')}</tr>`;
  }).join('');
  // tabindex=0 permite desplazar horizontalmente con teclado en móvil.
  return `<div class="table-wrap" role="region" aria-label="Tabla: ${escapeHtml(head.join(', ').replace(/\*/g, ''))}" tabindex="0"><table><thead><tr>${th}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

/**
 * Listas anidadas a partir de la sangría. Cada ítem: {indent, ordered, text}.
 * Se recorre con una pila de niveles abiertos.
 */
function renderList(items, opts) {
  let html = '';
  const stack = []; // [{indent, tag}]
  for (const item of items) {
    const tag = item.ordered ? 'ol' : 'ul';
    while (stack.length && item.indent < stack[stack.length - 1].indent) {
      html += `</li></${stack.pop().tag}>`;
    }
    const top = stack[stack.length - 1];
    if (!top || item.indent > top.indent) {
      const start = item.ordered && item.start !== 1 ? ` start="${item.start}"` : '';
      html += `<${tag}${start}>`;
      stack.push({ indent: item.indent, tag });
    } else {
      html += '</li>';
    }
    html += `<li>${renderInline(item.text, opts)}`;
  }
  while (stack.length) html += `</li></${stack.pop().tag}>`;
  return html;
}

/**
 * Convierte Markdown en HTML seguro.
 * @param {string} source
 * @param {object} [options]
 * @param {number} [options.headingOffset=1] Desplaza niveles (# → h2) para que
 *        la página conserve un único h1 (jerarquía correcta para lectores).
 * @param {boolean} [options.timestamps=true] Enlazar marcas de tiempo.
 * @param {number} [options.maxSeconds] Duración del audio (filtra tiempos).
 * @param {string} [options.idPrefix=''] Prefijo para ids únicos entre documentos.
 * @returns {{html: string, headings: Array<{level:number,id:string,text:string}>}}
 */
export function renderMarkdown(source, options = {}) {
  const opts = { headingOffset: 1, timestamps: true, idPrefix: '', ...options };
  const lines = String(source).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  const headings = [];
  const usedIds = new Set();
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (RE.blank.test(line)) { i += 1; continue; }

    // Encabezados
    const h = RE.heading.exec(line);
    if (h) {
      const level = Math.min(6, h[1].length + opts.headingOffset);
      const plain = h[2].replace(/[*_`]/g, '');
      let id = opts.idPrefix + slugify(plain);
      for (let n = 2; usedIds.has(id); n += 1) id = `${opts.idPrefix}${slugify(plain)}-${n}`;
      usedIds.add(id);
      headings.push({ level, id, text: plain });
      // tabindex=-1: el foco puede moverse al encabezado al navegar por el TOC.
      out.push(`<h${level} id="${escapeHtml(id)}" tabindex="-1">${renderInline(h[2], { ...opts, timestamps: false })}</h${level}>`);
      i += 1; continue;
    }

    // Separador horizontal (decorativo, pero con semántica de cambio de tema)
    if (RE.hr.test(line)) { out.push('<hr>'); i += 1; continue; }

    // Tablas: fila de cabecera + fila separadora
    if (RE.tableRow.test(line) && i + 1 < lines.length && RE.tableSep.test(lines[i + 1])) {
      const block = [];
      while (i < lines.length && RE.tableRow.test(lines[i])) block.push(lines[i++]);
      out.push(renderTable(block, opts));
      continue;
    }

    // Citas: se procesan recursivamente (pueden contener listas, etc.)
    if (RE.quote.test(line)) {
      const block = [];
      while (i < lines.length && RE.quote.test(lines[i])) block.push(RE.quote.exec(lines[i++])[1]);
      const inner = renderMarkdown(block.join('\n'), { ...opts, headingOffset: 6 }).html;
      out.push(`<blockquote>${inner}</blockquote>`);
      continue;
    }

    // Listas (con anidación por sangría y líneas de continuación)
    if (RE.list.test(line)) {
      const items = [];
      while (i < lines.length) {
        const m = RE.list.exec(lines[i]);
        if (m) {
          const ordered = /\d/.test(m[2]);
          items.push({ indent: m[1].replace(/\t/g, '    ').length, ordered, start: ordered ? parseInt(m[2], 10) : 1, text: m[3] });
          i += 1;
        } else if (!RE.blank.test(lines[i]) && /^\s+\S/.test(lines[i]) && items.length) {
          items[items.length - 1].text += ` ${lines[i].trim()}`; // continuación
          i += 1;
        } else break;
      }
      out.push(renderList(items, opts));
      continue;
    }

    // Párrafo: une líneas hasta un bloque distinto o línea vacía
    const para = [];
    while (
      i < lines.length && !RE.blank.test(lines[i]) && !RE.heading.test(lines[i]) &&
      !RE.hr.test(lines[i]) && !RE.quote.test(lines[i]) && !RE.list.test(lines[i]) &&
      !(RE.tableRow.test(lines[i]) && RE.tableSep.test(lines[i + 1] ?? ''))
    ) para.push(lines[i++].trim());
    out.push(`<p>${renderInline(para.join(' '), opts)}</p>`);
  }

  return { html: out.join('\n'), headings };
}
