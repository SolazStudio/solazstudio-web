# PRE-F8 AUDIT REGISTER — WEB SOLAZ STUDIO

**Fecha de consolidación:** 2026-10-09  
**Proyecto:** Web Solaz — Implementación  
**Alcance:** exclusivamente la web pública `solazstudio.cl`  
**Repositorio:** `SolazStudio/solazstudio-web`  
**Documento de trabajo complementario:** no reemplaza `01_FUENTE_MAESTRA_WEB_SOLAZ.docx`, `02_PROTOCOLO_Y_ESTADO_WEB_SOLAZ.md` ni `docs/IMPLEMENTATION_STATE.md`.

---

## 0. Propósito y regla de conservación

Este documento conserva **toda la información relevante recabada durante la auditoría pre-release realizada sobre `develop`**, incluyendo estado real del proyecto, comparación con la Fuente Maestra, protocolo, Production publicada, estructura y código de `develop`, páginas, formularios, backend, D1/Queue/Worker/Notion, media, SEO, accesibilidad, privacidad, GA4, Google Ads, Cloudflare, hallazgos confirmados, gaps y elementos deliberadamente diferidos.

### Regla obligatoria del registro

**Ningún hallazgo se borra cuando se resuelve.**

Cuando un hallazgo sea trabajado durante F5, F6 u otra fase:

1. se cambia su estado a `RESUELTO — REAUDITAR EN F8`;
2. se añade lote/commit/evidencia;
3. se conserva la descripción original;
4. en F8 se vuelve a comprobar el resultado real;
5. solo entonces puede quedar como `CERRADO EN F8`.

Estados sugeridos:

- `CONFIRMADO — ABIERTO`
- `EN CURSO`
- `RESUELTO — REAUDITAR EN F8`
- `VERIFICAR EN PRODUCTION`
- `DIFERIDO EXPRESAMENTE`
- `BLOQUEADO POR DATOS`
- `SUPERADO POR DECISIÓN POSTERIOR`
- `NO APLICA`
- `CERRADO EN F8`

---

# 1. Estado exacto al momento de esta auditoría

## 1.1 Git

- `develop`: `74f2b9abe542925b15f7fab2215c33dcc72dd7b0`
- commit: `docs: close F5.2B measurement setup`
- `main`: `880610411ecb4d66f652e8bfaf89e5794231409d`
- `develop` estaba verificado como **40 commits por delante y 0 por detrás de `main`**.
- No se ha hecho merge de `develop` a `main`.
- Production pública continúa asociada a `main`.
- El commit inmediatamente anterior al cierre documental F5.2B era `99b3b22d751b2ca75fb79685b740102b95612440` (`fix: sanitize GA4 context for all events`).
- F5.2B solo añadió documentación; no cambió código ejecutable.

## 1.2 Estado de fases

- SETUP-0: **CERRADO**
- F0 + C0: **CERRADO**
- F1: **CERRADO**
- F2: **CERRADO según la evidencia aislada aprobada**
- F3: **CERRADO**
- F4: **CERRADO**
- F5: **EN CURSO**
  - F5.1: **CERRADO**
  - F5.2A: **CERRADO**
  - F5.2B: **CERRADO por revisión de ChatGPT**
  - F5.2C: **NO INICIADO**
- F6: **NO EJECUTADO / NO CERRADO**
- F7: **opcional; no implementado**
- F8: **NO EJECUTADO / NO CERRADO**

La Fuente Maestra define F8 como la auditoría funcional que separa “corregido” de “operativamente estable”.

---

# 2. Aclaración crítica sobre la secuencia F5 → F6 → F8 y Production

Durante el chat se cometió inicialmente el error de proponer un release a `main` inmediatamente después de F5.2B. La auditoría hizo visible que F6 y F8 todavía no estaban cerrados.

Existe además una dependencia importante:

- **F5.2C está definida como validación real controlada en Production.**
- **F6 incluye un smoke test post-deploy.**
- Por tanto, **F8 no puede demostrarse literalmente al 100% antes de cualquier despliegue de Production**, porque parte de su evidencia depende del sistema real publicado.

Interpretación segura:

- No tratar F5.2B como autorización suficiente para un release final.
- Resolver primero los gaps pre-release que aparezcan en este registro y completar el tramo normal de F5 que no requiera Production.
- Cuando corresponda un deployment controlado necesario para F5.2C/F6, presentarlo como lote separado, con autorización expresa y rollback.
- **La etapa técnica completa no se declara cerrada y Ads no se lanza hasta F8.**
- F8 debe usar este registro y la evidencia generada durante el deployment/Production.

---

# 3. Fuentes permanentes y reglas que gobiernan la auditoría

## 3.1 Fuente Maestra

`01_FUENTE_MAESTRA_WEB_SOLAZ.docx`, versión 2.2 final, snapshot base `8806104`.

Principios relevantes:

- web pública Solaz únicamente;
- Eleventy + Nunjucks decidido;
- sitio estático en Cloudflare Pages;
- refactor con paridad, no rediseño;
- D1 como primera persistencia del lead;
- contexto y atribución deben ser íntegros;
- `generate_lead` solo después de persistencia válida y deduplicada;
- no PII a GA4;
- first-touch y last non-direct deben estar documentados;
- UTMs y click IDs deben conservarse;
- F6 automatiza QA/observabilidad;
- F8 prueba el sistema completo;
- Ads no se lanza antes del gate.

## 3.2 Protocolo

`02_PROTOCOLO_Y_ESTADO_WEB_SOLAZ.md`.

Secuencia permanente:

`F0 + C0 → F1 → F2 → F3 → F4 → F5 → F6 → F7 → F8`

Reglas:

- `main` = Production.
- `develop` = implementación/revisión.
- merge a `main`, Production, DNS y Ads requieren autorización expresa.
- Preview debe estar aislada de recursos reales.
- ChatGPT analiza y decide.
- Codex solo ejecuta lotes aprobados.
- no reauditar trabajo ya cerrado sin motivo.
- evidencia proporcional antes de declarar listo.

---

# 4. Inventario del sitio `develop` auditado

## 4.1 Arquitectura

- Eleventy `3.1.5`
- Nunjucks `3.2.4`
- `@11ty/eleventy-img 7.0.0`
- entrada: `src`
- includes: `src/_includes`
- data: `src/_data`
- salida: `_site`
- media `img/` como passthrough, con pipeline responsive adicional para Portfolio/proyectos.

## 4.2 Superficie HTML esperada: 24 páginas

### Raíz — 15

1. `404.html`
2. `arquitectura-espacios.html`
3. `cobertura-eventos.html`
4. `contacto.html`
5. `contenido-redes-sociales.html`
6. `fotografia-comercial.html`
7. `fotografia-corporativa.html`
8. `fotografia-industrial.html`
9. `index.html`
10. `nosotros.html`
11. `politica-privacidad.html`
12. `portafolio.html`
13. `produccion-audiovisual.html`
14. `servicios.html`
15. `terminos-uso.html`

### Proyectos — 9

