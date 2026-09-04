# Estado de implementación

- Fecha: 2026-09-04
- Fase/lote: F0 + C0.2 — Taxonomía mínima + baseline
- Estado: COMPLETADO PARA REVISIÓN DE CHATGPT
- Rama: `develop`
- Commit base: `d584494c809765e61f301af23618ef7212734653`
- Main / Production: INTACTA en `880610411ecb4d66f652e8bfaf89e5794231409d`
- Preview: sin acciones en este lote
- Bloqueadores: Ninguno
- Siguiente paso: preparación de F1, sujeta a revisión y cierre de ChatGPT de este lote

## Cambios de F0 + C0.2

- Se creó `src/_data/services.js` como fuente técnica única de códigos estables y nombres visibles para el futuro F1.
- La estructura es una lista ESM simple con `export default` y objetos `{ code, label }`.
- No se añadieron dependencias, lógica, clases, validadores, esquemas externos, subservicios, URLs ni abstracciones adicionales.
- El archivo de datos no fue conectado a plantillas, navegación, formulario ni backend.
- Se actualizó exclusivamente este estado durable para registrar las decisiones aprobadas de F0 + C0.1 y el baseline del lote.

## Taxonomía mínima de servicios

| Código estable | Nombre visible | Clasificación |
| --- | --- | --- |
| `fotografia_comercial` | Fotografía comercial | Servicio |
| `produccion_audiovisual` | Producción audiovisual | Servicio |
| `contenido_marcas` | Contenido para marcas | Servicio |
| `fotografia_corporativa` | Fotografía corporativa | Servicio |
| `fotografia_industrial` | Fotografía industrial | Servicio |
| `eventos` | Cobertura de eventos | Servicio |
| `arquitectura_interiores` | Arquitectura / interiorismo | Servicio |
| `inteligencia_artificial` | Inteligencia Artificial | Servicio futuro |
| `no_definido` | No estoy seguro | Opción válida de clasificación del contacto |

- Los códigos internos quedan separados de los nombres visibles para permitir que estos últimos cambien sin alterar integraciones futuras.
- No se definieron subservicios.
- Inteligencia Artificial queda disponible para el futuro formulario F1, pero este lote no la añade como opción visible, página, ruta ni elemento de navegación. Se preserva sin cambios una mención descriptiva preexistente en la página Servicios.
- Inteligencia Artificial probablemente tendrá una página propia durante el desarrollo; esa página no está aprobada ni creada. Su URL, contenido, oferta, estructura y momento de publicación quedan pendientes de decisión.

## Posicionamiento aprobado

- “No somos una agencia” significa ejecución directa.
- Formulación conceptual aprobada: quienes piensan, planifican y dirigen el proyecto son también quienes realizan el trabajo de producción.
- No debe resumirse como “responsables involucrados en la producción”, porque esa frase también podría describir el modelo tradicional donde una agencia dirige y terceros ejecutan.
- La diferencia relevante de Solaz es que el trabajo no pasa por la cadena `agencia → productora → proveedor`.
- La idea pública existente “somos los que hacen el trabajo” es coherente con esta definición.
- Esta definición es una decisión de dirección del proyecto.

## Reglas de contacto aprobadas

- Se mantienen conceptualmente dos recorridos: contacto general y solicitud de reunión.
- Nombre: obligatorio.
- Email: obligatorio.
- Teléfono: opcional.
- Empresa / emprendimiento: opcional.
- Servicio: obligatorio, incluyendo “No estoy seguro”.
- Mensaje del contacto general: obligatorio.
- Presupuesto: opcional.
- Solicitud de reunión: debe incluir como mínimo un día y una franja horaria.
- Consentimiento para comunicaciones comerciales: opcional y separado del acto de contactar.
- La expresión actual “Agenda tu reunión” no describe una reserva real de horario. F1 debe tratarla como solicitud de reunión, no como agenda o reserva automática, salvo aprobación posterior de una agenda real.
- Estas reglas todavía no fueron implementadas en frontend ni backend.

## Regla de promesas comerciales

