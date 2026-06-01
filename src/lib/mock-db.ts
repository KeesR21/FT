import { randomUUID } from "crypto";
import { addDays, addMinutes, format, setHours, setMinutes, subDays } from "date-fns";
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
import {
  mergeSiteContentFromDisk,
  mergeStoredSiteContent,
  persistSiteContentSnapshot
} from "@/lib/persist-site-content";
import { withNormalizedGallery } from "@/lib/gallery-normalize";
import { withNormalizedPitchLocations } from "@/lib/locations-normalize";
import { normalizeNewsPosts } from "@/lib/news-posts";
import { normalizeEmail, normalizePhone } from "@/lib/payment-guards";
import { emptyRegistrationProfile } from "@/lib/registration-profile";
import { computePaymentStatus } from "@/lib/utils";
import { isPendingRegistration } from "@/lib/player-roster";
import { normalizeTimetableSession } from "@/lib/timetable-session";

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

/** Stable IDs aligned with `public/uploads/kit-orders/orders.json` + local portal account email. */
const PORTAL_LOCAL_KEES_PARENT_ID = "portal-local-parent-kees-ir";
const PORTAL_LOCAL_KEES_PLAYER_ID = "df69a63a-2f07-48c3-a66d-dc656534ec3a";

/**
 * When `USE_MOCK_DB=true` and `MOCK_DB_SEED_DEMO` is unset, the in-memory DB starts empty —
 * but kit orders / parent portal files still reference this player. Merge these rows so
 * `findLinkedPlayersByEmail("keesr21@gmail.com")` resolves again (nothing was deleted from disk).
 */
function ensureKeesPortalLinkedRows() {
  const now = new Date();
  const par: Parent = {
    id: PORTAL_LOCAL_KEES_PARENT_ID,
    parentName: "Kees Ir",
    phoneNumber: "+250788352160",
    email: "keesr21@gmail.com",
    address: ""
  };
  const pl: Player = {
    id: PORTAL_LOCAL_KEES_PLAYER_ID,
    playerName: "Kees Jr",
    dateOfBirth: subDays(now, 7 * 365).toISOString().slice(0, 10),
    ageGroup: "U9",
    heightCm: 125,
    weightKg: 24,
    status: "active",
    registrationStatus: "approved",
    parentId: par.id,
    developmentNotes: "Local mock row — keep in sync with kit order fixtures.",
    subscriptionValidUntil: addDays(now, 45).toISOString(),
    createdAt: subDays(now, 20).toISOString()
  };
  if (!parents.some((p) => p.id === par.id)) parents.push(par);
  if (!players.some((p) => p.id === pl.id)) players.push(pl);
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
    normalizeTimetableSession({
      id: "sess-1",
      title: "U9 Training",
      ageGroup: "U9",
      ageGroups: ["U9"],
      kind: "training",
      startsAt: addDays(now, 1).toISOString(),
      endsAt: addDays(now, 1.08).toISOString(),
      locationName: "Main Academy Pitch",
      kitRequirements: "Blue kit, shin guards",
      trainerName: "Coach Amara",
      activities: ["Ball mastery", "Passing patterns", "Small-sided games"],
      sessionObjectives: "First touch under pressure and quick combination play.",
      equipmentNotes: "Cones, bibs, size 4 balls",
      instructorNotes: "Parents: arrive 10 minutes early for briefing.",
      isUpdated: false,
      updatedAt: null
    }),
    normalizeTimetableSession({
      id: "sess-2",
      title: "U14A Training",
      ageGroup: "U14A",
      ageGroups: ["U14A"],
      kind: "training",
      startsAt: addDays(now, 2).toISOString(),
      endsAt: addDays(now, 2.1).toISOString(),
      locationName: "Lion Arena",
      kitRequirements: "Full kit",
      trainerName: "Coach Jean-Pierre",
      activities: ["Pressing triggers", "Transition to attack"],
      sessionObjectives: "Compact defending and fast counter-attacks.",
      equipmentNotes: "Goals, ladders",
      instructorNotes: "",
      isUpdated: true,
      updatedAt: subDays(now, 1).toISOString()
    }),
    normalizeTimetableSession({
      id: "sess-3",
      title: "U9 Match",
      ageGroup: "U9",
      ageGroups: ["U9"],
      kind: "match",
      startsAt: addDays(now, 5).toISOString(),
      endsAt: addDays(now, 5.12).toISOString(),
      locationName: "Regional Stadium",
      kitRequirements: "Away strip",
      trainerName: "Coach Amara",
      activities: ["Match play"],
      sessionObjectives: "Apply weekly themes in a competitive fixture.",
      equipmentNotes: "",
      instructorNotes: "Meet at south entrance.",
      isUpdated: false,
      updatedAt: null
    })
  );
  _mock.seeded = true;
}