16. `proyectos/campana-publicitaria-elige-educar-mineduc.html`
17. `proyectos/clew-evento-internacional-world-vaper-show.html`
18. `proyectos/cobertura-evento-kifit-tnf-trail.html`
19. `proyectos/cobertura-maraton-santiago-2025.html`
20. `proyectos/contenido-marca-red-bull-rb-zero.html`
21. `proyectos/contenido-redes-sociales-cdm-medical.html`
22. `proyectos/fotografia-arquitectura-cassone.html`
23. `proyectos/video-corporativo-weg-chile.html`
24. `proyectos/weg-cobertura-evento-seminario-chile.html`

## 4.3 Indexabilidad

- 21 URLs indexables.
- 3 páginas noindex:
  - 404
  - Política de Privacidad
  - Términos de Uso
- `sitemap.xml` contiene las 21 URLs indexables y excluye deliberadamente las legales.

## 4.4 Archivos y componentes centrales revisados

Se inspeccionaron:

- `package.json`
- `eleventy.config.js`
- `config/public-surface.js`
- `config/responsive-images.js`
- `src/_data/environment.js`
- `src/_data/measurement.js`
- `src/_data/navigation.js`
- `src/_data/pages.js`
- `src/_data/services.js`
- `src/_data/site.js`
- `src/_includes/layouts/base.njk`
- `src/_includes/partials/navigation.njk`
- `src/_includes/partials/mobile-menu.njk`
- `src/_includes/partials/footer.njk`
- `src/_includes/partials/favicons.njk`
- `src/_includes/partials/privacy-preferences.njk`
- las 24 plantillas públicas
- `functions/api/contact.js`
- `workers/contact-sync/src/index.js`
- `workers/contact-sync/test/worker.test.js`
- `workers/contact-sync/wrangler.preview.jsonc`
- migraciones `0001`, `0002`, `0003`
- `tools/preview/bootstrap_contacts.sql`
- `robots.txt`
- `sitemap.xml`
- scripts de QA relevantes.

---

# 5. Comprobaciones estructurales realizadas sobre las 24 plantillas

La inspección sistemática comprobó:

- las 24 plantillas esperadas existen;
- cada plantilla auditada contiene un único `<main>`;
- cada una contiene `id="main-content"`;
- cada una contiene un único `<h1>`;
- no se encontraron rutas internas literales rotas entre las rutas públicas conocidas;
- no se encontraron referencias activas a imágenes inexistentes en las páginas de servicios/proyectos/Portfolio/Home;
- las únicas referencias a imágenes inexistentes detectadas fueron dos referencias comentadas en `Nosotros`;
- los aparentes textos `TODO`/`placeholder` detectados por búsqueda automática eran, en su mayoría, la palabra “Todo” del filtro Portfolio, nombres de clases o comentarios CSS/JS.

**Excepción real:** placeholders visibles del equipo en `Nosotros`.

---

# 6. Hallazgo visible confirmado: página Nosotros con fotos de equipo pendientes

**Estado:** `CONFIRMADO — ABIERTO`

En `src/nosotros.njk`:

- fotografía Sebastián Ogalde comentada: `img/seba-ogalde.webp`
- fotografía Ignacio Flores comentada: `img/ignacio-flores.webp`
- esos archivos no existen actualmente en el repositorio;
- se renderizan placeholders visibles:
  - `Foto Seba`
  - `Foto Nacho`

Esto ya existía en la base heredada y no fue introducido por `develop`, pero en una auditoría de sitio terminado no puede descartarse por ser heredado.

**Acción:** definir antes de F8 si son contenido final aprobado o deben reemplazarse. Si se resuelve, conservar como `RESUELTO — REAUDITAR EN F8`.

---

# 7. Navegación y accesibilidad: hallazgo a revalidar

## 7.1 Menú móvil y `aria-expanded`

**Estado:** `CONFIRMADO EN CÓDIGO — ABIERTO PARA CORRECCIÓN/REVALIDACIÓN`

`navigation.njk` solo emite `aria-expanded="false"` en páginas cuyo dato `page.navigation.expanded` es verdadero. En otras puede faltar.

El JavaScript:

- abre/cierra menú;
- actualiza `aria-hidden`;
- actualiza `inert`;
- bloquea/restaura scroll;

pero **no actualiza `aria-expanded`** del botón al cambiar estado.

El `aria-label` permanece “Abrir menú” incluso abierto.

Esto puede dejar el estado del menú mal expuesto a tecnología asistiva.

**Relación:** F4/F6; resolver antes del cierre F8.

---

# 8. Contacto: estado actual del frontend

## 8.1 Dos recorridos

- `mensaje`
- `reunion`

## 8.2 Campos comunes

- nombre obligatorio;
- empresa opcional;
- email obligatorio;
- teléfono opcional;
- servicio obligatorio;
- Turnstile;
- UUID `submission_id`;
- `source_page`;
- `case_id`;
- `cta_id`.

## 8.3 Mensaje

- mensaje obligatorio;
- presupuesto opcional;
- consentimiento marketing opcional.

## 8.4 Reunión

- uno o más días;
- franja horaria;
- texto correcto: solicitud de reunión, no reserva automática.

## 8.5 UX/accesibilidad implementadas

- error `role="alert"`;
- éxito `role="status"` + `aria-live="polite"`;
- foco a error/éxito;
- reset Turnstile tras error/timeout;
- recorridos simplificados a botones `aria-pressed`;
- skip link global.

---

# 9. Backend `/api/contact`: estado auditado

Flujo:

`Formulario → /api/contact → validación → Turnstile → D1 → Queue`

## 9.1 Seguridad/validación

- whitelist de campos;
- origen Solaz/Preview permitido;
- hostname Turnstile validado;
- email validado;
- `service_code` contra `services.js`;
- UUID;
- `source_page` path interno;
- `case_id`/`cta_id` tokens seguros;
- honeypot sin persistencia.

## 9.2 Idempotencia

D1 usa `submission_id` como `id`.

- nueva → `deduplicated:false`
- repetida → `deduplicated:true`
- duplicado no reinserta ni reencola.

## 9.3 D1 como fuente de verdad

Queue es best-effort después de D1. Si `CONTACT_QUEUE.send()` falla, el lead sigue guardado y la respuesta al usuario continúa siendo éxito; esto exige reconciliación posterior.

---

# 10. Hallazgo importante: atribución externa no persiste actualmente en D1

**Estado:** `CONFIRMADO — ABIERTO; REVISAR EN F5/C5`

La Fuente Maestra exige/contempla conservar:

- UTMs;
- `gclid`;
- `gbraid`;
- `wbraid`;
- first-touch;
- last non-direct;
- ventana first-touch configurable;
- 90 días no aprobado por defecto.

El formulario/backend actual solo transporta/persiste:

- `service_code`
- `source_page`
- `case_id`
- `cta_id`

