import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { onRequestPost } from "../functions/api/contact.js";

const originalFetch = globalThis.fetch;
const DEFAULT_ID = "11111111-1111-4111-8111-111111111111";
const DEFAULT_REQUEST_URL = "https://solazstudio.cl/api/contact";
const ATTRIBUTION_TIMESTAMP = "2026-10-09T12:00:00.000Z";

function validAttribution() {
  return {
    first_touch: {
      captured_at: ATTRIBUTION_TIMESTAMP,
      utm_source: "Google Ads",
      utm_campaign: "Campaña Otoño_2026./cl"
    },
    last_non_direct: {
      captured_at: ATTRIBUTION_TIMESTAMP,
      gclid: "AbC_123-xy"
    },
    current_touch: {
      captured_at: ATTRIBUTION_TIMESTAMP,
      utm_medium: "cpc"
    }
  };
}

function createForm(overrides = {}) {
  const values = {
    form_type: "mensaje",
    nombre: "Prueba técnica",
    email: "qa@example.test",
    mensaje: "Validación local sin red real",
    service_code: "fotografia_comercial",
    submission_id: DEFAULT_ID,
    "cf-turnstile-response": "token-sintetico",
    ...overrides
  };
  const days = values["dias[]"];
  delete values["dias[]"];
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined) form.set(key, String(value));
  }
  for (const day of days ?? []) form.append("dias[]", day);
  return form;
}

async function invoke({
  origin = "https://solazstudio.cl",
  requestUrl = DEFAULT_REQUEST_URL,
  form = {},
  siteverify,
  turnstileSecret = "secret-sintetico",
  d1Changes = 1,
  queueError = null
} = {}) {
  const expectedHostname = new URL(origin || requestUrl).hostname;
  const fetchCalls = [];
  const db = { prepares: 0, runs: 0, sql: null, bindings: null };
  const queue = { sends: 0, messages: [] };

  globalThis.fetch = async (url, init) => {
    fetchCalls.push({ url: String(url), init });
    return new Response(JSON.stringify(siteverify ?? {
      success: true,
      hostname: expectedHostname
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const env = {
      TURNSTILE_SECRET_KEY: turnstileSecret,
    DB: {
      prepare(sql) {
        db.prepares += 1;
        db.sql = sql;
        return {
          bind(...bindings) {
            db.bindings = bindings;
            return {
              async run() {
                db.runs += 1;
                return { meta: { changes: d1Changes } };
              }
            };
          }
        };
      }
    },
    CONTACT_QUEUE: {
      async send(message) {
        queue.sends += 1;
        queue.messages.push(message);
        if (queueError) throw queueError;
      }
    }
  };

  const request = new Request(requestUrl, {
    method: "POST",
    headers: origin ? { Origin: origin } : {},
    body: createForm(form)
  });
  const response = await onRequestPost({ request, env });
  return { status: response.status, body: await response.json(), fetchCalls, db, queue };
}

function assertRejectedBeforePersistence(result, status, error, fetchCount) {
  assert.equal(result.status, status);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.error, error);
  assert.equal(result.fetchCalls.length, fetchCount);
  assert.equal(result.db.runs, 0);
  assert.equal(result.queue.sends, 0);
}

test("01 Production bare matching accepted", async () => {
  const result = await invoke();
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.fetchCalls.length, 1);
  assert.equal(result.db.runs, 1);
  assert.equal(result.queue.sends, 1);
});

test("02 Production www matching accepted", async () => {
  const result = await invoke({ origin: "https://www.solazstudio.cl", requestUrl: "https://www.solazstudio.cl/api/contact" });
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.fetchCalls.length, 1);
  assert.equal(result.db.runs, 1);
  assert.equal(result.queue.sends, 1);
});

test("03 legitimate Preview same-origin accepted", async () => {
  const preview = "https://f42a.solazstudio-web.pages.dev";
  const result = await invoke({ origin: preview, requestUrl: `${preview}/api/contact` });
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.fetchCalls.length, 1);
  assert.equal(result.db.runs, 1);
  assert.equal(result.queue.sends, 1);
});