- No presentar como resultado garantizado o demostrado una consecuencia comercial que Solaz no pueda respaldar con evidencia.
- Requieren evidencia si se presentan como resultados afirmaciones como vender más, aumentar conversiones, maximizar rendimiento o hacer crecer el negocio.
- Esta regla no modifica ni reescribe el copy público en este lote.

## Geografía de trabajo — criterio interno mínimo

- Base Santiago / trabajos fuera de Santiago según alcance: Fotografía comercial, Fotografía corporativa, Contenido para marcas y Arquitectura / interiorismo.
- Cobertura Chile según logística y alcance del proyecto: Producción audiovisual, Fotografía industrial y Cobertura de eventos.
- Inteligencia Artificial: sin restricción ni promesa geográfica definida; queda pendiente junto con su oferta.
- No se crearon páginas geográficas ni se modificó SEO o localización pública.

## Baseline y pruebas de F0 + C0.2

- Precheck: PASS exacto. Repositorio `SolazStudio/solazstudio-web`, rama `develop`, working tree limpio, HEAD local y `origin/develop` en `d584494c809765e61f301af23618ef7212734653`, y `origin/main` en `880610411ecb4d66f652e8bfaf89e5794231409d`.
- `npm ci`: PASS final; instaló 129 paquetes, auditó 130 y encontró 0 vulnerabilidades. El primer intento encontró un bloqueo local `EBUSY` en `node_modules/.bin`; se eliminó únicamente `node_modules/`, carpeta generada e ignorada, y la repetición pasó.
- `package-lock.json`: INTACTO; SHA-256 antes y después de `npm ci`: `F7411FAE482A3FDC543C26245DDFD8F18B56897757D3573CD755D31CF37B671C`.
- `npm run qa`: PASS final. El primer intento se detuvo al limpiar por un bloqueo local `EBUSY` en `_site/img/proyectos`; se eliminó únicamente `_site/`, salida generada e ignorada, y la repetición pasó.
- Build: PASS; Eleventy generó 24 páginas y copió 742 archivos.
- Paridad pública: PASS; 24/24 HTML, 24 plantillas Nunjucks y 766 archivos públicos contra el baseline `880610411ecb4d66f652e8bfaf89e5794231409d`, con legacy deshabilitado. La salida pública no cambió.
- Taxonomía exacta: PASS; 9/9 opciones en el orden aprobado y solo campos `code` y `label`.
- `node --check src/_data/services.js`: PASS.
- `node --check functions/api/contact.js`: PASS.
- `git diff --check`: PASS.
- Control de alcance y revisión completa del diff: PASS; solo `src/_data/services.js` y `docs/IMPLEMENTATION_STATE.md`.
- Visibilidad de IA: no se añadió ninguna opción, página, ruta o navegación pública. El texto preexistente “inteligencia artificial aplicada a producción visual” permanece idéntico por exigencia de paridad.
- No se ejecutan POST de formularios ni pruebas con datos reales.

## Evidencia durable de SETUP-0

- SETUP-0 quedó cerrado con base Eleventy/Nunjucks, 24 plantillas y cero HTML legacy o passthrough HTML legacy.
- Último commit ejecutable probado de SETUP-0: `d46b125fd709c1b5479066b95ed6573f1aa5120e`.
- Paridad verificada: 24/24 HTML y 766 archivos públicos; CSS, JavaScript, metadata, estructura, atributos, copy y JSON-LD/schema preservados.
- Backend y media preservados: `functions/`, `img/` y archivos públicos raíz intactos.
- Preview: <https://374f0f05.solazstudio-web.pages.dev/>, configurada manualmente durante SETUP-0.3 con `npm run build` y salida `_site`.
- Esa modificación afectó solo Preview; Production, `main`, DNS, Ads, D1 de Production, Queue de Production, secretos reales y Turnstile real permanecieron intactos.
- Preview quedó aislada, sin variables, secretos, D1 ni Queue vinculados; Turnstile no operativo allí como consecuencia esperada del aislamiento.
- Cierre SETUP-0.3: `npm ci` PASS final tras resolver bloqueos `EBUSY` locales sobre salidas generadas; `npm run qa` PASS; build de 24 páginas y 742 archivos copiados; paridad 24/24 y 766 archivos públicos; sintaxis backend y `git diff --check` PASS.
- Smoke HTTP SETUP-0.3: 24/24 rutas públicas con 200; assets críticos, `robots.txt` y `sitemap.xml` con 200; ruta inexistente con 404.
- Evidencia manual SETUP-0.3: Home, navegación, Portafolio, proyecto, Contacto, ambos modos del formulario y responsive/móvil verificados; sin envíos de formulario.
- Corrección documental posterior: commit `d584494c809765e61f301af23618ef7212734653`, sin nuevas acciones en Cloudflare.

