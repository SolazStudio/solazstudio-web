const NOTION_VERSION = "2022-06-28";
const NOTION_API = "https://api.notion.com/v1/pages";
const MAX_REINTENTOS = 6;
const PENDING_REQUEUE_MINUTES = 10;
const SYNCING_STALE_MINUTES = 20;
const INTERNAL_RETRY_DELAY_SECONDS = 60;
const MAX_DIAGNOSTIC_LENGTH = 240;

class NotionRequestError extends Error {
  constructor({ code, retryable, status = null, retryAfterSeconds = null, diagnostic }) {
    super(code);
    this.name = "NotionRequestError";
    this.code = code;
    this.retryable = retryable;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
    this.diagnostic = diagnostic;
  }
}

class WorkerInternalError extends Error {
  constructor(code) {
    super(code);
    this.name = "WorkerInternalError";
    this.code = code;
  }
}

function tipoLegible(formType) {
  return formType === "reunion" ? "Reunión" : "Mensaje";
}

function construirPropiedadesNotion(contacto) {
  return {
    Nombre: { title: [{ text: { content: contacto.nombre || "(sin nombre)" } }] },
    Empresa: { rich_text: [{ text: { content: contacto.empresa || "" } }] },
    Email: { email: contacto.email || null },
    "Teléfono": { phone_number: contacto.telefono || null },
    Mensaje: { rich_text: [{ text: { content: (contacto.mensaje || "").slice(0, 2000) } }] },
    Presupuesto: { rich_text: [{ text: { content: contacto.presupuesto || "" } }] },
    Marketing: { checkbox: contacto.consent_marketing === 1 },
    Tipo: { rich_text: [{ text: { content: tipoLegible(contacto.form_type) } }] },
  };
}

function normalizeTechnicalCode(value, fallback = "unknown") {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9._-]{1,64}$/.test(normalized) ? normalized : fallback;
}

function safeContactId(value) {
  if (typeof value !== "string") return "invalid";
  return /^[a-z0-9_-]{1,80}$/i.test(value) ? value : "invalid";
}

function logTechnical(level, event, fields = {}) {
  const payload = { event };
  for (const [key, value] of Object.entries(fields)) {
    if (value !== null && value !== undefined && ["string", "number", "boolean"].includes(typeof value)) {
      payload[key] = value;
    }
  }
  const logger = console[level] || console.log;
  logger(payload);
}

function calculateBackoffSeconds(retryCountFinal) {
  const attempt = Math.max(1, Math.trunc(Number(retryCountFinal) || 1));
  return Math.min(60 * 2 ** (attempt - 1), 900);
}

function parseRetryAfterSeconds(value) {
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return null;
  const seconds = Number(value.trim());
  if (!Number.isSafeInteger(seconds) || seconds <= 0) return null;
  return Math.min(Math.max(seconds, 1), 3600);
}

function parseNotionBody(text) {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return {
      code: typeof parsed.code === "string" ? parsed.code : null,
      message: typeof parsed.message === "string" ? parsed.message : null,
      id: typeof parsed.id === "string" ? parsed.id : null,
    };
  } catch {
    return null;
  }
}

function isUsableNotionId(value) {
  if (typeof value !== "string") return false;
  return /^[0-9a-f]{32}$/i.test(value) || /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
}

function notionDiagnostic(kind, status, code) {
  const safeCode = normalizeTechnicalCode(code, "unknown");
  return `${kind};status=${status ?? "none"};code=${safeCode}`.slice(0, MAX_DIAGNOSTIC_LENGTH);
}

