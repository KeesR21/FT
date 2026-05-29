export type ActivityActorKind = "admin" | "parent" | "system";

/** Stable action keys for filtering in the Activity Logs UI. */
export const ACTIVITY_ACTIONS = [
  "admin.login.success",
  "admin.login.failure",
  "admin.logout",
  "admin.session.timeout",
  "parent.login.success",
  "parent.login.failure",
  "parent.logout",
  "parent.login.google",
  "admin.password.change",
  "admin.password.reset",
  "admin.password.reset.request",
  "parent.password.change",
  "parent.password.reset",
  "parent.password.reset.request",
  "kit.create",
  "kit.update",
  "kit.archive",
  "kit_order.update",
  "payment.verify",
  "player.update",
  "registration.status",
  "portal.order.create"
] as const;

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export type ActivityLogEntry = {
  id: string;
  ts: string;
  actorKind: ActivityActorKind;
  /** Stable id: admin email lower, parent account id, or "system". */
  actorId?: string;
  actorLabel?: string;
  action: ActivityAction | string;
  description: string;
  resourceType?: string;
  resourceId?: string;
  ip?: string | null;
  metadata?: Record<string, unknown>;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
};
