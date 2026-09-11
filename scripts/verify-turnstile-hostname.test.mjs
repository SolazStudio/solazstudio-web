import assert from "node:assert/strict";
import test from "node:test";

import { onRequestPost } from "../functions/api/contact.js";

const originalFetch = globalThis.fetch;

function validForm() {
  const form = new FormData();
  form.set("form_type", "mensaje");
  form.set("nombre", "Prueba técnica");
  form.set("email", "qa@example.test");
  form.set("mensaje", "Validación local sin red real");
  form.set("service_code", "fotografia_comercial");
  form.set("submission_id", "11111111-1111-4111-8111-111111111111");
  form.set("cf-turnstile-response", "token-sintetico");
  return form;
}

async function runCase({ origin, requestUrl, siteverify }) {
  let fetchCalls = 0;
  let databaseRuns = 0;
  let queueSends = 0;

  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify(siteverify), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  const statement = {
    bind() {
      return this;
    },
    async run() {
      databaseRuns += 1;
      return { meta: { changes: 1 } };
    }
  };
  const env = {
    TURNSTILE_SECRET_KEY: "secret-sintetico",
    DB: { prepare: () => statement },
    CONTACT_QUEUE: {
      async send() {
        queueSends += 1;
      }
    }
  };
  const headers = origin ? { Origin: origin } : {};
  const request = new Request(requestUrl, {
    method: "POST",
    headers,
    body: validForm()
  });
  const response = await onRequestPost({ request, env });
  return {
    status: response.status,
    body: await response.json(),
    fetchCalls,
    databaseRuns,
    queueSends
  };
}

test("Turnstile exige hostname del origen autorizado sin red real", async t => {
  const accepted = [
    {
      name: "1. Production bare matching accepted",
      origin: "https://solazstudio.cl",
      requestUrl: "https://solazstudio.cl/api/contact",
      siteverify: { success: true, hostname: "solazstudio.cl" }
    },
    {
      name: "2. Production www matching accepted",
      origin: "https://www.solazstudio.cl",
      requestUrl: "https://www.solazstudio.cl/api/contact",
      siteverify: { success: true, hostname: "www.solazstudio.cl" }
    },
    {
      name: "3. Same legitimate Preview matching accepted",
      origin: "https://f41.solazstudio-web.pages.dev",
      requestUrl: "https://f41.solazstudio-web.pages.dev/api/contact",
      siteverify: { success: true, hostname: "f41.solazstudio-web.pages.dev" }
    }
  ];

  for (const scenario of accepted) {
    await t.test(scenario.name, async () => {
      const result = await runCase(scenario);
      assert.equal(result.status, 200);
      assert.equal(result.body.ok, true);
      assert.equal(result.fetchCalls, 1);
      assert.equal(result.databaseRuns, 1);
      assert.equal(result.queueSends, 1);
    });
  }

  const rejected = [
    {
      name: "4. Authorized origin with different hostname rejected",
      origin: "https://solazstudio.cl",
      requestUrl: "https://solazstudio.cl/api/contact",
      siteverify: { success: true, hostname: "other.example" },
      expectedStatus: 400,
      expectedError: "verificacion_fallida",
      expectedFetchCalls: 1
    },
    {
      name: "5. success false with correct hostname rejected",
      origin: "https://solazstudio.cl",
      requestUrl: "https://solazstudio.cl/api/contact",
      siteverify: { success: false, hostname: "solazstudio.cl" },
      expectedStatus: 400,
      expectedError: "verificacion_fallida",
      expectedFetchCalls: 1
    },
    {
      name: "6. success true with missing hostname rejected",
      origin: "https://solazstudio.cl",
      requestUrl: "https://solazstudio.cl/api/contact",
      siteverify: { success: true },
      expectedStatus: 400,
      expectedError: "verificacion_fallida",
      expectedFetchCalls: 1
    },
    {
      name: "7. Unauthorized origin remains rejected",
      origin: "https://example.test",
      requestUrl: "https://solazstudio.cl/api/contact",
      siteverify: { success: true, hostname: "example.test" },
      expectedStatus: 403,
      expectedError: "origen_no_permitido",
      expectedFetchCalls: 0
    },
    {
      name: "8. Malformed hostname rejected",
      origin: "https://solazstudio.cl",
      requestUrl: "https://solazstudio.cl/api/contact",
      siteverify: { success: true, hostname: "solazstudio.cl/path" },
      expectedStatus: 400,
      expectedError: "verificacion_fallida",
      expectedFetchCalls: 1
    }
  ];

  for (const scenario of rejected) {
    await t.test(scenario.name, async () => {
      const result = await runCase(scenario);
      assert.equal(result.status, scenario.expectedStatus);
      assert.equal(result.body.error, scenario.expectedError);
      assert.equal(result.fetchCalls, scenario.expectedFetchCalls);
      assert.equal(result.databaseRuns, 0);
      assert.equal(result.queueSends, 0);
    });
  }
});

test.after(() => {
  globalThis.fetch = originalFetch;
});