async function crearFilaEnNotion(contacto, env) {
  let response;
  try {
    response = await fetch(NOTION_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.NOTION_TOKEN}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { database_id: env.NOTION_DATABASE_ID },
        properties: construirPropiedadesNotion(contacto),
      }),
    });
  } catch {
    throw new NotionRequestError({
      code: "notion_network",
      retryable: true,
      diagnostic: notionDiagnostic("notion_network", null, null),
    });
  }

  let bodyText = "";
  let bodyReadFailed = false;
  try {
    bodyText = await response.text();
  } catch {
    bodyReadFailed = true;
  }

  const parsed = bodyReadFailed ? null : parseNotionBody(bodyText);
  const remoteCode = normalizeTechnicalCode(parsed?.code, "unknown");

  if (response.ok) {
    if (bodyReadFailed) {
      throw new NotionRequestError({
        code: "notion_ambiguous_success",
        retryable: false,
        status: response.status,
        diagnostic: notionDiagnostic("notion_ambiguous_success_body_read", response.status, remoteCode),
      });
    }
    if (!parsed) {
      throw new NotionRequestError({
        code: "notion_ambiguous_success",
        retryable: false,
        status: response.status,
        diagnostic: notionDiagnostic("notion_ambiguous_success_invalid_json", response.status, remoteCode),
      });
    }
    if (!isUsableNotionId(parsed.id)) {
      throw new NotionRequestError({
        code: "notion_ambiguous_success",
        retryable: false,
        status: response.status,
        diagnostic: notionDiagnostic("notion_ambiguous_success_missing_id", response.status, remoteCode),
      });
    }
    return parsed.id;
  }

  const retryable = response.status === 429 || response.status >= 500;
  const code = response.status === 429
    ? "notion_http_429"
    : retryable
      ? "notion_http_5xx"
      : "notion_http_4xx";
  const retryAfterSeconds = response.status === 429
    ? parseRetryAfterSeconds(response.headers.get("Retry-After"))
    : null;

  throw new NotionRequestError({
    code,
    retryable,
    status: response.status,
    retryAfterSeconds,
    diagnostic: notionDiagnostic(code, response.status, remoteCode),
  });
}

async function readContact(env, id) {
  try {
    return await env.DB.prepare("SELECT * FROM contacts WHERE id = ?").bind(id).first();
  } catch {
    throw new WorkerInternalError("d1_contact_read_failed");
  }
}

async function claimContact(env, id) {
  let result;
  try {
    result = await env.DB.prepare(`
      UPDATE contacts
      SET sync_status = 'syncing', sync_started_at = datetime('now')
      WHERE id = ?
        AND COALESCE(retry_count, 0) < ?
        AND (
          sync_status = 'pending'
          OR (
            sync_status = 'syncing'
            AND sync_started_at IS NOT NULL
            AND sync_started_at < datetime('now', ?)
          )
        )
    `).bind(id, MAX_REINTENTOS, `-${SYNCING_STALE_MINUTES} minutes`).run();
  } catch {
    throw new WorkerInternalError("d1_claim_failed");
  }
  return Number(result?.meta?.changes) === 1;
}

async function persistFailure(env, id, error) {
  let update;
  try {
    update = await env.DB.prepare(`
      UPDATE contacts
      SET retry_count = COALESCE(retry_count, 0) + 1,
          sync_status = CASE
            WHEN ? = 0 OR COALESCE(retry_count, 0) + 1 >= ? THEN 'failed'
            ELSE 'pending'
          END,
          last_error = ?,
          sync_started_at = NULL
      WHERE id = ? AND sync_status = 'syncing'
    `).bind(error.retryable ? 1 : 0, MAX_REINTENTOS, error.diagnostic, id).run();
  } catch {
    throw new WorkerInternalError("d1_failure_persist_failed");
  }
  if (Number(update?.meta?.changes) !== 1) {
    throw new WorkerInternalError("d1_failure_persist_not_applied");
  }

  let finalState;
  try {
    finalState = await env.DB.prepare(
      "SELECT retry_count, sync_status FROM contacts WHERE id = ?",
    ).bind(id).first();
  } catch {
    throw new WorkerInternalError("d1_failure_state_read_failed");
  }
  if (!finalState) throw new WorkerInternalError("d1_failure_state_missing");

  const retryCountFinal = Number(finalState.retry_count);
  const exhausted = retryCountFinal >= MAX_REINTENTOS;
  if (error.retryable && !exhausted && finalState.sync_status === "pending") {
    return {
      action: "retry",
      code: error.code,
      status: error.status,
      retryCountFinal,
      delaySeconds: error.retryAfterSeconds ?? calculateBackoffSeconds(retryCountFinal),
    };
  }

  return {
    action: "ack",
    code: error.code,
    status: error.status,
    retryCountFinal,
    outcome: exhausted ? "exhausted" : "definitive_failure",
  };
}

async function persistSuccess(env, id, notionPageId) {
  let result;
  try {
    result = await env.DB.prepare(`
      UPDATE contacts
      SET sync_status = 'synced',
          notion_page_id = ?,
          synced_at = datetime('now'),
          last_error = NULL,
          sync_started_at = NULL
      WHERE id = ? AND sync_status = 'syncing'
    `).bind(notionPageId, id).run();
  } catch {
    throw new WorkerInternalError("notion_success_d1_unconfirmed");
  }
  if (Number(result?.meta?.changes) !== 1) {
    throw new WorkerInternalError("notion_success_d1_unconfirmed");
  }
}

