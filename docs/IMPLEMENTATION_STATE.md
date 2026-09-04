# Estado de implementación

- Fecha: 2026-09-04
- Fase/lote: SETUP-0.1
- Estado: COMPLETADO AL PUBLICARSE ESTE CIERRE DOCUMENTAL
- Rama: `develop`
- Commit/base: `880610411ecb4d66f652e8bfaf89e5794231409d`
- Último commit ejecutable probado: `aee0a6c5ae0a7ec13772abf087797c0f0b0d6887`
- Preview/evidencia: NO CONFIGURADA
- Production: INTACTA
- Bloqueadores: Ninguno
- Decisiones nuevas: Ninguna; se aplicaron exclusivamente las decisiones fijadas en el encargo.
- Siguiente lote: SETUP-0.2

## Cambios realizados

- Scaffold mínimo de Eleventy con motores Nunjucks preparado sin migrar páginas públicas.
- Copia passthrough explícita de la superficie pública existente.
- Limpieza segura de `_site/` y QA automatizada de paridad contra el commit base.
- Versiones fijadas de Node, Eleventy y Nunjucks.
- Primer commit ejecutable publicado y verificado en `origin/develop`.

## Archivos afectados

- Archivos creados: `.gitignore`, `.node-version`, `package.json`, `package-lock.json`, `eleventy.config.js`, `config/public-surface.js`, `scripts/clean.mjs`, `scripts/verify-setup-parity.mjs`, `src/_data/.gitkeep`, `src/_includes/layouts/base.njk`, `src/_includes/partials/.gitkeep`, `docs/IMPLEMENTATION_STATE.md`.
- Archivos existentes antes del lote modificados: Ninguno.
- Archivos eliminados: Ninguno.
- Cierre documental: únicamente `docs/IMPLEMENTATION_STATE.md` fue actualizado después del primer push.

## Pruebas

- Preflight: PASS. Repositorio `SolazStudio/solazstudio-web`, rama inicial `main`, working tree limpio, `main` local y `origin/main` en `880610411ecb4d66f652e8bfaf89e5794231409d`, `develop` ausente local y remotamente, Node `v24.18.0`.
- `node --version`: PASS (`v24.18.0`).
- `npm ci`: PASS.
- `npm run build`: PASS (Eleventy `3.1.5`; 766 archivos copiados y 0 páginas transformadas).
- `npm run qa:setup`: PASS final (24/24 HTML y 766 archivos públicos verificados). La primera ejecución detectó un error de normalización de rutas en el verificador nuevo; se corrigió únicamente ese archivo autorizado y se repitió la prueba afectada.
- `node --check functions/api/contact.js`: PASS.
- `git diff --exit-code 880610411ecb4d66f652e8bfaf89e5794231409d -- functions`: PASS.
- Diff de HTML, `proyectos/`, `img/`, `robots.txt`, `sitemap.xml`, favicons y `og-image.jpg` contra el baseline: PASS, sin cambios.
- `git diff --check` y `git diff --cached --check`: PASS.
- Primer push: PASS; `origin/develop` verificado en `aee0a6c5ae0a7ec13772abf087797c0f0b0d6887` antes del cierre documental.

## Pendientes

- Ejecutar SETUP-0.2 únicamente como lote posterior independiente.
- En SETUP-0.3, aplicar la estrategia de aislamiento de Preview que se apruebe.

## Prohibiciones vigentes

- No modificar, publicar ni fusionar `main`; no actuar sobre Production, Cloudflare, DNS ni Ads.
- No migrar páginas públicas a Nunjucks durante SETUP-0.1.
- Para SETUP-0.3, Preview deberá quedar aislada de D1 Production, CONTACT_QUEUE Production, correo/Web3Forms real, Turnstile y secretos reales según la estrategia que se apruebe, analítica, Ads y otras integraciones que puedan contaminar Production.

## INFORME CODEX — ÚLTIMO LOTE

- Lote: SETUP-0.1
- Fecha: 2026-09-04
- Trabajo realizado: Scaffold mínimo Eleventy/Nunjucks, passthrough explícito de la superficie pública, build reproducible, limpieza segura y QA de paridad contra el baseline.
- Archivos creados: `.gitignore`, `.node-version`, `package.json`, `package-lock.json`, `eleventy.config.js`, `config/public-surface.js`, `scripts/clean.mjs`, `scripts/verify-setup-parity.mjs`, `src/_data/.gitkeep`, `src/_includes/layouts/base.njk`, `src/_includes/partials/.gitkeep`, `docs/IMPLEMENTATION_STATE.md`.
- Archivos modificados: Solo `docs/IMPLEMENTATION_STATE.md` para el cierre posterior al primer push; ningún archivo preexistente al lote fue modificado.
- Archivos eliminados: Ninguno.
- Decisiones técnicas aplicadas: Node `24.18.0`, Eleventy `3.1.5`, Nunjucks `3.2.4`, entrada `src`, salida `_site`, motores `njk`, passthrough explícito y baseline fijo autorizado.
- Comandos ejecutados: preflight Git/Node; `git switch -c develop 880610411ecb4d66f652e8bfaf89e5794231409d`; `npm install`; `node --version`; `npm ci`; `npm run build`; `npm run qa:setup`; `node --check functions/api/contact.js`; verificaciones Git de paridad; control completo del diff staged; primer commit, push y verificación remota.
- Pruebas ejecutadas: versión Node, instalación limpia, build, QA de paridad, sintaxis backend, diffs contra baseline y controles del diff.
- Resultado de cada prueba: Node PASS; `npm ci` PASS; build PASS; QA final PASS (24/24 HTML, 766 archivos); backend PASS; fuentes públicas y `functions/` sin diff; controles del diff PASS.
- Errores: El primer acceso remoto del preflight fue bloqueado por el sandbox y se repitió con autorización, con resultado PASS. La primera QA reveló un error de normalización en el script nuevo, corregido dentro del alcance; la repetición afectada pasó.
- Limitaciones: Preview no configurada; QA visual fuera del alcance del lote.
- Desviaciones respecto del encargo: Ninguna.
- Commit ejecutable probado: `aee0a6c5ae0a7ec13772abf087797c0f0b0d6887`.
- Push realizado: Primer push a `origin/develop` realizado y verificado; este cierre documental corresponde al segundo y último commit/push autorizado.
- Working tree: Limpio después del primer push; al cierre solo se incorpora esta actualización documental y se verifica nuevamente tras publicarla.
- Criterio de cierre: Repositorio, base, rama, versiones, build, paridad, backend, superficie pública, commits, pushes y estado Git verificados; `main`, Production y Cloudflare intactos.
- Pendientes: SETUP-0.2; SETUP-0.3 con aislamiento aprobado de Preview.
- Estado final: COMPLETADO AL PUBLICARSE ESTE CIERRE DOCUMENTAL
