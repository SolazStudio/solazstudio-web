# Estado de implementación

- Fecha: 2026-09-04
- Fase/lote: F1.3 — Aplicación controlada de migración en D1 real
- Estado: COMPLETADO PARA REVISIÓN DE CHATGPT
- Rama: `develop`
- Commit base: `cb2ddb768a59d293cc280791de7251b1ce2168c2`
- Commit del lote: único commit que contiene este documento, con mensaje `ops: apply contact context migration to D1`
- Main / Production: INTACTA en `880610411ecb4d66f652e8bfaf89e5794231409d`
- Preview / Cloudflare / recursos reales: únicamente D1 `solaz-contactos`; Preview, Production web y demás recursos intactos
- Bloqueadores: ninguno
- Siguiente lote: pendiente de revisión de ChatGPT y nueva autorización

## F1.3 — Aplicación controlada de migración en D1 real

F1.3 aplicó una sola vez la migración aditiva versionada `migrations/0001_add_contact_context.sql` sobre la D1 real `solaz-contactos`. No se ejecutó `migrations apply`, no se desplegó código y no se modificó ningún otro recurso de Cloudflare o integración externa.

Evidencia previa a la escritura:

- Base Git exacta y árbol limpio: HEAD local y `origin/develop` en `cb2ddb768a59d293cc280791de7251b1ce2168c2`; `origin/main` en `880610411ecb4d66f652e8bfaf89e5794231409d`.
- Wrangler autenticado mediante OAuth y una sola cuenta disponible.
- Inventario D1: una sola base, con nombre exacto `solaz-contactos`.
- Bookmark de Time Travel previo: `000019ae-00000000-000050dc-66e15a75728c69361e3adb40fa94e7b1`.
- `PRAGMA table_info("contacts")`: las 19 columnas conocidas estaban presentes y `service_code`, `source_page`, `case_id` y `cta_id` no existían.
- `SELECT COUNT(*) AS total FROM contacts;`: `total = 8`.

Aplicación y evidencia posterior:

- Comando único de escritura: `npx wrangler d1 execute solaz-contactos --remote --file migrations/0001_add_contact_context.sql --yes`.
- Resultado: PASS; 4 consultas procesadas en una sola ejecución.
- Bookmark posterior informado por D1: `000019ae-00000004-000050dc-6103293222cdcf1ae096da4a1252cf21`.
- Esquema final: 23 columnas. Las cuatro nuevas son `TEXT`, permiten `NULL` y no tienen default.
- Conteo final: `total = 8`; no disminuyó respecto del conteo previo.
- Conteos no nulos: `service_code = 0`, `source_page = 0`, `case_id = 0`, `cta_id = 0`, conforme a la preservación esperada de las filas históricas.
- No se leyeron filas ni datos personales; solo esquema y agregados autorizados.
- No se realizó POST real.
- Único recurso externo modificado: D1 `solaz-contactos`. Queue, Worker, Make, Notion, Resend, Turnstile, Preview, Production web, DNS, Ads y analítica permanecieron intactos.

## F1.2 — Persistencia estructurada del contexto

F1.2 dejó versionado y probado localmente el almacenamiento estructurado de `service_code`, `source_page`, `case_id` y `cta_id` en `contacts`. La aplicación posterior a D1 real corresponde exclusivamente a F1.3.

La evidencia real de solo lectura suministrada para diseñar el lote mostró 19 columnas existentes en Production: `id`, `created_at`, `form_type`, `nombre`, `empresa`, `email`, `telefono`, `mensaje`, `presupuesto`, `consent_marketing`, `dias`, `horario`, `origen_url`, `sync_status`, `notion_page_id`, `retry_count`, `last_error`, `synced_at` y `alerted`. No existían las cuatro columnas de contexto.

La migración `migrations/0001_add_contact_context.sql` añade mediante cuatro operaciones `ALTER TABLE ... ADD COLUMN`:

