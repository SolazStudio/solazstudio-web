import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const BASE_COMMIT = "262410c82b33c09d35f10abe446906b239417c67";
const PROJECTS = [
  "campana-publicitaria-elige-educar-mineduc",
  "clew-evento-internacional-world-vaper-show",
  "cobertura-evento-kifit-tnf-trail",
  "cobertura-maraton-santiago-2025",
  "contenido-marca-red-bull-rb-zero",
  "contenido-redes-sociales-cdm-medical",
  "fotografia-arquitectura-cassone",
  "video-corporativo-weg-chile",
  "weg-cobertura-evento-seminario-chile"
];

const PAGES = [
  {
    id: "portafolio",
    label: "Portfolio",
    source: "src/portafolio.njk",
    output: "_site/portafolio.html",
    itemClass: "gallery-item",
    priorityCount: 10
  },
  ...PROJECTS.map(id => ({
    id,
    label: id === "fotografia-arquitectura-cassone"
      ? "Cassone"
      : id === "weg-cobertura-evento-seminario-chile"
        ? "WEG Seminarios"
        : id,
    source: `src/proyectos/${id}.njk`,
    output: `_site/proyectos/${id}.html`,
    itemClass: "content-item",
    priorityCount: 4
  }))
];

const args = process.argv.slice(2);
const option = name => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const root = resolve(option("--root") || ".");
const gitRoot = resolve(option("--git-root") || ".");
const compareRoot = option("--compare-root") ? resolve(option("--compare-root")) : null;
const reportOnly = args.includes("--report-only");
const jsonOutput = args.includes("--json");

function attrs(tag) {
  const result = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const match of tag.matchAll(pattern)) {
    result[match[1]] = match[2] ?? match[3] ?? match[4] ?? true;
  }
  return result;
}

function mediaItems(html, itemClass) {
  const lines = html.split(/\r?\n/);
  const items = [];
  let pending = null;

  for (const line of lines) {
    const itemTag = line.match(/<(?:div|article)\b[^>]*class="[^"]*"[^>]*>/);
    if (itemTag) {
      const itemAttrs = attrs(itemTag[0]);
      const classes = String(itemAttrs.class || "").split(/\s+/);
      if (classes.includes(itemClass)) pending = itemAttrs;
    }

    if (pending) {
      const imgTag = line.match(/<img\b[^>]*>/);
      if (imgTag) {
        const imageAttrs = attrs(imgTag[0]);
        items.push({
          src: String(imageAttrs.src || ""),
          alt: String(imageAttrs.alt || ""),
          loading: imageAttrs.loading ? String(imageAttrs.loading) : "eager",
          decoding: imageAttrs.decoding ? String(imageAttrs.decoding) : null,
          width: imageAttrs.width ? Number(imageAttrs.width) : null,
          height: imageAttrs.height ? Number(imageAttrs.height) : null,
          category: pending["data-cat"] ? String(pending["data-cat"]) : null,
          href: pending["data-href"] ? String(pending["data-href"]) : null,
          lightbox: pending["data-lightbox"] ? String(pending["data-lightbox"]) : null,
          videoSrc: pending["data-src"] ? String(pending["data-src"]) : null,
          isVideo: String(pending.class || "").split(/\s+/).includes("is-video")
        });
        pending = null;
      }
    }
  }
  return items;
}

function webpDimensions(buffer) {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error("archivo no WebP");
  }
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (type === "VP8X" && data + 10 <= buffer.length) {
      return {
        width: 1 + buffer.readUIntLE(data + 4, 3),
        height: 1 + buffer.readUIntLE(data + 7, 3)
      };
    }
    if (type === "VP8 " && data + 10 <= buffer.length) {
      return {
        width: buffer.readUInt16LE(data + 6) & 0x3fff,
        height: buffer.readUInt16LE(data + 8) & 0x3fff
      };
    }
    if (type === "VP8L" && data + 5 <= buffer.length && buffer[data] === 0x2f) {
      return {
        width: 1 + buffer[data + 1] + ((buffer[data + 2] & 0x3f) << 8),
        height: 1 + (buffer[data + 2] >> 6) + (buffer[data + 3] << 2) + ((buffer[data + 4] & 0x0f) << 10)
      };
    }
    offset = data + size + (size % 2);
  }
  throw new Error("dimensiones WebP no encontradas");
}

