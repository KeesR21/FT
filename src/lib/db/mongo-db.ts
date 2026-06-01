import { Types } from "mongoose";
import { connectMongo } from "@/lib/db/mongo-client";
import {
  MessageModel,
  ParentModel,
  PaymentModel,
  PerformanceModel,
  PlayerModel,
  SessionModel,
  SiteConfigModel
} from "@/lib/db/mongo-models";
import { mergeStoredSiteContent, withNormalizedNewsPosts } from "@/lib/persist-site-content";
import { withNormalizedGallery } from "@/lib/gallery-normalize";
import { withNormalizedPitchLocations } from "@/lib/locations-normalize";
import { normalizeEmail, normalizePhone } from "@/lib/payment-guards";
import { emptyRegistrationProfile, parseRegistrationProfileRow } from "@/lib/registration-profile";
import { normalizeTimetableSession, parseStringArray } from "@/lib/timetable-session";
import { computePaymentStatus } from "@/lib/utils";
import type { AdminMessage, Parent, Payment, PerformanceEntry, Player, SiteContent, TimetableSession, VerifyPaymentExtras } from "@/lib/types";
import type { AdminShellSummary, AppDb, ListPlayersOpts } from "./types";

// ── helpers ───────────────────────────────────────────────────────────────────

type MongoDoc = Record<string, unknown> & { _id?: unknown };

function docId(doc: MongoDoc): string {
  return String(doc._id ?? "");
}

function toParent(doc: MongoDoc): Parent {
  return {
    id: docId(doc),
    parentName: String(doc.parent_name ?? ""),
    phoneNumber: String(doc.phone_number ?? ""),
    email: String(doc.email ?? ""),
    address: String(doc.address ?? "")
  };
}

function toPlayer(doc: MongoDoc): Player {
  return {
    id: docId(doc),
    parentId: String(doc.parent_id ?? ""),
    playerName: String(doc.player_name ?? ""),
    dateOfBirth: String(doc.date_of_birth ?? ""),
    ageGroup: String(doc.age_group ?? ""),
    heightCm: Number(doc.height_cm ?? 0),
    weightKg: Number(doc.weight_kg ?? 0),
    profilePhotoUrl: doc.profile_photo_url ? String(doc.profile_photo_url) : undefined,
    status: (doc.status as Player["status"]) ?? "active",
    registrationStatus: (doc.registration_status as Player["registrationStatus"]) ?? "pending",
    developmentNotes: doc.development_notes ? String(doc.development_notes) : undefined,
    subscriptionValidUntil: doc.subscription_valid_until
      ? String(doc.subscription_valid_until)
      : undefined,
    createdAt: doc.created_at ? String(doc.created_at) : undefined,
    withdrawnAt: doc.withdrawn_at ? String(doc.withdrawn_at) : undefined,
    registrationProfile: parseRegistrationProfileRow(doc.registration_profile)
  };
}

function toPayment(doc: MongoDoc): Payment {
  const paidAt = doc.paid_at ? String(doc.paid_at) : undefined;
  const dueDate = String(doc.due_date ?? "");
  const rawStatus = String(doc.status ?? "not_paid") as Payment["status"];
  return {
    id: docId(doc),
    playerId: String(doc.player_id ?? ""),
    amount: Number(doc.amount ?? 0),
    currency: String(doc.currency ?? "RWF"),
    paymentFor: String(doc.payment_for ?? ""),
    dueDate,
    paidAt,
    status: computePaymentStatus(dueDate, paidAt, rawStatus),
    paymentMethod: doc.payment_method
      ? (String(doc.payment_method) as Payment["paymentMethod"])
      : undefined,
    paymentNotes: doc.payment_notes ? String(doc.payment_notes) : undefined,
    mobileMoneyRef: doc.mobile_money_ref ? String(doc.mobile_money_ref) : undefined,
    proofUrl: doc.proof_url ? String(doc.proof_url) : undefined,
    invoiceSentAt: doc.invoice_sent_at ? String(doc.invoice_sent_at) : undefined,
    verifiedBy: doc.verified_by_label ? String(doc.verified_by_label) : undefined
  };
}

