import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
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
const NETWORK_DISABLED = async () => {
  throw new Error("Real network is disabled in this test suite");
};

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
    if (this.sql.startsWith("SELECT id FROM contacts WHERE ( sync_status = 'pending'")) {
      const pendingMinutes = Number.parseInt(this.bindings[0].match(/\d+/)?.[0] || "0", 10);
      const syncingMinutes = Number.parseInt(this.bindings[1].match(/\d+/)?.[0] || "0", 10);
      const pendingCutoff = this.database.now.getTime() - pendingMinutes * 60_000;
      const syncingCutoff = this.database.now.getTime() - syncingMinutes * 60_000;
      const results = [...this.database.rows.values()]
        .filter((row) => (
          row.sync_status === "pending" && parseSqlDate(row.created_at) < pendingCutoff
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
      const results = [...this.database.rows.values()]
        .filter((row) => row.sync_status === "failed" && row.alerted === 0)
        .slice(0, 20)
        .map(clone);
      return { results };
    }

    throw new Error(`Unsupported all(): ${this.sql}`);
  }

  async run() {
    if (this.sql.includes("SET sync_status = 'syncing', sync_started_at = datetime('now')")) {
      const [id, maxRetries, staleModifier] = this.bindings;
      const row = this.database.rows.get(id);
      const staleMinutes = Number.parseInt(staleModifier.match(/\d+/)?.[0] || "0", 10);
      const staleCutoff = this.database.now.getTime() - staleMinutes * 60_000;
      const eligible = row
        && Number(row.retry_count || 0) < maxRetries
        && (
          row.sync_status === "pending"
          || (
            row.sync_status === "syncing"
            && row.sync_started_at !== null
            && parseSqlDate(row.sync_started_at) < staleCutoff
          )
        );
      if (!eligible) return { success: true, meta: { changes: 0 } };
      row.sync_status = "syncing";
      row.sync_started_at = sqlDate(this.database.now);
      this.database.claimCount += 1;
      return { success: true, meta: { changes: 1 } };
    }

    if (this.sql.includes("SET retry_count = COALESCE(retry_count, 0) + 1")) {
      const [retryableFlag, maxRetries, diagnostic, id] = this.bindings;
      const row = this.database.rows.get(id);
      if (!row || row.sync_status !== "syncing") return { success: true, meta: { changes: 0 } };
      row.retry_count = Number(row.retry_count || 0) + 1;
      row.sync_status = retryableFlag === 0 || row.retry_count >= maxRetries ? "failed" : "pending";
      row.last_error = diagnostic;
      row.sync_started_at = null;
      return { success: true, meta: { changes: 1 } };
    }

    if (this.sql.includes("SET sync_status = 'synced'")) {
      if (this.database.failSuccessWrite) throw new Error("synthetic D1 final write failure");
      const [notionPageId, id] = this.bindings;
      const row = this.database.rows.get(id);
      if (!row || row.sync_status !== "syncing") return { success: true, meta: { changes: 0 } };
      row.sync_status = "synced";
      row.notion_page_id = notionPageId;
      row.synced_at = sqlDate(this.database.now);
      row.last_error = null;
      row.sync_started_at = null;
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
  constructor(rows = [], { now = new Date("2026-09-06T12:00:00Z") } = {}) {
    this.rows = new Map(rows.map((row) => [row.id, clone(row)]));
    this.now = now;
    this.claimCount = 0;
    this.failSuccessWrite = false;
    this.lastAlertSql = null;
  }

  prepare(sql) {
    return new FakeStatement(this, sql);
  }
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
  constructor({ fail = false } = {}) {
    this.fail = fail;
    this.calls = [];
  }

  async send(payload) {
    this.calls.push(payload);
    if (this.fail) throw new Error("synthetic email failure");
  }
}

function contact(overrides = {}) {
  return {
    id: "contact-1",
    created_at: "2026-09-06 10:00:00",
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
    ...overrides,
  };
}

function notionResponse(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
        return key ? String(headers[key]) : null;
      },
    },
    async text() {
      return body;
    },
  };
}

