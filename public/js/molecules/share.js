/**
 * MOLECULE · Compartir.
 * WhatsApp y LinkedIn son enlaces normales generados en el build (funcionan
 * sin JS). Aquí se añaden:
 *  - "Copiar enlace" con Clipboard API + respaldo para navegadores antiguos.
 *  - "Más opciones" con Web Share API (hoja nativa de Android/iOS), solo si
 *    el navegador la soporta.
 */
import { $ } from '../lib/dom.js';
import { showToast } from './toast.js';

/** Respaldo para Safari < 13.1 / contextos sin Clipboard API. */
function legacyCopy(text) {
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');      // evita que iOS abra el teclado
  field.className = 'visually-hidden';
  document.body.append(field);
  field.select();
  field.setSelectionRange(0, text.length); // necesario en iOS
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  field.remove();
  return ok;
}

async function copyLink(button) {
  const url = button.dataset.url || window.location.href;
  let ok = false;
  try {
    await navigator.clipboard.writeText(url);
    ok = true;
  } catch {
    ok = legacyCopy(url);
  }
  if (!ok) {
    showToast('No se pudo copiar. Mantén pulsada la barra de direcciones para copiar el enlace.');
    return;
  }
  const label = $('[data-label]', button);
  button.classList.add('is-done');
  if (label) label.textContent = '¡Copiado!';
  showToast('Enlace copiado al portapapeles');
  setTimeout(() => {
    button.classList.remove('is-done');
    if (label) label.textContent = 'Copiar enlace';
  }, 2200);
}

export function initShare() {
  const copyButton = $('[data-action="copy-link"]');
  copyButton?.addEventListener('click', () => copyLink(copyButton));

  const nativeButton = $('[data-action="native-share"]');
  if (nativeButton && typeof navigator.share === 'function') {
    nativeButton.hidden = false;
    nativeButton.addEventListener('click', async () => {
      try {
        await navigator.share({
          title: document.title,
          text: $('meta[name="description"]')?.content ?? '',
          url: copyButton?.dataset.url || window.location.href,
        });
      } catch (error) {
        // AbortError = el usuario cerró la hoja: no es un error real.
        if (error?.name !== 'AbortError') showToast('No se pudo abrir el menú de compartir');
      }
    });
  }
}
