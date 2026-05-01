/**
 * Builds src/lib/nationality-allowlist.json from world-countries (ISO dataset).
 * Run: node scripts/build-nationality-allowlist.mjs
 *
 * Keep `normalize()` aligned with `normalizeNationalityKey` in src/lib/nationality-lookup.ts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import countries from "world-countries";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function normalize(s) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

/** Skip ISO-style alpha codes in altSpellings (e.g. RW, RWA) but keep USA, UAE-style if present */
function shouldSkipAltSpelling(s) {
  const t = s.trim();
  if (t.length !== 2 && t.length !== 3) return false;
  return /^[A-Za-z]+$/.test(t);
}

const keys = new Set();

function add(s) {
  if (!s || typeof s !== "string") return;
  const t = s.trim();
  if (t.length < 2) return;
  keys.add(normalize(t));
}

for (const c of countries) {
  add(c.name.common);
  add(c.name.official);
  const eng = c.demonyms?.eng;
  if (eng) {
    add(eng.f);
    add(eng.m);
  }
  for (const alt of c.altSpellings ?? []) {
    if (shouldSkipAltSpelling(alt)) continue;
    add(alt);
  }
}

/** Common abbreviations not kept from ISO alt spellings (we skip 2–3 letter codes there). */
for (const x of ["USA", "UK", "UAE"]) {
  add(x);
}

const arr = [...keys].filter(Boolean).sort((a, b) => a.localeCompare(b));
const outPath = path.join(__dirname, "..", "src", "lib", "nationality-allowlist.json");
fs.writeFileSync(outPath, JSON.stringify(arr), "utf8");
console.log("Wrote", arr.length, "normalized nationality/country keys to", outPath);