/** June 2026, day-of-month (1 = Mon 1 Jun) → ISO start/end for schedule UI preview. */
function june2026Slot(day: number, hour: number, minute: number, durationMinutes: number) {
  const start = setMinutes(setHours(new Date(2026, 5, day), hour), minute);
  const end = addMinutes(start, durationMinutes);
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}

/**
 * Sample timetable for the first week of June 2026 (Mon 1 – Sun 7).
 * Loaded whenever the in-memory mock DB is used so /schedule can be previewed without admin setup.
 */
function seedSchedulePreview() {
  if (sessions.some((s) => s.id.startsWith("sess-june-"))) return;

  sessions.push(
    normalizeTimetableSession({
      id: "sess-june-1",
      title: "U7 Training",
      ageGroup: "U7",
      ageGroups: ["U7"],
      kind: "training",
      ...june2026Slot(1, 16, 0, 60),
      locationName: "Main Academy Pitch",
      kitRequirements: "Red kit, shin guards, water bottle",
      trainerName: "Coach Léa",
      activities: ["Coordination ladders", "1v1 dribbling", "Fun finishing games"],
      sessionObjectives: "Close control and confidence on the ball in tight spaces.",
      equipmentNotes: "Flat cones, pinnies, size 3 balls",
      instructorNotes: "",
      isUpdated: false,
      updatedAt: null
    }),
    normalizeTimetableSession({
      id: "sess-june-2",
      title: "U11 Training",
      ageGroup: "U11",
      ageGroups: ["U11"],
      kind: "training",
      ...june2026Slot(1, 17, 30, 90),
      locationName: "Lion Arena",
      kitRequirements: "Home kit, shin guards",
      trainerName: "Coach Marcus",
      activities: ["Rondo possession", "Wide overloads", "8v8 with conditions"],
      sessionObjectives: "Switch play quickly and support wide attacks.",
      equipmentNotes: "Bibs, mannequins, size 4 balls",
      instructorNotes: "Pitch B if main pitch is wet.",
      isUpdated: true,
      updatedAt: new Date(2026, 4, 28, 10, 0, 0).toISOString()
    }),
    normalizeTimetableSession({
      id: "sess-june-3",
      title: "U9 Training",
      ageGroup: "U9",
      ageGroups: ["U9"],
      kind: "training",
      ...june2026Slot(2, 16, 0, 90),
      locationName: "Main Academy Pitch",
      kitRequirements: "Blue kit, shin guards",
      trainerName: "Coach Amara",
      activities: ["Ball mastery circuit", "Passing patterns", "Small-sided games"],
      sessionObjectives: "First touch away from pressure and quick combination play.",
      equipmentNotes: "Cones, bibs, size 4 balls",
      instructorNotes: "",
      isUpdated: false,
      updatedAt: null
    }),
    normalizeTimetableSession({
      id: "sess-june-4",
      title: "U14A · U14B Training",
      ageGroup: "U14A",
      ageGroups: ["U14A", "U14B"],
      kind: "training",
      ...june2026Slot(3, 18, 0, 90),
      locationName: "Lion Arena",
      kitRequirements: "Full kit, long socks",
      trainerName: "Coach Jean-Pierre",
      activities: ["Pressing triggers", "Build-up patterns", "Phase of play — attack"],
      sessionObjectives: "Compact shape when defending; fast vertical passes in transition.",
      equipmentNotes: "Full-size goals, ladders, hurdles",
      instructorNotes: "Joint session — squads split for finishing.",
      isUpdated: false,
      updatedAt: null
    }),
    normalizeTimetableSession({
      id: "sess-june-5",
      title: "U16 Training",
      ageGroup: "U16",
      ageGroups: ["U16"],
      kind: "training",
      ...june2026Slot(4, 17, 0, 90),
      locationName: "Training ground B",
      kitRequirements: "Training top, shorts, boots",
      trainerName: "Coach David",
      activities: ["Set-piece routines", "Defensive unit shape", "Conditioned 11v11"],
      sessionObjectives: "Organised defending from set plays and rest defence.",
      equipmentNotes: "Corner flags, poles",
      instructorNotes: "",
      isUpdated: false,
      updatedAt: null
    }),
    normalizeTimetableSession({
      id: "sess-june-6",
      title: "U14B Match",
      ageGroup: "U14B",
      ageGroups: ["U14B"],
      kind: "match",
      ...june2026Slot(5, 15, 0, 100),
      locationName: "Regional Stadium",
      kitRequirements: "Away strip, white socks",
      trainerName: "Coach Jean-Pierre",
      activities: ["Warm-up", "Team talk", "Match play"],
      sessionObjectives: "Apply weekly pressing themes in a competitive fixture.",
      equipmentNotes: "",
      instructorNotes: "Meet 45 minutes before kick-off at south entrance.",
      isUpdated: false,
      updatedAt: null
    }),
    normalizeTimetableSession({
      id: "sess-june-7",
      title: "U9 Match",
      ageGroup: "U9",
      ageGroups: ["U9"],
      kind: "match",
      ...june2026Slot(6, 10, 0, 90),
      locationName: "Main Academy Pitch",
      kitRequirements: "Home kit, shin guards",
      trainerName: "Coach Amara",
      activities: ["Activation", "Match play"],
      sessionObjectives: "Encourage positive play and respect for officials.",
      equipmentNotes: "Match balls provided",
      instructorNotes: "Parents: no coaching from the sideline.",
      isUpdated: false,
      updatedAt: null
    }),
    normalizeTimetableSession({
      id: "sess-june-8",
      title: "U18 Training",
      ageGroup: "U18",
      ageGroups: ["U18"],
      kind: "training",
      ...june2026Slot(6, 14, 0, 120),
      locationName: "Lion Arena",
      kitRequirements: "Full kit",
      trainerName: "Coach André",
      activities: ["Video review (15 min)", "Position-specific blocks", "High-intensity small-sided"],
      sessionObjectives: "Decision-making in the final third under fatigue.",
      equipmentNotes: "GPS vests, heart-rate monitors",
      instructorNotes: "Senior squad — late finish expected.",
      isUpdated: false,
      updatedAt: null
    }),
    normalizeTimetableSession({
      id: "sess-june-9",
      title: "U11 Training",
      ageGroup: "U11",
      ageGroups: ["U11"],
      kind: "training",
      ...june2026Slot(7, 9, 0, 75),
      locationName: "Indoor hall",
      kitRequirements: "Indoor shoes, shin guards",
      trainerName: "Coach Marcus",
      activities: ["Futsal principles", "Quick passing", "Rotating 4v4"],
      sessionObjectives: "Tight control and scanning in a smaller space.",
      equipmentNotes: "Futsal balls, rebound boards",
      instructorNotes: "Sunday recovery session — optional for trialists.",
      isUpdated: false,
      updatedAt: null
    })
  );
}

