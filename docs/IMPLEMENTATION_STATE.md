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

- Durante SETUP-0.3, la configuración de Preview en Cloudflare fue modificada manualmente únicamente para establecer el comando `npm run build` y el directorio de salida `_site`.
- Esa modificación afectó exclusivamente a la configuración de Preview correspondiente a `develop`.
- Preview permanece aislada: sin variables ni secretos configurados, y sin D1 ni Queue vinculados.
- Production, `main`, DNS, Ads, D1 de Production, Queue de Production, secretos reales y Turnstile real no fueron modificados.
- Durante el cierre posterior a esa configuración manual, Codex no realizó nuevas acciones en Cloudflare; solo ejecutó comprobaciones y actualizó documentación.
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
- Código, plantillas, CSS, JavaScript, contenido y backend modificados: Ninguno.
- Configuración de Preview en Cloudflare durante SETUP-0.3: SÍ, modificada manualmente solo para establecer `npm run build` y `_site`.
- Alcance de esa modificación: exclusivamente Preview; no afectó Production, `main`, DNS, Ads, D1 de Production, Queue de Production, secretos reales ni Turnstile real.
- Durante esta corrección documental, Codex no realizó acciones en Cloudflare.
- Rollback: retirar o desactivar la Preview, o revertir su configuración de Preview, sin tocar Production.

## Pendientes y prohibiciones vigentes

- Siguiente fase: F0 + C0; no iniciada en este lote.
- No modificar ni publicar `main`; no hacer merge ni abrir PR.
- No modificar Preview, Cloudflare, DNS, Production, Ads, D1, Queue, Turnstile, secretos ni recursos externos.
- No ejecutar formularios reales ni introducir cambios de código, contenido o diseño.

## INFORME CODEX — ÚLTIMO LOTE

- Lote: CORRECCIÓN DOCUMENTAL SETUP-0.3.
- Precheck: PASS exacto sobre `develop`; HEAD local y `origin/develop` en `904e8a834ba1b739a51458c4bd3896c9654388ce`, `origin/main` en `880610411ecb4d66f652e8bfaf89e5794231409d` y working tree limpio.
- Corrección: se eliminó la contradicción documental sobre la configuración de Cloudflare sin alterar los resultados válidos del cierre SETUP-0.3.
- Hecho corregido: durante SETUP-0.3, la configuración de Preview en Cloudflare fue modificada manualmente para usar `npm run build` y el directorio de salida `_site`.
- Alcance: la modificación afectó exclusivamente a Preview; su aislamiento sin variables, secretos, D1 ni Queue vinculados se mantiene, y Turnstile continúa esperado como no operativo allí.
- Acciones de Codex: durante esta corrección documental no se realizaron nuevas acciones en Cloudflare; solo se actualizó y comprobó este documento.
- Recursos protegidos: Production, `main`, DNS, Ads, D1 de Production, Queue de Production, secretos reales y Turnstile real permanecen intactos.
- Pruebas: no se repitieron `npm ci`, QA, build, smoke test ni validación de Preview; `git diff --check` fue la única comprobación técnica de esta corrección documental.
- Archivo modificado: exclusivamente `docs/IMPLEMENTATION_STATE.md`.
- Commit: `docs: correct SETUP-0.3 Cloudflare record`.
- Push: únicamente `develop` hacia `origin/develop`.
- Siguiente fase: F0 + C0.
- Estado final: SETUP-0 permanece cerrado; contradicción documental corregida.
