import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { EXPECTED_TEMPLATE_FILES } from "../config/public-surface.js";

const BASE_COMMIT = "77ba55fb6b7eeb0352a10d276671684034160f65";
const projectRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));
const layoutPath = "src/_includes/layouts/base.njk";
const contactPath = "functions/api/contact.js";
const allowedPaths = new Set([
  ...EXPECTED_TEMPLATE_FILES,
  layoutPath,
  contactPath,
  "package.json",
  "scripts/verify-parity.mjs",
  "scripts/verify-skip-link.mjs",
  "scripts/verify-turnstile-hostname.test.mjs",
  "scripts/verify-f4-scope.mjs",
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

function baseline(path) {
  return git(["show", `${BASE_COMMIT}:${path}`]);
}

const changed = git(["diff", "--name-only", BASE_COMMIT])
  .split(/\r?\n/)
  .filter(Boolean);
const untracked = git(["ls-files", "--others", "--exclude-standard"])
  .split(/\r?\n/)
  .filter(Boolean);
const unexpected = [...new Set([...changed, ...untracked])]
  .filter(path => !allowedPaths.has(path));
assert.deepEqual(unexpected, [], `Archivos fuera de alcance: ${unexpected.join(", ")}`);

for (const path of EXPECTED_TEMPLATE_FILES) {
  const before = baseline(path);
  const current = await readFile(resolve(projectRoot, path), "utf8");
  const mainTags = before.match(/<main\b[^>]*>/gi) ?? [];
  assert.equal(mainTags.length, 1, `${path}: baseline debe tener un único main`);
  const oldTag = mainTags[0];
  const newTag = path === "src/portafolio.njk"
    ? oldTag.replace('id="gallery"', 'id="main-content"')
    : oldTag.replace(/>$/, ' id="main-content">');
  assert.equal(current, before.replace(oldTag, newTag), `${path}: cambio distinto del id de main autorizado`);
}

const skipStyle = `  <style>
    .skip-link {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .skip-link:focus {
      position: fixed;
      top: 1rem;
      left: 1rem;
      z-index: 10000;
      width: auto;
      height: auto;
      padding: 0.75rem 1rem;
      margin: 0;
      overflow: visible;
      clip: auto;
      white-space: normal;
      color: #111;
      background: #fff;
    }
  </style>`;
const beforeLayout = baseline(layoutPath);
const expectedLayout = beforeLayout
  .replace("{% block head %}{% endblock %}\n", `{% block head %}{% endblock %}\n${skipStyle}\n`)
  .replace("<body>\n", '<body>\n  <a class="skip-link" href="#main-content">Saltar al contenido principal</a>\n');
assert.equal(
  await readFile(resolve(projectRoot, layoutPath), "utf8"),
  expectedLayout,
  `${layoutPath}: cambio fuera del skip link global autorizado`
);

const hostnameHelpers = `function normalizarHostnameTurnstile(hostname) {
  if (
    typeof hostname !== 'string' ||
    !hostname ||
    hostname !== hostname.trim()
  ) {
    return null;
  }

  try {
    const url = new URL(\`https://\${hostname}\`);
    const normalizado = hostname.toLowerCase();
    if (
      url.hostname !== normalizado ||
      url.host !== normalizado ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url.hostname;
  } catch {
    return null;
  }
}

function obtenerHostnameEsperado(origin, requestUrl) {
  try {
    return new URL(origin || requestUrl).hostname;
  } catch {
    return null;
  }
}

`;
let normalizedContact = await readFile(resolve(projectRoot, contactPath), "utf8");
normalizedContact = normalizedContact
  .replace(hostnameHelpers, "")
  .replace(
    "async function verificarTurnstile(token, secretKey, ip, hostnameEsperado)",
    "async function verificarTurnstile(token, secretKey, ip)"
  )
  .replace(
    "    return (\n      data.success === true &&\n      Boolean(hostnameEsperado) &&\n      normalizarHostnameTurnstile(data.hostname) === hostnameEsperado\n    );",
    "    return data.success === true;"
  )
  .replace("  const hostnameEsperado = obtenerHostnameEsperado(origin, request.url);\n", "")
  .replace("    ip,\n    hostnameEsperado\n", "    ip\n");
assert.equal(normalizedContact, baseline(contactPath), `${contactPath}: delta distinto de hostname Turnstile`);

const beforePackage = JSON.parse(baseline("package.json"));
const currentPackage = JSON.parse(await readFile(resolve(projectRoot, "package.json"), "utf8"));
for (const script of ["qa:skip-link", "qa:turnstile", "qa:f4", "qa:scope"]) {
  delete currentPackage.scripts[script];
}
currentPackage.scripts.qa = beforePackage.scripts.qa;
assert.deepEqual(currentPackage, beforePackage, "package.json: cambios fuera de scripts QA F4.1");

console.log(`qa:scope PASS (base ${BASE_COMMIT}; código, templates y activos fuera de alcance intactos)`);
