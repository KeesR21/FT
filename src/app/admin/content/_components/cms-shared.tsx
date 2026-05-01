"use client";

import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { maxEdgeForCmsUsage } from "../_lib/resize-image-for-upload";
import { uploadImageToCms } from "../_lib/cms-upload-image";

export function CmsPreviewLink({
  href,
  children,
  className
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={clsx("cms-preview-link", className)} target="_blank" rel="noreferrer">
      {children}
    </Link>
  );
}

export type CmsImageFieldUsage = "banner" | "section" | "card" | "thumb" | "logo";

function LogoMarkPlaceholder({ className }: { className?: string }) {
  return (
    <svg className={className} width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden>
      <rect x="7" y="7" width="30" height="30" rx="8" stroke="currentColor" strokeWidth="1.5" opacity="0.28" />
      <path d="M14 30 L22 16 L30 30 Z" fill="currentColor" opacity="0.12" />
      <circle cx="22" cy="22" r="4" fill="currentColor" opacity="0.2" />
    </svg>
  );
}

function CmsImageUploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden>
      <path
        d="M14 34h20a4 4 0 0 0 4-4V18a4 4 0 0 0-4-4h-3l-1.5-3h-11L17 14h-3a4 4 0 0 0-4 4v16a4 4 0 0 0 4 4Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        opacity="0.35"
      />
      <path
        d="M18 26.5 22.2 22l3.3 3.5L30 19"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="34" cy="16" r="3" fill="currentColor" opacity="0.2" />
    </svg>
  );
}