async function processContact(id, env) {
  const initial = await readContact(env, id);
  if (!initial) return { action: "ack", outcome: "missing" };
  if (initial.sync_status === "synced") return { action: "ack", outcome: "already_synced" };
  if (initial.sync_status === "failed") return { action: "ack", outcome: "already_failed" };

  const claimed = await claimContact(env, id);
  if (!claimed) return { action: "ack", outcome: "claim_not_acquired" };

  const contacto = await readContact(env, id);
  if (!contacto) throw new WorkerInternalError("d1_claimed_contact_missing");

  let notionPageId;
  try {
    notionPageId = await crearFilaEnNotion(contacto, env);
  } catch (error) {
    if (error instanceof NotionRequestError) {
      return persistFailure(env, id, error);
    }
    throw new WorkerInternalError("notion_unclassified_failure");
  }

  await persistSuccess(env, id, notionPageId);
  return { action: "ack", outcome: "synced" };
}

async function processQueueMessage(message, env) {
  const contactId = safeContactId(message?.body?.id);
  try {
    const result = await processContact(message?.body?.id, env);
    if (result.action === "retry") {
      message.retry({ delaySeconds: result.delaySeconds });
      logTechnical("warn", "contact_retry_scheduled", {
        contactId,
        code: result.code,
        status: result.status,
        retryCount: result.retryCountFinal,
        delay: result.delaySeconds,
      });
      return;
    }

    message.ack();
    if (["definitive_failure", "exhausted"].includes(result.outcome)) {
      logTechnical("error", "contact_processing_stopped", {
        contactId,
        code: result.code,
        status: result.status,
        retryCount: result.retryCountFinal,
        outcome: result.outcome,
      });
    }
  } catch (error) {
    const code = normalizeTechnicalCode(error?.code, "internal_failure");
    message.retry({ delaySeconds: INTERNAL_RETRY_DELAY_SECONDS });
    logTechnical("error", "contact_internal_error", { contactId, code, delay: INTERNAL_RETRY_DELAY_SECONDS });
  }
}

async function requeueStaleContacts(env) {
  const candidates = await env.DB.prepare(`
    SELECT id FROM contacts
    WHERE (
      sync_status = 'pending'
      AND created_at < datetime('now', ?)
    ) OR (
      sync_status = 'syncing'
      AND sync_started_at IS NOT NULL
      AND sync_started_at < datetime('now', ?)
    )
    LIMIT 50
  `).bind(`-${PENDING_REQUEUE_MINUTES} minutes`, `-${SYNCING_STALE_MINUTES} minutes`).all();

  for (const row of candidates.results) {
    try {
      await env.CONTACT_QUEUE.send({ id: row.id });
    } catch {
      logTechnical("error", "contact_requeue_failed", { contactId: safeContactId(row.id) });
    }
  }
}

async function alertFailedContacts(env) {
  const failed = await env.DB.prepare(`
    SELECT id, nombre, email, form_type, last_error FROM contacts
    WHERE sync_status = 'failed' AND alerted = 0
    LIMIT 20
  `).all();

  if (failed.results.length === 0 || !env.EMAIL) return;

  const list = failed.results
    .map((contact) => `- ${contact.nombre} (${contact.email}, ${tipoLegible(contact.form_type)}). Error: ${contact.last_error || "desconocido"}`)
    .join("\n");
  const text = [
    `${failed.results.length} contacto(s) del formulario no llegaron correctamente a Notion:`,
    "",
    list,
    "",
    "Los contactos permanecen guardados en D1 y requieren revisión manual.",
  ].join("\n");

  try {
    await env.EMAIL.send({
      to: [{ email: "hola@solazstudio.cl" }],
      from: { email: "alertas@solazstudio.cl", name: "Alertas Solaz Web" },
      subject: "Contactos que no se sincronizaron con Notion",
      text,
    });
    const ids = failed.results.map((contact) => contact.id);
    await env.DB.prepare(
      `UPDATE contacts SET alerted = 1 WHERE id IN (${ids.map(() => "?").join(",")})`,
    ).bind(...ids).run();
  } catch {
    logTechnical("error", "contact_alert_failed", { count: failed.results.length });
  }
}

const worker = {
  async queue(batch, env) {
    for (const message of batch.messages) {
      await processQueueMessage(message, env);
    }
  },

  async scheduled(event, env, ctx) {
    await requeueStaleContacts(env);
    await alertFailedContacts(env);
  },
};

export {
  INTERNAL_RETRY_DELAY_SECONDS,
  MAX_REINTENTOS,
  PENDING_REQUEUE_MINUTES,
  SYNCING_STALE_MINUTES,
  calculateBackoffSeconds,
  parseRetryAfterSeconds,
  processContact,
  worker as default,
};
