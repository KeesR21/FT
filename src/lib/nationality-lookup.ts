import allowlist from "./nationality-allowlist.json";

const ALLOWED = new Set(allowlist as string[]);

/**
 * Normalized key for matching user input to the ISO-derived allowlist.
 * Must stay in sync with `scripts/build-nationality-allowlist.mjs`.
 */
export function normalizeNationalityKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

/** True if `input` matches a known English country name or demonym (ISO / mledoze dataset). */
export function isAllowedNationalityOrCountry(input: string): boolean {
  return ALLOWED.has(normalizeNationalityKey(input));
}
