import { randomUUID } from "crypto";
import { addDays, format, subDays } from "date-fns";
import type {
  AdminMessage,
  Parent,
  Payment,
  PerformanceEntry,
  Player,
  RegistrationProfile,
  RegistrationStatus,
  SiteContent,
  TimetableSession,
  VerifyPaymentExtras
} from "@/lib/types";
import { buildDefaultSiteContent } from "./default-site-content";
import { mergeSiteContentFromDisk, persistSiteContentSnapshot } from "@/lib/persist-site-content";
import { withNormalizedGallery } from "@/lib/gallery-normalize";
import { withNormalizedPitchLocations } from "@/lib/locations-normalize";
import { normalizeNewsPosts } from "@/lib/news-posts";
import { normalizeEmail, normalizePhone } from "@/lib/payment-guards";
import { emptyRegistrationProfile } from "@/lib/registration-profile";
import { computePaymentStatus } from "@/lib/utils";
import { isPendingRegistration } from "@/lib/player-roster";

/**
 * In dev, Next may re-evaluate this module on navigation/HMR. Module-level `[]` would reset all data.
 * Keep mutable mock data on `globalThis` so payment approvals persist across route reloads (until process restart).
 */
const MOCK_GLOBAL_KEY = "__ftprLionsAcademyMockDb";

type MockDbGlobal = {
  parents: Parent[];
  players: Player[];
  payments: Payment[];
  sessions: TimetableSession[];
  performanceEntries: PerformanceEntry[];
  messages: AdminMessage[];
  seeded: boolean;
};

function getMockGlobal(): MockDbGlobal {
  const g = globalThis as unknown as Record<string, MockDbGlobal | undefined>;
  if (!g[MOCK_GLOBAL_KEY]) {
    g[MOCK_GLOBAL_KEY] = {
      parents: [],
      players: [],
      payments: [],
      sessions: [],
      performanceEntries: [],
      messages: [],
      seeded: false
    };
  }
  return g[MOCK_GLOBAL_KEY]!;
}

const _mock = getMockGlobal();
const parents = _mock.parents;
const players = _mock.players;
const payments = _mock.payments;
const sessions = _mock.sessions;
const performanceEntries = _mock.performanceEntries;
const messages = _mock.messages;

const DEFAULT_SITE_CONTENT = buildDefaultSiteContent();

const siteContent: SiteContent = mergeSiteContentFromDisk(DEFAULT_SITE_CONTENT);

function persistSiteContentNow() {
  persistSiteContentSnapshot(JSON.parse(JSON.stringify(siteContent)) as SiteContent);
}

