export type PasswordValidation = { ok: true } | { ok: false; reason: string };

/**
 * Medium-strength rules — friendly for parents, but still safe:
 *   - 8+ characters
 *   - at least one letter and one number
 *
 * Safe to import from Client Components (no Node crypto).
 */
export function validatePasswordStrength(password: string): PasswordValidation {
  if (typeof password !== "string" || password.length < 8) {
    return { ok: false, reason: "Password must be at least 8 characters." };
  }
  if (!/[A-Za-z]/.test(password)) {
    return { ok: false, reason: "Password must include at least one letter." };
  }
  if (!/\d/.test(password)) {
    return { ok: false, reason: "Password must include at least one number." };
  }
  return { ok: true };
}
