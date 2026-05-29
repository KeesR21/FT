import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

const KEYLEN = 64;
const SALT_BYTES = 16;
const ENCODING_PREFIX = "scrypt$";

/**
 * Hash a password using scrypt (Node built-in). Output format:
 *   `scrypt$<saltHex>$<derivedHex>`
 * No external dependency is required and the algorithm is memory-hard, suitable
 * for the medium-strength passwords used by parents.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password) throw new Error("Password is required");
  const salt = randomBytes(SALT_BYTES);
  const derived = await scryptAsync(password, salt, KEYLEN);
  return `${ENCODING_PREFIX}${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!password || !stored) return false;
  if (!stored.startsWith(ENCODING_PREFIX)) return false;
  const [, saltHex, derivedHex] = stored.split("$");
  if (!saltHex || !derivedHex) return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, "hex");
    expected = Buffer.from(derivedHex, "hex");
  } catch {
    return false;
  }
  if (expected.length !== KEYLEN) return false;
  let actual: Buffer;
  try {
    actual = await scryptAsync(password, salt, KEYLEN);
  } catch {
    return false;
  }
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
