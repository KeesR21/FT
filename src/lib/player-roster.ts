import type { Player } from "@/lib/types";

/** Awaiting admin decision on registration. */
export function isPendingRegistration(p: Player): boolean {
  return p.registrationStatus === "pending";
}

/** Registration approved by admin (may still be rejected in data model — excluded). */
export function isRegistrationApproved(p: Player): boolean {
  return p.registrationStatus === "approved";
}

/** On the active roster: approved and not withdrawn. Subscription expiry does not remove a player from this count. */
export function isApprovedOnRoster(p: Player): boolean {
  return p.registrationStatus === "approved" && p.status === "active";
}

export function isWithdrawnPlayer(p: Player): boolean {
  return p.status === "withdrawn";
}
