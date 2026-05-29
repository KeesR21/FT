import { db } from "@/lib/db";
import { normalizeEmail } from "@/lib/payment-guards";
import type { Parent, Player } from "@/lib/types";

/** Match roster and portal-login emails: trim/lower plus Gmail/Googlemail dot-insensitive local part. */
export function parentEmailMatchKey(email: string): string {
  const n = normalizeEmail(email);
  const at = n.lastIndexOf("@");
  if (at <= 0) return n;
  const local = n.slice(0, at);
  const domain = n.slice(at + 1).toLowerCase();
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return `${local.replace(/\./g, "")}@${domain}`;
  }
  return n;
}

export type LinkedPlayer = {
  player: Player;
  parent: Parent;
};

/**
 * Look up every academy player whose linked parent record uses the given email
 * (case-insensitive). One academy email can resolve to multiple parent rows
 * (rare, but possible) and to many players.
 */
export async function findLinkedPlayersByEmail(email: string): Promise<{ parents: Parent[]; players: LinkedPlayer[] }> {
  const key = parentEmailMatchKey(email ?? "");
  if (!key) return { parents: [], players: [] };
  const allParents = await db.listParents();
  const matchedParents = allParents.filter((p) => parentEmailMatchKey(p.email ?? "") === key);
  if (matchedParents.length === 0) return { parents: [], players: [] };
  const allPlayers = await db.listPlayers({ includeWithdrawn: true });
  const matchedParentIds = new Set(matchedParents.map((p) => p.id));
  const linked: LinkedPlayer[] = [];
  for (const player of allPlayers) {
    if (!matchedParentIds.has(player.parentId)) continue;
    const parent = matchedParents.find((p) => p.id === player.parentId)!;
    linked.push({ player, parent });
  }
  // Sort active players first, then by name.
  linked.sort((a, b) => {
    if (a.player.status !== b.player.status) return a.player.status === "active" ? -1 : 1;
    return a.player.playerName.localeCompare(b.player.playerName);
  });
  return { parents: matchedParents, players: linked };
}
