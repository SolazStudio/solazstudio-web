import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { EXPECTED_HTML_FILES } from "../config/public-surface.js";

const projectRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));
const outputRoot = join(projectRoot, "_site");
const legalPages = new Map([
  ["politica-privacidad.html", "https://solazstudio.cl/politica-privacidad"],
  ["terminos-uso.html", "https://solazstudio.cl/terminos-uso"]
]);
const privacyNotice = "Al enviar, autorizas a Solaz Studio SpA a tratar los datos que proporcionas para gestionar tu solicitud, según la Política de Privacidad.";

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match?.[1] ?? null;
}

function visibleText(markup) {
  return markup
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

function countOccurrences(text, expected) {
  return text.split(expected).length - 1;
}

function formById(markup, id, file) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const form = markup.match(new RegExp(`<form\\b(?=[^>]*\\bid=["']${escaped}["'])[^>]*>[\\s\\S]*?<\\/form>`, "i"));
  assert.ok(form, `${file}: falta el formulario #${id}`);
  return form[0];
}

const legalHtml = new Map();
for (const [file, canonical] of legalPages) {
  if (!EXPECTED_HTML_FILES.includes(file)) {
    throw new Error(`${file}: la URL legal dejó de pertenecer a la superficie pública esperada`);
  }
  const html = await readFile(join(outputRoot, file), "utf8");
  legalHtml.set(file, html);
  const robots = [...html.matchAll(/<meta\b[^>]*>/gi)]
    .find((match) => attribute(match[0], "name")?.toLowerCase() === "robots");
  if (!robots || !attribute(robots[0], "content")?.toLowerCase().split(/\s*,\s*/).includes("noindex")) {
    throw new Error(`${file}: falta la directiva noindex`);
  }
  const canonicalTags = [...html.matchAll(/<link\b[^>]*>/gi)]
    .filter((match) => attribute(match[0], "rel")?.toLowerCase() === "canonical");
  if (canonicalTags.length !== 1 || attribute(canonicalTags[0][0], "href") !== canonical) {
    throw new Error(`${file}: canonical legal ausente, duplicado o modificado`);
  }
}

const privacyText = visibleText(legalHtml.get("politica-privacidad.html"));
const privacyMarkers = [
  "Solaz Studio SpA",
  "RUT 77.734.441-2",
  "Sebastián Silva Ogalde",
  "Eulogio Sánchez 065",
  "hola@solazstudio.cl",
  "Cloudflare",
  "Turnstile",
  "Notion",
  "Google Analytics 4",
  "Google Ads",
  "Google Fonts",
  "Ley N.º 21.719",
  "1 de diciembre de 2026",
  "Preferencias de privacidad",
  "analytics_storage",
  "ad_storage",
  "ad_user_data",
  "ad_personalization",
  "Customer Match",
  "enhanced conversions",
  "Web3Forms no forma parte del flujo activo."
];
for (const marker of privacyMarkers) {
  assert.ok(privacyText.includes(marker), `politica-privacidad.html: falta el contenido aprobado “${marker}”`);
}
assert.equal(
  countOccurrences(privacyText, "Web3Forms"),
  1,
  "politica-privacidad.html: Web3Forms debe aparecer solo en la declaración de que no forma parte del flujo activo"
);
assert.doesNotMatch(
  privacyText,
  /Web3Forms\s*(?::|actúa|se utiliza|plataforma utilizada|proveedor activo)/i,
  "politica-privacidad.html: Web3Forms vuelve a describirse como proveedor activo"
);

const termsText = visibleText(legalHtml.get("terminos-uso.html"));
const termsMarkers = [
  "no constituye por sí solo un contrato",
  "ni una reserva de fecha",
  "PROPIEDAD INTELECTUAL",
  "MARCAS Y CONTENIDOS DE TERCEROS",
  "scraping",
  "inteligencia artificial",
  "DERECHOS DE IMAGEN, HONRA Y VIDA PRIVADA",
  "NIÑOS, NIÑAS Y ADOLESCENTES",
  "CONTENIDO REALIZADO POR ENCARGO",
  "USO INDEBIDO Y SEGURIDAD",
  "ENLACES Y SERVICIOS EXTERNOS",
  "PRIVACIDAD, FORMULARIOS Y MARKETING",
  "legislación de la República de Chile"
];
for (const marker of termsMarkers) {
  assert.ok(termsText.includes(marker), `terminos-uso.html: falta la cobertura aprobada “${marker}”`);
}

