/**
 * ORGANISM · Notas del episodio.
 *  - Pestañas con el patrón ARIA "Tabs" (flechas, Inicio/Fin, roving tabindex).
 *  - Carga diferida: "Análisis de apps" y "Marco normativo" solo se piden la
 *    primera vez que se abren (ahorra datos en móvil).
 *  - El Markdown se convierte con el parser seguro y se inserta mediante la
 *    política Trusted Types "markdown".
 *  - Índice lateral regenerado por documento + resaltado de sección activa.
 *  - Marcas de tiempo clicables → saltan al segundo exacto del audio.
 */
import { $, $$, setRenderedMarkdown } from '../lib/dom.js';
import { renderMarkdown } from '../lib/markdown.js';
import { formatTime } from '../lib/format.js';
import { showToast } from '../molecules/toast.js';

/** Limita las rutas que se pueden cargar: solo .md propios en /content/. */
const ALLOWED_SRC = /^\/content\/[a-z0-9-]+\.md$/;

export function initNotes(player) {
  const tablist = $('[data-tabs]');
  const toc = $('[data-toc]');
  if (!tablist) return;
  tablist.hidden = false;
  const tabs = $$('[role="tab"]', tablist);
  const panelOf = (tab) => document.getElementById(tab.getAttribute('aria-controls'));

  /* ---------------------- Índice + scroll-spy ---------------------------- */
  let spy;
  function buildToc(panel) {
    if (!toc) return;
    const headings = $$('h3[id]', panel);
    toc.replaceChildren(...headings.map((h) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${h.id}`;
      a.textContent = h.textContent.replace(/^\d+(\.\d+)*\.?\s*/, ''); // sin "3.1."
      li.append(a);
      return li;
    }));
    spy?.disconnect();
    if (!('IntersectionObserver' in window)) return;
    // La sección "activa" es la que cruza la franja superior del viewport.
    spy = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        $$('a', toc).forEach((a) => a.toggleAttribute('aria-current', a.hash === `#${entry.target.id}`));
        $$('a[aria-current]', toc).forEach((a) => a.setAttribute('aria-current', 'true'));
      }
    }, { rootMargin: '0px 0px -70% 0px' });
    headings.forEach((h) => spy.observe(h));
  }

  // Al usar el índice, mover también el FOCO al encabezado (no solo el
  // scroll): así lectores de pantalla y teclado continúan desde ahí.
  toc?.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const heading = document.getElementById(link.hash.slice(1));
    if (!heading) return;
    event.preventDefault();
    heading.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    heading.focus({ preventScroll: true });
    history.replaceState(null, '', link.hash);
  });

  /* ---------------------- Carga diferida ---------------------------------- */
  async function ensureLoaded(panel) {
    const src = panel.dataset.src;
    if (!src || panel.dataset.loaded) return;
    if (!ALLOWED_SRC.test(src)) throw new Error(`Ruta no permitida: ${src}`);
    panel.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(src, { credentials: 'same-origin', headers: { Accept: 'text/markdown, text/plain' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const markdown = await response.text();
      const { html } = renderMarkdown(markdown, {
        maxSeconds: player.duration(),
        idPrefix: `${panel.dataset.doc}-`,
      });
      setRenderedMarkdown(panel, html);
      panel.dataset.loaded = 'true';
    } catch {
      // El enlace de respaldo (ya en el HTML) sigue disponible.
      showToast('No se pudo cargar el documento. Inténtalo de nuevo.');
    } finally {
      panel.removeAttribute('aria-busy');
    }
  }

  /* ---------------------- Pestañas (WAI-ARIA APG) ------------------------- */
  async function activate(tab, { focus = false } = {}) {
    for (const t of tabs) {
      const selected = t === tab;
      t.setAttribute('aria-selected', String(selected));
      t.tabIndex = selected ? 0 : -1; // roving tabindex: una sola parada de Tab
      panelOf(t).hidden = !selected;
    }
    if (focus) tab.focus();
    const panel = panelOf(tab);
    await ensureLoaded(panel);
    panel.classList.remove('is-entering');
    void panel.offsetWidth;
    panel.classList.add('is-entering');
    buildToc(panel);
  }

  tablist.addEventListener('click', (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (tab) activate(tab);
  });
  tablist.addEventListener('keydown', (event) => {
    const index = tabs.indexOf(document.activeElement);
    if (index < 0) return;
    const moves = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    activate(tabs[moves[event.key]], { focus: true });
  });

  /* ---------------------- Marcas de tiempo -------------------------------- */
  document.addEventListener('click', (event) => {
    const stamp = event.target.closest('a[data-seek]');
    if (!stamp) return;
    event.preventDefault();
    const seconds = Number(stamp.dataset.seek);
    player.seek(seconds, { autoplay: true });
    showToast(`Reproduciendo desde ${formatTime(seconds)}`);
  });

  buildToc(panelOf(tabs[0]));
}
