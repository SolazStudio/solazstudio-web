import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { fileURLToPath } from "node:url";

import worker, {
  MAX_REINTENTOS,
  calculateBackoffSeconds,
  parseRetryAfterSeconds,
  processContact,
} from "../src/index.js";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const PAGE_ID_1 = "11111111-1111-4111-8111-111111111111";
const PAGE_ID_2 = "22222222-2222-4222-8222-222222222222";
const NETWORK_DISABLED = async () => { throw new Error("Real network is disabled in this test suite"); };
globalThis.fetch = NETWORK_DISABLED;

function sqlDate(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function parseSqlDate(value) {
  return Date.parse(`${value.replace(" ", "T")}Z`);
}

function clone(value) {
  return value ? { ...value } : value;
}

class FakeStatement {
  constructor(database, sql) {
    this.database = database;
    this.sql = sql.replace(/\s+/g, " ").trim();
    this.bindings = [];
  }

  bind(...bindings) {
    this.bindings = bindings;
    return this;
  }

  async first() {
    if (this.sql === "SELECT * FROM contacts WHERE id = ?") {
      return clone(this.database.rows.get(this.bindings[0]) || null);
    }
    if (this.sql === "SELECT retry_count, sync_status FROM contacts WHERE id = ?") {
      const row = this.database.rows.get(this.bindings[0]);
      return row ? { retry_count: row.retry_count, sync_status: row.sync_status } : null;
    }
    throw new Error(`Unsupported first(): ${this.sql}`);
  }

  async all() {
    if (this.sql.startsWith("SELECT id FROM contacts WHERE COALESCE(retry_count, 0) < ?")) {
      const [maxRetries, pendingModifier, syncingModifier] = this.bindings;
      const pendingMinutes = Number.parseInt(pendingModifier.match(/\d+/)?.[0] || "0", 10);
      const syncingMinutes = Number.parseInt(syncingModifier.match(/\d+/)?.[0] || "0", 10);
      const pendingCutoff = this.database.now.getTime() - pendingMinutes * 60_000;
      const syncingCutoff = this.database.now.getTime() - syncingMinutes * 60_000;
      const results = [...this.database.rows.values()]
        .filter((row) => Number(row.retry_count || 0) < maxRetries)
        .filter((row) => (
          row.sync_status === "pending"
          && (row.next_attempt_at !== null
            ? parseSqlDate(row.next_attempt_at) <= this.database.now.getTime()
            : parseSqlDate(row.created_at) < pendingCutoff)
        ) || (
          row.sync_status === "syncing"
          && row.sync_started_at !== null
          && parseSqlDate(row.sync_started_at) < syncingCutoff
        ))
        .slice(0, 50)
        .map((row) => ({ id: row.id }));
      return { results };
    }
    if (this.sql.startsWith("SELECT id, nombre, email, form_type, last_error FROM contacts")) {
      this.database.lastAlertSql = this.sql;
      return {
        results: [...this.database.rows.values()]
          .filter((row) => row.sync_status === "failed" && row.alerted === 0)
          .slice(0, 20)
          .map(clone),
      };
    }
    throw new Error(`Unsupported all(): ${this.sql}`);
  }

  async run() {
    if (this.sql.includes("SET sync_status = 'syncing', sync_started_at = datetime('now'), next_attempt_at = NULL")) {
      const [id, maxRetries, staleModifier] = this.bindings;
      const row = this.database.rows.get(id);
      const staleMinutes = Number.parseInt(staleModifier.match(/\d+/)?.[0] || "0", 10);
      const staleCutoff = this.database.now.getTime() - staleMinutes * 60_000;
      const eligible = row && Number(row.retry_count || 0) < maxRetries && (
        (row.sync_status === "pending" && (
          row.next_attempt_at === null || parseSqlDate(row.next_attempt_at) <= this.database.now.getTime()
        )) || (
          row.sync_status === "syncing"
          && row.sync_started_at !== null
          && parseSqlDate(row.sync_started_at) < staleCutoff
        )
      );
      if (!eligible) return { success: true, meta: { changes: 0 } };
      row.sync_status = "syncing";
      row.sync_started_at = sqlDate(this.database.now);
      row.next_attempt_at = null;
      this.database.claimCount += 1;
      return { success: true, meta: { changes: 1 } };
    }
    if (this.sql.includes("SET notion_reconcile_started_at = datetime('now')")) {
      const row = this.database.rows.get(this.bindings[0]);
      if (!row || row.sync_status !== "syncing" || row.notion_reconcile_started_at !== null) {
        return { success: true, meta: { changes: 0 } };
      }
      row.notion_reconcile_started_at = sqlDate(this.database.now);
      return { success: true, meta: { changes: 1 } };
    }
    if (this.sql.includes("SET retry_count = COALESCE(retry_count, 0) + 1")) {
      const [retryableFlag, maxRetries, diagnostic, , , delayModifier, clearReconciliation, id] = this.bindings;
      const row = this.database.rows.get(id);
      if (!row || row.sync_status !== "syncing") return { success: true, meta: { changes: 0 } };
      row.retry_count = Number(row.retry_count || 0) + 1;
      row.sync_status = retryableFlag === 0 || row.retry_count >= maxRetries ? "failed" : "pending";
      row.last_error = diagnostic;
      row.sync_started_at = null;
      if (retryableFlag === 1 && row.retry_count < maxRetries) {
        const seconds = Number.parseInt(delayModifier.match(/\d+/)?.[0] || "0", 10);
        row.next_attempt_at = sqlDate(new Date(this.database.now.getTime() + seconds * 1000));
      } else {
        row.next_attempt_at = null;
      }
      if (clearReconciliation === 1) row.notion_reconcile_started_at = null;
      return { success: true, meta: { changes: 1 } };
    }
    if (this.sql.includes("SET sync_status = 'synced'")) {
      if (this.database.failSuccessWrites > 0) {
        this.database.failSuccessWrites -= 1;
        throw new Error("synthetic D1 final write failure");
      }
      const [notionPageId, id] = this.bindings;
      const row = this.database.rows.get(id);
      if (!row || row.sync_status !== "syncing") return { success: true, meta: { changes: 0 } };
      Object.assign(row, {
        sync_status: "synced",
        notion_page_id: notionPageId,
        synced_at: sqlDate(this.database.now),
        last_error: null,
        sync_started_at: null,
        next_attempt_at: null,
        notion_reconcile_started_at: null,
      });
      return { success: true, meta: { changes: 1 } };
    }
    if (this.sql.startsWith("UPDATE contacts SET alerted = 1 WHERE id IN")) {
      for (const id of this.bindings) {
        const row = this.database.rows.get(id);
        if (row) row.alerted = 1;
      }
      return { success: true, meta: { changes: this.bindings.length } };
    }
    throw new Error(`Unsupported run(): ${this.sql}`);
  }
}

class FakeD1 {
  constructor(rows = [], { now = new Date("2026-09-07T12:00:00Z") } = {}) {
    this.rows = new Map(rows.map((row) => [row.id, clone(row)]));
    this.now = now;
    this.claimCount = 0;
    this.failSuccessWrites = 0;
    this.lastAlertSql = null;
  }
  prepare(sql) { return new FakeStatement(this, sql); }
  advanceSeconds(seconds) { this.now = new Date(this.now.getTime() + seconds * 1000); }
}

class FakeQueue {
  constructor({ failCalls = [] } = {}) {
    this.calls = [];
    this.failCalls = new Set(failCalls);
  }
  async send(body) {
    this.calls.push(clone(body));
    if (this.failCalls.has(this.calls.length)) throw new Error("synthetic Queue failure");
  }
}

class FakeEmail {
  constructor({ fail = false } = {}) { this.fail = fail; this.calls = []; }
  async send(payload) {
    this.calls.push(payload);
    if (this.fail) throw new Error("synthetic email failure");
  }
}

function contact(overrides = {}) {
  return {
    id: "contact-1",
    created_at: "2026-09-07 10:00:00",
    form_type: "mensaje",
    nombre: "Persona Sintética",
    empresa: "Empresa Sintética",
    email: "persona@example.test",
    telefono: "+56 9 1111 2222",
    mensaje: "Mensaje sintético privado",
    presupuesto: "Presupuesto sintético",
    consent_marketing: 0,
    sync_status: "pending",
    notion_page_id: null,
    retry_count: 0,
    last_error: null,
    synced_at: null,
    alerted: 0,
    sync_started_at: null,
    next_attempt_at: null,
    notion_reconcile_started_at: null,
    ...overrides,
  };
}

function notionResponse(status, body, headers = {}, { bodyReadFails = false } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get(name) {
      const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
      return key ? String(headers[key]) : null;
    } },
    async text() {
      if (bodyReadFails) throw new Error("synthetic body read failure");
      return body;
    },
  };
}

