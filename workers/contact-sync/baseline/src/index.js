var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var NOTION_VERSION = "2022-06-28";
var NOTION_API = "https://api.notion.com/v1/pages";
var MAX_REINTENTOS = 6;
function tipoLegible(formType) {
  return formType === "reunion" ? "Reuni\xF3n" : "Mensaje";
}
__name(tipoLegible, "tipoLegible");
function construirPropiedadesNotion(contacto) {
  return {
    Nombre: { title: [{ text: { content: contacto.nombre || "(sin nombre)" } }] },
    Empresa: { rich_text: [{ text: { content: contacto.empresa || "" } }] },
    Email: { email: contacto.email || null },
    "Tel\xE9fono": { phone_number: contacto.telefono || null },
    Mensaje: { rich_text: [{ text: { content: (contacto.mensaje || "").slice(0, 2e3) } }] },
    Presupuesto: { rich_text: [{ text: { content: contacto.presupuesto || "" } }] },
    Marketing: { checkbox: contacto.consent_marketing === 1 },
    Tipo: { rich_text: [{ text: { content: tipoLegible(contacto.form_type) } }] }
  };
}
__name(construirPropiedadesNotion, "construirPropiedadesNotion");
async function crearFilaEnNotion(contacto, env) {
  const res = await fetch(NOTION_API, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.NOTION_TOKEN}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      parent: { database_id: env.NOTION_DATABASE_ID },
      properties: construirPropiedadesNotion(contacto)
    })
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") || "1", 10);
      throw { retryable: true, retryAfterSeconds: retryAfter, mensaje: JSON.stringify(data) };
    }
    throw { retryable: res.status >= 500, mensaje: JSON.stringify(data) };
  }
  return data.id;
}
__name(crearFilaEnNotion, "crearFilaEnNotion");
async function procesarContacto(id, env) {
  const contacto = await env.DB.prepare("SELECT * FROM contacts WHERE id = ?").bind(id).first();
  if (!contacto) return;
  if (contacto.sync_status === "synced") return;
  await env.DB.prepare(`UPDATE contacts SET sync_status = 'syncing' WHERE id = ?`).bind(id).run();
  try {
    const notionPageId = await crearFilaEnNotion(contacto, env);
    await env.DB.prepare(
      `UPDATE contacts SET sync_status = 'synced', notion_page_id = ?, synced_at = datetime('now'), last_error = NULL WHERE id = ?`
    ).bind(notionPageId, id).run();
  } catch (err) {
    const mensaje = err && err.mensaje ? err.mensaje : String(err);
    const retryCount = (contacto.retry_count || 0) + 1;
    const nuevoEstado = retryCount >= MAX_REINTENTOS ? "failed" : "pending";
    await env.DB.prepare(
      `UPDATE contacts SET sync_status = ?, retry_count = ?, last_error = ? WHERE id = ?`
    ).bind(nuevoEstado, retryCount, mensaje.slice(0, 1e3), id).run();
    throw err;
  }
}
__name(procesarContacto, "procesarContacto");
var index_default = {
  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        await procesarContacto(message.body.id, env);
        message.ack();
      } catch (err) {
        message.retry();
      }
    }
  },
  // Reconciliación periódica: cualquier contacto que quedó "pending" hace
  // más de 10 minutos (se cayó de la cola, o nunca se procesó) o "failed"
  // sin llegar al máximo de reintentos, se vuelve a encolar.
  async scheduled(event, env, ctx) {
    const pendientes = await env.DB.prepare(
      `SELECT id FROM contacts
       WHERE (sync_status = 'pending' AND created_at < datetime('now', '-10 minutes'))
          OR (sync_status = 'failed' AND retry_count < ?)
       LIMIT 50`
    ).bind(MAX_REINTENTOS).all();
    for (const fila of pendientes.results) {
      await env.CONTACT_QUEUE.send({ id: fila.id });
    }
    const fallidosSinAvisar = await env.DB.prepare(
      `SELECT id, nombre, email, form_type, last_error FROM contacts
       WHERE sync_status = 'failed' AND retry_count >= ? AND alerted = 0
       LIMIT 20`
    ).bind(MAX_REINTENTOS).all();
    if (fallidosSinAvisar.results.length > 0 && env.EMAIL) {
      const lista = fallidosSinAvisar.results.map((c) => `- ${c.nombre} (${c.email}, ${tipoLegible(c.form_type)}). Error: ${c.last_error || "desconocido"}`).join("\n");
      const texto = [
        `${fallidosSinAvisar.results.length} contacto(s) del formulario no se pudieron guardar en Notion despu\xE9s de varios intentos:`,
        "",
        lista,
        "",
        "Estos S\xCD quedaron guardados en la base de datos (D1), no se perdieron \u2014 solo falta pasarlos a mano a Notion."
      ].join("\n");
      try {
        await env.EMAIL.send({
          to: [{ email: "hola@solazstudio.cl" }],
          from: { email: "alertas@solazstudio.cl", name: "Alertas Solaz Web" },
          subject: "Contactos que no se sincronizaron con Notion",
          text: texto
        });
        const ids = fallidosSinAvisar.results.map((c) => c.id);
        await env.DB.prepare(
          `UPDATE contacts SET alerted = 1 WHERE id IN (${ids.map(() => "?").join(",")})`
        ).bind(...ids).run();
      } catch (err) {
      }
    }
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
