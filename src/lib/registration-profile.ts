import type { RegistrationApiPayload } from "@/lib/registration-schema";
import type { RegistrationProfile } from "@/lib/types";

export const POSITION_LABELS: Record<string, string> = {
  goalkeeper: "Goalkeeper",
  defender: "Defender",
  midfielder: "Midfielder",
  forward: "Forward / Striker",
  unsure: "Not sure yet"
};

export const FOOT_LABELS: Record<string, string> = {
  right: "Right foot",
  left: "Left foot",
  both: "Both feet"
};

export const RELATIONSHIP_LABELS: Record<string, string> = {
  father: "Father",
  mother: "Mother",
  guardian: "Legal guardian",
  other: "Other"
};

export const HOW_HEARD_LABELS: Record<string, string> = {
  social_media: "Social media",
  friend: "Friend or family",
  school: "School",
  event: "Event or open day",
  online_search: "Online search",
  other: "Other"
};

export function emptyRegistrationProfile(): RegistrationProfile {
  return {
    nationality: "",
    position: "",
    preferredFoot: "",
    previousClub: "",
    parentRelationship: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    medicalInfo: "",
    howHeard: ""
  };
}

export function registrationProfileFromApi(data: RegistrationApiPayload): RegistrationProfile {
  return {
    nationality: data.nationality.trim(),
    position: data.position,
    preferredFoot: data.preferredFoot,
    previousClub: (data.previousClub ?? "").trim(),
    parentRelationship: data.parentRelationship,
    emergencyContactName: data.emergencyContactName.trim(),
    emergencyContactPhone: data.emergencyContactPhone.trim(),
    medicalInfo: (data.medicalInfo ?? "").trim(),
    howHeard: data.howHeard ?? ""
  };
}

export function parseRegistrationProfileRow(raw: unknown): RegistrationProfile | undefined {
  if (raw == null || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const out: RegistrationProfile = {
    nationality: typeof o.nationality === "string" ? o.nationality : "",
    position: typeof o.position === "string" ? o.position : "",
    preferredFoot: typeof o.preferredFoot === "string" ? o.preferredFoot : "",
    previousClub: typeof o.previousClub === "string" ? o.previousClub : "",
    parentRelationship: typeof o.parentRelationship === "string" ? o.parentRelationship : "",
    emergencyContactName: typeof o.emergencyContactName === "string" ? o.emergencyContactName : "",
    emergencyContactPhone: typeof o.emergencyContactPhone === "string" ? o.emergencyContactPhone : "",
    medicalInfo: typeof o.medicalInfo === "string" ? o.medicalInfo : "",
    howHeard: typeof o.howHeard === "string" ? o.howHeard : ""
  };
  const allEmpty = Object.values(out).every((v) => v === "");
  return allEmpty ? undefined : out;
}

export function mergeRegistrationProfile(
  base: RegistrationProfile | undefined,
  patch: Partial<RegistrationProfile>
): RegistrationProfile {
  return { ...emptyRegistrationProfile(), ...(base ? base : {}), ...patch };
}

export function labelPosition(v: string): string {
  return POSITION_LABELS[v] ?? (v ? v : "—");
}

export function labelFoot(v: string): string {
  return FOOT_LABELS[v] ?? (v ? v : "—");
}

export function labelRelationship(v: string): string {
  return RELATIONSHIP_LABELS[v] ?? (v ? v : "—");
}

export function labelHowHeard(v: string): string {
  return HOW_HEARD_LABELS[v] ?? (v ? v : "—");
}