function queryResponse(ids = [], { hasMore = false } = {}) {
  return notionResponse(200, JSON.stringify({
    object: "list",
    has_more: hasMore,
    results: ids.map((id) => ({ id, object: "page", properties: { Ignorada: "sensitive" } })),
  }));
}

function message(id = "contact-1") {
  return {
    body: { id }, ackCount: 0, retryCalls: [],
    ack() { this.ackCount += 1; },
    retry(options) { this.retryCalls.push(options); },
  };
}

function environment(database, overrides = {}) {
  return {
    DB: database,
    CONTACT_QUEUE: new FakeQueue(),
    EMAIL: new FakeEmail(),
    NOTION_DATABASE_ID: "synthetic-database-id",
    NOTION_TOKEN: "synthetic-token",
    ...overrides,
  };
}

function fetchSequence(steps, calls) {
  const pending = [...steps];
  return async (url, options) => {
    calls.push({ url: String(url), options });
    if (pending.length === 0) throw new Error("Unexpected synthetic fetch");
    const step = pending.shift();
    if (step instanceof Error) throw step;
    return typeof step === "function" ? step(url, options) : step;
  };
}

const countQueries = (calls) => calls.filter((call) => call.url.includes("/v1/databases/") && call.url.endsWith("/query")).length;
const countCreates = (calls) => calls.filter((call) => call.url === "https://api.notion.com/v1/pages").length;

