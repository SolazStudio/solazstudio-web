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

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match?.[1] ?? null;
}

for (const [file, canonical] of legalPages) {
  if (!EXPECTED_HTML_FILES.includes(file)) {
    throw new Error(`${file}: la URL legal dejó de pertenecer a la superficie pública esperada`);
  }
  const html = await readFile(join(outputRoot, file), "utf8");
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
const cookieBannerPatterns = [
  /\bcookie[-_ ](?:consent|banner)\b/i,
  /\bconsent[-_ ]banner\b/i
];
for (const file of EXPECTED_HTML_FILES) {
  const html = await readFile(join(outputRoot, file), "utf8");
  const executable = [
    ...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi),
    ...html.matchAll(/<(?:iframe|img)\b[^>]*>/gi)
  ].map((match) => match[0]).join("\n");
  const tracking = trackingPatterns.find((pattern) => pattern.test(executable));
  if (tracking) throw new Error(`${file}: tracking o Ads ejecutable detectado (${tracking})`);
  const cookieBanner = cookieBannerPatterns.find((pattern) => pattern.test(html));
  if (cookieBanner) throw new Error(`${file}: banner de cookies no autorizado detectado (${cookieBanner})`);
}

console.log(
  `qa:compliance PASS (${legalPages.size} páginas legales; ${EXPECTED_HTML_FILES.length} HTML sin tracking, Ads, cookies ni Web3Forms ejecutable)`
);
