# IA y Justicia Colombiana — sitio del episodio

Sitio 100 % estático (HTML + CSS atómico + JS vanilla, sin dependencias) para Netlify.

## Comandos (Node ≥ 18)

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Build + servidor en http://127.0.0.1:8080 con las cabeceras de `netlify.toml` (CSP incluida) y soporte de Range para el audio |
| `npm run dev:lan` | Igual, accesible desde el móvil en tu Wi-Fi (para probar en iPhone/Android) |
| `npm test` | Pruebas anti-XSS del parser Markdown |
| `npm run build` | Genera `dist/` (lo ejecuta Netlify en cada despliegue) |

## Editar contenido

- Metadatos (título, URL, autor, descripción): `site.config.json`.
- Notas: `public/content/*.md`. Las marcas de tiempo `mm:ss` o `h:mm:ss` se vuelven clicables solas.
- Portadas: `public/assets/img/` (`og-image.jpg` 1200×630, `cover-*.jpg` cuadradas).

## Estructura

```
public/
  index.html                 plantilla de la página
  css/ tokens · base · atoms/ · molecules/ · organisms/ · templates/
  js/  main.js · lib/ (markdown seguro, formato, DOM) · molecules/ · organisms/
scripts/ build.mjs · serve.mjs · test-markdown.mjs
netlify.toml                 build + cabeceras de seguridad
```