No existen campos actuales para:

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_id`
- `utm_term`
- `utm_content`
- `gclid`
- `gbraid`
- `wbraid`
- `dclid`
- first-touch
- last non-direct

GA4 conserva whitelist de UTMs/click IDs en `page_location`, pero eso **no equivale** a preservar atribución junto al lead en D1.

**Impacto:** afecta C5/gate Ads: fuente/campaña, click IDs y atribución documentada.

**Acción:** el siguiente chat debe decidir si este gap pertenece al tramo aún abierto de F5 y resolverlo antes de considerar medición completa.

---

# 11. Hallazgo importante: `generate_lead` no envía un identificador opaco

**Estado:** `CONFIRMADO — REQUIERE DECISIÓN EXPLÍCITA`

La Fuente Maestra describe un `lead_id` opaco como elemento de deduplicación y en criterios indica identificador opaco.

El código actual dispara `generate_lead` solo cuando:

- `response.ok === true`
- `response.deduplicated === false`

La deduplicación server-side sí existe.

Payload GA4 actual:

- `lead_type`
- opcional `service_code`
- opcional `source_page`
- opcional `cta_id`

No contiene:

- `response.id`
- `lead_id`
- `submission_id`

**Decisión pendiente:** determinar si la deduplicación server-side satisface el requisito mediante decisión posterior o si debe añadirse ID opaco. Nunca enviar PII.

---

# 12. Medición GA4 implementada en código

## 12.1 Activación

`measurement.js`:

- `MEASUREMENT_ENABLED === "true"`
- `GA_MEASUREMENT_ID`

## 12.2 Restricción host

Google elegible solo con:

- consentimiento aceptado;
- hostname exacto `solazstudio.cl` o `www.solazstudio.cl`;
- medición habilitada;
- GA ID válido.

Preview/localhost/terceros fuera.

## 12.3 Consent Mode v2 básico

Antes de decidir:

- analytics denied
- ad_storage denied
- ad_user_data denied
- ad_personalization denied

Al aceptar:

- analytics granted
- ad_storage granted
- ad_user_data granted
- ad_personalization denied

Rechazar: todo denied.

## 12.4 Tag

- `gtag.js` directo;
- no GTM;
- no Ads tag directo;
- `send_page_view:false`;
- `page_view` manual.

## 12.5 Saneamiento

`page_location` permite únicamente:

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_id`
- `utm_term`
- `utm_content`
- `gclid`
- `gbraid`
- `wbraid`
- `dclid`

`page_referrer`: protocolo + host + pathname, sin query/fragment.

## 12.6 Eventos

- `page_view`
- `generate_lead`
- `contact_email`
- `contact_phone`
- `contact_whatsapp`

Directos: solo `page_path`.

Lead: `lead_type` y opcional `service_code`, `source_page`, `cta_id`.

---

# 13. Residual de privacidad: valores UTM

**Estado:** `REVISAR EN F8 / F5 SI ZERO-PII ESTRICTO`

La whitelist limita nombres de parámetros, no valida semánticamente sus valores. Una URL anómala podría contener accidentalmente PII dentro de un parámetro permitido.

No se afirma que ocurra. Es un supuesto residual del diseño.

F8 debe decidir si “no PII a GA4” exige sanitizar/rechazar también valores anómalos.

---

# 14. Eventos directos: validación runtime pendiente

**Estado:** `VERIFICAR EN F5.2C / F8`

Email/teléfono/WhatsApp se emiten al clic. Debe verificarse en Production que:

- llegan antes del cambio de aplicación/página;
- no se pierden de forma material por navegación inmediata;
- no se duplican;
- respetan consentimiento.

No hay `event_callback` ni espera explícita. No se clasifica automáticamente como bug; requiere evidencia runtime.

---

# 15. Google Analytics 4 — configuración manual completada

- propiedad: `Solaz Studio`
- flujo: `Solaz Studio — Web`
- URL: `https://solazstudio.cl`
- Stream ID: `15763611985`
- Measurement ID: `G-T0Q3S2NR2R`
- Enhanced Measurement: **OFF**

Eventos clave:

- `generate_lead`
- `contact_email`
- `contact_phone`
- `contact_whatsapp`

Configuración:

- nombres exactos minúscula;
- key event ON;
- recuento una vez por evento;
- sin valor monetario por defecto.

No hay datos reales todavía porque código de medición no está publicado en Production.

---

# 16. Google Ads — configuración manual completada

## Cuenta

- MCC: `Solaz Studio SpA — Ads Manager — 812-671-0309`
- Solaz individual: `Solaz Studio — 222-701-3511`

No usar:

- `sebaogalde — 531-270-6075` cerrada;
- borradores `211-494-8001`, `801-803-9864`.

## Vinculación GA4 ↔ Ads

Solo `Solaz Studio — 222-701-3511`.

- publicidad personalizada OFF
- auto-tagging ON
- acceso Analytics desde Ads OFF

## Conversiones

### Principales

- `generate_lead` — formulario lead — Una — Account goal Sí
- `contact_email` — Contacto — Una — Sí
- `contact_whatsapp` — Contacto — Una — Sí

### Secundaria

- `contact_phone` — Contacto — Una — Account goal No

Estado: `Esperando conversiones`, esperado hasta Production real.

## Decisión posterior que prevalece

La Fuente Maestra originalmente trataba contactos directos como secundarios. Seba decidió después:

- email Principal
- WhatsApp Principal
- generate_lead Principal
- teléfono Secundario

Esa decisión posterior es la vigente.

## Prohibiciones

- no campañas;
- no presupuesto;
- no gasto;
- no remarketing;
- no Customer Match;
- no enhanced conversions;
- no publicidad personalizada;
- no tocar método de pago.

La configuración hecha es medición; no equivale a C6/C7 cerrados.

---

# 17. Cloudflare — variables Production preparadas

Texto plano, solo Production:

- `MEASUREMENT_ENABLED=true`
- `GA_MEASUREMENT_ID=G-T0Q3S2NR2R`

No `GOOGLE_ADS_ID`.

Preview no debe recibir valores reales.

Al corte:

- no merge;
- `main` intacta;
- Production aún con código antiguo.

---

# 18. Worker de sincronización — diseño desarrollado

`workers/contact-sync/src/index.js` incluye:

- lectura D1;
- claim atómico;
- `syncing`;
- stale recovery;
- backoff;
- `Retry-After`;
- `pending`, `syncing`, `synced`, `failed`;
- consulta previa Notion por ID envío;
- reconciliación;
- protección contra CREATE duplicado tras resultado ambiguo;
- cron de pendientes/stale;
- alerta de failed si `EMAIL`;
- logs técnicos sin PII.

Suite durable: **44 PASS / 0 FAIL** en F2.4D/F2.5.

---

# 19. Hallazgo crítico Production: Worker endurecido no está desplegado en Production

**Estado:** `CONFIRMADO — RECONCILIAR ANTES DE CIERRE F8`

El Worker endurecido fue validado/desplegado en **Preview aislado**.

F2 registra repetidamente:

- Production intacta;
- Worker real no reemplazado por hardened Worker;
- código nuevo no desplegado a Production durante F2.

F2 se cerró sobre evidencia funcional aislada válida, pero eso **no significa** que hardened Worker esté activo en Production.

---

# 20. Hallazgo crítico: esquema D1 Production no está listo para hardened Worker

**Estado:** `CONFIRMADO — PRECONDICIÓN FUTURO DEPLOY WORKER`

