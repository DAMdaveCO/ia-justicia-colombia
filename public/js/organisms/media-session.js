/**
 * ORGANISM · Media Session API.
 * Muestra carátula, título y controles en la pantalla de bloqueo, el centro
 * de notificaciones de Android, el Centro de Control de iOS, relojes,
 * auriculares Bluetooth y teclas multimedia del teclado.
 *
 * - Las carátulas se dan en varios tamaños: cada sistema elige la que
 *   necesita (Android usa 512, iOS suele usar la más grande).
 * - Cada handler va en try/catch: los navegadores lanzan TypeError ante
 *   acciones que no soportan (p. ej. "seekto" en Safari antiguo) y no
 *   queremos que una acción no soportada impida registrar las demás.
 * - setPositionState permite que la barra de progreso del sistema sea
 *   exacta y arrastrable.
 */
export function initMediaSession(player, { title, artist, album }) {
  if (!('mediaSession' in navigator)) return;
  const { mediaSession } = navigator;
  const { audio } = player;
  const base = new URL('/assets/img/', window.location.href).href;

  mediaSession.metadata = new MediaMetadata({
    title,
    artist,
    album,
    artwork: [
      { src: `${base}cover-192.jpg`, sizes: '192x192', type: 'image/jpeg' },
      { src: `${base}cover-512.jpg`, sizes: '512x512', type: 'image/jpeg' },
      { src: `${base}cover-1024.jpg`, sizes: '1024x1024', type: 'image/jpeg' },
    ],
  });

  const handlers = {
    play: () => player.play(),
    pause: () => player.pause(),
    stop: () => { player.pause(); player.seek(0); },
    seekbackward: (details) => player.skip(-(details.seekOffset || 15)),
    seekforward: (details) => player.skip(details.seekOffset || 15),
    seekto: (details) => {
      // fastSeek es más rápido mientras se arrastra en la pantalla de bloqueo.
      if (details.fastSeek && 'fastSeek' in audio) audio.fastSeek(details.seekTime);
      else player.seek(details.seekTime);
    },
  };
  for (const [action, handler] of Object.entries(handlers)) {
    try { mediaSession.setActionHandler(action, handler); } catch { /* acción no soportada */ }
  }

  const updatePosition = () => {
    if (!('setPositionState' in mediaSession)) return;
    const duration = player.duration();
    if (!duration) return;
    try {
      mediaSession.setPositionState({
        duration,
        playbackRate: audio.playbackRate,
        position: Math.min(audio.currentTime, duration),
      });
    } catch { /* valores transitorios inválidos durante la carga */ }
  };

  audio.addEventListener('play', () => { mediaSession.playbackState = 'playing'; updatePosition(); });
  audio.addEventListener('pause', () => { mediaSession.playbackState = 'paused'; updatePosition(); });
  ['loadedmetadata', 'ratechange', 'seeked'].forEach((type) => audio.addEventListener(type, updatePosition));
}