- `service_code TEXT`
- `source_page TEXT`
- `case_id TEXT`
- `cta_id TEXT`

Todas permiten `NULL`, no tienen default artificial y preservan las filas históricas. No se reconstruye la tabla, no se eliminan columnas y no se crean tablas o índices.

Decisión de persistencia:

- `service_code`: código estable obligatorio ya validado contra `src/_data/services.js`.
- `source_page`: pathname interno explícito validado; si falta, pathname de Referer Solaz permitido y validado; si tampoco existe, `NULL`.
- `origen_url`: se conserva además por compatibilidad como URL canónica Solaz cuando existe un origen interno.
- `case_id` y `cta_id`: tokens validados o `NULL`, sin valores inventados.
- No se infiere servicio desde caso ni se añaden reglas comerciales.
- Idempotencia y Queue permanecen iguales: una inserción nueva encola una vez; un UUID repetido no inserta ni encola; el mensaje sigue siendo `CONTACT_QUEUE.send({ id: submissionId })`.

## Revisión de ChatGPT y corrección definitiva

F1.1 original fue marcado **REQUIERE CORRECCIÓN** porque el honeypot backend responde éxito neutro sin persistir ni encolar, pero el frontend todavía podía interpretar ese éxito como autorización para enviar por la vía secundaria Web3Forms. La decisión arquitectónica no fue añadir otra condición especial, sino retirar Web3Forms por completo del flujo ejecutable.

Arquitectura implementada después de esta corrección:

```text
Formulario
→ /api/contact
→ validación / Turnstile / idempotencia
→ D1
→ CONTACT_QUEUE
```

No existe un segundo proveedor client-side. Ambos formularios apuntan a `/api/contact`; se eliminaron los campos exclusivos de Web3Forms, su access key pública histórica y el segundo `fetch`. Un `ok=true` ejecuta únicamente el flujo visual de éxito ya existente.

## Decisión aprobada para la arquitectura futura

La siguiente topología está **APROBADA COMO OBJETIVO, PERO NO IMPLEMENTADA AÚN**:

```text
Formulario
→ /api/contact
→ D1
→ CONTACT_QUEUE
→ Worker
   ├─→ Notion
   └─→ Resend
```

- Notion continúa siendo el CRM operativo.
- Resend se adoptará server-side detrás de Worker/Queue; nunca desde el navegador.
- Make está aprobado para salir del camino crítico en un lote posterior, pero no debe desconectarse hasta disponer del reemplazo Worker → Notion probado y con rollback.
- El mecanismo actual detrás de `CONTACT_QUEUE`, Make, Worker, Notion y Resend no fue modificado ni probado en esta corrección.
- La referencia `sebaogalde.cl` aporta patrones de integración server-side, secretos privados, idempotencia, Notion API, Resend API y escape de contenido. Solaz no copiará exactamente esa topología: conserva D1 + Queue como capa adicional de resiliencia.

## Alcance y estado acumulado de F1

F1.1 conserva los dos recorridos, clasificación obligatoria por servicio, matriz frontend/backend, contexto interno seguro, idempotencia sobre `id`, Turnstile individual y feedback accesible. F1.2 añadió el esquema local versionado y los bindings backend de contexto; F1.3 aplicó únicamente ese esquema aditivo a la D1 real.

**F1 SIGUE ABIERTO.** La migración ya fue aplicada a D1 real, pero Preview, Turnstile/POST reales, evidencia de escritura de un lead nuevo, Queue, integraciones, atribución externa y QA real/manual quedan para lotes posteriores expresamente autorizados.

## Archivos afectados

