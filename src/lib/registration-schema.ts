import { z } from "zod";
import { isAllowedNationalityOrCountry } from "./nationality-lookup";
import { registrationDateOfBirthMeetsMinAge } from "./utils";

const L = {
  PLAYER_NAME_MAX: 120,
  PARENT_NAME_MAX: 120,
  ADDRESS_MAX: 500,
  PREVIOUS_CLUB_MAX: 120,
  MEDICAL_MAX: 2000,
  PHONE_MAX: 40,
  PHONE_MIN_CHARS: 7,
  PHONE_MIN_DIGITS: 7,
  NATIONALITY_MAX_LEN: 200
} as const;

/** Allowed `<select>` values — must match `register/page.tsx` */
export const REGISTRATION_SELECT = {
  position: ["goalkeeper", "defender", "midfielder", "forward", "unsure"] as const,
  preferredFoot: ["right", "left", "both"] as const,
  parentRelationship: ["father", "mother", "guardian", "other"] as const,
  howHeard: ["social_media", "friend", "school", "event", "online_search", "other"] as const
} as const;

function countDigits(s: string): number {
  return (s.match(/\d/g) ?? []).length;
}

function phoneField(label: "parent" | "emergency") {
  const short =
    label === "parent"
      ? "Enter a phone number with at least 7 characters."
      : "Enter a valid emergency phone number.";
  const digits =
    label === "parent"
      ? "Include at least 7 digits in the phone number."
      : "Include at least 7 digits in the emergency phone number.";
  return z
    .string()
    .trim()
    .min(L.PHONE_MIN_CHARS, short)
    .max(L.PHONE_MAX)
    .refine((s) => countDigits(s) >= L.PHONE_MIN_DIGITS, digits);
}

/**
 * Validates nationality / country against the ISO-derived English allowlist
 * (`nationality-allowlist.json`, built from world-countries).
 */
export function nationalityValidationMessage(raw: string, required: boolean): string | null {
  const s = raw.trim();
  if (s.length === 0) {
    return required ? "Enter nationality." : null;
  }
  if (s.length > L.NATIONALITY_MAX_LEN) {
    return "Nationality is too long.";
  }
  if (!isAllowedNationalityOrCountry(s)) {
    return "Choose an English country or nationality from the list (e.g. Rwanda or Rwandan). Fix spelling if it still fails.";
  }
  return null;
}

const dateOfBirthField = z
  .string()
  .min(8, "Choose a complete date of birth.")
  .superRefine((s, ctx) => {
    const r = registrationDateOfBirthMeetsMinAge(s);
    if (!r.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: r.message });
  });

const nationalityField = z.string().trim().superRefine((s, ctx) => {
  const msg = nationalityValidationMessage(s, true);
  if (msg) ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
});

function numericCmField(emptyMsg: string, rangeMsg: string) {
  return z.string().trim().superRefine((s, ctx) => {
    if (s === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: emptyMsg });
      return;
    }
    const n = Number(s);
    if (!Number.isFinite(n) || n < 60 || n > 220) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: rangeMsg });
    }
  });
}

function numericKgField(emptyMsg: string, rangeMsg: string) {
  return z.string().trim().superRefine((s, ctx) => {
    if (s === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: emptyMsg });
      return;
    }
    const n = Number(s);
    if (!Number.isFinite(n) || n < 15 || n > 150) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: rangeMsg });
    }
  });
}

function selectFrom(list: readonly string[], emptyMessage: string, invalidMessage: string) {
  return z
    .string()
    .min(1, emptyMessage)
    .refine((s) => list.includes(s), invalidMessage);
}

function emptyableString(max: number, tooLongMsg: string) {
  return z.preprocess(
    (v) => (v === undefined || v === null ? "" : String(v)),
    z.string().max(max, tooLongMsg)
  );
}

