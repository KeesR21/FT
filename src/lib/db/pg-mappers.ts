import type {
  AdminMessage,
  Parent,
  Payment,
  PerformanceEntry,
  Player,
  RegistrationStatus,
  TimetableSession
} from "@/lib/types";
import { parseRegistrationProfileRow } from "@/lib/registration-profile";
import { computePaymentStatus } from "@/lib/utils";

export type ParentRow = {
  id: string;
  parent_name: string;
  phone_number: string;
  email: string;
  address: string;
  created_at: string;
};

export type PlayerRow = {
  id: string;
  parent_id: string;
  player_name: string;
  date_of_birth: string;
  age_group: string;
  height_cm: number;
  weight_kg: number;
  profile_photo_url: string | null;
  status: Player["status"];
  registration_status: RegistrationStatus;
  development_notes: string | null;
  registration_profile?: unknown;
  subscription_valid_until: string | null;
  withdrawn_at: string | null;
  created_at: string;
};

export type PaymentRow = {
  id: string;
  player_id: string;
  amount: number;
  currency: string;
  payment_for: string;
  paid_at: string | null;
  due_date: string;
  status: Payment["status"];
  payment_method: Payment["paymentMethod"] | null;
  payment_notes: string | null;
  mobile_money_ref: string | null;
  proof_url: string | null;
  invoice_sent_at: string | null;
  verified_by_label: string | null;
  created_at: string;
};

export type SessionRow = {
  id: string;
  title: string;
  age_group: string;
  kind: TimetableSession["kind"];
  starts_at: string;
  ends_at: string;
  location_name: string;
  kit_requirements: string;
  is_updated: boolean;
  updated_at: string | null;
  created_at: string;
};

export type PerformanceRow = {
  id: string;
  player_id: string;
  happened_on: string;
  notes: string;
  focus_area: string | null;
  created_at: string;
};

export type MessageRow = {
  id: string;
  created_at: string;
  channel: AdminMessage["channel"];
  player_id: string | null;
  age_group: string | null;
  subject: string;
  body: string;
  sent_by: string;
};

export function rowToParent(r: ParentRow): Parent {
  return {
    id: r.id,
    parentName: r.parent_name,
    phoneNumber: r.phone_number,
    email: r.email,
    address: r.address
  };
}

export function rowToPlayer(r: PlayerRow): Player {
  return {
    id: r.id,
    parentId: r.parent_id,
    playerName: r.player_name,
    dateOfBirth: r.date_of_birth,
    ageGroup: r.age_group,
    heightCm: Number(r.height_cm),
    weightKg: Number(r.weight_kg),
    profilePhotoUrl: r.profile_photo_url ?? undefined,
    status: r.status,
    registrationStatus: r.registration_status,
    developmentNotes: r.development_notes ?? undefined,
    subscriptionValidUntil: r.subscription_valid_until ?? undefined,
    createdAt: r.created_at,
    withdrawnAt: r.withdrawn_at ?? undefined,
    registrationProfile: parseRegistrationProfileRow(r.registration_profile)
  };
}

export function rowToPayment(r: PaymentRow): Payment {
  const paidAt = r.paid_at ?? undefined;
  const status = computePaymentStatus(r.due_date, paidAt, r.status);
  return {
    id: r.id,
    playerId: r.player_id,
    amount: Number(r.amount),
    currency: r.currency,
    paymentFor: r.payment_for,
    dueDate: r.due_date,
    paidAt,
    status,
    paymentMethod: r.payment_method ?? undefined,
    paymentNotes: r.payment_notes ?? undefined,
    mobileMoneyRef: r.mobile_money_ref ?? undefined,
    proofUrl: r.proof_url ?? undefined,
    invoiceSentAt: r.invoice_sent_at ?? undefined,
    verifiedBy: r.verified_by_label ?? undefined
  };
}

export function rowToSession(r: SessionRow): TimetableSession {
  return {
    id: r.id,
    title: r.title || "",
    ageGroup: r.age_group,
    kind: r.kind,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    locationName: r.location_name,
    kitRequirements: r.kit_requirements,
    isUpdated: r.is_updated,
    updatedAt: r.updated_at
  };
}

export function rowToPerformance(r: PerformanceRow): PerformanceEntry {
  return {
    id: r.id,
    playerId: r.player_id,
    date: r.happened_on,
    notes: r.notes,
    focusArea: r.focus_area ?? undefined
  };
}

export function rowToMessage(r: MessageRow): AdminMessage {
  return {
    id: r.id,
    createdAt: r.created_at,
    channel: r.channel,
    playerId: r.player_id ?? undefined,
    ageGroup: r.age_group ?? undefined,
    subject: r.subject,
    body: r.body,
    sentBy: r.sent_by
  };
}

export function dateOnly(iso: string): string {
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
}

export function sessionToInsert(input: Omit<TimetableSession, "id">) {
  return {
    title: input.title,
    age_group: input.ageGroup,
    kind: input.kind,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    location_name: input.locationName,
    kit_requirements: input.kitRequirements,
    is_updated: input.isUpdated,
    updated_at: input.updatedAt
  };
}

export function sessionPatchToRow(patch: Partial<Omit<TimetableSession, "id">>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.title !== undefined) out.title = patch.title;
  if (patch.ageGroup !== undefined) out.age_group = patch.ageGroup;
  if (patch.kind !== undefined) out.kind = patch.kind;
  if (patch.startsAt !== undefined) out.starts_at = patch.startsAt;
  if (patch.endsAt !== undefined) out.ends_at = patch.endsAt;
  if (patch.locationName !== undefined) out.location_name = patch.locationName;
  if (patch.kitRequirements !== undefined) out.kit_requirements = patch.kitRequirements;
  if (patch.isUpdated !== undefined) out.is_updated = patch.isUpdated;
  if (patch.updatedAt !== undefined) out.updated_at = patch.updatedAt;
  return out;
}