async function withFetch(fetchMock, callback) {
  globalThis.fetch = fetchMock;
  try { return await callback(); } finally { globalThis.fetch = NETWORK_DISABLED; }
}

async function captureLogs(callback) {
  const original = { log: console.log, warn: console.warn, error: console.error };
  const entries = [];
  console.log = (...args) => entries.push(args);
  console.warn = (...args) => entries.push(args);
  console.error = (...args) => entries.push(args);
  try { await callback(); return entries; } finally { Object.assign(console, original); }
}

async function runQueue(db, steps, { msg = message(), envOverrides = {} } = {}) {
  const calls = [];
  const env = environment(db, envOverrides);
  const logs = await captureLogs(() => withFetch(fetchSequence(steps, calls), () => worker.queue({ messages: [msg] }, env)));
  return { calls, env, logs, msg };
}

test("1 - éxito normal busca, crea con ID envío web y sincroniza", async () => {
  const db = new FakeD1([contact()]);
  const result = await runQueue(db, [queryResponse([]), notionResponse(200, JSON.stringify({ id: PAGE_ID_1 }))]);
  const row = db.rows.get("contact-1");
  assert.equal(countQueries(result.calls), 1);
  assert.equal(countCreates(result.calls), 1);
  assert.deepEqual(JSON.parse(result.calls[0].options.body), {
    filter: { property: "ID envío web", rich_text: { equals: "contact-1" } }, page_size: 2,
  });
  const create = JSON.parse(result.calls[1].options.body);
  assert.equal(create.properties["ID envío web"].rich_text[0].text.content, "contact-1");
  assert.deepEqual(Object.keys(create.properties), ["Nombre", "Empresa", "Email", "Teléfono", "Mensaje", "Presupuesto", "Marketing", "Tipo", "ID envío web"]);
  assert.equal(row.sync_status, "synced");
  assert.equal(row.notion_page_id, PAGE_ID_1);
  assert.equal(row.next_attempt_at, null);
  assert.equal(row.notion_reconcile_started_at, null);
  assert.equal(result.msg.ackCount, 1);
});

test("2 - página existente reconcilia D1 sin CREATE", async () => {
  const db = new FakeD1([contact()]);
  const result = await runQueue(db, [queryResponse([PAGE_ID_1])]);
  assert.equal(countCreates(result.calls), 0);
  assert.equal(db.rows.get("contact-1").sync_status, "synced");
  assert.equal(db.rows.get("contact-1").notion_page_id, PAGE_ID_1);
});

