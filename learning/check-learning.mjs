#!/usr/bin/env node
/**
 * Keeps the learning path honest. Run from the repo root: node learning/check-learning.mjs
 *
 *  1. Every module's reference code in the learn-vim-sdk skill is identical to the
 *     matching section of the reference solution — so the course can't teach code
 *     that CI hasn't built and tested.
 *  2. The starter and the solution export the same functions from vim-client.ts —
 *     so every stub a learner fills in matches what the solution provides.
 *  3. Apart from vim-client.ts (and identity files), the two apps are identical —
 *     so each module really does change only one file.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const STARTER = 'learning/starter';
const SOLUTION = 'learning/reference-solution';
const MODULES = 'plugins/vim-app-builder/skills/learn-vim-sdk/references';
const CLIENT = 'src/lib/vim-client.ts';
// Files allowed to differ between starter and solution.
const MAY_DIFFER = new Set([CLIENT, 'package.json', 'package-lock.json', 'README.md', 'CLAUDE.md']);
const SKIP_DIRS = new Set(['node_modules', '.next']);

const errors = [];
const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

// ── 1. Module reference code matches the solution ──────────────────────────
const solutionClient = read(join(SOLUTION, CLIENT));
const sections = new Map();
for (const part of solutionClient.split(/^\/\/ ─── /m)) {
  const m = part.match(/^MODULE (\d)/);
  if (m) sections.set(Number(m[1]), ('// ─── ' + part).trimEnd());
}
if (sections.size === 0) errors.push(`no "// ─── MODULE N" sections found in ${SOLUTION}/${CLIENT}`);

const moduleFiles = readdirSync(MODULES).filter((f) => /^module-\d/.test(f));
for (const [n, code] of sections) {
  const file = moduleFiles.find((f) => f.startsWith(`module-${n}-`));
  if (!file) { errors.push(`module ${n}: no reference file in ${MODULES}`); continue; }
  const blocks = [...read(join(MODULES, file)).matchAll(/```typescript\n([\s\S]*?)```/g)].map((b) => b[1].trimEnd());
  if (!blocks.includes(code)) errors.push(`module ${n}: the reference code in ${file} doesn't match ${SOLUTION}/${CLIENT}`);
}

// ── 2. Starter and solution export the same functions ──────────────────────
const exportsOf = (src) => new Set([...src.matchAll(/^export (?:async )?function (\w+)/gm)].map((m) => m[1]));
const starterExports = exportsOf(read(join(STARTER, CLIENT)));
const solutionExports = exportsOf(solutionClient);
for (const name of solutionExports) if (!starterExports.has(name)) errors.push(`starter is missing the stub for ${name}()`);
for (const name of starterExports) if (!solutionExports.has(name)) errors.push(`starter exports ${name}(), which the solution doesn't`);

// ── 3. Everything else is identical ────────────────────────────────────────
function walk(root, dir = root, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(root, full, out);
    else out.push(relative(root, full));
  }
  return out;
}
const starterFiles = new Set(walk(STARTER).filter((f) => !f.endsWith('.tsbuildinfo')));
const solutionFiles = new Set(walk(SOLUTION).filter((f) => !f.endsWith('.tsbuildinfo')));
for (const f of new Set([...starterFiles, ...solutionFiles])) {
  if (MAY_DIFFER.has(f)) continue;
  if (!starterFiles.has(f)) { errors.push(`${f} is in the solution but not the starter`); continue; }
  if (!solutionFiles.has(f)) { errors.push(`${f} is in the starter but not the solution`); continue; }
  if (read(join(STARTER, f)) !== read(join(SOLUTION, f))) errors.push(`${f} differs between starter and solution`);
}

if (errors.length) {
  console.error('learning path is out of sync:\n  - ' + errors.join('\n  - '));
  process.exit(1);
}
console.log(`learning path in sync — ${sections.size} modules match, ${solutionExports.size} functions stubbed, shared files identical`);