const contactDocuments = new Map([
  ["src/contacto.njk", await readFile(join(projectRoot, "src/contacto.njk"), "utf8")],
  ["_site/contacto.html", await readFile(join(outputRoot, "contacto.html"), "utf8")]
]);
for (const [file, markup] of contactDocuments) {
  const documentText = visibleText(markup);
  assert.equal(countOccurrences(documentText, privacyNotice), 2, `${file}: deben existir exactamente dos avisos de tratamiento`);

  for (const formId of ["formMensaje", "formReunion"]) {
    const form = formById(markup, formId, file);
    assert.equal(countOccurrences(visibleText(form), privacyNotice), 1, `${file} #${formId}: el aviso debe aparecer exactamente una vez`);
    const noticeLinks = [...form.matchAll(/<a\b[^>]*>/gi)]
      .filter((match) => attribute(match[0], "href") === "/politica-privacidad");
    assert.equal(noticeLinks.length, 1, `${file} #${formId}: el aviso debe enlazar una vez a /politica-privacidad`);
  }

  const marketingInputs = [...markup.matchAll(/<input\b[^>]*>/gi)]
    .map((match) => match[0])
    .filter((tag) => attribute(tag, "name") === "consent_marketing");
  assert.equal(marketingInputs.length, 1, `${file}: debe preservarse el único checkbox de marketing existente`);
  assert.equal(attribute(marketingInputs[0], "value"), "si", `${file}: cambió value=si del consentimiento de marketing`);
  assert.equal(/\brequired\b/i.test(marketingInputs[0]), false, `${file}: el consentimiento de marketing no puede ser obligatorio`);
  assert.equal(/\bchecked\b/i.test(marketingInputs[0]), false, `${file}: el consentimiento de marketing debe estar desmarcado por defecto`);

  const noticeBlocks = [...markup.matchAll(/<p\b[^>]*\bclass=["'][^"']*\bform-privacy-notice\b[^"']*["'][^>]*>[\s\S]*?<\/p>/gi)];
  assert.equal(noticeBlocks.length, 2, `${file}: los avisos deben permanecer separados en dos bloques editoriales`);
  assert.equal(
    noticeBlocks.some((match) => /consent_marketing|type=["']checkbox["']/i.test(match[0])),
    false,
    `${file}: el consentimiento de marketing no puede integrarse dentro del aviso de tratamiento`
  );
}

const executableContactSources = [
  "functions/api/contact.js",
  "src/contacto.njk",
  "_site/contacto.html"
];
const web3FormsPatterns = [
  /api\.web3forms\.com/i,
  /web3forms\.com\/(?:submit|api)/i,
  /\baccess_key\b/i,
  /\bformDataWeb3\b/i,
  /fetch\s*\([^)]*web3forms/i
];
for (const file of executableContactSources) {
  const source = await readFile(join(projectRoot, file), "utf8");
  const matched = web3FormsPatterns.find((pattern) => pattern.test(source));
  if (matched) throw new Error(`${file}: integración ejecutable Web3Forms detectada (${matched})`);
}

const trackingPatterns = [
  /googletagmanager\.com/i,
  /google-analytics\.com/i,
  /googleadservices\.com/i,
  /doubleclick\.net/i,
  /connect\.facebook\.net/i,
  /facebook\.com\/tr/i,
  /clarity\.ms/i,
  /static\.hotjar\.com/i,
  /\bgtag\s*\(/i,
  /\bfbq\s*\(/i,
  /\bhj\s*\(/i
];
const approvedRuntimePattern = /<script\b[^>]*data-solaz-privacy-runtime[^>]*>[\s\S]*?<\/script>/gi;
const staticGoogleScriptPattern = /<script\b[^>]*\bsrc=["'][^"']*(?:googletagmanager\.com|google-analytics\.com|googleadservices\.com|doubleclick\.net)[^"']*["'][^>]*>/i;
const forbiddenMeasurementPatterns = [
  /googletagmanager\.com\/gtm\.js/i,
  /\bGTM-[A-Z0-9]+\b/i,
  /ad_personalization\s*:\s*["']granted["']/i,
  /send_page_view\s*:\s*true/i,
  /\bsend_to\b/i,
  /conversion[_ -]?label/i,
  /\bGOOGLE_ADS_ID\b/,
  /\bgoogleAdsId\b/,
  /\bADS_ID_PATTERN\b/,
  /\bG-[A-Z0-9]{6,}\b/,
  /\bAW-\d{6,}\b/
];
const cookieBannerPatterns = [
  /\bcookie[-_ ](?:consent|banner)\b/i,
  /\bconsent[-_ ]banner\b/i
];
const measurementSource = await readFile(join(projectRoot, "src/_data/measurement.js"), "utf8");
const approvedRuntimeSource = await readFile(join(projectRoot, "src/_includes/partials/privacy-preferences.njk"), "utf8");
const leadTrackingBlock = approvedRuntimeSource.match(/function trackLead\b[\s\S]*?function trackDirectContact\b/)?.[0] ?? "";
const directContactBlock = approvedRuntimeSource.match(/function trackDirectContact\b[\s\S]*?window\.solazMeasurement\b/)?.[0] ?? "";
const pageViewBlock = approvedRuntimeSource.match(/function buildPageViewPayload\b[\s\S]*?function emitEvent\b/)?.[0] ?? "";
const attributionBlock = approvedRuntimeSource.match(/const ATTRIBUTION_QUERY_KEYS\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1] ?? "";
const expectedAttributionKeys = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_id",
  "utm_term",
  "utm_content",
  "gclid",
  "gbraid",
  "wbraid",
  "dclid"
];
assert.ok(leadTrackingBlock, "privacy-preferences.njk: falta la guarda central de generate_lead");
assert.ok(directContactBlock, "privacy-preferences.njk: falta la guarda central de contacto directo");
assert.ok(pageViewBlock, "privacy-preferences.njk: falta el page_view manual controlado");
assert.ok(attributionBlock, "privacy-preferences.njk: falta la whitelist explícita de atribución");
assert.doesNotMatch(
  leadTrackingBlock,
  /\b(?:email|phone|telefono|nombre|name|message|submission_id|case_id|consent_marketing)\b/i,
  "privacy-preferences.njk: PII o identificador interno detectado en el bloque generate_lead"
);
assert.match(
  directContactBlock,
  /emitEvent\(eventName,\s*\{\s*page_path:\s*normalizedPath\s*\}\)/,
  "privacy-preferences.njk: contacto directo debe conservar únicamente page_path saneado"
);
assert.doesNotMatch(
  directContactBlock,
  /\b(?:telefono|nombre|message|href|referrer|search)\b/i,
  "privacy-preferences.njk: contacto directo incorporó datos no permitidos"
);
assert.deepEqual(
  [...attributionBlock.matchAll(/["']([a-z_]+)["']/g)].map((match) => match[1]),
  expectedAttributionKeys,
  "privacy-preferences.njk: la whitelist de atribución debe coincidir exactamente con F5.2A"
);
assert.match(pageViewBlock, /new URLSearchParams\(location\.search \|\| ["']{2}\)/);
assert.match(pageViewBlock, /page_location:\s*pageLocation\.toString\(\)/);
assert.match(pageViewBlock, /page_path:\s*pagePath/);
assert.match(pageViewBlock, /debug\.pageViewSent\s*\|\|\s*!googleIsEligible\(\)/);
assert.doesNotMatch(
  pageViewBlock,
  /window\.location\.href|document\.referrer|page_title|user_id|FormData|\b(?:email|phone|telefono|nombre|message)\b/i,
  "privacy-preferences.njk: page_view usa URL cruda, referrer, PII o campos no autorizados"
);
assert.deepEqual(
  [...approvedRuntimeSource.matchAll(/new Set\(\[([^\]]+)\]\)/g)]
    .flatMap((match) => [...match[1].matchAll(/["']([^"']+)["']/g)].map((item) => item[1]))
    .filter((value) => value.includes("solazstudio.cl")),
  ["solazstudio.cl", "www.solazstudio.cl"],
  "privacy-preferences.njk: la compuerta de hostname debe permitir únicamente los dos hosts de Production"
);
assert.equal(
  countOccurrences(approvedRuntimeSource, "gtag('config', config.gaMeasurementId, { send_page_view: false });"),
  1,
  "privacy-preferences.njk: GA4 debe configurarse una vez con send_page_view:false"
);
assert.equal(
  (approvedRuntimeSource.match(/gtag\(["']config["']/g) || []).length,
  1,
  "privacy-preferences.njk: solo puede existir una configuración gtag y debe ser GA4"
);
assert.equal(
  countOccurrences(approvedRuntimeSource, "gtag('event', 'page_view', { ...payload });"),
  1,
  "privacy-preferences.njk: debe existir exactamente un envío manual de page_view"
);
for (const state of ["analytics_storage", "ad_storage", "ad_user_data", "ad_personalization"]) {
  assert.match(approvedRuntimeSource, new RegExp(`${state}: ['\"]denied['\"]`), `privacy-preferences.njk: falta default/rejected denied para ${state}`);
}
for (const state of ["analytics_storage", "ad_storage", "ad_user_data"]) {
  assert.match(approvedRuntimeSource, new RegExp(`${state}: ['\"]granted['\"]`), `privacy-preferences.njk: falta accepted granted para ${state}`);
}
assert.doesNotMatch(measurementSource, /GOOGLE_ADS_ID|googleAdsId|ADS_ID_PATTERN/);
assert.equal(
  countOccurrences(approvedRuntimeSource, "https://www.googletagmanager.com/gtag/js?id="),
  1,
  "privacy-preferences.njk: el loader directo de Google debe existir exactamente una vez"
);
for (const [file, source] of [
  ["src/_data/measurement.js", measurementSource],
  ["src/_includes/partials/privacy-preferences.njk", approvedRuntimeSource]
]) {
  const forbidden = forbiddenMeasurementPatterns.find((pattern) => pattern.test(source));
  if (forbidden) throw new Error(`${file}: configuración de medición prohibida (${forbidden})`);
}

for (const file of EXPECTED_HTML_FILES) {
  const html = await readFile(join(outputRoot, file), "utf8");
  const approvedRuntimes = [...html.matchAll(approvedRuntimePattern)];
  assert.equal(approvedRuntimes.length, 1, `${file}: debe existir exactamente un runtime de privacidad aprobado`);
  assert.equal(
    countOccurrences(approvedRuntimes[0][0], "https://www.googletagmanager.com/gtag/js?id="),
    1,
    `${file}: el loader controlado de Google debe aparecer exactamente una vez dentro del runtime aprobado`
  );
  if (staticGoogleScriptPattern.test(html)) {
    throw new Error(`${file}: carga estática o incondicional de Google detectada`);
  }
  const outsideApprovedRuntime = html.replace(approvedRuntimePattern, "");
  const executable = [
    ...outsideApprovedRuntime.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi),
    ...outsideApprovedRuntime.matchAll(/<(?:iframe|img)\b[^>]*>/gi)
  ].map((match) => match[0]).join("\n");
  const tracking = trackingPatterns.find((pattern) => pattern.test(executable));
  if (tracking) throw new Error(`${file}: tracking fuera del runtime aprobado detectado (${tracking})`);
  const forbidden = forbiddenMeasurementPatterns.find((pattern) => pattern.test(html));
  if (forbidden) throw new Error(`${file}: medición o identificador prohibido detectado (${forbidden})`);
  const cookieBanner = cookieBannerPatterns.find((pattern) => pattern.test(html));
  if (cookieBanner) throw new Error(`${file}: banner de cookies no autorizado detectado (${cookieBanner})`);
}

console.log(
  `qa:compliance PASS (${legalPages.size} páginas legales; 2 avisos; marketing opcional; GA4 único con page_view saneado; ${EXPECTED_HTML_FILES.length} HTML con loader consentido y sin Ads directo, tracking estático, IDs, GTM, PII ni Web3Forms ejecutable)`
);
