# Estado de implementación

- Fecha: 2026-09-04
- Fase/lote: F1.1 — Formulario, contexto y validación local
- Estado: COMPLETADO PARA REVISIÓN DE CHATGPT
- Rama: `develop`
- Commit base: `ea23b35f12bff012269ce4eda2ad43154252334b`
- Commit del lote: único commit que contiene este documento, con mensaje `feat: implement F1 contact flow foundation`
- Main / Production: INTACTA en `880610411ecb4d66f652e8bfaf89e5794231409d`
- Preview / Cloudflare / recursos reales: sin acciones en este lote
- Bloqueadores: ninguno
- Siguiente lote: F1.2, sujeto a revisión de ChatGPT y nueva autorización

## Alcance y estado de F1.1

F1.1 implementa la base local del nuevo flujo de contacto. Conserva los dos recorridos existentes, hace obligatoria la clasificación por servicio, alinea la matriz frontend/backend, transporta contexto interno seguro, incorpora idempotencia sobre la columna `id` existente y hace recuperables los dos widgets Turnstile.

**F1 NO ESTÁ CERRADO.** No se verificó ni modificó infraestructura real. La persistencia estructurada de `service_code`, `case_id` y `cta_id`, la decisión sobre persistencia estructurada adicional de `source_page`, la atribución externa y las pruebas en Preview/Cloudflare quedan para lotes posteriores expresamente autorizados.

## Archivos afectados

- Creados: 0.
- Modificados: 11: `src/contacto.njk`, `src/_data/pages.js`, `functions/api/contact.js`, los siete templates de servicio autorizados y `docs/IMPLEMENTATION_STATE.md`.
- Eliminados: 0.
- Archivos temporales: 0 al cierre; los dos artefactos locales de comprobación fueron eliminados antes del commit.
- `src/_data/services.js`: leído e importado, no modificado.
- `package.json`, `package-lock.json`, configuración, QA, rutas no autorizadas, media y demás archivos: intactos.

## Comportamiento implementado

### Taxonomía y matriz de campos

`src/_data/services.js` sigue siendo la fuente única. Ambos selectores se generan directamente desde su data global y contienen una opción inicial vacía más estos nueve códigos, sin subservicios:

| Código estable | Nombre visible |
| --- | --- |
| `fotografia_comercial` | Fotografía comercial |
| `produccion_audiovisual` | Producción audiovisual |
| `contenido_marcas` | Contenido para marcas |
| `fotografia_corporativa` | Fotografía corporativa |
| `fotografia_industrial` | Fotografía industrial |
| `eventos` | Cobertura de eventos |
| `arquitectura_interiores` | Arquitectura / interiorismo |
| `inteligencia_artificial` | Inteligencia Artificial |
| `no_definido` | No estoy seguro |

| Recorrido | Obligatorios | Opcionales |
| --- | --- | --- |
| Contacto general | nombre, email, `service_code`, mensaje | teléfono, empresa/emprendimiento, presupuesto, consentimiento comercial |
| Solicitud de reunión | nombre, email, `service_code`, al menos un día, una franja horaria | teléfono, empresa/emprendimiento, consentimiento comercial |

- Teléfono permanece visible y dejó de ser obligatorio en ambos recorridos.
- Reunión no incorpora un mensaje obligatorio nuevo.
- La interfaz usa “Solicitar reunión”, explica que no es una reserva automática y confirma después el horario.
- Se mantuvieron la estética, composición general y textos no relacionados de Contacto.

### Contexto interno

- Ambos formularios incluyen `source_page`, `case_id`, `cta_id` y `submission_id`; `service_code` permanece como control visible.
- Un `service_code` de querystring se preselecciona solo si coincide exactamente con la taxonomía; cualquier otro valor deja el selector vacío.
- `source_page` acepta solo un pathname interno razonable, sin dominio, querystring, hash, barra invertida ni navegación normalizada distinta.
- Si no existe `source_page` explícito, se usa solo el pathname de `document.referrer` cuando es same-origin.
- Para `/proyectos/<slug>`, `case_id` se deriva del slug únicamente cuando no existe un `case_id` explícito válido.
- `cta_id` se conserva solo cuando llega explícitamente y pasa su validación; no se inventa.
- No se infiere `service_code` desde proyectos.
- Los siete CTA principales conservan el texto visible `Solicitar presupuesto →` y ahora llevan su código de servicio, `source_page` y `cta_id=service_primary` correctos.
- No se añadieron CTA, páginas, rutas, cookies, almacenamiento local, parámetros publicitarios ni analítica.

