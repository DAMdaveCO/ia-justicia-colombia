/**
 * main.js — Punto de entrada (página). Ensambla los organismos.
 *
 * Se carga con <script type="module">, que:
 *  - se difiere automáticamente (no bloquea el renderizado del HTML),
 *  - corre en modo estricto,
 *  - y no se ejecuta en navegadores muy antiguos, que se quedan con la
 *    experiencia sin JS (reproductor nativo + contenido completo).
 */
import { $, initRipple } from './lib/dom.js';
import { createPlayer } from './organisms/player.js';
import { initMediaSession } from './organisms/media-session.js';
import { initMiniPlayer } from './organisms/mini-player.js';
import { initNotes } from './organisms/notes.js';
import { initShare } from './molecules/share.js';

// Mejora progresiva: a partir de aquí los controles propios son funcionales.
document.documentElement.classList.replace('no-js', 'js');

const audio = $('#episode-audio');
if (audio) {
  const player = createPlayer(audio);
  initMediaSession(player, {
    title: $('#episode-title')?.textContent.trim() ?? document.title,
    artist: 'Inteligencia Artificial y Justicia Colombiana',
    album: 'Podcast · Estado, justicia y litigio',
  });
  initMiniPlayer();
  initNotes(player);
}
initShare();
initRipple();
