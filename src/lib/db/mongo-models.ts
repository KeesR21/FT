/**
 * Mongoose models for all academy collections.
 * Uses `mongoose.models` cache so Next.js hot-reload doesn't recompile schemas.
 */
import mongoose, { Schema } from "mongoose";

// ── Parents ───────────────────────────────────────────────────────────────────
const parentSchema = new Schema(
  {
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toHexString() },
    parent_name: { type: String, required: true },
    phone_number: { type: String, required: true, default: "" },
    email: { type: String, required: true },
    address: { type: String, required: true, default: "" }
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);
parentSchema.index({ email: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });
export const ParentModel =
  mongoose.models.Parent ?? mongoose.model("Parent", parentSchema, "parents");

// ── Players ───────────────────────────────────────────────────────────────────
const playerSchema = new Schema(
  {
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toHexString() },
    parent_id: { type: String, required: true, ref: "Parent" },
    player_name: { type: String, required: true },
    date_of_birth: { type: String, required: true },
    age_group: { type: String, required: true },
    height_cm: { type: Number, required: true },
    weight_kg: { type: Number, required: true },
    profile_photo_url: { type: String, default: null },
    status: { type: String, enum: ["active", "withdrawn"], default: "active" },
    registration_status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending"
    },
    development_notes: { type: String, default: null },
    registration_profile: { type: Schema.Types.Mixed, default: {} },
    subscription_valid_until: { type: String, default: null },
    withdrawn_at: { type: String, default: null }
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);
playerSchema.index({ age_group: 1 });
playerSchema.index({ registration_status: 1 });
playerSchema.index({ status: 1 });
playerSchema.index(
  { parent_id: 1, player_name: 1, date_of_birth: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);
export const PlayerModel =
  mongoose.models.Player ?? mongoose.model("Player", playerSchema, "players");

// ── Payments ──────────────────────────────────────────────────────────────────
const paymentSchema = new Schema(
  {
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toHexString() },
    player_id: { type: String, required: true, ref: "Player" },
    amount: { type: Number, required: true },
    currency: { type: String, default: "RWF" },
    payment_for: { type: String, required: true },
    paid_at: { type: String, default: null },
    due_date: { type: String, required: true },
    verified_by_label: { type: String, default: null },
    status: {
      type: String,
      enum: ["paid", "not_paid", "pending", "overdue", "expiring_soon"],
      default: "not_paid"
    },
    payment_method: { type: String, default: null },
    payment_notes: { type: String, default: null },
    mobile_money_ref: { type: String, default: null },
    proof_url: { type: String, default: null },
    invoice_sent_at: { type: String, default: null }
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);
paymentSchema.index({ player_id: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ due_date: 1 });
export const PaymentModel =
  mongoose.models.Payment ?? mongoose.model("Payment", paymentSchema, "payments");

// ── Timetable Sessions ────────────────────────────────────────────────────────
const sessionSchema = new Schema(
  {
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toHexString() },
    title: { type: String, default: "" },
    age_group: { type: String, required: true },
    age_groups: { type: [String], default: [] },
    kind: { type: String, enum: ["training", "match"], default: "training" },
    starts_at: { type: String, required: true },
    ends_at: { type: String, required: true },
    location_name: { type: String, required: true },
    kit_requirements: { type: String, default: "" },
    trainer_name: { type: String, default: "" },
    activities: { type: [String], default: [] },
    session_objectives: { type: String, default: "" },
    equipment_notes: { type: String, default: "" },
    instructor_notes: { type: String, default: "" },
    is_updated: { type: Boolean, default: false },
    updated_at: { type: String, default: null }
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);
sessionSchema.index({ age_group: 1 });
sessionSchema.index({ starts_at: 1 });
export const SessionModel =
  mongoose.models.TimetableSession ??
  mongoose.model("TimetableSession", sessionSchema, "timetable_sessions");

// ── Performance Entries ───────────────────────────────────────────────────────
const performanceSchema = new Schema(
  {
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toHexString() },
    player_id: { type: String, required: true, ref: "Player" },
    happened_on: { type: String, required: true },
    notes: { type: String, required: true },
    focus_area: { type: String, default: null }
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);
performanceSchema.index({ player_id: 1 });
export const PerformanceModel =
  mongoose.models.PerformanceEntry ??
  mongoose.model("PerformanceEntry", performanceSchema, "performance_entries");

// ── Admin Messages ────────────────────────────────────────────────────────────
const messageSchema = new Schema(
  {
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toHexString() },
    channel: { type: String, enum: ["individual", "group"], required: true },
    player_id: { type: String, default: null },
    age_group: { type: String, default: null },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    sent_by: { type: String, required: true }
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);
messageSchema.index({ created_at: -1 });
export const MessageModel =
  mongoose.models.AdminMessage ??
  mongoose.model("AdminMessage", messageSchema, "admin_messages");

// ── Site Config ───────────────────────────────────────────────────────────────
const siteConfigSchema = new Schema({
  _id: { type: Number, default: 1 },
  content: { type: Schema.Types.Mixed, default: {} },
  updated_at: { type: String, default: () => new Date().toISOString() }
});
export const SiteConfigModel =
  mongoose.models.SiteConfig ??
  mongoose.model("SiteConfig", siteConfigSchema, "site_config");

// ── Weekly timetable snapshot (full store blob) ───────────────────────────────
const scheduleStateSchema = new Schema({
  _id: { type: String, default: "main" },
  payload: { type: Schema.Types.Mixed, default: {} },
  updated_at: { type: String, default: () => new Date().toISOString() }
});
export const ScheduleStateModel =
  mongoose.models.ScheduleState ??
  mongoose.model("ScheduleState", scheduleStateSchema, "weekly_schedule_state");

// ── Contact form submissions ────────────────────────────────────────────────────
const contactSubmissionSchema = new Schema(
  {
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toHexString() },
    name: { type: String, required: true },
    email: { type: String, required: true },
    message: { type: String, required: true },
    enquiry_type: { type: String, default: null },
    read_at: { type: String, default: null },
    deleted_at: { type: String, default: null }
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);
contactSubmissionSchema.index({ created_at: -1 });
contactSubmissionSchema.index({ deleted_at: 1 });
export const ContactSubmissionModel =
  mongoose.models.ContactSubmission ??
  mongoose.model("ContactSubmission", contactSubmissionSchema, "contact_submissions");