/** Shared demo rows for subscription invoice testing (membership ends in 0–5 days). */
function buildInvoiceDemoEntities(now: Date): { parents: Parent[]; players: Player[] } {
  const p4: Parent = {
    id: "seed-parent-4",
    parentName: "Marie Kayitesi",
    phoneNumber: "+250 780 777 888",
    email: "invoice.demo.parent1@example.com",
    address: "Kigali, Remera"
  };
  const p5: Parent = {
    id: "seed-parent-5",
    parentName: "Thierry Bizimana",
    phoneNumber: "+250 780 888 999",
    email: "invoice.demo.parent2@example.com",
    address: "Kigali, Kimironko"
  };
  const p6: Parent = {
    id: "seed-parent-6",
    parentName: "Claudine Mukamazimpaka",
    phoneNumber: "+250 780 111 333",
    email: "invoice.demo.parent3@example.com",
    address: "Kigali, Gikondo"
  };
  const p7: Parent = {
    id: "seed-parent-7",
    parentName: "Emmanuel Ntawangundi",
    phoneNumber: "+250 780 222 444",
    email: "invoice.demo.parent4@example.com",
    address: "Kigali, Nyamirambo"
  };
  const p8: Parent = {
    id: "seed-parent-8",
    parentName: "Sandrine Uwera",
    phoneNumber: "+250 780 333 555",
    email: "invoice.demo.parent5@example.com",
    address: "Kigali, Kacyiru"
  };
  const plInvoiceDemo1: Player = {
    id: "seed-player-invoice-demo-1",
    playerName: "Leo Niyonkuru",
    dateOfBirth: subDays(now, 10 * 365).toISOString().slice(0, 10),
    ageGroup: "U11",
    heightCm: 145,
    weightKg: 38,
    status: "active",
    registrationStatus: "approved",
    parentId: p4.id,
    developmentNotes: "Seed data for invoice UI testing.",
    subscriptionValidUntil: addDays(now, 3).toISOString(),
    createdAt: subDays(now, 90).toISOString()
  };
  const plInvoiceDemo2: Player = {
    id: "seed-player-invoice-demo-2",
    playerName: "Noah Hategekimana",
    dateOfBirth: subDays(now, 13 * 365).toISOString().slice(0, 10),
    ageGroup: "U13",
    heightCm: 162,
    weightKg: 52,
    status: "active",
    registrationStatus: "approved",
    parentId: p5.id,
    developmentNotes: "Seed data for invoice UI testing.",
    subscriptionValidUntil: addDays(now, 5).toISOString(),
    createdAt: subDays(now, 120).toISOString()
  };
  const plInvoiceDemo3: Player = {
    id: "seed-player-invoice-demo-3",
    playerName: "Ivan Mutesi",
    dateOfBirth: subDays(now, 8 * 365).toISOString().slice(0, 10),
    ageGroup: "U9",
    heightCm: 130,
    weightKg: 27,
    status: "active",
    registrationStatus: "approved",
    parentId: p6.id,
    developmentNotes: "Seed data for invoice UI testing.",
    subscriptionValidUntil: addDays(now, 0).toISOString(),
    createdAt: subDays(now, 30).toISOString()
  };
  const plInvoiceDemo4: Player = {
    id: "seed-player-invoice-demo-4",
    playerName: "Emma Ingabire",
    dateOfBirth: subDays(now, 14 * 365).toISOString().slice(0, 10),
    ageGroup: "U14A",
    heightCm: 160,
    weightKg: 50,
    status: "active",
    registrationStatus: "approved",
    parentId: p7.id,
    developmentNotes: "Seed data for invoice UI testing.",
    subscriptionValidUntil: addDays(now, 1).toISOString(),
    createdAt: subDays(now, 75).toISOString()
  };
  const plInvoiceDemo5: Player = {
    id: "seed-player-invoice-demo-5",
    playerName: "Joel Ndayishimiye",
    dateOfBirth: subDays(now, 11 * 365).toISOString().slice(0, 10),
    ageGroup: "U11",
    heightCm: 148,
    weightKg: 40,
    status: "active",
    registrationStatus: "approved",
    parentId: p8.id,
    developmentNotes: "Seed data for invoice UI testing.",
    subscriptionValidUntil: addDays(now, 4).toISOString(),
    createdAt: subDays(now, 100).toISOString()
  };
  return {
    parents: [p4, p5, p6, p7, p8],
    players: [plInvoiceDemo1, plInvoiceDemo2, plInvoiceDemo3, plInvoiceDemo4, plInvoiceDemo5]
  };
}

/**
 * Mock DB seeds only once per Node process. After we add new seed rows, dev servers that
 * already ran `seed()` would miss them unless we merge missing rows on each load.
 */
function ensureInvoiceDemoRows() {
  const now = new Date();
  const inv = buildInvoiceDemoEntities(now);
  for (const par of inv.parents) {
    if (!parents.some((p) => p.id === par.id)) parents.push(par);
  }
  for (const pl of inv.players) {
    if (!players.some((p) => p.id === pl.id)) players.push(pl);
  }
}

