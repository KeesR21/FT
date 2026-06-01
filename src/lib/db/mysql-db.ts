import { mergeStoredSiteContent, withNormalizedNewsPosts } from "@/lib/persist-site-content";
import { withNormalizedGallery } from "@/lib/gallery-normalize";
import { withNormalizedPitchLocations } from "@/lib/locations-normalize";
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
import { getMysqlPool } from "@/lib/db/mysql-client";
import { buildUpdateSet, jsonParam, newId, queryOne, queryRows } from "@/lib/db/mysql-query";
import { emptyRegistrationProfile } from "@/lib/registration-profile";
import { normalizeEmail, normalizePhone } from "@/lib/payment-guards";
import { computePaymentStatus } from "@/lib/utils";
import type { Player, SiteContent, VerifyPaymentExtras } from "@/lib/types";
import type { AdminShellSummary, AppDb, ListPlayersOpts } from "./types";

const REG_STATUSES = new Set(["pending", "approved", "rejected"]);
const JSON_COLS = new Set([
  "registration_profile",
  "age_groups",
  "activities",
  "content"
]);

export function createMysqlDb(): AppDb {
  const pool = getMysqlPool();

  const db: AppDb = {
    async createRegistration(input) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const normalizedEmail = normalizeEmail(input.parent.email);
        const normalizedPhone = normalizePhone(input.parent.phoneNumber);

        let parentRow: ParentRow | null = null;
        if (normalizedPhone) {
          parentRow = await queryOne<ParentRow>(
            conn,
            `SELECT * FROM parents
             WHERE LOWER(email) = LOWER(?)
                OR REGEXP_REPLACE(phone_number, '[^0-9]', '') = ?
             ORDER BY CASE WHEN LOWER(email) = LOWER(?) THEN 0 ELSE 1 END
             LIMIT 1`,
            [normalizedEmail, normalizedPhone, normalizedEmail]
          );
        } else {
          parentRow = await queryOne<ParentRow>(
            conn,
            `SELECT * FROM parents WHERE LOWER(email) = LOWER(?) LIMIT 1`,
            [normalizedEmail]
          );
        }

        let parent: ReturnType<typeof rowToParent>;
        if (parentRow) {
          await conn.query(
            `UPDATE parents SET parent_name = ?, phone_number = ?, email = ?, address = ? WHERE id = ?`,
            [
              input.parent.parentName,
              input.parent.phoneNumber,
              normalizedEmail,
              input.parent.address,
              parentRow.id
            ]
          );
          const updated = await queryOne<ParentRow>(conn, `SELECT * FROM parents WHERE id = ?`, [
            parentRow.id
          ]);
          parent = rowToParent(updated!);
        } else {
          const parentId = newId();
          await conn.query(
            `INSERT INTO parents (id, parent_name, phone_number, email, address) VALUES (?, ?, ?, ?, ?)`,
            [
              parentId,
              input.parent.parentName,
              input.parent.phoneNumber,
              normalizedEmail,
              input.parent.address
            ]
          );
          const inserted = await queryOne<ParentRow>(conn, `SELECT * FROM parents WHERE id = ?`, [parentId]);
          parent = rowToParent(inserted!);
        }

        const dup = await queryOne<{ id: string }>(
          conn,
          `SELECT id FROM players
           WHERE parent_id = ? AND LOWER(player_name) = LOWER(?) AND date_of_birth = ?
           LIMIT 1`,
          [parent.id, input.playerName, dateOnly(input.dateOfBirth)]
        );
        if (dup) {
          throw new Error("Player already registered under this parent.");
        }

        const playerId = newId();
        const regProfile = input.registrationProfile ?? emptyRegistrationProfile();
        const subUntil = input.subscriptionValidUntil ? dateOnly(input.subscriptionValidUntil) : null;
        await conn.query(
          `INSERT INTO players (
            id, parent_id, player_name, date_of_birth, age_group, height_cm, weight_kg,
            profile_photo_url, status, registration_status, development_notes, registration_profile, subscription_valid_until
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', 'pending', ?, ?, ?)`,
          [
            playerId,
            parent.id,
            input.playerName,
            dateOnly(input.dateOfBirth),
            input.ageGroup,
            input.heightCm,
            input.weightKg,
            input.profilePhotoUrl ?? null,
            input.developmentNotes ?? null,
            jsonParam(regProfile),
            subUntil
          ]
        );
        const pl = await queryOne<PlayerRow>(conn, `SELECT * FROM players WHERE id = ?`, [playerId]);
        await conn.commit();
        return { parent, player: rowToPlayer(pl!) };
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    },

    async createRosterPlayersFromNames(input) {
      const rows = input.rows
        .map((x) => ({ playerName: x.playerName.trim(), ageGroup: x.ageGroup }))
        .filter((x) => x.playerName);
      if (rows.length === 0) return { created: [], skippedNames: [] };

      const lowered = rows.map((n) => n.playerName.toLowerCase());
      const placeholders = lowered.map(() => "?").join(", ");
      const dupRows = await queryRows<{ player_name: string }>(
        pool,
        `SELECT player_name FROM players WHERE LOWER(player_name) IN (${placeholders})`,
        lowered
      );
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
        const parentId = newId();
        await pool.query(
          `INSERT INTO parents (id, parent_name, phone_number, email, address) VALUES (?, 'Unknown guardian', '', ?, '')`,
          [parentId, `import-${stamp}-${idSuffix}@placeholder.local`]
        );
        const playerId = newId();
        await pool.query(
          `INSERT INTO players (
            id, parent_id, player_name, date_of_birth, age_group, height_cm, weight_kg,
            profile_photo_url, status, registration_status, development_notes, registration_profile, subscription_valid_until
          ) VALUES (?, ?, ?, '2014-01-01', ?, 140, 35, NULL, 'active', 'pending', ?, ?, NULL)`,
          [
            playerId,
            parentId,
            playerName,
            rowInput.ageGroup,
            "Imported from roster CSV. Complete profile details.",
            jsonParam(emptyRegistrationProfile())
          ]
        );
        const pl = await queryOne<PlayerRow>(pool, `SELECT * FROM players WHERE id = ?`, [playerId]);
        created.push(rowToPlayer(pl!));
        existing.add(playerName.toLowerCase());
      }
      return { created, skippedNames };
    },

    async listPlayers(opts?: ListPlayersOpts) {
      const parts: string[] = [];
      const params: unknown[] = [];
      if (!opts?.includeWithdrawn) parts.push(`status <> 'withdrawn'`);
      if (opts?.group && opts.group.length > 0 && opts.group.length < 80) {
        parts.push(`age_group = ?`);
        params.push(opts.group);
      }
      if (opts?.registration && opts.registration !== "all" && REG_STATUSES.has(opts.registration)) {
        parts.push(`registration_status = ?`);
        params.push(opts.registration);
      }
      const where = parts.length ? `WHERE ${parts.join(" AND ")}` : "";
      const rows = await queryRows<PlayerRow>(
        pool,
        `SELECT * FROM players ${where} ORDER BY created_at DESC`,
        params
      );
      return rows.map(rowToPlayer);
    },

    async getPlayer(id) {
      const row = await queryOne<PlayerRow>(pool, `SELECT * FROM players WHERE id = ? LIMIT 1`, [id]);
      return row ? rowToPlayer(row) : null;
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
        row.subscription_valid_until = patch.subscriptionValidUntil
          ? dateOnly(patch.subscriptionValidUntil)
          : null;
      }
      if (patch.withdrawnAt !== undefined) row.withdrawn_at = patch.withdrawnAt ?? null;
      if (Object.keys(row).length === 0) return db.getPlayer(id);
      const { sql, values } = buildUpdateSet(row, JSON_COLS);
      await pool.query(`UPDATE players SET ${sql} WHERE id = ?`, [...values, id]);
      return db.getPlayer(id);
    },

    async withdrawPlayer(id) {
      const now = new Date().toISOString();
      await pool.query(`UPDATE players SET status = 'withdrawn', withdrawn_at = ? WHERE id = ?`, [now, id]);
      return db.getPlayer(id);
    },

    async updateParent(parentId, patch) {
      const row: Record<string, unknown> = {};
      if (patch.parentName !== undefined) row.parent_name = patch.parentName;
      if (patch.phoneNumber !== undefined) row.phone_number = patch.phoneNumber;
      if (patch.email !== undefined) row.email = patch.email;
      if (patch.address !== undefined) row.address = patch.address;
      if (Object.keys(row).length === 0) {
        const r = await queryOne<ParentRow>(pool, `SELECT * FROM parents WHERE id = ?`, [parentId]);
        return r ? rowToParent(r) : null;
      }
      const { sql, values } = buildUpdateSet(row);
      await pool.query(`UPDATE parents SET ${sql} WHERE id = ?`, [...values, parentId]);
      const updated = await queryOne<ParentRow>(pool, `SELECT * FROM parents WHERE id = ?`, [parentId]);
      return updated ? rowToParent(updated) : null;
    },

    async updateRegistrationStatus(id, status) {
      await pool.query(`UPDATE players SET registration_status = ? WHERE id = ?`, [status, id]);
      return db.getPlayer(id);
    },

    async listParents() {
      const rows = await queryRows<ParentRow>(pool, `SELECT * FROM parents ORDER BY created_at ASC`);
      return rows.map(rowToParent);
    },

    async listPayments() {
      const rows = await queryRows<PaymentRow>(pool, `SELECT * FROM payments ORDER BY due_date ASC`);
      return rows.map(rowToPayment);
    },

    async getPayment(id) {
      const row = await queryOne<PaymentRow>(pool, `SELECT * FROM payments WHERE id = ? LIMIT 1`, [id]);
      return row ? rowToPayment(row) : null;
    },

    async listPaymentsForPlayer(playerId) {
      const rows = await queryRows<PaymentRow>(
        pool,
        `SELECT * FROM payments WHERE player_id = ? ORDER BY due_date ASC`,
        [playerId]
      );
      return rows.map(rowToPayment);
    },

    async createPayment(input) {
      const status = computePaymentStatus(input.dueDate, input.paidAt, "not_paid");
      const id = newId();
      await pool.query(
        `INSERT INTO payments (
          id, player_id, amount, currency, payment_for, paid_at, due_date, status,
          payment_method, payment_notes, mobile_money_ref, proof_url, invoice_sent_at, verified_by_label
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.playerId,
          input.amount,
          input.currency,
          input.paymentFor,
          input.paidAt ?? null,
          dateOnly(input.dueDate),
          status,
          input.paymentMethod ?? null,
          input.paymentNotes ?? null,
          input.mobileMoneyRef ?? null,
          input.proofUrl ?? null,
          input.invoiceSentAt ?? null,
          input.verifiedBy ?? null
        ]
      );
      const row = await queryOne<PaymentRow>(pool, `SELECT * FROM payments WHERE id = ?`, [id]);
      return rowToPayment(row!);
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
        row.status = paidLocked && computed !== "paid" ? "paid" : computed;
      }

      const { sql, values } = buildUpdateSet(row);
      await pool.query(`UPDATE payments SET ${sql} WHERE id = ?`, [...values, id]);
      return db.getPayment(id);
    },

    async verifyPayment(id, verifiedByLabel, extras?: VerifyPaymentExtras) {
      const cur = await queryOne<PaymentRow>(pool, `SELECT * FROM payments WHERE id = ?`, [id]);
      if (!cur) return null;
      if (cur.status === "paid" && cur.paid_at) return rowToPayment(cur);

      const paidAt = new Date().toISOString();
      const method = extras?.paymentMethod !== undefined ? extras.paymentMethod : cur.payment_method;
      const notes = extras?.paymentNotes !== undefined ? extras.paymentNotes : cur.payment_notes;
      const mm = extras?.mobileMoneyRef !== undefined ? extras.mobileMoneyRef : cur.mobile_money_ref;

      const [result] = await pool.query(
        `UPDATE payments SET paid_at = ?, status = 'paid', verified_by_label = ?,
         payment_method = ?, payment_notes = ?, mobile_money_ref = ?
         WHERE id = ? AND status <> 'paid'`,
        [paidAt, verifiedByLabel, method ?? null, notes ?? null, mm ?? null, id]
      );
      const affected = (result as { affectedRows?: number }).affectedRows ?? 0;
      if (affected === 0) {
        const fresh = await queryOne<PaymentRow>(pool, `SELECT * FROM payments WHERE id = ?`, [id]);
        return fresh ? rowToPayment(fresh) : null;
      }
      const row = await queryOne<PaymentRow>(pool, `SELECT * FROM payments WHERE id = ?`, [id]);
      return row ? rowToPayment(row) : null;
    },

    async listSessions(ageGroup) {
      const sql =
        ageGroup && ageGroup.length > 0 && ageGroup.length < 80
          ? `SELECT * FROM timetable_sessions WHERE age_group = ? ORDER BY starts_at ASC`
          : `SELECT * FROM timetable_sessions ORDER BY starts_at ASC`;
      const params = ageGroup && ageGroup.length > 0 && ageGroup.length < 80 ? [ageGroup] : [];
      const rows = await queryRows<SessionRow>(pool, sql, params);
      return rows.map((r) => rowToSession({ ...r, is_updated: Boolean(r.is_updated) }));
    },

    async getSession(id) {
      const row = await queryOne<SessionRow>(pool, `SELECT * FROM timetable_sessions WHERE id = ?`, [id]);
      return row ? rowToSession({ ...row, is_updated: Boolean(row.is_updated) }) : null;
    },

    async createSession(input) {
      const s = sessionToInsert(input);
      const id = newId();
      await pool.query(
        `INSERT INTO timetable_sessions (
          id, title, age_group, age_groups, kind, starts_at, ends_at, location_name, kit_requirements,
          trainer_name, activities, session_objectives, equipment_notes, instructor_notes,
          is_updated, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          s.title,
          s.age_group,
          jsonParam(s.age_groups),
          s.kind,
          s.starts_at,
          s.ends_at,
          s.location_name,
          s.kit_requirements,
          s.trainer_name,
          jsonParam(s.activities),
          s.session_objectives,
          s.equipment_notes,
          s.instructor_notes,
          s.is_updated ? 1 : 0,
          s.updated_at
        ]
      );
      const row = await queryOne<SessionRow>(pool, `SELECT * FROM timetable_sessions WHERE id = ?`, [id]);
      return rowToSession({ ...row!, is_updated: Boolean(row!.is_updated) });
    },

    async updateSession(id, patch) {
      const row = sessionPatchToRow(patch);
      if (row.is_updated !== undefined) row.is_updated = row.is_updated ? 1 : 0;
      if (Object.keys(row).length === 0) return db.getSession(id);
      const { sql, values } = buildUpdateSet(row, JSON_COLS);
      await pool.query(`UPDATE timetable_sessions SET ${sql} WHERE id = ?`, [...values, id]);
      return db.getSession(id);
    },

    async deleteSession(id) {
      const [result] = await pool.query(`DELETE FROM timetable_sessions WHERE id = ?`, [id]);
      return ((result as { affectedRows?: number }).affectedRows ?? 0) > 0;
    },

    async getParentByPlayerId(playerId) {
      const player = await db.getPlayer(playerId);
      if (!player) return null;
      const row = await queryOne<ParentRow>(pool, `SELECT * FROM parents WHERE id = ?`, [player.parentId]);
      return row ? rowToParent(row) : null;
    },

    async listPerformance(playerId) {
      const rows = await queryRows<PerformanceRow>(
        pool,
        `SELECT * FROM performance_entries WHERE player_id = ? ORDER BY happened_on DESC`,
        [playerId]
      );
      return rows.map(rowToPerformance);
    },

    async addPerformance(input) {
      const id = newId();
      await pool.query(
        `INSERT INTO performance_entries (id, player_id, happened_on, notes, focus_area) VALUES (?, ?, ?, ?, ?)`,
        [id, input.playerId, dateOnly(input.date), input.notes, input.focusArea ?? null]
      );
      const row = await queryOne<PerformanceRow>(pool, `SELECT * FROM performance_entries WHERE id = ?`, [id]);
      return rowToPerformance(row!);
    },

    async listMessages() {
      const rows = await queryRows<MessageRow>(
        pool,
        `SELECT * FROM admin_messages ORDER BY created_at DESC`
      );
      return rows.map(rowToMessage);
    },

    async addMessage(input) {
      const id = newId();
      await pool.query(
        `INSERT INTO admin_messages (id, channel, player_id, age_group, subject, body, sent_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.channel,
          input.playerId ?? null,
          input.ageGroup ?? null,
          input.subject,
          input.body,
          input.sentBy
        ]
      );
      const row = await queryOne<MessageRow>(pool, `SELECT * FROM admin_messages WHERE id = ?`, [id]);
      return rowToMessage(row!);
    },

    async adminShellSummary(): Promise<AdminShellSummary> {
      const [pendingRows, messageRows, openRows] = await Promise.all([
        queryRows<{ c: number }>(
          pool,
          `SELECT COUNT(*) AS c FROM players WHERE registration_status = 'pending'`
        ),
        queryRows<{ c: number }>(pool, `SELECT COUNT(*) AS c FROM admin_messages`),
        queryRows<{ c: number }>(pool, `SELECT COUNT(*) AS c FROM payments WHERE status <> 'paid'`)
      ]);
      return {
        pendingApplications: Number(pendingRows[0]?.c ?? 0),
        messageCount: Number(messageRows[0]?.c ?? 0),
        openInvoicesCount: Number(openRows[0]?.c ?? 0)
      };
    },

    async getSiteContent() {
      const row = await queryOne<{ content: unknown }>(
        pool,
        `SELECT content FROM site_config WHERE id = 1 LIMIT 1`
      );
      const raw = row?.content;
      const parsed =
        typeof raw === "string"
          ? (JSON.parse(raw) as Partial<SiteContent>)
          : (raw as Partial<SiteContent> | undefined);
      return mergeStoredSiteContent(parsed ?? null);
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
      await pool.query(
        `INSERT INTO site_config (id, content, updated_at) VALUES (1, ?, NOW())
         ON DUPLICATE KEY UPDATE content = VALUES(content), updated_at = NOW()`,
        [jsonParam(content)]
      );
      return content;
    }
  };

  return db;
}
