# Estado de implementación

- Fecha: 2026-09-04
- Fase/lote: SETUP-0.2
- Estado: COMPLETADO AL PUBLICARSE ESTE CIERRE DOCUMENTAL
- Rama: `develop`
- Base de implementación: `bd9e9aeaee8af2ff4c6cee6773b2b6d764c879eb`
- Baseline público de paridad: `880610411ecb4d66f652e8bfaf89e5794231409d`
- Último commit ejecutable probado: `d46b125fd709c1b5479066b95ed6573f1aa5120e`
- Preview: NO CONFIGURADA
- Production: INTACTA
- Bloqueadores: Ninguno
- Siguiente lote: SETUP-0.3

## Resultado operativo

- Los 24 HTML públicos se generan desde 24 plantillas Nunjucks bajo `src/` con permalinks explícitos.
- Los 15 HTML raíz y 9 HTML de `proyectos/` fueron retirados como fuentes legacy.
- La estructura compartida usa `base.njk`, datos globales/de navegación/de páginas y parciales de head, favicons, navegación, menú móvil y footer.
- CSS y JavaScript permanecen asociados a cada plantilla y conservan paridad textual.
- Metadata, tags, atributos, copy y schema conservan paridad con el baseline público.
- `img/`, archivos públicos raíz y `functions/` permanecen intactos.

## Archivos

- Creados: `scripts/verify-parity.mjs`; `src/_data/site.js`, `src/_data/navigation.js`, `src/_data/pages.js`; cinco parciales en `src/_includes/partials/`; 15 plantillas raíz y 9 plantillas bajo `src/proyectos/`.
- Modificados: `config/public-surface.js`, `eleventy.config.js`, `package.json`, `src/_includes/layouts/base.njk`, `docs/IMPLEMENTATION_STATE.md`.
- Eliminados: los 24 HTML fuente legacy, `scripts/verify-setup-parity.mjs`, `src/_data/.gitkeep` y `src/_includes/partials/.gitkeep`.
- Media, backend y archivos públicos existentes modificados: Ninguno.

## Compuertas

- A: PASS. Infraestructura compartida y `fotografia-comercial.njk`; build y paridad 24/24 con 1 plantilla.
- B: PASS. Quince páginas raíz convertidas; build y paridad 24/24 con 15 plantillas.
- C: PASS final. Proyecto piloto `video-corporativo-weg-chile.njk`; build y paridad 24/24 con 16 plantillas.
- D: PASS. Ocho proyectos restantes convertidos; build y paridad 24/24 con 24 plantillas.
- E: PASS. Cero HTML legacy, cero passthrough HTML, build limpio y paridad final 24/24 desde Nunjucks.

## Pruebas

- Preflight: PASS; `develop` local y remota en `bd9e9aeaee8af2ff4c6cee6773b2b6d764c879eb`, `origin/main` en `880610411ecb4d66f652e8bfaf89e5794231409d`, working tree limpio y Node `v24.18.0`.
- Builds de compuertas A-E: PASS.
- QA de transición A-D: PASS final en cada compuerta.
- `npm ci`: PASS.
- `npm run build`: PASS final; 24 páginas escritas desde Nunjucks y 742 archivos copiados.
- `npm run qa:parity`: PASS; 24/24 HTML, 24 plantillas, 766 archivos públicos y legacy deshabilitado.
- CSS y scripts no JSON-LD: paridad textual PASS.
- JSON-LD: equivalencia semántica PASS, con orden de arrays preservado.
- Estructura, atributos y flujo de texto visible: PASS.
- `node --check functions/api/contact.js`: PASS.
- Diff de `functions/`, `img/`, robots, sitemap, favicons y `og-image.jpg` contra el baseline: PASS, sin cambios.
- `git diff --check`: PASS.
- Control final: 24 plantillas, cero HTML fuente legacy y ningún archivo temporal, backup, snapshot o reporte adicional.
- Primer push: PASS; `origin/develop` verificado en `d46b125fd709c1b5479066b95ed6573f1aa5120e`.

## Errores y correcciones dentro del alcance

- La primera QA de la compuerta C detectó que el transformador piloto omitió dos JSON-LD ubicados después de los favicons. Se regeneró únicamente la plantilla piloto conservando literalmente la cola del head; build y QA de C pasaron después de la corrección.

## Limitaciones y desviaciones

- Limitaciones: Preview no configurada y QA visual no ejecutada, según el alcance aprobado.
- Desviaciones respecto del encargo: Ninguna.
- Decisiones nuevas: Ninguna; se aplicó la arquitectura autorizada con abstracciones limitadas a fragmentos compartidos y parámetros simples.

## Pendientes y prohibiciones vigentes

- Pendiente: SETUP-0.3 como lote independiente.
- No modificar ni publicar `main`; no hacer merge ni abrir PR.
- No configurar Preview, Cloudflare, DNS, Production, Ads, D1, Queue, Turnstile ni recursos externos.
- No ejecutar formularios reales ni iniciar optimizaciones o cambios de contenido/diseño.

## INFORME CODEX — ÚLTIMO LOTE

- Lote: SETUP-0.2
- Fecha: 2026-09-04
- Preflight: PASS exacto.
- Trabajo realizado: Conversión estructural de los 24 HTML públicos a Eleventy/Nunjucks con layout, datos, parciales, permalinks y QA histórica estricta.
- Archivos creados: 24 plantillas de página, 3 archivos de datos, 5 parciales y `scripts/verify-parity.mjs`.
- Archivos modificados: Configuración Eleventy, superficie pública, scripts npm, layout base y este estado durable.
- Archivos eliminados: 24 HTML legacy, verificador anterior y 2 `.gitkeep` ya innecesarios.
- Decisiones técnicas aplicadas: Eleventy `3.1.5`, Nunjucks `3.2.4`, Node `24.18.0`, permalinks explícitos, assets como passthrough y HTML exclusivamente generado desde `src/`.
- Compuertas ejecutadas: A, B, C, D y E.
- Resultado de cada compuerta: A PASS; B PASS; C PASS final tras corrección acotada; D PASS; E PASS.
- Comandos: preflight Git/Node; builds y QA por compuerta; `npm ci`; build y QA final; sintaxis backend; controles Git y de árbol.
- Pruebas: Paridad de estilos, scripts, JSON-LD, estructura, atributos, texto visible, rutas, assets, backend y conjunto completo de `_site`.
- Errores: Omisión inicial de JSON-LD posfavicon en el piloto de C.
- Correcciones dentro del alcance: Regeneración del piloto incluyendo literalmente el contenido posfavicon; QA afectada repetida y aprobada.
- Limitaciones: Sin Preview ni QA visual, ambas fuera del lote.
- Desviaciones: Ninguna.
- Commit ejecutable probado: `d46b125fd709c1b5479066b95ed6573f1aa5120e`.
- Pushes: Primer push realizado y verificado; este documento corresponde al segundo y último commit/push autorizado.
- Working tree: Limpio después del primer push; al cierre solo se incorpora esta actualización documental y se verifica nuevamente tras publicarla.
- Criterio de cierre: Preflight, cinco compuertas, 24 plantillas, cero legacy, paridad, backend, media, commits, pushes y estado Git verificados; `main`, Production y Cloudflare intactos.
- Pendientes: SETUP-0.3.
- Estado final: COMPLETADO AL PUBLICARSE ESTE CIERRE DOCUMENTAL