/**
 * Demo data (Eric, David, the invoice-demo parents/players, etc.) used to be created on
 * every server start. That was useful early on but kept re-injecting inconsistent test
 * rows (e.g. David Ndayisaba with a 45-day-future subscription + a stale "Monthly fee — April"
 * invoice). To start with a truly clean slate set `MOCK_DB_SEED_DEMO=1` in `.env.local`,
 * otherwise the in-memory DB starts empty.
 */
if (process.env.MOCK_DB_SEED_DEMO === "1") {
  seed();
  ensureInvoiceDemoRows();
} else {
  _mock.seeded = true;
}

seedSchedulePreview();

/**
 * Wipe every entity managed by the in-memory mock DB.
 *
 * - `reseed: true` (default) → restore the demo dataset (matches old behaviour).
 * - `reseed: false` → leave everything empty (used by the admin "wipe players" action so
 *   the dashboard truly starts blank for testing).
 *
 * `keep` lets callers preserve specific subsystems (timetable sessions in particular —
 * they’re not player-scoped and clearing them would also blow away the schedule UI).
 */
export function resetMockDb(opts?: {
  reseed?: boolean;
  keep?: { sessions?: boolean };
}) {
  const reseed = opts?.reseed ?? true;
  const keepSessions = Boolean(opts?.keep?.sessions);
  parents.splice(0, parents.length);
  players.splice(0, players.length);
  payments.splice(0, payments.length);
  if (!keepSessions) sessions.splice(0, sessions.length);
  performanceEntries.splice(0, performanceEntries.length);
  messages.splice(0, messages.length);
  _mock.seeded = false;
  if (reseed) {
    seed();
    ensureInvoiceDemoRows();
    ensureKeesPortalLinkedRows();
  } else {
    _mock.seeded = true;
  }
  seedSchedulePreview();
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
    if (payment.status === "paid" && payment.paidAt) {
      return { ...payment };
    }
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
    if (!ageGroup) return [...sessions];
    return sessions.filter((s) => s.ageGroup === ageGroup || s.ageGroups.includes(ageGroup));
  },

  getSession(id: string) {
    return sessions.find((s) => s.id === id) ?? null;
  },

  createSession(input: Omit<TimetableSession, "id">) {
    const session = normalizeTimetableSession({ ...input, id: randomUUID() });
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
    return mergeStoredSiteContent(siteContent);
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
    return mergeStoredSiteContent(siteContent);
  }
};