const registrationSharedShape = {
  playerName: z
    .string()
    .trim()
    .min(2, "Enter the player’s full name (at least 2 characters).")
    .max(L.PLAYER_NAME_MAX, `Player name must be at most ${L.PLAYER_NAME_MAX} characters.`),
  dateOfBirth: dateOfBirthField,
  position: selectFrom(
    REGISTRATION_SELECT.position,
    "Select a playing position.",
    "Select a valid playing position."
  ),
  preferredFoot: selectFrom(
    REGISTRATION_SELECT.preferredFoot,
    "Select which foot is preferred.",
    "Select a valid foot preference."
  ),
  nationality: nationalityField,
  previousClub: emptyableString(L.PREVIOUS_CLUB_MAX, `Previous club must be at most ${L.PREVIOUS_CLUB_MAX} characters.`),
  heightCm: numericCmField("Enter height in centimetres.", "Height must be between 60 and 220 cm."),
  weightKg: numericKgField("Enter weight in kilograms.", "Weight must be between 15 and 150 kg."),
  parentRelationship: selectFrom(
    REGISTRATION_SELECT.parentRelationship,
    "Select relationship to the player.",
    "Select a valid relationship."
  ),
  parentName: z
    .string()
    .trim()
    .min(2, "Enter the guardian’s full name (at least 2 characters).")
    .max(L.PARENT_NAME_MAX, `Guardian name must be at most ${L.PARENT_NAME_MAX} characters.`),
  phoneNumber: phoneField("parent"),
  email: z
    .string()
    .trim()
    .min(1, "Enter an email address.")
    .email("Enter a valid email address.")
    .max(254, "Email address is too long."),
  address: z
    .string()
    .trim()
    .min(5, "Enter a fuller street address (at least 5 characters).")
    .max(L.ADDRESS_MAX, `Address must be at most ${L.ADDRESS_MAX} characters.`),
  emergencyContactName: z
    .string()
    .trim()
    .min(2, "Enter the emergency contact’s name.")
    .max(L.PARENT_NAME_MAX, `Name must be at most ${L.PARENT_NAME_MAX} characters.`),
  emergencyContactPhone: phoneField("emergency"),
  medicalInfo: emptyableString(L.MEDICAL_MAX, `Medical information must be at most ${L.MEDICAL_MAX} characters.`),
  howHeard: z.preprocess(
    (v) => (v === undefined || v === null ? "" : String(v)),
    z
      .string()
      .refine(
        (s) => s === "" || (REGISTRATION_SELECT.howHeard as readonly string[]).includes(s),
        "Select a valid option or leave blank."
      )
  )
};

/**
 * Stricter client validation aligned with the registration UI (inline messages).
 */
export const registrationFormSchema = z.object(registrationSharedShape).superRefine((data, ctx) => {
  const n = data.playerName.trim().toLowerCase();
  const g = data.parentName.trim().toLowerCase();
  if (n.length >= 2 && g.length >= 2 && n === g) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["playerName"],
      message: "Player name and guardian name must be different people."
    });
  }
});

const heightApi = z.coerce
  .number({ invalid_type_error: "Enter height in centimetres." })
  .refine((n) => Number.isFinite(n) && n >= 60 && n <= 220, "Height must be between 60 and 220 cm.");

const weightApi = z.coerce
  .number({ invalid_type_error: "Enter weight in kilograms." })
  .refine((n) => Number.isFinite(n) && n >= 15 && n <= 150, "Weight must be between 15 and 150 kg.");

/**
 * Server-side registration body (coerces numeric strings from JSON).
 * Matches public form rules so direct API calls cannot bypass them.
 */
export const registrationApiSchema = z
  .object({
    ...registrationSharedShape,
    heightCm: heightApi,
    weightKg: weightApi
  })
  .superRefine((data, ctx) => {
    const n = data.playerName.trim().toLowerCase();
    const g = data.parentName.trim().toLowerCase();
    if (n.length >= 2 && g.length >= 2 && n === g) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["playerName"],
        message: "Player name and guardian name must be different people."
      });
    }
  });

export type RegistrationApiPayload = z.infer<typeof registrationApiSchema>;
export type RegistrationFormState = z.infer<typeof registrationFormSchema>;

export const initialRegistrationForm: RegistrationFormState = {
  playerName: "",
  dateOfBirth: "",
  position: "",
  preferredFoot: "",
  nationality: "",
  previousClub: "",
  heightCm: "",
  weightKg: "",
  parentRelationship: "",
  parentName: "",
  phoneNumber: "",
  email: "",
  address: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  medicalInfo: "",
  howHeard: ""
};

export const REGISTRATION_FORM_KEYS = Object.keys(initialRegistrationForm) as (keyof RegistrationFormState)[];

export function regFieldAnchorId(key: keyof RegistrationFormState): string {
  return `reg-field-${String(key)}`;
}

export function regInputId(key: keyof RegistrationFormState): string {
  return `reg-in-${String(key)}`;
}

/** First field error from API `issues` payload (Zod flatten), for user-visible submit errors. */
export function firstRegistrationApiFieldError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const issues = (payload as { issues?: { fieldErrors?: Record<string, string[] | undefined> } }).issues;
  const fe = issues?.fieldErrors;
  if (!fe) return null;
  for (const key of REGISTRATION_FORM_KEYS) {
    const msgs = fe[key as string];
    if (msgs?.[0]) return msgs[0];
  }
  return null;
}

/** First field key that has an API validation error (for scroll-to-field). */
export function firstRegistrationApiFieldKey(payload: unknown): keyof RegistrationFormState | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const fe = (payload as { issues?: { fieldErrors?: Record<string, string[] | undefined> } }).issues?.fieldErrors;
  if (!fe) return undefined;
  for (const key of REGISTRATION_FORM_KEYS) {
    if (fe[key as string]?.length) return key;
  }
  return undefined;
}
