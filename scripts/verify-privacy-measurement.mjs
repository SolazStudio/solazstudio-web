import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

import { EXPECTED_HTML_FILES } from "../config/public-surface.js";

const projectRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));
const partialPath = join(projectRoot, "src/_includes/partials/privacy-preferences.njk");
const partial = readFileSync(partialPath, "utf8");
const runtimeMatch = partial.match(/<script\b[^>]*data-solaz-privacy-runtime[^>]*>([\s\S]*?)<\/script>/i);
assert.ok(runtimeMatch, "Falta el runtime controlado de preferencias");
const runtime = runtimeMatch[1];
const STORAGE_KEY = "solaz_privacy_preferences";

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

class FakeElement {
  constructor() {
    this.dataset = {};
    this.hidden = true;
    this.attributes = new Map();
    this.listeners = new Map();
    this.focused = false;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type) {
    for (const listener of this.listeners.get(type) || []) listener({ target: this });
  }

  click() {
    this.dispatch("click");
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  focus() {
    this.focused = true;
  }
}

function savedPreference(decision, version = 1) {
  return JSON.stringify({ version, decision, updatedAt: "2026-09-11T12:00:00.000Z" });
}

function runRuntime({
  hostname = "preview.solazstudio-web.pages.dev",
  pathname = "/contacto",
  stored = null,
  storageThrows = false,
  enabled = false,
  gaId = "",
  adsId = ""
} = {}) {
  const root = new FakeElement();
  const accept = new FakeElement();
  const reject = new FakeElement();
  const title = new FakeElement();
  const opener = new FakeElement();
  root.dataset = {
    measurementEnabled: String(enabled),
    gaMeasurementId: gaId,
    googleAdsId: adsId
  };
  root.querySelector = (selector) => ({
    '[data-privacy-action="accept"]': accept,
    '[data-privacy-action="reject"]': reject,
    "#privacy-preferences-title": title
  })[selector] || null;

  const values = new Map();
  if (stored !== null) values.set(STORAGE_KEY, stored);
  const localStorage = {
    getItem(key) {
      if (storageThrows) throw new Error("storage unavailable");
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (storageThrows) throw new Error("storage unavailable");
      values.set(key, value);
    }
  };

  const documentListeners = new Map();
  const appendedScripts = [];
  const document = {
    head: {
      appendChild(element) {
        appendedScripts.push(element);
      }
    },
    querySelector(selector) {
      return selector === "[data-solaz-privacy-preferences]" ? root : null;
    },
    querySelectorAll(selector) {
      return selector === "[data-open-privacy-preferences]" ? [opener] : [];
    },
    createElement(tagName) {
      const element = new FakeElement();
      element.tagName = tagName.toUpperCase();
      return element;
    },
    addEventListener(type, listener) {
      const listeners = documentListeners.get(type) || [];
      listeners.push(listener);
      documentListeners.set(type, listeners);
    }
  };
  const href = `https://${hostname}${pathname}`;
  const window = {
    location: { hostname, pathname, href },
    localStorage,
    dataLayer: []
  };

  vm.runInNewContext(runtime, {
    window,
    document,
    URL,
    Date,
    Set,
    Object,
    JSON,
    String,
    Boolean,
    encodeURIComponent
  }, { filename: partialPath });

  function clickLink(linkHref) {
    const anchor = {
      getAttribute(name) {
        return name === "href" ? linkHref : null;
      }
    };
    const event = { target: { closest: () => anchor } };
    for (const listener of documentListeners.get("click") || []) listener(event);
  }

  return { root, accept, reject, title, opener, values, window, appendedScripts, clickLink };
}

function dataLayerCalls(result) {
  return result.window.dataLayer.map((entry) => plain(Array.from(entry)));
}

function lastConsent(result, command) {
  return dataLayerCalls(result).filter((entry) => entry[0] === "consent" && entry[1] === command).at(-1)?.[2];
}

test("01: las 24 salidas HTML incluyen una sola UI, runtime y apertura de footer", () => {
  assert.equal(EXPECTED_HTML_FILES.length, 24);
  for (const file of EXPECTED_HTML_FILES) {
    const html = readFileSync(join(projectRoot, "_site", file), "utf8");
    assert.equal((html.match(/data-solaz-privacy-preferences(?:\s|>)/g) || []).length, 1, file);
    assert.equal((html.match(/data-solaz-privacy-runtime(?:\s|>)/g) || []).length, 1, file);
    assert.equal((html.match(/data-open-privacy-preferences(?:\s|>)/g) || []).length, 1, file);
  }
});

test("02: la primera visita parte con los cuatro consentimientos denegados", () => {
  const result = runRuntime();
  assert.deepEqual(lastConsent(result, "default"), {
    analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied"
  });
});

test("03: la primera visita muestra las preferencias", () => {
  assert.equal(runRuntime().root.hidden, false);
});

test("04: rechazar persiste una decisión versionada con fecha", () => {
  const result = runRuntime();
  result.reject.click();
  const saved = JSON.parse(result.values.get(STORAGE_KEY));
  assert.equal(saved.version, 1);
  assert.equal(saved.decision, "rejected");
  assert.match(saved.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("05: rechazar mantiene los cuatro estados denegados", () => {
  const result = runRuntime();
  result.reject.click();
  assert.deepEqual(lastConsent(result, "update"), {
    analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied"
  });
});

test("06: aceptar concede tres señales y conserva personalización denegada", () => {
  const result = runRuntime();
  result.accept.click();
  assert.deepEqual(lastConsent(result, "update"), {
    analytics_storage: "granted", ad_storage: "granted", ad_user_data: "granted", ad_personalization: "denied"
  });
});

test("07: una preferencia aceptada válida se restaura sin mostrar el panel", () => {
  const result = runRuntime({ stored: savedPreference("accepted") });
  assert.equal(result.root.hidden, true);
  assert.equal(result.window.solazMeasurement.getConsentState().decision, "accepted");
});

test("08: una preferencia rechazada válida se restaura sin mostrar el panel", () => {
  const result = runRuntime({ stored: savedPreference("rejected") });
  assert.equal(result.root.hidden, true);
  assert.equal(result.window.solazMeasurement.getConsentState().decision, "rejected");
});

test("09: una preferencia corrupta vuelve al estado seguro inicial", () => {
  const result = runRuntime({ stored: "{corrupt" });
  assert.equal(result.root.hidden, false);
  assert.equal(result.window.solazMeasurement.getConsentState().decision, null);
});

test("10: una versión antigua vuelve al estado seguro inicial", () => {
  const result = runRuntime({ stored: savedPreference("accepted", 0) });
  assert.equal(result.root.hidden, false);
  assert.equal(result.window.solazMeasurement.getConsentState().decision, null);
});

test("11: localStorage no disponible no rompe el control", () => {
  const result = runRuntime({ storageThrows: true });
  result.accept.click();
  assert.equal(result.window.solazMeasurement.getConsentState().decision, "accepted");
  assert.equal(result.root.hidden, true);
});

test("12: Preview jamás intenta cargar Google aunque haya consentimiento e IDs", () => {
  const result = runRuntime({ stored: savedPreference("accepted"), enabled: true, gaId: "G-TEST123", adsId: "AW-123456" });
  assert.equal(result.appendedScripts.length, 0);
  assert.equal(result.window.__solazMeasurementDebug.tagLoadAttempted, false);
});

test("13: localhost jamás intenta cargar Google", () => {
  const result = runRuntime({ hostname: "localhost", stored: savedPreference("accepted"), enabled: true, gaId: "G-TEST123" });
  assert.equal(result.appendedScripts.length, 0);
});

test("14: un hostname arbitrario jamás intenta cargar Google", () => {
  const result = runRuntime({ hostname: "example.com", stored: savedPreference("accepted"), enabled: true, gaId: "G-TEST123" });
  assert.equal(result.appendedScripts.length, 0);
});

test("15: Production aceptado y configurado carga gtag.js una sola vez", () => {
  const result = runRuntime({ hostname: "solazstudio.cl", stored: savedPreference("accepted"), enabled: true, gaId: "G-TEST123" });
  result.window.solazMeasurement.openPreferences();
  result.accept.click();
  assert.equal(result.appendedScripts.length, 1);
  assert.equal(result.appendedScripts[0].src, "https://www.googletagmanager.com/gtag/js?id=G-TEST123");
});

test("16: www Production también está permitido bajo las mismas compuertas", () => {
  const result = runRuntime({ hostname: "www.solazstudio.cl", stored: savedPreference("accepted"), enabled: true, gaId: "G-TEST123" });
  assert.equal(result.appendedScripts.length, 1);
});

test("17: Production rechazado no carga Google", () => {
  const result = runRuntime({ hostname: "solazstudio.cl", stored: savedPreference("rejected"), enabled: true, gaId: "G-TEST123" });
  assert.equal(result.appendedScripts.length, 0);
});

test("18: ningún comando concede ad_personalization", () => {
  const result = runRuntime({ hostname: "solazstudio.cl", stored: savedPreference("accepted"), enabled: true, gaId: "G-TEST123" });
  for (const call of dataLayerCalls(result).filter((entry) => entry[0] === "consent")) {
    assert.notEqual(call[2].ad_personalization, "granted");
  }
});

test("19: generate_lead exige respuesta ok y deduplicated estrictamente false", () => {
  const result = runRuntime();
  result.window.solazMeasurement.trackLead({ ok: true, deduplicated: false }, { lead_type: "mensaje" });
  assert.equal(result.window.__solazMeasurementDebug.eventsEmitted.at(-1).name, "generate_lead");
});

test("20: un lead duplicado no genera evento", () => {
  const result = runRuntime();
  result.window.solazMeasurement.trackLead({ ok: true, deduplicated: true }, { lead_type: "mensaje" });
  assert.equal(result.window.__solazMeasurementDebug.eventsEmitted.length, 0);
});

test("21: honeypot o respuesta sin deduplicated false no genera evento", () => {
  const result = runRuntime();
  result.window.solazMeasurement.trackLead({ ok: true }, { lead_type: "mensaje" });
  assert.equal(result.window.__solazMeasurementDebug.eventsEmitted.length, 0);
});

test("22: una respuesta fallida no genera evento", () => {
  const result = runRuntime();
  result.window.solazMeasurement.trackLead({ ok: false, deduplicated: false }, { lead_type: "mensaje" });
  assert.equal(result.window.__solazMeasurementDebug.eventsEmitted.length, 0);
});

test("23: mensaje usa generate_lead con los cuatro campos permitidos", () => {
  const result = runRuntime();
  result.window.solazMeasurement.trackLead({ ok: true, deduplicated: false }, {
    lead_type: "mensaje", service_code: "branding", source_page: "/contacto", cta_id: "contact-form"
  });
  assert.deepEqual(plain(result.window.__solazMeasurementDebug.eventsEmitted[0]), {
    name: "generate_lead",
    parameters: { lead_type: "mensaje", service_code: "branding", source_page: "/contacto", cta_id: "contact-form" }
  });
});

test("24: reunión usa generate_lead con lead_type reunion", () => {
  const result = runRuntime();
  result.window.solazMeasurement.trackLead({ ok: true, deduplicated: false }, { lead_type: "reunion" });
  assert.equal(result.window.__solazMeasurementDebug.eventsEmitted[0].parameters.lead_type, "reunion");
});

test("25: datos personales y campos internos adicionales nunca entran al payload", () => {
  const result = runRuntime();
  result.window.solazMeasurement.trackLead({ ok: true, deduplicated: false }, {
    lead_type: "mensaje", email: "persona@example.com", name: "Persona", message: "privado",
    phone: "+56900000000", submission_id: "secret", case_id: "internal", service_code: "branding"
  });
  const serialized = JSON.stringify(result.window.__solazMeasurementDebug.eventsEmitted[0]);
  for (const forbidden of ["persona@example.com", "Persona", "privado", "+56900000000", "submission_id", "case_id"]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test("26: WhatsApp genera solo contact_whatsapp y page_path", () => {
  const result = runRuntime();
  result.clickLink("https://wa.me/56912345678");
  assert.deepEqual(plain(result.window.__solazMeasurementDebug.eventsEmitted[0]), {
    name: "contact_whatsapp", parameters: { page_path: "/contacto" }
  });
});

test("27: teléfono genera solo contact_phone y page_path", () => {
  const result = runRuntime();
  result.clickLink("tel:+56912345678");
  assert.deepEqual(plain(result.window.__solazMeasurementDebug.eventsEmitted[0]), {
    name: "contact_phone", parameters: { page_path: "/contacto" }
  });
});

test("28: email genera solo contact_email y page_path", () => {
  const result = runRuntime();
  result.clickLink("mailto:persona@example.com");
  assert.deepEqual(plain(result.window.__solazMeasurementDebug.eventsEmitted[0]), {
    name: "contact_email", parameters: { page_path: "/contacto" }
  });
});

test("29: sin consentimiento el debug observa, pero no envía eventos", () => {
  const result = runRuntime();
  result.clickLink("mailto:persona@example.com");
  assert.equal(result.window.__solazMeasurementDebug.eventsEmitted.length, 1);
  assert.equal(result.window.__solazMeasurementDebug.eventsSent.length, 0);
});

test("30: el footer reabre el panel, enfoca el título y recupera foco al cerrar", () => {
  const result = runRuntime({ stored: savedPreference("rejected") });
  result.opener.click();
  assert.equal(result.root.hidden, false);
  assert.equal(result.title.focused, true);
  result.reject.click();
  assert.equal(result.opener.focused, true);
});

test("31: la UI usa botones semánticos y enlaza la política", () => {
  assert.match(partial, /<button[^>]+data-privacy-action="accept"[^>]*>Aceptar<\/button>/);
  assert.match(partial, /<button[^>]+data-privacy-action="reject"[^>]*>Rechazar<\/button>/);
  assert.match(partial, /<a href="\/politica-privacidad">Política de Privacidad<\/a>/);
});

test("32: Contacto conserva la compuerta estricta y no llama gtag directamente", () => {
  const source = readFileSync(join(projectRoot, "src/contacto.njk"), "utf8");
  assert.match(source, /if \(data\.deduplicated === false\) \{[\s\S]*?solazMeasurement\?\.trackLead/);
  assert.doesNotMatch(source, /\bgtag\s*\(/);
});

test("33: la configuración versionada parte deshabilitada y sin IDs reales", () => {
  const source = readFileSync(join(projectRoot, "src/_data/measurement.js"), "utf8");
  assert.match(source, /MEASUREMENT_ENABLED === "true"/);
  assert.match(source, /GA_MEASUREMENT_ID/);
  assert.match(source, /GOOGLE_ADS_ID/);
  assert.doesNotMatch(source, /\bG-[A-Z0-9]{6,}\b|\bAW-\d{6,}\b/);
});

test("34: aceptar persiste explícitamente la decisión accepted", () => {
  const result = runRuntime();
  result.accept.click();
  assert.equal(JSON.parse(result.values.get(STORAGE_KEY)).decision, "accepted");
});

test("35: la preferencia rejected restaurada conserva las cuatro señales denied", () => {
  const result = runRuntime({ stored: savedPreference("rejected") });
  assert.deepEqual(lastConsent(result, "update"), {
    analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied"
  });
});

test("36: preferencia corrupta bloquea Google incluso en Production configurado", () => {
  const result = runRuntime({ hostname: "solazstudio.cl", stored: "{corrupt", enabled: true, gaId: "G-TEST123" });
  assert.equal(result.appendedScripts.length, 0);
});

test("37: versión antigua bloquea Google incluso en Production configurado", () => {
  const result = runRuntime({ hostname: "solazstudio.cl", stored: savedPreference("accepted", 0), enabled: true, gaId: "G-TEST123" });
  assert.equal(result.appendedScripts.length, 0);
});

test("38: localStorage indisponible conserva el default seguro denied", () => {
  const result = runRuntime({ storageThrows: true });
  assert.deepEqual(lastConsent(result, "default"), {
    analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied"
  });
});

test("39: rejected bloquea tanto loader como eventos externos", () => {
  const result = runRuntime({ hostname: "solazstudio.cl", enabled: true, gaId: "G-TEST123" });
  result.reject.click();
  result.clickLink("mailto:persona@example.com");
  assert.equal(result.appendedScripts.length, 0);
  assert.equal(result.window.__solazMeasurementDebug.eventsSent.length, 0);
});

test("40: Production sin decisión tampoco carga Google", () => {
  const result = runRuntime({ hostname: "solazstudio.cl", enabled: true, gaId: "G-TEST123" });
  assert.equal(result.appendedScripts.length, 0);
});