test("3 - múltiples coincidencias fallan sin CREATE", async () => {
  const db = new FakeD1([contact()]);
  const result = await runQueue(db, [queryResponse([PAGE_ID_1, PAGE_ID_2])]);
  assert.equal(countCreates(result.calls), 0);
  assert.equal(db.rows.get("contact-1").sync_status, "failed");
  assert.match(db.rows.get("contact-1").last_error, /^notion_idempotency_multiple_matches;/);
});

test("3b - has_more impide declarar una coincidencia como única", async () => {
  const db = new FakeD1([contact()]);
  const result = await runQueue(db, [queryResponse([PAGE_ID_1], { hasMore: true })]);
  assert.equal(countCreates(result.calls), 0);
  assert.equal(db.rows.get("contact-1").sync_status, "failed");
  assert.match(db.rows.get("contact-1").last_error, /^notion_idempotency_multiple_matches;/);
});

test("4 - dos ejecuciones concurrentes obtienen un solo claim y un solo CREATE", async () => {
  const db = new FakeD1([contact()]);
  const calls = [];
  const results = await withFetch(fetchSequence([queryResponse([]), notionResponse(200, JSON.stringify({ id: PAGE_ID_1 }))], calls), () => Promise.all([
    processContact("contact-1", environment(db)), processContact("contact-1", environment(db)),
  ]));
  assert.equal(db.claimCount, 1);
  assert.equal(countQueries(calls), 1);
  assert.equal(countCreates(calls), 1);
  assert.ok(results.some((result) => result.outcome === "claim_not_acquired"));
});

test("5 - contacto ya synced evita búsqueda y CREATE", async () => {
  const db = new FakeD1([contact({ sync_status: "synced", notion_page_id: PAGE_ID_1 })]);
  const msg = message();
  await worker.queue({ messages: [msg] }, environment(db));
  assert.equal(db.claimCount, 0);
  assert.equal(msg.ackCount, 1);
});

test("6 - syncing reciente no obtiene claim", async () => {
  const db = new FakeD1([contact({ sync_status: "syncing", sync_started_at: "2026-09-07 11:50:00" })]);
  const msg = message();
  await worker.queue({ messages: [msg] }, environment(db));
  assert.equal(db.claimCount, 0);
});

test("7 - pending con next_attempt_at futuro no obtiene claim", async () => {
  const db = new FakeD1([contact({ next_attempt_at: "2026-09-07 12:00:01" })]);
  const msg = message();
  await worker.queue({ messages: [msg] }, environment(db));
  assert.equal(db.claimCount, 0);
});

test("8 - CREATE 429 respeta Retry-After y persiste el mismo límite", async () => {
  const db = new FakeD1([contact()]);
  const result = await runQueue(db, [queryResponse([]), notionResponse(429, JSON.stringify({ code: "rate_limited" }), { "Retry-After": "120" })]);
  const row = db.rows.get("contact-1");
  assert.equal(row.next_attempt_at, "2026-09-07 12:02:00");
  assert.equal(row.notion_reconcile_started_at, null);
  assert.deepEqual(result.msg.retryCalls, [{ delaySeconds: 120 }]);
});

test("9 - CREATE 429 inválido usa backoff durable determinista", async () => {
  const db = new FakeD1([contact()]);
  const result = await runQueue(db, [queryResponse([]), notionResponse(429, "{}", { "Retry-After": "invalid" })]);
  assert.equal(db.rows.get("contact-1").next_attempt_at, "2026-09-07 12:01:00");
  assert.deepEqual(result.msg.retryCalls, [{ delaySeconds: 60 }]);
});

test("10 - CREATE 500 entra reconcile-only y nunca hace segundo CREATE", async () => {
  const db = new FakeD1([contact()]);
  const calls = [];
  const env = environment(db);
  await captureLogs(() => withFetch(fetchSequence([queryResponse([]), notionResponse(500, "{}")], calls), () => worker.queue({ messages: [message()] }, env)));
  const marker = db.rows.get("contact-1").notion_reconcile_started_at;
  assert.ok(marker);
  db.advanceSeconds(61);
  const second = message();
  await captureLogs(() => withFetch(fetchSequence([queryResponse([])], calls), () => worker.queue({ messages: [second] }, env)));
  assert.equal(countCreates(calls), 1);
  assert.equal(countQueries(calls), 2);
  assert.equal(db.rows.get("contact-1").notion_reconcile_started_at, marker);
  assert.deepEqual(second.retryCalls, [{ delaySeconds: 120 }]);
});

