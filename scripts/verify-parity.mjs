import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, readdir, readFile, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BASELINE_COMMIT,
  EXPECTED_HTML_FILES,
  EXPECTED_TEMPLATE_FILES,
  PROHIBITED_OUTPUT_ENTRIES,
  ROOT_PUBLIC_FILES
} from "../config/public-surface.js";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const outputRoot = join(projectRoot, "_site");
const allowLegacy = process.argv.slice(2).includes("--allow-legacy");
const unexpectedArguments = process.argv
  .slice(2)
  .filter((argument) => argument !== "--allow-legacy");

if (unexpectedArguments.length) {
  throw new Error(`Unexpected arguments: ${unexpectedArguments.join(", ")}`);
}

function normalizePath(path) {
  return path.split(sep).join("/");
}

function normalizeLineEndings(value) {
  return value.replace(/\r\n?/g, "\n");
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(root) {
  if (!(await pathExists(root))) {
    throw new Error(`Missing directory: ${normalizePath(relative(projectRoot, root))}`);
  }

  const files = [];
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else if (entry.isFile()) {
        files.push(normalizePath(relative(root, absolutePath)));
      } else {
        throw new Error(`Unsupported filesystem entry: ${absolutePath}`);
      }
    }
  }

  await visit(root);
  return files;
}

function assertSameSet(actual, expected, label) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = [...expectedSet].filter((item) => !actualSet.has(item));
  const unexpected = [...actualSet].filter((item) => !expectedSet.has(item));
  if (missing.length || unexpected.length) {
    throw new Error(
      `${label} mismatch. Missing: ${missing.join(", ") || "none"}. ` +
        `Unexpected: ${unexpected.join(", ") || "none"}.`
    );
  }
}

function normalizeTagAttributes(attributes) {
  return attributes.replace(/\s+/g, " ").trim();
}

function canonicalizeJson(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalizeJson);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalizeJson(value[key])])
    );
  }
  return value;
}

function analyzeHtml(html, label) {
  const normalized = normalizeLineEndings(html);
  const styles = [];
  const scripts = [];
  const jsonLd = [];
  let styleIndex = 0;
  let scriptIndex = 0;
  let jsonLdIndex = 0;

  let remainder = normalized.replace(
    /<style\b([^>]*)>([\s\S]*?)<\/style>/gi,
    (_match, attributes, content) => {
      styles.push({ attributes: normalizeTagAttributes(attributes), content });
      return `<parity-style data-index="${styleIndex++}"></parity-style>`;
    }
  );

  remainder = remainder.replace(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
    (_match, attributes, content) => {
      const normalizedAttributes = normalizeTagAttributes(attributes);
      if (/\btype\s*=\s*["']application\/ld\+json["']/i.test(attributes)) {
        let parsed;
        try {
          parsed = JSON.parse(content.trim());
        } catch (error) {
          throw new Error(`${label} contains invalid JSON-LD: ${error.message}`);
        }
        jsonLd.push({
          attributes: normalizedAttributes,
          canonical: JSON.stringify(canonicalizeJson(parsed))
        });
        return `<parity-jsonld data-index="${jsonLdIndex++}"></parity-jsonld>`;
      }

      scripts.push({ attributes: normalizedAttributes, content });
      return `<parity-script data-index="${scriptIndex++}"></parity-script>`;
    }
  );

  const structure = remainder.replace(/>\s+</g, "><").trim();
  const visibleText = remainder
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { styles, scripts, jsonLd, structure, visibleText };
}

async function hashFile(path) {
  const hash = createHash("sha256");
  await new Promise((resolveHash, rejectHash) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", rejectHash);
    stream.on("end", resolveHash);
  });
  return hash.digest("hex");
}

async function assertFilesEqual(sourcePath, outputPath, label) {
  if (!(await pathExists(outputPath))) {
    throw new Error(`Missing output file: ${label}`);
  }
  const [sourceStats, outputStats] = await Promise.all([
    stat(sourcePath),
    stat(outputPath)
  ]);
  if (sourceStats.size !== outputStats.size) {
    throw new Error(`Byte size differs for ${label}`);
  }
  const [sourceHash, outputHash] = await Promise.all([
    hashFile(sourcePath),
    hashFile(outputPath)
  ]);
  if (sourceHash !== outputHash) {
    throw new Error(`Content hash differs for ${label}`);
  }
}