- Creados: 0.
- Modificados: 1: `docs/IMPLEMENTATION_STATE.md`.
- Eliminados: 0.
- Archivos temporales: 0.
- `migrations/0001_add_contact_context.sql`, `functions/api/contact.js`, `src/contacto.njk`, `src/_data/services.js`, `package.json`, `package-lock.json`, QA/paridad, superficie pública, configuración, templates, media y demás archivos: intactos.

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
- Web3Forms fue eliminado del flujo activo: no queda endpoint, credencial, campo exclusivo ni segundo envío en el frontend.
- Honeypot conserva respuesta neutra sin Turnstile, INSERT ni Queue.
- La inserción nueva persiste estructuralmente `service_code`, `source_page`, `case_id` y `cta_id`; `origen_url` se conserva por compatibilidad. F1.3 confirmó que las cuatro columnas ya existen en D1 real. No se desplegó el backend ni se realizó un POST real en este lote.

### Turnstile y accesibilidad

- El script de Turnstile de Contacto usa `render=explicit`; no se cambió la sitekey ni otra metadata de `pages.js`.
- Cada formulario conserva su propio widget ID; el panel visible se renderiza de forma segura.
- El widget específico se resetea después de un fallo de envío o verificación y se recupera ante expiración/timeout.
- Fallos de carga o disponibilidad muestran feedback accesible.
- Los selectores de recorrido son botones normales con `aria-pressed` y `aria-controls`; el panel inactivo usa `hidden`.
- Cada formulario posee error persistente con `role=alert` y éxito con `role=status`/`aria-live=polite`, ambos enfocables programáticamente; el foco se mueve al resultado relevante.
- El botón se deshabilita durante el envío y recupera su contenido/estado para reintentar.

## Pruebas y resultados de F1

### F1.3 — Aplicación controlada de migración D1

- Precheck Git: PASS exacto; rama `develop`, árbol limpio, HEAD local y `origin/develop` en `cb2ddb768a59d293cc280791de7251b1ce2168c2`; `origin/main` en `880610411ecb4d66f652e8bfaf89e5794231409d`.
- Autenticación/cuenta: PASS; OAuth válido y una sola cuenta disponible.
- Identificación D1: PASS; una única base llamada exactamente `solaz-contactos`.
- Time Travel previo: PASS; bookmark `000019ae-00000000-000050dc-66e15a75728c69361e3adb40fa94e7b1` obtenido antes de escribir.
- Esquema previo: PASS; 19 columnas esperadas y ausencia confirmada de las cuatro columnas nuevas.
- Conteo previo: PASS; `total = 8`.
- Archivo de migración y árbol limpio inmediatamente antes de escribir: PASS.
- Ejecución remota única: PASS; 4 consultas procesadas, sin corrección ni repetición.
- Esquema posterior: PASS; 23 columnas y las cuatro nuevas como `TEXT`, anulables y sin default.
- Conteos posteriores: PASS; `total = 8` y cero valores no nulos en cada columna nueva.
- Privacidad y alcance: PASS; no se leyeron datos personales, no hubo POST real y no se tocó ningún recurso externo salvo D1 `solaz-contactos`.

### F1.2 — Persistencia estructurada