### Backend, persistencia e idempotencia

- `functions/api/contact.js` importa la taxonomía desde `../../src/_data/services.js`; no duplica la lista.
- Backend valida server-side la matriz, correo, taxonomía, UUID y contexto interno con longitudes limitadas.
- `source_page` válido se transforma de forma segura en una URL canónica Solaz para la columna existente `origen_url`; sin `source_page`, solo se admite el pathname de un Referer de Production permitido.
- Cada formulario recibe al inicializar un UUID propio mediante APIs nativas del navegador. El identificador se conserva durante reintentos y no se regenera por un error.
- `submission_id` validado usa la columna `contacts.id` existente.
- La inserción usa una única sentencia `INSERT ... SELECT ... WHERE NOT EXISTS`; el resultado de D1 determina si se insertó la fila.
- Una primera inserción encola una vez y responde `deduplicated=false`; un reintento con el mismo UUID no inserta ni encola de nuevo y responde `deduplicated=true`.
- D1 sigue siendo la primera persistencia y Queue se ejecuta después como entrega best-effort; un fallo de Queue posterior no invalida el guardado.
- Web3Forms permanece en frontend como aviso secundario best-effort solo después del éxito D1, no se reenvía al deduplicar y excluye `cf-turnstile-response`, `submission_id`, `form_type` y `botcheck`.
- Honeypot conserva respuesta neutra sin Turnstile, INSERT ni Queue.
- No se creó migración ni se cambió esquema o binding. `service_code`, `case_id` y `cta_id` se capturan y validan, pero **todavía no se persisten estructuralmente**. `source_page` solo aprovecha `origen_url` existente.

### Turnstile y accesibilidad

- El script de Turnstile de Contacto usa `render=explicit`; no se cambió la sitekey ni otra metadata de `pages.js`.
- Cada formulario conserva su propio widget ID; el panel visible se renderiza de forma segura.
- El widget específico se resetea después de un fallo de envío o verificación y se recupera ante expiración/timeout.
- Fallos de carga o disponibilidad muestran feedback accesible.
- Los selectores de recorrido son botones normales con `aria-pressed` y `aria-controls`; el panel inactivo usa `hidden`.
- Cada formulario posee error persistente con `role=alert` y éxito con `role=status`/`aria-live=polite`, ambos enfocables programáticamente; el foco se mueve al resultado relevante.
- El botón se deshabilita durante el envío y recupera su contenido/estado para reintentar.

## Pruebas y resultados de F1.1

### Precheck antes de escribir

- Git: PASS exacto. Repositorio `SolazStudio/solazstudio-web`, rama `develop`, working tree limpio, HEAD local y `origin/develop` en `ea23b35f12bff012269ce4eda2ad43154252334b`; `origin/main` en `880610411ecb4d66f652e8bfaf89e5794231409d`.
- Lecturas obligatorias: PASS; estado durable, taxonomía, Contacto, backend y siete templates revisados antes de modificar.
- Siete CTA: PASS; todos tenían un CTA principal inequívoco a Contacto.
- `npm ci`: PASS final; 129 paquetes instalados. Hubo bloqueos locales `EBUSY` en la carpeta generada `node_modules/`; se eliminó únicamente esa carpeta autorizada y se repitió la instalación.
- `npm run qa`: PASS prewrite; build de 24 páginas y 742 archivos copiados, paridad 24/24 HTML, 24 plantillas Nunjucks y 766 archivos públicos con legacy deshabilitado.
- `package-lock.json`: intacto; SHA-256 previo `F7411FAE482A3FDC543C26245DDFD8F18B56897757D3573CD755D31CF37B671C`.
- Referencia funcional: el repositorio local `sebaogalde-cl` estaba accesible y su ref `main` resolvía a `80fce3cdee01e9c9323ce975c71d2e34b8e27ad5`, pero los tres paths indicados no existían en ese ref. La referencia exacta se declaró no disponible; no se copió código y la implementación siguió el encargo funcional detallado.

### Controles posteriores

