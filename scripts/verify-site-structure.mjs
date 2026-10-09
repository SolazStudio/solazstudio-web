import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EXPECTED_HTML_FILES } from "../config/public-surface.js";
import pages from "../src/_data/pages.js";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE_ROOT = path.join(PROJECT_ROOT, "_site");
const SITE_ORIGIN = "https://solazstudio.cl";
const EXCLUDED_FROM_INDEX = new Set([
  "404.html",
  "politica-privacidad.html",
  "terminos-uso.html"
]);
const failures = [];

function fail(file, reason) {
  failures.push(`${file}: ${reason}`);
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function parseAttributes(tag) {
  const attributes = new Map();
  const pattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of tag.matchAll(pattern)) {
    attributes.set(match[1].toLowerCase(), decodeHtml(match[2] ?? match[3] ?? match[4] ?? ""));
  }
  return attributes;
}

function outputRoute(file) {
  if (file === "index.html") return "/";
  return `/${file.replace(/\.html$/, "")}`;
}

function outputCandidates(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return [];
  }

  const relative = decoded.replace(/^\/+/, "");
  if (!relative) return ["index.html"];
  if (relative.endsWith("/")) {
    const withoutSlash = relative.replace(/\/+$/, "");
    return [`${withoutSlash}/index.html`, `${withoutSlash}.html`];
  }
  if (/\.html$/i.test(relative)) return [relative];
  if (path.posix.extname(relative)) return [];
  return [`${relative}.html`, `${relative}/index.html`];
}

function idsIn(html) {
  const ids = new Set();
  for (const tag of html.match(/<[^>]+>/g) ?? []) {
    const id = parseAttributes(tag).get("id");
    if (id) ids.add(id);
  }
  return ids;
}

function metaRobots(html) {
  return (html.match(/<meta\b[^>]*>/gi) ?? [])
    .map(parseAttributes)
    .filter((attrs) => attrs.get("name")?.toLowerCase() === "robots")
    .map((attrs) => attrs.get("content") ?? "");
}

function canonicalLinks(html) {
  return (html.match(/<link\b[^>]*>/gi) ?? [])
    .map(parseAttributes)
    .filter((attrs) => (attrs.get("rel") ?? "").toLowerCase().split(/\s+/).includes("canonical"))
    .map((attrs) => attrs.get("href") ?? "");
}

const pageByPermalink = new Map(
  Object.values(pages).map((page) => [page.permalink, page])
);
const htmlByFile = new Map();

if (EXPECTED_HTML_FILES.length !== 24) {
  fail("config/public-surface.js", `se esperaban 24 páginas y hay ${EXPECTED_HTML_FILES.length}`);
}

for (const file of EXPECTED_HTML_FILES) {
  const absolute = path.join(SITE_ROOT, ...file.split("/"));
  if (!existsSync(absolute)) {
    fail(file, "no existe en _site");
    continue;
  }
  htmlByFile.set(file, await readFile(absolute, "utf8"));
  if (!pageByPermalink.has(file)) fail(file, "no tiene entrada correspondiente en src/_data/pages.js");
}

const idsByFile = new Map(
  [...htmlByFile].map(([file, html]) => [file, idsIn(html)])
);

for (const [sourceFile, html] of htmlByFile) {
  const sourceUrl = new URL(outputRoute(sourceFile), SITE_ORIGIN);
  const anchorTags = html.match(/<(?:a|area)\b[^>]*>/gi) ?? [];

  for (const tag of anchorTags) {
    const href = parseAttributes(tag).get("href");
    if (!href) continue;

    const scheme = href.trim().match(/^([a-z][a-z\d+.-]*):/i)?.[1]?.toLowerCase();
    if (scheme && !["http", "https"].includes(scheme)) continue;

    let targetUrl;
    try {
      targetUrl = new URL(href, sourceUrl);
    } catch {
      fail(sourceFile, `href inválido: ${href}`);
      continue;
    }

    if (!["solazstudio.cl", "www.solazstudio.cl"].includes(targetUrl.hostname.toLowerCase())) continue;

    if (/\.html$/i.test(targetUrl.pathname)) {
      fail(sourceFile, `URL interna retrocedió a .html: ${href}`);
    }

    const candidates = outputCandidates(targetUrl.pathname);
    if (candidates.length === 0) continue;
    const targetFile = candidates.find((candidate) => htmlByFile.has(candidate));
    if (!targetFile) {
      fail(sourceFile, `enlace interno sin destino HTML: ${href}`);
      continue;
    }

    if (targetUrl.hash && targetUrl.hash !== "#") {
      let fragment;
      try {
        fragment = decodeURIComponent(targetUrl.hash.slice(1));
      } catch {
        fail(sourceFile, `fragmento inválido: ${href}`);
        continue;
      }
      if (!idsByFile.get(targetFile)?.has(fragment)) {
        fail(sourceFile, `fragmento inexistente en ${targetFile}: #${fragment}`);
      }
    }
  }
}