Production recibió en F1.3 solo `0001_add_contact_context.sql`:

- `service_code`
- `source_page`
- `case_id`
- `cta_id`

D1 real quedó con 23 columnas.

`0002_add_sync_started_at.sql` y `0003_add_retry_reconciliation_state.sql` se aplicaron a Preview aislado durante F2.5A; no hay evidencia de aplicación a Production.

Hardened Worker necesita:

- `sync_started_at`
- `next_attempt_at`
- `notion_reconcile_started_at`

No desplegarlo en Production sin migrar/verificar D1 exacta.

---

# 21. Hallazgo crítico: Notion real no está preparado para hardened Worker

**Estado:** `CONFIRMADO — PRECONDICIÓN FUTURO DEPLOY WORKER`

Hardened Worker usa propiedad Notion:

- `ID envío web`

Durante F2:

- Notion real fue inspeccionado;
- esa propiedad no existía;
- E2E usó base Notion de prueba aislada donde sí se preparó;
- Production/CRM real no se modificó.

Antes de apuntar hardened Worker al Notion real:

1. autorizar modificación;
2. crear/verificar propiedad exacta;
3. confirmar tipos;
4. probar circuito.

---

# 22. Hallazgo operativo: Notion no recibe contexto completo del lead

**Estado:** `CONFIRMADO — EVALUAR ANTES DE F8`

`construirPropiedadesNotion()` sincroniza:

- Nombre
- Empresa
- Email
- Teléfono
- Mensaje
- Presupuesto
- Marketing
- Tipo
- ID envío web

No sincroniza como propiedades propias:

- `service_code`
- `source_page`
- `case_id`
- `cta_id`

Días/horario reunión quedan dentro del texto del mensaje.

La información no se pierde porque D1 es fuente de verdad, pero Notion no muestra directamente todo el contexto sin consultar D1.

Decidir si Notion deliberadamente queda reducido o debe reflejar contexto operativo.

---

# 23. F2 — evidencia E2E aislada

- D1 Preview: `solaz-contactos-preview` — `234b26b3-813f-46c8-9784-36ccf3037abc`
- Queue Preview: `solaz-contactos-preview-queue` — `68c08b23b1c642439758c80aa831a9e3`
- Worker: `solaz-contact-sync-preview`
- Notion test: `CRM Solaz Studio — Pruebas Web E2E`
- DB ID: `9546f10e-0793-4153-8ae0-6db05ec20888`
- cron: `*/5 * * * *`
- sin `EMAIL`
- sin rutas Production

Se probó:

- CREATE Notion;
- fallo final deliberado D1;
- marcador durable;
- recuperación stale;
- búsqueda página existente;
- reconciliación;
- cero segundo CREATE;
- D1 `synced`;
- idempotencia terminal.

F2 cerrado técnicamente sobre entorno aislado.

---

# 24. QA y automatización existentes

`package.json` contiene:

- `build`
- `qa:media`
- `qa:video`
- `qa:skip-link`
- `qa:contact`
- `qa:turnstile`
- `qa:compliance`
- `qa:privacy`
- `qa:f4`
- `qa:scope`
- `qa:parity`
- `qa`

Scripts cubren responsive/media, hero video, skip link, Turnstile hostname, compliance, privacidad/medición, scope F4 y paridad.

---

# 25. F6 todavía no está cerrado

**Estado:** `CONFIRMADO — ABIERTO`

F6 exige:

- checks CI pequeños;
- sintaxis;
- enlaces;
- sitemap/canonical;
- media;
- formulario;
- smoke post-deploy;
- registro fallos D1/Queue;
- checklist release/rollback.

Aunque hay scripts QA, **F6 como fase no se ha ejecutado/cerrado**.

El hallazgo original F-18 decía que no había `.github/workflows`; la auditoría del árbol no mostró un workflow CI incorporado entre los elementos revisados.

No confundir “hay scripts QA” con “F6 está cerrado”.

---

# 26. Gap heredado de `qa:parity`

Quedó documentado:

- `qa:parity` compara `functions/api/contact.js` con baseline histórico `main`;
- F1 cambió legítimamente esa Function;
- por eso puede fallar aunque el cambio sea intencional.

F6 debe decidir cómo ajustar/reemplazar ese gate para detectar regresiones reales sin rechazar cambios ya aprobados.

No repetir inútilmente el mismo fallo en cada lote.

---

# 27. SEO técnico auditado

## Correcto/preservado

- `robots.txt` permite rastreo y declara sitemap correcto;
- canonicals centralizados en `pages.js`;
- legales noindex;
- 404 noindex;
- 21 URLs indexables en sitemap;
- 24 plantillas con H1 único;
- no enlaces internos literales rotos en el scan realizado;
- schema/JSON-LD preservado;
- host canonical `https://solazstudio.cl`.

## Revisión pendiente: `lastmod`

Las entradas visibles del sitemap conservan `2026-07-28` aunque `develop` tiene cambios posteriores.

No es automáticamente error: `lastmod` debe representar cambios significativos, no cada commit.

F5/F8 debe decidir si mantener o actualizar páginas materialmente cambiadas. No modificar por inercia.

---

# 28. Redirects / host

Fuente Maestra:

- `http/www → HTTPS apex` verificado como permanente en un salto;
- no reabrir sin evidencia;
- URL histórica WEG solo con demanda GSC/backlinks/logs;
- nueve rutas rotas históricas no eran nueve migraciones válidas.

Estado: monitorizar; no inventar redirects; revalidar HTTP real en F8.

---

# 29. Media y performance

## Implementado

Pipeline responsive para Portfolio + 9 proyectos.

Widths:

- 480
- 960

Genera WebP solo si variante es menor y pesa menos que original. Añade `srcset`/`sizes` según layout.

F3 trabajó además lazy/progressive loading, dimensiones y hero videos/posters con QA específico.

## Reauditar F8

- galerías no descargan todo inicialmente;
- `srcset/sizes` sirve variantes razonables;
- sin CLS evitable;
- hero videos no compiten innecesariamente;
- bytes/requests/CWV reales si hay datos.

---

# 30. Portfolio: pendientes estratégicos/heredados

## 30.1 Curaduría

Fuente Maestra: demasiado volumen, curar primera capa, conectar servicios con prueba relevante.

F3 resolvió performance, pero no se da por probado que resolvió toda C-06.

**Estado:** `RE-AUDITAR / PROBABLEMENTE PENDIENTE COMERCIAL`

## 30.2 Filtros

Fuente Maestra: filtros no direccionables por URL y estado accesible incompleto.

Markup actual usa botones `role="tab"`.

La auditoría no cerró de forma suficiente si el patrón final de teclado/estado accesible cumple todo.

**Estado:** `RE-AUDITAR EN F6/F8`

---

# 31. Páginas/proyectos: imágenes y enlaces

Se revisaron las 9 plantillas de proyectos.

Resultado:

- 1 `<main>` por plantilla;
- `main-content`;
- 1 H1;
- no rutas internas literales rotas detectadas;
- no referencias activas a imágenes inexistentes detectadas.