test("11 - error de red en CREATE entra reconcile-only", async () => {
  const db = new FakeD1([contact()]);
  const env = environment(db);
  const calls = [];
  await captureLogs(() => withFetch(
    fetchSequence([queryResponse([]), new Error("synthetic create network")], calls),
    () => worker.queue({ messages: [message()] }, env),
  ));
  assert.ok(db.rows.get("contact-1").notion_reconcile_started_at);
  db.advanceSeconds(61);
  await captureLogs(() => withFetch(
    fetchSequence([queryResponse([])], calls),
    () => worker.queue({ messages: [message()] }, env),
  ));
  assert.equal(countQueries(calls), 2);
  assert.equal(countCreates(calls), 1);
});

test("12 - CREATE 2xx inválido entra reconcile-only", async () => {
  const db = new FakeD1([contact()]);
  const result = await runQueue(db, [queryResponse([]), notionResponse(200, "not-json")]);
  assert.ok(db.rows.get("contact-1").notion_reconcile_started_at);
  assert.equal(db.rows.get("contact-1").sync_status, "pending");
  assert.deepEqual(result.msg.retryCalls, [{ delaySeconds: 60 }]);
});

test("13 - CREATE 2xx sin ID entra reconcile-only", async () => {
  const db = new FakeD1([contact()]);
  await runQueue(db, [queryResponse([]), notionResponse(200, JSON.stringify({ object: "page" }))]);
  assert.ok(db.rows.get("contact-1").notion_reconcile_started_at);
  assert.match(db.rows.get("contact-1").last_error, /ambiguous_success_missing_id/);
});

test("14 - fallo leyendo body 2xx de CREATE entra reconcile-only", async () => {
  const db = new FakeD1([contact()]);
  await runQueue(db, [queryResponse([]), notionResponse(200, "", {}, { bodyReadFails: true })]);
  assert.ok(db.rows.get("contact-1").notion_reconcile_started_at);
  assert.match(db.rows.get("contact-1").last_error, /ambiguous_success_body_read/);
});

test("15 - CREATE 400 es definitivo y limpia la marca preventiva", async () => {
  const db = new FakeD1([contact()]);
  const result = await runQueue(db, [queryResponse([]), notionResponse(400, JSON.stringify({ code: "validation_error" }))]);
  const row = db.rows.get("contact-1");
  assert.equal(row.sync_status, "failed");
  assert.equal(row.notion_reconcile_started_at, null);
  assert.equal(row.next_attempt_at, null);
  assert.deepEqual(result.msg.retryCalls, []);
});

test("16 - reconcile-only encuentra una página y sincroniza sin CREATE", async () => {
  const db = new FakeD1([contact({ notion_reconcile_started_at: "2026-09-07 11:00:00" })]);
  const result = await runQueue(db, [queryResponse([PAGE_ID_1])]);
  assert.equal(countCreates(result.calls), 0);
  assert.equal(db.rows.get("contact-1").sync_status, "synced");
  assert.equal(db.rows.get("contact-1").notion_reconcile_started_at, null);
});

test("17 - reconcile-only sin coincidencia reintenta y conserva la marca", async () => {
  const marker = "2026-09-07 11:00:00";
  const db = new FakeD1([contact({ notion_reconcile_started_at: marker })]);
  const result = await runQueue(db, [queryResponse([])]);
  const row = db.rows.get("contact-1");
  assert.equal(countCreates(result.calls), 0);
  assert.equal(row.sync_status, "pending");
  assert.equal(row.notion_reconcile_started_at, marker);
  assert.equal(row.next_attempt_at, "2026-09-07 12:01:00");
});

test("18 - reconcile-only agotado falla sin CREATE", async () => {
  const marker = "2026-09-07 11:00:00";
  const db = new FakeD1([contact({ retry_count: 5, notion_reconcile_started_at: marker })]);
  const result = await runQueue(db, [queryResponse([])]);
  const row = db.rows.get("contact-1");
  assert.equal(countCreates(result.calls), 0);
  assert.equal(row.retry_count, MAX_REINTENTOS);
  assert.equal(row.sync_status, "failed");
  assert.equal(row.next_attempt_at, null);
  assert.equal(row.notion_reconcile_started_at, marker);
  assert.match(row.last_error, /^notion_reconcile_not_found;/);
});

