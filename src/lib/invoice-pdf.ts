import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, rgb, StandardFonts, type PDFImage } from "pdf-lib";

export type MonthlyInvoicePdfData = {
  organizationName: string;
  invoiceTitle: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  parentName: string;
  playerName: string;
  ageGroup: string;
  periodLabel: string;
  amount: number;
  currency: string;
  statusLabel: string;
  paymentInstructions?: string;
};

function isJpegMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isPngMagic(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

async function embedRasterImage(pdf: PDFDocument, bytes: Uint8Array): Promise<PDFImage> {
  if (isJpegMagic(bytes)) return pdf.embedJpg(bytes);
  if (isPngMagic(bytes)) return pdf.embedPng(bytes);
  throw new Error("Invoice logo must be a PNG or JPEG file.");
}

async function readInvoiceLogoBytes(): Promise<Uint8Array | null> {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "public", "invoice-header-logo.png"),
    path.join(cwd, "public", "invoice-header-logo.jpg"),
    path.join(cwd, "public", "logo.jpeg")
  ];
  for (const filePath of candidates) {
    try {
      const buf = await readFile(filePath);
      if (buf.length > 0) return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    } catch {
      /* try next */
    }
  }
  return null;
}

export type CombinedInvoiceLineForPdf = {
  playerName: string;
  ageGroup: string;
  description: string;
  amount: number;
};

export type CombinedInvoicePdfData = {
  organizationName: string;
  invoiceTitle: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  parentName: string;
  periodLabel: string;
  currency: string;
  total: number;
  statusLabel: string;
  paymentInstructions?: string;
  lines: CombinedInvoiceLineForPdf[];
};

