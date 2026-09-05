# Estado de implementación

- Fecha: 2026-09-05
- Fase/lote: F2.2 — Recuperación y baseline del Worker actual
- Estado: F2.2 — BLOQUEADO PARA REVISIÓN DE CHATGPT
- Rama: `develop`
- Commit base: `4557de845746aff61727ef3ad7c6130affe436cd`
- Commit del lote: único commit documental que contiene este bloqueo, con mensaje `docs: capture contact worker production baseline`
- Main / Production: INTACTA en `880610411ecb4d66f652e8bfaf89e5794231409d`
- Cloudflare / recursos reales: precheck de solo lectura; cero escrituras remotas
- Bloqueadores: la sesión OAuth de Wrangler no puede usarse para el GET oficial del source mediante las capacidades disponibles sin extraer explícitamente la credencial; Wrangler no ofrece descarga de Workers y el único navegador disponible no tiene sesión Cloudflare. El encargo prohíbe extraer el token o iniciar otro login.
- Siguiente lote: pendiente de revisión de ChatGPT y nueva autorización

## Cierre de F1 por revisión de ChatGPT

- F1.4 fue revisado por ChatGPT y F1 se declara **CERRADO**.
- La frase histórica “F1 sigue abierto” registrada al cierre técnico de F1.4 expresaba el estado provisional anterior a esa revisión.
- El cierre de F1 no requirió ni produjo escrituras adicionales en Cloudflare, D1, Queue, Worker, Notion, email, Preview o Production.
- Queue, Worker, fallos y resiliencia pasan a F2. F2.1 solo inventaría el sistema actual; no construye F2.2.

## F2.2 — Recuperación y baseline del Worker actual

Estado: **F2.2 — BLOQUEADO PARA REVISIÓN DE CHATGPT**.

Precheck local y remoto completado antes de cualquier escritura:

- Repositorio exacto `SolazStudio/solazstudio-web`, rama `develop` y working tree inicial limpio.
- HEAD local, referencia local `origin/develop` y `origin/develop` remoto: `4557de845746aff61727ef3ad7c6130affe436cd`.
- Referencia local y remota `origin/main`: `880610411ecb4d66f652e8bfaf89e5794231409d`.
- `docs/IMPLEMENTATION_STATE.md` leído íntegramente.
- Wrangler `4.112.0` autenticado mediante la sesión existente y una sola cuenta inequívoca.

Estado del Worker verificado por operaciones de solo lectura:

- Worker exacto: `solaz-contact-worker`.
- Deployment activo: `1d21bf44-6d1c-472a-aba7-345ddf6c3172`, creado `2026-07-21T06:41:47.252634Z`, estrategia porcentual y una única versión al `100%`; no hay traffic split.
- Versión activa y última versión disponible: número 6, ID `c1224de0-a9be-4aac-8143-aa2a5bd12ab7`, creada `2026-07-21T06:41:46Z` por Wrangler.
- Etag de script de la versión: `cfd43cd970dd7b0e69f8b90675fa9ba7160d37da05eb46df576b3dc701475864`.
- Handlers: `queue` y `scheduled`; compatibility date `2026-07-01`; sin compatibility flags informadas.
- Bindings inspeccionados solo por nombre/tipo: `CONTACT_QUEUE`/`queue`, `DB`/`d1`, `EMAIL`/`send_email`, `NOTION_DATABASE_ID`/`plain_text` y `NOTION_TOKEN`/`secret_text`. No se reutilizó ni documentó ningún valor.
- La metadata coincide con F2.1 y demuestra que el deployment observado entonces sigue activo y estable.

Bloqueo de recuperación:

- La documentación oficial vigente confirma el GET de descarga `GET /accounts/{account_id}/workers/scripts/{script_name}` y el GET alternativo de contenido `GET /accounts/{account_id}/workers/scripts/{script_name}/content/v2`.
- Wrangler autenticado no expone un comando para descargar el source del Worker.
- El intento de preparar el GET directo fue detenido antes de crear proceso, llamada HTTP, carpeta temporal o archivo porque el único mecanismo disponible requería extraer y manejar explícitamente el token OAuth almacenado. Eso contradice la regla de autenticación del encargo.
- Se comprobó como alternativa una sesión existente del navegador: el navegador integrado llegó a la pantalla de login de Cloudflare y no había otro navegador conectado. No se inició login, no se introdujeron credenciales y no se intentó el endpoint del source desde esa sesión.
- No existe un conector Cloudflare disponible que descargue el source usando la sesión sin exponer credenciales.
- Por tanto no puede sostenerse la correspondencia obligatoria source ↔ versión activa. Se activó exactamente la condición de bloqueo “la única forma exige exponer un token”.

Consecuencias y alcance:

- No se descargó source completo ni parcial.
- No se creó `workers/contact-sync/baseline/`, `BASELINE.md` ni archivo de código.
- No fue posible realizar hashes, comparación byte-for-byte, escaneo de secretos, validación de sintaxis ni análisis estático de `queue()`/`scheduled()`.
- Las transiciones D1, llamadas a Notion, uso de email, ack/retry, reconciliación e idempotencia permanecen no verificables más allá del inventario F2.1; no se infirieron ni corrigieron.
- No se consultaron D1, Notion, email, logs o payloads; no se ejecutó Worker/scheduled; no se enviaron mensajes Queue ni POST funcionales.
- No hubo escrituras Cloudflare ni cambios de Worker, deployment, versión, Queue, triggers, D1, Pages, Preview, Production, bindings, secrets, Make, Notion, Resend, email, DNS, Ads o analítica.
- No se inició F2.3. Sus gaps siguen pendientes y no se diseñaron ni implementaron en este lote bloqueado.
- Único cambio local del lote: este registro documental.