test("03a official dummy hostname accepted in Preview", async () => {
  const preview = "https://f42a.solazstudio-web.pages.dev";
  const result = await invoke({
    origin: preview,
    requestUrl: `${preview}/api/contact`,
    turnstileSecret: "1x0000000000000000000000000000000AA",
    siteverify: { success: true, hostname: "localhost" }
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.db.runs, 1);
  assert.equal(result.queue.sends, 1);
});

test("03b dummy hostname rejected without test secret", async () => {
  const preview = "https://f42a.solazstudio-web.pages.dev";
  const result = await invoke({
    origin: preview,
    requestUrl: `${preview}/api/contact`,
    siteverify: { success: true, hostname: "localhost" }
  });
  assertRejectedBeforePersistence(result, 400, "verificacion_fallida", 1);
});

test("03c dummy hostname rejected in Production", async () => {
  const result = await invoke({
    turnstileSecret: "1x0000000000000000000000000000000AA",
    siteverify: { success: true, hostname: "localhost" }
  });
  assertRejectedBeforePersistence(result, 400, "verificacion_fallida", 1);
});

test("04 Preview A request against Preview B rejected", async () => {
  const result = await invoke({ origin: "https://preview-a.solazstudio-web.pages.dev", requestUrl: "https://preview-b.solazstudio-web.pages.dev/api/contact" });
  assertRejectedBeforePersistence(result, 403, "origen_no_permitido", 0);
});

test("05 external Origin rejected without Siteverify", async () => {
  const result = await invoke({ origin: "https://example.test" });
  assertRejectedBeforePersistence(result, 403, "origen_no_permitido", 0);
});

test("06 Siteverify success false rejected", async () => {
  const result = await invoke({ siteverify: { success: false, hostname: "solazstudio.cl" } });
  assertRejectedBeforePersistence(result, 400, "verificacion_fallida", 1);
});

test("07 Siteverify missing hostname rejected", async () => {
  const result = await invoke({ siteverify: { success: true } });
  assertRejectedBeforePersistence(result, 400, "verificacion_fallida", 1);
});

test("08 Siteverify different hostname rejected", async () => {
  const result = await invoke({ siteverify: { success: true, hostname: "other.example" } });
  assertRejectedBeforePersistence(result, 400, "verificacion_fallida", 1);
});

test("09 Siteverify malformed hostname rejected", async () => {
  const result = await invoke({ siteverify: { success: true, hostname: "solazstudio.cl/path" } });
  assertRejectedBeforePersistence(result, 400, "verificacion_fallida", 1);
});

test("10 missing Origin validates against request URL hostname", async () => {
  const requestUrl = "https://no-origin.solazstudio-web.pages.dev/api/contact";
  const result = await invoke({ origin: null, requestUrl });
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.fetchCalls.length, 1);
  assert.equal(result.db.runs, 1);
  assert.equal(result.queue.sends, 1);
});

test("11 honeypot returns neutral success without side effects", async () => {
  const result = await invoke({ form: { botcheck: "robot" } });
  assert.deepEqual(result.body, { ok: true });
  assert.equal(result.fetchCalls.length, 0);
  assert.equal(result.db.runs, 0);
  assert.equal(result.queue.sends, 0);
});

test("12 missing nombre rejected before persistence", async () => {
  const result = await invoke({ form: { nombre: null } });
  assertRejectedBeforePersistence(result, 400, "faltan_campos_obligatorios", 0);
});

test("13 invalid email rejected before persistence", async () => {
  const result = await invoke({ form: { email: "correo-invalido" } });
  assertRejectedBeforePersistence(result, 400, "email_invalido", 0);
});

test("14 nonexistent service code rejected before persistence", async () => {
  const result = await invoke({ form: { service_code: "servicio_inexistente" } });
  assertRejectedBeforePersistence(result, 400, "servicio_invalido", 0);
});

test("15 invalid submission id rejected before persistence", async () => {
  const result = await invoke({ form: { submission_id: "not-a-uuid" } });
  assertRejectedBeforePersistence(result, 400, "submission_id_invalido", 0);
});

test("16 message flow requires mensaje", async () => {
  const result = await invoke({ form: { mensaje: null } });
  assertRejectedBeforePersistence(result, 400, "faltan_campos_obligatorios", 0);
});

test("17 meeting flow requires days", async () => {
  const result = await invoke({ form: { form_type: "reunion", mensaje: null, horario: "Mañana" } });
  assertRejectedBeforePersistence(result, 400, "faltan_campos_obligatorios", 0);
});