Los “placeholder” detectados allí eran clases/elementos auxiliares y no, por sí solos, contenido faltante.

---

# 32. Privacidad y legales

## Implementado

- Política actualizada F4;
- Términos actualizados;
- ambos noindex;
- footer los enlaza;
- control “Preferencias de privacidad”;
- banner aceptar/rechazar + Política.

Identidad jurídica usada:

- Solaz Studio SpA
- RUT 77.734.441-2
- representante Sebastián Silva Ogalde
- Eulogio Sánchez 065, Providencia, Santiago, Chile
- `hola@solazstudio.cl`

## F8

Comprobar texto legal contra sistema final:

- Cloudflare;
- D1;
- Queue;
- Notion;
- correo/alertas;
- Google Fonts;
- GA4;
- Ads importado;
- Consent Mode;
- retención;
- campos reales;
- derechos/contacto.

Si cambia atribución o Worker Production, volver a revisar política.

---

# 33. F-01…F-20 de la Fuente Maestra — mapa pre-F8

## F-01 — Contexto servicio
`RESUELTO EN F1 — REAUDITAR F8`  
`service_code`, `source_page`, `case_id`, `cta_id` en D1.

## F-02 — Conversión tras éxito real
`PARCIALMENTE RESUELTO — F5.2C/F8`  
`generate_lead` solo tras `deduplicated:false`; pendiente Production y decisión ID opaco.

## F-03 — Email/teléfono/WhatsApp
`RESUELTO EN CÓDIGO + CONFIGURACIÓN; REAUDITAR`  
Decisión posterior: email/WhatsApp principales, teléfono secundario.

## F-04 — Turnstile reset
`RESUELTO — REAUDITAR`

## F-05 — Aviso silencioso
`DISEÑO DE RESILIENCIA RESUELTO EN PREVIEW; PRODUCTION A REVALIDAR`

## F-06 — D1 → Queue → destino
`RESUELTO EN E2E AISLADO; PRODUCTION NO VALIDADA`

## F-07 — Reglas frontend/backend
`RESUELTO — REAUDITAR`

## F-08 — Agenda falsa
`RESUELTO`  
Ahora solicitud, no reserva.

## F-09 — Feedback accesible
`RESUELTO — REAUDITAR`

## F-10 — Pestañas
`SIMPLIFICADO A BOTONES ARIA-PRESSED; REAUDITAR`

## F-11 — Skip link
`RESUELTO — REAUDITAR`

## F-12 — Galerías cargan todo
`TRABAJADO F3 — REAUDITAR RUNTIME`

## F-13 — Sistema responsive
`TRABAJADO F3 — REAUDITAR RUNTIME`

## F-14 — Hero videos
`TRABAJADO F3 — REAUDITAR RUNTIME`

## F-15 — Privacidad incompleta
`TRABAJADO F4 — REAUDITAR SISTEMA FINAL`

## F-16 — Tracking vs privacidad
`TRABAJADO F4/F5 — PRODUCTION PENDIENTE`

## F-17 — Hardening endpoint
`MAYORMENTE RESUELTO; RATE LIMIT SOLO SI JUSTIFICADO`  
Hostname + idempotencia implementados. Reauditar action/rate según necesidad.

## F-18 — QA automatizado
`ABIERTO — F6`

## F-19 — Capa editorial
`DIFERIDO EXPRESAMENTE — F7 OPCIONAL`

## F-20 — Migraciones host/URL
`MONITOREAR; NO RECONSTRUIR`

---

# 34. C-01…C-15 — mapa pre-F8

## C-01 — “No somos una agencia”
`DECISIÓN APROBADA; REAUDITAR COPY`  
Debe significar ejecución directa, no carencia. No prometer performance/agencia integral sin capacidad.

## C-02 — Taxonomía fragmentada
`PARCIALMENTE RESUELTO`  
`services.js` tiene 9 códigos; formulario/backend lo usan. Comprobar alineación real de Portfolio/casos/registro.

## C-03 — Casos muchos-a-muchos
`PROBABLEMENTE ABIERTO / C2`

## C-04 — Prueba comercial desigual
`RE-AUDITAR / C2`

## C-05 — Claims de resultado sin evidencia
`ABIERTO A REAUDITAR`

## C-06 — Portfolio como herramienta comercial
`PARCIAL / RE-AUDITAR`

## C-07 — Geografía por servicio
`RE-AUDITAR`

## C-08 — Producto/e-commerce landing
`DIFERIDO / HIPÓTESIS`

## C-09 — Video corporativo landing
`DIFERIDO / HIPÓTESIS`

## C-10 — Gastronomía landing
`NO HACER TODAVÍA`

## C-11 — Clew / vapeo
`REGLA ADS VIGENTE`  
Puede seguir orgánico, pero no destino/sitelink/asset/prueba de campañas.

## C-12 — Search Console / CrUX / GBP
`BLOQUEADO POR DATOS / FUENTES DE DECISIÓN`

## C-13 — Corporativa/Industrial piloto
`HIPÓTESIS FUTURA`

## C-14 — Cifras/promesas cuantitativas
`CONFIRMADO — ABIERTO`  
Fuente Maestra exige trazabilidad de `+12`, `+100`, `+500`, tiempos respuesta, certificaciones, alcance nacional. Auditoría observó al menos `+12` en Home.

## C-15 — Gestión/performance
`RE-AUDITAR`  
Contenido para marcas = producción recurrente; performance solo con alcance/equipo/reporting/evidencia.

---

# 35. Claims concretos a trazar/revisar

- “Más de 12 años de experiencia”
- “Te respondemos en menos de 24 horas hábiles”
- “Trabajamos en todo Chile”
- “resultado supere lo que imaginabas”
- `+12`
- `+100`
- `+500`
- certificaciones
- alcance nacional
- cualquier claim de vender más, convertir, maximizar rendimiento o crecimiento.

No se afirma que sean falsos. El gap es **trazabilidad**: fuente, período, criterio y responsable, o reformulación/retiro.

---

# 36. Sitio publicado vs `develop`

Production pública fue revisada como referencia del sitio actual.

- Production sigue en `main` `8806104`.
- `develop` acumula 40 commits adicionales.
- Production no debe tratarse como si ya tuviera formulario nuevo, hardened Worker, media F3, legales F4 o medición F5.

Las diferencias de `develop` son acumulativas e intencionales.

Production sigue siendo referencia para preservar identidad visual, navegación, copy no autorizado a cambiar, rutas, canonicals, fotos/videos salvo cambios aprobados y comportamiento no modificado expresamente.

---

# 37. Regla de herencia

Un defecto heredado:

- no es regresión de `develop`;
- pero puede seguir siendo pendiente del proyecto.

F8 debe distinguir:

1. regresión introducida;
2. pendiente heredado que la Fuente Maestra ordenaba resolver;
3. pendiente heredado diferido;
4. hipótesis comercial;
5. blocker por datos.

Nunca usar “ya estaba en Production” como motivo suficiente para cerrar.

---

# 38. Sitemap y URLs

- legales fuera del sitemap intencionalmente;
- legales noindex;
- 404 noindex;
- sitemap usa URLs limpias sin `.html`;
- Eleventy produce archivos `.html`, Cloudflare sirve rutas limpias.