- Intento anterior: BLOQUEADO antes de escribir. `npm run qa` construyó correctamente, pero `qa:parity` rechazó los cambios funcionales F1.1 porque compara `functions/` con el baseline histórico de `main`. El encargo corregido resolvió la contradicción: no ejecutar ese gate ni modificar QA, configuración o baseline.
- Precheck corregido: PASS exacto. Repositorio `SolazStudio/solazstudio-web`, rama `develop`, working tree limpio, HEAD local y `origin/develop` en `c21d4be162952e367850bea91c465ad7eb0ec08b`; `origin/main` en `880610411ecb4d66f652e8bfaf89e5794231409d`; lecturas obligatorias completas.
- `npm ci`: PASS final, 129 paquetes. El primer intento encontró `EBUSY` transitorio en `node_modules/.bin`; se repitió sin tocar archivos versionados y pasó.
- `npm run build` prewrite: PASS; 24 páginas y 742 archivos copiados.
- Manifiesto público prewrite: 766 rutas con SHA-256 individual; hash SHA-256 del manifiesto `df35b8dd62c40bf5274dc03a04cbb871e61b8decfe676d14e84fe57e5c1ed6aa`.
- `npm run build` posterior: PASS; 24 páginas y 742 archivos copiados.
- Comparación `_site`: PASS byte a byte; mismo conjunto de 766 archivos, mismos hashes individuales y mismo hash de manifiesto `df35b8dd62c40bf5274dc03a04cbb871e61b8decfe676d14e84fe57e5c1ed6aa`.
- `node --check functions/api/contact.js`: PASS.
- Migración SQLite local en memoria: PASS; cuatro columnas presentes como `TEXT`, anulables y sin default; fila histórica y datos previos intactos; contexto histórico `NULL`; nueva inserción con los cuatro campos correcta.
- Mocks backend: PASS 9/9, casos A–I. Lead completo guardó los cuatro bindings y produjo 1 INSERT/1 Queue/`deduplicated=false`; opcionales ausentes quedaron `NULL`; source explícito y fallback Referer conservaron pathname/origen compatible; sin fuente produjo ambos `NULL`; contexto inválido se rechazó antes de D1; duplicado no reinsertó ni reencoló; honeypot mantuvo 0 Turnstile/0 D1/0 Queue; Turnstile inválido mantuvo 0 D1/0 Queue.
- Queue: PASS; mensaje exacto con solo `{ id: submissionId }`.
- `git diff --check`: PASS.
- Alcance: PASS; solo la migración creada y los dos archivos modificados autorizados.
- `package-lock.json`: intacto, SHA-256 `F7411FAE482A3FDC543C26245DDFD8F18B56897757D3573CD755D31CF37B671C`.
- Temporales: eliminados antes del commit.
- Recursos externos tocados: NINGUNO.

### F1.1-CORRECCIÓN definitiva

- Precheck Git: PASS exacto. Repositorio `SolazStudio/solazstudio-web`, rama `develop`, working tree limpio, HEAD local y `origin/develop` en `b0c78bc3e75fb98ee8c316d84c465dee3f81f9e9`; `origin/main` en `880610411ecb4d66f652e8bfaf89e5794231409d`.
- Lecturas obligatorias: PASS; estado durable, Contacto, backend y taxonomía revisados antes de escribir.
- `npm ci`: PASS prewrite; 129 paquetes instalados, sin errores.
- `npm run build` prewrite: PASS; 24 páginas y 742 archivos copiados.
- `npm run build` posterior: PASS; 24 HTML, 742 archivos copiados y 766 archivos públicos, sin rutas nuevas.
- Ausencia de Web3Forms: PASS en `src/contacto.njk` y `_site/contacto.html`; sin dominio, `access_key`, access key histórica, `formDataWeb3` ni segundo fetch.
- Flujo frontend estático: PASS; 2/2 formularios con `action="/api/contact"`, `method="POST"`, submit interceptado, un único fetch a `/api/contact`, éxito visual existente y Turnstile intacto.
- `node --check functions/api/contact.js`: PASS; backend sin cambios.
- JavaScript inline funcional extraído desde `_site/contacto.html`: PASS en `node --check`; temporal eliminado.
- Mock backend A — honeypot: PASS; 0 Siteverify, 0 D1, 0 Queue y `ok=true`.
- Mock backend B — lead nuevo: PASS; 1 Siteverify, 1 INSERT, 1 Queue, `ok=true` y `deduplicated=false`.
- Mock backend C — duplicado: PASS; 1 intento D1, 0 Queue, `ok=true` y `deduplicated=true`.
- Mock backend D — Turnstile inválido: PASS; 1 Siteverify, 0 D1, 0 Queue y HTTP 400.
- No regresión F1.1: PASS acotado; dos selectores con opción vacía + 9 servicios, teléfono opcional, matriz general/reunión, “Solicitar reunión”, contexto, UUID, preselección, derivación de caso, Turnstile explícito/individual/reset, estados accesibles, idempotencia backend y 7 CTA parametrizados permanecen intactos.
- Control de alcance: PASS; solo `src/contacto.njk` y `docs/IMPLEMENTATION_STATE.md`.
- `package-lock.json`: intacto, SHA-256 `F7411FAE482A3FDC543C26245DDFD8F18B56897757D3573CD755D31CF37B671C`.
- Recursos externos: no hubo POST real, Preview, Cloudflare, D1/Queue/Turnstile reales, Make, Notion, Worker ni Resend.

