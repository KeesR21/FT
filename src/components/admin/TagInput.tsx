"use client";

import { useState, type KeyboardEvent } from "react";

type Props = {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  hint?: string;
};

export function TagInput({ label, values, onChange, placeholder, hint }: Props) {
  const [draft, setDraft] = useState("");

  function addTag(raw: string) {
    const t = raw.trim();
    if (!t) return;
    if (values.some((v) => v.toLowerCase() === t.toLowerCase())) return;
    onChange([...values, t]);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === "Backspace" && !draft && values.length) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <label className="form-label admin-tag-input">
      <span>{label}</span>
      {hint ? <span className="muted admin-tag-input__hint">{hint}</span> : null}
      <div className="admin-tag-input__box">
        {values.map((v) => (
          <span key={v} className="admin-tag-input__tag">
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>
              ×
            </button>
          </span>
        ))}
        <input
          className="admin-tag-input__field"
          value={draft}
          placeholder={placeholder ?? "Type and press Enter"}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => addTag(draft)}
        />
      </div>
    </label>
  );
}