function seed() {
  if (_mock.seeded) return;
  const now = new Date();
  const p1: Parent = {
    id: "seed-parent-1",
    parentName: "Jean Mukamana",
    phoneNumber: "+250 780 111 222",
    email: "parent1@example.com",
    address: "Kigali, Gasabo"
  };
  const p2: Parent = {
    id: "seed-parent-2",
    parentName: "Paul Nkurunziza",
    phoneNumber: "+250 780 333 444",
    email: "parent2@example.com",
    address: "Kigali, Nyarugenge"
  };
  const p3: Parent = {
    id: "seed-parent-3",
    parentName: "Grace Uwimana",
    phoneNumber: "+250 780 555 666",
    email: "parent3@example.com",
    address: "Kigali, Kicukiro"
  };
  const invDemo = buildInvoiceDemoEntities(now);
  parents.push(p1, p2, p3, ...invDemo.parents);

  const plActive: Player = {
    id: "seed-player-1",
    playerName: "Eric Habimana",
    dateOfBirth: subDays(now, 9 * 365).toISOString().slice(0, 10),
    ageGroup: "U9",
    heightCm: 132,
    weightKg: 28,
    status: "active",
    registrationStatus: "approved",
    parentId: p1.id,
    developmentNotes: "Strong finisher; work on weak foot.",
    subscriptionValidUntil: addDays(now, 20).toISOString(),
    createdAt: subDays(now, 60).toISOString()
  };
  const plActive2: Player = {
    id: "seed-player-2",
    playerName: "David Ndayisaba",
    dateOfBirth: subDays(now, 12 * 365).toISOString().slice(0, 10),
    ageGroup: "U14A",
    heightCm: 158,
    weightKg: 48,
    status: "active",
    registrationStatus: "approved",
    parentId: p2.id,
    subscriptionValidUntil: addDays(now, 45).toISOString(),
    createdAt: subDays(now, 45).toISOString()
  };
  const plWithdrawn: Player = {
    id: "seed-player-3",
    playerName: "Samuel Irakoze",
    dateOfBirth: subDays(now, 11 * 365).toISOString().slice(0, 10),
    ageGroup: "U11",
    heightCm: 142,
    weightKg: 36,
    status: "withdrawn",
    registrationStatus: "approved",
    parentId: p3.id,
    withdrawnAt: subDays(now, 30).toISOString(),
    subscriptionValidUntil: subDays(now, 10).toISOString(),
    createdAt: subDays(now, 180).toISOString()
  };
  const pendingProfile: RegistrationProfile = {
    nationality: "Rwandan",
    position: "midfielder",
    preferredFoot: "right",
    previousClub: "",
    parentRelationship: "father",
    emergencyContactName: "Claire Mukamana",
    emergencyContactPhone: "+250 780 999 888",
    medicalInfo: "None",
    howHeard: "friend"
  };
  const plPending: Player = {
    id: "seed-player-4",
    playerName: "New Applicant",
    dateOfBirth: subDays(now, 8 * 365).toISOString().slice(0, 10),
    ageGroup: "U9",
    heightCm: 128,
    weightKg: 26,
    status: "active",
    registrationStatus: "pending",
    parentId: p1.id,
    registrationProfile: pendingProfile,
    createdAt: subDays(now, 2).toISOString()
  };
  players.push(plActive, plActive2, plWithdrawn, plPending, ...invDemo.players);

  payments.push(
    {
      id: "pay-1",
      playerId: plActive.id,
      amount: 45000,
      currency: "RWF",
      paymentFor: "Monthly fee — March",
      dueDate: subDays(now, 5).toISOString(),
      paidAt: subDays(now, 6).toISOString(),
      status: "paid",
      verifiedBy: "admin"
    },
    {
      id: "pay-2",
      playerId: plActive2.id,
      amount: 50000,
      currency: "RWF",
      paymentFor: "Monthly fee — April",
      dueDate: addDays(now, 2).toISOString(),
      status: computePaymentStatus(addDays(now, 2).toISOString(), undefined, "not_paid")
    },
    {
      id: "pay-3",
      playerId: plWithdrawn.id,
      amount: 45000,
      currency: "RWF",
      paymentFor: `Monthly fee — ${format(subDays(now, 40), "LLLL")}`,
      dueDate: subDays(now, 40).toISOString(),
      paidAt: subDays(now, 41).toISOString(),
      status: "paid"
    },
    {
      id: "pay-reg-pending-applicant",
      playerId: plPending.id,
      amount: 45000,
      currency: "RWF",
      paymentFor: "Registration fee",
      dueDate: subDays(now, 1).toISOString(),
      paidAt: subDays(now, 2).toISOString(),
      status: "paid",
      verifiedBy: "admin"
    }
  );

  performanceEntries.push(
    {
      id: "perf-1",
      playerId: plActive.id,
      date: subDays(now, 7).toISOString(),
      notes: "Excellent pressing; completed 2 goals in small-sided game.",
      focusArea: "Tactical awareness"
    },
    {
      id: "perf-2",
      playerId: plActive.id,
      date: subDays(now, 21).toISOString(),
      notes: "Improved first touch under pressure.",
      focusArea: "Technical"
    }
  );

  messages.push({
    id: "msg-1",
    createdAt: subDays(now, 1).toISOString(),
    channel: "group",
    ageGroup: "U9",
    subject: "Pitch change Tuesday",
    body: "U9 session moved to Lion Arena this week.",
    sentBy: "Academy admin"
  });

  sessions.push(
    {
      id: "sess-1",
      title: "U9 Training",
      ageGroup: "U9",
      kind: "training",
      startsAt: addDays(now, 1).toISOString(),
      endsAt: addDays(now, 1.08).toISOString(),
      locationName: "Main Academy Pitch",
      kitRequirements: "Blue kit, shin guards",
      isUpdated: false,
      updatedAt: null
    },
    {
      id: "sess-2",
      title: "U14A Training",
      ageGroup: "U14A",
      kind: "training",
      startsAt: addDays(now, 2).toISOString(),
      endsAt: addDays(now, 2.1).toISOString(),
      locationName: "Lion Arena",
      kitRequirements: "Full kit",
      isUpdated: true,
      updatedAt: subDays(now, 1).toISOString()
    },
    {
      id: "sess-3",
      title: "U9 Match",
      ageGroup: "U9",
      kind: "match",
      startsAt: addDays(now, 5).toISOString(),
      endsAt: addDays(now, 5.12).toISOString(),
      locationName: "Regional Stadium",
      kitRequirements: "Away strip",
      isUpdated: false,
      updatedAt: null
    }
  );
  _mock.seeded = true;
}

