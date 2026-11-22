/**
 * ORGANISM · Reproductor de audio personalizado.
 * ---------------------------------------------------------------------------
 * Arquitectura:
 *  - UN solo <audio> es la fuente de verdad. Todos los botones con
 *    data-action (hero, tarjeta, mini reproductor, Media Session) llaman a la
 *    misma API, así nunca hay estados desincronizados.
 *  - El estado global se expone en <html data-playback="playing|paused">;
 *    el CSS reacciona a él (iconos, ecualizador, color del título).
 *  - El progreso se pinta con requestAnimationFrame mientras suena (60 fps
 *    suaves) en lugar de depender solo de `timeupdate` (~4 por segundo).
 *
 * Notas iOS Safari:
 *  - play() solo funciona dentro de un gesto del usuario: nunca autoplay.
 *  - audio.volume es de solo lectura (lo controla el hardware): se detecta y
 *    se oculta el slider de volumen.
 *  - Asignar currentTime antes de `loadedmetadata` puede ignorarse: se guarda
 *    un "seek pendiente" y se aplica cuando hay metadatos.
 *  - preload="metadata": iOS no descarga los 14 MB hasta que se pulsa play.
 */
import { $, $$, storage } from '../lib/dom.js';
import { clamp, formatTime, spokenTime } from '../lib/format.js';
import { showToast } from '../molecules/toast.js';

const RATES = [1, 1.25, 1.5, 2];
const SKIP_SECONDS = 15;
const KEY_STEP = 5;
const KEY_PAGE = 60;
const STORAGE_POS = 'iaj:position';
const STORAGE_RATE = 'iaj:rate';

