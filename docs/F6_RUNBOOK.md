# F6 — Runbook de QA y observabilidad

Este runbook describe controles reproducibles y consultas de solo lectura. No autoriza cambios en recursos reales, despliegues, migraciones, mensajes Queue, envíos de formularios ni tratamiento de datos personales.

## QA local y CI

- `npm run build`: genera `_site`; falla ante errores de Eleventy o del pipeline de imágenes.
- `npm run qa:media`: protege las 719 imágenes editoriales, carga progresiva, variantes responsivas y lightbox.
- `npm run qa:video`: protege los tres heroes, sus posters y atributos de autoplay.
- `npm run qa:f4`: ejecuta accesibilidad global, contrato local del contacto/Turnstile y guardas de cumplimiento.
- `npm run qa:privacy`: verifica consentimiento, medición, atribución, lead ID, menú y filtros sin red real.
- `npm run qa:syntax`: valida sintaxis de Function, Worker y smoke remoto.
- `npm run qa:site`: valida los 24 HTML, enlaces y fragmentos internos, sitemap, canonical, `noindex` y URLs limpias.
- `npm run qa:worker`: ejecuta los tests locales del consumidor y reconciliador.
- `npm run qa:parity`: comprueba la integridad de la superficie pública y los assets protegidos.
- `npm run qa`: es la compuerta consolidada. Cualquier subcomando distinto de cero bloquea commit/release; el nombre del bloque y su salida identifican el área responsable.

GitHub Actions ejecuta `npm ci` y `npm run qa` en cada push a `develop` y en cada pull request cuyo destino sea `develop`. No usa secretos ni despliega.

## Smoke remoto de solo lectura

Solo con una URL base expresamente autorizada:

```text
node scripts/smoke-readonly.mjs https://preview-autorizado.example
```

No existe URL por defecto. El script realiza únicamente cuatro `GET` (`/`, `/contacto`, `/robots.txt`, `/sitemap.xml`), comprueba respuestas exitosas, canonical de Home/Contacto y el dominio del sitemap. No envía formularios, no crea leads, no toca Queue y no genera eventos de medición deliberados. Production requiere autorización separada aunque la URL se entregue explícitamente.

## Observabilidad de solo lectura

Cada acceso a Cloudflare requiere autorización separada y debe limitarse al recurso identificado. Para D1, la inspección estructural permitida es únicamente:

```sql
PRAGMA table_info(contacts);
```

El estado operativo puede resumirse sin PII con:

```sql
SELECT sync_status, COUNT(*) AS total
FROM contacts
GROUP BY sync_status
ORDER BY sync_status;
```

No seleccionar filas, IDs, nombres, correos, teléfonos, mensajes, URLs de origen, atribución ni errores potencialmente derivados del contenido del lead.

En Cloudflare, inspeccionar por separado:

1. Queue `solaz-contactos-sync`: consumidor vinculado, backlog, entregas/reintentos y errores agregados.
2. Worker `solaz-contact-worker`: versión activa, handlers `queue`/`scheduled`, bindings solo por nombre/tipo, cron, invocaciones, excepciones y logs técnicos saneados.
3. Consumer: resultados de ack/retry, reintentos agotados y ejecución programada. No copiar cuerpos de mensajes ni payloads.

Una Queue vacía solo demuestra ausencia de mensajes visibles en ese instante. No demuestra que cada contacto esté `synced`, que D1 tenga `notion_page_id`, ni que Notion contenga exactamente una página. La sincronización Notion solo se considera validada cuando existe evidencia correlacionada y autorizada de D1 + Worker/Queue + destino Notion, sin leer PII.

## Fallos, detención y escalamiento

- Detenerse ante base Git inesperada, schema distinto, recurso ambiguo, acceso no autorizado, presencia de PII, Worker/versiones no coincidentes, migraciones faltantes o una prueba que requiera escritura.
- No corregir automáticamente infraestructura, reintentar escrituras, desplegar, aplicar migraciones, purgar Queue ni enviar mensajes.
- Registrar únicamente códigos/contadores técnicos mínimos, comando de solo lectura, hora y recurso inequívoco; escalar a ChatGPT/Seba con el bloqueo factual.
- Después de una acción autorizada futura, volver a comprobar versión/configuración, schema, conteos agregados, estado del circuito y ausencia de cambios fuera de alcance.

## Recuperación y rollback

La recuperación se diseña antes de escribir y se ejecuta solo con autorización específica. El rollback debe revertir el artefacto exacto del lote: commit Git, versión Worker, configuración o migración mediante el mecanismo aprobado para ese recurso. Nunca improvisar SQL destructivo, editar filas, borrar mensajes o restaurar Production desde este runbook. Este documento no concede permiso para operar Cloudflare, D1, Queue, Worker, Notion, GA4, Ads, DNS o Production.