- `npm run build`: PASS; 24 HTML, 742 archivos copiados y 766 archivos públicos totales, sin nuevas rutas.
- `node --check functions/api/contact.js`: PASS.
- `node --check src/_data/services.js`: PASS.
- Extracción del bloque JavaScript funcional desde `_site/contacto.html` y `node --check` del temporal: PASS; temporal eliminado.
- Import ESM de `functions/api/contact.js`, incluida su dependencia de `services.js`: PASS.
- Taxonomía generada: PASS 2/2 selectores; cada uno contiene exactamente opción vacía + 9/9 códigos, incluidos `inteligencia_artificial` y `no_definido`.
- Matriz de campos generada y lógica frontend: PASS en ambos recorridos.
- Semántica de reunión: PASS; no queda “Agenda tu reunión” y se explicita confirmación posterior/no reserva automática.
- Análisis local de contexto: PASS para preselección válida, rechazo de servicio inválido, pathname interno, referrer same-origin, exclusión de referrer externo, derivación de caso, CTA explícito y ausencia de persistencia de marketing.
- CTA principales: PASS 7/7 en código, origen y `cta_id`; texto visible intacto, sin CTA adicionales.
- Mock backend sin red real: PASS 10/10 casos obligatorios. Cubrió contacto general válido sin teléfono; servicio ausente; servicio inválido; reunión válida; reunión sin día; reunión sin horario; Turnstile inválido; honeypot; UUID en primera inserción; y reintento deduplicado sin segundo INSERT ni segunda Queue.
- Límites backend adicionales: PASS 6/6 para source externo/protocol-relative/querystring, token de caso inválido, token CTA inválido y UUID inválido.
- `git diff --check`: PASS.
- Alcance, diff completo, estadística y nombres: PASS; solo los 11 archivos autorizados.
- `package-lock.json`: intacto después de instalación y pruebas.

## Cambios intencionales visibles

- Dos selectores de servicio integrados con el estilo actual.
- Teléfono marcado como opcional.
- Etiquetas y copy funcional de reunión corregidos para expresar solicitud y confirmación posterior.
- Mensajes persistentes de error/éxito y estado Turnstile.
- Los siete CTA conservan el mismo texto y apuntan a Contacto con querystring de contexto.

No se rediseñó la página ni se modificaron identidad, navegación, footer, proyectos, media, SEO, canonical, JSON-LD/schema o URLs públicas existentes.

## Limitaciones, pendientes y prohibiciones vigentes

- No hubo prueba visual/manual en navegador, responsive manual ni lector de pantalla; el foco y ARIA se verificaron por análisis local.
- No se probó Turnstile real, POST real, Web3Forms real, D1 real ni Queue real.
- No se desplegó en Preview ni Production; no hubo acciones en Cloudflare, DNS, Ads, analítica o recursos externos.
- Antes de cerrar F1 falta verificar el esquema D1 real y definir/aplicar la persistencia estructurada de `service_code`, `source_page` si corresponde, `case_id` y `cta_id`.
- Falta decidir la atribución externa completa bajo reglas de privacidad.
- Faltan Preview, Turnstile real, envío real controlado, confirmación de una única escritura D1, comprobación de Queue/entrega y QA visual/manual.
- No crear página/URL/oferta de IA, landings, subservicios, tracking o nuevas rutas sin autorización.
- No iniciar F1.2 ni F2, modificar `main`, hacer merge/PR/rama/force push o tocar Production/Cloudflare/recursos reales sin nueva autorización.

## Rollback

Todo F1.1 queda contenido en un único commit de `develop`. Rollback previsto: revertir ese commit; no ejecutarlo salvo instrucción posterior.

## Evidencia durable anterior

### F0 + C0.2

- Cerrado por ChatGPT antes de iniciar este lote.
- Commit ejecutable/documental: `ea23b35f12bff012269ce4eda2ad43154252334b` (`feat: add F0 C0 service taxonomy baseline`).
- Creó `src/_data/services.js` con nueve opciones exactas y documentó posicionamiento, reglas de contacto, promesas comerciales y geografía, sin alterar la salida pública.
- Baseline: build de 24 páginas y 742 archivos copiados; paridad 24/24 HTML, 24 plantillas y 766 archivos públicos.

### SETUP-0

- Cerrado con base Eleventy/Nunjucks, 24 plantillas y cero HTML legacy o passthrough HTML legacy.
- Commit ejecutable probado: `d46b125fd709c1b5479066b95ed6573f1aa5120e`; commit documental final de SETUP-0.2: `b11d4126432af63384baf3b7f0737cbfaed2472c`.
- Paridad verificada: 24/24 HTML y 766 archivos públicos; CSS, JavaScript, metadata, estructura, atributos, copy y JSON-LD/schema preservados.
- Backend y media preservados: `functions/`, `img/` y archivos públicos raíz intactos.
- Preview SETUP-0.3: <https://374f0f05.solazstudio-web.pages.dev/>, configurada manualmente con `npm run build` y salida `_site`; aislada, sin variables, secretos, D1 ni Queue vinculados.
- Smoke HTTP SETUP-0.3: 24/24 rutas públicas y assets críticos con 200; ruta inexistente con 404. QA visual/manual de Home, navegación, Portafolio, proyecto, Contacto, ambos modos y móvil, sin envíos.
- Production, `main`, DNS, Ads, D1/Queue de Production, secretos y Turnstile real permanecieron intactos. Corrección documental posterior: `d584494c809765e61f301af23618ef7212734653`.

