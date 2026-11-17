// Copy-rules check: the Kiro hook equivalent for this repo.
// Scans user-facing source (app, components, lib) for the two house rules:
//   1. Simple hyphens only, never an em dash or en dash.
//   2. No defining a thing by its opposite.
// Run with: npm run check:copy
// Exit code 1 when any violation is found.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["app", "components", "lib"];
const EM_DASH = /[\u2014\u2013]/;
const OPPOSITE_DEFINITION =
  /[A-Za-z][A-Za-z' ]{2,},\s+not\s+(?!only\b)(?!sure\b)(?![a-z]+ing\b)[a-z][a-z' ]{1,}/g;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

let failures = 0;

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const text = readFileSync(file, "utf-8");
    const lines = text.split("\n");
    lines.forEach((line, index) => {
      if (EM_DASH.test(line)) {
        failures += 1;
        console.log(`${file}:${index + 1}: em dash found: ${line.trim()}`);
      }
      for (const match of line.matchAll(OPPOSITE_DEFINITION)) {
        failures += 1;
        console.log(
          `${file}:${index + 1}: opposite-definition found: ${match[0].trim()}`,
        );
      }
    });
  }
}

if (failures > 0) {
  console.log(`\n${failures} copy-rule violation(s). Fix them and run again.`);
  process.exit(1);
}
console.log("Copy rules pass: no em dashes, no opposite definitions.");
