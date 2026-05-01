import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { toCsv } from "@/lib/csv";
import { paymentCategoryKey } from "@/lib/finance-format";
import { resolveLedgerPaymentFor } from "@/lib/payment-guards";
import { subscriptionStatusFromDate } from "@/lib/subscription-ui";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";

type ExportDataset = "players" | "payments" | "financial" | "registrations";
type ExportFormat = "csv" | "xlsx" | "html";
type UiStatus = "paid" | "pending" | "unpaid" | "overdue";

function buildCsvResponse(filename: string, csv: string) {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}.csv"`
    }
  });
}

function buildHtmlReport(title: string, rows: Array<Record<string, unknown>>, columns: string[]) {
  const esc = (v: unknown) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const thead = `<tr>${columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>`;
  const tbody = rows
    .map(
      (r) =>
        `<tr>${columns.map((c) => `<td>${esc((r as Record<string, unknown>)[c])}</td>`).join("")}</tr>`
    )
    .join("");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>${esc(title)}</title>
<style>
body{font-family:system-ui,sans-serif;margin:1.5rem;color:#0f172a}
h1{font-size:1.25rem}
table{border-collapse:collapse;width:100%;margin-top:1rem;font-size:0.88rem}
th,td{border:1px solid #e2e8f0;padding:0.45rem 0.5rem;text-align:left}
th{background:#f8fafc}
.muted{color:#64748b;font-size:0.85rem;margin-top:0.35rem}
@media print{body{margin:0.5cm}}
</style></head><body>
<h1>${esc(title)}</h1>
<p class="muted">Use your browser Print dialog → Save as PDF for a PDF copy.</p>
<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>
</body></html>`;
}

function buildXlsxResponse(filename: string, sheets: Array<{ name: string; rows: Array<Record<string, unknown>> }>) {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }
  const out = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
  return new NextResponse(out, {
    status: 200,
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}.xlsx"`
    }
  });
}

export async function GET(req: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const url = new URL(req.url);
  const dataset = (url.searchParams.get("dataset") ?? "players") as ExportDataset;
  const format = (url.searchParams.get("format") ?? "csv") as ExportFormat;
  const statusFilter = url.searchParams.get("status");
  const monthFilter = url.searchParams.get("month");
  const groupFilter = url.searchParams.get("group");
  const parentIdFilter = url.searchParams.get("parentId");
  const playerIdFilter = url.searchParams.get("playerId")?.trim();
  const q = url.searchParams.get("q")?.trim().toLowerCase();
  const dateFrom = url.searchParams.get("dateFrom")?.trim();
  const dateTo = url.searchParams.get("dateTo")?.trim();
  const typeFilter = url.searchParams.get("type") as "registration" | "membership" | "other" | null;
  const subRaw = url.searchParams.get("subStatus");
  const subStatusFilter =
    subRaw === "active" || subRaw === "expiring_soon" || subRaw === "expired" || subRaw === "ended" ? subRaw : null;

  const players = await db.listPlayers({ includeWithdrawn: true });
  const payments = await db.listPayments();

  const playerRows = await Promise.all(
    players.map(async (p) => {
      const parent = await db.getParentByPlayerId(p.id);
      return {
        playerId: p.id,
        playerName: p.playerName,
        dateOfBirth: p.dateOfBirth,
        ageGroup: p.ageGroup,
        playerStatus: p.status,
        registrationStatus: p.registrationStatus,
        subscriptionValidUntil: p.subscriptionValidUntil ?? "",
        createdAt: p.createdAt ?? "",
        parentName: parent?.parentName ?? "",
        parentEmail: parent?.email ?? "",
        parentPhone: parent?.phoneNumber ?? "",
        parentAddress: parent?.address ?? ""
      };
    })
  );

  const paymentRowsAll = await Promise.all(
    payments.map(async (p) => {
      const pl = players.find((x) => x.id === p.playerId);
      const parent = pl ? await db.getParentByPlayerId(pl.id) : null;
      const uiStatus: UiStatus = p.status === "paid" ? "paid" : p.status === "pending" ? "pending" : p.status === "overdue" ? "overdue" : "unpaid";
      const paymentFor = resolveLedgerPaymentFor(p.paymentFor, p.dueDate);
      return {
        paymentId: p.id,
        playerId: p.playerId,
        parentId: parent?.id ?? "",
        playerName: pl?.playerName ?? "",
        parentName: parent?.parentName ?? "",
        parentEmail: parent?.email ?? "",
        ageGroup: pl?.ageGroup ?? "",
        amount: p.amount,
        currency: p.currency,
        paymentFor,
        subscriptionValidUntil: pl?.subscriptionValidUntil ?? "",
        dueDate: p.dueDate,
        paidAt: p.paidAt ?? "",
        status: uiStatus,
        paymentMethod: p.paymentMethod ?? "",
        mobileMoneyRef: p.mobileMoneyRef ?? "",
        proofUrl: p.proofUrl ?? "",
        verifiedBy: p.verifiedBy ?? "",
        invoiceSentAt: p.invoiceSentAt ?? ""
      };
    })
  );
  const paymentRows = paymentRowsAll.filter((p) => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (monthFilter && p.dueDate.slice(0, 7) !== monthFilter) return false;
    if (groupFilter && p.ageGroup !== groupFilter) return false;
    if (parentIdFilter && p.parentId !== parentIdFilter) return false;
    if (playerIdFilter && p.playerId !== playerIdFilter) return false;
    const dueDay = p.dueDate.slice(0, 10);
    if (dateFrom && dueDay < dateFrom) return false;
    if (dateTo && dueDay > dateTo) return false;
    if (typeFilter && paymentCategoryKey(p.paymentFor) !== typeFilter) return false;
    if (subStatusFilter) {
      const pl = players.find((x) => x.id === p.playerId);
      const su = subscriptionStatusFromDate(pl?.subscriptionValidUntil);
      if (su !== subStatusFilter) return false;
    }
    if (q) {
      const hay = `${p.playerName} ${p.parentName} ${p.parentEmail} ${p.paymentFor} ${p.subscriptionValidUntil}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const byGroup = new Map<string, { paid: number; outstanding: number; invoices: number }>();
  for (const pay of paymentRows) {
    const player = players.find((p) => p.id === pay.playerId);
    if (!player) continue;
    const current = byGroup.get(player.ageGroup) ?? { paid: 0, outstanding: 0, invoices: 0 };
    if (pay.status === "paid") current.paid += pay.amount;
    else current.outstanding += pay.amount;
    current.invoices += 1;
    byGroup.set(player.ageGroup, current);
  }
  const financialRows = Array.from(byGroup.entries()).map(([ageGroup, row]) => ({
    ageGroup,
    paid: row.paid,
    outstanding: row.outstanding,
    invoices: row.invoices
  }));
  const byParent = new Map<string, { parentId: string; parentName: string; parentEmail: string; children: Set<string>; paid: number; outstanding: number; invoices: number }>();
  for (const row of paymentRows) {
    if (!row.parentId) continue;
    const cur = byParent.get(row.parentId) ?? {
      parentId: row.parentId,
      parentName: row.parentName,
      parentEmail: row.parentEmail,
      children: new Set<string>(),
      paid: 0,
      outstanding: 0,
      invoices: 0
    };
    cur.children.add(row.playerName);
    if (row.status === "paid") cur.paid += row.amount;
    else cur.outstanding += row.amount;
    cur.invoices += 1;
    byParent.set(row.parentId, cur);
  }
  const parentFinancialRows = Array.from(byParent.values()).map((row) => ({
    parentId: row.parentId,
    parentName: row.parentName,
    parentEmail: row.parentEmail,
    childrenCount: row.children.size,
    paid: row.paid,
    outstanding: row.outstanding,
    invoices: row.invoices
  }));

  const registrationRows = playerRows.map((r) => ({
    playerId: r.playerId,
    playerName: r.playerName,
    ageGroup: r.ageGroup,
    registrationStatus: r.registrationStatus,
    registrationDate: r.createdAt,
    parentName: r.parentName,
    parentEmail: r.parentEmail,
    parentPhone: r.parentPhone
  }));

  const selected = (() => {
    switch (dataset) {
      case "players":
        return [{ name: "Players", rows: playerRows }];
      case "payments":
        return [{ name: "Payments", rows: paymentRows }];
      case "financial":
        return [
          { name: "FinancialByGroup", rows: financialRows },
          { name: "FinancialByParent", rows: parentFinancialRows },
          {
            name: "MonthlySummary",
            rows: Array.from(
              paymentRows.reduce((acc, row) => {
                const key = row.dueDate.slice(0, 7);
                const cur = acc.get(key) ?? { month: key, expected: 0, collected: 0, invoices: 0, paidInvoices: 0 };
                cur.expected += Number(row.amount);
                cur.invoices += 1;
                if (row.status === "paid") {
                  cur.collected += Number(row.amount);
                  cur.paidInvoices += 1;
                }
                acc.set(key, cur);
                return acc;
              }, new Map<string, { month: string; expected: number; collected: number; invoices: number; paidInvoices: number }>())
            ).map(([, r]) => ({
              ...r,
              completionRate: r.invoices > 0 ? Math.round((r.paidInvoices / r.invoices) * 100) : 0
            }))
          }
        ];
      case "registrations":
        return [{ name: "Registrations", rows: registrationRows }];
      default:
        return [{ name: "Players", rows: playerRows }];
    }
  })();

  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "xlsx") return buildXlsxResponse(`${dataset}-${stamp}`, selected);

  if (format === "html" && dataset === "payments") {
    const rows = selected[0]?.rows ?? [];
    const cols = Object.keys(rows[0] ?? {});
    const html = buildHtmlReport(`FTPR Lions — Payments export (${stamp})`, rows as Array<Record<string, unknown>>, cols);
    return new NextResponse(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "content-disposition": `attachment; filename="payments-${stamp}.html"`
      }
    });
  }

  const headers = Object.keys(selected[0].rows[0] ?? {});
  return buildCsvResponse(`${dataset}-${stamp}`, toCsv(headers, selected[0].rows));
}