test("19 - éxito Notion y fallo D1 se reconcilia stale sin segundo CREATE", async () => {
  const db = new FakeD1([contact()]);
  db.failSuccessWrites = 1;
  const env = environment(db);
  const calls = [];
  const first = message();
  await captureLogs(() => withFetch(fetchSequence([queryResponse([]), notionResponse(200, JSON.stringify({ id: PAGE_ID_1 }))], calls), () => worker.queue({ messages: [first] }, env)));
  assert.equal(countCreates(calls), 1);
  assert.equal(db.rows.get("contact-1").sync_status, "syncing");
  assert.ok(db.rows.get("contact-1").notion_reconcile_started_at);
  db.rows.get("contact-1").sync_started_at = "2026-09-07 11:39:59";
  const second = message();
  await withFetch(fetchSequence([queryResponse([PAGE_ID_1])], calls), () => worker.queue({ messages: [second] }, env));
  assert.equal(countQueries(calls), 2);
  assert.equal(countCreates(calls), 1);
  assert.equal(db.rows.get("contact-1").sync_status, "synced");
  assert.equal(db.rows.get("contact-1").notion_page_id, PAGE_ID_1);
});

test("20 - búsqueda 429 no crea y persiste retry durable", async () => {
  const db = new FakeD1([contact()]);
  const result = await runQueue(db, [notionResponse(429, "{}", { "Retry-After": "90" })]);
  assert.equal(countCreates(result.calls), 0);
  assert.equal(db.rows.get("contact-1").next_attempt_at, "2026-09-07 12:01:30");
  assert.deepEqual(result.msg.retryCalls, [{ delaySeconds: 90 }]);
});

test("21 - búsqueda 500 no crea y usa backoff durable", async () => {
  const marker = "2026-09-07 11:00:00";
  const db = new FakeD1([contact({ notion_reconcile_started_at: marker })]);
  const result = await runQueue(db, [notionResponse(500, "{}")]);
  assert.equal(countCreates(result.calls), 0);
  assert.equal(db.rows.get("contact-1").next_attempt_at, "2026-09-07 12:01:00");
  assert.equal(db.rows.get("contact-1").notion_reconcile_started_at, marker);
});

test("22 - error de red en búsqueda no crea y usa backoff durable", async () => {
  const db = new FakeD1([contact()]);
  const result = await runQueue(db, [new Error("synthetic query network")]);
  assert.equal(countCreates(result.calls), 0);
  assert.equal(db.rows.get("contact-1").sync_status, "pending");
  assert.equal(db.rows.get("contact-1").next_attempt_at, "2026-09-07 12:01:00");
});

test("23 - body inválido de búsqueda nunca se interpreta como cero", async () => {
  const db = new FakeD1([contact()]);
  const result = await runQueue(db, [notionResponse(200, "not-json")]);
  assert.equal(countCreates(result.calls), 0);
  assert.equal(db.rows.get("contact-1").sync_status, "pending");
  assert.match(db.rows.get("contact-1").last_error, /^notion_query_invalid_body;/);
});

test("24 - resultado de búsqueda con page ID inválido no crea", async () => {
  const db = new FakeD1([contact()]);
  const result = await runQueue(db, [notionResponse(200, JSON.stringify({ has_more: false, results: [{ id: "invalid" }] }))]);
  assert.equal(countCreates(result.calls), 0);
  assert.equal(db.rows.get("contact-1").sync_status, "pending");
});

test("25 - búsqueda 400 es definitiva y no crea", async () => {
  const db = new FakeD1([contact()]);
  const result = await runQueue(db, [notionResponse(400, JSON.stringify({ code: "validation_error" }))]);
  assert.equal(countCreates(result.calls), 0);
  assert.equal(db.rows.get("contact-1").sync_status, "failed");
  assert.equal(result.msg.ackCount, 1);
});

test("26 - scheduled no reencola pending con next_attempt_at futuro", async () => {
  const db = new FakeD1([contact({ next_attempt_at: "2026-09-07 12:00:01" })]);
  const queue = new FakeQueue();
  await worker.scheduled({}, environment(db, { CONTACT_QUEUE: queue }), {});
  assert.deepEqual(queue.calls, []);
});

