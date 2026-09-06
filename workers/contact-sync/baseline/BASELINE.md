# SOLAZ-CONTACT-WORKER — PRODUCTION BASELINE

> SNAPSHOT DE REFERENCIA.
>
> NO DESPLEGAR DIRECTAMENTE.
>
> NO ES TODAVÍA EL WORKER GESTIONADO POR ESTE REPOSITORIO.

## Identidad y recuperación

- Snapshot: `2026-09-06T03:00:01Z` (UTC).
- Worker: `solaz-contact-worker`.
- Deployment activo: `1d21bf44-6d1c-472a-aba7-345ddf6c3172`.
- Versión activa: número 6, ID `c1224de0-a9be-4aac-8143-aa2a5bd12ab7`, 100% del tráfico y sin traffic split.
- Etag remoto de script: `cfd43cd970dd7b0e69f8b90675fa9ba7160d37da05eb46df576b3dc701475864`.
- Handlers remotos: `queue` y `scheduled`.
- Compatibility date: `2026-07-01`.
- Método: `wrangler init --from-dash solaz-contact-worker` mediante la implementación incorporada de Wrangler (`--no-delegate-c3`), sin deploy ni escritura remota.
- Wrangler: `4.112.0`.
- Entrypoint recuperado: `src/index.js`.
- Cron recuperado en la configuración: `*/10 * * * *`.
- Bindings recuperados, documentados solo por nombre/tipo: `CONTACT_QUEUE`/Queue, `DB`/D1, `EMAIL`/send_email, `NOTION_DATABASE_ID`/plain_text y `NOTION_TOKEN`/secret_text.

## Archivos e integridad

Archivo preservado del dashboard:

- `src/index.js`: 5.293 bytes; SHA-256 `f899e72d438bc63a871d6480349bba6f7fd618f8e2d68bba8902d22063f80b7c`.

Archivos de control creados en el repositorio, no recuperados del dashboard:

- `BASELINE.md`: este registro.
- `.gitattributes`: marca `src/index.js` como `-text` para impedir conversiones de fin de línea y conservar sus bytes en futuros checkouts.

Hash reproducible del conjunto preservado: SHA-256 `d0b9623ddd80a497b6a454b21c289682eb68ecbf0e09dd5af3b78a94ac5da51d`, calculado sobre el texto UTF-8 exacto `src/index.js\nsha256:f899e72d438bc63a871d6480349bba6f7fd618f8e2d68bba8902d22063f80b7c\n`.

Wrangler también escribió `wrangler.jsonc` y `.wrangler/cache/wrangler-account.json`. El primero es configuración reconstruida a partir del dashboard y contenía valores operativos que no hacen falta para estudiar el código; se omitió y su estructura segura queda resumida arriba. El segundo es cache/scaffold local de cuenta. Ninguno fue versionado. No se generaron ni copiaron `node_modules`, lockfiles, logs, `.env`, `.dev.vars`, credenciales o temporales.

## Seguridad

El escaneo previo a la copia no detectó API keys literales, tokens, credenciales, contraseñas, private keys, secretos Notion/Resend, webhooks secretos ni URLs con credenciales. `Authorization` y `Bearer` aparecen solo para construir el header con `env.NOTION_TOKEN`; el valor no está embebido. Las dos direcciones literales son buzones operativos del dominio público del proyecto, no PII de leads. No se leyó ni versionó ningún valor secreto ni contenido de D1/Notion.

## Garantía de fidelidad

`src/index.js` es byte-for-byte idéntico al archivo emitido por Wrangler en la recuperación: mismo tamaño y SHA-256. La operación oficial se ejecutó contra el Worker exacto mientras su deployment mantenía una única versión activa al 100%; nombre, entrypoint, handlers, compatibility date y bindings son coherentes con la metadata de esa versión.

No se afirma igualdad byte-for-byte con la respuesta HTTP cruda ni con el etag remoto: `--from-dash` abstrae la descarga y además genera configuración/scaffold local. La garantía demostrable es recuperación oficial, correspondencia inequívoca con el Worker activo y preservación byte-for-byte del módulo que Wrangler entregó.

## Análisis estático del snapshot