F8 debe verificar HTTP real de todas las rutas limpias y 404.

---

# 39. Turnstile

`environment.js` contiene site key Production como fallback.

Preview se configuró con key oficial de prueba.

F1.4 demostró:

- 2 formularios Preview con test key;
- 0 Production key en HTML Preview;
- POST general PASS;
- POST reunión PASS;
- duplicado PASS;
- token ausente 400;
- Origin externo 403.

F4 añadió hostname server-side.

Reauditar Production:

- hostname;
- expiración;
- reset;
- segundo intento;
- fallo de red.

---

# 40. First-touch / last non-direct

**Estado:** `CONFIRMADO — NO IMPLEMENTADO EN EL FLUJO DEL LEAD`

Fuente Maestra:

- first-touch = primera fuente identificable dentro de ventana configurable;
- last non-direct = última fuente distinta de direct;
- visita direct no borra origen previo;
- 90 días no aprobado.

No se observó actualmente:

- almacenamiento first-touch;
- last non-direct;
- ventana configurable;
- persistencia de atribución en lead.

Mantener visible hasta resolver o hasta una decisión posterior que reemplace expresamente el requisito.

---

# 41. Arquitectura medición vs Ads

Vigente:

`Web → GA4 → eventos/key events → Google Ads`

No:

`Web → Ads tag directo`

Por eso:

- no `GOOGLE_ADS_ID`;
- no `AW-...`;
- no GTM;
- no conversiones duplicadas.

---

# 42. Diferenciación de formularios Analytics

Un evento:

- `generate_lead`

Parámetro:

- `lead_type=mensaje`
- `lead_type=reunion`

Ads ve una sola acción importada. GA4 distingue por `lead_type`.

Seba aceptó esta agrupación. No reabrir sin evidencia de negocio.

---

# 43. Notion / D1 / operación

D1 = primera persistencia/fuente técnica de verdad.

Notion = destino operativo posterior.

Requisitos finales:

- caída Notion no pierde lead;
- email no es fuente primaria;
- reconciliación recupera;
- fallo tras CREATE Notion no duplica páginas.

Demostrado en Preview aislado; Production debe probarlo antes de declararse estable.

---

# 44. Alertas email Worker

Hardened Worker tiene alerta para `failed`.

Pero Preview no tiene `EMAIL` deliberadamente. Por tanto alerta email no quedó probada E2E en Preview.

F8/Production debe verificar:

- si Production usa `EMAIL`;
- remitente/destino;
- no duplicar alertas;
- no perder lead si email falla;
- coherencia legal.

---

# 45. Riesgo de publicar solo Pages sin reconciliar Worker

Un merge a `main` de web/Pages no debe asumirse como deployment del Worker separado `workers/contact-sync`.

Un lote de release debe diferenciar explícitamente:

1. release Pages;
2. migraciones D1 Production si corresponden;
3. preparación Notion Production;
4. deployment Worker Production;
5. bindings/Queue/cron;
6. smoke/rollback.

No mezclarlos implícitamente.

---

# 46. Seguridad y secretos

- secretos no versionados;
- `NOTION_TOKEN` Preview instalado manualmente como secret y nunca copiado/documentado;
- GA Measurement ID no es secreto;
- `MEASUREMENT_ENABLED` no es secreto;
- ambos plain text en Cloudflare Production;
- no exponer Notion token, Turnstile secret u OAuth.

---

# 47. Pendientes no puramente técnicos que F8 debe recordar

- fotos equipo;
- claims cuantitativos;
- prueba comercial desigual;
- Portfolio/curaduría;
- relación casos↔servicios;
- taxonomía visual/comercial posiblemente no totalmente unificada;
- geografía por servicio;
- lenguaje performance/gestión;
- Clew fuera de Ads;
- nuevas páginas condicionadas por datos;
- F7 opcional.

---

# 48. Elementos que NO son bugs por sí mismos

No marcar como errores automáticamente:

- ausencia Search Console/CrUX/GBP;
- no landing Gastronomía;
- no landing Producto/e-commerce;
- no landing Video Corporativo;
- no CMS/editor;
- no LocalBusiness schema por defecto;
- no rate limiting si riesgo no lo justifica;
- no redirect histórico sin evidencia;
- no campañas Ads.

Son decisiones, hipótesis, fuentes de datos o diferidos.

---

# 49. Candidatos fundamentales a trabajar antes de F8

Sin ejecutar nada sin lote + autorización:

## A. Atribución lead
- UTMs/click IDs D1;
- first-touch;
- last non-direct;
- ventana configurable.

## B. Identificador opaco `generate_lead`
Resolver discrepancia fuente vs payload.

## C. Worker Production real
- D1 `0002/0003`;
- Notion `ID envío web`;
- deploy Worker;
- bindings/cron/Queue;
- prueba.

## D. Accesibilidad menú móvil
`aria-expanded`/label.

## E. Fotos equipo
Pendiente visible.

## F. Claims cuantitativos
Trazabilidad.

## G. Notion y contexto comercial
D1 guarda contexto; Notion no lo refleja.

## H. Sitemap `lastmod`
Revisar en F5, no cambiar por inercia.

---

# 50. Instrucciones para el siguiente chat

1. Leer las dos fuentes permanentes.
2. Leer `docs/IMPLEMENTATION_STATE.md` en `develop`.
3. Leer este PRE-F8 Audit Register.
4. Continuar desde **F5.2**; no saltar directamente a release.
5. Antes de proponer siguiente lote, separar:
   - qué pertenece a F5;
   - qué corresponde F6;
   - qué se conserva para F8;
   - qué requiere lote extraordinario previo.
6. No borrar hallazgos resueltos.
7. Para cada uno añadir lote, commit, evidencia y estado actualizado.
8. En F8 usar este documento como checklist acumulativo más cualquier hallazgo nuevo.

---

# 51. Reglas Codex reafirmadas por Seba

Futuros ENCARGOS CODEX deben ser austeros.

ChatGPT hace antes:

- investigación;
- análisis;
- decisiones;
- comparación;
- previsión de errores;
- elección técnica;
- identificación de archivos;
- definición exacta de QA.

Codex:

- no investiga;
- no analiza;
- no busca;
- no decide;
- no infiere;
- no explora;
- no prueba “por si acaso”;
- no repite QA ya demostrado;
- no verifica estados ya conocidos salvo precondición estricta;
- ejecuta exactamente qué, cómo y dónde;
- trabaja en silencio;
- informe breve;
- se detiene.

Cada comando/prueba debe tener una razón concreta.

---

# 52. Estado final del registro al crearlo

## Cerrado

- SETUP-0
- F0/C0
- F1
- F2 en entorno aislado aprobado
- F3
- F4
- F5.1
- F5.2A
- F5.2B
- configuración GA4
- importación/conversión Ads
- variables medición Production preparadas

## Abierto inmediato

- F5.2C
- reconciliar hallazgos de atribución/lead ID que pertenezcan a F5 antes de afirmar medición completa
- definir posición correcta del deployment controlado necesario para F5.2C