Rollback del lote bloqueado: revertir únicamente el commit documental F2.2 en `develop`. No desplegar el baseline —que no existe— ni modificar Worker, Queue, D1, F2.1, Preview, Production o `main`.

## F2.1 — Inventario real del circuito post-D1

F2.1 reconstruyó en modo solo lectura el circuito posterior a la persistencia, separando evidencia directa, inferencias sustentadas y elementos no verificables con las interfaces disponibles.

Fuentes inspeccionadas:

- Repositorio completo relevante y `functions/api/contact.js`.
- Configuración Pages descargada mediante Wrangler antes/después, con valores sensibles omitidos.
- Inventarios Wrangler de D1, Queue, Worker, deployments, versiones, secrets por nombre/tipo y Workflows.
- Metadata de Queue y versión activa del consumidor.
- Esquema e indicadores agregados de D1 real, sin filas individuales ni PII.
- Documentación oficial vigente de Cloudflare para [configuración de Queue](https://developers.cloudflare.com/queues/configuration/configure-queues/), [batching/retries](https://developers.cloudflare.com/queues/configuration/batching-retries/) y versiones/deployments de Workers.

Mapa factual:

| Componente | Estado | Evidencia y rol actual | Fallo / recuperación verificable |
| --- | --- | --- | --- |
| Pages Function | EXISTE | `functions/api/contact.js` inserta una fila `pending` en D1 y, solo si es nueva, ejecuta `CONTACT_QUEUE.send({ id: submissionId })`. | El envío es best-effort: cualquier excepción de Queue se captura y la respuesta sigue siendo éxito; no reencola ni marca error. |
| D1 real | EXISTE | Binding Production `DB` apunta por ID a `solaz-contactos`; tabla `contacts` de 23 columnas. | Conserva estado durable, pero el repo web no contiene recuperación de filas `pending`/`failed`. |
| Binding `CONTACT_QUEUE` | EXISTE | Pages Production lo enlaza a `solaz-contactos-sync`. | No posee fallback en el productor. |
| Queue real | EXISTE | `solaz-contactos-sync`, ID `dac558e81fd745f8b5b0f6fe97d7e380`; Wrangler informa 2 productores y 1 consumidor. | Cloudflare Queues soporta retries de entrega; política numérica/delay activa no es visible en la CLI disponible. |
| Consumer | EXISTE | Único consumidor push: Worker `solaz-contact-worker`. | La semántica exacta de ack/retry/catch no es verificable sin el source desplegado. |
| Worker | EXISTE | Deployment activo `1d21bf44-6d1c-472a-aba7-345ddf6c3172`; versión 6 `c1224de0-a9be-4aac-8143-aa2a5bd12ab7` al 100%, desplegada el 2026-07-21T06:41:47Z. | Exporta handlers `queue` y `scheduled`; el código desplegado no está disponible mediante Wrangler 4.112.0. |
| Bindings Worker | EXISTEN | Queue real, D1 real, envío de email, identificador Notion como `plain_text` y token Notion como `secret_text`. | No se leyeron valores secretos. El rol exacto del email y la secuencia de escrituras requieren el source. |
| Destino operativo | INFERIDO CON EVIDENCIA CONVERGENTE | Notion: el Worker tiene bindings Notion y 8/8 filas `synced` contienen `notion_page_id` y `synced_at`. | No se accedió a Notion porque la consulta segura disponible no garantizaba excluir páginas/leads. |
| Retry Queue | EXISTE COMO MECANISMO DE PLATAFORMA | El consumidor es push y Cloudflare reintenta entregas fallidas/no reconocidas hasta la política del consumidor. | `max_retries`, delay/backoff, batch size, batch timeout y concurrencia reales no son verificables con la salida CLI disponible; tampoco se verificó si el código fuerza `retry()`. |
| DLQ | NO EXISTE COMO RECURSO SEPARADO | El inventario de cuenta contiene únicamente `solaz-contactos-sync`; una DLQ de Cloudflare debe ser otra Queue. | Tras agotar retries, sin DLQ separada, la plataforma descarta el mensaje; el máximo real no fue visible. |
| Cron / reconciliación | NO VERIFICABLE | La versión activa contiene handler `scheduled`, pero Wrangler no ofrece lectura de schedules y el Dashboard no tenía sesión disponible. No hay código de reconciliación en este repo. | No puede afirmarse que exista un cron activo ni que el handler recupere `pending`/`failed`. |
| Workflows | NO EXISTEN | `wrangler workflows list` informó cero Workflows desplegados en la cuenta. | No aportan recuperación. |
| Alertas | NO VERIFICABLE | Existe binding de email y columna `alerted`; el agregado actual es cero. | No se verificó qué condición envía alertas ni quién actualiza `alerted`. |

Configuración real relevante:

- Pages Production: `DB → solaz-contactos` (`cc1a1efa-7e4a-4e12-a9d9-d65b5cd56380`) y `CONTACT_QUEUE → solaz-contactos-sync`.
- Queue: `solaz-contactos-sync`; 2 productores verificados por bindings — Pages Production y el Worker — y 1 consumidor `solaz-contact-worker`.
- Worker activo: versión 6, compatibility date `2026-07-01`, usage model `standard`, handlers `queue` y `scheduled`.
- Worker no expone handler `fetch` en la versión activa. Las rutas no son verificables con la salida disponible.
- Bindings/variables se registran solo por nombre y tipo; no se documentan valores Notion, destino de email ni secretos.
- No apareció binding/secret explícito de Make o Resend. Sin source desplegado no puede excluirse una referencia embebida, por lo que su participación exacta queda no verificable; no se realizó ninguna llamada externa.

Agregados D1 reales:

- `COUNT(*) = 8` antes y después.
- Por estado: `synced = 8`; `pending = 0`, `syncing = 0`, `failed = 0`.
- Rango agregado `created_at` de los registros `synced`: 2026-07-21 04:21:01 a 2026-08-24 16:39:07.
- `retry_count > 0 = 0`; `MAX(retry_count) = 0`.
- `last_error IS NOT NULL = 0`.
- `notion_page_id IS NOT NULL = 8`.
- `synced_at IS NOT NULL = 8`.
- `alerted != 0 = 0`.
- Esquema antes/después: 23 columnas, mismos tres índices incluida la PK automática, cero triggers y cero escrituras reportadas.

Respuestas factuales A–H:

- **A. Después de `CONTACT_QUEUE.send({ id })`:** la Queue entrega al único consumidor `solaz-contact-worker`. Su versión activa tiene D1, Notion y email disponibles; la evidencia histórica final es 8/8 filas `synced` con referencia Notion y fecha de sincronización. La secuencia interna exacta no es verificable sin source.
- **B. Si falla el consumidor:** una entrega fallida/no reconocida entra en el retry de Cloudflare hasta el máximo configurado; la política exacta y el manejo del Worker no son visibles. No existe DLQ separada, de modo que un mensaje agotado se descarta en la plataforma.
- **C. Quién cambia `sync_status`:** la Function web solo escribe `pending`. El único componente desplegado con consumo de Queue y binding D1 es `solaz-contact-worker`; por eliminación y evidencia agregada, es el actor sustentado que lleva filas a `synced`, aunque sus sentencias exactas no pudieron inspeccionarse.
- **D. Retry real:** existe retry de entrega de Cloudflare para el consumidor push, pero no se verificaron número, delay, backoff ni llamadas explícitas `retry()`. No hay evidencia actual de retry aplicativo en D1: todos los contadores están en cero.
- **E. DLQ:** no existe una Queue separada que pueda cumplir ese rol.
- **F. Reconciliación periódica:** desconocida. Existe un handler `scheduled`, pero no pudo verificarse un Cron Trigger activo ni su lógica; no hay Workflow ni reconciliador versionado aquí.
- **G. Recuperación de un lead que queda `pending` si falla silenciosamente el envío:** no existe una vía demostrada. La Function oculta el fallo de Queue y no marca/reintenta; el posible handler programado no basta para probar recuperación.
- **H. Gap para F2.2:** debe cerrarse específicamente la recuperación durable y observable de `pending`/`failed` entre D1 y Queue/consumer, y hacer verificables la política de retry, DLQ/agotamiento, transiciones de estado y alertas. El diseño concreto queda pendiente de F2.2.

Validación de cero escrituras remotas:

- Solo se ejecutaron listados, descargas de configuración, `info`, `status`, `view`, consultas SQL de esquema/agregados y navegación GET a una pantalla de login no autenticada.
- D1 repitió `total = 8`, esquema/índices idénticos y metadata `rows_written = 0`, `changes = 0`, `changed_db = false`.
- Configuración Pages normalizada antes/después: idéntica, SHA-256 `1b6d3c62001102e6b4c08fba548e127f1b9f1257e72fe6b2de5ac3b4752ee430`.
- Deployment Pages Production canónica: `d5ae0595-dbdf-4b50-9208-f3ab5aa64e22`, rama `main`, source `8806104`; intacta.
- Queue conservó ID, timestamps, 2 productores y 1 consumidor.
- Worker conservó deployment activo y versión 6 al 100%.
- `origin/develop` siguió en la base F2.1 y `origin/main` en `880610411ecb4d66f652e8bfaf89e5794231409d` antes de documentar.

## F1.4 — Preview funcional aislada

F1.4 creó y demostró el circuito aislado `Formulario Preview → /api/contact Preview → D1 solaz-contactos-preview`. La deployment funcional probada es <https://42acd5df.solazstudio-web.pages.dev/> (`42acd5df-fae0-4671-9c54-416fb7a6571e`), generada por la integración Git de Pages desde `develop` y el commit funcional `595ce30b312a0366659a96b4377db42f39c1bfa4`.

Infraestructura y configuración:

- D1 creada: `solaz-contactos-preview`, ID `234b26b3-813f-46c8-9784-36ccf3037abc`, región ENAM.
- Bootstrap exclusivo: `tools/preview/bootstrap_contacts.sql`, fuera de `migrations/`, sin INSERTs ni datos copiados.
- Esquema Preview: tabla `contacts` con 23 columnas, PK sobre `id`, checks compatibles e índices `idx_contacts_created_at` e `idx_contacts_sync_status`.
- Conteo inicial Preview: `0`.
- Binding Preview: `DB → solaz-contactos-preview`.
- Queue Preview: ausente; no existe binding `CONTACT_QUEUE`.
- Variables Preview: `TURNSTILE_SITE_KEY` como `plain_text` y `TURNSTILE_SECRET_KEY` como `secret_text`, ambas de prueba oficial. El secreto no se registra en Git ni en este documento.
- Configuración Production: hash SHA-256 `71d5fcb4f5f94881eaca99c6c0bac757479d06020e5f554b83b1e2bab890227b` antes y después; bindings y secreto Production no se modificaron ni se leyeron.
- Deployment Production canónica: `d5ae0595-dbdf-4b50-9208-f3ab5aa64e22`, commit `880610411ecb4d66f652e8bfaf89e5794231409d`, intacta.

Pruebas funcionales remotas:

- GET `/` y `/contacto/`: HTTP 200.
- HTML de Contacto: 2/2 instancias con la sitekey oficial de prueba y 0 instancias de la sitekey Production.
- Contacto general sintético: HTTP 200, `deduplicated=false`, una fila nueva.
- Solicitud de reunión sintética: HTTP 200, `deduplicated=false`, una segunda fila.
- Idempotencia: reenvío del primer `submission_id`, HTTP 200, `deduplicated=true`, sin tercera fila.
- Turnstile negativo: token ausente, HTTP 400 y `verificacion_fallida`, sin fila adicional.
- Origin negativo: `https://example.com`, HTTP 403 y `origen_no_permitido`, sin fila adicional.
- Conteo final Preview: exactamente `2`, ambas filas sintéticas QA.
- Persistencia verificada sin imprimir PII: ambos `submission_id`, `form_type`, `service_code`, `source_page`, `case_id`, `cta_id`, `sync_status` y presencia de los campos propios de cada recorrido fueron correctos.

Aislamiento demostrado:

- Preview no posee Queue ni bindings hacia Worker, Make, Notion, Resend, email, analítica o Ads.
- La D1 real `solaz-contactos` nunca estuvo enlazada a Preview: conservó `total = 8`, 23 columnas y los mismos índices antes/después. F1.4 no ejecutó ninguna escritura ni POST contra ella.
- Los bookmarks de Time Travel consultados corresponden al timestamp actual y avanzaron entre lecturas automáticas; no se usaron como prueba de mutación. La separación se verificó por IDs de binding, comandos ejecutados, esquema y conteo.
- No hubo deployment Production, merge, PR, rama nueva, DNS ni secretos Production leídos o modificados.

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

F1.1 conserva los dos recorridos, clasificación obligatoria por servicio, matriz frontend/backend, contexto interno seguro, idempotencia sobre `id`, Turnstile individual y feedback accesible. F1.2 añadió el esquema local versionado y los bindings backend de contexto; F1.3 aplicó únicamente ese esquema aditivo a la D1 real. F1.4 añadió configuración de build para Turnstile, aceptación estricta de orígenes Pages del proyecto y una Preview funcional aislada con D1 propia.

El cierre técnico de F1.4 registró provisionalmente **F1 SIGUE ABIERTO**. Tras la revisión de ChatGPT que autorizó F2.1, **F1 QUEDA CERRADO** sin nuevas escrituras ni pruebas funcionales. Queue, Worker y resiliencia se investigan desde F2.

## Archivos afectados

- Creados: 0.
- Modificados: 1: `docs/IMPLEMENTATION_STATE.md`.
- Eliminados: 0.
- Archivos temporales versionados: 0; las dos copias de configuración usadas para comparar se mantuvieron fuera del repositorio y se eliminan al cierre.
- Código funcional, migraciones, templates, configuración, `package.json`, `package-lock.json`, QA/paridad, rutas públicas y media: intactos.

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
- `source_page` válido se transforma de forma segura en una URL canónica Solaz para la columna existente `origen_url`. El fallback de Referer admite Production solo cuando el request también es Production, o el mismo origen Preview estricto cuando el request usa un subdominio HTTPS de `.solazstudio-web.pages.dev`; la URL persistida conserva el dominio canónico `solazstudio.cl`.
- Los dos orígenes Production siguen siendo exactamente `https://solazstudio.cl` y `https://www.solazstudio.cl`. Un origen Preview solo se acepta si usa HTTPS, su hostname termina exactamente en `.solazstudio-web.pages.dev` y el Origin coincide con `new URL(request.url).origin`; no se acepta la raíz `solazstudio-web.pages.dev`, un `*.pages.dev` genérico ni cruces entre Previews.
- Cada formulario recibe al inicializar un UUID propio mediante APIs nativas del navegador. El identificador se conserva durante reintentos y no se regenera por un error.
- `submission_id` validado usa la columna `contacts.id` existente.
- La inserción usa una única sentencia `INSERT ... SELECT ... WHERE NOT EXISTS`; el resultado de D1 determina si se insertó la fila.
- Una primera inserción encola una vez y responde `deduplicated=false`; un reintento con el mismo UUID no inserta ni encola de nuevo y responde `deduplicated=true`.
- D1 sigue siendo la primera persistencia y Queue se ejecuta después como entrega best-effort; un fallo o ausencia de Queue posterior no invalida el guardado. En Preview, `CONTACT_QUEUE` está deliberadamente ausente y el recorrido termina en la D1 aislada.
- Web3Forms fue eliminado del flujo activo: no queda endpoint, credencial, campo exclusivo ni segundo envío en el frontend.
- Honeypot conserva respuesta neutra sin Turnstile, INSERT ni Queue.
- La inserción nueva persiste estructuralmente `service_code`, `source_page`, `case_id` y `cta_id`; `origen_url` se conserva por compatibilidad. F1.3 confirmó que las cuatro columnas ya existen en D1 real y F1.4 las ejercitó únicamente en D1 Preview. No se realizó un POST contra Production.

### Turnstile y accesibilidad

- El script de Turnstile de Contacto usa `render=explicit`; no se cambió otra metadata de `pages.js`.
- `src/_data/environment.js` expone `environment.turnstileSiteKey`: toma `TURNSTILE_SITE_KEY` durante el build y conserva como fallback la sitekey pública Production preexistente. Las dos instancias Nunjucks usan esa propiedad; la clave pública de prueba no está versionada en templates ni configuración del repositorio.
- Cada formulario conserva su propio widget ID; el panel visible se renderiza de forma segura.
- El widget específico se resetea después de un fallo de envío o verificación y se recupera ante expiración/timeout.
- Fallos de carga o disponibilidad muestran feedback accesible.
- Los selectores de recorrido son botones normales con `aria-pressed` y `aria-controls`; el panel inactivo usa `hidden`.
- Cada formulario posee error persistente con `role=alert` y éxito con `role=status`/`aria-live=polite`, ambos enfocables programáticamente; el foco se mueve al resultado relevante.
- El botón se deshabilita durante el envío y recupera su contenido/estado para reintentar.

## Pruebas y resultados acumulados

### F2.1 — Inventario real del circuito post-D1

- Precheck Git/Cloudflare: PASS exacto; base `f006a37c3aa9fc20f1230112c25e6471b223596f`, rama `develop`, árbol limpio, una cuenta autenticada y proyecto Pages `solazstudio-web` inequívoco.
- Inventario repo: PASS; productor e inserción `pending` verificados, consumidor ausente del repositorio.
- Pages Production: PASS; bindings reales `DB` y `CONTACT_QUEUE` identificados sin leer secrets.
- Queue: PASS; una Queue exacta, dos productores y un consumidor identificados sin leer mensajes.
- Worker: PASS; deployment, versión activa, handlers, runtime y bindings identificados; source y schedules no verificables con Wrangler disponible.
- Workflows: PASS; ninguno desplegado.
- D1: PASS; solo esquema/agregados, 8 filas `synced`, cero retries/errores/alertas, 8 referencias Notion y 8 fechas de sincronización; cero PII.
- Cero escrituras: PASS; D1, Pages, Queue, Worker y refs permanecieron iguales antes/después.
- Pruebas funcionales/build: no ejecutadas, conforme al carácter exclusivamente diagnóstico/documental de F2.1.

### F1.4 — Preview funcional aislada

- Precheck Git: PASS exacto en el estado de entrada; repositorio `SolazStudio/solazstudio-web`, rama `develop`, árbol limpio, HEAD local y `origin/develop` en `3ede11ea52596c526e4b855bcf60b2141004d81e`; `origin/main` en `880610411ecb4d66f652e8bfaf89e5794231409d`.
- Precheck Cloudflare: PASS; OAuth válido, una sola cuenta, proyecto Pages exacto `solazstudio-web`, D1 Preview inicialmente inexistente y configuración Preview sin D1, Queue ni variables. Se confirmó un método API soportado para cambiar solo `deployment_configs.preview`.
- Snapshot Production: PASS; binding `DB` a la D1 real, binding `CONTACT_QUEUE` y variable secreta Turnstile identificados solo por nombre/tipo/destino; ningún valor secreto fue leído. Hash de configuración `71d5fcb4f5f94881eaca99c6c0bac757479d06020e5f554b83b1e2bab890227b`.
- Estructura D1 real de solo lectura: PASS; 23 columnas, PK, checks, dos índices funcionales y ningún trigger, sin consultar filas ni PII.
- `npm ci`: PASS final; 129 paquetes instalados y 130 auditados, 0 vulnerabilidades. Dos intentos iniciales encontraron un bloqueo local `EBUSY` en `node_modules`; se apartó solo el output generado y la instalación limpia pasó.
- Build con fallback Production: PASS; 24 páginas, 742 archivos copiados, dos sitekeys públicas Production y cero sitekeys de prueba.
- Build con variable Preview efímera: PASS; 24 páginas, 742 archivos copiados, dos sitekeys públicas de prueba y cero sitekeys Production. Un primer intento encontró `EBUSY` al limpiar `_site`; se apartó solo ese output generado y el reintento pasó.
- `qa:assets`: no existe en `package.json`. `qa:parity` no se ejecutó porque compara contra la salida histórica y no es un gate aplicable a cambios funcionales F1 autorizados.
- Sintaxis: PASS para `functions/api/contact.js` y `src/_data/environment.js`.
- Pruebas dirigidas locales: PASS para origen Preview same-origin; rechazo de raíz del proyecto, otro proyecto y cruce entre Previews; orígenes Production preservados; Referer Preview same-origin y canonicalización; rechazo de Referer Production en un request Preview; ausencia segura de Queue; y bootstrap de 23 columnas, índices y cero filas.
- D1 Preview: PASS; `solaz-contactos-preview` creada e inicializada solo con el bootstrap Preview, sin datos copiados; conteo inicial `0`.
- Deployment funcional: PASS; ID `42acd5df-fae0-4671-9c54-416fb7a6571e`, URL <https://42acd5df.solazstudio-web.pages.dev/>, entorno Preview, commit `595ce30b312a0366659a96b4377db42f39c1bfa4` y todas las etapas exitosas.
- GET remoto: PASS; `/` y `/contacto/` devolvieron HTTP 200; Contacto incluyó dos sitekeys de prueba y ninguna Production.
- POST general y reunión: PASS; dos envíos sintéticos distintos devolvieron HTTP 200, `ok=true`, `deduplicated=false` y generaron exactamente dos filas en D1 Preview.
- Persistencia selectiva: PASS sin imprimir PII; IDs `f1400000-0000-4000-8000-000000000001` y `f1400000-0000-4000-8000-000000000002`, tipos `mensaje`/`reunion`, contexto estructurado, estado `pending` y presencia de campos propios de cada recorrido correctos.
- Idempotencia: PASS; reenvío exacto del primer ID devolvió HTTP 200 y `deduplicated=true`, sin tercera fila.
- Turnstile negativo: PASS; token ausente devolvió HTTP 400 y `verificacion_fallida`, sin fila nueva.
- Origin negativo: PASS; `https://example.com` devolvió HTTP 403 y `origen_no_permitido`, sin fila nueva.
- Conteo final Preview: PASS; exactamente `2` filas sintéticas QA.
- Aislamiento: PASS; Preview quedó con `DB` a la D1 Preview y sin Queue. D1 real conservó 23 columnas, los mismos índices y `total = 8`; no recibió comandos de escritura ni POST. Production conservó idéntica configuración y deployment canónica.
- `git diff --check`: PASS antes del commit funcional; alcance de código limitado a los cuatro archivos autorizados.

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

F2.1 no introduce cambios visuales, funcionales ni de UX. No ejecutó build, prueba funcional ni deployment manual; el único efecto de publicación permitido es la Preview automática derivada del commit documental.

### Cambios visibles acumulados del F1.1 original

- Dos selectores de servicio integrados con el estilo actual.
- Teléfono marcado como opcional.
- Etiquetas y copy funcional de reunión corregidos para expresar solicitud y confirmación posterior.
- Mensajes persistentes de error/éxito y estado Turnstile.
- Los siete CTA conservan el mismo texto y apuntan a Contacto con querystring de contexto.

No se rediseñó la página ni se modificaron identidad, navegación, footer, proyectos, media, SEO, canonical, JSON-LD/schema o URLs públicas existentes.

## Limitaciones, pendientes y prohibiciones vigentes

- El source del Worker desplegado no pudo obtenerse mediante Wrangler 4.112.0; el Dashboard no tenía sesión disponible y no se inició login ni se extrajo OAuth.
- La CLI no expuso la configuración real de `max_retries`, delay/backoff, batch size, batch timeout o concurrencia del consumer.
- La existencia de handler `scheduled` está verificada, pero el Cron Trigger y su lógica no son verificables con la interfaz segura disponible.
- Notion es el destino operativo sustentado por bindings y agregados; no se consultó su base porque no existía garantía de excluir páginas/leads y PII.
- No hay evidencia verificable de recuperación del gap D1 `pending` → fallo silencioso de `Queue.send`.
- F2.2 debe abordar los gaps objetivos de resiliencia solo después de revisión y autorización; F2.1 no define todavía su diseño detallado.
- No crear página/URL/oferta de IA, landings, subservicios, tracking o nuevas rutas sin autorización.
- No iniciar F2.2, modificar `main`, hacer merge/PR/rama/force push o tocar Production/Cloudflare/recursos reales sin nueva autorización.

## Rollback

F2.1 no modifica infraestructura ni código funcional. Su rollback es revertir únicamente el commit documental F2.1 sobre la base `f006a37c3aa9fc20f1230112c25e6471b223596f`. No revertir F1.4, no modificar Cloudflare y no tocar D1, Queue, Worker, Preview, Production ni `main`.

## Evidencia durable anterior

### F1.4

- Commits: `595ce30b312a0366659a96b4377db42f39c1bfa4` (`feat: add isolated functional preview`) y `f006a37c3aa9fc20f1230112c25e6471b223596f` (`docs: record F1.4 isolated preview evidence`).
- Demostró los dos formularios, persistencia D1 Preview, contexto, idempotencia, Turnstile y aislamiento. ChatGPT lo revisó y declaró F1 cerrado antes de F2.1.

### F1.3

- Commit: `3ede11ea52596c526e4b855bcf60b2141004d81e` (`ops: apply contact context migration to D1`).
- Aplicó una sola vez la migración aditiva a D1 real, preservó ocho filas históricas y documentó esquema final de 23 columnas sin leer PII ni realizar POST.

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

## INFORME CODEX — F2.1

- Lote: F2.1 — Inventario real del circuito post-D1.
- Fecha: 2026-09-04.
- Precheck: PASS exacto; repositorio `SolazStudio/solazstudio-web`, rama `develop`, árbol limpio, HEAD local y `origin/develop` en `f006a37c3aa9fc20f1230112c25e6471b223596f`; `origin/main` en `880610411ecb4d66f652e8bfaf89e5794231409d`; Wrangler 4.112.0 autenticado, una cuenta y proyecto Pages inequívoco.
- Cierre F1: registrado; F1.4 fue revisado por ChatGPT y F1 queda CERRADO sin escrituras adicionales. Queue/Worker/resiliencia pasan a F2.
- Archivos: 0 creados, 1 modificado (`docs/IMPLEMENTATION_STATE.md`) y 0 eliminados; ningún temporal versionado.
- Circuito real: Pages Function inserta `pending` en D1, intenta `CONTACT_QUEUE.send({ id })`, Queue `solaz-contactos-sync` entrega al Worker `solaz-contact-worker`; Notion es el destino operativo sustentado y existe binding de email cuyo uso exacto no pudo verificarse.
- Queue: ID `dac558e81fd745f8b5b0f6fe97d7e380`, 2 productores y 1 consumidor push.
- Consumer/Worker: `solaz-contact-worker`; deployment activo `1d21bf44-6d1c-472a-aba7-345ddf6c3172`, versión 6 `c1224de0-a9be-4aac-8143-aa2a5bd12ab7` al 100%, handlers `queue` y `scheduled`, runtime estándar y compatibility date `2026-07-01`.
- Bindings Worker: Queue, D1, email, variable Notion `plain_text` y secret Notion `secret_text`; ningún valor sensible se registra.
- Destino: Notion inferido con evidencia convergente — bindings directos más 8/8 contactos `synced` con referencia Notion y `synced_at`. No se leyeron páginas/leads de Notion.
- Retry: Cloudflare provee retry de entrega al consumidor push, pero la política activa (`max_retries`, delay/backoff, batch y concurrencia) y el uso explícito de ack/retry no son verificables mediante la CLI disponible.
- DLQ: no existe Queue separada; el inventario contiene una sola Queue. Un mensaje que agote retries no tiene DLQ demostrada y la plataforma lo descarta.
- Cron/reconciliación: handler `scheduled` presente, pero Cron Trigger y código no verificables; cero Workflows desplegados y ningún reconciliador en este repositorio.
- D1 agregado: `total=8`; `synced=8`; restantes estados 0; retry_count positivo 0; máximo 0; last_error no nulo 0; notion_page_id no nulo 8; synced_at no nulo 8; alerted distinto de 0 igual a 0.
- A — Después del send: Queue entrega al único consumer y la evidencia histórica termina en Notion/`synced`; secuencia interna no verificable.
- B — Ante fallo de consumer: aplica retry de plataforma si la entrega falla/no se reconoce; política y transiciones D1 exactas desconocidas; sin DLQ separada.
- C — Quién cambia `sync_status`: la web solo escribe `pending`; el único actor desplegado con Queue + D1 es el Worker, por lo que es el actor sustentado para `synced`, aunque no se inspeccionó su SQL.
- D — Retry real: existe a nivel de entrega Cloudflare; configuración concreta y retry aplicativo no verificables. D1 no registra retries en las ocho filas actuales.
- E — DLQ: no existe como recurso separado.
- F — Reconciliación: no demostrada; handler programable presente, cron/lógica desconocidos y sin Workflow.
- G — Recuperación de `pending` tras fallo silencioso de envío: no existe vía verificable; es el gap crítico.
- H — Gap F2.2: recuperación durable/observable de `pending`/`failed`, política de retry/agotamiento, DLQ y alertas verificables; diseño pendiente de autorización.
- Elementos no verificables: source desplegado, schedules/cron, configuración detallada del consumer, ack/retry del código, rol exacto del email y posible referencia embebida a servicios sin binding.
- Cero escrituras remotas: PASS; D1 reportó `rows_written=0`, `changes=0`, `changed_db=false`; Pages tuvo hash normalizado idéntico antes/después; Queue y Worker conservaron metadata/deployment; no hubo POST funcional, mensajes, purge, trigger, logs, llamadas Notion/Make/Resend/email ni cambios Cloudflare.
- Pruebas de código/build: no ejecutadas, conforme al lote documental.
- Commit: único commit documental con mensaje `docs: record F2.1 post-D1 inventory`; el SHA se verifica en el informe externo porque un commit no puede contener su propio identificador.
- Push: exclusivamente a `origin/develop`, sujeto a verificación final; una Preview automática documental está autorizada sin pruebas ni cambios de bindings.
- Main/Production: `origin/main` debe permanecer en `880610411ecb4d66f652e8bfaf89e5794231409d`; deployment Pages Production canónica `d5ae0595-dbdf-4b50-9208-f3ab5aa64e22`, configuración Pages, Queue y Worker deben permanecer intactos tras el push.
- Desviaciones/incidencias no materiales: el Dashboard no tenía sesión y no se inició login; Wrangler no expuso source/schedules/settings detallados; `versions view` emitió metadata `plain_text` adicional no seleccionable, que no se reutilizó ni documentó; una ayuda CLI no pudo escribir su log local por `EPERM`, sin efecto remoto. No hubo desviación material ni escritura remota.
- Rollback: revertir únicamente el commit documental F2.1; no revertir F1.4 ni modificar Cloudflare, D1, Queue, Worker, Preview, Production o `main`.
- Siguiente lote: pendiente de revisión de ChatGPT y autorización expresa; no iniciar F2.2.
- Estado de F1: CERRADO.
- Estado final exacto: COMPLETADO PARA REVISIÓN DE CHATGPT

## INFORME CODEX — ÚLTIMO LOTE

- Lote: F2.2 — Recuperación y baseline del Worker actual.
- Fecha: 2026-09-05.
- Estado: **F2.2 — BLOQUEADO PARA REVISIÓN DE CHATGPT**.
- Precheck: PASS exacto; repositorio `SolazStudio/solazstudio-web`, rama `develop`, árbol inicial limpio, HEAD local y `origin/develop` local/remoto en `4557de845746aff61727ef3ad7c6130affe436cd`; `origin/main` local/remoto en `880610411ecb4d66f652e8bfaf89e5794231409d`; estado durable leído íntegramente; Wrangler 4.112.0 autenticado y una cuenta inequívoca.
- Archivos: 0 creados, 1 modificado (`docs/IMPLEMENTATION_STATE.md`) y 0 eliminados. No existe baseline parcial ni temporal creado por la recuperación.
- Worker: `solaz-contact-worker` inequívoco.
- Deployment activo: `1d21bf44-6d1c-472a-aba7-345ddf6c3172`, una versión al 100%, sin traffic split.
- Versión activa: número 6, `c1224de0-a9be-4aac-8143-aa2a5bd12ab7`; es también la última versión listada. Etag `cfd43cd970dd7b0e69f8b90675fa9ba7160d37da05eb46df576b3dc701475864`, handlers `queue,scheduled`, compatibility date `2026-07-01`.
- Método GET previsto: descarga oficial `GET /accounts/{account_id}/workers/scripts/solaz-contact-worker`; no se ejecutó porque la capacidad disponible exigía extraer el OAuth de Wrangler. También se verificó documentalmente el GET `.../content/v2`, sin ejecutarlo.
- Correspondencia source/version: NO DEMOSTRADA porque no se obtuvo el source; esta ausencia obliga el bloqueo aunque la versión activa sea única, última y estable.
- Formato/source/baseline/hashes: no disponibles; no se creó `workers/contact-sync/baseline/` ni `BASELINE.md`.
- Seguridad: ningún token, secret, valor de binding, lead, PII o contenido D1 se mostró, copió o versionó. El escaneo del source no pudo realizarse porque el source no fue descargado.
- Byte-for-byte y sintaxis: no aplicables sin source.
- `queue()`, D1, Notion, email, retry/ack, `scheduled()`, reconciliación e idempotencia: el análisis F2.2 no pudo ejecutarse; siguen no verificables con la precisión requerida y no se presentan inferencias nuevas.
- Gaps F2.3: no se definieron ni implementaron; el lote se detuvo antes de esa etapa.
- Puntos no verificables: código desplegado, lógica interna completa y su correspondencia con la versión activa; por derivación, transiciones y comportamiento real solicitados.
- Pruebas locales: precheck Git, lectura documental, validación de disponibilidad de capacidades, `git diff --check` PASS y control de alcance PASS con solo este documento modificado. No se ejecutaron build, npm, POST, Worker, scheduled, Queue, D1, Notion ni email.
- Cero escrituras Cloudflare: PASS. Solo se usaron Wrangler `whoami`, deployments/versions GET/list/view y navegación GET a la pantalla de login. El GET del source no llegó a ejecutarse. No hubo deploy, upload, publish, create, update, apply, send, purge, POST, PUT, PATCH o DELETE.
- Commit: único commit documental previsto con mensaje `docs: capture contact worker production baseline`; el SHA se verifica en el informe externo porque el commit no puede contener su propio identificador.
- Push: exclusivamente a `origin/develop`, sujeto a verificación final; una Preview automática documental queda permitida como efecto de la integración, sin probarla ni modificarla.
- Main/Production/Worker/Queue: verificados intactos antes del commit. `origin/main` permanece en `880610411ecb4d66f652e8bfaf89e5794231409d`; Pages Production conserva deployment `d5ae0595-dbdf-4b50-9208-f3ab5aa64e22`, rama `main`, source `8806104`; Queue `solaz-contactos-sync` conserva ID `dac558e81fd745f8b5b0f6fe97d7e380`, 2 productores y el único consumidor `solaz-contact-worker`; el Worker conserva deployment/versión/porcentaje. No se realizó ninguna acción de escritura sobre ellos.
- Desviaciones: ninguna material. La recuperación se bloqueó por una condición prevista del encargo; el intento inseguro fue rechazado antes de ejecutar proceso o llamada HTTP y la alternativa del navegador no disponía de sesión autenticada. No se inició un nuevo login.
- Rollback: revertir únicamente el commit documental F2.2 en `develop`; no modificar Worker, Queue, D1, F2.1, Preview, Production o `main`.
- Siguiente lote: pendiente de revisión de ChatGPT y nueva autorización. No iniciar F2.3.
- Estado final exacto: BLOQUEADO PARA REVISIÓN DE CHATGPT