function message(id = "contact-1") {
  return {
    body: { id },
    ackCount: 0,
    retryCalls: [],
    ack() {
      this.ackCount += 1;
    },
    retry(options) {
      this.retryCalls.push(options);
    },
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

async function withFetch(fetchMock, callback) {
  globalThis.fetch = fetchMock;
  try {
    return await callback();
  } finally {
    globalThis.fetch = NETWORK_DISABLED;
  }
}

async function captureLogs(callback) {
  const original = { log: console.log, warn: console.warn, error: console.error };
  const entries = [];
  console.log = (...args) => entries.push(args);
  console.warn = (...args) => entries.push(args);
  console.error = (...args) => entries.push(args);
  try {
    await callback();
    return entries;
  } finally {
    console.log = original.log;
    console.warn = original.warn;
    console.error = original.error;
  }
}

test("1 - éxito normal", async () => {
  const db = new FakeD1([contact()]);
  const env = environment(db);
  const msg = message();
  let notionCalls = 0;

  await withFetch(async () => {
    notionCalls += 1;
    return notionResponse(200, JSON.stringify({ id: PAGE_ID_1 }));
  }, () => worker.queue({ messages: [msg] }, env));

  const row = db.rows.get("contact-1");
  assert.equal(db.claimCount, 1);
  assert.equal(notionCalls, 1);
  assert.equal(row.sync_status, "synced");
  assert.equal(row.notion_page_id, PAGE_ID_1);
  assert.ok(row.synced_at);
  assert.equal(row.sync_started_at, null);
  assert.equal(msg.ackCount, 1);
  assert.deepEqual(msg.retryCalls, []);
});

test("2 - dos ejecuciones concurrentes obtienen un solo claim", async () => {
  const db = new FakeD1([contact()]);
  const env = environment(db);
  let notionCalls = 0;

  const results = await withFetch(async () => {
    notionCalls += 1;
    return notionResponse(200, JSON.stringify({ id: PAGE_ID_1 }));
  }, () => Promise.all([
    processContact("contact-1", env),
    processContact("contact-1", env),
  ]));

  assert.equal(db.claimCount, 1);
  assert.equal(notionCalls, 1);
  assert.equal(db.rows.get("contact-1").sync_status, "synced");
  assert.ok(results.some((result) => result.outcome === "claim_not_acquired"));
});

test("3 - contacto ya synced retorna sin llamar a Notion", async () => {
  const db = new FakeD1([contact({ sync_status: "synced", notion_page_id: PAGE_ID_1 })]);
  const msg = message();
  await worker.queue({ messages: [msg] }, environment(db));
  assert.equal(db.claimCount, 0);
  assert.equal(msg.ackCount, 1);
  assert.deepEqual(msg.retryCalls, []);
});

test("4 - claim no obtenido para syncing reciente", async () => {
  const db = new FakeD1([contact({
    sync_status: "syncing",
    sync_started_at: "2026-09-06 11:50:00",
  })]);
  const msg = message();
  await worker.queue({ messages: [msg] }, environment(db));
  assert.equal(db.claimCount, 0);
  assert.equal(msg.ackCount, 1);
  assert.deepEqual(msg.retryCalls, []);
});

test("5 - HTTP 429 usa Retry-After válido", async () => {
  const db = new FakeD1([contact()]);
  const msg = message();
  await captureLogs(() => withFetch(
    async () => notionResponse(429, JSON.stringify({ code: "rate_limited", message: "slow down" }), { "Retry-After": "120" }),
    () => worker.queue({ messages: [msg] }, environment(db)),
  ));
  const row = db.rows.get("contact-1");
  assert.equal(row.retry_count, 1);
  assert.equal(row.sync_status, "pending");
  assert.equal(row.sync_started_at, null);
  assert.match(row.last_error, /^notion_http_429;/);
  assert.deepEqual(msg.retryCalls, [{ delaySeconds: 120 }]);
  assert.equal(msg.ackCount, 0);
});

test("6 - HTTP 429 inválido usa backoff", async () => {
  const db = new FakeD1([contact()]);
  const msg = message();
  await captureLogs(() => withFetch(
    async () => notionResponse(429, "{}", { "Retry-After": "invalid" }),
    () => worker.queue({ messages: [msg] }, environment(db)),
  ));
  assert.deepEqual(msg.retryCalls, [{ delaySeconds: 60 }]);
});

test("7 - HTTP 500 persiste pending y aplica backoff", async () => {
  const db = new FakeD1([contact({ retry_count: 1 })]);
  const msg = message();
  await captureLogs(() => withFetch(
    async () => notionResponse(500, JSON.stringify({ code: "internal_error" })),
    () => worker.queue({ messages: [msg] }, environment(db)),
  ));
  const row = db.rows.get("contact-1");
  assert.equal(row.retry_count, 2);
  assert.equal(row.sync_status, "pending");
  assert.deepEqual(msg.retryCalls, [{ delaySeconds: 120 }]);
});

test("8 - error de red es retryable", async () => {
  const db = new FakeD1([contact()]);
  const msg = message();
  await captureLogs(() => withFetch(
    async () => { throw new Error("synthetic network failure"); },
    () => worker.queue({ messages: [msg] }, environment(db)),
  ));
  assert.equal(db.rows.get("contact-1").retry_count, 1);
  assert.equal(db.rows.get("contact-1").sync_status, "pending");
  assert.deepEqual(msg.retryCalls, [{ delaySeconds: 60 }]);
});

test("9 - HTTP 400 es definitivo", async () => {
  const db = new FakeD1([contact()]);
  const msg = message();
  await captureLogs(() => withFetch(
    async () => notionResponse(400, JSON.stringify({ code: "validation_error" })),
    () => worker.queue({ messages: [msg] }, environment(db)),
  ));
  assert.equal(db.rows.get("contact-1").sync_status, "failed");
  assert.equal(db.rows.get("contact-1").retry_count, 1);
  assert.deepEqual(msg.retryCalls, []);
  assert.equal(msg.ackCount, 1);
});

test("10 - sexto fallo transitorio no reintenta Queue", async () => {
  const db = new FakeD1([contact({ retry_count: 5 })]);
  const msg = message();
  await captureLogs(() => withFetch(
    async () => notionResponse(503, "{}"),
    () => worker.queue({ messages: [msg] }, environment(db)),
  ));
  const row = db.rows.get("contact-1");
  assert.equal(row.retry_count, MAX_REINTENTOS);
  assert.equal(row.sync_status, "failed");
  assert.equal(row.sync_started_at, null);
  assert.deepEqual(msg.retryCalls, []);
  assert.equal(msg.ackCount, 1);
});

test("11 - 2xx con body no JSON es fallo operacional sin retry", async () => {
  const db = new FakeD1([contact()]);
  const msg = message();
  let calls = 0;
  await captureLogs(() => withFetch(async () => {
    calls += 1;
    return notionResponse(200, "not-json");
  }, () => worker.queue({ messages: [msg] }, environment(db))));
  assert.equal(calls, 1);
  assert.equal(db.rows.get("contact-1").sync_status, "failed");
  assert.match(db.rows.get("contact-1").last_error, /ambiguous_success_invalid_json/);
  assert.deepEqual(msg.retryCalls, []);
  assert.equal(msg.ackCount, 1);
});

test("12 - 2xx sin ID es fallo operacional sin retry", async () => {
  const db = new FakeD1([contact()]);
  const msg = message();
  let calls = 0;
  await captureLogs(() => withFetch(async () => {
    calls += 1;
    return notionResponse(200, JSON.stringify({ object: "page" }));
  }, () => worker.queue({ messages: [msg] }, environment(db))));
  assert.equal(calls, 1);
  assert.equal(db.rows.get("contact-1").sync_status, "failed");
  assert.match(db.rows.get("contact-1").last_error, /ambiguous_success_missing_id/);
  assert.deepEqual(msg.retryCalls, []);
});

test("13 - scheduled reencola syncing stale", async () => {
  const db = new FakeD1([contact({
    sync_status: "syncing",
    sync_started_at: "2026-09-06 11:39:59",
  })]);
  const queue = new FakeQueue();
  await worker.scheduled({}, environment(db, { CONTACT_QUEUE: queue }), {});
  assert.deepEqual(queue.calls, [{ id: "contact-1" }]);
});

test("14 - scheduled no reencola syncing reciente", async () => {
  const db = new FakeD1([contact({
    sync_status: "syncing",
    sync_started_at: "2026-09-06 11:40:01",
  })]);
  const queue = new FakeQueue();
  await worker.scheduled({}, environment(db, { CONTACT_QUEUE: queue }), {});
  assert.deepEqual(queue.calls, []);
});

test("15 - scheduled reencola pending antiguo", async () => {
  const db = new FakeD1([contact({ created_at: "2026-09-06 11:49:59" })]);
  const queue = new FakeQueue();
  await worker.scheduled({}, environment(db, { CONTACT_QUEUE: queue }), {});
  assert.deepEqual(queue.calls, [{ id: "contact-1" }]);
});

test("16 - scheduled no reencola failed", async () => {
  const db = new FakeD1([contact({ sync_status: "failed" })]);
  const queue = new FakeQueue();
  await worker.scheduled({}, environment(db, { CONTACT_QUEUE: queue, EMAIL: undefined }), {});
  assert.deepEqual(queue.calls, []);
});

test("17 - fallo de un reencolado no aborta las filas restantes", async () => {
  const db = new FakeD1([
    contact({ id: "contact-1" }),
    contact({ id: "contact-2" }),
    contact({ id: "contact-3" }),
  ]);
  const queue = new FakeQueue({ failCalls: [2] });
  await captureLogs(() => worker.scheduled({}, environment(db, { CONTACT_QUEUE: queue }), {}));
  assert.deepEqual(queue.calls, [
    { id: "contact-1" },
    { id: "contact-2" },
    { id: "contact-3" },
  ]);
});

test("18 - alerta email exitosa marca alerted", async () => {
  const db = new FakeD1([contact({ sync_status: "failed", retry_count: 6 })]);
  const email = new FakeEmail();
  await worker.scheduled({}, environment(db, { EMAIL: email }), {});
  assert.equal(email.calls.length, 1);
  assert.equal(db.rows.get("contact-1").alerted, 1);
});

test("19 - alerta email fallida conserva alerted=0", async () => {
  const db = new FakeD1([contact({ sync_status: "failed", retry_count: 6 })]);
  const email = new FakeEmail({ fail: true });
  await captureLogs(() => worker.scheduled({}, environment(db, { EMAIL: email }), {}));
  assert.equal(email.calls.length, 1);
  assert.equal(db.rows.get("contact-1").alerted, 0);
});

test("20 - fallo definitivo temprano también es elegible para alerta", async () => {
  const db = new FakeD1([contact({ sync_status: "failed", retry_count: 1 })]);
  const email = new FakeEmail();
  await worker.scheduled({}, environment(db, { EMAIL: email }), {});
  assert.equal(email.calls.length, 1);
  assert.equal(db.rows.get("contact-1").alerted, 1);
  assert.doesNotMatch(db.lastAlertSql, /retry_count/);
});

test("21 - logs técnicos no contienen PII sintética", async () => {
  const row = contact();
  const db = new FakeD1([row]);
  const msg = message();
  const remoteMessage = [row.nombre, row.empresa, row.email, row.telefono, row.mensaje, row.presupuesto].join(" | ");
  const logs = await captureLogs(() => withFetch(
    async () => notionResponse(400, JSON.stringify({ code: "validation_error", message: remoteMessage })),
    () => worker.queue({ messages: [msg] }, environment(db)),
  ));
  const serializedLogs = JSON.stringify(logs);
  const diagnostic = db.rows.get("contact-1").last_error;
  for (const value of [row.nombre, row.empresa, row.email, row.telefono, row.mensaje, row.presupuesto]) {
    assert.equal(serializedLogs.includes(value), false);
    assert.equal(diagnostic.includes(value), false);
  }
});

test("22 - gap Notion→D1 permanece explícitamente abierto", async () => {
  const db = new FakeD1([contact()]);
  db.failSuccessWrite = true;
  const env = environment(db);
  const firstMessage = message();
  let notionCalls = 0;

  await captureLogs(() => withFetch(async () => {
    notionCalls += 1;
    return notionResponse(200, JSON.stringify({ id: PAGE_ID_1 }));
  }, () => worker.queue({ messages: [firstMessage] }, env)));

  assert.equal(notionCalls, 1);
  assert.equal(db.rows.get("contact-1").sync_status, "syncing");
  assert.deepEqual(firstMessage.retryCalls, [{ delaySeconds: 60 }]);

  // F2.3 no puede probar qué página creó Notion. Una futura recuperación stale
  // puede volver a hacer POST: este test demuestra el gap, no lo disimula.
  db.failSuccessWrite = false;
  db.rows.get("contact-1").sync_started_at = "2026-09-06 11:39:59";
  const secondMessage = message();
  await withFetch(async () => {
    notionCalls += 1;
    return notionResponse(200, JSON.stringify({ id: PAGE_ID_2 }));
  }, () => worker.queue({ messages: [secondMessage] }, env));

  assert.equal(notionCalls, 2);
  assert.equal(db.rows.get("contact-1").notion_page_id, PAGE_ID_2);
  assert.equal(secondMessage.ackCount, 1);
});

test("23 - backoff determinista exacto", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5].map(calculateBackoffSeconds),
    [60, 120, 240, 480, 900],
  );
});

test("24 - Retry-After valida y clampa", () => {
  assert.equal(parseRetryAfterSeconds("0"), null);
  assert.equal(parseRetryAfterSeconds("invalid"), null);
  assert.equal(parseRetryAfterSeconds("1"), 1);
  assert.equal(parseRetryAfterSeconds("7200"), 3600);
});

test("25 - migración local añade solo sync_started_at TEXT", async () => {
  const migration = await readFile(path.join(TEST_DIR, "../../../migrations/0002_add_sync_started_at.sql"), "utf8");
  assert.equal(migration.trim(), "ALTER TABLE contacts ADD COLUMN sync_started_at TEXT;");
  assert.equal((migration.match(/ADD\s+COLUMN/gi) || []).length, 1);
  assert.doesNotMatch(migration, /\b(?:INSERT|UPDATE|DELETE)\b/i);
});

test("26 - baseline F2.2 conserva su SHA-256 exacto", async () => {
  const baseline = await readFile(path.join(TEST_DIR, "../baseline/src/index.js"));
  const hash = createHash("sha256").update(baseline).digest("hex");
  assert.equal(hash, "f899e72d438bc63a871d6480349bba6f7fd618f8e2d68bba8902d22063f80b7c");
});