export function CmsImageField({
  label,
  value,
  onChange,
  help,
  usage = "card"
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  help?: string;
  /** Controls preview size (like on the public site) and max upload resize edge. */
  usage?: CmsImageFieldUsage;
}) {
  const uid = useId();
  const urlInputId = `${uid}-url`;
  const helpId = `${uid}-help`;
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [copied, setCopied] = useState(false);

  const maxEdge = useMemo(() => maxEdgeForCmsUsage(usage), [usage]);
  const previewSizes = useMemo(() => {
    switch (usage) {
      case "banner":
        return "100vw";
      case "section":
        return "(max-width: 768px) 100vw, min(960px, 85vw)";
      case "thumb":
        return "220px";
      case "logo":
        return "200px";
      default:
        return "(max-width: 640px) 100vw, min(560px, 55vw)";
    }
  }, [usage]);

  const upload = useCallback(
    async (file: File) => {
      setUploadErr("");
      setUploading(true);
      try {
        const result = await uploadImageToCms(file, maxEdge);
        if (!result.ok) {
          setUploadErr(result.message);
          return;
        }
        onChange(result.url);
      } finally {
        setUploading(false);
      }
    },
    [onChange, maxEdge]
  );

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    setDragActive(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragActive(false);
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepth.current = 0;
      setDragActive(false);
      const f = e.dataTransfer.files?.[0];
      if (!f) return;
      if (!/^image\//.test(f.type)) {
        setUploadErr("Please drop an image file (JPEG, PNG, WebP, or GIF).");
        return;
      }
      void upload(f);
    },
    [upload]
  );

  const pickFiles = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) void upload(f);
      e.target.value = "";
    },
    [upload]
  );

  const copyUrl = useCallback(async () => {
    if (!value.trim()) return;
    try {
      await navigator.clipboard.writeText(value.trim());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setUploadErr("Could not copy to clipboard.");
    }
  }, [value]);

  return (
    <div className={clsx("cms-field-block cms-image-field", `cms-image-field--usage-${usage}`)}>
      <div className="cms-image-field__head">
        <span className="cms-image-field__title">{label}</span>
        {value ? (
          <button type="button" className="cms-image-field__text-btn" onClick={() => onChange("")}>
            Clear image
          </button>
        ) : null}
      </div>

      <div
        className={clsx(
          "cms-image-field__surface",
          dragActive && "cms-image-field__surface--drag",
          uploading && "cms-image-field__surface--busy",
          value && "cms-image-field__surface--has-image"
        )}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="visually-hidden"
          aria-label={`Choose image file for ${label}`}
          onChange={onFileChange}
        />

        {usage === "logo" ? (
          <div className="cms-image-field__logo-workspace">
            <div className="cms-image-field__logo-mat">
              {value ? (
                <div className="cms-image-field__logo-view">
                  <Image
                    src={value}
                    alt=""
                    fill
                    className="cms-image-field__logo-view-img"
                    sizes={previewSizes}
                    unoptimized
                  />
                </div>
              ) : (
                <div className="cms-image-field__logo-empty">
                  <LogoMarkPlaceholder className="cms-image-field__logo-empty-icon" />
                  <p className="cms-image-field__logo-empty-title">Logo preview</p>
                  <p className="cms-image-field__logo-empty-sub">Drop a file on this square</p>
                </div>
              )}
            </div>
            <div className="cms-image-field__logo-rail">
              <p className="cms-image-field__logo-rail-kicker">Fit on the site</p>
              <p className="cms-image-field__logo-rail-lead">
                The live hero shows your mark with <strong>contain</strong> inside a centered panel — wide or tall logos stay fully
                visible; transparent PNGs work well on the gradient behind it.
              </p>
              <ul className="cms-image-field__logo-tips">
                <li>Prefer PNG or WebP with a clear silhouette.</li>
                <li>512px max edge on upload keeps files light.</li>
              </ul>
              <button type="button" className="cms-image-field__logo-action" onClick={pickFiles} disabled={uploading}>
                {uploading ? "Uploading…" : value ? "Replace logo…" : "Choose logo file…"}
              </button>
              <p className="cms-image-field__logo-rail-hint">Or drag a PNG / WebP / JPEG onto the square.</p>
            </div>
          </div>
        ) : value ? (
          <div className="cms-image-field__preview">
            <Image
              src={value}
              alt=""
              fill
              className="cms-image-field__preview-img"
              sizes={previewSizes}
              unoptimized
            />
            <div className="cms-image-field__preview-scrim" aria-hidden />
            <div className="cms-image-field__preview-actions">
              <button type="button" className="cms-image-field__pill-btn" onClick={pickFiles} disabled={uploading}>
                Replace
              </button>
              <p className="cms-image-field__drop-note">or drop a new file anywhere on this card</p>
            </div>
          </div>
        ) : (
          <div className="cms-image-field__empty">
            <CmsImageUploadIcon className="cms-image-field__empty-icon" />
            <p className="cms-image-field__empty-title">Drop an image here</p>
            <p className="cms-image-field__empty-sub">JPEG, PNG, WebP, or GIF</p>
            <button type="button" className="cms-image-field__primary-btn" onClick={pickFiles} disabled={uploading}>
              {uploading ? "Uploading…" : "Browse files"}
            </button>
          </div>
        )}

        {uploading ? (
          <div className="cms-image-field__busy" aria-live="polite">
            <span className="cms-image-field__busy-spinner" aria-hidden />
            <span>Uploading…</span>
          </div>
        ) : null}

        {dragActive ? (
          <div className="cms-image-field__drag-overlay" aria-hidden>
            <span>Release to upload</span>
          </div>
        ) : null}
      </div>

      <div className="cms-image-field__url">
        <label className="cms-image-field__url-label" htmlFor={urlInputId}>
          {usage === "logo" ? "Logo path or URL" : "Image URL"}
        </label>
        <div className="cms-image-field__url-row">
          <input
            id={urlInputId}
            className="input-field cms-image-field__url-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={usage === "logo" ? "/images/club-mark.png or https://…" : "/images/your-photo.jpg or https://…"}
            spellCheck={false}
            aria-describedby={help ? helpId : undefined}
          />
          <button
            type="button"
            className="cms-image-field__icon-btn"
            onClick={() => void copyUrl()}
            disabled={!value.trim()}
            title="Copy URL"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="cms-image-field__meta-hint">
          {usage === "logo" ? (
            <>
              The square preview mirrors how the mark sits in the hero panel. Logos are resized to at most {maxEdge}px on the longest
              edge; GIF is unchanged.
            </>
          ) : (
            <>
              Preview matches typical on-page size. JPEG, PNG, and WebP uploads are scaled so the longest side is at most {maxEdge}px (or
              lightly recompressed if the file is very heavy). GIF uploads are left as-is.
            </>
          )}
        </p>
      </div>

      {uploadErr ? (
        <p className="cms-image-field__error" role="alert">
          {uploadErr}
        </p>
      ) : null}
      {help ? (
        <p className="cms-field-help cms-image-field__help" id={helpId}>
          {help}
        </p>
      ) : null}
    </div>
  );
}