## Abierto posterior

- F6
- F8

## Opcional/diferido

- F7
- nuevas landings condicionadas
- campañas Ads
- expansión comercial

## Production

- `main` sigue `8806104`
- no merge
- no nuevo deployment del código `develop`
- no DNS
- no campañas
- no gasto

---

# 53. Conclusión pre-F8

La rama `develop` **no puede declararse “100% terminada y libre de pendientes” todavía**.

No porque se haya detectado una regresión general del refactor: la estructura, rutas, assets, formularios, privacidad, media y medición muestran una implementación extensa y mayormente consistente.

No puede declararse terminada porque siguen existiendo:

- fases formales no cerradas: F5.2C, F6, F8;
- gaps de atribución externa respecto de la Fuente Maestra;
- decisión pendiente sobre lead ID opaco;
- diferencias entre Worker hardened probado y Worker Production real;
- precondiciones D1/Notion para Production;
- puntos de accesibilidad y contenido heredados;
- claims/comercial/Portfolio por clasificar y reauditar.

Este documento existe para impedir que esos puntos se pierdan mientras el proyecto avanza.

**No borrar. Actualizar estados y volver a auditar en F8.**
---

# ANEXO — VERIFICACIÓN DOCUMENTAL Y PRECEDENCIA (2026-10-09)

Este anexo es una precisión posterior y no altera ni elimina el texto histórico anterior. Se conserva la evidencia de la auditoría y se aclara el alcance de las afirmaciones.

1. **Secuencia de release:** la antigua propuesta de pasar `develop` a `main` inmediatamente después de F5.2B quedó retirada. F5 sigue en curso (F5.2C no iniciado); F6 y F8 no están cerrados. Antes de todo despliegue real debe prepararse un lote independiente, verificar sus precondiciones y obtener autorización expresa. Una publicación controlada para pruebas operativas no equivale al cierre F8 ni habilita Ads.
2. **Worker/D1/Notion Production:** los apartados 19–21 registran como hechos históricos la ausencia de despliegue/cambios Production *durante los lotes F2*. No constituyen una consulta actual a Cloudflare o Notion al 2026-10-09. Por eso la vigencia de Worker endurecido, migraciones 0002/0003 y propiedad `ID envío web` en Production necesita verificación externa de solo lectura antes de decidir las escrituras necesarias. Hasta verificar, tratar esas precondiciones como potencial bloqueo del despliegue, sin afirmar una comprobación remota actual.
3. **`qa:parity`:** el apartado 26 preserva un antecedente histórico de fricción por comparación con `main`, pero la lectura de `scripts/verify-parity.mjs` en `develop` al commit base `74f2b9a` no muestra una comparación directa de `functions/api/contact.js` con `main`. La verificación actual exige integridad de originales/archivos públicos y de salida generada. Por tanto, no etiquetar el supuesto conflicto directo de Function como bug vigente sin nueva evidencia. Conservar el antecedente y considerar su utilidad en F6.
4. **F2:** permanece cerrado sobre su evidencia E2E aislada. Ese cierre no equivale a validación de la infraestructura real de Production ni permite declarar F8 cerrado; no se reabre automáticamente F2 por esa diferencia.
5. **Regla de precedencia:** ante cualquier aparente contradicción, usar la Fuente Maestra y el Protocolo como fuentes permanentes, el estado durable actual de `develop` para hechos de implementación, las decisiones posteriores expresas para los puntos que las matizan y este registro como historial de auditoría. No presentar hipótesis o hallazgos que aún requieren verificación como hechos recién comprobados.

---

# SEGUIMIENTO F5 — CONSOLIDADO PRE-F5.2C (2026-10-09)

**Estado:** `COMPLETADO PARA REVISIÓN DE CHATGPT`.

## RESUELTO — REAUDITAR EN F8

- **Atribución del lead:** el runtime captura exclusivamente las diez claves aprobadas en `first_touch`, `last_non_direct` y `current_touch`, con `captured_at` ISO, consentimiento analítico `accepted`, continuidad limitada a `sessionStorage`, fallback en memoria, revocación efectiva y límite total de 4096 bytes. Una visita directa inicial cede `first_touch` a la primera fuente identificable posterior; las visitas directas siguientes no borran `first_touch` ni `last_non_direct` y sí actualizan `current_touch`. No se crean cookies, identificadores de visitante ni continuidad entre sesiones.
- **Saneamiento:** cliente y servidor aplican la misma whitelist. UTMs admiten hasta 128 caracteres Unicode con espacios internos y `- _ . /`; click IDs admiten hasta 160 caracteres `[A-Za-z0-9_-]`. Valores con PII aparente, URLs, controles, saltos, email/teléfono o forma inválida se descartan sin truncarlos.
- **Persistencia:** ambos formularios envían `attribution_context` solo con consentimiento aceptado. La Function normaliza independientemente y persiste JSON seguro o `NULL`; una atribución malformada no bloquea un contacto válido. Migración versionada `0004_add_contact_attribution.sql` añade una sola columna nullable `attribution_context TEXT`.
- **Lead ID opaco:** `generate_lead` incorpora únicamente `lead_id=response.id` cuando la respuesta es nueva, exitosa, no deduplicada y el ID cumple el patrón UUID existente. No se agregan parámetros de atribución ni PII a eventos GA4.
- **Menú móvil:** las 24 plantillas conservan su listener existente y sincronizan `aria-expanded`, `aria-label`, `aria-hidden`, `inert`, clases y scroll al abrir, cerrar o activar un enlace.
- **Filtros Portfolio:** dejan de exponerse como tabs sin tabpanels y usan botones con `aria-pressed` sincronizado con `active`, sin alterar orden, etiquetas, filtrado ni layout.

## Evidencia local

- `npm run build`: PASS; 24 páginas generadas y 743 archivos copiados.
- `npm run qa:contact`: PASS, 33/33.
- `npm run qa:privacy`: PASS, 103/103; incluye primera visita directa seguida por fuente identificable y nueva visita directa, además de atribución, consentimiento, revocación, saneamiento, D1 `NULL`/JSON, deduplicación, Queue, `lead_id`, menú y filtros.
- No se ejecutó QA general, `npm ci`, navegador, Preview remoto ni pruebas de servicios externos.

## Pendientes preservados

- `0004_add_contact_attribution.sql` no fue aplicada a D1 real y es precondición obligatoria antes de cualquier futuro despliegue Production de `functions/api/contact.js`.
- F5.2C permanece **NO INICIADO**; F6 y F8 permanecen abiertos.
- El estado de filtros en URL/routing continúa como hallazgo separado para F8.
- La política definitiva de retención/atribución más allá de la sesión no fue aprobada; este lote implementa solo continuidad de pestaña, sin 90 días ni `localStorage`.
- Production, Worker, D1 real, Queue, Notion, DNS, GA4/Ads externos y campañas permanecen sin acciones en este lote.

---

# SEGUIMIENTO F6 + DEPENDENCIAS F5.2C (2026-10-09)

**Estado F6:** `CERRADO POR REVISIÓN INDEPENDIENTE DE CHATGPT`.

## Implementado en F6

