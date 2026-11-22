/**
 * test-markdown.mjs — Pruebas del contrato de seguridad del parser Markdown.
 * Ejecutar:  node scripts/test-markdown.mjs   (o npm test)
 * Usa el runner nativo de Node (node:test), sin dependencias.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, timestampToSeconds } from '../public/js/lib/markdown.js';

const md = (s, o) => renderMarkdown(s, o).html;

test('el HTML crudo se escapa, nunca se interpreta', () => {
  const out = md('<script>alert(1)</script> <img src=x onerror=alert(1)>');
  assert.ok(!out.includes('<script'), out);
  assert.ok(!out.includes('<img'), out);
  assert.ok(out.includes('&lt;script&gt;'));
});

test('esquemas peligrosos en enlaces se descartan', () => {
  for (const url of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<b>x</b>', 'vbscript:x', '//evil.com']) {
    const out = md(`[clic](${url})`);
    assert.ok(!out.includes('href'), `${url} → ${out}`);
    assert.ok(out.includes('clic'));
  }
});

test('no se puede romper el atributo href', () => {
  const out = md('[x](https://a.com/"onmouseover="alert(1))');
  assert.ok(!/href="[^"]*"onmouseover/.test(out), out);
});

test('enlaces externos llevan noopener noreferrer', () => {
  const out = md('[Claude Colombia](https://claudecolombia.com)');
  assert.match(out, /rel="noopener noreferrer"/);
  assert.match(out, /target="_blank"/);
});

test('los marcadores internos no se pueden falsificar', () => {
  const out = md('0 `<b>`');
  assert.ok(!out.includes('<b>'), out);
});

test('el código en línea es literal', () => {
  assert.match(md('`**no**`'), /<code>\*\*no\*\*<\/code>/);
});

test('marcas de tiempo clicables, excepto horas del día', () => {
  const out = md('Ver 02:15 y 1:02:03. Filas desde las 6:00 a.m.', { maxSeconds: 4000 });
  assert.match(out, /data-seek="135"/);
  assert.match(out, /data-seek="3723"/);
  assert.ok(!out.includes('data-seek="360"'), out);
});

test('marcas de tiempo fuera de la duración no se enlazan', () => {
  assert.ok(!md('Minuto 45:00', { maxSeconds: 1136 }).includes('data-seek'));
  assert.equal(timestampToSeconds('02:75'), null);
});

test('jerarquía: # se convierte en h2 y los ids son únicos', () => {
  const { html, headings } = renderMarkdown('# A\n## B\n## B');
  assert.match(html, /<h2 id="a"/);
  assert.deepEqual(headings.map((h) => h.id), ['a', 'b', 'b-2']);
});

test('listas anidadas, tablas y citas', () => {
  const out = md('* uno\n  1. a\n  2. b\n* dos\n\n| A | B |\n| :--- | ---: |\n| x | y |\n\n> cita');
  assert.match(out, /<ul><li>uno<ol><li>a<\/li><li>b<\/li><\/ol><\/li><li>dos<\/li><\/ul>/);
  assert.match(out, /<th scope="col">A<\/th>/);
  assert.match(out, /<td class="align-right">y<\/td>/);
  assert.match(out, /<blockquote><p>cita<\/p><\/blockquote>/);
});
