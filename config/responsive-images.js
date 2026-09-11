import Image from "@11ty/eleventy-img";
import { stat, unlink } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

const PROJECT_ROOT = resolve(".");
const IMAGE_ROOT = join(PROJECT_ROOT, "img");
const OUTPUT_ROOT = join(PROJECT_ROOT, "_site", "img", "_responsive");
export const RESPONSIVE_TARGET_WIDTHS = Object.freeze([480, 960]);
export const RESPONSIVE_PROJECT_IDS = Object.freeze([
  "campana-publicitaria-elige-educar-mineduc",
  "clew-evento-internacional-world-vaper-show",
  "cobertura-evento-kifit-tnf-trail",
  "cobertura-maraton-santiago-2025",
  "contenido-marca-red-bull-rb-zero",
  "contenido-redes-sociales-cdm-medical",
  "fotografia-arquitectura-cassone",
  "video-corporativo-weg-chile",
  "weg-cobertura-evento-seminario-chile"
]);
const TARGET_OUTPUTS = new Set([
  "portafolio.html",
  ...RESPONSIVE_PROJECT_IDS.map(id => `proyectos/${id}.html`)
]);

const PORTFOLIO_NORMAL_SIZES = "(max-width: 768px) 50vw, (max-width: 1024px) 33.34vw, 20vw";
const PORTFOLIO_PROJECT_SIZES = "(max-width: 768px) 100vw, (max-width: 1024px) 66.67vw, 40vw";
const PROJECT_NORMAL_SIZES = "(max-width: 640px) 50vw, (max-width: 1024px) 33.34vw, 25vw";
const PROJECT_FEATURED_SIZES = "(max-width: 640px) 100vw, (max-width: 1024px) 66.67vw, 50vw";

const variantCache = new Map();

function attributes(tag) {
  const result = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const match of tag.matchAll(pattern)) {
    result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? true;
  }
  return result;
}

function setAttribute(tag, name, value) {
  const escaped = String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  const existing = new RegExp(`\\s${name}=(?:"[^"]*"|'[^']*'|[^\\s>]+)`, "i");
  if (existing.test(tag)) return tag.replace(existing, ` ${name}="${escaped}"`);
  const closing = tag.endsWith("/>") ? "/>" : ">";
  return `${tag.slice(0, -closing.length).trimEnd()} ${name}="${escaped}"${closing}`;
}

function outputKey(outputPath) {
  if (!outputPath) return null;
  const normalized = String(outputPath).replaceAll("\\", "/");
  const marker = "/_site/";
  const index = normalized.lastIndexOf(marker);
  return index >= 0 ? normalized.slice(index + marker.length) : null;
}

export function publicImagePath(src) {
  const clean = String(src).split(/[?#]/, 1)[0].replaceAll("\\", "/");
  const normalized = clean.replace(/^(?:\.\.\/)+/, "").replace(/^\.\//, "").replace(/^\//, "");
  if (!normalized.startsWith("img/")) throw new Error(`Ruta de imagen fuera de /img: ${src}`);
  return normalized;
}

function sourceFile(publicPath) {
  const file = resolve(PROJECT_ROOT, publicPath);
  const insideImages = relative(IMAGE_ROOT, file);
  if (insideImages.startsWith(`..${sep}`) || insideImages === ".." || isAbsolute(insideImages)) {
    throw new Error(`Ruta de imagen insegura: ${publicPath}`);
  }
  return file;
}

export function responsiveSizesFor(page, classes, width, height) {
  if (page === "portafolio.html") {
    return classes.includes("is-project") && width >= height
      ? PORTFOLIO_PROJECT_SIZES
      : PORTFOLIO_NORMAL_SIZES;
  }
  return classes.includes("is-featured") ? PROJECT_FEATURED_SIZES : PROJECT_NORMAL_SIZES;
}

export async function getResponsiveCandidates(file, originalWidth) {
  const cacheKey = `${file}:${originalWidth}`;
  if (variantCache.has(cacheKey)) return variantCache.get(cacheKey);

  const promise = (async () => {
    const widths = RESPONSIVE_TARGET_WIDTHS.filter(width => width < originalWidth);
    if (widths.length === 0) return [];

    const originalBytes = (await stat(file)).size;
    const metadata = await Image(file, {
      widths,
      formats: ["webp"],
      outputDir: OUTPUT_ROOT,
      urlPath: "/img/_responsive/",
      sharpWebpOptions: { quality: 85 },
      concurrency: 8
    });

    const candidates = [];
    for (const generated of metadata.webp || []) {
      if (generated.width >= originalWidth || generated.size >= originalBytes) {
        if (generated.outputPath) await unlink(generated.outputPath).catch(() => {});
        continue;
      }
      candidates.push(generated);
    }
    return candidates.sort((a, b) => a.width - b.width);
  })();

  variantCache.set(cacheKey, promise);
  return promise;
}

async function transformImage(imgTag, classes, page) {
  const attrs = attributes(imgTag);
  const originalWidth = Number(attrs.width);
  const originalHeight = Number(attrs.height);
  if (!attrs.src || !originalWidth || !originalHeight) {
    throw new Error(`${page}: imagen de galería sin src/width/height`);
  }

  const publicPath = publicImagePath(attrs.src);
  const candidates = await getResponsiveCandidates(sourceFile(publicPath), originalWidth);
  if (candidates.length === 0) return imgTag;

  const srcset = [
    ...candidates.map(candidate => `${candidate.url} ${candidate.width}w`),
    `/${publicPath} ${originalWidth}w`
  ].join(", ");

  return setAttribute(
    setAttribute(imgTag, "srcset", srcset),
    "sizes",
    responsiveSizesFor(page, classes, originalWidth, originalHeight)
  );
}

async function transformGallery(content, page) {
  const itemClass = page === "portafolio.html" ? "gallery-item" : "content-item";
  const pattern = /(<(?:div|article)\b[^>]*class=(['"])([^'"]*)\2[^>]*>)(\s*)(<img\b[^>]*>)/gi;
  const matches = [...content.matchAll(pattern)].filter(match => match[3].split(/\s+/).includes(itemClass));
  if (matches.length === 0) throw new Error(`${page}: no se encontraron imágenes objetivo`);

  let result = "";
  let cursor = 0;
  for (const match of matches) {
    const imageOffset = match.index + match[1].length + match[4].length;
    result += content.slice(cursor, imageOffset);
    result += await transformImage(match[5], match[3].split(/\s+/), page);
    cursor = imageOffset + match[5].length;
  }
  return result + content.slice(cursor);
}

export default function registerResponsiveImages(eleventyConfig) {
  eleventyConfig.on("eleventy.before", () => variantCache.clear());
  eleventyConfig.addTransform("responsive-gallery-images", async function (content) {
    const page = outputKey(this.page?.outputPath);
    if (!page || !TARGET_OUTPUTS.has(page)) return content;
    return transformGallery(content, page);
  });
}