test("27 - scheduled reencola pending exactamente vencido y vencido", async () => {
  const db = new FakeD1([
    contact({ id: "contact-1", next_attempt_at: "2026-09-07 12:00:00" }),
    contact({ id: "contact-2", next_attempt_at: "2026-09-07 11:59:59" }),
  ]);
  const queue = new FakeQueue();
  await worker.scheduled({}, environment(db, { CONTACT_QUEUE: queue }), {});
  assert.deepEqual(queue.calls, [{ id: "contact-1" }, { id: "contact-2" }]);
});

test("28 - scheduled conserva recuperación legacy de pending antiguo", async () => {
  const db = new FakeD1([contact({ created_at: "2026-09-07 11:49:59", next_attempt_at: null })]);
  const queue = new FakeQueue();
  await worker.scheduled({}, environment(db, { CONTACT_QUEUE: queue }), {});
  assert.deepEqual(queue.calls, [{ id: "contact-1" }]);
});

test("29 - scheduled no reencola pending legacy reciente", async () => {
  const db = new FakeD1([contact({ created_at: "2026-09-07 11:50:01", next_attempt_at: null })]);
  const queue = new FakeQueue();
  await worker.scheduled({}, environment(db, { CONTACT_QUEUE: queue }), {});
  assert.deepEqual(queue.calls, []);
});

test("30 - scheduled reencola syncing stale", async () => {
  const db = new FakeD1([contact({ sync_status: "syncing", sync_started_at: "2026-09-07 11:39:59" })]);
  const queue = new FakeQueue();
  await worker.scheduled({}, environment(db, { CONTACT_QUEUE: queue }), {});
  assert.deepEqual(queue.calls, [{ id: "contact-1" }]);
});

test("31 - scheduled no reencola syncing reciente", async () => {
  const db = new FakeD1([contact({ sync_status: "syncing", sync_started_at: "2026-09-07 11:40:01" })]);
  const queue = new FakeQueue();
  await worker.scheduled({}, environment(db, { CONTACT_QUEUE: queue }), {});
  assert.deepEqual(queue.calls, []);
});

test("32 - scheduled no reencola failed ni retry agotado", async () => {
  const db = new FakeD1([
    contact({ id: "contact-1", sync_status: "failed" }),
    contact({ id: "contact-2", retry_count: 6 }),
  ]);
  const queue = new FakeQueue();
  await worker.scheduled({}, environment(db, { CONTACT_QUEUE: queue, EMAIL: undefined }), {});
  assert.deepEqual(queue.calls, []);
});

test("33 - fallo de un Queue.send del cron no aborta candidatos posteriores", async () => {
  const db = new FakeD1([contact({ id: "contact-1" }), contact({ id: "contact-2" }), contact({ id: "contact-3" })]);
  const queue = new FakeQueue({ failCalls: [2] });
  await captureLogs(() => worker.scheduled({}, environment(db, { CONTACT_QUEUE: queue }), {}));
  assert.deepEqual(queue.calls, [{ id: "contact-1" }, { id: "contact-2" }, { id: "contact-3" }]);
});

test("34 - alerta exitosa marca alerted=1", async () => {
  const db = new FakeD1([contact({ sync_status: "failed", retry_count: 6 })]);
  const email = new FakeEmail();
  await worker.scheduled({}, environment(db, { EMAIL: email }), {});
  assert.equal(email.calls.length, 1);
  assert.equal(db.rows.get("contact-1").alerted, 1);
});

test("35 - alerta fallida conserva alerted=0", async () => {
  const db = new FakeD1([contact({ sync_status: "failed", retry_count: 6 })]);
  const email = new FakeEmail({ fail: true });
  await captureLogs(() => worker.scheduled({}, environment(db, { EMAIL: email }), {}));
  assert.equal(db.rows.get("contact-1").alerted, 0);
});

test("36 - fallo definitivo temprano sigue siendo alertable", async () => {
  const db = new FakeD1([contact({ sync_status: "failed", retry_count: 1 })]);
  const email = new FakeEmail();
  await worker.scheduled({}, environment(db, { EMAIL: email }), {});
  assert.equal(email.calls.length, 1);
  assert.equal(db.rows.get("contact-1").alerted, 1);
  assert.doesNotMatch(db.lastAlertSql, /retry_count/);
});