export async function generateMonthlyInvoicePdf(input: MonthlyInvoicePdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const left = 52;
  const headerWidth = 490;
  /** Large invoice header: white panel with prominent logo (pdf-lib y increases upward). */
  const headerTop = 820;
  const headerHeight = 172;
  const rectBottom = headerTop - headerHeight;
  const topInset = 14;
  const bottomInset = 28;
  const orgNameSize = 11;
  const gapLogoToOrg = 12;

  page.drawRectangle({
    x: left,
    y: rectBottom,
    width: headerWidth,
    height: headerHeight,
    color: rgb(1, 1, 1),
    borderWidth: 0
  });

  const orgBaseline = rectBottom + bottomInset;
  const textVisualTop = orgBaseline + orgNameSize * 0.85;
  const logoBottomMin = textVisualTop + gapLogoToOrg;
  const logoAreaTop = headerTop - topInset;
  const maxLogoW = headerWidth - 36;
  const maxLogoH = logoAreaTop - logoBottomMin;

  const logoBytes = await readInvoiceLogoBytes();
  if (logoBytes && maxLogoH > 24) {
    try {
      const logo = await embedRasterImage(pdf, logoBytes);
      const scale = Math.min(maxLogoW / logo.width, maxLogoH / logo.height);
      const w = logo.width * scale;
      const h = logo.height * scale;
      const logoX = left + (headerWidth - w) / 2;
      const logoY = logoBottomMin + (maxLogoH - h) / 2;
      page.drawImage(logo, {
        x: logoX,
        y: logoY,
        width: w,
        height: h
      });
    } catch (err) {
      console.warn("[invoice-pdf] Could not embed logo:", err instanceof Error ? err.message : err);
    }
  }

  const orgW = bold.widthOfTextAtSize(input.organizationName, orgNameSize);
  page.drawText(input.organizationName, {
    x: left + (headerWidth - orgW) / 2,
    y: orgBaseline,
    size: orgNameSize,
    font: bold,
    color: rgb(0.12, 0.22, 0.42)
  });

  let y = rectBottom - 22;

  page.drawText(input.invoiceTitle, { x: left, y, size: 20, font: bold, color: rgb(0.1, 0.1, 0.1) });
  y -= 30;
  page.drawText(`Invoice #: ${input.invoiceNumber}`, { x: left, y, size: 11, font: bold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText(`Issue date: ${input.issueDate}`, { x: left + 220, y, size: 11, font, color: rgb(0.2, 0.2, 0.2) });
  page.drawText(`Due date: ${input.dueDate}`, { x: left + 365, y, size: 11, font: bold, color: rgb(0.75, 0.2, 0.15) });
  y -= 36;

  page.drawRectangle({
    x: left,
    y: y - 86,
    width: 490,
    height: 86,
    color: rgb(0.98, 0.985, 0.99),
    borderWidth: 0
  });
  page.drawText("Customer details", { x: left + 10, y: y - 18, size: 11, font: bold });
  page.drawText(`Parent: ${input.parentName}`, { x: left + 10, y: y - 36, size: 10.5, font });
  page.drawText(`Player: ${input.playerName}`, { x: left + 10, y: y - 52, size: 10.5, font });
  page.drawText(`Group / Team: ${input.ageGroup}`, { x: left + 10, y: y - 68, size: 10.5, font });
  y -= 118;

  page.drawRectangle({
    x: left,
    y: y - 132,
    width: 490,
    height: 132,
    color: rgb(0.98, 0.985, 0.99),
    borderWidth: 0
  });
  page.drawText("Payment details", { x: left + 10, y: y - 18, size: 11, font: bold });
  page.drawText(`Subscription period: ${input.periodLabel}`, { x: left + 10, y: y - 40, size: 10.5, font });
  page.drawText(`Status: ${input.statusLabel}`, { x: left + 10, y: y - 58, size: 10.5, font: bold });
  page.drawText("Amount due", { x: left + 340, y: y - 38, size: 10, font, color: rgb(0.35, 0.35, 0.35) });
  page.drawText(`${input.amount.toLocaleString()} ${input.currency}`, {
    x: left + 340,
    y: y - 62,
    size: 18,
    font: bold,
    color: rgb(0.1, 0.35, 0.65)
  });
  if (input.paymentInstructions?.trim()) {
    page.drawText("Payment instructions:", { x: left + 10, y: y - 86, size: 10, font: bold });
    page.drawText(input.paymentInstructions.trim().slice(0, 120), { x: left + 10, y: y - 102, size: 10, font });
  }
  y -= 155;

  page.drawText("Thank you for supporting your player's development.", {
    x: left,
    y,
    size: 10,
    font,
    color: rgb(0.35, 0.35, 0.35)
  });

  return await pdf.save();
}

/**
 * Combined parent invoice — one PDF that itemises every player on the same monthly bill.
 * Used by the "Bill parent together" workflow in admin/finance/invoices.
 */
export async function generateCombinedInvoicePdf(input: CombinedInvoicePdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const left = 52;
  const headerWidth = 490;
  const headerTop = 820;
  const headerHeight = 172;
  const rectBottom = headerTop - headerHeight;
  const topInset = 14;
  const bottomInset = 28;
  const orgNameSize = 11;
  const gapLogoToOrg = 12;

  page.drawRectangle({
    x: left,
    y: rectBottom,
    width: headerWidth,
    height: headerHeight,
    color: rgb(1, 1, 1),
    borderWidth: 0
  });

  const orgBaseline = rectBottom + bottomInset;
  const textVisualTop = orgBaseline + orgNameSize * 0.85;
  const logoBottomMin = textVisualTop + gapLogoToOrg;
  const logoAreaTop = headerTop - topInset;
  const maxLogoW = headerWidth - 36;
  const maxLogoH = logoAreaTop - logoBottomMin;

  const logoBytes = await readInvoiceLogoBytes();
  if (logoBytes && maxLogoH > 24) {
    try {
      const logo = await embedRasterImage(pdf, logoBytes);
      const scale = Math.min(maxLogoW / logo.width, maxLogoH / logo.height);
      const w = logo.width * scale;
      const h = logo.height * scale;
      const logoX = left + (headerWidth - w) / 2;
      const logoY = logoBottomMin + (maxLogoH - h) / 2;
      page.drawImage(logo, { x: logoX, y: logoY, width: w, height: h });
    } catch (err) {
      console.warn("[invoice-pdf] Could not embed logo:", err instanceof Error ? err.message : err);
    }
  }

  const orgW = bold.widthOfTextAtSize(input.organizationName, orgNameSize);
  page.drawText(input.organizationName, {
    x: left + (headerWidth - orgW) / 2,
    y: orgBaseline,
    size: orgNameSize,
    font: bold,
    color: rgb(0.12, 0.22, 0.42)
  });

  let y = rectBottom - 22;
  page.drawText(input.invoiceTitle, { x: left, y, size: 20, font: bold, color: rgb(0.1, 0.1, 0.1) });
  y -= 30;
  page.drawText(`Invoice #: ${input.invoiceNumber}`, { x: left, y, size: 11, font: bold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText(`Issue date: ${input.issueDate}`, { x: left + 220, y, size: 11, font, color: rgb(0.2, 0.2, 0.2) });
  page.drawText(`Due date: ${input.dueDate}`, { x: left + 365, y, size: 11, font: bold, color: rgb(0.75, 0.2, 0.15) });
  y -= 36;

  page.drawRectangle({
    x: left,
    y: y - 64,
    width: 490,
    height: 64,
    color: rgb(0.98, 0.985, 0.99),
    borderWidth: 0
  });
  page.drawText("Billed to", { x: left + 10, y: y - 18, size: 11, font: bold });
  page.drawText(`Parent: ${input.parentName}`, { x: left + 10, y: y - 36, size: 10.5, font });
  page.drawText(`Period: ${input.periodLabel}`, { x: left + 10, y: y - 52, size: 10.5, font });
  y -= 96;

  page.drawText("Players included on this bill", { x: left, y, size: 11, font: bold });
  y -= 18;

  const tableHeaderBg = rgb(0.94, 0.96, 0.98);
  const rowBgAlt = rgb(0.98, 0.985, 0.99);
  const colPlayerX = left + 10;
  const colGroupX = left + 220;
  const colDescX = left + 290;
  const colAmountX = left + 430;
  const tableWidth = 490;

  page.drawRectangle({ x: left, y: y - 18, width: tableWidth, height: 18, color: tableHeaderBg, borderWidth: 0 });
  page.drawText("Player", { x: colPlayerX, y: y - 13, size: 10, font: bold });
  page.drawText("Group", { x: colGroupX, y: y - 13, size: 10, font: bold });
  page.drawText("Description", { x: colDescX, y: y - 13, size: 10, font: bold });
  page.drawText("Amount", { x: colAmountX, y: y - 13, size: 10, font: bold });
  y -= 18;

  input.lines.forEach((line, index) => {
    const rowH = 22;
    if (index % 2 === 0) {
      page.drawRectangle({ x: left, y: y - rowH, width: tableWidth, height: rowH, color: rowBgAlt, borderWidth: 0 });
    }
    page.drawText(line.playerName.slice(0, 32), { x: colPlayerX, y: y - 14, size: 10, font });
    page.drawText(line.ageGroup.slice(0, 12), { x: colGroupX, y: y - 14, size: 10, font });
    page.drawText(line.description.slice(0, 22), { x: colDescX, y: y - 14, size: 10, font });
    page.drawText(`${line.amount.toLocaleString()}`, { x: colAmountX, y: y - 14, size: 10, font });
    y -= rowH;
  });

  y -= 14;
  page.drawRectangle({
    x: left,
    y: y - 56,
    width: 490,
    height: 56,
    color: rgb(0.93, 0.96, 0.99),
    borderWidth: 0
  });
  page.drawText("Total due", { x: left + 10, y: y - 24, size: 12, font: bold });
  page.drawText(`Status: ${input.statusLabel}`, { x: left + 10, y: y - 42, size: 10, font });
  page.drawText(`${input.total.toLocaleString()} ${input.currency}`, {
    x: left + 320,
    y: y - 32,
    size: 18,
    font: bold,
    color: rgb(0.1, 0.35, 0.65)
  });
  y -= 72;

  if (input.paymentInstructions?.trim()) {
    page.drawText("Payment instructions:", { x: left, y, size: 10, font: bold });
    y -= 14;
    page.drawText(input.paymentInstructions.trim().slice(0, 180), { x: left, y, size: 10, font });
    y -= 18;
  }

  page.drawText("Thank you for supporting your players' development.", {
    x: left,
    y,
    size: 10,
    font,
    color: rgb(0.35, 0.35, 0.35)
  });

  return await pdf.save();
}