### Evidencia del lote F1.1 original

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

## Cambios visuales

F1.3 no introduce cambios visuales ni de UX y no ejecutó build, despliegue o Preview. Diseño, estilos, campos, mensajes, estados, tabs, accesibilidad, contexto visible y Turnstile permanecen iguales al cierre de F1.2.

### Cambios visibles acumulados del F1.1 original

- Dos selectores de servicio integrados con el estilo actual.
- Teléfono marcado como opcional.
- Etiquetas y copy funcional de reunión corregidos para expresar solicitud y confirmación posterior.
- Mensajes persistentes de error/éxito y estado Turnstile.
- Los siete CTA conservan el mismo texto y apuntan a Contacto con querystring de contexto.

No se rediseñó la página ni se modificaron identidad, navegación, footer, proyectos, media, SEO, canonical, JSON-LD/schema o URLs públicas existentes.

## Limitaciones, pendientes y prohibiciones vigentes

- No hubo prueba visual/manual en navegador, responsive manual ni lector de pantalla; el foco y ARIA se verificaron por análisis local.
- No se probó Turnstile real, POST real, escritura de lead nuevo en D1 ni Queue real.
- No se desplegó en Preview ni Production; dentro de Cloudflare solo se modificó la D1 `solaz-contactos`. DNS, Ads, analítica y demás recursos externos permanecieron intactos.
- La migración versionada ya está aplicada en D1 real y el esquema fue verificado; todavía no existe evidencia autorizada de un POST real que ejercite los cuatro bindings.
- Falta decidir la atribución externa completa bajo reglas de privacidad.
- Faltan Preview, Turnstile real, POST controlado, confirmación de escritura única de un lead nuevo en D1, Queue real, Worker consumidor, Notion, Resend, reemplazo posterior de Make y QA visual/manual.
- No crear página/URL/oferta de IA, landings, subservicios, tracking o nuevas rutas sin autorización.
- No iniciar otro lote ni F2, modificar `main`, hacer merge/PR/rama/force push o tocar Production/Cloudflare/recursos reales sin nueva autorización.

## Rollback

F1.3 deja un único cambio documental en `develop` con mensaje `ops: apply contact context migration to D1`. La migración D1 es aditiva y las columnas nuevas son anulables, por lo que no altera los valores históricos. El bookmark previo registrado es `000019ae-00000000-000050dc-66e15a75728c69361e3adb40fa94e7b1`; una restauración Time Travel revertiría también cualquier cambio posterior en la base y no está autorizada. No ejecutar rollback documental ni remoto sin una instrucción expresa y un nuevo precheck.

## Evidencia durable anterior

### F1.2

- Commit: `cb2ddb768a59d293cc280791de7251b1ce2168c2` (`feat: persist contact context in D1`).
- Versionó y validó localmente la migración aditiva y los bindings backend de contexto, sin aplicar entonces cambios a D1 real.

### F1.1-CORRECCIÓN

- Commit: `c21d4be162952e367850bea91c465ad7eb0ec08b` (`fix: remove Web3Forms from contact flow`).
- Eliminó Web3Forms del flujo ejecutable y dejó `Formulario → /api/contact → D1 → CONTACT_QUEUE`, sin segundo proveedor client-side.

### F1.1 original

- Commit: `b0c78bc3e75fb98ee8c316d84c465dee3f81f9e9` (`feat: implement F1 contact flow foundation`).
- Implementó formulario, contexto, validación local, Turnstile individual e idempotencia, pero ChatGPT exigió esta corrección por la vía secundaria Web3Forms activable tras el éxito neutro del honeypot.

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