test("37 - logs y diagnósticos no contienen PII ni body remoto", async () => {
  const row = contact();
  const db = new FakeD1([row]);
  const remoteBody = [row.nombre, row.empresa, row.email, row.telefono, row.mensaje, row.presupuesto].join(" | ");
  const result = await runQueue(db, [notionResponse(400, JSON.stringify({ code: "validation_error", message: remoteBody }))]);
  const output = `${JSON.stringify(result.logs)} ${db.rows.get("contact-1").last_error}`;
  for (const value of [row.nombre, row.empresa, row.email, row.telefono, row.mensaje, row.presupuesto, remoteBody]) {
    assert.equal(output.includes(value), false);
  }
});

test("38 - backoff determinista exacto", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(calculateBackoffSeconds), [60, 120, 240, 480, 900]);
});

test("39 - Retry-After valida y clampa", () => {
  assert.equal(parseRetryAfterSeconds("0"), null);
  assert.equal(parseRetryAfterSeconds("invalid"), null);
  assert.equal(parseRetryAfterSeconds("1"), 1);
  assert.equal(parseRetryAfterSeconds("7200"), 3600);
});

test("40 - migración 0002 permanece semánticamente intacta", async () => {
  const migration = await readFile(path.join(TEST_DIR, "../../../migrations/0002_add_sync_started_at.sql"), "utf8");
  assert.equal(migration.trim(), "ALTER TABLE contacts ADD COLUMN sync_started_at TEXT;");
  assert.equal((migration.match(/ADD\s+COLUMN/gi) || []).length, 1);
  assert.doesNotMatch(migration, /\b(?:INSERT|UPDATE|DELETE)\b/i);
});

test("41 - migración 0003 añade exactamente las dos columnas autorizadas", async () => {
  const migration = await readFile(path.join(TEST_DIR, "../../../migrations/0003_add_retry_reconciliation_state.sql"), "utf8");
  assert.deepEqual(migration.trim().split(/\r?\n/), [
    "ALTER TABLE contacts ADD COLUMN next_attempt_at TEXT;",
    "ALTER TABLE contacts ADD COLUMN notion_reconcile_started_at TEXT;",
  ]);
  assert.equal((migration.match(/ADD\s+COLUMN/gi) || []).length, 2);
  assert.doesNotMatch(migration, /\b(?:INSERT|UPDATE|DELETE)\b/i);
});

test("42 - migración 0003 aplica sobre SQLite sintético y preserva la fila", async () => {
  const migration = await readFile(path.join(TEST_DIR, "../../../migrations/0003_add_retry_reconciliation_state.sql"), "utf8");
  const database = new DatabaseSync(":memory:");
  try {
    database.exec("CREATE TABLE contacts (id TEXT PRIMARY KEY, legacy_value TEXT, sync_started_at TEXT)");
    database.prepare("INSERT INTO contacts (id, legacy_value, sync_started_at) VALUES (?, ?, ?)")
      .run("synthetic-contact", "preserved", "2026-09-07 10:00:00");
    database.exec(migration);
    const columns = database.prepare("PRAGMA table_info(contacts)").all();
    const nextAttempt = columns.find((column) => column.name === "next_attempt_at");
    const reconcile = columns.find((column) => column.name === "notion_reconcile_started_at");
    assert.deepEqual({ type: nextAttempt.type, notnull: nextAttempt.notnull }, { type: "TEXT", notnull: 0 });
    assert.deepEqual({ type: reconcile.type, notnull: reconcile.notnull }, { type: "TEXT", notnull: 0 });
    const row = database.prepare("SELECT * FROM contacts WHERE id = ?").get("synthetic-contact");
    assert.equal(row.legacy_value, "preserved");
    assert.equal(row.sync_started_at, "2026-09-07 10:00:00");
    assert.equal(row.next_attempt_at, null);
    assert.equal(row.notion_reconcile_started_at, null);
  } finally {
    database.close();
  }
});

test("43 - baseline F2.2 conserva su SHA-256 exacto", async () => {
  const baseline = await readFile(path.join(TEST_DIR, "../baseline/src/index.js"));
  const hash = createHash("sha256").update(baseline).digest("hex");
  assert.equal(hash, "f899e72d438bc63a871d6480349bba6f7fd618f8e2d68bba8902d22063f80b7c");
});