## Pendientes y prohibiciones vigentes

- Pendiente: preparación de F1, sujeta a revisión y cierre de ChatGPT de este lote.
- No iniciar F1 dentro de F0 + C0.2.
- No implementar aún las reglas de contacto ni modificar formulario, backend, páginas, navegación, copy, URLs, sitemap, robots, schema, CSS, JavaScript o media.
- No crear página, URL ni oferta pública de Inteligencia Artificial; no crear landings, rutas o subservicios.
- No modificar Preview, Cloudflare, DNS, Production, Ads, D1, Queue, Turnstile, Web3Forms, analítica, secretos ni recursos externos.
- No modificar ni publicar `main`; no hacer merge, PR, rama nueva ni force push.

## Rollback

- El lote queda contenido en un único commit funcional/documental.
- Rollback previsto: revertir ese único commit en `develop`; no ejecutarlo salvo instrucción posterior.

## INFORME CODEX — ÚLTIMO LOTE

- Lote: F0 + C0.2 — Taxonomía mínima + baseline.
- Fecha: 2026-09-04.
- Precheck: PASS exacto sobre `develop` en `d584494c809765e61f301af23618ef7212734653`, con `origin/develop` coincidente, `origin/main` en `880610411ecb4d66f652e8bfaf89e5794231409d` y working tree inicial limpio.
- Trabajo realizado: creación de la fuente técnica única de servicios/códigos y documentación de las decisiones aprobadas de posicionamiento, contacto, promesas comerciales, geografía e Inteligencia Artificial.
- Archivos: 1 creado (`src/_data/services.js`), 1 modificado (`docs/IMPLEMENTATION_STATE.md`) y 0 eliminados.
- Decisiones técnicas: ESM con `export default`; estructura mínima `{ code, label }`; nueve opciones exactas; sin subservicios, URLs, dependencias, lógica ni consumo desde páginas.
- Comandos y pruebas: `npm ci`; `npm run qa`; validación exacta 9/9 de la taxonomía; `node --check src/_data/services.js`; `node --check functions/api/contact.js`; `git diff --check`; revisión de estado, alcance y diff completo.
- Resultado de cada prueba: PASS final. Build de 24 páginas y 742 archivos copiados; paridad 24/24 HTML, 24 plantillas y 766 archivos públicos; sintaxis de datos y backend válida; lock y salida pública intactos; whitespace y alcance correctos.
- Errores encontrados: bloqueos locales transitorios `EBUSY` al limpiar `node_modules/` en el primer `npm ci` y `_site/` en el primer QA. Se eliminaron solo esas carpetas generadas e ignoradas y ambas repeticiones pasaron.
- Limitaciones: la taxonomía no está conectada al formulario ni a páginas; Inteligencia Artificial no tiene página, URL, contenido, oferta, geografía ni publicación aprobadas. Una mención descriptiva preexistente a inteligencia artificial en Servicios se conserva sin cambios.
- Desviaciones respecto del encargo: ninguna.
- Commit realizado: único commit con mensaje `feat: add F0 C0 service taxonomy baseline`; SHA verificado tras su creación.
- Push realizado: únicamente `develop` hacia `origin/develop`, con verificación remota posterior.
- Working tree final: limpio tras commit y push.
- Criterio de cierre: cumplido.
- Pendientes: preparación de F1, sujeta a revisión y cierre de ChatGPT de este lote.
- Estado final exacto: COMPLETADO PARA REVISIÓN DE CHATGPT
