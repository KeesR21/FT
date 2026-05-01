import { mergeStoredSiteContent, withNormalizedNewsPosts } from "@/lib/persist-site-content";
import { emptyRegistrationProfile } from "@/lib/registration-profile";
import { normalizeEmail, normalizePhone } from "@/lib/payment-guards";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Player, SiteContent, VerifyPaymentExtras } from "@/lib/types";
import {
  dateOnly,
  rowToMessage,
  rowToParent,
  rowToPayment,
  rowToPerformance,
  rowToPlayer,
  rowToSession,
  sessionPatchToRow,
  sessionToInsert,
  type MessageRow,
  type ParentRow,
  type PaymentRow,
  type PerformanceRow,
  type PlayerRow,
  type SessionRow
} from "@/lib/db/pg-mappers";
import { computePaymentStatus } from "@/lib/utils";
import type { AdminShellSummary, AppDb, ListPlayersOpts } from "./types";

export function createSupabaseDb(): AppDb {
  const supabase = getSupabaseAdmin();
  const isMissingColumnError = (error: unknown) =>
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string" &&
    /Could not find the '.*' column of 'payments' in the schema cache/i.test((error as { message: string }).message);

  const db: AppDb = {
    async createRegistration(input) {
      const normalizedEmail = normalizeEmail(input.parent.email);
      const normalizedPhone = normalizePhone(input.parent.phoneNumber);
      const { data: existingByEmailRows, error: byEmailError } = await supabase
        .from("parents")
        .select("*")
        .ilike("email", normalizedEmail)
        .limit(1);
      if (byEmailError) throw byEmailError;
      let existingParentRow = (existingByEmailRows as ParentRow[] | null)?.[0] ?? null;
      if (!existingParentRow && normalizedPhone) {
        const { data: byPhoneRows, error: byPhoneError } = await supabase
          .from("parents")
          .select("*")
          .ilike("phone_number", `%${normalizedPhone}%`)
          .limit(1);
        if (byPhoneError) throw byPhoneError;
        existingParentRow = (byPhoneRows as ParentRow[] | null)?.[0] ?? null;
      }
      let parent: ReturnType<typeof rowToParent>;
      if (existingParentRow) {
        parent = rowToParent(existingParentRow);
        const { error: updateParentError } = await supabase
          .from("parents")
          .update({
            parent_name: input.parent.parentName,
            phone_number: input.parent.phoneNumber,
            email: normalizedEmail,
            address: input.parent.address
          })
          .eq("id", parent.id);
        if (updateParentError) throw updateParentError;
      } else {
        const { data: insertedParentRow, error: insertParentError } = await supabase
          .from("parents")
          .insert({
            parent_name: input.parent.parentName,
            phone_number: input.parent.phoneNumber,
            email: normalizedEmail,
            address: input.parent.address
          })
          .select("*")
          .single();
        if (insertParentError) throw insertParentError;
        parent = rowToParent(insertedParentRow as ParentRow);
      }
      const { data: duplicatePlayerRows, error: duplicatePlayerError } = await supabase
        .from("players")
        .select("id")
        .eq("parent_id", parent.id)
        .eq("date_of_birth", dateOnly(input.dateOfBirth))
        .ilike("player_name", input.playerName.trim())
        .limit(1);
      if (duplicatePlayerError) throw duplicatePlayerError;
      if ((duplicatePlayerRows ?? []).length > 0) {
        throw new Error("Player already registered under this parent.");
      }

      const subUntil = input.subscriptionValidUntil ? dateOnly(input.subscriptionValidUntil) : null;

      const regProfile = input.registrationProfile ?? emptyRegistrationProfile();

      const { data: plRow, error: e2 } = await supabase
        .from("players")
        .insert({
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
          subscription_valid_until: subUntil
        })
        .select("*")
        .single();
      if (e2) throw e2;
      return { parent, player: rowToPlayer(plRow as PlayerRow) };
    },

    async createRosterPlayersFromNames(input) {
      const rows = input.rows.map((x) => ({ playerName: x.playerName.trim(), ageGroup: x.ageGroup })).filter((x) => x.playerName);
      const names = rows.map((x) => x.playerName);
      if (names.length === 0) return { created: [], skippedNames: [] };

      const { data: existingRows, error: existingError } = await supabase
        .from("players")
        .select("player_name")
        .in(
          "player_name",
          names.map((n) => n.trim())
        );
      if (existingError) throw existingError;
      const existing = new Set(
        ((existingRows as Array<{ player_name: string }> | null) ?? []).map((r) => r.player_name.trim().toLowerCase())
      );

      const created: Player[] = [];
      const skippedNames: string[] = [];
      for (const rowInput of rows) {
        const playerName = rowInput.playerName;
        if (existing.has(playerName.toLowerCase())) {
          skippedNames.push(playerName);
          continue;
        }
        const stamp = Date.now().toString(36);
        const idSuffix = Math.random().toString(36).slice(2, 7);
        const { data: parentRow, error: parentError } = await supabase
          .from("parents")
          .insert({
            parent_name: "Unknown guardian",
            phone_number: "",
            email: `import-${stamp}-${idSuffix}@placeholder.local`,
            address: ""
          })
          .select("*")
          .single();
        if (parentError) throw parentError;

        const { data: plRow, error: plError } = await supabase
          .from("players")
          .insert({
            parent_id: (parentRow as ParentRow).id,
            player_name: playerName,
            date_of_birth: "2014-01-01",
            age_group: rowInput.ageGroup,
            height_cm: 140,
            weight_kg: 35,
            profile_photo_url: null,
            status: "active",
            registration_status: "pending",
            development_notes: "Imported from roster CSV. Complete profile details.",
            registration_profile: emptyRegistrationProfile(),
            subscription_valid_until: null
          })
          .select("*")
          .single();
        if (plError) throw plError;
        created.push(rowToPlayer(plRow as PlayerRow));
        existing.add(playerName.toLowerCase());
      }

      return { created, skippedNames };
    },

    async listPlayers(opts?: ListPlayersOpts) {
      let q = supabase.from("players").select("*").order("created_at", { ascending: false });
      if (!opts?.includeWithdrawn) q = q.neq("status", "withdrawn");
      if (opts?.group) q = q.eq("age_group", opts.group);
      if (opts?.registration && opts.registration !== "all") {
        q = q.eq("registration_status", opts.registration);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data as PlayerRow[]).map(rowToPlayer);
    },

    async getPlayer(id) {
      const { data, error } = await supabase.from("players").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? rowToPlayer(data as PlayerRow) : null;
    },

    async updatePlayer(id, patch) {
      const row: Record<string, unknown> = {};
      if (patch.playerName !== undefined) row.player_name = patch.playerName;
      if (patch.dateOfBirth !== undefined) row.date_of_birth = dateOnly(patch.dateOfBirth);
      if (patch.ageGroup !== undefined) row.age_group = patch.ageGroup;
      if (patch.heightCm !== undefined) row.height_cm = patch.heightCm;
      if (patch.weightKg !== undefined) row.weight_kg = patch.weightKg;
      if (patch.profilePhotoUrl !== undefined) row.profile_photo_url = patch.profilePhotoUrl ?? null;
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.registrationStatus !== undefined) row.registration_status = patch.registrationStatus;
      if (patch.developmentNotes !== undefined) row.development_notes = patch.developmentNotes ?? null;
      if (patch.registrationProfile !== undefined) row.registration_profile = patch.registrationProfile;
      if (patch.subscriptionValidUntil !== undefined) {
        row.subscription_valid_until = patch.subscriptionValidUntil ? dateOnly(patch.subscriptionValidUntil) : null;
      }
      if (patch.withdrawnAt !== undefined) row.withdrawn_at = patch.withdrawnAt ?? null;
      if (Object.keys(row).length === 0) return db.getPlayer(id);
      const { data, error } = await supabase.from("players").update(row).eq("id", id).select("*").maybeSingle();
      if (error) throw error;
      return data ? rowToPlayer(data as PlayerRow) : null;
    },

    async withdrawPlayer(id) {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("players")
        .update({ status: "withdrawn", withdrawn_at: now })
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data ? rowToPlayer(data as PlayerRow) : null;
    },

    async updateParent(parentId, patch) {
      const row: Record<string, unknown> = {};
      if (patch.parentName !== undefined) row.parent_name = patch.parentName;
      if (patch.phoneNumber !== undefined) row.phone_number = patch.phoneNumber;
      if (patch.email !== undefined) row.email = patch.email;
      if (patch.address !== undefined) row.address = patch.address;
      if (Object.keys(row).length === 0) {
        const { data } = await supabase.from("parents").select("*").eq("id", parentId).maybeSingle();
        return data ? rowToParent(data as ParentRow) : null;
      }
      const { data, error } = await supabase.from("parents").update(row).eq("id", parentId).select("*").maybeSingle();
      if (error) throw error;
      return data ? rowToParent(data as ParentRow) : null;
    },

    async updateRegistrationStatus(id, status) {
      const row: Record<string, unknown> = { registration_status: status };
      const { data: cur } = await supabase.from("players").select("*").eq("id", id).maybeSingle();
      if (!cur) return null;
      const { data, error } = await supabase.from("players").update(row).eq("id", id).select("*").maybeSingle();
      if (error) throw error;
      return data ? rowToPlayer(data as PlayerRow) : null;
    },

    async listParents() {
      const { data, error } = await supabase.from("parents").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return (data as ParentRow[]).map(rowToParent);
    },

    async listPayments() {
      const { data, error } = await supabase.from("payments").select("*").order("due_date", { ascending: true });
      if (error) throw error;
      return (data as PaymentRow[]).map(rowToPayment);
    },

    async getPayment(id) {
      const { data, error } = await supabase.from("payments").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? rowToPayment(data as PaymentRow) : null;
    },

    async listPaymentsForPlayer(playerId) {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("player_id", playerId)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data as PaymentRow[]).map(rowToPayment);
    },

    async createPayment(input) {
      const status = computePaymentStatus(input.dueDate, input.paidAt, "not_paid");
      const fullInsert = {
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
      };
      const { data, error } = await supabase
        .from("payments")
        .insert(fullInsert)
        .select("*")
        .single();
      if (error) {
        if (!isMissingColumnError(error)) throw error;
        const { data: legacyData, error: legacyError } = await supabase
          .from("payments")
          .insert({
            player_id: input.playerId,
            amount: input.amount,
            currency: input.currency,
            payment_for: input.paymentFor,
            paid_at: input.paidAt ?? null,
            due_date: dateOnly(input.dueDate),
            status,
            mobile_money_ref: input.mobileMoneyRef ?? null,
            verified_by_label: input.verifiedBy ?? null
          })
          .select("*")
          .single();
        if (legacyError) throw legacyError;
        return rowToPayment(legacyData as PaymentRow);
      }
      return rowToPayment(data as PaymentRow);
    },

    async updatePayment(id, patch) {
      const row: Record<string, unknown> = {};
      if (patch.amount !== undefined) row.amount = patch.amount;
      if (patch.currency !== undefined) row.currency = patch.currency;
      if (patch.paymentFor !== undefined) row.payment_for = patch.paymentFor;
      if (patch.dueDate !== undefined) row.due_date = dateOnly(patch.dueDate);
      if (patch.paidAt !== undefined) row.paid_at = patch.paidAt ?? null;
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.paymentMethod !== undefined) row.payment_method = patch.paymentMethod ?? null;
      if (patch.paymentNotes !== undefined) row.payment_notes = patch.paymentNotes ?? null;
      if (patch.mobileMoneyRef !== undefined) row.mobile_money_ref = patch.mobileMoneyRef ?? null;
      if (patch.proofUrl !== undefined) row.proof_url = patch.proofUrl ?? null;
      if (patch.invoiceSentAt !== undefined) row.invoice_sent_at = patch.invoiceSentAt ?? null;
      if (patch.verifiedBy !== undefined) row.verified_by_label = patch.verifiedBy ?? null;

      const current = await db.getPayment(id);
      if (!current) return null;
      if (patch.dueDate !== undefined || patch.paidAt !== undefined || patch.status !== undefined) {
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
        row.status = paidLocked && computed !== "paid" ? "paid" : computed;
      }
      if (Object.keys(row).length === 0) return current;
      const { data, error } = await supabase.from("payments").update(row).eq("id", id).select("*").maybeSingle();
      if (error) {
        if (!isMissingColumnError(error)) throw error;
        const legacyRow = { ...row };
        delete legacyRow.payment_method;
        delete legacyRow.payment_notes;
        delete legacyRow.proof_url;
        delete legacyRow.invoice_sent_at;
        if (Object.keys(legacyRow).length === 0) return current;
        const { data: legacyData, error: legacyError } = await supabase
          .from("payments")
          .update(legacyRow)
          .eq("id", id)
          .select("*")
          .maybeSingle();
        if (legacyError) throw legacyError;
        return legacyData ? rowToPayment(legacyData as PaymentRow) : null;
      }
      return data ? rowToPayment(data as PaymentRow) : null;
    },

    async verifyPayment(id, verifiedByLabel, extras?: VerifyPaymentExtras) {
      const paidAt = new Date().toISOString();
      const { data: existing, error: e0 } = await supabase.from("payments").select("*").eq("id", id).maybeSingle();
      if (e0) throw e0;
      if (!existing) return null;
      const row = existing as PaymentRow;
      const method = extras?.paymentMethod !== undefined ? extras.paymentMethod : row.payment_method;
      const notes = extras?.paymentNotes !== undefined ? extras.paymentNotes : row.payment_notes;
      const mm = extras?.mobileMoneyRef !== undefined ? extras.mobileMoneyRef : row.mobile_money_ref;
      const { data, error } = await supabase
        .from("payments")
        .update({
          paid_at: paidAt,
          status: "paid",
          verified_by_label: verifiedByLabel,
          payment_method: method ?? null,
          payment_notes: notes ?? null,
          mobile_money_ref: mm ?? null
        })
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data ? rowToPayment(data as PaymentRow) : null;
    },

    async listSessions(ageGroup) {
      let q = supabase.from("timetable_sessions").select("*").order("starts_at", { ascending: true });
      if (ageGroup) q = q.eq("age_group", ageGroup);
      const { data, error } = await q;
      if (error) throw error;
      return (data as SessionRow[]).map(rowToSession);
    },

    async getSession(id) {
      const { data, error } = await supabase.from("timetable_sessions").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? rowToSession(data as SessionRow) : null;
    },

    async createSession(input) {
      const { data, error } = await supabase
        .from("timetable_sessions")
        .insert(sessionToInsert(input))
        .select("*")
        .single();
      if (error) throw error;
      return rowToSession(data as SessionRow);
    },

    async updateSession(id, patch) {
      const row = sessionPatchToRow(patch);
      if (Object.keys(row).length === 0) return db.getSession(id);
      const { data, error } = await supabase
        .from("timetable_sessions")
        .update(row)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data ? rowToSession(data as SessionRow) : null;
    },

    async deleteSession(id) {
      const { data, error } = await supabase.from("timetable_sessions").delete().eq("id", id).select("id");
      if (error) throw error;
      return Boolean(data?.length);
    },

    async getParentByPlayerId(playerId) {
      const player = await db.getPlayer(playerId);
      if (!player) return null;
      const { data, error } = await supabase.from("parents").select("*").eq("id", player.parentId).maybeSingle();
      if (error) throw error;
      return data ? rowToParent(data as ParentRow) : null;
    },

    async listPerformance(playerId) {
      const { data, error } = await supabase
        .from("performance_entries")
        .select("*")
        .eq("player_id", playerId)
        .order("happened_on", { ascending: false });
      if (error) throw error;
      return (data as PerformanceRow[]).map(rowToPerformance);
    },

    async addPerformance(input) {
      const { data, error } = await supabase
        .from("performance_entries")
        .insert({
          player_id: input.playerId,
          happened_on: dateOnly(input.date),
          notes: input.notes,
          focus_area: input.focusArea ?? null
        })
        .select("*")
        .single();
      if (error) throw error;
      return rowToPerformance(data as PerformanceRow);
    },

    async listMessages() {
      const { data, error } = await supabase.from("admin_messages").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data as MessageRow[]).map(rowToMessage);
    },

    async adminShellSummary(): Promise<AdminShellSummary> {
      const [pendingRes, msgRes, openRes] = await Promise.all([
        supabase.from("players").select("*", { count: "exact", head: true }).eq("registration_status", "pending"),
        supabase.from("admin_messages").select("*", { count: "exact", head: true }),
        supabase.from("payments").select("*", { count: "exact", head: true }).neq("status", "paid")
      ]);
      if (pendingRes.error) throw pendingRes.error;
      if (msgRes.error) throw msgRes.error;
      if (openRes.error) throw openRes.error;
      return {
        pendingApplications: pendingRes.count ?? 0,
        messageCount: msgRes.count ?? 0,
        openInvoicesCount: openRes.count ?? 0
      };
    },

    async addMessage(input) {
      const { data, error } = await supabase
        .from("admin_messages")
        .insert({
          channel: input.channel,
          player_id: input.playerId ?? null,
          age_group: input.ageGroup ?? null,
          subject: input.subject,
          body: input.body,
          sent_by: input.sentBy
        })
        .select("*")
        .single();
      if (error) throw error;
      return rowToMessage(data as MessageRow);
    },

    async getSiteContent() {
      const { data, error } = await supabase.from("site_config").select("content").eq("id", 1).maybeSingle();
      if (error) throw error;
      const raw = data?.content as Partial<SiteContent> | undefined;
      return mergeStoredSiteContent(raw ?? null);
    },

    async updateSiteContent(patch) {
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
      const content = withNormalizedNewsPosts(next as SiteContent);
      const { error } = await supabase
        .from("site_config")
        .upsert({ id: 1, content, updated_at: new Date().toISOString() }, { onConflict: "id" });
      if (error) throw error;
      return content;
    }
  };

  return db;
}
