/**
 * MOLECULE · Toast. Mensajes breves con feedback visual y anuncio accesible.
 * El contenedor (role="status", aria-live="polite") ya existe en el HTML;
 * aquí solo se cambia su texto con textContent (nunca innerHTML).
 */
import { $ } from '../lib/dom.js';

let hideTimer;

export function showToast(message, { duration = 2800 } = {}) {
  const toast = $('[data-toast]');
  if (!toast) return;
  clearTimeout(hideTimer);
  // Vaciar y reescribir en el siguiente frame obliga a los lectores de
  // pantalla a anunciar de nuevo un mensaje idéntico (p. ej. copiar dos veces).
  toast.textContent = '';
  requestAnimationFrame(() => {
    toast.textContent = message;
    toast.classList.add('is-visible');
  });
  hideTimer = setTimeout(() => toast.classList.remove('is-visible'), duration);
}
