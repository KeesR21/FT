"use client";

import clsx from "clsx";
import Link from "next/link";
import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useMemo,
  useState,
  type FocusEvent,
  type ReactElement,
  type ReactNode
} from "react";
import {
  firstRegistrationApiFieldError,
  firstRegistrationApiFieldKey,
  initialRegistrationForm,
  registrationFormSchema,
  REGISTRATION_FORM_KEYS,
  regFieldAnchorId,
  regInputId,
  type RegistrationFormState
} from "@/lib/registration-schema";
import { REGISTRATION_MIN_PLAYER_AGE_YEARS } from "@/lib/utils";

function mergeRegistrationFieldControl(
  fieldKey: keyof RegistrationFormState,
  error: string | undefined,
  onBlurField: (key: keyof RegistrationFormState) => void,
  child: ReactNode
): ReactNode {
  if (!isValidElement(child)) return child;
  const invalid = Boolean(error);
  const errId = `${String(fieldKey)}-error`;
  const p = child.props as { className?: string; onBlur?: (e: FocusEvent<HTMLElement>) => void };
  return cloneElement(child as ReactElement<Record<string, unknown>>, {
    id: regInputId(fieldKey),
    "aria-invalid": invalid || undefined,
    "aria-describedby": invalid ? errId : undefined,
    className: clsx(p.className, invalid && "input-field--invalid"),
    onBlur: (e: FocusEvent<HTMLElement>) => {
      p.onBlur?.(e);
      onBlurField(fieldKey);
    }
  });
}

function SectionHeader({ step, label, sublabel }: { step: string; label: string; sublabel: string }) {
  return (
    <div className="reg-section-header">
      <div className="reg-step-badge">{step}</div>
      <div>
        <div className="reg-section-label">{label}</div>
        <div className="reg-section-sublabel">{sublabel}</div>
      </div>
    </div>
  );
}

function Field({
  fieldKey,
  label,
  required = true,
  hint,
  fullWidth,
  error,
  onFieldBlur,
  children
}: {
  fieldKey: keyof RegistrationFormState;
  label: string;
  required?: boolean;
  hint?: string;
  fullWidth?: boolean;
  error?: string;
  onFieldBlur: (key: keyof RegistrationFormState) => void;
  children: ReactNode;
}) {
  const errId = `${String(fieldKey)}-error`;
  const invalid = Boolean(error);
  const only = Children.only(children);

  return (
    <label
      id={regFieldAnchorId(fieldKey)}
      className={clsx(
        "form-label reg-field-scroll-target",
        fullWidth && "reg-field-full-width",
        invalid && "form-label--has-error"
      )}
    >
      <div className="reg-field-head">
        <span>
          {label}
          {required && <span className="reg-required"> *</span>}
          {!required && <span className="reg-optional"> (optional)</span>}
        </span>
        {hint ? <span className="reg-hint">{hint}</span> : null}
      </div>
      {mergeRegistrationFieldControl(fieldKey, error, onFieldBlur, only)}
      <div className="reg-field-foot">
        {error ? (
          <p id={errId} className="reg-field-error" role="alert">
            {error}
          </p>
        ) : (
          <div className="reg-field-foot-spacer" aria-hidden="true" />
        )}
      </div>
    </label>
  );
}

type SelectFieldProps = {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
} & Omit<React.ComponentPropsWithoutRef<"select">, "value" | "onChange">;

