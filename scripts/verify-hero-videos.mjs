import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const BASELINE = "3f07bc311ed25708528b5b2c3226bc64726737f3";
const root = fileURLToPath(new URL("../", import.meta.url));
const homePosterPath = "img/hero-reel-poster.webp";

const heroes = [
  {
    label: "Home",
    template: "src/index.njk",
    source: "https://media.solazstudio.cl/hero/hero-reel.mp4",
    poster: homePosterPath
  },
  {
    label: "Producción Audiovisual",
    template: "src/produccion-audiovisual.njk",
    source: "https://media.solazstudio.cl/hero/hero-produccion-audiovisual.mp4",
    poster: "img/produccion-audiovisual.webp"
  },
  {
    label: "Fotografía Corporativa",
    template: "src/fotografia-corporativa.njk",
    source: "https://media.solazstudio.cl/hero/hero-fotografia-corporativa.mp4",
    poster: "img/fotografia-corporativa.webp"
  }
];

function fail(message) {
  throw new Error(message);
}

function baselineFile(relativePath, encoding = "utf8") {
  return execFileSync("git", ["show", `${BASELINE}:${relativePath}`], {
    cwd: root,
    encoding,
    maxBuffer: 10 * 1024 * 1024
  });
}

function parseAttributes(openTag) {
  const content = openTag
    .replace(/^<[a-z0-9:-]+\b/i, "")
    .replace(/\/?\s*>$/, "");
  const attributes = new Map();
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const name = match[1].toLowerCase();
    if (attributes.has(name)) fail(`Atributo duplicado: ${name}`);
    attributes.set(name, match[2] ?? match[3] ?? match[4] ?? null);
  }
  return attributes;
}

