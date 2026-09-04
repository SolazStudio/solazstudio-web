# Estado de implementación

- Fecha: 2026-09-04
- Fase/lote: SETUP-0.3
- Estado: SETUP-0 CERRADO AL PUBLICARSE Y VERIFICARSE ESTE COMMIT DOCUMENTAL
- Rama: `develop`
- Commit base: `b11d4126432af63384baf3b7f0737cbfaed2472c`
- Último commit ejecutable probado: `d46b125fd709c1b5479066b95ed6573f1aa5120e`
- Preview: <https://374f0f05.solazstudio-web.pages.dev/>
- Production: INTACTA
- Main: INTACTA en `880610411ecb4d66f652e8bfaf89e5794231409d`
- Bloqueadores: Ninguno
- Siguiente fase: F0 + C0

## Preview y aislamiento

- Preview correspondiente a `develop`, configurada manualmente con `npm run build` y directorio de salida `_site`.
- Sin variables ni secretos configurados.
- Sin D1 ni Queue vinculados.
- Sin integraciones reales observadas que puedan contaminar Production.
- Preview continúa separada de Production; Production, DNS, Ads y `main` no fueron modificados.
- Turnstile no está operativo en Preview como consecuencia esperada del aislamiento. No se considera un bug de SETUP-0 y no se añadieron claves, secretos ni autorización del hostname.
- No se realizaron POST ni envíos de formulario.

## Comprobaciones de cierre

- Preflight: PASS. Repositorio `SolazStudio/solazstudio-web`, rama `develop`, working tree limpio, HEAD local y `origin/develop` en `b11d4126432af63384baf3b7f0737cbfaed2472c`, `origin/main` en `880610411ecb4d66f652e8bfaf89e5794231409d` y Node `v24.18.0`.
- `npm ci`: PASS final. Dos intentos iniciales encontraron bloqueos `EBUSY` de Windows/Dropbox dentro de `node_modules/`; se eliminó únicamente esa carpeta generada e ignorada y la instalación limpia posterior pasó.
- `npm run qa`: PASS final. Un intento encontró un bloqueo `EBUSY` sobre `_site/`; se eliminó únicamente esa salida generada e ignorada y la repetición completó build y paridad.
- Build: PASS; 24 páginas generadas desde Nunjucks y 742 archivos copiados.
- Paridad: PASS; 24/24 HTML, 24 plantillas Nunjucks, 766 archivos públicos y legacy deshabilitado.
- `node --check functions/api/contact.js`: PASS.
- `git diff --check`: PASS.
- Smoke HTTP de solo lectura: PASS; 24/24 rutas públicas respondieron 200.
- Assets: PASS; `favicon.svg`, `favicon.ico`, `og-image.jpg` y `img/hero-fotografia-comercial.webp` respondieron 200.
- `robots.txt` y `sitemap.xml`: PASS, ambos respondieron 200.
- Ruta inexistente `/__setup-0-3-smoke-missing__`: PASS, respondió 404 con la página de error esperada.

## Evidencia manual recibida

- Seba verificó en Preview: Home, navegación, Portafolio, apertura de un proyecto, Contacto, cambio entre ambos modos del formulario y comportamiento responsive/móvil.
- No se realizó ningún envío de formulario.
- Única diferencia observada: error del widget Turnstile en Preview, esperado por el aislamiento y no corregido en este lote.

## Cambios y rollback

- Archivo modificado: únicamente `docs/IMPLEMENTATION_STATE.md`.
- Código, plantillas, CSS, JavaScript, contenido, backend y configuración de Cloudflare modificados: Ninguno.
- Rollback: retirar o desactivar la Preview, o revertir su configuración de Preview, sin tocar Production.

## Pendientes y prohibiciones vigentes

- Siguiente fase: F0 + C0; no iniciada en este lote.
- No modificar ni publicar `main`; no hacer merge ni abrir PR.
- No modificar Preview, Cloudflare, DNS, Production, Ads, D1, Queue, Turnstile, secretos ni recursos externos.
- No ejecutar formularios reales ni introducir cambios de código, contenido o diseño.

## INFORME CODEX — ÚLTIMO LOTE

- Lote: SETUP-0.3.
- Preflight: PASS exacto sobre `develop` en `b11d4126432af63384baf3b7f0737cbfaed2472c`.
- Pruebas: `npm ci` PASS final; `npm run qa` PASS final; sintaxis backend PASS; `git diff --check` PASS.
- Smoke test: PASS; 24/24 rutas, 4/4 assets, robots y sitemap correctos; ruta inexistente con 404.
- Evidencia manual recibida: Home, navegación, Portafolio, proyecto, Contacto, modos del formulario y responsive/móvil verificados por Seba.
- Estado de Preview: operativa en <https://374f0f05.solazstudio-web.pages.dev/> con build `npm run build` y salida `_site`.
- Aislamiento: sin variables/secretos, D1, Queue ni integraciones reales observadas; separada de Production.
- Limitación Turnstile esperada: widget no operativo en Preview por aislamiento; no se corrigió ni configuró.
- Archivos modificados: exclusivamente `docs/IMPLEMENTATION_STATE.md`.
- Commit: `docs: close SETUP-0 preview validation`, único commit documental de este lote; su SHA se captura y verifica tras crearlo.
- Push: únicamente `develop` a `origin/develop`, con verificación remota inmediatamente posterior.
- Working tree final: debe quedar limpio y se verifica después del push.
- Main intacta: SÍ, en `880610411ecb4d66f652e8bfaf89e5794231409d`.
- Production intacta: SÍ; Cloudflare, DNS y Ads sin acciones.
- Siguiente fase: F0 + C0.
- Estado final: SETUP-0 CERRADO AL PUBLICARSE Y VERIFICARSE ESTE COMMIT DOCUMENTAL.
