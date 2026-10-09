const PRODUCTION_ORIGIN = "https://solazstudio.cl";
const baseArgument = process.argv[2];

if (!baseArgument) {
  console.error("Smoke read-only: FAIL — indica una URL base explícita.");
  console.error("Uso: node scripts/smoke-readonly.mjs https://preview-autorizado.example");
  process.exit(1);
}

let baseUrl;
try {
  baseUrl = new URL(baseArgument);
} catch {
  console.error("Smoke read-only: FAIL — la URL base no es válida.");
  process.exit(1);
}

if (!["http:", "https:"].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password) {
  console.error("Smoke read-only: FAIL — la URL base debe usar HTTP(S) y no incluir credenciales.");
  process.exit(1);
}

function parseAttributes(tag) {
  const attributes = new Map();
  const pattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of tag.matchAll(pattern)) {
    attributes.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
}

function canonicalFrom(html) {
  return (html.match(/<link\b[^>]*>/gi) ?? [])
    .map(parseAttributes)
    .filter((attrs) => (attrs.get("rel") ?? "").toLowerCase().split(/\s+/).includes("canonical"))
    .map((attrs) => attrs.get("href") ?? "");
}

const checks = [
  { path: "/", type: "html", canonical: `${PRODUCTION_ORIGIN}/` },
  { path: "/contacto", type: "html", canonical: `${PRODUCTION_ORIGIN}/contacto` },
  { path: "/robots.txt", type: "text" },
  { path: "/sitemap.xml", type: "sitemap" }
];
const failures = [];

for (const check of checks) {
  const url = new URL(check.path, baseUrl.origin);
  let response;
  try {
    response = await fetch(url, { method: "GET", redirect: "follow" });
  } catch (error) {
    failures.push(`${check.path}: GET falló (${error instanceof Error ? error.message : "error de red"})`);
    continue;
  }

  if (!response.ok) {
    failures.push(`${check.path}: HTTP ${response.status}`);
    continue;
  }

  const body = await response.text();
  console.log(`${check.path}: HTTP ${response.status}`);

  if (check.type === "html") {
    const canonicals = canonicalFrom(body);
    if (canonicals.length !== 1 || canonicals[0] !== check.canonical) {
      failures.push(`${check.path}: canonical incorrecto`);
    }
  }

  if (check.type === "sitemap") {
    const locations = [...body.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) => match[1]);
    if (locations.length === 0) failures.push(`${check.path}: no contiene rutas`);
    for (const location of locations) {
      try {
        const sitemapUrl = new URL(location);
        if (sitemapUrl.protocol !== "https:" || sitemapUrl.hostname !== "solazstudio.cl") {
          failures.push(`${check.path}: dominio de sitemap incorrecto`);
          break;
        }
      } catch {
        failures.push(`${check.path}: contiene una URL inválida`);
        break;
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`Smoke read-only: FAIL (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Smoke read-only: PASS (${baseUrl.origin}, 4 GET)`);

