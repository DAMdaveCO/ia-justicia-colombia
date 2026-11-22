/**
 * dom.js — Utilidades DOM compartidas: selección, almacenamiento seguro,
 * inserción de HTML con Trusted Types y efecto ripple.
 */

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

/* ------------------------------------------------------------------------ */
/* Trusted Types                                                             */
/* ------------------------------------------------------------------------ */
/**
 * La CSP declara `require-trusted-types-for 'script'`: en Chrome/Edge
 * cualquier asignación a innerHTML con un string plano lanza un error.
 * Solo existe UNA política permitida ("markdown") y solo se usa con la salida
 * de renderMarkdown(), que es segura por construcción (ver markdown.js).
 * Así, si alguien añade en el futuro un innerHTML con datos no saneados,
 * el navegador lo bloquea en vez de abrir un XSS.
 */
const policy = window.trustedTypes?.createPolicy?.('markdown', {
  createHTML: (html) => html,
});

/** Inserta HTML generado por renderMarkdown(). NO usar con otras fuentes. */
export function setRenderedMarkdown(element, html) {
  element.innerHTML = policy ? policy.createHTML(html) : html;
}

/* ------------------------------------------------------------------------ */
/* localStorage tolerante a fallos                                           */
/* ------------------------------------------------------------------------ */
/**
 * Safari en modo privado, cookies bloqueadas o cuota llena hacen que
 * localStorage lance excepciones. Todo acceso va envuelto en try/catch:
 * recordar la posición es una comodidad, nunca debe romper el reproductor.
 */
export const storage = {
  get(key) {
    try { return window.localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { window.localStorage.setItem(key, String(value)); } catch { /* sin persistencia */ }
  },
  remove(key) {
    try { window.localStorage.removeItem(key); } catch { /* sin persistencia */ }
  },
};

/* ------------------------------------------------------------------------ */
/* Ripple (microinteracción)                                                 */
/* ------------------------------------------------------------------------ */
/**
 * Un único listener delegado para todos los .btn (incluidos los que se creen
 * después). Las coordenadas se pasan como variables CSS con setProperty: la
 * CSP permite modificar estilos vía CSSOM, no mediante atributos style="".
 */
export function initRipple() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.addEventListener('pointerdown', (event) => {
    const button = event.target.closest('.btn');
    if (!button) return;
    const rect = button.getBoundingClientRect();
    button.style.setProperty('--ripple-x', `${event.clientX - rect.left}px`);
    button.style.setProperty('--ripple-y', `${event.clientY - rect.top}px`);
    button.classList.remove('is-rippling');
    void button.offsetWidth; // fuerza reflujo para reiniciar la animación
    button.classList.add('is-rippling');
  }, { passive: true });
  document.addEventListener('animationend', (event) => {
    if (event.animationName === 'ripple') event.target.classList.remove('is-rippling');
  });
}
