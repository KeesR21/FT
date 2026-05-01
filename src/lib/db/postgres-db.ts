import { mergeStoredSiteContent, withNormalizedNewsPosts } from "@/lib/persist-site-content";
import { withNormalizedGallery } from "@/lib/gallery-normalize";
import { withNormalizedPitchLocations } from "@/lib/locations-normalize";
import { normalizeEmail, normalizePhone } from "@/lib/payment-guards";
import type { Player, SiteContent } from "@/lib/types";
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
import { getPostgresSql } from "@/lib/db/postgres-client";
import { emptyRegistrationProfile } from "@/lib/registration-profile";
import { computePaymentStatus } from "@/lib/utils";
import type { VerifyPaymentExtras } from "@/lib/types";
import type { AdminShellSummary, AppDb, ListPlayersOpts } from "./types";

const REG_STATUSES = new Set(["pending", "approved", "rejected"]);

export function createPostgresDb(): AppDb {
  const sql = getPostgresSql();

  const db: AppDb = {
    async createRegistration(input) {
      return await sql.begin(async (tx) => {
        const normalizedEmail = normalizeEmail(input.parent.email);
        const normalizedPhone = normalizePhone(input.parent.phoneNumber);
        const existingParent = await tx<ParentRow[]>`
          SELECT * FROM parents
          WHERE lower(email) = ${normalizedEmail}
             OR (${normalizedPhone} <> '' AND regexp_replace(phone_number, '\D', '', 'g') = ${normalizedPhone})
          ORDER BY CASE WHEN lower(email) = ${normalizedEmail} THEN 0 ELSE 1 END
          LIMIT 1
        `;
        const parent = existingParent[0]
          ? rowToParent(existingParent[0])
          : rowToParent(
              (
                await tx<ParentRow[]>`
                  INSERT INTO parents (parent_name, phone_number, email, address)
                  VALUES (
                    ${input.parent.parentName},
                    ${input.parent.phoneNumber},
                    ${normalizedEmail},
                    ${input.parent.address}
                  )
                  RETURNING *
                `
              )[0]
            );

        if (existingParent[0]) {
          await tx`
            UPDATE parents
            SET parent_name = ${input.parent.parentName},
                phone_number = ${input.parent.phoneNumber},
                email = ${normalizedEmail},
                address = ${input.parent.address}
            WHERE id = ${parent.id}
          `;
        }
        const duplicatePlayer = await tx<{ id: string }[]>`
          SELECT id FROM players
          WHERE parent_id = ${parent.id}
            AND lower(player_name) = lower(${input.playerName})
            AND date_of_birth = ${dateOnly(input.dateOfBirth)}
          LIMIT 1
        `;
        if (duplicatePlayer[0]) {
          throw new Error("Player already registered under this parent.");
        }
        const subUntil = input.subscriptionValidUntil ? dateOnly(input.subscriptionValidUntil) : null;
        const regProfile = input.registrationProfile ?? emptyRegistrationProfile();
        const [pl] = await tx<PlayerRow[]>`
          INSERT INTO players (
            parent_id, player_name, date_of_birth, age_group, height_cm, weight_kg,
            profile_photo_url, status, registration_status, development_notes, registration_profile, subscription_valid_until
          )
          VALUES (
            ${parent.id},
            ${input.playerName},
            ${dateOnly(input.dateOfBirth)},
            ${input.ageGroup},
            ${input.heightCm},
            ${input.weightKg},
            ${input.profilePhotoUrl ?? null},
            'active',
            'pending',
            ${input.developmentNotes ?? null},
            ${sql.json(regProfile)},
            ${subUntil}
          )
          RETURNING *
        `;
        return { parent, player: rowToPlayer(pl) };
      });
    },

    async createRosterPlayersFromNames(input) {
      const rows = input.rows.map((x) => ({ playerName: x.playerName.trim(), ageGroup: x.ageGroup })).filter((x) => x.playerName);
      const names = rows.map((x) => x.playerName);
      if (names.length === 0) return { created: [], skippedNames: [] };
      const lowered = names.map((n) => n.toLowerCase());
      const dupRows = await sql<{ player_name: string }[]>`
        SELECT player_name FROM players WHERE lower(player_name) = ANY(${lowered}::text[])
      `;
      const existing = new Set(dupRows.map((r) => r.player_name.trim().toLowerCase()));
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
        const [parentRow] = await sql<ParentRow[]>`
          INSERT INTO parents (parent_name, phone_number, email, address)
          VALUES ('Unknown guardian', '', ${`import-${stamp}-${idSuffix}@placeholder.local`}, '')
          RETURNING *
        `;
        const [pl] = await sql<PlayerRow[]>`
          INSERT INTO players (
            parent_id, player_name, date_of_birth, age_group, height_cm, weight_kg,
            profile_photo_url, status, registration_status, development_notes, registration_profile, subscription_valid_until
          )
          VALUES (
            ${parentRow.id},
            ${playerName},
            '2014-01-01',
            ${rowInput.ageGroup},
            140,
            35,
            null,
            'active',
            'pending',
            'Imported from roster CSV. Complete profile details.',
            ${sql.json(emptyRegistrationProfile())},
            null
          )
          RETURNING *
        `;
        created.push(rowToPlayer(pl));
        existing.add(playerName.toLowerCase());
      }
      return { created, skippedNames };
    },

    async listPlayers(opts?: ListPlayersOpts) {
      const withdrawnOk = opts?.includeWithdrawn ? sql`TRUE` : sql`status <> 'withdrawn'`;
      const groupFrag =
        opts?.group && opts.group.length > 0 && opts.group.length < 80 ? sql`AND age_group = ${opts.group}` : sql``;
      const reg = opts?.registration;
      const regFrag =
        reg && reg !== "all" && REG_STATUSES.has(reg) ? sql`AND registration_status = ${reg}` : sql``;
      const rows = await sql<PlayerRow[]>`
        SELECT * FROM players
        WHERE ${withdrawnOk} ${groupFrag} ${regFrag}
        ORDER BY created_at DESC
      `;
      return rows.map(rowToPlayer);
    },

    async getPlayer(id) {
      const rows = await sql<PlayerRow[]>`SELECT * FROM players WHERE id = ${id} LIMIT 1`;
      return rows[0] ? rowToPlayer(rows[0]) : null;
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
      if (patch.registrationProfile !== undefined) {
        row.registration_profile = sql.json(patch.registrationProfile);
      }
      if (patch.subscriptionValidUntil !== undefined) {
        row.subscription_valid_until = patch.subscriptionValidUntil ? dateOnly(patch.subscriptionValidUntil) : null;
      }
      if (patch.withdrawnAt !== undefined) row.withdrawn_at = patch.withdrawnAt ?? null;
      if (Object.keys(row).length === 0) return db.getPlayer(id);
      const rows = await sql<PlayerRow[]>`
        UPDATE players SET ${sql(row)} WHERE id = ${id} RETURNING *
      `;
      return rows[0] ? rowToPlayer(rows[0]) : null;
    },

    async withdrawPlayer(id) {
      const now = new Date().toISOString();
      const rows = await sql<PlayerRow[]>`
        UPDATE players SET status = 'withdrawn', withdrawn_at = ${now}::timestamptz
        WHERE id = ${id} RETURNING *
      `;
      return rows[0] ? rowToPlayer(rows[0]) : null;
    },

    async updateParent(parentId, patch) {
      const row: Record<string, unknown> = {};
      if (patch.parentName !== undefined) row.parent_name = patch.parentName;
      if (patch.phoneNumber !== undefined) row.phone_number = patch.phoneNumber;
      if (patch.email !== undefined) row.email = patch.email;
      if (patch.address !== undefined) row.address = patch.address;
      if (Object.keys(row).length === 0) {
        const r = await sql<ParentRow[]>`SELECT * FROM parents WHERE id = ${parentId} LIMIT 1`;
        return r[0] ? rowToParent(r[0]) : null;
      }
      const rows = await sql<ParentRow[]>`
        UPDATE parents SET ${sql(row)} WHERE id = ${parentId} RETURNING *
      `;
      return rows[0] ? rowToParent(rows[0]) : null;
    },

    async updateRegistrationStatus(id, status) {
      const cur = await sql<PlayerRow[]>`SELECT * FROM players WHERE id = ${id} LIMIT 1`;
      if (!cur[0]) return null;
      const row: Record<string, unknown> = { registration_status: status };
      /* Membership window is set only when a monthly membership payment is approved — not on admission. */
      const rows = await sql<PlayerRow[]>`
        UPDATE players SET ${sql(row)} WHERE id = ${id} RETURNING *
      `;
      return rows[0] ? rowToPlayer(rows[0]) : null;
    },

    async listParents() {
      const rows = await sql<ParentRow[]>`SELECT * FROM parents ORDER BY created_at ASC`;
      return rows.map(rowToParent);
    },

    async listPayments() {
      const rows = await sql<PaymentRow[]>`SELECT * FROM payments ORDER BY due_date ASC`;
      return rows.map(rowToPayment);
    },

    async getPayment(id) {
      const rows = await sql<PaymentRow[]>`SELECT * FROM payments WHERE id = ${id} LIMIT 1`;
      return rows[0] ? rowToPayment(rows[0]) : null;
    },

    async listPaymentsForPlayer(playerId) {
      const rows = await sql<PaymentRow[]>`
        SELECT * FROM payments WHERE player_id = ${playerId} ORDER BY due_date ASC
      `;
      return rows.map(rowToPayment);
    },

    async createPayment(input) {
      const status = computePaymentStatus(input.dueDate, input.paidAt, "not_paid");
      const rows = await sql<PaymentRow[]>`
        INSERT INTO payments (
          player_id, amount, currency, payment_for, paid_at, due_date, status,
          payment_method, payment_notes, mobile_money_ref, proof_url, invoice_sent_at, verified_by_label
        )
        VALUES (
          ${input.playerId},
          ${input.amount},
          ${input.currency},
          ${input.paymentFor},
          ${input.paidAt ?? null},
          ${dateOnly(input.dueDate)},
          ${status}::payment_status,
          ${input.paymentMethod ?? null},
          ${input.paymentNotes ?? null},
          ${input.mobileMoneyRef ?? null},
          ${input.proofUrl ?? null},
          ${input.invoiceSentAt ?? null},
          ${input.verifiedBy ?? null}
        )
        RETURNING *
      `;
      return rowToPayment(rows[0]);
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
      if (Object.keys(row).length === 0) return db.getPayment(id);

      const nextPaidAt = patch.paidAt;
      const nextDueDate = patch.dueDate;
      const nextStatus = patch.status;
      if (nextDueDate !== undefined || nextPaidAt !== undefined || nextStatus !== undefined) {
        const current = await db.getPayment(id);
        if (!current) return null;
        const computed = computePaymentStatus(
          nextDueDate ?? current.dueDate,
          nextPaidAt ?? current.paidAt,
          nextStatus ?? current.status
        );
        const paidLocked =
          current.status === "paid" &&
          Boolean(current.paidAt) &&
          patch.status === undefined &&
          patch.paidAt === undefined;
        row.status = paidLocked && computed !== "paid" ? "paid" : computed;
      }

      const rows = await sql<PaymentRow[]>`
        UPDATE payments SET ${sql(row)} WHERE id = ${id} RETURNING *
      `;
      return rows[0] ? rowToPayment(rows[0]) : null;
    },

    async verifyPayment(id, verifiedByLabel, extras?: VerifyPaymentExtras) {
      const cur = await sql<PaymentRow[]>`SELECT * FROM payments WHERE id = ${id} LIMIT 1`;
      if (!cur[0]) return null;
      const r = cur[0];
      const paidAt = new Date().toISOString();
      const method = extras?.paymentMethod !== undefined ? extras.paymentMethod : r.payment_method;
      const notes = extras?.paymentNotes !== undefined ? extras.paymentNotes : r.payment_notes;
      const mm = extras?.mobileMoneyRef !== undefined ? extras.mobileMoneyRef : r.mobile_money_ref;
      const rows = await sql<PaymentRow[]>`
        UPDATE payments
        SET paid_at = ${paidAt}::timestamptz,
            status = 'paid'::payment_status,
            verified_by_label = ${verifiedByLabel},
            payment_method = ${method ?? null},
            payment_notes = ${notes ?? null},
            mobile_money_ref = ${mm ?? null}
        WHERE id = ${id}
        RETURNING *
      `;
      return rows[0] ? rowToPayment(rows[0]) : null;
    },

    async listSessions(ageGroup) {
      const frag = ageGroup && ageGroup.length > 0 && ageGroup.length < 80 ? sql`WHERE age_group = ${ageGroup}` : sql``;
      const rows = await sql<SessionRow[]>`
        SELECT * FROM timetable_sessions ${frag} ORDER BY starts_at ASC
      `;
      return rows.map(rowToSession);
    },

    async getSession(id) {
      const rows = await sql<SessionRow[]>`SELECT * FROM timetable_sessions WHERE id = ${id} LIMIT 1`;
      return rows[0] ? rowToSession(rows[0]) : null;
    },

    async createSession(input) {
      const s = sessionToInsert(input);
      const rows = await sql<SessionRow[]>`
        INSERT INTO timetable_sessions (
          title, age_group, kind, starts_at, ends_at, location_name, kit_requirements, is_updated, updated_at
        )
        VALUES (
          ${s.title},
          ${s.age_group},
          ${s.kind}::session_kind,
          ${s.starts_at}::timestamptz,
          ${s.ends_at}::timestamptz,
          ${s.location_name},
          ${s.kit_requirements},
          ${s.is_updated},
          ${s.updated_at}
        )
        RETURNING *
      `;
      return rowToSession(rows[0]);
    },

    async updateSession(id, patch) {
      const row = sessionPatchToRow(patch);
      if (Object.keys(row).length === 0) return db.getSession(id);
      const rows = await sql<SessionRow[]>`
        UPDATE timetable_sessions SET ${sql(row)} WHERE id = ${id} RETURNING *
      `;
      return rows[0] ? rowToSession(rows[0]) : null;
    },

    async deleteSession(id) {
      const rows = await sql<{ id: string }[]>`DELETE FROM timetable_sessions WHERE id = ${id} RETURNING id`;
      return rows.length > 0;
    },

    async getParentByPlayerId(playerId) {
      const player = await db.getPlayer(playerId);
      if (!player) return null;
      const rows = await sql<ParentRow[]>`SELECT * FROM parents WHERE id = ${player.parentId} LIMIT 1`;
      return rows[0] ? rowToParent(rows[0]) : null;
    },

    async listPerformance(playerId) {
      const rows = await sql<PerformanceRow[]>`
        SELECT * FROM performance_entries
        WHERE player_id = ${playerId}
        ORDER BY happened_on DESC
      `;
      return rows.map(rowToPerformance);
    },

    async addPerformance(input) {
      const rows = await sql<PerformanceRow[]>`
        INSERT INTO performance_entries (player_id, happened_on, notes, focus_area)
        VALUES (${input.playerId}, ${dateOnly(input.date)}, ${input.notes}, ${input.focusArea ?? null})
        RETURNING *
      `;
      return rowToPerformance(rows[0]);
    },

    async listMessages() {
      const rows = await sql<MessageRow[]>`SELECT * FROM admin_messages ORDER BY created_at DESC`;
      return rows.map(rowToMessage);
    },

    async adminShellSummary(): Promise<AdminShellSummary> {
      const [pendingRows, messageRows, openInvoicesRows] = await Promise.all([
        sql<{ c: number }[]>`SELECT COUNT(*)::int AS c FROM players WHERE registration_status = 'pending'`,
        sql<{ c: number }[]>`SELECT COUNT(*)::int AS c FROM admin_messages`,
        sql<{ c: number }[]>`SELECT COUNT(*)::int AS c FROM payments WHERE status <> 'paid'`
      ]);
      return {
        pendingApplications: pendingRows[0]?.c ?? 0,
        messageCount: messageRows[0]?.c ?? 0,
        openInvoicesCount: openInvoicesRows[0]?.c ?? 0
      };
    },

    async addMessage(input) {
      const rows = await sql<MessageRow[]>`
        INSERT INTO admin_messages (channel, player_id, age_group, subject, body, sent_by)
        VALUES (
          ${input.channel}::message_channel,
          ${input.playerId ?? null},
          ${input.ageGroup ?? null},
          ${input.subject},
          ${input.body},
          ${input.sentBy}
        )
        RETURNING *
      `;
      return rowToMessage(rows[0]);
    },

    async getSiteContent() {
      const rows = await sql<{ content: unknown }[]>`SELECT content FROM site_config WHERE id = 1 LIMIT 1`;
      const raw = rows[0]?.content as Partial<SiteContent> | undefined;
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
      const content = withNormalizedPitchLocations(
        withNormalizedGallery(withNormalizedNewsPosts(next as SiteContent))
      );
      await sql`
        INSERT INTO site_config (id, content, updated_at)
        VALUES (1, ${sql.json(content)}, NOW())
        ON CONFLICT (id) DO UPDATE SET
          content = EXCLUDED.content,
          updated_at = EXCLUDED.updated_at
      `;
      return content;
    }
  };

  return db;
}