export function createPlayer(audio) {
  const root = document.documentElement;
  const slider = $('[data-slider="seek"]');
  const tooltip = $('.slider__tooltip', slider);
  const announcer = $('[data-bind="announcer"]');
  const speedButton = $('[data-action="speed"]');
  const muteButton = $('[data-action="mute"]');
  const volumeInput = $('#volume');
  const miniProgress = $('.mini-player__progress');
  const fallbackDuration = Number(slider?.getAttribute('aria-valuemax')) || 0;

  let pendingSeek = null;     // seek solicitado antes de tener metadatos
  let isDragging = false;
  let rafId = 0;
  let lastSpokenSecond = -1;
  let lastSave = 0;

  const duration = () => (Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : fallbackDuration);
  const announce = (text) => { if (announcer) announcer.textContent = text; };

  /* ---------------------------------------------------------------------- */
  /* Pintado                                                                 */
  /* ---------------------------------------------------------------------- */
  function paint(time = audio.currentTime) {
    const total = duration();
    const ratio = total ? clamp(time / total, 0, 1) : 0;
    slider?.style.setProperty('--progress', ratio.toFixed(4));
    miniProgress?.style.setProperty('--progress', ratio.toFixed(4));
    const label = formatTime(time);
    $$('[data-bind="current"]').forEach((el) => { if (el.textContent !== label) el.textContent = label; });

    // ARIA: se actualiza una vez por segundo (no 60 veces) para no saturar
    // a los lectores de pantalla ni el árbol de accesibilidad.
    const second = Math.floor(time);
    if (slider && second !== lastSpokenSecond) {
      lastSpokenSecond = second;
      slider.setAttribute('aria-valuenow', String(second));
      slider.setAttribute('aria-valuetext', `${spokenTime(time)} de ${spokenTime(total)}`);
    }
  }

  function paintDuration() {
    const total = duration();
    slider?.setAttribute('aria-valuemax', String(Math.floor(total)));
    $$('[data-bind="duration"]').forEach((el) => { el.textContent = formatTime(total); });
  }

  function paintBuffer() {
    const total = duration();
    if (!slider || !total || !audio.buffered.length) return;
    const end = audio.buffered.end(audio.buffered.length - 1);
    slider.style.setProperty('--buffer', clamp(end / total, 0, 1).toFixed(4));
  }

  function loop() {
    if (!isDragging) paint();
    rafId = requestAnimationFrame(loop);
  }

  function setPlaybackState(playing) {
    root.dataset.playback = playing ? 'playing' : 'paused';
    const label = playing ? 'Pausar episodio' : 'Reproducir episodio';
    $$('[data-action="toggle"]').forEach((btn) => btn.setAttribute('aria-label', label));
    cancelAnimationFrame(rafId);
    if (playing) rafId = requestAnimationFrame(loop);
  }

  /* ---------------------------------------------------------------------- */
  /* API pública                                                             */
  /* ---------------------------------------------------------------------- */
  async function play() {
    try {
      await audio.play();
    } catch (error) {
      // NotAllowedError: el navegador bloqueó la reproducción sin gesto.
      if (error?.name === 'NotAllowedError') showToast('Pulsa el botón de reproducir para empezar');
      else if (error?.name !== 'AbortError') showToast('No se pudo reproducir el audio');
    }
  }
  const pause = () => audio.pause();
  const toggle = () => (audio.paused ? play() : pause());

  function seek(seconds, { autoplay = false } = {}) {
    const target = clamp(seconds, 0, duration() || seconds);
    if (audio.readyState >= 1) audio.currentTime = target;
    else pendingSeek = target;
    paint(target);
    if (autoplay && audio.paused) play();
  }
  const skip = (delta) => seek(audio.currentTime + delta);

  function setRate(rate) {
    audio.playbackRate = rate;
    // preservesPitch evita la "voz de ardilla" al acelerar (prefijo en Safari antiguo).
    if ('preservesPitch' in audio) audio.preservesPitch = true;
    else if ('webkitPreservesPitch' in audio) audio.webkitPreservesPitch = true;
    if (speedButton) {
      const text = `${rate}x`;
      speedButton.textContent = text;
      speedButton.dataset.rate = String(rate);
      speedButton.setAttribute('aria-label', `Velocidad de reproducción: ${text}. Pulsa para cambiar`);
    }
    storage.set(STORAGE_RATE, rate);
  }
  function cycleRate() {
    const next = RATES[(RATES.indexOf(audio.playbackRate) + 1) % RATES.length] ?? 1;
    setRate(next);
    announce(`Velocidad ${next}x`);
  }

  function setMuted(muted) {
    audio.muted = muted;
    muteButton?.setAttribute('aria-pressed', String(muted));
    muteButton?.setAttribute('aria-label', muted ? 'Activar sonido' : 'Silenciar');
  }

  /* ---------------------------------------------------------------------- */
  /* Eventos del <audio>                                                     */
  /* ---------------------------------------------------------------------- */
  audio.addEventListener('play', () => setPlaybackState(true));
  audio.addEventListener('pause', () => { setPlaybackState(false); paint(); savePosition(true); });
  audio.addEventListener('loadedmetadata', () => {
    paintDuration();
    if (pendingSeek !== null) { audio.currentTime = pendingSeek; pendingSeek = null; }
    paint();
  });
  audio.addEventListener('durationchange', paintDuration);
  audio.addEventListener('progress', paintBuffer);
  audio.addEventListener('seeked', () => { paint(); paintBuffer(); });
  audio.addEventListener('timeupdate', () => { if (audio.paused && !isDragging) paint(); savePosition(); });
  audio.addEventListener('ended', () => { storage.remove(STORAGE_POS); setPlaybackState(false); });
  audio.addEventListener('error', () => {
    setPlaybackState(false);
    showToast('No se pudo cargar el audio. Revisa tu conexión e inténtalo de nuevo.', { duration: 5000 });
  });

  /* ---------------------------------------------------------------------- */
  /* Persistencia: retomar donde se dejó                                     */
  /* ---------------------------------------------------------------------- */
  function savePosition(force = false) {
    const now = Date.now();
    if (!force && now - lastSave < 5000) return; // como mucho cada 5 s
    lastSave = now;
    if (audio.currentTime > 5) storage.set(STORAGE_POS, Math.floor(audio.currentTime));
  }
  // pagehide (no beforeunload): es el evento fiable en iOS y no desactiva la bfcache.
  window.addEventListener('pagehide', () => savePosition(true));

  /* ---------------------------------------------------------------------- */
  /* Botones (delegación: sirve para hero, tarjeta y mini reproductor)       */
  /* ---------------------------------------------------------------------- */
  document.addEventListener('click', (event) => {
    const control = event.target.closest('[data-action]');
    if (!control) return;
    switch (control.dataset.action) {
      case 'toggle': toggle(); break;
      case 'back': skip(-SKIP_SECONDS); announce('Retrocediste 15 segundos'); break;
      case 'forward': skip(SKIP_SECONDS); announce('Avanzaste 15 segundos'); break;
      case 'speed': cycleRate(); break;
      case 'mute': setMuted(!audio.muted); break;
      default: return; // otras acciones (compartir) las gestionan sus módulos
    }
  });

  /* ---------------------------------------------------------------------- */
  /* Slider de progreso: puntero (ratón, táctil, lápiz) + teclado            */
  /* ---------------------------------------------------------------------- */
  if (slider) {
    const ratioFromEvent = (event) => {
      const rect = slider.getBoundingClientRect();
      return clamp((event.clientX - rect.left) / rect.width, 0, 1);
    };

    // Pointer Events unifican ratón y táctil (iOS 13+). setPointerCapture
    // mantiene el arrastre aunque el dedo salga de la barra.
    slider.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      isDragging = true;
      slider.setPointerCapture(event.pointerId);
      slider.classList.add('is-dragging');
      const time = ratioFromEvent(event) * duration();
      paint(time);
      tooltip.textContent = formatTime(time);
      slider.style.setProperty('--hover', ratioFromEvent(event).toFixed(4));
    });
    slider.addEventListener('pointermove', (event) => {
      const ratio = ratioFromEvent(event);
      slider.style.setProperty('--hover', ratio.toFixed(4));
      tooltip.textContent = formatTime(ratio * duration());
      if (isDragging) paint(ratio * duration());
    });
    const endDrag = (event) => {
      if (!isDragging) return;
      isDragging = false;
      slider.classList.remove('is-dragging');
      seek(ratioFromEvent(event) * duration());
    };
    slider.addEventListener('pointerup', endDrag);
    slider.addEventListener('pointercancel', () => { isDragging = false; slider.classList.remove('is-dragging'); paint(); });
    slider.addEventListener('pointerenter', (event) => { if (event.pointerType === 'mouse') slider.classList.add('is-hovering'); });
    slider.addEventListener('pointerleave', () => slider.classList.remove('is-hovering'));

    // Teclado según el patrón "Slider" de WAI-ARIA APG.
    slider.addEventListener('keydown', (event) => {
      const steps = {
        ArrowRight: KEY_STEP, ArrowUp: KEY_STEP,
        ArrowLeft: -KEY_STEP, ArrowDown: -KEY_STEP,
        PageUp: KEY_PAGE, PageDown: -KEY_PAGE,
      };
      if (event.key in steps) skip(steps[event.key]);
      else if (event.key === 'Home') seek(0);
      else if (event.key === 'End') seek(duration() - 1);
      else return;
      event.preventDefault(); // evita que las flechas desplacen la página
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Volumen                                                                 */
  /* ---------------------------------------------------------------------- */
  // Detección real (no por user-agent): si el navegador ignora el cambio de
  // volumen, estamos en iOS/iPadOS y el control no tendría efecto.
  const probe = audio.volume;
  audio.volume = 0.5;
  const volumeLocked = audio.volume !== 0.5;
  audio.volume = probe;
  if (volumeLocked) root.classList.add('is-volume-locked');

  volumeInput?.addEventListener('input', () => {
    const value = Number(volumeInput.value);
    audio.volume = value / 100;
    volumeInput.style.setProperty('--value', String(value));
    volumeInput.setAttribute('aria-valuetext', `${value} %`);
    // Llevar el volumen a 0 equivale a silenciar (y subirlo, a reactivar).
    const shouldMute = value === 0;
    if (shouldMute !== audio.muted) setMuted(shouldMute);
  });

  /* ---------------------------------------------------------------------- */
  /* Atajos globales de teclado                                              */
  /* ---------------------------------------------------------------------- */
  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    // No interferir con campos de texto, ni con Espacio sobre controles
    // (Espacio ya activa botones, enlaces y casillas de forma nativa).
    if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
    const onControl = target.closest('button, a, summary, [role="slider"], [role="tab"]');
    switch (event.key.toLowerCase()) {
      case ' ':
        if (onControl) return;
        toggle(); break;
      case 'k': toggle(); break;
      case 'j': skip(-SKIP_SECONDS); break;
      case 'l': skip(SKIP_SECONDS); break;
      case 'm': setMuted(!audio.muted); break;
      default: return;
    }
    event.preventDefault();
  });

  /* ---------------------------------------------------------------------- */
  /* Estado inicial                                                          */
  /* ---------------------------------------------------------------------- */
  const savedRate = Number(storage.get(STORAGE_RATE));
  setRate(RATES.includes(savedRate) ? savedRate : 1);
  setPlaybackState(false);
  paintDuration();

  // Enlace profundo #t=SEGUNDOS (p. ej. compartido desde una marca de tiempo)
  // tiene prioridad sobre la posición guardada.
  const hashTime = /^#t=(\d+)$/.exec(window.location.hash);
  const saved = Number(storage.get(STORAGE_POS));
  if (hashTime) {
    seek(Number(hashTime[1]));
  } else if (saved > 10 && saved < fallbackDuration - 10) {
    seek(saved);
    showToast(`Retomamos donde lo dejaste: ${formatTime(saved)}`);
  }

  return { play, pause, toggle, seek, skip, setRate, duration, audio };
}