- Lote: F1.3 — Aplicación controlada de migración en D1 real.
- Fecha: 2026-09-04.
- Objetivo: aplicar exclusivamente `migrations/0001_add_contact_context.sql` sobre la D1 real `solaz-contactos`, con prechecks, bookmark previo y validación posterior sin datos personales.
- Precheck Git: PASS exacto; repositorio `SolazStudio/solazstudio-web`, rama `develop`, árbol limpio, HEAD local y `origin/develop` en `cb2ddb768a59d293cc280791de7251b1ce2168c2`; `origin/main` en `880610411ecb4d66f652e8bfaf89e5794231409d`.
- Autenticación: PASS; sesión OAuth válida, sin repetir el login, y una sola cuenta Cloudflare disponible.
- Identificación D1: PASS; inventario con una sola base llamada exactamente `solaz-contactos`.
- Bookmark previo: `000019ae-00000000-000050dc-66e15a75728c69361e3adb40fa94e7b1`.
- Esquema previo: PASS; `PRAGMA table_info("contacts")` devolvió exactamente las 19 columnas conocidas y confirmó la ausencia de `service_code`, `source_page`, `case_id` y `cta_id`.
- Conteo previo: `total = 8`, obtenido únicamente mediante `SELECT COUNT(*) AS total FROM contacts;`.
- Migración: PASS en una sola ejecución de `npx wrangler d1 execute solaz-contactos --remote --file migrations/0001_add_contact_context.sql --yes`; 4 consultas procesadas.
- Bookmark posterior informado: `000019ae-00000004-000050dc-6103293222cdcf1ae096da4a1252cf21`.
- Esquema posterior: PASS; 23 columnas totales y las cuatro nuevas como `TEXT`, anulables y sin default.
- Conteos posteriores: PASS; `total = 8`, `service_code_con_valor = 0`, `source_page_con_valor = 0`, `case_id_con_valor = 0`, `cta_id_con_valor = 0`.
- Integridad histórica: PASS; el total no disminuyó y las filas previas conservaron `NULL` en las columnas nuevas.
- Privacidad: PASS; no se leyeron filas ni datos personales, solo metadata de esquema y conteos agregados.
- POST real: no realizado, conforme al alcance.
- Archivos: 0 creados, 1 modificado (`docs/IMPLEMENTATION_STATE.md`) y 0 eliminados.
- Pruebas de sitio/build: no ejecutadas; F1.3 no modifica código ni salida pública y el encargo limitó el lote a D1 y documentación.
- Desviaciones: ninguna.
- Recursos externos tocados: únicamente D1 `solaz-contactos`. Queue, Worker, Make, Notion, Resend, Turnstile, Preview, Production web, DNS, Ads y analítica permanecen intactos.
- Commit: único commit con mensaje exacto `ops: apply contact context migration to D1`; el SHA se verifica en el informe final externo porque un commit no puede registrar dentro de sí su propio identificador.
- Push: exclusivamente a `origin/develop`, sujeto a la verificación final posterior al commit.
- Working tree final: debe quedar limpio tras el commit/push y se verifica en el informe final externo.
- Estado de main: debe permanecer en `880610411ecb4d66f652e8bfaf89e5794231409d` y se verifica después del push.
- Criterio de cierre: migración aplicada una sola vez, esquema y conteos verificados, documentación durable actualizada y alcance externo exacto; sujeto a commit/push/verificación remota.
- Pendientes: Preview; Turnstile/POST reales; evidencia de escritura única de un lead nuevo en D1; Queue real; Worker consumidor; Notion; Resend; reemplazo posterior de Make; atribución externa; QA visual/manual; cierre completo de F1.
- Estado de F1: ABIERTO.
- Estado final exacto: COMPLETADO PARA REVISIÓN DE CHATGPT
