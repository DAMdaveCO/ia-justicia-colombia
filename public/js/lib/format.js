/**
 * format.js — Formateo de tiempos (visual y hablado).
 */

/** 75.4 → "1:15" · 3725 → "1:02:05". Valores no finitos → "0:00". */
export function formatTime(seconds) {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/**
 * Versión hablada para aria-valuetext: un lector de pantalla leería "3:20"
 * como "tres dos puntos veinte"; "3 minutos 20 segundos" es comprensible.
 */
export function spokenTime(seconds) {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const parts = [];
  if (m) parts.push(`${m} ${m === 1 ? 'minuto' : 'minutos'}`);
  if (sec || !m) parts.push(`${sec} ${sec === 1 ? 'segundo' : 'segundos'}`);
  return parts.join(' ');
}

/** Limita un número al rango [min, max]. */
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
