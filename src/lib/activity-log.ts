import { appendActivityLog } from "@/lib/activity-log-store";
import type { ActivityActorKind, ActivityLogEntry } from "@/lib/activity-log-types";
import { getRequestIp } from "@/lib/request-ip";

function safeJsonFragment(obj: unknown, max = 4000): Record<string, unknown> | null {
  if (obj === null || obj === undefined) return null;
  try {
    const s = JSON.stringify(obj);
    if (s.length > max) {
      return { _truncated: true, preview: s.slice(0, max) };
    }
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return { _nonSerializable: String(obj).slice(0, 500) };
  }
}

type RecordInput = Omit<ActivityLogEntry, "id" | "ts" | "ip" | "previousValue" | "newValue"> & {
  ip?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
};

/** Non-blocking audit trail — failures are logged to console only. */
export function recordActivity(req: Request | null, input: RecordInput): void {
  const ip = input.ip ?? (req ? getRequestIp(req) : null);
  const entry: Omit<ActivityLogEntry, "id" | "ts"> = {
    ...input,
    ip,
    previousValue: safeJsonFragment(input.previousValue),
    newValue: safeJsonFragment(input.newValue),
    metadata: input.metadata
  };
  void appendActivityLog(entry).catch((e) => console.error("activity-log append failed:", e));
}

export function recordSystemActivity(input: Omit<RecordInput, "actorKind"> & { actorKind?: ActivityActorKind }): void {
  recordActivity(null, {
    ...input,
    actorKind: input.actorKind ?? "system",
    actorId: input.actorId ?? "system",
    actorLabel: input.actorLabel ?? "System"
  });
}
