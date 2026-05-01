const DEFAULT_CURRENCY = "RWF";

/** Consistent academy-wide money display (whole RWF, grouped digits). */
export function formatAcademyMoney(amount: number, currency: string = DEFAULT_CURRENCY): string {
  const n = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat("en-RW", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    }).format(n);
  } catch {
    return `${n.toLocaleString("en-RW")} ${currency}`;
  }
}

export function formatShortDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = iso.slice(0, 10);
  return d;
}

export function paymentCategoryLabel(paymentFor: string): "Registration" | "Membership" | "Other" {
  if (/registration/i.test(paymentFor)) return "Registration";
  if (/membership|monthly/i.test(paymentFor)) return "Membership";
  return "Other";
}

export function paymentCategoryKey(paymentFor: string): "registration" | "membership" | "other" {
  if (/registration/i.test(paymentFor)) return "registration";
  if (/membership|monthly/i.test(paymentFor)) return "membership";
  return "other";
}
