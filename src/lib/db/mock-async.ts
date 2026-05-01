import type { AppDb } from "@/lib/db/types";
import { db as mockDbSync } from "@/lib/mock-db";

type Mock = typeof mockDbSync;

/** Wraps the synchronous in-memory store as the same async API as Supabase. */
export function wrapMockDb(m: Mock): AppDb {
  return {
    createRegistration: async (input) => m.createRegistration(input),
    createRosterPlayersFromNames: async (input) => m.createRosterPlayersFromNames(input),
    listPlayers: async (opts) => m.listPlayers(opts),
    getPlayer: async (id) => m.getPlayer(id),
    updatePlayer: async (id, patch) => m.updatePlayer(id, patch),
    withdrawPlayer: async (id) => m.withdrawPlayer(id),
    updateParent: async (parentId, patch) => m.updateParent(parentId, patch),
    updateRegistrationStatus: async (id, status) => m.updateRegistrationStatus(id, status),
    listParents: async () => m.listParents(),
    listPayments: async () => m.listPayments(),
    getPayment: async (id) => m.getPayment(id),
    listPaymentsForPlayer: async (playerId) => m.listPaymentsForPlayer(playerId),
    createPayment: async (input) => m.createPayment(input),
    updatePayment: async (id, patch) => m.updatePayment(id, patch),
    verifyPayment: async (id, verifiedByLabel, extras) => m.verifyPayment(id, verifiedByLabel, extras),
    listSessions: async (ageGroup) => m.listSessions(ageGroup),
    getSession: async (id) => m.getSession(id),
    createSession: async (input) => m.createSession(input),
    updateSession: async (id, patch) => m.updateSession(id, patch),
    deleteSession: async (id) => m.deleteSession(id),
    getParentByPlayerId: async (playerId) => m.getParentByPlayerId(playerId),
    listPerformance: async (playerId) => m.listPerformance(playerId),
    addPerformance: async (input) => m.addPerformance(input),
    listMessages: async () => m.listMessages(),
    addMessage: async (input) => m.addMessage(input),
    adminShellSummary: async () => m.adminShellSummary(),
    getSiteContent: async () => m.getSiteContent(),
    updateSiteContent: async (patch) => m.updateSiteContent(patch)
  };
}