const indexableFiles = EXPECTED_HTML_FILES.filter((file) => !EXCLUDED_FROM_INDEX.has(file));
if (indexableFiles.length !== 21) {
  fail("config/public-surface.js", `se esperaban 21 rutas indexables y hay ${indexableFiles.length}`);
}

const expectedCanonicalByFile = new Map();
for (const file of indexableFiles) {
  const canonical = pageByPermalink.get(file)?.canonical;
  if (!canonical) {
    fail(file, "falta canonical esperada en src/_data/pages.js");
    continue;
  }
  expectedCanonicalByFile.set(file, canonical);
}

const sitemapPath = path.join(SITE_ROOT, "sitemap.xml");
let sitemapUrls = [];
if (!existsSync(sitemapPath)) {
  fail("sitemap.xml", "no existe en _site");
} else {
  const sitemap = await readFile(sitemapPath, "utf8");
  sitemapUrls = [...sitemap.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) => decodeHtml(match[1]));
}

if (sitemapUrls.length !== 21) {
  fail("sitemap.xml", `debe contener exactamente 21 rutas; contiene ${sitemapUrls.length}`);
}

const sitemapSet = new Set(sitemapUrls);
if (sitemapSet.size !== sitemapUrls.length) fail("sitemap.xml", "contiene rutas duplicadas");

for (const location of sitemapUrls) {
  let url;
  try {
    url = new URL(location);
  } catch {
    fail("sitemap.xml", `URL inválida: ${location}`);
    continue;
  }
  if (url.protocol !== "https:" || url.hostname !== "solazstudio.cl") {
    fail("sitemap.xml", `host o protocolo ajeno: ${location}`);
  }
  if (/\.html$/i.test(url.pathname)) fail("sitemap.xml", `URL retrocedió a .html: ${location}`);
}

const expectedSitemapSet = new Set(expectedCanonicalByFile.values());
for (const expected of expectedSitemapSet) {
  if (!sitemapSet.has(expected)) fail("sitemap.xml", `falta ruta esperada: ${expected}`);
}
for (const actual of sitemapSet) {
  if (!expectedSitemapSet.has(actual)) fail("sitemap.xml", `ruta inesperada: ${actual}`);
}

for (const [file, expectedCanonical] of expectedCanonicalByFile) {
  const canonical = canonicalLinks(htmlByFile.get(file) ?? "");
  if (canonical.length !== 1) {
    fail(file, `debe tener exactamente un canonical; tiene ${canonical.length}`);
    continue;
  }
  let parsed;
  try {
    parsed = new URL(canonical[0]);
  } catch {
    fail(file, `canonical no es absoluta: ${canonical[0]}`);
    continue;
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== "solazstudio.cl") {
    fail(file, `canonical usa host o protocolo incorrecto: ${canonical[0]}`);
  }
  if (/\.html$/i.test(parsed.pathname)) fail(file, `canonical retrocedió a .html: ${canonical[0]}`);
  if (canonical[0] !== expectedCanonical) {
    fail(file, `canonical ${canonical[0]} no coincide con ${expectedCanonical}`);
  }
  if (!sitemapSet.has(canonical[0])) fail(file, "canonical no está presente en sitemap.xml");
}

for (const file of EXCLUDED_FROM_INDEX) {
  const directives = metaRobots(htmlByFile.get(file) ?? "");
  if (!directives.some((content) => content.toLowerCase().split(/[\s,]+/).includes("noindex"))) {
    fail(file, "falta directiva noindex");
  }
  const canonical = pageByPermalink.get(file)?.canonical;
  if (canonical && sitemapSet.has(canonical)) fail("sitemap.xml", `incluye ruta noindex: ${canonical}`);
}

if (failures.length > 0) {
  console.error(`QA de estructura: FAIL (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`QA de estructura: PASS (${htmlByFile.size} HTML, ${sitemapUrls.length} rutas indexables)`);

