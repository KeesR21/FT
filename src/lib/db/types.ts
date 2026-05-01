import type {
  AdminMessage,
  Parent,
  Payment,
  PerformanceEntry,
  Player,
  RegistrationStatus,
  SiteContent,
  TimetableSession,
  VerifyPaymentExtras
} from "@/lib/types";

export type ListPlayersOpts = {
  includeWithdrawn?: boolean;
  group?: string;
  registration?: RegistrationStatus | "all";
};

/** Lightweight counts for admin chrome (nav badges) — avoid loading full rosters. */
export type AdminShellSummary = {
  pendingApplications: number;
  messageCount: number;
  /** Invoices not yet paid (unpaid, pending review, overdue, etc.) — matches finance “open” queues. */
  openInvoicesCount: number;
};

/** Async data layer used by API routes and server components (Supabase or mock). */
export type AppDb = {
  createRegistration(
    input: Omit<Player, "id" | "registrationStatus" | "status" | "parentId"> & {
      parent: Omit<Parent, "id">;
    }
  ): Promise<{ player: Player; parent: Parent }>;
  createRosterPlayersFromNames(input: { rows: Array<{ playerName: string; ageGroup: string }> }): Promise<{
    created: Player[];
    skippedNames: string[];
  }>;

  listPlayers(opts?: ListPlayersOpts): Promise<Player[]>;
  getPlayer(id: string): Promise<Player | null>;
  updatePlayer(id: string, patch: Partial<Omit<Player, "id">>): Promise<Player | null>;
  withdrawPlayer(id: string): Promise<Player | null>;
  updateParent(parentId: string, patch: Partial<Omit<Parent, "id">>): Promise<Parent | null>;
  updateRegistrationStatus(id: string, status: RegistrationStatus): Promise<Player | null>;
  listParents(): Promise<Parent[]>;
  listPayments(): Promise<Payment[]>;
  getPayment(id: string): Promise<Payment | null>;
  listPaymentsForPlayer(playerId: string): Promise<Payment[]>;
  createPayment(input: Omit<Payment, "id" | "status">): Promise<Payment>;
  updatePayment(id: string, patch: Partial<Omit<Payment, "id" | "playerId">>): Promise<Payment | null>;
  verifyPayment(id: string, verifiedByLabel: string, extras?: VerifyPaymentExtras): Promise<Payment | null>;
  listSessions(ageGroup?: string): Promise<TimetableSession[]>;
  getSession(id: string): Promise<TimetableSession | null>;
  createSession(input: Omit<TimetableSession, "id">): Promise<TimetableSession>;
  updateSession(id: string, patch: Partial<Omit<TimetableSession, "id">>): Promise<TimetableSession | null>;
  deleteSession(id: string): Promise<boolean>;
  getParentByPlayerId(playerId: string): Promise<Parent | null>;
  listPerformance(playerId: string): Promise<PerformanceEntry[]>;
  addPerformance(input: Omit<PerformanceEntry, "id">): Promise<PerformanceEntry>;
  listMessages(): Promise<AdminMessage[]>;
  addMessage(input: Omit<AdminMessage, "id" | "createdAt">): Promise<AdminMessage>;
  adminShellSummary(): Promise<AdminShellSummary>;
  getSiteContent(): Promise<SiteContent>;
  updateSiteContent(patch: Partial<SiteContent>): Promise<SiteContent>;
};