export function CmsPageHeader({
  title,
  lead,
  previewHref,
  breadcrumb = "Site content"
}: {
  title: string;
  lead: string;
  previewHref: string;
  breadcrumb?: string;
}) {
  return (
    <header className="cms-page-header card">
      <div className="cms-page-header__row">
        <nav className="cms-page-header__crumb" aria-label="Breadcrumb">
          <span className="cms-page-header__crumb-root">{breadcrumb}</span>
          <span className="cms-page-header__crumb-sep" aria-hidden="true">
            /
          </span>
          <span className="cms-page-header__crumb-current">{title}</span>
        </nav>
        <CmsPreviewLink href={previewHref} className="cms-preview-pill">
          View live page
        </CmsPreviewLink>
      </div>
      <h1 className="cms-page-header__title">{title}</h1>
      <p className="cms-page-header__lead">{lead}</p>
    </header>
  );
}

export function CmsLoadingState({ message = "Loading editor…" }: { message?: string }) {
  return (
    <div className="cms-loading" aria-busy="true" aria-live="polite">
      <div className="cms-loading__spinner" aria-hidden />
      <p className="cms-loading__text">{message}</p>
    </div>
  );
}

/** When `/api/admin/content` fails or returns nothing, avoid an infinite loading spinner (see `loading || !data` footgun). */
export function CmsEditorLoadFailed({
  err,
  load
}: {
  err: string;
  load: () => void | Promise<void>;
}) {
  const detail = err.trim() || "The server did not return site content. You may need to sign in again.";
  return (
    <section className="page-stack cms-editor-stack cms-editor-stack--cms">
      <div className="card cms-editor-load-fail">
        <CmsAlert variant="error" title="Could not load content">
          {detail}
        </CmsAlert>
        <div className="cms-editor-load-fail__actions">
          <button type="button" className="btn btn-secondary" onClick={() => void load()}>
            Try again
          </button>
        </div>
      </div>
    </section>
  );
}

export function CmsAlert({
  variant,
  title,
  children
}: {
  variant: "error" | "warning" | "info";
  title?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={clsx("cms-alert", `cms-alert--${variant}`)}
      role={variant === "error" ? "alert" : "status"}
    >
      {title ? <h3 className="cms-alert__title">{title}</h3> : null}
      <div className="cms-alert__body">{children}</div>
    </div>
  );
}

export function CmsSection({
  title,
  description,
  id,
  children,
  variant = "default"
}: {
  title: string;
  description?: string;
  id?: string;
  children: ReactNode;
  variant?: "default" | "muted";
}) {
  return (
    <section
      className={clsx("cms-section card", variant === "muted" && "cms-section--muted")}
      id={id}
    >
      <header className="cms-section__header">
        <h2 className="cms-section__title">{title}</h2>
        {description ? <p className="cms-section__description">{description}</p> : null}
      </header>
      <div className="cms-section__body">{children}</div>
    </section>
  );
}

export function CmsSubcard({ label, children, actions }: { label?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="cms-subcard">
      {label ? <p className="cms-subcard__label">{label}</p> : null}
      <div className="cms-subcard__body">{children}</div>
      {actions ? <div className="cms-subcard__actions">{actions}</div> : null}
    </div>
  );
}

export function CmsFormActions({
  primaryLabel,
  onPrimary,
  disabled,
  saving,
  secondary
}: {
  primaryLabel: string;
  onPrimary: () => void | Promise<void>;
  disabled?: boolean;
  saving?: boolean;
  secondary?: ReactNode;
}) {
  return (
    <div className="cms-form-actions">
      <div className="cms-form-actions__secondary">{secondary}</div>
      <button type="button" className="btn cms-form-actions__primary" disabled={disabled || saving} onClick={() => void onPrimary()}>
        {saving ? "Saving…" : primaryLabel}
      </button>
    </div>
  );
}

/** Optional label row for a single field block (outside CmsSection). */
export function CmsFieldHint({ children }: { children: ReactNode }) {
  return <p className="cms-field-hint">{children}</p>;
}
