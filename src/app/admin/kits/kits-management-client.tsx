"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { SystemNotice } from "@/components/system/system-notice";
import { adminApiFetch, formatAdminApiMessage } from "@/lib/admin-api-fetch";
import { formatAcademyMoney } from "@/lib/finance-format";
import type { KitItem } from "@/lib/kit-store";
import type { KitOrderingPeriod } from "@/lib/kit-period-store";

type Notice = { variant: "info" | "success" | "warning" | "error"; message: string } | null;

/** Academy-wide currency (RWF). The admin form no longer exposes this as an editable field. */
const ACADEMY_CURRENCY = "RWF";

type FormState = {
  type: string;
  color: string;
  description: string;
  sizes: string;
  price: string;
  active: boolean;
  photoUrl: string;
};

const EMPTY_FORM: FormState = {
  type: "",
  color: "",
  description: "",
  sizes: "S, M, L, XL",
  price: "",
  active: true,
  photoUrl: ""
};

const TYPE_PRESETS = [
  "Home jersey",
  "Away jersey",
  "Third jersey",
  "Goalkeeper jersey",
  "Shorts",
  "Socks",
  "Training top",
  "Tracksuit",
  "Full kit (jersey + shorts + socks)"
];

export function KitsManagementClient() {
  const [period, setPeriod] = useState<KitOrderingPeriod | null>(null);
  const [periodBusy, setPeriodBusy] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [kits, setKits] = useState<KitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [editing, setEditing] = useState<KitItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, kRes] = await Promise.all([
        adminApiFetch("/api/admin/kit-period"),
        adminApiFetch("/api/admin/kits?includeInactive=1")
      ]);
      const pData = await pRes.json();
      const kData = await kRes.json();
      if (pRes.ok && pData?.period) {
        setPeriod(pData.period);
        setAnnouncement(pData.period.announcement ?? "");
      }
      if (kRes.ok && Array.isArray(kData?.kits)) setKits(kData.kits);
    } catch (e) {
      setNotice({ variant: "error", message: e instanceof Error ? e.message : "Could not load kits." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const togglePeriod = async (enabled: boolean) => {
    if (periodBusy) return;
    setPeriodBusy(true);
    setNotice(null);
    try {
      const res = await adminApiFetch("/api/admin/kit-period", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled, announcement })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatAdminApiMessage(res.status, data?.message));
      setPeriod(data.period);
      setNotice({ variant: enabled ? "success" : "info", message: data.message ?? "Updated." });
    } catch (e) {
      setNotice({ variant: "error", message: e instanceof Error ? e.message : "Could not update period." });
    } finally {
      setPeriodBusy(false);
    }
  };

  const saveAnnouncement = async () => {
    if (periodBusy) return;
    setPeriodBusy(true);
    setNotice(null);
    try {
      const res = await adminApiFetch("/api/admin/kit-period", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ announcement })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatAdminApiMessage(res.status, data?.message));
      setPeriod(data.period);
      setNotice({ variant: "success", message: "Announcement saved." });
    } catch (e) {
      setNotice({ variant: "error", message: e instanceof Error ? e.message : "Could not save announcement." });
    } finally {
      setPeriodBusy(false);
    }
  };

  const startNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const startEdit = (kit: KitItem) => {
    setEditing(kit);
    setForm({
      type: kit.type,
      color: kit.color,
      description: kit.description ?? "",
      sizes: kit.sizes.join(", "),
      price: String(kit.price ?? 0),
      active: kit.active,
      photoUrl: kit.photoUrl ?? ""
    });
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    setPhotoUploading(true);
    setNotice(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/kits/upload", { method: "POST", body: fd, credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(formatAdminApiMessage(res.status, data?.message));
      setForm((s) => ({ ...s, photoUrl: data.url }));
      setNotice({ variant: "success", message: "Photo uploaded." });
    } catch (e) {
      setNotice({ variant: "error", message: e instanceof Error ? e.message : "Upload failed." });
    } finally {
      setPhotoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitBusy) return;
    const sizes = form.sizes
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!form.type.trim()) return setNotice({ variant: "warning", message: "Kit type is required." });
    if (!form.color.trim()) return setNotice({ variant: "warning", message: "Colour is required." });
    if (!sizes.length) return setNotice({ variant: "warning", message: "Add at least one size." });
    const priceNum = Number(form.price);
    if (!Number.isFinite(priceNum) || priceNum < 0) return setNotice({ variant: "warning", message: "Enter a valid price." });

    setSubmitBusy(true);
    setNotice(null);
    try {
      const payload = {
        type: form.type.trim(),
        color: form.color.trim(),
        description: form.description.trim() || undefined,
        sizes,
        price: priceNum,
        currency: ACADEMY_CURRENCY,
        active: form.active,
        photoUrl: form.photoUrl || undefined
      };
      const res = editing
        ? await adminApiFetch(`/api/admin/kits/${editing.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload)
          })
        : await adminApiFetch("/api/admin/kits", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload)
          });
      const data = await res.json();
      if (!res.ok) throw new Error(formatAdminApiMessage(res.status, data?.message));
      setNotice({ variant: "success", message: data.message ?? "Saved." });
      setForm(EMPTY_FORM);
      setEditing(null);
      await refresh();
    } catch (e) {
      setNotice({ variant: "error", message: e instanceof Error ? e.message : "Could not save kit." });
    } finally {
      setSubmitBusy(false);
    }
  };

  const toggleActive = async (kit: KitItem) => {
    setNotice(null);
    try {
      const res = await adminApiFetch(`/api/admin/kits/${kit.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: !kit.active })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatAdminApiMessage(res.status, data?.message));
      setNotice({ variant: "success", message: kit.active ? "Kit deactivated." : "Kit activated." });
      await refresh();
    } catch (e) {
      setNotice({ variant: "error", message: e instanceof Error ? e.message : "Could not update kit." });
    }
  };

  const archiveKitRecord = async (kit: KitItem) => {
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        `Archive "${kit.type} (${kit.color})" from the catalog?\n\n` +
          "The kit stays in our records (including photos). Past orders and payment history are never removed — it will only be hidden from new parent orders."
      );
      if (!ok) return;
    }
    setNotice(null);
    try {
      const res = await adminApiFetch(`/api/admin/kits/${kit.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(formatAdminApiMessage(res.status, data?.message));
      setNotice({ variant: "success", message: data.message ?? "Kit archived." });
      await refresh();
    } catch (e) {
      setNotice({ variant: "error", message: e instanceof Error ? e.message : "Could not archive kit." });
    }
  };

  const periodEnabled = period?.enabled ?? false;

  const formatPrice = (amount: number) => formatAcademyMoney(amount, ACADEMY_CURRENCY);

  return (
    <div className="kit-admin-root">
      <header className="kit-admin-hero">
        <div>
          <p className="kit-admin-eyebrow">Kit ordering control</p>
          <h2 className="kit-admin-title">{periodEnabled ? "Ordering window is OPEN" : "Ordering window is CLOSED"}</h2>
          <p className="kit-admin-sub">
            {periodEnabled
              ? "Parents can now sign in to the portal and place kit orders. The public site shows the Order Kit CTA."
              : "Open the window to surface the Order Kit CTA on the public site and let parents place new orders."}
          </p>
        </div>
        <div className="kit-admin-hero-actions">
          <button
            type="button"
            className={periodEnabled ? "btn admin-btn--ghost" : "btn admin-btn--primary"}
            onClick={() => togglePeriod(!periodEnabled)}
            disabled={periodBusy}
            aria-busy={periodBusy}
          >
            {periodEnabled ? "Close ordering window" : "Open ordering window"}
          </button>
        </div>
      </header>

      {notice ? (
        <SystemNotice variant={notice.variant} title={notice.variant === "error" ? "Error" : undefined}>
          {notice.message}
        </SystemNotice>
      ) : null}

      <section className="kit-admin-card">
        <div className="kit-admin-card-head">
          <h3>Public announcement copy</h3>
          <p className="kit-admin-card-sub">Shown in the homepage banner and inside the parent portal.</p>
        </div>
        <textarea
          className="kit-admin-textarea"
          rows={3}
          maxLength={400}
          value={announcement}
          onChange={(e) => setAnnouncement(e.target.value)}
          placeholder="Kit ordering is now open. Sign in to place an order for your child."
        />
        <div className="kit-admin-card-foot">
          <button type="button" className="btn admin-btn--ghost" onClick={saveAnnouncement} disabled={periodBusy}>
            Save announcement
          </button>
        </div>
      </section>

      <section className="kit-admin-card">
        <div className="kit-admin-card-head">
          <h3>{editing ? `Edit kit — ${editing.type}` : "Add a new kit"}</h3>
          <p className="kit-admin-card-sub">Active kits are visible to parents during the open window.</p>
        </div>
        <form className="kit-admin-form" onSubmit={submitForm}>
          <div className="kit-admin-form-grid">
            <label className="kit-admin-field">
              <span>Kit type</span>
              <input
                list="kit-type-presets"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                required
                placeholder="e.g. Home jersey"
              />
              <datalist id="kit-type-presets">
                {TYPE_PRESETS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </label>
            <label className="kit-admin-field">
              <span>Colour</span>
              <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} required placeholder="e.g. Royal blue" />
            </label>
            <label className="kit-admin-field kit-admin-field--full">
              <span>Sizes (comma-separated)</span>
              <input value={form.sizes} onChange={(e) => setForm({ ...form, sizes: e.target.value })} placeholder="XS, S, M, L, XL" />
            </label>
            <label className="kit-admin-field">
              <span>Price (RWF)</span>
              <input
                type="number"
                min={0}
                step="100"
                inputMode="numeric"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
                placeholder="e.g. 25000"
              />
            </label>
            <label className="kit-admin-field kit-admin-field--full">
              <span>Description (optional)</span>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Material, fit, season — anything that helps the parent decide."
              />
            </label>
            <div className="kit-admin-field kit-admin-field--full">
              <span>Photo</span>
              <div className="kit-admin-photo-row">
                <div className="kit-admin-photo-preview" aria-hidden>
                  {form.photoUrl ? (
                    <Image src={form.photoUrl} alt="" width={120} height={120} unoptimized />
                  ) : (
                    <span className="kit-admin-photo-empty">No photo yet</span>
                  )}
                </div>
                <div className="kit-admin-photo-controls">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleUpload(e.target.files?.[0] ?? undefined)}
                    aria-busy={photoUploading}
                  />
                  {form.photoUrl ? (
                    <button type="button" className="btn admin-btn--ghost" onClick={() => setForm((s) => ({ ...s, photoUrl: "" }))}>
                      Remove photo
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
            <label className="kit-admin-field kit-admin-checkbox">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              <span>Active (visible to parents)</span>
            </label>
          </div>
          <div className="kit-admin-form-foot">
            {editing ? (
              <button type="button" className="btn admin-btn--ghost" onClick={startNew}>
                Cancel edit
              </button>
            ) : null}
            <button type="submit" className="btn admin-btn--primary" disabled={submitBusy} aria-busy={submitBusy}>
              {editing ? "Save changes" : "Add kit"}
            </button>
          </div>
        </form>
      </section>

      <section className="kit-admin-card">
        <div className="kit-admin-card-head">
          <h3>Kits ({kits.length})</h3>
          <p className="kit-admin-card-sub">
            Only active kits are shown to parents during an open ordering window. Kits are never erased — archive to
            retire while keeping full history.
          </p>
        </div>
        {loading ? (
          <p className="kit-admin-empty">Loading kits…</p>
        ) : kits.length === 0 ? (
          <p className="kit-admin-empty">No kits yet — add the first kit above.</p>
        ) : (
          <div className="kit-admin-grid">
            {kits.map((kit) => (
              <article key={kit.id} className={`kit-admin-tile${kit.active ? "" : " kit-admin-tile--off"}`}>
                <div className="kit-admin-tile-photo">
                  {kit.photoUrl ? (
                    <Image src={kit.photoUrl} alt={kit.type} width={320} height={220} unoptimized />
                  ) : (
                    <span className="kit-admin-tile-photo-empty">No photo</span>
                  )}
                  <span className={`kit-admin-tile-pill ${kit.active ? "kit-admin-tile-pill--on" : "kit-admin-tile-pill--off"}`}>
                    {kit.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="kit-admin-tile-body">
                  <h4 className="kit-admin-tile-title">{kit.type}</h4>
                  <p className="kit-admin-tile-sub">{kit.color}</p>
                  <p className="kit-admin-tile-sizes">Sizes: {kit.sizes.join(", ")}</p>
                  <p className="kit-admin-tile-price">{formatPrice(kit.price)}</p>
                  {kit.description ? <p className="kit-admin-tile-desc">{kit.description}</p> : null}
                  {kit.archivedAt ? (
                    <p className="kit-admin-tile-desc">Archived {new Date(kit.archivedAt).toLocaleString()}</p>
                  ) : null}
                </div>
                <div className="kit-admin-tile-actions">
                  <button type="button" className="btn admin-btn--ghost" onClick={() => startEdit(kit)}>
                    Edit
                  </button>
                  <button type="button" className="btn admin-btn--ghost" onClick={() => toggleActive(kit)}>
                    {kit.active ? "Deactivate" : "Activate"}
                  </button>
                  <button type="button" className="btn finance-void-btn" onClick={() => archiveKitRecord(kit)}>
                    Archive
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
