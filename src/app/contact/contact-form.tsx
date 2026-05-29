"use client";

import { useRef, useState } from "react";

type Status = "idle" | "sending" | "success" | "error";

type FieldErrors = {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(name: string, email: string, subject: string, message: string): FieldErrors {
  const errs: FieldErrors = {};
  if (!name) errs.name = "Please enter your full name.";
  if (!email) errs.email = "Please enter your email address.";
  else if (!EMAIL_RE.test(email)) errs.email = "Please enter a valid email address.";
  if (!subject) errs.subject = "Please choose an enquiry type.";
  if (!message) errs.message = "Please write a message.";
  else if (message.length < 10) errs.message = "Message must be at least 10 characters.";
  return errs;
}

export default function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;

    const fd = new FormData(e.currentTarget);
    const name    = (fd.get("name")    as string ?? "").trim();
    const email   = (fd.get("email")   as string ?? "").trim();
    const subject = (fd.get("subject") as string ?? "").trim();
    const message = (fd.get("message") as string ?? "").trim();

    const errs = validate(name, email, subject, message);
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setStatus("error");
      return;
    }

    setFieldErrors({});
    setGlobalError("");
    setStatus("sending");

    try {
      const res = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, message: `[${subject}] ${message}` })
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error("Too many messages sent recently. Please try again later.");
        }
        throw new Error(data.message ?? "Could not send message. Please try again.");
      }
      setStatus("success");
      formRef.current?.reset();
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : "Unexpected error. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="contact-form__success" role="status">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden className="contact-form__success-icon">
          <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
          <path d="M7 12.5l3.5 3.5 6.5-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="contact-form__success-heading">Message sent!</p>
        <p className="contact-form__success-text">
          We&apos;ll get back to you within office hours. Check your inbox for a confirmation.
        </p>
        <button type="button" className="btn btn-secondary" onClick={() => { setStatus("idle"); setFieldErrors({}); setGlobalError(""); }}>
          Send another message
        </button>
      </div>
    );
  }

  const isSending = status === "sending";

  return (
    <form className="contact-form" ref={formRef} noValidate onSubmit={handleSubmit}>
      {globalError && (
        <p className="form-message form-message--error" role="alert">{globalError}</p>
      )}

      <div className="contact-form__panel">
        {/* Name + Email row */}
        <div className="contact-form__split">
          <div className="contact-form__field">
            <label htmlFor="contact-name" className="contact-form__label">Full name</label>
            <input
              id="contact-name"
              name="name"
              type="text"
              autoComplete="name"
              className={`input-field contact-form__control${fieldErrors.name ? " input-field--error" : ""}`}
              placeholder="Jane Doe"
              disabled={isSending}
              aria-describedby={fieldErrors.name ? "contact-name-err" : undefined}
              onChange={() => setFieldErrors((p) => ({ ...p, name: undefined }))}
            />
            {fieldErrors.name && (
              <span id="contact-name-err" className="contact-form__field-error" role="alert">{fieldErrors.name}</span>
            )}
          </div>

          <div className="contact-form__field">
            <label htmlFor="contact-email" className="contact-form__label">Email</label>
            <input
              id="contact-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              className={`input-field contact-form__control${fieldErrors.email ? " input-field--error" : ""}`}
              placeholder="you@example.com"
              disabled={isSending}
              aria-describedby={fieldErrors.email ? "contact-email-err" : undefined}
              onChange={() => setFieldErrors((p) => ({ ...p, email: undefined }))}
            />
            {fieldErrors.email && (
              <span id="contact-email-err" className="contact-form__field-error" role="alert">{fieldErrors.email}</span>
            )}
          </div>
        </div>

        {/* Enquiry type */}
        <div className="contact-form__field">
          <label htmlFor="contact-subject" className="contact-form__label">Enquiry type</label>
          <select
            id="contact-subject"
            name="subject"
            className={`input-field contact-form__control contact-form__select${fieldErrors.subject ? " input-field--error" : ""}`}
            disabled={isSending}
            defaultValue=""
            aria-describedby={fieldErrors.subject ? "contact-subject-err" : undefined}
            onChange={() => setFieldErrors((p) => ({ ...p, subject: undefined }))}
          >
            <option value="" disabled>Select a topic…</option>
            <option value="Registration & enrolment">Registration &amp; enrolment</option>
            <option value="Trial request">Trial request</option>
            <option value="Fees & payments">Fees &amp; payments</option>
            <option value="Schedule & timetable">Schedule &amp; timetable</option>
            <option value="Events & camps">Events &amp; camps</option>
            <option value="General enquiry">General enquiry</option>
          </select>
          {fieldErrors.subject && (
            <span id="contact-subject-err" className="contact-form__field-error" role="alert">{fieldErrors.subject}</span>
          )}
        </div>

        {/* Message */}
        <div className="contact-form__field">
          <label htmlFor="contact-message" className="contact-form__label">
            Your message
            <span className="contact-form__label-hint">min. 10 characters</span>
          </label>
          <textarea
            id="contact-message"
            name="message"
            rows={5}
            className={`input-field contact-form__control${fieldErrors.message ? " input-field--error" : ""}`}
            placeholder="Tell us how we can help…"
            disabled={isSending}
            aria-describedby={fieldErrors.message ? "contact-message-err" : undefined}
            onChange={() => setFieldErrors((p) => ({ ...p, message: undefined }))}
          />
          {fieldErrors.message && (
            <span id="contact-message-err" className="contact-form__field-error" role="alert">{fieldErrors.message}</span>
          )}
        </div>
      </div>

      <div className="contact-form__footer">
        <p className="contact-form__privacy muted">
          Your details are used only to respond to your enquiry and will not be shared.
        </p>
        <button type="submit" className="btn contact-form__submit" disabled={isSending}>
          {isSending ? (
            <>
              <span className="contact-form__spinner" aria-hidden />
              Sending…
            </>
          ) : (
            <>
              <svg className="contact-form__submit-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Send message
            </>
          )}
        </button>
      </div>
    </form>
  );
}