- CI read-only para push y pull request hacia `develop`: Node desde `.node-version`, `npm ci` y compuerta consolidada `npm run qa`, sin secretos ni deploy.
- QA consolidada con sintaxis de Function/Worker/smoke, estructura de los 24 HTML, enlaces y fragmentos internos, sitemap/canonical/noindex/URLs limpias, tests Worker y guardas históricas vigentes.
- Smoke remoto GET-only con URL base explícita, fuera de CI y fuera de `npm run qa`.
- Runbook de solo lectura para QA, D1 por schema/conteos agrupados sin PII, Queue/consumer/Worker, señales de fallo, detención, escalamiento, posverificación y rollback no ejecutado.
- `qa:scope` se conserva como comando histórico pero deja de integrar la compuerta general porque su baseline F4 no corresponde al alcance acumulado actual.

## F5.2C — bloqueo real preservado

- Estado: `DIAGNÓSTICO COMPLETADO / VALIDACIÓN REAL BLOQUEADA`.
- Worker real `solaz-contact-worker`: versión activa `c1224de0-a9be-4aac-8143-aa2a5bd12ab7`, anterior al Worker hardened de `develop`.
- D1 real `solaz-contactos`: schema `0001` presente; faltan las columnas de `0002`, `0003` y `0004`.
- Queue `solaz-contactos-sync`: productor y consumidor activos vinculados al Worker real.
- CRM real Notion: falta la propiedad `ID envío web`.
- El contacto completo y la medición GA4 real no están validados. No se aplicaron migraciones, no se desplegó código y no se modificó ningún recurso externo.

## Continuidad hacia F8

- F6 no queda cerrado hasta revisión independiente de ChatGPT.
- F5.2C permanece bloqueado para validación real y requiere un lote posterior con autorizaciones específicas antes de cualquier escritura.
- F8 continúa pendiente. Este seguimiento no borra hallazgos anteriores ni habilita release, Production, Ads o campañas.


## Recuperación de F6 — evidencia del intento QA

- El único intento local de `npm run qa` de F6 fue **BLOQUEADO** durante `clean` por `EBUSY` en `_site/img/_responsive`, antes de ejecutar build y controles; no hubo QA PASS local.
- Codex no creó commit ni hizo push. ChatGPT recuperó los siete archivos desde Dropbox mediante autorización expresa para integración directa en `develop`, sin usar Codex.
- La validación general queda transferida al workflow de GitHub Actions para ejecución aislada de Dropbox. Estado de CI pendiente al preparar este commit; no declarar cierre F6 sin revisar ese resultado.
- F5.2C continúa BLOQUEADO para validación real y F8 PENDIENTE; sin cambios en recursos externos de producción.

## F6 — Corrección puntual del control histórico de videos (2026-10-09)

- La primera ejecución de `QA develop` del commit `f01f30c2c1631490f43f5dc980a6517b2160c8e4` completó `npm ci`, build de 24 HTML y `qa:media` (719 imágenes, 1.398 variantes) con PASS; se detuvo en `qa:video`: `Home: JavaScript de la plantilla alterado`. Los controles posteriores no se ejecutaron.
- Causa verificada: `scripts/verify-hero-videos.mjs` comparaba la totalidad del script histórico de cada hero con un baseline anterior a las instrucciones `aria-expanded` y `aria-label` aprobadas para el menú móvil en F5.
- Corrección: normalizar exclusivamente esas cuatro instrucciones aprobadas, exigiendo una aparición exacta de cada una por página, y comparar byte por byte el JavaScript restante con la versión histórica. Se preservan las verificaciones de fuente, etiquetas, atributos, pósters y videos.
- El commit correctivo emplea el prefijo `[CF-Pages-Skip]` para omitir un nuevo build/deployment automático de Cloudflare Pages, conservando la ejecución de GitHub Actions.
- En el momento de registrar este cambio, la nueva ejecución general de GitHub Actions está **PENDIENTE**; F6 sigue **EN REVISIÓN / NO CERRADO**. No afirmar QA PASS sin el resultado remoto.
- F5.2C continúa bloqueado para validación real; F8 permanece pendiente. Ningún cambio a `main`, Production o recursos reales está autorizado en esta corrección.
## Cierre independiente de F6 y seguimiento hacia F8 (2026-10-09)

- **F6 CERRADO** por revisión independiente de ChatGPT de los commits `f01f30c2c1631490f43f5dc980a6517b2160c8e4` y `0323bba2b61af1fd84a5a87eea8f701ded645c9c`.
- Evidencia definitiva: GitHub Actions `QA develop`, run `37982002647`, `completed/success`, `npm ci` y `npm run qa` PASS, sobre commit `0323bba2b61af1fd84a5a87eea8f701ded645c9c`: https://github.com/SolazStudio/solazstudio-web/actions/runs/37982002647.
- Alcance validado: build de 24 páginas, medios (719 imágenes y 1.398 variantes), tres videos, accesibilidad, formularios, privacidad, sintaxis, Worker local, enlaces/canonical/sitemap/noindex y paridad de 2.165 archivos públicos. Smoke remoto no ejecutado.
- Riesgo para evaluar en F8: `npm ci` informó **11 vulnerabilidades de dependencias (4 moderadas y 7 altas)**. Requiere análisis de exposición/impacto; F6 no aplicó actualizaciones de paquetes ni alteró la web pública.
- Mantener íntegros los hallazgos previos. F5.2C continúa **BLOQUEADO PARA VALIDACIÓN REAL**, F8 **PENDIENTE** y `main`/Production sin publicación autorizada.
- Esta anotación documental refleja la revisión posterior; las menciones históricas de QA pendiente anteriores a la ejecución aprobada se conservan como evidencia de su estado en ese momento.


## Seguimiento F5.2C.1 — Contrato Notion real preparado (2026-10-09)

- **Corrección posterior vigente:** con autorización expresa del director se agregó al CRM real `CRM Solaz Studio` (database `37b7abcb-cbb1-8050-a745-d5edcab17eb8`, data source `37b7abcb-cbb1-805c-93ce-000b6ea904b6`) la propiedad exacta `ID envío web`, tipo `rich_text` (`text` en esquema de lectura). Precheck: 10 propiedades previas sin la clave; poscheck: 11 propiedades, clave presente y las 10 originales conservadas. Inspección limitada al schema, sin filas ni PII.
- **Estado del hallazgo:** precondición de esquema Notion real **RESUELTA/VALIDADA** para F5.2C. La prevención efectiva de duplicados con el Worker endurecido sigue **BLOQUEADA POR PRODUCTION** hasta migraciones y despliegue con pruebas reales. No equiparar crear un campo con probar el circuito D1 → Queue → Notion.
- **Sin cambios en:** contactos existentes, D1, Queue, Worker, Pages, código funcional, Preview, GA4, Ads, DNS ni `main`. QA general F6 no se repitió por tratarse de propiedad y documentación.
- **Siguiente dependencia:** preparar migraciones D1 reales 0002/0003/0004 en lote separado y autorizado, verificar compatibilidad y orden de despliegue; F5 global continúa abierta y F8 pendiente.