test("18 meeting flow requires horario", async () => {
  const result = await invoke({ form: { form_type: "reunion", mensaje: null, "dias[]": ["Lunes"] } });
  assertRejectedBeforePersistence(result, 400, "faltan_campos_obligatorios", 0);
});

test("19 external and malformed source_page values rejected", async () => {
  for (const sourcePage of ["https://example.test/path", "/contacto?campaign=x"]) {
    const result = await invoke({ form: { source_page: sourcePage } });
    assertRejectedBeforePersistence(result, 400, "source_page_invalido", 0);
  }
});

test("20 malformed case_id rejected", async () => {
  const result = await invoke({ form: { case_id: "caso con espacios" } });
  assertRejectedBeforePersistence(result, 400, "case_id_invalido", 0);
});

test("21 malformed cta_id rejected", async () => {
  const result = await invoke({ form: { cta_id: "cta?invalido" } });
  assertRejectedBeforePersistence(result, 400, "cta_id_invalido", 0);
});

test("22 valid new message persists once and enqueues once", async () => {
  const result = await invoke({ form: { empresa: "Empresa QA", telefono: "+56 9 0000 0000", presupuesto: "A definir", source_page: "/fotografia-comercial", case_id: "caso/qa-1", cta_id: "service_primary" } });
  assert.deepEqual(result.body, { ok: true, id: DEFAULT_ID, deduplicated: false });
  assert.equal(result.fetchCalls.length, 1);
  assert.equal(result.fetchCalls[0].url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
  assert.equal(result.db.prepares, 1);
  assert.equal(result.db.runs, 1);
  assert.match(result.db.sql, /INSERT INTO contacts/);
  assert.deepEqual(result.queue.messages, [{ id: DEFAULT_ID }]);
  assert.equal(result.db.bindings[1], "mensaje");
  assert.equal(result.db.bindings[11], "https://solazstudio.cl/fotografia-comercial");
  assert.equal(result.db.bindings[12], "fotografia_comercial");
  assert.equal(result.db.bindings[13], "/fotografia-comercial");
  assert.equal(result.db.bindings[14], "caso/qa-1");
  assert.equal(result.db.bindings[15], "service_primary");
  assert.equal(result.db.bindings[16], null);
});

test("23 valid new meeting persists days and time and enqueues once", async () => {
  const result = await invoke({ form: { form_type: "reunion", mensaje: null, "dias[]": ["Lunes", "Miércoles"], horario: "Mañana" } });
  assert.equal(result.body.ok, true);
  assert.equal(result.body.deduplicated, false);
  assert.equal(result.fetchCalls.length, 1);
  assert.equal(result.db.runs, 1);
  assert.equal(result.queue.sends, 1);
  assert.equal(result.db.bindings[1], "reunion");
  assert.equal(result.db.bindings[6], "Solicitud de reunión. Días: Lunes, Miércoles. Horario: Mañana.");
  assert.equal(result.db.bindings[9], "Lunes, Miércoles");
  assert.equal(result.db.bindings[10], "Mañana");
});

test("24 zero-row D1 insertion is deduplicated and not enqueued", async () => {
  const result = await invoke({ d1Changes: 0 });
  assert.deepEqual(result.body, { ok: true, id: DEFAULT_ID, deduplicated: true });
  assert.equal(result.fetchCalls.length, 1);
  assert.equal(result.db.runs, 1);
  assert.equal(result.queue.sends, 0);
});

test("25 Queue failure after insert preserves D1 success", async () => {
  const result = await invoke({ queueError: new Error("synthetic queue failure") });
  assert.deepEqual(result.body, { ok: true, id: DEFAULT_ID, deduplicated: false });
  assert.equal(result.db.runs, 1);
  assert.equal(result.queue.sends, 1);
});

test("26 unknown field is ignored without changing persistence contract", async () => {
  const marker = "must-not-be-persisted";
  const result = await invoke({ form: { shadow_column: marker } });
  assert.equal(result.status, 200);
  assert.equal(result.db.runs, 1);
  assert.equal(result.queue.sends, 1);
  assert.doesNotMatch(result.db.sql, /shadow_column/);
  assert.equal(result.db.bindings.includes(marker), false);
  assert.equal(result.db.bindings.length, 18);
});

test("27 absent marketing consent keeps current zero representation", async () => {
  const result = await invoke();
  assert.equal(result.status, 200);
  assert.equal(result.db.bindings[8], 0);
});

test("28 consent_marketing si keeps current one representation", async () => {
  const result = await invoke({ form: { consent_marketing: "si" } });
  assert.equal(result.status, 200);
  assert.equal(result.db.bindings[8], 1);
});

test("29 valid attribution is normalized and persisted as JSON", async () => {
  const attribution = validAttribution();
  const result = await invoke({ form: { attribution_context: JSON.stringify(attribution) } });
  assert.equal(result.status, 200);
  assert.deepEqual(JSON.parse(result.db.bindings[16]), attribution);
  assert.equal(result.queue.sends, 1);
});

test("30 absent attribution persists NULL", async () => {
  const result = await invoke();
  assert.equal(result.status, 200);
  assert.equal(result.db.bindings[16], null);
});

test("31 malformed attribution is discarded without rejecting a valid contact", async () => {
  const invalidCases = [
    "{invalid-json",
    JSON.stringify({ ...validAttribution(), visitor_id: "forbidden" }),
    JSON.stringify({ ...validAttribution(), first_touch: { ...validAttribution().first_touch, email: "persona@example.com" } }),
    JSON.stringify({ ...validAttribution(), first_touch: { captured_at: "not-an-iso", utm_source: "google" } }),
    JSON.stringify({ ...validAttribution(), first_touch: { captured_at: ATTRIBUTION_TIMESTAMP, utm_source: "persona@example.com" } }),
    JSON.stringify({ ...validAttribution(), first_touch: { captured_at: ATTRIBUTION_TIMESTAMP, utm_source: "https://example.com" } }),
    JSON.stringify({ ...validAttribution(), first_touch: { captured_at: ATTRIBUTION_TIMESTAMP, utm_source: "línea\nnueva" } }),
    JSON.stringify({ ...validAttribution(), first_touch: { captured_at: ATTRIBUTION_TIMESTAMP, utm_source: "Contacto 56912345678" } }),
    JSON.stringify({ ...validAttribution(), first_touch: { captured_at: ATTRIBUTION_TIMESTAMP, utm_source: "a".repeat(129) } }),
    JSON.stringify({ ...validAttribution(), last_non_direct: { captured_at: ATTRIBUTION_TIMESTAMP, gclid: "abc.def" } }),
    JSON.stringify({ ...validAttribution(), current_touch: { ...validAttribution().current_touch, arbitrary: "value" } }),
    JSON.stringify({ ...validAttribution(), first_touch: { captured_at: ATTRIBUTION_TIMESTAMP, utm_source: "a".repeat(4200) } })
  ];

  for (const attribution_context of invalidCases) {
    const result = await invoke({ form: { attribution_context } });
    assert.equal(result.status, 200);
    assert.equal(result.body.ok, true);
    assert.equal(result.db.bindings[16], null);
    assert.equal(result.queue.sends, 1);
  }
});

test("32 valid attribution keeps duplicate and Queue contracts intact", async () => {
  const attribution_context = JSON.stringify(validAttribution());
  const duplicate = await invoke({ form: { attribution_context }, d1Changes: 0 });
  assert.deepEqual(duplicate.body, { ok: true, id: DEFAULT_ID, deduplicated: true });
  assert.deepEqual(JSON.parse(duplicate.db.bindings[16]), validAttribution());
  assert.equal(duplicate.queue.sends, 0);

  const queueFailure = await invoke({
    form: { attribution_context },
    queueError: new Error("synthetic queue failure")
  });
  assert.deepEqual(queueFailure.body, { ok: true, id: DEFAULT_ID, deduplicated: false });
  assert.equal(queueFailure.db.runs, 1);
  assert.equal(queueFailure.queue.sends, 1);
});

test("33 migration 0004 adds only the nullable attribution_context column", () => {
  const migration = readFileSync(new URL("../migrations/0004_add_contact_attribution.sql", import.meta.url), "utf8");
  assert.match(migration, /ALTER TABLE contacts ADD COLUMN attribution_context TEXT;/);
  assert.equal((migration.match(/ALTER TABLE/gi) || []).length, 1);
  assert.doesNotMatch(migration, /CREATE\s+TABLE|NOT\s+NULL/i);
});

test.after(() => {
  globalThis.fetch = originalFetch;
});
