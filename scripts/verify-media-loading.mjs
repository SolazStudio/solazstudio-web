import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import {
  getResponsiveCandidates,
  publicImagePath,
  RESPONSIVE_PROJECT_IDS,
  RESPONSIVE_TARGET_WIDTHS,
  responsiveSizesFor
} from "../config/responsive-images.js";

const BASE_COMMIT = "ef353a388f8b2dc9624914dc9143b89888f83e62";

const PAGES = [
  {
    id: "portafolio",
    label: "Portfolio",
    source: "src/portafolio.njk",
    output: "_site/portafolio.html",
    itemClass: "gallery-item",
    priorityCount: 10
  },
  ...RESPONSIVE_PROJECT_IDS.map(id => ({
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
        const classes = String(pending.class || "").split(/\s+/).filter(Boolean);
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
          classes,
          isVideo: classes.includes("is-video"),
          isProject: classes.includes("is-project"),
          isFeatured: classes.includes("is-featured"),
          srcset: imageAttrs.srcset ? String(imageAttrs.srcset) : null,
          sizes: imageAttrs.sizes ? String(imageAttrs.sizes) : null
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
    isVideo: item.isVideo,
    isProject: item.isProject,
    isFeatured: item.isFeatured
  });
}

function deliverySignature(item) {
  return JSON.stringify({
    src: item.src,
    loading: item.loading,
    decoding: item.decoding,
    width: item.width,
    height: item.height
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
    if (deliverySignature(current[currentIndex]) !== deliverySignature(expected)) {
      throw new Error(`${page.label}: cambió loading, decoding o dimensiones de F3.1 (${expected.src})`);
    }
    currentIndex += 1;
  }
}

function srcsetEntries(value, page, src) {
  if (!value) return [];
  return value.split(",").map(raw => {
    const match = raw.trim().match(/^(\S+)\s+(\d+)w$/);
    if (!match) throw new Error(`${page.label}: srcset inválido en ${src}`);
    return { url: match[1], width: Number(match[2]) };
  });
}

function summarizeReductions(values) {
  if (values.length === 0) return { average: null, median: null };
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
  return {
    average: values.reduce((sum, value) => sum + value, 0) / values.length,
    median
  };
}

const announcedResponsiveUrls = new Set();
const aggregateVariantMetrics = new Map(RESPONSIVE_TARGET_WIDTHS.map(width => [width, {
  count: 0,
  bytes: 0,
  reductions: []
}]));

async function analyzePage(page, baseRoot, validate) {
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
  let responsiveImages = 0;
  let sizesImages = 0;
  let discardedCandidates = 0;
  const variantMetrics = new Map(RESPONSIVE_TARGET_WIDTHS.map(width => [width, {
    count: 0,
    bytes: 0,
    reductions: []
  }]));
  for (let index = 0; index < sourceItems.length; index += 1) {
    const item = sourceItems[index];
    const outputItem = outputItems[index];
    const file = fileForSrc(baseRoot, item.src);
    const bytes = statSync(file).size;
    const dimensions = webpDimensions(readFileSync(file));
    totalBytes += bytes;
    if (item.loading === "lazy") deferredBytes += bytes;

    if (validate) {
      if (deliverySignature(item) !== deliverySignature(outputItem)) {
        throw new Error(`${page.label}: el build cambió src, loading, decoding o dimensiones (${item.src})`);
      }
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

      const actualEntries = srcsetEntries(outputItem.srcset, page, item.src);
      const actualWidths = actualEntries.map(candidate => candidate.width);
      if (new Set(actualWidths).size !== actualWidths.length) {
        throw new Error(`${page.label}: descriptores srcset duplicados (${item.src})`);
      }
      if (JSON.stringify(actualWidths) !== JSON.stringify([...actualWidths].sort((a, b) => a - b))) {
        throw new Error(`${page.label}: srcset no está ordenado por ancho (${item.src})`);
      }

      for (const candidate of actualEntries.filter(entry => entry.url.startsWith("/img/_responsive/"))) {
        const generatedFile = fileForSrc(join(baseRoot, "_site"), candidate.url);
        const generatedBytes = statSync(generatedFile).size;
        const generatedDimensions = webpDimensions(readFileSync(generatedFile));
        if (generatedDimensions.width !== candidate.width) {
          throw new Error(`${page.label}: descriptor ${candidate.width}w no coincide con el archivo (${item.src})`);
        }
        if (candidate.width >= dimensions.width) {
          throw new Error(`${page.label}: derivado con upscale o ancho original (${item.src})`);
        }
        const expectedHeight = Math.round(dimensions.height * candidate.width / dimensions.width);
        if (Math.abs(generatedDimensions.height - expectedHeight) > 1) {
          throw new Error(`${page.label}: proporción alterada en ${candidate.url}`);
        }
        if (generatedBytes >= bytes) {
          throw new Error(`${page.label}: derivado no beneficioso anunciado (${candidate.url})`);
        }
        announcedResponsiveUrls.add(candidate.url);
      }

      const expectedGenerated = await getResponsiveCandidates(file, dimensions.width);
      const expectedEntries = [
        ...expectedGenerated.map(candidate => ({ url: candidate.url, width: candidate.width })),
        ...(expectedGenerated.length > 0
          ? [{ url: `/${publicImagePath(item.src)}`, width: dimensions.width }]
          : [])
      ];
      if (JSON.stringify(actualEntries) !== JSON.stringify(expectedEntries)) {
        throw new Error(`${page.label}: srcset incompleto, no determinista o sin original (${item.src})`);
      }

      const potentialCount = RESPONSIVE_TARGET_WIDTHS.filter(width => width < dimensions.width).length;
      discardedCandidates += potentialCount - expectedGenerated.length;
      if (expectedGenerated.length > 0) {
        responsiveImages += 1;
        if (!outputItem.sizes) throw new Error(`${page.label}: imagen responsiva sin sizes (${item.src})`);
        const expectedSizes = responsiveSizesFor(page.output.replace(/^_site\//, ""), item.classes, dimensions.width, dimensions.height);
        if (outputItem.sizes !== expectedSizes) {
          throw new Error(`${page.label}: perfil sizes incorrecto (${item.src})`);
        }
        sizesImages += 1;
      } else if (outputItem.srcset || outputItem.sizes) {
        throw new Error(`${page.label}: srcset/sizes sin derivado beneficioso (${item.src})`);
      }

      for (const candidate of expectedGenerated) {
        const metric = variantMetrics.get(candidate.width);
        metric.count += 1;
        metric.bytes += candidate.size;
        metric.reductions.push(1 - candidate.size / bytes);
        const aggregateMetric = aggregateVariantMetrics.get(candidate.width);
        aggregateMetric.count += 1;
        aggregateMetric.bytes += candidate.size;
        aggregateMetric.reductions.push(1 - candidate.size / bytes);
      }
    }
  }

  const variants = Object.fromEntries([...variantMetrics].map(([width, metric]) => [width, {
    count: metric.count,
    bytes: metric.bytes,
    ...summarizeReductions(metric.reductions)
  }]));

  return {
    id: page.id,
    label: page.label,
    images: sourceItems.length,
    eager: sourceItems.filter(item => item.loading !== "lazy").length,
    lazy: sourceItems.filter(item => item.loading === "lazy").length,
    totalBytes,
    deferredBytes,
    responsiveImages,
    sizesImages,
    discardedCandidates,
    variants,
    orderSha256: createHash("sha256").update(sourceItems.map(item => item.src).join("\n")).digest("hex")
  };
}

const report = await Promise.all(PAGES.map(page => analyzePage(page, root, !reportOnly)));

if (compareRoot) {
  const comparison = await Promise.all(PAGES.map(page => analyzePage(page, compareRoot, false)));
  for (let index = 0; index < report.length; index += 1) {
    if (report[index].images !== comparison[index].images || report[index].orderSha256 !== comparison[index].orderSha256) {
      throw new Error(`${report[index].label}: cantidad u orden distinto respecto de ${compareRoot}`);
    }
  }
}

let generatedFiles = 0;
let generatedBytes = 0;
if (!reportOnly) {
  const outputDirectory = join(root, "_site", "img", "_responsive");
  const entries = readdirSync(outputDirectory, { withFileTypes: true });
  const outputUrls = new Set(entries.map(entry => {
    if (!entry.isFile() || !entry.name.endsWith(".webp")) {
      throw new Error(`Archivo inesperado en _site/img/_responsive/: ${entry.name}`);
    }
    generatedFiles += 1;
    generatedBytes += statSync(join(outputDirectory, entry.name)).size;
    return `/img/_responsive/${entry.name}`;
  }));
  if (
    outputUrls.size !== announcedResponsiveUrls.size ||
    [...outputUrls].some(url => !announcedResponsiveUrls.has(url))
  ) {
    throw new Error("_site/img/_responsive/ contiene derivados huérfanos o falta un derivado anunciado");
  }
}

const aggregate = {
  images: report.reduce((sum, item) => sum + item.images, 0),
  eager: report.reduce((sum, item) => sum + item.eager, 0),
  lazy: report.reduce((sum, item) => sum + item.lazy, 0),
  originalBytes: report.reduce((sum, item) => sum + item.totalBytes, 0),
  responsiveImages: report.reduce((sum, item) => sum + item.responsiveImages, 0),
  sizesImages: report.reduce((sum, item) => sum + item.sizesImages, 0),
  discardedCandidates: report.reduce((sum, item) => sum + item.discardedCandidates, 0),
  generatedFiles,
  generatedBytes,
  variants: Object.fromEntries([...aggregateVariantMetrics].map(([width, metric]) => [width, {
    count: metric.count,
    bytes: metric.bytes,
    ...summarizeReductions(metric.reductions)
  }]))
};

if (jsonOutput) {
  console.log(JSON.stringify({ pages: report, aggregate }, null, 2));
} else {
  for (const item of report) {
    console.log(`${item.label}: ${item.images} imágenes; eager=${item.eager}; lazy=${item.lazy}; srcset=${item.responsiveImages}; 480w=${item.variants[480].count}; 960w=${item.variants[960].count}; descartados=${item.discardedCandidates}; orden=${item.orderSha256}`);
  }
  console.log(`Agregado: imágenes=${aggregate.images}; srcset=${aggregate.responsiveImages}; 480w=${aggregate.variants[480].count}; 960w=${aggregate.variants[960].count}; archivos=${aggregate.generatedFiles}; bytes=${aggregate.generatedBytes}; descartados=${aggregate.discardedCandidates}`);
  console.log(`qa:media PASS (${report.length} galerías; base editorial y funcional ${BASE_COMMIT}; derivados=${announcedResponsiveUrls.size})`);
}