- Entrypoint ES module: export default de un objeto con solo `queue(batch, env)` y `scheduled(event, env, ctx)`; no hay `fetch` ni otros handlers.
- Queue: recorre `batch.messages` en serie, toma `message.body.id`, procesa por mensaje y llama `ack()` tras retorno normal o `retry()` dentro del `catch`. No usa `retryAll()` ni relanza el error; un fallo queda aislado al mensaje, no al batch.
- D1: carga `SELECT *` por `id`; retorna si no existe o si ya está `synced`; antes de Notion cambia a `syncing`. En éxito escribe `synced`, `notion_page_id`, `synced_at=datetime('now')` y limpia `last_error`. En error incrementa desde el `retry_count` leído, guarda `last_error` truncado a 1.000 caracteres y deja `pending` hasta el quinto fallo o `failed` desde el sexto. `alerted` solo cambia tras una alerta enviada.
- Notion: solo crea (`POST https://api.notion.com/v1/pages`); no busca ni actualiza. Usa `NOTION_TOKEN` y `NOTION_DATABASE_ID`, arma propiedades desde D1 y considera éxito cualquier respuesta HTTP `ok`, tomando `data.id`. Para 429 calcula `Retry-After`, pero ese dato no controla ningún delay local; los 5xx se marcan conceptualmente retryable, aunque el consumidor reintenta cualquier error por igual.
- Email: el handler programado selecciona hasta 20 filas `failed`, con al menos seis intentos y `alerted=0`; envía una alerta resumen. Solo después de un envío exitoso marca esas filas `alerted=1`. El `catch` del email está vacío, por lo que el fallo queda silencioso y las filas siguen disponibles para otro cron.
- Scheduled/reconciliación: selecciona hasta 50 filas `pending` con más de diez minutos o `failed` con menos de seis intentos, y las reencola una a una; no sincroniza directamente. El cron recuperado `*/10 * * * *` demuestra que la lógica tiene trigger remoto activo cada diez minutos al momento del snapshot.
- Recuperación del fallo silencioso del productor: sí. Una fila que permanece `pending` tras fallar `CONTACT_QUEUE.send()` en Pages entra en la consulta cuando supera diez minutos y `scheduled()` vuelve a enviar `{ id }` a `CONTACT_QUEUE`, siempre que quede dentro del límite de 50 y la ejecución/reencolado no fallen.
- Idempotencia D1: el retorno temprano de `synced` evita reprocesar una fila ya confirmada; no hay claim atómico ni compare-and-set para `pending/syncing`, por lo que entregas concurrentes pueden procesar la misma fila.
- Idempotencia Queue: no hay deduplicación, clave de idempotencia ni exclusión de una fila `syncing`; reentregas y reencolados pueden solaparse.
- Idempotencia Notion: `notion_page_id` no se consulta antes del POST y no hay search/update ni clave idempotente. Si Notion crea la página pero la respuesta se pierde, o si falla la escritura D1 posterior, el retry puede crear duplicados.
- Retries: coexisten retry de Queue por `message.retry()`, contador aplicativo D1 y reencolado cron. El consumidor captura todos los errores y no los relanza, pero marca explícitamente el mensaje fallido para retry; no hay riesgo visible de que ese mensaje se reconozca como exitoso por el catch. Sí existe riesgo de deriva del contador ante concurrencia y de repetición sin delay aplicativo.

## Gaps para un lote posterior

- Idempotencia fuerte/atómica alrededor de D1 y Notion, incluida recuperación del caso "Notion creado, D1 no actualizado".
- Claim/lock transaccional o compare-and-set que impida procesamiento concurrente de la misma fila.
- Política Queue completa y durablemente versionada (batch, retries, delay/backoff, concurrencia y eventual DLQ); el snapshot no incluye una DLQ.
- Backoff real para 429/5xx y uso efectivo de `Retry-After`; hoy solo se calcula.
- Tratamiento de filas atascadas en `syncing`; el cron solo consulta `pending` y `failed`.
- Paginación/drain verificable para límites de 50 pendientes y 20 alertas, además de observabilidad de fallos de reencolado y email.
- Control de errores al parsear respuestas no JSON de Notion y conservación segura de diagnósticos.
- Código fuente y configuración administrados por el repositorio con proceso de deploy/rollback separado y explícitamente autorizado. Este baseline no cubre ni inicia F2.3.

## Uso y rollback

Este directorio es solo evidencia durable para revisión y diseño posterior. No ejecutar ni desplegar directamente. Para retirar el snapshot, revertir únicamente el commit de continuación F2.2 que lo incorporó; no modificar el Worker, Queue, D1, Production, `main` ni el commit histórico del bloqueo anterior.