function comparableAttributes(attributes, ignored = []) {
  const ignoredSet = new Set(ignored);
  return JSON.stringify(
    [...attributes]
      .filter(([name]) => !ignoredSet.has(name))
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

function findHero(html, source, label) {
  const videos = [...html.matchAll(/<video\b([^>]*)>([\s\S]*?)<\/video>/gi)];
  const matching = videos.filter(match => match[2].includes(source));
  if (matching.length !== 1) {
    fail(`${label}: se esperó exactamente un hero para ${source}; encontrados=${matching.length}`);
  }
  return {
    totalVideos: videos.length,
    openTag: `<video${matching[0][1]}>`,
    body: matching[0][2]
  };
}

function openingTags(html, tagName) {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>`, "gi");
  return html.match(pattern) ?? [];
}

function normalizedTags(html, tagName) {
  return openingTags(html, tagName).map(tag => comparableAttributes(parseAttributes(tag)));
}

function scriptBlocks(html) {
  return html.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) ?? [];
}

function sameJson(left, right, message) {
  if (JSON.stringify(left) !== JSON.stringify(right)) fail(message);
}

function readUint24LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function webpDimensions(buffer) {
  if (buffer.length < 20 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    fail("Poster Home: firma RIFF/WEBP inválida");
  }
  if (buffer.readUInt32LE(4) + 8 !== buffer.length) fail("Poster Home: tamaño RIFF inconsistente");

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (data + size > buffer.length) fail("Poster Home: chunk WebP truncado");

    if (type === "VP8X" && size >= 10) {
      return { width: readUint24LE(buffer, data + 4) + 1, height: readUint24LE(buffer, data + 7) + 1 };
    }
    if (type === "VP8 " && size >= 10 && buffer[data + 3] === 0x9d && buffer[data + 4] === 0x01 && buffer[data + 5] === 0x2a) {
      return {
        width: buffer.readUInt16LE(data + 6) & 0x3fff,
        height: buffer.readUInt16LE(data + 8) & 0x3fff
      };
    }
    if (type === "VP8L" && size >= 5 && buffer[data] === 0x2f) {
      const bits = buffer.readUInt32LE(data + 1);
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    offset = data + size + (size % 2);
  }
  fail("Poster Home: no se encontraron dimensiones WebP válidas");
}

for (const hero of heroes) {
  const currentHtml = readFileSync(join(root, hero.template), "utf8");
  const baselineHtml = baselineFile(hero.template);
  const current = findHero(currentHtml, hero.source, hero.label);
  const baseline = findHero(baselineHtml, hero.source, `${hero.label} baseline`);

  if (current.totalVideos !== baseline.totalVideos) fail(`${hero.label}: cambió la cantidad de videos de la plantilla`);

  const currentVideoAttributes = parseAttributes(current.openTag);
  const baselineVideoAttributes = parseAttributes(baseline.openTag);
  if (baselineVideoAttributes.get("preload") !== "auto") fail(`${hero.label}: baseline sin preload auto esperado`);
  if (baselineVideoAttributes.has("poster")) fail(`${hero.label}: baseline ya contenía poster`);
  if (currentVideoAttributes.get("preload") !== "metadata") fail(`${hero.label}: preload debe ser metadata`);
  if (currentVideoAttributes.get("poster") !== hero.poster) fail(`${hero.label}: poster incorrecto`);
  if (currentVideoAttributes.has("controls")) fail(`${hero.label}: controls no autorizado`);

  for (const booleanAttribute of ["autoplay", "muted", "loop", "playsinline"]) {
    if (!currentVideoAttributes.has(booleanAttribute)) fail(`${hero.label}: falta ${booleanAttribute}`);
  }
  if (
    comparableAttributes(currentVideoAttributes, ["preload", "poster"]) !==
    comparableAttributes(baselineVideoAttributes, ["preload", "poster"])
  ) {
    fail(`${hero.label}: cambiaron atributos no autorizados del video`);
  }

  const currentSources = openingTags(current.body, "source");
  const baselineSources = openingTags(baseline.body, "source");
  sameJson(normalizedTags(current.body, "source"), normalizedTags(baseline.body, "source"), `${hero.label}: source distinto del baseline`);
  if (currentSources.length !== 1) fail(`${hero.label}: se esperaba exactamente un source`);
  const sourceAttributes = parseAttributes(currentSources[0]);
  if (sourceAttributes.get("src") !== hero.source) fail(`${hero.label}: URL de video alterada`);
  if (sourceAttributes.get("type") !== "video/mp4") fail(`${hero.label}: type debe ser video/mp4`);
  if (baselineSources.length !== currentSources.length) fail(`${hero.label}: cambió la cantidad de sources`);

  sameJson(normalizedTags(current.body, "img"), normalizedTags(baseline.body, "img"), `${hero.label}: fallback img interno alterado`);
  sameJson(scriptBlocks(currentHtml), scriptBlocks(baselineHtml), `${hero.label}: JavaScript de la plantilla alterado`);
}

for (const existingPoster of ["img/produccion-audiovisual.webp", "img/fotografia-corporativa.webp"]) {
  const current = readFileSync(join(root, existingPoster));
  const baseline = baselineFile(existingPoster, null);
  const currentHash = createHash("sha256").update(current).digest("hex");
  const baselineHash = createHash("sha256").update(baseline).digest("hex");
  if (currentHash !== baselineHash) fail(`${existingPoster}: el poster existente cambió`);
}

const homePoster = readFileSync(join(root, homePosterPath));
if (homePoster.length === 0 || homePoster.length > 400_000) {
  fail(`Poster Home: peso fuera de rango (${homePoster.length} B)`);
}
const dimensions = webpDimensions(homePoster);
if (dimensions.width <= 0 || dimensions.height <= 0 || dimensions.width > 1920) {
  fail(`Poster Home: dimensiones inválidas (${dimensions.width}x${dimensions.height})`);
}

console.log(`qa:video PASS (3 heroes; autoplay/muted/loop/playsinline preservados; preload=metadata; poster Home=${dimensions.width}x${dimensions.height}, ${homePoster.length} B)`);
