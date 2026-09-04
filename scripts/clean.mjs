import { rm } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

const projectRoot = resolve(process.cwd());
const outputDirectory = resolve(projectRoot, "_site");

if (
  dirname(outputDirectory) !== projectRoot ||
  basename(outputDirectory) !== "_site"
) {
  throw new Error(`Refusing to remove unsafe path: ${outputDirectory}`);
}

await rm(outputDirectory, { recursive: true, force: true });
