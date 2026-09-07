const NOTION_VERSION = "2022-06-28";
const NOTION_PAGES_API = "https://api.notion.com/v1/pages";
const NOTION_DATABASES_API = "https://api.notion.com/v1/databases";
const MAX_REINTENTOS = 6;
const PENDING_REQUEUE_MINUTES = 10;
const SYNCING_STALE_MINUTES = 20;
const INTERNAL_RETRY_DELAY_SECONDS = 60;
const MAX_DIAGNOSTIC_LENGTH = 240;

class NotionRequestError extends Error {
  constructor({ code, retryable, status = null, retryAfterSeconds = null, diagnostic, ambiguousCreate = false }) {
    super(code);
    this.name = "NotionRequestError";
    this.code = code;
    this.retryable = retryable;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
    this.diagnostic = diagnostic;
    this.ambiguousCreate = ambiguousCreate;
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
    "ID envío web": { rich_text: [{ text: { content: contacto.id } }] },
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

function parseNotionQueryBody(text) {
  try {
    const parsed = JSON.parse(text);
    if (
      !parsed
      || typeof parsed !== "object"
      || Array.isArray(parsed)
      || !Array.isArray(parsed.results)
      || typeof parsed.has_more !== "boolean"
    ) {
      return null;
    }
    const ids = [];
    for (const result of parsed.results) {
      if (!result || typeof result !== "object" || Array.isArray(result) || !isUsableNotionId(result.id)) {
        return null;
      }
      ids.push(result.id);
    }
    if (parsed.has_more && ids.length === 0) return null;
    return { ids, hasMore: parsed.has_more };
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

async function buscarFilasEnNotion(contacto, env) {
  let response;
  try {
    response = await fetch(`${NOTION_DATABASES_API}/${encodeURIComponent(env.NOTION_DATABASE_ID)}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.NOTION_TOKEN}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: {
          property: "ID envío web",
          rich_text: { equals: contacto.id },
        },
        page_size: 2,
      }),
    });
  } catch {
    throw new NotionRequestError({
      code: "notion_query_network",
      retryable: true,
      diagnostic: notionDiagnostic("notion_query_network", null, null),
    });
  }

  let bodyText = "";
  let bodyReadFailed = false;
  try {
    bodyText = await response.text();
  } catch {
    bodyReadFailed = true;
  }

  const parsedError = bodyReadFailed ? null : parseNotionBody(bodyText);
  const remoteCode = normalizeTechnicalCode(parsedError?.code, "unknown");
  if (response.ok) {
    const queryResult = bodyReadFailed ? null : parseNotionQueryBody(bodyText);
    if (!queryResult) {
      throw new NotionRequestError({
        code: "notion_query_invalid_body",
        retryable: true,
        status: response.status,
        diagnostic: notionDiagnostic("notion_query_invalid_body", response.status, remoteCode),
      });
    }
    return queryResult;
  }

  const retryable = response.status === 429 || response.status >= 500;
  const code = response.status === 429
    ? "notion_query_http_429"
    : retryable
      ? "notion_query_http_5xx"
      : "notion_query_http_4xx";
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

async function crearFilaEnNotion(contacto, env) {
  let response;
  try {
    response = await fetch(NOTION_PAGES_API, {
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
      ambiguousCreate: true,
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
        retryable: true,
        status: response.status,
        diagnostic: notionDiagnostic("notion_ambiguous_success_body_read", response.status, remoteCode),
        ambiguousCreate: true,
      });
    }
    if (!parsed) {
      throw new NotionRequestError({
        code: "notion_ambiguous_success",
        retryable: true,
        status: response.status,
        diagnostic: notionDiagnostic("notion_ambiguous_success_invalid_json", response.status, remoteCode),
        ambiguousCreate: true,
      });
    }
    if (!isUsableNotionId(parsed.id)) {
      throw new NotionRequestError({
        code: "notion_ambiguous_success",
        retryable: true,
        status: response.status,
        diagnostic: notionDiagnostic("notion_ambiguous_success_missing_id", response.status, remoteCode),
        ambiguousCreate: true,
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
    ambiguousCreate: response.status >= 500,
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
      SET sync_status = 'syncing',
          sync_started_at = datetime('now'),
          next_attempt_at = NULL
      WHERE id = ?
        AND COALESCE(retry_count, 0) < ?
        AND (
          (
            sync_status = 'pending'
            AND (next_attempt_at IS NULL OR next_attempt_at <= datetime('now'))
          )
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

async function markReconciliationBeforeCreate(env, id) {
  let result;
  try {
    result = await env.DB.prepare(`
      UPDATE contacts
      SET notion_reconcile_started_at = datetime('now')
      WHERE id = ?
        AND sync_status = 'syncing'
        AND notion_reconcile_started_at IS NULL
    `).bind(id).run();
  } catch {
    throw new WorkerInternalError("d1_reconciliation_mark_failed");
  }
  if (Number(result?.meta?.changes) !== 1) {
    throw new WorkerInternalError("d1_reconciliation_mark_not_applied");
  }
}

async function persistFailure(env, id, error, { clearReconciliation = false } = {}) {
  let currentState;
  try {
    currentState = await env.DB.prepare(
      "SELECT retry_count, sync_status FROM contacts WHERE id = ?",
    ).bind(id).first();
  } catch {
    throw new WorkerInternalError("d1_failure_state_read_failed");
  }
  if (!currentState || currentState.sync_status !== "syncing") {
    throw new WorkerInternalError("d1_failure_state_missing");
  }

  const expectedRetryCount = Number(currentState.retry_count || 0) + 1;
  const retryable = error.retryable && expectedRetryCount < MAX_REINTENTOS;
  const delaySeconds = retryable
    ? error.retryAfterSeconds ?? calculateBackoffSeconds(expectedRetryCount)
    : null;
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
          sync_started_at = NULL,
          next_attempt_at = CASE
            WHEN ? = 1 AND COALESCE(retry_count, 0) + 1 < ? THEN datetime('now', ?)
            ELSE NULL
          END,
          notion_reconcile_started_at = CASE
            WHEN ? = 1 THEN NULL
            ELSE notion_reconcile_started_at
          END
      WHERE id = ? AND sync_status = 'syncing'
    `).bind(
      error.retryable ? 1 : 0,
      MAX_REINTENTOS,
      error.diagnostic,
      error.retryable ? 1 : 0,
      MAX_REINTENTOS,
      `+${delaySeconds ?? 0} seconds`,
      clearReconciliation ? 1 : 0,
      id,
    ).run();
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
      delaySeconds,
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
          sync_started_at = NULL,
          next_attempt_at = NULL,
          notion_reconcile_started_at = NULL
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

  let notionQueryResult;
  try {
    notionQueryResult = await buscarFilasEnNotion(contacto, env);
  } catch (error) {
    if (error instanceof NotionRequestError) {
      return persistFailure(env, id, error);
    }
    throw new WorkerInternalError("notion_unclassified_failure");
  }

  if (notionQueryResult.ids.length > 1 || notionQueryResult.hasMore) {
    return persistFailure(env, id, new NotionRequestError({
      code: "notion_idempotency_multiple_matches",
      retryable: false,
      status: 200,
      diagnostic: notionDiagnostic("notion_idempotency_multiple_matches", 200, "multiple_matches"),
    }));
  }

  if (notionQueryResult.ids.length === 1) {
    await persistSuccess(env, id, notionQueryResult.ids[0]);
    return { action: "ack", outcome: "reconciled" };
  }

  if (contacto.notion_reconcile_started_at !== null) {
    return persistFailure(env, id, new NotionRequestError({
      code: "notion_reconcile_not_found",
      retryable: true,
      status: 200,
      diagnostic: notionDiagnostic("notion_reconcile_not_found", 200, "not_found"),
    }));
  }

  await markReconciliationBeforeCreate(env, id);

  let notionPageId;
  try {
    notionPageId = await crearFilaEnNotion(contacto, env);
  } catch (error) {
    if (error instanceof NotionRequestError) {
      return persistFailure(env, id, error, {
        clearReconciliation: !error.ambiguousCreate,
      });
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
    WHERE COALESCE(retry_count, 0) < ?
      AND (
        (
          sync_status = 'pending'
          AND (
            (next_attempt_at IS NOT NULL AND next_attempt_at <= datetime('now'))
            OR (
              next_attempt_at IS NULL
              AND created_at < datetime('now', ?)
            )
          )
        ) OR (
          sync_status = 'syncing'
          AND sync_started_at IS NOT NULL
          AND sync_started_at < datetime('now', ?)
        )
      )
    LIMIT 50
  `).bind(
    MAX_REINTENTOS,
    `-${PENDING_REQUEUE_MINUTES} minutes`,
    `-${SYNCING_STALE_MINUTES} minutes`,
  ).all();

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