function SelectField({ value, onChange, options, placeholder, className, ...rest }: SelectFieldProps) {
  return (
    <select
      {...rest}
      className={clsx("input-field", className)}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

const POSITIONS = [
  { value: "goalkeeper", label: "Goalkeeper" },
  { value: "defender", label: "Defender" },
  { value: "midfielder", label: "Midfielder" },
  { value: "forward", label: "Forward / Striker" },
  { value: "unsure", label: "Not sure yet" }
];

const PREFERRED_FOOT = [
  { value: "right", label: "Right foot" },
  { value: "left", label: "Left foot" },
  { value: "both", label: "Both feet" }
];

const RELATIONSHIPS = [
  { value: "father", label: "Father" },
  { value: "mother", label: "Mother" },
  { value: "guardian", label: "Legal guardian" },
  { value: "other", label: "Other" }
];

const HOW_HEARD = [
  { value: "social_media", label: "Social media" },
  { value: "friend", label: "Friend or family" },
  { value: "school", label: "School" },
  { value: "event", label: "Event or open day" },
  { value: "online_search", label: "Online search" },
  { value: "other", label: "Other" }
];

const REGISTER_HERO_SRC = "/gallery/FTPR_25.JPG";

function RegisterHero({
  pill,
  title,
  lead,
  actions
}: {
  pill: string;
  title: string;
  lead: string;
  actions: ReactNode;
}) {
  return (
    <section className="schedule-landing-hero ks-full-bleed" aria-label="Registration hero">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={REGISTER_HERO_SRC} alt="" className="schedule-landing-hero__bg" decoding="async" />
      <div className="schedule-landing-hero__overlay" aria-hidden />
      <div className="schedule-landing-hero__inner container">
        <span className="schedule-landing-hero__pill">{pill}</span>
        <h1 className="schedule-landing-hero__title">{title}</h1>
        <p className="schedule-landing-hero__lead">{lead}</p>
        <div className="schedule-landing-hero__actions">{actions}</div>
      </div>
    </section>
  );
}

function firstInvalidFieldKey(
  fieldErrors: Partial<Record<keyof RegistrationFormState, string[] | undefined>>
): keyof RegistrationFormState | undefined {
  for (const key of REGISTRATION_FORM_KEYS) {
    const msgs = fieldErrors[key];
    if (msgs?.length) return key;
  }
  return undefined;
}

export default function RegisterPage() {
  const [form, setForm] = useState<RegistrationFormState>(initialRegistrationForm);
  const [touchedFields, setTouchedFields] = useState(() => new Set<keyof RegistrationFormState>());
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const markTouched = useCallback((key: keyof RegistrationFormState) => {
    setTouchedFields((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  const update = useCallback(
    (key: keyof RegistrationFormState, value: string) => {
      setForm((prev) => {
        const prevVal = prev[key];
        const becameNonEmpty = String(prevVal).trim() === "" && String(value).trim() !== "";
        if (becameNonEmpty) {
          queueMicrotask(() => markTouched(key));
        }
        return { ...prev, [key]: value };
      });
    },
    [markTouched]
  );

  const visibleErrors = useMemo(() => {
    const parsed = registrationFormSchema.safeParse(form);
    if (parsed.success) return {} as Partial<Record<keyof RegistrationFormState, string>>;
    const flat = parsed.error.flatten().fieldErrors;
    const out: Partial<Record<keyof RegistrationFormState, string>> = {};
    for (const key of REGISTRATION_FORM_KEYS) {
      if (!submitAttempted && !touchedFields.has(key)) continue;
      const msgs = flat[key];
      if (msgs?.[0]) out[key] = msgs[0];
    }
    return out;
  }, [form, touchedFields, submitAttempted]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitAttempted(true);
    setMessage("");
    setStatus("idle");

    const parsed = registrationFormSchema.safeParse(form);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const first = firstInvalidFieldKey(flat);
      if (first) {
        document.getElementById(regFieldAnchorId(first))?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      const raw = await res.text();
      let payload: { message?: string; issues?: unknown } = {};
      if (raw) {
        try {
          payload = JSON.parse(raw) as { message?: string; issues?: unknown };
        } catch {
          payload = { message: raw };
        }
      }
      setLoading(false);

      if (!res.ok) {
        setStatus("error");
        const fieldErr = firstRegistrationApiFieldError(payload);
        setMessage(
          fieldErr ||
            payload.message ||
            "Registration failed. Please check your details and try again."
        );
        const issues = (payload as { issues?: { fieldErrors?: Record<string, unknown> } }).issues;
        const fe = issues?.fieldErrors;
        if (fe && typeof fe === "object") {
          setTouchedFields((prev) => {
            const next = new Set(prev);
            for (const k of Object.keys(fe)) {
              if ((REGISTRATION_FORM_KEYS as readonly string[]).includes(k)) {
                next.add(k as keyof RegistrationFormState);
              }
            }
            return next;
          });
        }
        const apiKey = firstRegistrationApiFieldKey(payload);
        if (apiKey) {
          queueMicrotask(() => {
            document.getElementById(regFieldAnchorId(apiKey))?.scrollIntoView({
              behavior: "smooth",
              block: "center"
            });
          });
        }
        return;
      }

      setForm(initialRegistrationForm);
      setTouchedFields(new Set());
      setSubmitAttempted(false);
      setStatus("success");
      setMessage("Your registration has been submitted. We will review it and contact you shortly.");
    } catch {
      setLoading(false);
      setStatus("error");
      setMessage("Unable to submit right now. Please check your connection and try again.");
    }
  }

  if (status === "success") {
    return (
      <>
        <RegisterHero
          pill="Thank you"
          title="Registration submitted"
          lead="We have received your application. Expect a reply within 2–3 business days, and check your email for payment details."
          actions={
            <>
              <Link href="/" className="btn btn-secondary">
                Back to home
              </Link>
              <Link href="/fixtures" className="btn">
                View schedule
              </Link>
            </>
          }
        />

        <div className="container page-y">
          <section className="page-stack schedule-landing-stack">
            <article className="card schedule-timeline-head">
              <h2 className="page-section-title">What happens next</h2>
              <p className="muted schedule-timeline-head__lead">
                A payment request email has been sent to the address you provided. Our team will
                review your details and follow up if anything is missing.
              </p>
            </article>

            <article className="card events-page-card register-shell register-success-card">
              <div className="events-page-card__body">
                <div className="reg-success-icon">✓</div>
                <p className="events-page-card__meta">FTPR Lions Academy</p>
                <h2 className="events-page-card__title">You are on the list</h2>
                <p className="events-page-card__summary muted" style={{ margin: "0 auto", maxWidth: "52ch" }}>
                  Thank you for registering. We will be in touch shortly.
                </p>
                <div className="reg-success-steps">
                  <div className="reg-success-step">
                    <span className="reg-success-step-num">1</span>
                    <span>Application under review</span>
                  </div>
                  <div className="reg-success-step-arrow">→</div>
                  <div className="reg-success-step">
                    <span className="reg-success-step-num">2</span>
                    <span>Registration fee payment</span>
                  </div>
                  <div className="reg-success-step-arrow">→</div>
                  <div className="reg-success-step">
                    <span className="reg-success-step-num">3</span>
                    <span>Approval &amp; welcome kit</span>
                  </div>
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ marginTop: "1.75rem", alignSelf: "center" }}
                  onClick={() => {
                    setStatus("idle");
                    setForm(initialRegistrationForm);
                    setTouchedFields(new Set());
                    setSubmitAttempted(false);
                  }}
                >
                  Submit another registration
                </button>
              </div>
            </article>
          </section>
        </div>
      </>
    );
  }

  const err = (key: keyof RegistrationFormState) => visibleErrors[key];

  return (
    <>
      <RegisterHero
        pill="Registration"
        title="Player registration"
        lead="Join FTPR Lions Academy in a few minutes. Tell us about your child, your contact details, and any health information we should know."
        actions={
          <>
            <Link href="/contact" className="btn btn-secondary">
              Contact us
            </Link>
            <Link href="/programs" className="btn">
              Our programs
            </Link>
          </>
        }
      />

      <div className="container page-y">
        <section className="page-stack schedule-landing-stack">
          <article className="card schedule-timeline-head">
            <h2 className="page-section-title">Before you start</h2>
            <p className="muted schedule-timeline-head__lead">
              Complete every section below. Fields marked <span className="reg-required">*</span> are
              required. Validation messages appear after you start typing or leave a field.
            </p>
          </article>

          <article className="card events-page-card register-shell register-form-main">
            <div className="events-page-card__body">
              <p className="events-page-card__meta">Online form</p>
              <h2 className="events-page-card__title">Application details</h2>
              <p className="events-page-card__summary muted">
                Use accurate names and dates — we use them for age groups, medical safety, and
                billing.
              </p>

              <form onSubmit={submit} noValidate>

          {/* ── Section 1: Player information ── */}
          <div className="reg-section">
            <SectionHeader step="1" label="Player information" sublabel="Tell us about your child" />
            <div className="form-grid-responsive">
              <Field fieldKey="playerName" label="Full name" error={err("playerName")} onFieldBlur={markTouched}>
                <input
                  className="input-field"
                  type="text"
                  autoComplete="name"
                  placeholder="e.g. Jean-Paul Mutesa"
                  value={form.playerName}
                  onChange={(e) => update("playerName", e.target.value)}
                />
              </Field>

              <Field
                fieldKey="dateOfBirth"
                label="Date of birth"
                hint={`Player must be at least ${REGISTRATION_MIN_PLAYER_AGE_YEARS} years old; also used for age group`}
                error={err("dateOfBirth")}
                onFieldBlur={markTouched}
              >
                <input
                  className="input-field"
                  type="date"
                  autoComplete="bday"
                  value={form.dateOfBirth}
                  onChange={(e) => update("dateOfBirth", e.target.value)}
                />
              </Field>

              <Field
                fieldKey="nationality"
                label="Nationality"
                hint="Must match a real country or English demonym (e.g. Rwanda, Rwandan, United Kingdom)"
                error={err("nationality")}
                onFieldBlur={markTouched}
              >
                <input
                  className="input-field"
                  type="text"
                  autoComplete="country-name"
                  placeholder="e.g. Rwanda or Rwandan"
                  value={form.nationality}
                  onChange={(e) => update("nationality", e.target.value)}
                />
              </Field>

              <Field fieldKey="position" label="Preferred playing position" error={err("position")} onFieldBlur={markTouched}>
                <SelectField
                  value={form.position}
                  onChange={(v) => update("position", v)}
                  options={POSITIONS}
                  placeholder="Select a position…"
                />
              </Field>

              <Field fieldKey="preferredFoot" label="Preferred foot" error={err("preferredFoot")} onFieldBlur={markTouched}>
                <SelectField
                  value={form.preferredFoot}
                  onChange={(v) => update("preferredFoot", v)}
                  options={PREFERRED_FOOT}
                  placeholder="Select preferred foot…"
                />
              </Field>

              <Field fieldKey="previousClub" label="Previous club / academy" required={false} error={err("previousClub")} onFieldBlur={markTouched}>
                <input
                  className="input-field"
                  type="text"
                  placeholder="e.g. Amahoro FC (or 'None')"
                  value={form.previousClub}
                  onChange={(e) => update("previousClub", e.target.value)}
                />
              </Field>
            </div>
          </div>

          {/* ── Section 2: Physical details ── */}
          <div className="reg-section">
            <SectionHeader step="2" label="Physical details" sublabel="Current measurements help us set training benchmarks" />
            <div className="form-grid-responsive">
              <Field fieldKey="heightCm" label="Height (cm)" hint="Measure without shoes" error={err("heightCm")} onFieldBlur={markTouched}>
                <input
                  className="input-field"
                  type="number"
                  min={60}
                  max={220}
                  step={0.1}
                  inputMode="decimal"
                  placeholder="e.g. 145"
                  value={form.heightCm}
                  onChange={(e) => update("heightCm", e.target.value)}
                />
              </Field>

              <Field fieldKey="weightKg" label="Weight (kg)" error={err("weightKg")} onFieldBlur={markTouched}>
                <input
                  className="input-field"
                  type="number"
                  min={15}
                  max={150}
                  step={0.1}
                  inputMode="decimal"
                  placeholder="e.g. 40"
                  value={form.weightKg}
                  onChange={(e) => update("weightKg", e.target.value)}
                />
              </Field>
            </div>
          </div>

          {/* ── Section 3: Parent / guardian ── */}
          <div className="reg-section">
            <SectionHeader step="3" label="Parent / guardian" sublabel="Primary contact who will receive communications" />
            <div className="form-grid-responsive">
              <Field
                fieldKey="parentRelationship"
                label="Relationship to player"
                error={err("parentRelationship")}
                onFieldBlur={markTouched}
              >
                <SelectField
                  value={form.parentRelationship}
                  onChange={(v) => update("parentRelationship", v)}
                  options={RELATIONSHIPS}
                  placeholder="Select relationship…"
                />
              </Field>

              <Field fieldKey="parentName" label="Full name" error={err("parentName")} onFieldBlur={markTouched}>
                <input
                  className="input-field"
                  type="text"
                  autoComplete="name"
                  placeholder="e.g. Marie Uwimana"
                  value={form.parentName}
                  onChange={(e) => update("parentName", e.target.value)}
                />
              </Field>

              <Field
                fieldKey="phoneNumber"
                label="Phone number"
                hint="Include country code if outside Rwanda"
                error={err("phoneNumber")}
                onFieldBlur={markTouched}
              >
                <input
                  className="input-field"
                  type="tel"
                  autoComplete="tel"
                  placeholder="e.g. +250 788 123 456"
                  value={form.phoneNumber}
                  onChange={(e) => update("phoneNumber", e.target.value)}
                />
              </Field>

              <Field fieldKey="email" label="Email address" error={err("email")} onFieldBlur={markTouched}>
                <input
                  className="input-field"
                  type="email"
                  autoComplete="email"
                  placeholder="e.g. parent@example.com"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                />
              </Field>

              <Field fieldKey="address" label="Home address" hint="Street, district, city" error={err("address")} onFieldBlur={markTouched}>
                <textarea
                  className="input-field"
                  rows={3}
                  autoComplete="street-address"
                  placeholder="e.g. KG 14 Ave, Kigali"
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                />
              </Field>
            </div>
          </div>

          {/* ── Section 4: Emergency contact ── */}
          <div className="reg-section">
            <SectionHeader step="4" label="Emergency contact" sublabel="Reachable during training sessions and matches (can be the same person as above)" />
            <div className="form-grid-responsive">
              <Field fieldKey="emergencyContactName" label="Emergency contact name" error={err("emergencyContactName")} onFieldBlur={markTouched}>
                <input
                  className="input-field"
                  type="text"
                  autoComplete="name"
                  placeholder="Full name"
                  value={form.emergencyContactName}
                  onChange={(e) => update("emergencyContactName", e.target.value)}
                />
              </Field>

              <Field fieldKey="emergencyContactPhone" label="Emergency contact phone" error={err("emergencyContactPhone")} onFieldBlur={markTouched}>
                <input
                  className="input-field"
                  type="tel"
                  autoComplete="tel"
                  placeholder="e.g. +250 789 000 111"
                  value={form.emergencyContactPhone}
                  onChange={(e) => update("emergencyContactPhone", e.target.value)}
                />
              </Field>
            </div>
          </div>

          {/* ── Section 5: Health & additional info ── */}
          <div className="reg-section">
            <SectionHeader step="5" label="Health &amp; additional info" sublabel="Help us keep your child safe on and off the pitch" />
            <div className="form-grid-responsive">
              <Field
                fieldKey="medicalInfo"
                label="Medical conditions or allergies"
                required={false}
                fullWidth
                hint="e.g. asthma, nut allergy, heart condition — write 'None' if not applicable"
                error={err("medicalInfo")}
                onFieldBlur={markTouched}
              >
                <textarea
                  className="input-field"
                  rows={3}
                  placeholder="Describe any conditions our coaching staff should be aware of…"
                  value={form.medicalInfo}
                  onChange={(e) => update("medicalInfo", e.target.value)}
                />
              </Field>

              <Field fieldKey="howHeard" label="How did you hear about us?" required={false} error={err("howHeard")} onFieldBlur={markTouched}>
                <SelectField
                  value={form.howHeard}
                  onChange={(v) => update("howHeard", v)}
                  options={HOW_HEARD}
                  placeholder="Select one…"
                />
              </Field>
            </div>
          </div>

          {/* ── Submit ── */}
          <div className="reg-submit-area">
            {status === "error" && (
              <div className="reg-error-banner">
                <span className="reg-error-icon">!</span>
                <span>{message}</span>
              </div>
            )}
            <p className="reg-consent">
              By submitting this form you confirm that all information provided is accurate and
              that you consent to FTPR Lions Academy storing and processing this data for the
              purposes of player registration and academy management.
            </p>
            <button className="btn" disabled={loading} type="submit" style={{ minWidth: 220 }}>
              {loading ? (
                <>
                  <span className="reg-spinner" />
                  Submitting…
                </>
              ) : (
                "Submit registration"
              )}
            </button>
          </div>
              </form>
            </div>
          </article>
        </section>
      </div>
    </>
  );
}
