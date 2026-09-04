import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, readdir, stat } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  BASELINE_COMMIT,
  PROHIBITED_OUTPUT_ENTRIES,
  PROJECT_HTML_FILES,
  PUBLIC_DIRECTORIES,
  ROOT_HTML_FILES,
  ROOT_PUBLIC_FILES
} from "../config/public-surface.js";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const outputRoot = join(projectRoot, "_site");

function normalizePath(path) {
  return path.split(sep).join("/");
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

const sourcePathsCheckedAgainstGit = [
  ...ROOT_HTML_FILES,
  ...ROOT_PUBLIC_FILES,
  ...PUBLIC_DIRECTORIES,
  "functions"
];
const gitDiff = spawnSync(
  "git",
  ["diff", "--exit-code", BASELINE_COMMIT, "--", ...sourcePathsCheckedAgainstGit],
  { cwd: projectRoot, encoding: "utf8" }
);

if (gitDiff.error) {
  throw gitDiff.error;
}
if (gitDiff.status !== 0) {
  const details = [gitDiff.stdout, gitDiff.stderr].filter(Boolean).join("\n").trim();
  throw new Error(
    `Public sources or functions differ from baseline ${BASELINE_COMMIT}.` +
      (details ? `\n${details}` : "")
  );
}

if (!(await pathExists(outputRoot))) {
  throw new Error("Missing _site. Run the build before parity QA.");
}

const outputFiles = await listFiles(outputRoot);
const outputHtmlFiles = outputFiles.filter((file) => file.endsWith(".html"));
const expectedHtmlFiles = [...ROOT_HTML_FILES, ...PROJECT_HTML_FILES];
assertSameSet(outputHtmlFiles, expectedHtmlFiles, "Public HTML set");

for (const entry of PROHIBITED_OUTPUT_ENTRIES) {
  if (await pathExists(join(outputRoot, entry))) {
    throw new Error(`Prohibited output entry found: ${entry}`);
  }
}

for (const file of [...ROOT_HTML_FILES, ...ROOT_PUBLIC_FILES]) {
  await assertFilesEqual(join(projectRoot, file), join(outputRoot, file), file);
}

const expectedOutputFiles = [...ROOT_HTML_FILES, ...ROOT_PUBLIC_FILES];
for (const directory of PUBLIC_DIRECTORIES) {
  const sourceDirectory = join(projectRoot, directory);
  const outputDirectory = join(outputRoot, directory);
  const sourceFiles = await listFiles(sourceDirectory);
  const copiedFiles = await listFiles(outputDirectory);
  assertSameSet(copiedFiles, sourceFiles, `${directory}/ file set`);

  for (const file of sourceFiles) {
    const outputRelativePath = `${directory}/${file}`;
    expectedOutputFiles.push(outputRelativePath);
    await assertFilesEqual(
      join(sourceDirectory, file),
      join(outputDirectory, file),
      outputRelativePath
    );
  }
}

assertSameSet(outputFiles, expectedOutputFiles, "Complete _site file set");

console.log(
  `SETUP-0.1 parity QA passed: ${expectedHtmlFiles.length}/` +
    `${expectedHtmlFiles.length} HTML files and ${outputFiles.length} total public files verified.`
);