const sourceIntegrityPaths = [
  "img",
  ":(exclude)img/hero-reel-poster.webp",
  ...ROOT_PUBLIC_FILES
];
const sourceDiff = spawnSync(
  "git",
  ["diff", "--exit-code", BASELINE_COMMIT, "--", ...sourceIntegrityPaths],
  { cwd: projectRoot, encoding: "utf8" }
);
if (sourceDiff.error) {
  throw sourceDiff.error;
}
if (sourceDiff.status !== 0) {
  throw new Error(
    `Original media or public root assets differ from ${BASELINE_COMMIT}.\n` +
      [sourceDiff.stdout, sourceDiff.stderr].filter(Boolean).join("\n").trim()
  );
}

const templateFiles = (await listFiles(join(projectRoot, "src")))
  .filter((file) => file.endsWith(".njk") && !file.startsWith("_includes/"))
  .map((file) => `src/${file}`);
const unexpectedTemplates = templateFiles.filter(
  (file) => !EXPECTED_TEMPLATE_FILES.includes(file)
);
if (unexpectedTemplates.length) {
  throw new Error(`Unexpected page templates: ${unexpectedTemplates.join(", ")}`);
}

if (!allowLegacy) {
  assertSameSet(templateFiles, EXPECTED_TEMPLATE_FILES, "Final Nunjucks template set");
  const legacySources = [];
  for (const route of EXPECTED_HTML_FILES) {
    if (await pathExists(join(projectRoot, route))) {
      legacySources.push(route);
    }
  }
  if (legacySources.length) {
    throw new Error(`Legacy HTML sources remain: ${legacySources.join(", ")}`);
  }
  const configSource = await readFile(join(projectRoot, "eleventy.config.js"), "utf8");
  if (/legacyHtml|EXPECTED_HTML_FILES/.test(configSource)) {
    throw new Error("Final Eleventy config still contains legacy HTML passthrough logic");
  }
}

const outputFiles = await listFiles(outputRoot);
const outputHtmlFiles = outputFiles.filter((file) => file.endsWith(".html"));
assertSameSet(outputHtmlFiles, EXPECTED_HTML_FILES, "Public HTML output set");

for (const route of EXPECTED_HTML_FILES) {
  const generatedHtml = await readFile(join(outputRoot, route), "utf8");
  analyzeHtml(generatedHtml, `generated ${route}`);
  if (
    !/^<!DOCTYPE html>/i.test(generatedHtml) ||
    !/<html\b[^>]*\blang="es"/i.test(generatedHtml) ||
    /{%|{#/.test(generatedHtml)
  ) {
    throw new Error(`${route}: documento generado incompleto o con sintaxis de template sin resolver`);
  }
}

for (const entry of PROHIBITED_OUTPUT_ENTRIES) {
  if (await pathExists(join(outputRoot, entry))) {
    throw new Error(`Prohibited output entry found: ${entry}`);
  }
}

for (const file of ROOT_PUBLIC_FILES) {
  await assertFilesEqual(join(projectRoot, file), join(outputRoot, file), file);
}

const sourceImageFiles = await listFiles(join(projectRoot, "img"));
const outputImageFiles = await listFiles(join(outputRoot, "img"));
const outputOriginalImageFiles = outputImageFiles.filter(
  file => !file.startsWith("_responsive/")
);
const responsiveImageFiles = outputImageFiles.filter(
  file => file.startsWith("_responsive/")
);
assertSameSet(outputOriginalImageFiles, sourceImageFiles, "original img/ file set");
for (const file of sourceImageFiles) {
  await assertFilesEqual(
    join(projectRoot, "img", file),
    join(outputRoot, "img", file),
    `img/${file}`
  );
}

const expectedOutputFiles = [
  ...EXPECTED_HTML_FILES,
  ...ROOT_PUBLIC_FILES,
  ...sourceImageFiles.map((file) => `img/${file}`),
  ...responsiveImageFiles.map((file) => `img/${file}`)
];
assertSameSet(outputFiles, expectedOutputFiles, "Complete _site file set");

console.log(
  `Output integrity QA passed: ${EXPECTED_HTML_FILES.length}/${EXPECTED_HTML_FILES.length} HTML, ` +
    `${templateFiles.length} Nunjucks templates, ${outputFiles.length} public files, ` +
    `legacy mode ${allowLegacy ? "allowed" : "disabled"}.`
);