## INFORME CODEX — ÚLTIMO LOTE

- Lote: F1.1 — Formulario, contexto y validación local.
- Fecha: 2026-09-04.
- Precheck: PASS exacto; repo/rama/limpieza y refs coincidieron, lecturas completas, `npm ci` PASS final y `npm run qa` prewrite PASS.
- Base exacta: `develop`/`origin/develop` en `ea23b35f12bff012269ce4eda2ad43154252334b`; `origin/main` en `880610411ecb4d66f652e8bfaf89e5794231409d`.
- Trabajo realizado: taxonomía conectada a ambos formularios; matriz alineada; teléfono opcional; reunión como solicitud; contexto interno seguro; siete CTA parametrizados; UUID/idempotencia; Turnstile explícito e individual; feedback accesible; D1/Queue/Web3Forms ordenados según contrato.
- Archivos: 0 creados, 11 modificados y 0 eliminados; temporales eliminados.
- Decisiones técnicas: data global única; validación frontend/backend; path interno canónico; `contacts.id` para UUID; inserción condicional atómica; Queue solo tras inserción; aviso secundario omitido al deduplicar; sin migración.
- Referencia `sebaogalde.cl`: ref `main` accesible, pero sin los tres paths solicitados; referencia exacta no disponible y ningún código copiado.
- Comandos: verificaciones Git/remoto; lecturas; `npm ci`; `npm run qa` prewrite; `npm run build`; dos `node --check`; extracción/check/eliminación de JS inline; import backend; prueba local temporal; controles de diff, lockfile y salida.
- Pruebas: build/inventario PASS; sintaxis/import PASS; taxonomía 2/2 PASS; matriz/contexto/reunión/Turnstile estático PASS; CTA 7/7 PASS; mock backend 10/10 PASS; límites adicionales 6/6 PASS; diff/alcance/lock PASS.
- Mock backend: Siteverify, D1 y Queue fueron mocks locales; ninguna petición real. Se cubrieron los diez casos obligatorios, incluidos honeypot y deduplicación sin segunda escritura/Queue.
- Errores: `npm ci` encontró bloqueos locales `EBUSY` en `node_modules/`; se eliminó solo esa carpeta generada autorizada y la repetición pasó. La referencia exacta no contenía los paths solicitados.
- Limitaciones: sin navegador/QA visual real, Preview, Cloudflare, Turnstile/Web3Forms/D1/Queue reales ni persistencia estructurada completa de contexto.
- Desviaciones: ninguna material de alcance; no se modificaron archivos ni recursos fuera de los autorizados.
- Cambios visibles intencionales: selectores de servicio, teléfono opcional, copy funcional de reunión y estados accesibles; href contextual de siete CTA con texto intacto.
- Expresamente no implementado: F1.2/F2, migraciones/columnas, atribución externa/tracking, página IA, rutas/CTA nuevos, agenda real, action/hostname Turnstile, deploy, PR, merge o cambios a `main`/Production.
- Commit: único commit del lote con mensaje `feat: implement F1 contact flow foundation`; el SHA se verifica en el informe final externo porque un commit no puede registrar dentro de sí su propio identificador.
- Push: exclusivamente a `origin/develop`, sujeto a la verificación final posterior al commit.
- Working tree final: debe quedar limpio tras el commit/push y se verifica en el informe final externo.
- Estado de main: debe permanecer en `880610411ecb4d66f652e8bfaf89e5794231409d` y se verifica después del push.
- Criterio de cierre del sublote: cumplido localmente; F1.1 queda listo para revisión de ChatGPT cuando terminen commit, push y comprobaciones remotas.
- Pendientes F1.2: esquema/persistencia estructurada D1, atribución bajo privacidad, Preview, recursos reales controlados y QA visual/manual, todo sujeto a nueva autorización.
- Estado final exacto: COMPLETADO PARA REVISIÓN DE CHATGPT