function toSession(doc: MongoDoc): TimetableSession {
  const rawGroups = doc.age_groups;
  const ageGroups = parseStringArray(Array.isArray(rawGroups) ? rawGroups : []);
  return normalizeTimetableSession({
    id: docId(doc),
    title: String(doc.title ?? ""),
    ageGroup: String(doc.age_group ?? ""),
    ageGroups: ageGroups.length ? ageGroups : undefined,
    kind: (doc.kind as TimetableSession["kind"]) ?? "training",
    startsAt: String(doc.starts_at ?? ""),
    endsAt: String(doc.ends_at ?? ""),
    locationName: String(doc.location_name ?? ""),
    kitRequirements: String(doc.kit_requirements ?? ""),
    trainerName: String(doc.trainer_name ?? ""),
    activities: parseStringArray(Array.isArray(doc.activities) ? doc.activities : []),
    sessionObjectives: String(doc.session_objectives ?? ""),
    equipmentNotes: String(doc.equipment_notes ?? ""),
    instructorNotes: String(doc.instructor_notes ?? ""),
    isUpdated: Boolean(doc.is_updated),
    updatedAt: doc.updated_at ? String(doc.updated_at) : undefined
  });
}

function toPerformance(doc: MongoDoc): PerformanceEntry {
  return {
    id: docId(doc),
    playerId: String(doc.player_id ?? ""),
    date: String(doc.happened_on ?? ""),
    notes: String(doc.notes ?? ""),
    focusArea: doc.focus_area ? String(doc.focus_area) : undefined
  };
}

function toMessage(doc: MongoDoc): AdminMessage {
  return {
    id: docId(doc),
    createdAt: String(doc.created_at ?? new Date().toISOString()),
    channel: (doc.channel as AdminMessage["channel"]) ?? "individual",
    playerId: doc.player_id ? String(doc.player_id) : undefined,
    ageGroup: doc.age_group ? String(doc.age_group) : undefined,
    subject: String(doc.subject ?? ""),
    body: String(doc.body ?? ""),
    sentBy: String(doc.sent_by ?? "")
  };
}

function dateOnly(iso: string): string {
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
}

function newId(): string {
  return new Types.ObjectId().toHexString();
}

// ── Database implementation ───────────────────────────────────────────────────

