import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_COMMIT = "18cd142ec16711d66a88da1e945d0e1aa0e75aa5";
const projectRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));
const allowedPaths = new Set([
  "package.json",
  "scripts/verify-compliance-gates.mjs",
  "scripts/verify-f4-scope.mjs",
  "scripts/verify-hero-videos.mjs",
  "scripts/verify-parity.mjs",
  "scripts/verify-skip-link.mjs",
  "scripts/verify-turnstile-hostname.test.mjs",
  "docs/IMPLEMENTATION_STATE.md"
]);

function git(args) {
  const result = spawnSync("git", args, {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim()}`);
  }
  return result.stdout;
}

const changed = git(["diff", "--name-only", BASE_COMMIT])
  .split(/\r?\n/)
  .filter(Boolean);
const untracked = git(["ls-files", "--others", "--exclude-standard"])
  .split(/\r?\n/)
  .filter(Boolean);
const touched = [...new Set([...changed, ...untracked])];
const unexpected = touched.filter((path) => !allowedPaths.has(path));

assert.deepEqual(unexpected, [], `Archivos fuera de alcance: ${unexpected.join(", ")}`);
assert.ok(touched.length > 0, "La compuerta F4.2A esperaba cambios locales o comprometidos");
assert.equal(
  touched.some((path) => path === "package-lock.json"),
  false,
  "package-lock.json debe permanecer intacto"
);

console.log(
  `qa:scope PASS (base ${BASE_COMMIT}; ${touched.length} paths limitados a package/scripts/docs)`
);