seed();
ensureInvoiceDemoRows();

export function resetMockDb() {
  parents.splice(0, parents.length);
  players.splice(0, players.length);
  payments.splice(0, payments.length);
  sessions.splice(0, sessions.length);
  performanceEntries.splice(0, performanceEntries.length);
  messages.splice(0, messages.length);
  _mock.seeded = false;
  seed();
}

export const db = {
  createRegistration(input: Omit<Player, "id" | "registrationStatus" | "status" | "parentId"> & { parent: Omit<Parent, "id"> }) {
    const normalizedEmail = normalizeEmail(input.parent.email);
    const normalizedPhone = normalizePhone(input.parent.phoneNumber);
    const existingParent = parents.find((p) => {
      const byEmail = normalizeEmail(p.email) === normalizedEmail;
      const byPhone = normalizedPhone.length > 0 && normalizePhone(p.phoneNumber) === normalizedPhone;
      return byEmail || byPhone;
    });
    const parent: Parent = existingParent
      ? Object.assign(existingParent, {
          parentName: input.parent.parentName,
          phoneNumber: input.parent.phoneNumber,
          email: normalizedEmail,
          address: input.parent.address
        })
      : { ...input.parent, email: normalizedEmail, id: randomUUID() };
    if (!existingParent) {
      parents.push(parent);
    }
    const duplicatePlayer = players.find(
      (p) =>
        p.parentId === parent.id &&
        p.dateOfBirth.slice(0, 10) === input.dateOfBirth.slice(0, 10) &&
        p.playerName.trim().toLowerCase() === input.playerName.trim().toLowerCase()
    );
    if (duplicatePlayer) {
      throw new Error("Player already registered under this parent.");
    }
    const player: Player = {
      id: randomUUID(),
      playerName: input.playerName,
      dateOfBirth: input.dateOfBirth,
      ageGroup: input.ageGroup,
      heightCm: input.heightCm,
      weightKg: input.weightKg,
      parentId: parent.id,
      registrationStatus: "pending",
      status: "active",
      developmentNotes: input.developmentNotes,
      registrationProfile: input.registrationProfile,
      subscriptionValidUntil: input.subscriptionValidUntil,
      createdAt: new Date().toISOString()
    };
    players.push(player);
    return { player, parent };
  },

  createRosterPlayersFromNames(input: { rows: Array<{ playerName: string; ageGroup: string }> }) {
    const created: Player[] = [];
    const skippedNames: string[] = [];
    for (const rowInput of input.rows) {
      const playerName = rowInput.playerName.trim();
      if (!playerName) continue;
      const duplicate = players.some((p) => p.playerName.trim().toLowerCase() === playerName.toLowerCase());
      if (duplicate) {
        skippedNames.push(playerName);
        continue;
      }
      const stamp = Date.now().toString(36);
      const idSuffix = Math.random().toString(36).slice(2, 7);
      const parent: Parent = {
        id: randomUUID(),
        parentName: "Unknown guardian",
        phoneNumber: "",
        email: `import-${stamp}-${idSuffix}@placeholder.local`,
        address: ""
      };
      parents.push(parent);
      const player: Player = {
        id: randomUUID(),
        playerName,
        dateOfBirth: "2014-01-01",
        ageGroup: rowInput.ageGroup,
        heightCm: 140,
        weightKg: 35,
        parentId: parent.id,
        registrationStatus: "pending",
        status: "active",
        developmentNotes: "Imported from roster CSV. Complete profile details.",
        registrationProfile: emptyRegistrationProfile(),
        createdAt: new Date().toISOString()
      };
      players.push(player);
      created.push(player);
    }
    return { created, skippedNames };
  },

  listPlayers(opts?: { includeWithdrawn?: boolean; group?: string; registration?: RegistrationStatus | "all" }) {
    let list = [...players];
    if (!opts?.includeWithdrawn) list = list.filter((p) => p.status !== "withdrawn");
    if (opts?.group) list = list.filter((p) => p.ageGroup === opts.group);
    if (opts?.registration && opts.registration !== "all") {
      list = list.filter((p) => p.registrationStatus === opts.registration);
    }
    return list;
  },

  getPlayer(id: string) {
    return players.find((p) => p.id === id) ?? null;
  },

  updatePlayer(id: string, patch: Partial<Omit<Player, "id">>) {
    const p = players.find((x) => x.id === id);
    if (!p) return null;
    Object.assign(p, patch);
    return p;
  },

  withdrawPlayer(id: string) {
    const p = players.find((x) => x.id === id);
    if (!p) return null;
    p.status = "withdrawn";
    p.withdrawnAt = new Date().toISOString();
    return p;
  },

  updateParent(parentId: string, patch: Partial<Omit<Parent, "id">>) {
    const par = parents.find((x) => x.id === parentId);
    if (!par) return null;
    Object.assign(par, patch);
    return par;
  },

  updateRegistrationStatus(id: string, status: RegistrationStatus) {
    const player = players.find((p) => p.id === id);
    if (!player) return null;
    player.registrationStatus = status;
    /* Membership dates are set when monthly membership is paid/approved, not on admission. */
    return player;
  },

  listParents() {
    return [...parents];
  },

  listPayments() {
    return payments.map((p) => ({ ...p, status: computePaymentStatus(p.dueDate, p.paidAt, p.status) }));
  },

  getPayment(id: string) {
    const p = payments.find((x) => x.id === id);
    if (!p) return null;
    return { ...p, status: computePaymentStatus(p.dueDate, p.paidAt, p.status) };
  },

  listPaymentsForPlayer(playerId: string) {
    return this.listPayments().filter((p) => p.playerId === playerId);
  },

  createPayment(input: Omit<Payment, "id" | "status">) {
    const payment: Payment = {
      ...input,
      id: randomUUID(),
      status: computePaymentStatus(input.dueDate, input.paidAt, "not_paid")
    };
    payments.push(payment);
    return payment;
  },

  updatePayment(id: string, patch: Partial<Omit<Payment, "id" | "playerId">>) {
    const payment = payments.find((p) => p.id === id);
    if (!payment) return null;
    const paidLocked =
      payment.status === "paid" &&
      Boolean(payment.paidAt) &&
      patch.status === undefined &&
      patch.paidAt === undefined;
    Object.assign(payment, patch);
    const computed = computePaymentStatus(payment.dueDate, payment.paidAt, payment.status);
    payment.status = paidLocked && computed !== "paid" ? "paid" : computed;
    return payment;
  },

  verifyPayment(id: string, verifiedBy: string, extras?: VerifyPaymentExtras) {
    const payment = payments.find((p) => p.id === id);
    if (!payment) return null;
    payment.paidAt = new Date().toISOString();
    payment.status = "paid";
    payment.verifiedBy = verifiedBy;
    if (extras) {
      if (extras.paymentMethod !== undefined) payment.paymentMethod = extras.paymentMethod;
      if (extras.paymentNotes !== undefined) payment.paymentNotes = extras.paymentNotes;
      if (extras.mobileMoneyRef !== undefined) payment.mobileMoneyRef = extras.mobileMoneyRef;
    }
    return { ...payment };
  },

  listSessions(ageGroup?: string) {
    return ageGroup ? sessions.filter((s) => s.ageGroup === ageGroup) : [...sessions];
  },

  getSession(id: string) {
    return sessions.find((s) => s.id === id) ?? null;
  },

  createSession(input: Omit<TimetableSession, "id">) {
    const session = { ...input, id: randomUUID() };
    sessions.push(session);
    return session;
  },

  updateSession(id: string, patch: Partial<Omit<TimetableSession, "id">>) {
    const s = sessions.find((x) => x.id === id);
    if (!s) return null;
    Object.assign(s, patch);
    return s;
  },

  deleteSession(id: string) {
    const i = sessions.findIndex((x) => x.id === id);
    if (i === -1) return false;
    sessions.splice(i, 1);
    return true;
  },

  getParentByPlayerId(playerId: string) {
    const player = players.find((p) => p.id === playerId);
    if (!player) return null;
    return parents.find((p) => p.id === player.parentId) ?? null;
  },

  listPerformance(playerId: string) {
    return performanceEntries.filter((e) => e.playerId === playerId);
  },

  addPerformance(input: Omit<PerformanceEntry, "id">) {
    const row: PerformanceEntry = { ...input, id: randomUUID() };
    performanceEntries.push(row);
    return row;
  },

  adminShellSummary() {
    const openInvoicesCount = this.listPayments().filter((p) => p.status !== "paid").length;
    return {
      pendingApplications: players.filter(isPendingRegistration).length,
      messageCount: messages.length,
      openInvoicesCount
    };
  },

  listMessages() {
    return [...messages].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  addMessage(input: Omit<AdminMessage, "id" | "createdAt">) {
    const row: AdminMessage = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString()
    };
    messages.push(row);
    return row;
  },

  getSiteContent(): SiteContent {
    const out: SiteContent = {
      academyInfo: siteContent.academyInfo,
      contactBlurb: siteContent.contactBlurb,
      homeWelcomePill: siteContent.homeWelcomePill,
      homeHeroHeading: siteContent.homeHeroHeading,
      homeHeroImage: siteContent.homeHeroImage,
      homeHeroImages: { ...siteContent.homeHeroImages },
      homeSectionImages: { ...siteContent.homeSectionImages },
      homeHighlightItems: siteContent.homeHighlightItems.map((x) => ({ ...x })),
      homeCounters: siteContent.homeCounters.map((x) => ({ ...x })),
      homeCoachTitle: siteContent.homeCoachTitle,
      homeCoachBody: siteContent.homeCoachBody,
      homeEliteTitle: siteContent.homeEliteTitle,
      homeEliteBody: siteContent.homeEliteBody,
      homeMatchTitle: siteContent.homeMatchTitle,
      homeMatchDescription: siteContent.homeMatchDescription,
      homeTimetableTitle: siteContent.homeTimetableTitle,
      homeTimetableDescription: siteContent.homeTimetableDescription,
      homeDevelopmentLabel: siteContent.homeDevelopmentLabel,
      homeDevelopmentPercent: siteContent.homeDevelopmentPercent,
      homeParentSatisfactionLabel: siteContent.homeParentSatisfactionLabel,
      homeParentSatisfactionPercent: siteContent.homeParentSatisfactionPercent,
      homeTestimonial: { ...siteContent.homeTestimonial },
      homeFaqItems: siteContent.homeFaqItems.map((x) => ({ ...x })),
      homePathTitle: siteContent.homePathTitle,
      homePathLead: siteContent.homePathLead,
      homePathTeams: [...siteContent.homePathTeams],
      homeTrainingTitle: siteContent.homeTrainingTitle,
      homeTrainingLead: siteContent.homeTrainingLead,
      homeJoinTitle: siteContent.homeJoinTitle,
      homeJoinLead: siteContent.homeJoinLead,
      homeJoinButtonLabel: siteContent.homeJoinButtonLabel,
      schedulePagePill: siteContent.schedulePagePill,
      scheduleHeroImage: siteContent.scheduleHeroImage,
      schedulePageTitle: siteContent.schedulePageTitle,
      schedulePageLead: siteContent.schedulePageLead,
      scheduleTimelineTitle: siteContent.scheduleTimelineTitle,
      scheduleTimelineLead: siteContent.scheduleTimelineLead,
      scheduleLocationTitle: siteContent.scheduleLocationTitle,
      scheduleLocationLead: siteContent.scheduleLocationLead,
      scheduleLocationImage: siteContent.scheduleLocationImage,
      scheduleParentBlurb: siteContent.scheduleParentBlurb,
      aboutPagePill: siteContent.aboutPagePill,
      aboutPageTitle: siteContent.aboutPageTitle,
      aboutHeroImage: siteContent.aboutHeroImage,
      aboutPageLead: siteContent.aboutPageLead,
      aboutVisionTitle: siteContent.aboutVisionTitle,
      aboutGalleryItems: siteContent.aboutGalleryItems.map((x) => ({ ...x })),
      aboutValuesTitle: siteContent.aboutValuesTitle,
      aboutPageImage: siteContent.aboutPageImage,
      aboutSplitTitle: siteContent.aboutSplitTitle,
      aboutSplitLead: siteContent.aboutSplitLead,
      aboutTiles: siteContent.aboutTiles.map((x) => ({ ...x })),
      aboutCtaTitle: siteContent.aboutCtaTitle,
      aboutCtaLead: siteContent.aboutCtaLead,
      programsPagePill: siteContent.programsPagePill,
      programsHeroImage: siteContent.programsHeroImage,
      programsPageTitle: siteContent.programsPageTitle,
      programsPageLead: siteContent.programsPageLead,
      programsSpotlightTitle: siteContent.programsSpotlightTitle,
      programsSpotlightLead: siteContent.programsSpotlightLead,
      programsSpotlightItems: siteContent.programsSpotlightItems.map((x) => ({ ...x })),
      programsPathwayTitle: siteContent.programsPathwayTitle,
      programsPathwayBlurb: siteContent.programsPathwayBlurb,
      programsPathwayLineTitle: siteContent.programsPathwayLineTitle,
      programsPathwayLineLead: siteContent.programsPathwayLineLead,
      programsPathwayLineScrollLabel: siteContent.programsPathwayLineScrollLabel,
      programsPathwayLineItems: siteContent.programsPathwayLineItems.map((x) => ({ ...x })),
      programGroups: siteContent.programGroups.map((x) => ({ ...x })),
      programsSideImage: siteContent.programsSideImage,
      programsSplitTitle: siteContent.programsSplitTitle,
      programsSplitLead: siteContent.programsSplitLead,
      programsCtaTitle: siteContent.programsCtaTitle,
      programsCtaLead: siteContent.programsCtaLead,
      ourTeamPageTitle: siteContent.ourTeamPageTitle,
      ourTeamPageLead: siteContent.ourTeamPageLead,
      teamMembers: siteContent.teamMembers.map((x) => ({ ...x })),
      newsPageTitle: siteContent.newsPageTitle,
      newsPageLead: siteContent.newsPageLead,
      newsPosts: siteContent.newsPosts.map((x) => ({ ...x })),
      eventsPageTitle: siteContent.eventsPageTitle,
      eventsPageLead: siteContent.eventsPageLead,
      events: siteContent.events.map((x) => ({ ...x })),
      galleryPageTitle: siteContent.galleryPageTitle,
      galleryPageLead: siteContent.galleryPageLead,
      galleryAlbums: siteContent.galleryAlbums.map((a) => ({
        ...a,
        images: a.images.map((im) => ({ ...im }))
      })),
      locationPageTitle: siteContent.locationPageTitle,
      locationPageLead: siteContent.locationPageLead,
      pitchLocations: siteContent.pitchLocations.map((p) => ({ ...p })),
      locationMapEmbedUrl: siteContent.locationMapEmbedUrl,
      locationAddressLine: siteContent.locationAddressLine,
      contactPageLead: siteContent.contactPageLead,
      contactOfficeHours: siteContent.contactOfficeHours
    };
    return withNormalizedPitchLocations(withNormalizedGallery(out));
  },

  updateSiteContent(patch: Partial<SiteContent>) {
    (Object.keys(patch) as (keyof SiteContent)[]).forEach((k) => {
      const v = patch[k];
      if (v === undefined) return;
      if (Array.isArray(v)) {
        (siteContent as Record<string, unknown>)[k] = v.map((item: unknown) =>
          item && typeof item === "object" ? { ...(item as Record<string, unknown>) } : item
        );
      } else {
        (siteContent as Record<string, unknown>)[k] = v;
      }
    });
    siteContent.newsPosts = normalizeNewsPosts(siteContent.newsPosts);
    persistSiteContentNow();
    return siteContent;
  }
};