export function createMongoDb(): AppDb {
  const REG_STATUSES = new Set(["pending", "approved", "rejected"]);

  const db: AppDb = {
    async createRegistration(input) {
      await connectMongo();

      const normalizedEmail = normalizeEmail(input.parent.email);
      const normalizedPhone = normalizePhone(input.parent.phoneNumber);

      const parentDoc = await ParentModel.findOne({
        $or: [
          { email: { $regex: new RegExp(`^${normalizedEmail}$`, "i") } },
          ...(normalizedPhone ? [{ phone_number: normalizedPhone }] : [])
        ]
      }).lean();

      let parent: Parent;
      if (parentDoc) {
        await ParentModel.updateOne(
          { _id: (parentDoc as Record<string, unknown>)._id },
          {
            parent_name: input.parent.parentName,
            phone_number: input.parent.phoneNumber,
            email: normalizedEmail,
            address: input.parent.address
          }
        );
        const updated = await ParentModel.findById(
          (parentDoc as Record<string, unknown>)._id
        ).lean();
        parent = toParent(updated as Record<string, unknown>);
      } else {
        const created = await ParentModel.create({
          _id: newId(),
          parent_name: input.parent.parentName,
          phone_number: input.parent.phoneNumber,
          email: normalizedEmail,
          address: input.parent.address
        });
        parent = toParent(created.toObject() as Record<string, unknown>);
      }

      const dup = await PlayerModel.findOne({
        parent_id: parent.id,
        player_name: { $regex: new RegExp(`^${input.playerName}$`, "i") },
        date_of_birth: dateOnly(input.dateOfBirth)
      }).lean();
      if (dup) throw new Error("Player already registered under this parent.");

      const regProfile = input.registrationProfile ?? emptyRegistrationProfile();
      const pl = await PlayerModel.create({
        _id: newId(),
        parent_id: parent.id,
        player_name: input.playerName,
        date_of_birth: dateOnly(input.dateOfBirth),
        age_group: input.ageGroup,
        height_cm: input.heightCm,
        weight_kg: input.weightKg,
        profile_photo_url: input.profilePhotoUrl ?? null,
        status: "active",
        registration_status: "pending",
        development_notes: input.developmentNotes ?? null,
        registration_profile: regProfile,
        subscription_valid_until: input.subscriptionValidUntil
          ? dateOnly(input.subscriptionValidUntil)
          : null
      });

      return { parent, player: toPlayer(pl.toObject() as Record<string, unknown>) };
    },

    async createRosterPlayersFromNames(input) {
      await connectMongo();
      const rows = input.rows
        .map((x) => ({ playerName: x.playerName.trim(), ageGroup: x.ageGroup }))
        .filter((x) => x.playerName);
      if (rows.length === 0) return { created: [], skippedNames: [] };

      const lowered = rows.map((n) => n.playerName.toLowerCase());
      const dupDocs = await PlayerModel.find({
        player_name: { $in: lowered.map((n) => new RegExp(`^${n}$`, "i")) }
      })
        .select("player_name")
        .lean();
      const existing = new Set(
        (dupDocs as Array<Record<string, unknown>>).map((d) =>
          String(d.player_name).toLowerCase()
        )
      );

      const created: Player[] = [];
      const skippedNames: string[] = [];

      for (const rowInput of rows) {
        const { playerName, ageGroup } = rowInput;
        if (existing.has(playerName.toLowerCase())) {
          skippedNames.push(playerName);
          continue;
        }
        const stamp = Date.now().toString(36);
        const suffix = Math.random().toString(36).slice(2, 7);
        const parentId = newId();
        await ParentModel.create({
          _id: parentId,
          parent_name: "Unknown guardian",
          phone_number: "",
          email: `import-${stamp}-${suffix}@placeholder.local`,
          address: ""
        });
        const playerId = newId();
        const pl = await PlayerModel.create({
          _id: playerId,
          parent_id: parentId,
          player_name: playerName,
          date_of_birth: "2014-01-01",
          age_group: ageGroup,
          height_cm: 140,
          weight_kg: 35,
          status: "active",
          registration_status: "pending",
          development_notes: "Imported from roster CSV. Complete profile details.",
          registration_profile: emptyRegistrationProfile()
        });
        created.push(toPlayer(pl.toObject() as Record<string, unknown>));
        existing.add(playerName.toLowerCase());
      }
      return { created, skippedNames };
    },

    async listPlayers(opts?: ListPlayersOpts) {
      await connectMongo();
      const filter: Record<string, unknown> = {};
      if (!opts?.includeWithdrawn) filter.status = { $ne: "withdrawn" };
      if (opts?.group && opts.group.length > 0 && opts.group.length < 80) {
        filter.age_group = opts.group;
      }
      if (opts?.registration && opts.registration !== "all" && REG_STATUSES.has(opts.registration)) {
        filter.registration_status = opts.registration;
      }
      const docs = await PlayerModel.find(filter).sort({ created_at: -1 }).lean();
      return (docs as Array<Record<string, unknown>>).map(toPlayer);
    },

    async getPlayer(id) {
      await connectMongo();
      const doc = await PlayerModel.findById(id).lean();
      return doc ? toPlayer(doc as Record<string, unknown>) : null;
    },

    async updatePlayer(id, patch) {
      await connectMongo();
      const update: Record<string, unknown> = {};
      if (patch.playerName !== undefined) update.player_name = patch.playerName;
      if (patch.dateOfBirth !== undefined) update.date_of_birth = dateOnly(patch.dateOfBirth);
      if (patch.ageGroup !== undefined) update.age_group = patch.ageGroup;
      if (patch.heightCm !== undefined) update.height_cm = patch.heightCm;
      if (patch.weightKg !== undefined) update.weight_kg = patch.weightKg;
      if (patch.profilePhotoUrl !== undefined) update.profile_photo_url = patch.profilePhotoUrl ?? null;
      if (patch.status !== undefined) update.status = patch.status;
      if (patch.registrationStatus !== undefined) update.registration_status = patch.registrationStatus;
      if (patch.developmentNotes !== undefined) update.development_notes = patch.developmentNotes ?? null;
      if (patch.registrationProfile !== undefined) update.registration_profile = patch.registrationProfile;
      if (patch.subscriptionValidUntil !== undefined) {
        update.subscription_valid_until = patch.subscriptionValidUntil
          ? dateOnly(patch.subscriptionValidUntil)
          : null;
      }
      if (patch.withdrawnAt !== undefined) update.withdrawn_at = patch.withdrawnAt ?? null;
      if (Object.keys(update).length === 0) return db.getPlayer(id);
      const doc = await PlayerModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
      return doc ? toPlayer(doc as Record<string, unknown>) : null;
    },

    async withdrawPlayer(id) {
      await connectMongo();
      const doc = await PlayerModel.findByIdAndUpdate(
        id,
        { $set: { status: "withdrawn", withdrawn_at: new Date().toISOString() } },
        { new: true }
      ).lean();
      return doc ? toPlayer(doc as Record<string, unknown>) : null;
    },

    async updateParent(parentId, patch) {
      await connectMongo();
      const update: Record<string, unknown> = {};
      if (patch.parentName !== undefined) update.parent_name = patch.parentName;
      if (patch.phoneNumber !== undefined) update.phone_number = patch.phoneNumber;
      if (patch.email !== undefined) update.email = patch.email;
      if (patch.address !== undefined) update.address = patch.address;
      if (Object.keys(update).length === 0) {
        const doc = await ParentModel.findById(parentId).lean();
        return doc ? toParent(doc as Record<string, unknown>) : null;
      }
      const doc = await ParentModel.findByIdAndUpdate(parentId, { $set: update }, { new: true }).lean();
      return doc ? toParent(doc as Record<string, unknown>) : null;
    },

    async updateRegistrationStatus(id, status) {
      await connectMongo();
      const doc = await PlayerModel.findByIdAndUpdate(
        id,
        { $set: { registration_status: status } },
        { new: true }
      ).lean();
      return doc ? toPlayer(doc as Record<string, unknown>) : null;
    },

    async listParents() {
      await connectMongo();
      const docs = await ParentModel.find().sort({ created_at: 1 }).lean();
      return (docs as Array<Record<string, unknown>>).map(toParent);
    },

    async listPayments() {
      await connectMongo();
      const docs = await PaymentModel.find().sort({ due_date: 1 }).lean();
      return (docs as Array<Record<string, unknown>>).map(toPayment);
    },

    async getPayment(id) {
      await connectMongo();
      const doc = await PaymentModel.findById(id).lean();
      return doc ? toPayment(doc as Record<string, unknown>) : null;
    },

    async listPaymentsForPlayer(playerId) {
      await connectMongo();
      const docs = await PaymentModel.find({ player_id: playerId }).sort({ due_date: 1 }).lean();
      return (docs as Array<Record<string, unknown>>).map(toPayment);
    },

    async createPayment(input) {
      await connectMongo();
      const status = computePaymentStatus(input.dueDate, input.paidAt, "not_paid");
      const doc = await PaymentModel.create({
        _id: newId(),
        player_id: input.playerId,
        amount: input.amount,
        currency: input.currency,
        payment_for: input.paymentFor,
        paid_at: input.paidAt ?? null,
        due_date: dateOnly(input.dueDate),
        status,
        payment_method: input.paymentMethod ?? null,
        payment_notes: input.paymentNotes ?? null,
        mobile_money_ref: input.mobileMoneyRef ?? null,
        proof_url: input.proofUrl ?? null,
        invoice_sent_at: input.invoiceSentAt ?? null,
        verified_by_label: input.verifiedBy ?? null
      });
      return toPayment(doc.toObject() as Record<string, unknown>);
    },

    async updatePayment(id, patch) {
      await connectMongo();
      const update: Record<string, unknown> = {};
      if (patch.amount !== undefined) update.amount = patch.amount;
      if (patch.currency !== undefined) update.currency = patch.currency;
      if (patch.paymentFor !== undefined) update.payment_for = patch.paymentFor;
      if (patch.dueDate !== undefined) update.due_date = dateOnly(patch.dueDate);
      if (patch.paidAt !== undefined) update.paid_at = patch.paidAt ?? null;
      if (patch.status !== undefined) update.status = patch.status;
      if (patch.paymentMethod !== undefined) update.payment_method = patch.paymentMethod ?? null;
      if (patch.paymentNotes !== undefined) update.payment_notes = patch.paymentNotes ?? null;
      if (patch.mobileMoneyRef !== undefined) update.mobile_money_ref = patch.mobileMoneyRef ?? null;
      if (patch.proofUrl !== undefined) update.proof_url = patch.proofUrl ?? null;
      if (patch.invoiceSentAt !== undefined) update.invoice_sent_at = patch.invoiceSentAt ?? null;
      if (patch.verifiedBy !== undefined) update.verified_by_label = patch.verifiedBy ?? null;
      if (Object.keys(update).length === 0) return db.getPayment(id);

      if (patch.dueDate !== undefined || patch.paidAt !== undefined || patch.status !== undefined) {
        const current = await db.getPayment(id);
        if (!current) return null;
        const computed = computePaymentStatus(
          patch.dueDate ?? current.dueDate,
          patch.paidAt ?? current.paidAt,
          patch.status ?? current.status
        );
        const paidLocked =
          current.status === "paid" &&
          Boolean(current.paidAt) &&
          patch.status === undefined &&
          patch.paidAt === undefined;
        update.status = paidLocked && computed !== "paid" ? "paid" : computed;
      }

      const doc = await PaymentModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
      return doc ? toPayment(doc as Record<string, unknown>) : null;
    },

    async verifyPayment(id, verifiedByLabel, extras?: VerifyPaymentExtras) {
      await connectMongo();
      const cur = await PaymentModel.findById(id).lean() as Record<string, unknown> | null;
      if (!cur) return null;
      if (String(cur.status) === "paid" && cur.paid_at) return toPayment(cur);

      const paidAt = new Date().toISOString();
      const method = extras?.paymentMethod !== undefined ? extras.paymentMethod : cur.payment_method;
      const notes = extras?.paymentNotes !== undefined ? extras.paymentNotes : cur.payment_notes;
      const mm = extras?.mobileMoneyRef !== undefined ? extras.mobileMoneyRef : cur.mobile_money_ref;

      const doc = await PaymentModel.findOneAndUpdate(
        { _id: id, status: { $ne: "paid" } },
        {
          $set: {
            paid_at: paidAt,
            status: "paid",
            verified_by_label: verifiedByLabel,
            payment_method: method ?? null,
            payment_notes: notes ?? null,
            mobile_money_ref: mm ?? null
          }
        },
        { new: true }
      ).lean();

      if (!doc) {
        const fresh = await PaymentModel.findById(id).lean();
        return fresh ? toPayment(fresh as Record<string, unknown>) : null;
      }
      return toPayment(doc as Record<string, unknown>);
    },

    async listSessions(ageGroup) {
      await connectMongo();
      const filter =
        ageGroup && ageGroup.length > 0 && ageGroup.length < 80 ? { age_group: ageGroup } : {};
      const docs = await SessionModel.find(filter).sort({ starts_at: 1 }).lean();
      return (docs as Array<Record<string, unknown>>).map(toSession);
    },

    async getSession(id) {
      await connectMongo();
      const doc = await SessionModel.findById(id).lean();
      return doc ? toSession(doc as Record<string, unknown>) : null;
    },

    async createSession(input) {
      await connectMongo();
      const n = normalizeTimetableSession(input);
      const doc = await SessionModel.create({
        _id: newId(),
        title: n.title,
        age_group: n.ageGroup,
        age_groups: n.ageGroups ?? [],
        kind: n.kind,
        starts_at: n.startsAt,
        ends_at: n.endsAt,
        location_name: n.locationName,
        kit_requirements: n.kitRequirements,
        trainer_name: n.trainerName,
        activities: n.activities ?? [],
        session_objectives: n.sessionObjectives,
        equipment_notes: n.equipmentNotes,
        instructor_notes: n.instructorNotes,
        is_updated: n.isUpdated,
        updated_at: n.updatedAt ?? null
      });
      return toSession(doc.toObject() as Record<string, unknown>);
    },

    async updateSession(id, patch) {
      await connectMongo();
      const update: Record<string, unknown> = {};
      if (patch.title !== undefined) update.title = patch.title;
      if (patch.ageGroup !== undefined) update.age_group = patch.ageGroup;
      if (patch.ageGroups !== undefined) {
        update.age_groups = patch.ageGroups;
        update.age_group = patch.ageGroups[0] ?? patch.ageGroup;
      }
      if (patch.kind !== undefined) update.kind = patch.kind;
      if (patch.startsAt !== undefined) update.starts_at = patch.startsAt;
      if (patch.endsAt !== undefined) update.ends_at = patch.endsAt;
      if (patch.locationName !== undefined) update.location_name = patch.locationName;
      if (patch.kitRequirements !== undefined) update.kit_requirements = patch.kitRequirements;
      if (patch.trainerName !== undefined) update.trainer_name = patch.trainerName;
      if (patch.activities !== undefined) update.activities = patch.activities;
      if (patch.sessionObjectives !== undefined) update.session_objectives = patch.sessionObjectives;
      if (patch.equipmentNotes !== undefined) update.equipment_notes = patch.equipmentNotes;
      if (patch.instructorNotes !== undefined) update.instructor_notes = patch.instructorNotes;
      if (patch.isUpdated !== undefined) update.is_updated = patch.isUpdated;
      if (patch.updatedAt !== undefined) update.updated_at = patch.updatedAt;
      if (Object.keys(update).length === 0) return db.getSession(id);
      const doc = await SessionModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
      return doc ? toSession(doc as Record<string, unknown>) : null;
    },

    async deleteSession(id) {
      await connectMongo();
      const result = await SessionModel.deleteOne({ _id: id });
      return result.deletedCount > 0;
    },

    async getParentByPlayerId(playerId) {
      await connectMongo();
      const player = await db.getPlayer(playerId);
      if (!player) return null;
      const doc = await ParentModel.findById(player.parentId).lean();
      return doc ? toParent(doc as Record<string, unknown>) : null;
    },

    async listPerformance(playerId) {
      await connectMongo();
      const docs = await PerformanceModel.find({ player_id: playerId })
        .sort({ happened_on: -1 })
        .lean();
      return (docs as Array<Record<string, unknown>>).map(toPerformance);
    },

    async addPerformance(input) {
      await connectMongo();
      const doc = await PerformanceModel.create({
        _id: newId(),
        player_id: input.playerId,
        happened_on: dateOnly(input.date),
        notes: input.notes,
        focus_area: input.focusArea ?? null
      });
      return toPerformance(doc.toObject() as Record<string, unknown>);
    },

    async listMessages() {
      await connectMongo();
      const docs = await MessageModel.find().sort({ created_at: -1 }).lean();
      return (docs as Array<Record<string, unknown>>).map(toMessage);
    },

    async addMessage(input) {
      await connectMongo();
      const doc = await MessageModel.create({
        _id: newId(),
        channel: input.channel,
        player_id: input.playerId ?? null,
        age_group: input.ageGroup ?? null,
        subject: input.subject,
        body: input.body,
        sent_by: input.sentBy
      });
      return toMessage(doc.toObject() as Record<string, unknown>);
    },

    async adminShellSummary(): Promise<AdminShellSummary> {
      await connectMongo();
      const [pending, messages, openPayments] = await Promise.all([
        PlayerModel.countDocuments({ registration_status: "pending" }),
        MessageModel.countDocuments(),
        PaymentModel.countDocuments({ status: { $ne: "paid" } })
      ]);
      return {
        pendingApplications: pending,
        messageCount: messages,
        openInvoicesCount: openPayments
      };
    },

    async getSiteContent() {
      await connectMongo();
      const doc = await SiteConfigModel.findById(1).lean();
      const raw = doc ? (doc as Record<string, unknown>).content : null;
      return mergeStoredSiteContent(
        typeof raw === "object" && raw !== null ? (raw as Partial<SiteContent>) : null
      );
    },

    async updateSiteContent(patch) {
      await connectMongo();
      const cur = await db.getSiteContent();
      const next = { ...cur } as Record<string, unknown>;
      (Object.keys(patch) as (keyof SiteContent)[]).forEach((k) => {
        const v = patch[k];
        if (v === undefined) return;
        if (Array.isArray(v)) {
          next[k as string] = v.map((item: unknown) =>
            item && typeof item === "object" ? { ...(item as Record<string, unknown>) } : item
          );
        } else {
          next[k as string] = v;
        }
      });
      const content = withNormalizedPitchLocations(
        withNormalizedGallery(withNormalizedNewsPosts(next as SiteContent))
      );
      await SiteConfigModel.findByIdAndUpdate(
        1,
        { $set: { content, updated_at: new Date().toISOString() } },
        { upsert: true, new: true }
      );
      return content;
    }
  };

  return db;
}
