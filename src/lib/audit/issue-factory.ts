import { randomUUID } from "crypto";
import type { AuditIssue } from "@/lib/audit/types";

export function issue(input: Omit<AuditIssue, "id"> & { id?: string }): AuditIssue {
  const { id, ...rest } = input;
  return { id: id ?? randomUUID(), ...rest };
}
