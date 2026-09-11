import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { EXPECTED_HTML_FILES } from "../config/public-surface.js";

const projectRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));
const outputRoot = join(projectRoot, "_site");
const skipLink = '<a class="skip-link" href="#main-content">Saltar al contenido principal</a>';

function countMatches(value, pattern) {
  return [...value.matchAll(pattern)].length;
}

for (const route of EXPECTED_HTML_FILES) {
  const html = await readFile(join(outputRoot, route), "utf8");
  const skipIndex = html.indexOf(skipLink);
  const navigationIndex = html.indexOf('<nav class="main-nav"');
  const mainTags = html.match(/<main\b[^>]*>/gi) ?? [];
  const mainContentTags = mainTags.filter(tag => /\bid="main-content"/.test(tag));
  const ids = [...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(match => match[1]);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];

  if (!/<html\b[^>]*\blang=["']es["']/i.test(html)) {
    throw new Error(`${route}: falta html lang=es`);
  }

  if (countMatches(html, /<a class="skip-link" href="#main-content">Saltar al contenido principal<\/a>/g) !== 1) {
    throw new Error(`${route}: se esperaba exactamente un skip link con texto y href canónicos`);
  }
  if (countMatches(html, /href="#main-content"/g) !== 1) {
    throw new Error(`${route}: href #main-content ausente o duplicado`);
  }
  if (mainTags.length !== 1 || mainContentTags.length !== 1) {
    throw new Error(`${route}: se esperaba un único <main id="main-content">`);
  }
  if (duplicateIds.length) {
    throw new Error(`${route}: IDs duplicados: ${duplicateIds.join(", ")}`);
  }
  if (skipIndex < 0 || navigationIndex < 0 || skipIndex >= navigationIndex) {
    throw new Error(`${route}: el skip link debe preceder a la navegación principal`);
  }
  if (skipIndex >= html.indexOf(mainContentTags[0])) {
    throw new Error(`${route}: el skip link debe preceder a su destino`);
  }
  if (
    countMatches(html, /\.skip-link\s*\{/g) !== 1 ||
    countMatches(html, /\.skip-link:focus\s*\{/g) !== 1 ||
    !html.includes("clip: rect(0, 0, 0, 0);") ||
    !html.includes("overflow: visible;")
  ) {
    throw new Error(`${route}: estilos de ocultamiento/foco del skip link incompletos o duplicados`);
  }
}

console.log(`qa:skip-link PASS (${EXPECTED_HTML_FILES.length}/${EXPECTED_HTML_FILES.length} HTML)`);
