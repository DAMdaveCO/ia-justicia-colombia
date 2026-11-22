/**
 * ORGANISM · Mini reproductor fijo.
 * Un IntersectionObserver vigila el reproductor principal: cuando el usuario
 * ya lo ha dejado ARRIBA (sigue leyendo las notas), aparece la barra fija.
 * Sin listeners de scroll: el observador no bloquea el hilo principal.
 *
 * Accesibilidad: mientras está oculto se marca `inert`, así ni el tabulador
 * ni los lectores de pantalla llegan a botones que no se ven.
 */
import { $ } from '../lib/dom.js';

export function initMiniPlayer() {
  const mini = $('[data-mini-player]');
  const target = $('#reproductor');
  if (!mini || !target || !('IntersectionObserver' in window)) return;

  const setVisible = (visible) => {
    mini.classList.toggle('is-visible', visible);
    mini.toggleAttribute('inert', !visible);
    document.body.classList.toggle('has-mini-player', visible);
  };

  new IntersectionObserver(([entry]) => {
    // Solo si el reproductor quedó por encima del viewport (no por debajo).
    setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
  }, { threshold: 0 }).observe(target);
}