function fileForSrc(baseRoot, src) {
  const local = src.split(/[?#]/, 1)[0].replace(/\\/g, "/").replace(/^(?:\.\.\/)+/, "").replace(/^\//, "");
  return join(baseRoot, ...local.split("/"));
}

function editorialSignature(item) {
  return JSON.stringify({
    src: item.src,
    alt: item.alt,
    category: item.category,
    href: item.href,
    lightbox: item.lightbox,
    videoSrc: item.videoSrc,
    isVideo: item.isVideo
  });
}

function videoSignature(source) {
  const relevant = [
    ...source.matchAll(/<(?:video|source)\b[^>]*>/g),
    ...source.matchAll(/video\.(?:autoplay|muted|loop|playsInline|preload|controls)\s*=\s*[^;]+;/g)
  ].map(match => match[0]);
  return createHash("sha256").update(JSON.stringify(relevant)).digest("hex");
}

function baseSource(page) {
  return execFileSync("git", ["show", `${BASE_COMMIT}:${page.source}`], {
    cwd: gitRoot,
    encoding: "utf8"
  });
}

function assertOrderedBaseline(current, baseline, page) {
  let currentIndex = 0;
  for (const expected of baseline) {
    const signature = editorialSignature(expected);
    while (currentIndex < current.length && editorialSignature(current[currentIndex]) !== signature) {
      currentIndex += 1;
    }
    if (currentIndex >= current.length) {
      throw new Error(`${page.label}: se eliminó, cambió o reordenó media existente (${expected.src})`);
    }
    currentIndex += 1;
  }
}

function analyzePage(page, baseRoot, validate) {
  const sourceText = readFileSync(join(baseRoot, page.source), "utf8");
  const outputText = readFileSync(join(baseRoot, page.output), "utf8");
  const sourceItems = mediaItems(sourceText, page.itemClass);
  const outputItems = mediaItems(outputText, page.itemClass);
  const sourceSignatures = sourceItems.map(editorialSignature);
  const outputSignatures = outputItems.map(editorialSignature);

  if (JSON.stringify(sourceSignatures) !== JSON.stringify(outputSignatures)) {
    throw new Error(`${page.label}: el build cambió cantidad, URLs, orden, enlaces o metadata editorial`);
  }
  if (sourceItems.length === 0) throw new Error(`${page.label}: galería vacía`);

  const baselineText = baseSource(page);
  const baselineItems = mediaItems(baselineText, page.itemClass);
  assertOrderedBaseline(sourceItems, baselineItems, page);
  if (videoSignature(sourceText) !== videoSignature(baselineText)) {
    throw new Error(`${page.label}: cambió un atributo o fuente de video respecto de la base F3.1`);
  }

  let totalBytes = 0;
  let deferredBytes = 0;
  for (let index = 0; index < sourceItems.length; index += 1) {
    const item = sourceItems[index];
    const file = fileForSrc(baseRoot, item.src);
    const bytes = statSync(file).size;
    const dimensions = webpDimensions(readFileSync(file));
    totalBytes += bytes;
    if (item.loading === "lazy") deferredBytes += bytes;

    if (validate) {
      const expectedLoading = index < Math.min(page.priorityCount, sourceItems.length) ? "eager" : "lazy";
      if (item.loading !== expectedLoading) {
        throw new Error(`${page.label}: ${item.src} debe usar loading="${expectedLoading}"`);
      }
      if (item.width !== dimensions.width || item.height !== dimensions.height) {
        throw new Error(`${page.label}: dimensiones inválidas para ${item.src}; esperadas ${dimensions.width}x${dimensions.height}`);
      }
      if (item.loading === "lazy" && item.decoding !== "async") {
        throw new Error(`${page.label}: imagen diferida sin decoding="async" (${item.src})`);
      }
    }
  }

  return {
    id: page.id,
    label: page.label,
    images: sourceItems.length,
    eager: sourceItems.filter(item => item.loading !== "lazy").length,
    lazy: sourceItems.filter(item => item.loading === "lazy").length,
    totalBytes,
    deferredBytes,
    orderSha256: createHash("sha256").update(sourceItems.map(item => item.src).join("\n")).digest("hex")
  };
}

const report = PAGES.map(page => analyzePage(page, root, !reportOnly));

if (compareRoot) {
  const comparison = PAGES.map(page => analyzePage(page, compareRoot, false));
  for (let index = 0; index < report.length; index += 1) {
    if (report[index].images !== comparison[index].images || report[index].orderSha256 !== comparison[index].orderSha256) {
      throw new Error(`${report[index].label}: cantidad u orden distinto respecto de ${compareRoot}`);
    }
  }
}

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2));
} else {
  for (const item of report) {
    console.log(`${item.label}: ${item.images} imágenes; eager=${item.eager}; lazy=${item.lazy}; total=${item.totalBytes} B; diferido=${item.deferredBytes} B; orden=${item.orderSha256}`);
  }
  console.log(`qa:media PASS (${report.length} galerías; base editorial ${BASE_COMMIT})`);
}
