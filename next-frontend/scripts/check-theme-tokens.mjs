#!/usr/bin/env node
/**
 * Guards the theming contract in app/globals.css.
 *
 * Figma is the source of truth: Light lives in `:root`, Dark in
 * `@media (prefers-color-scheme: dark)`, and both must stay in lockstep.
 * `npx shadcn add` rewrites cssVars and — with baseColor "neutral" — happily
 * reintroduces an oklch palette plus a `.dark` block. This catches that.
 *
 * Usage: node scripts/check-theme-tokens.mjs
 * Exits 1 on any violation.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const CSS = join(dirname(fileURLToPath(import.meta.url)), "..", "app", "globals.css");
const src = readFileSync(CSS, "utf8");
const errors = [];

/** Returns the body of the first `{...}` block starting at or after `from`. */
function body(from) {
  const open = src.indexOf("{", from);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(open + 1, i);
  }
  return "";
}

const declarations = (block) => [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]);

const rootMatch = /^:root \{/m.exec(src);
const mediaMatch = /^@media \(prefers-color-scheme: dark\) \{/m.exec(src);

if (!rootMatch) errors.push("`:root` block not found.");
if (!mediaMatch) errors.push("`@media (prefers-color-scheme: dark)` block not found.");

if (rootMatch && mediaMatch) {
  const light = declarations(body(rootMatch.index));
  const dark = declarations(body(src.indexOf(":root", mediaMatch.index)));

  // --radius is shape, not color: it is intentionally light-only.
  const lightKeys = light.map(([k]) => k).filter((k) => k !== "--radius");
  const darkKeys = dark.map(([k]) => k);

  for (const k of lightKeys) if (!darkKeys.includes(k)) errors.push(`\`${k}\` declared in :root but missing from the dark block.`);
  for (const k of darkKeys) if (!lightKeys.includes(k)) errors.push(`\`${k}\` declared in the dark block but missing from :root.`);

  if (lightKeys.length === darkKeys.length && lightKeys.join() !== darkKeys.join()) {
    errors.push("Both blocks declare the same keys but in a different order — keep them aligned so drift stays visible in a diff.");
  }

  const HEX = /^#[0-9a-f]{6}([0-9a-f]{2})?$/;
  for (const [k, v] of [...light, ...dark]) {
    if (k === "--radius") continue;
    if (!HEX.test(v)) errors.push(`\`${k}: ${v}\` — theme colors must be 6- or 8-digit lowercase hex (no oklch, no shorthand).`);
  }
}

if (/^\s*\.dark\b/m.test(src)) {
  errors.push("A `.dark` class block is present. Dark mode is driven by `prefers-color-scheme` only.");
}
if (/@custom-variant\s+dark/.test(src)) {
  errors.push("`@custom-variant dark` overrides Tailwind's default `dark` variant and would decouple `dark:` utilities from the @media block.");
}

if (errors.length) {
  console.error("globals.css theming contract violated:\n");
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error("\nSee the policy comment at the top of app/globals.css.");
  process.exit(1);
}
console.log("✓ globals.css theming contract OK");
