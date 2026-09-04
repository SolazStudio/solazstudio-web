# Estado de implementación

- Fecha: 2026-09-04
- Fase/lote: SETUP-0.1
- Estado: IMPLEMENTACIÓN Y QA COMPLETADAS; PRIMER COMMIT PENDIENTE
- Rama: `develop`
- Commit/base: `880610411ecb4d66f652e8bfaf89e5794231409d`
- Último commit ejecutable probado: PENDIENTE DE REGISTRAR INMEDIATAMENTE DESPUÉS DEL PRIMER COMMIT
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

## Archivos afectados

- Archivos creados: `.gitignore`, `.node-version`, `package.json`, `package-lock.json`, `eleventy.config.js`, `config/public-surface.js`, `scripts/clean.mjs`, `scripts/verify-setup-parity.mjs`, `src/_data/.gitkeep`, `src/_includes/layouts/base.njk`, `src/_includes/partials/.gitkeep`, `docs/IMPLEMENTATION_STATE.md`.
- Archivos existentes modificados: Ninguno.
- Archivos eliminados: Ninguno.

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

## Pendientes

- Crear y publicar el primer commit de la implementación.
- Registrar el SHA ejecutable probado y cerrar el lote con un segundo commit exclusivamente documental.
- Ejecutar SETUP-0.2 únicamente como lote posterior independiente.

## Prohibiciones vigentes

- No modificar, publicar ni fusionar `main`; no actuar sobre Production, Cloudflare, DNS ni Ads.
- No migrar páginas públicas a Nunjucks durante SETUP-0.1.
- Para SETUP-0.3, Preview deberá quedar aislada de D1 Production, CONTACT_QUEUE Production, correo/Web3Forms real, Turnstile y secretos reales según la estrategia que se apruebe, analítica, Ads y otras integraciones que puedan contaminar Production.

## INFORME CODEX — ÚLTIMO LOTE

- Lote: SETUP-0.1
- Fecha: 2026-09-04
- Trabajo realizado: Scaffold mínimo Eleventy/Nunjucks, passthrough explícito de la superficie pública, build reproducible, limpieza segura y QA de paridad contra el baseline.
- Archivos creados: `.gitignore`, `.node-version`, `package.json`, `package-lock.json`, `eleventy.config.js`, `config/public-surface.js`, `scripts/clean.mjs`, `scripts/verify-setup-parity.mjs`, `src/_data/.gitkeep`, `src/_includes/layouts/base.njk`, `src/_includes/partials/.gitkeep`, `docs/IMPLEMENTATION_STATE.md`.
- Archivos modificados: Ninguno.
- Archivos eliminados: Ninguno.
- Decisiones técnicas aplicadas: Node `24.18.0`, Eleventy `3.1.5`, Nunjucks `3.2.4`, entrada `src`, salida `_site`, motores `njk`, passthrough explícito y baseline fijo autorizado.
- Comandos ejecutados: preflight Git/Node; `git switch -c develop 880610411ecb4d66f652e8bfaf89e5794231409d`; `npm install`; `node --version`; `npm ci`; `npm run build`; `npm run qa:setup`; `node --check functions/api/contact.js`; verificaciones Git de paridad y control completo del diff staged.
- Pruebas ejecutadas: versión Node, instalación limpia, build, QA de paridad, sintaxis backend y diffs contra baseline.
- Resultado de cada prueba: Node PASS; `npm ci` PASS; build PASS; QA final PASS (24/24 HTML, 766 archivos); backend PASS; fuentes públicas y `functions/` sin diff; control del diff PASS.
- Errores: El primer acceso remoto del preflight fue bloqueado por el sandbox y se repitió con autorización, con resultado PASS. La primera QA reveló un error de normalización en el script nuevo, corregido dentro del alcance; la repetición afectada pasó.
- Limitaciones: Preview no configurada; QA visual fuera del alcance del lote.
- Desviaciones respecto del encargo: Ninguna.
- Commit ejecutable probado: PENDIENTE.
- Push realizado: PENDIENTE.
- Working tree: Contiene únicamente los archivos nuevos autorizados, pendiente de commits.
- Criterio de cierre: QA técnica cumplida; pendientes commits, pushes y verificaciones remotas.
- Pendientes: SETUP-0.2; SETUP-0.3 con aislamiento aprobado de Preview.
- Estado final: EN EJECUCIÓN
