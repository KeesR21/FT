import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendRegistrationPaymentRequestEmail } from "@/lib/notifications";
import { isDuplicateOpenInvoice, LEDGER_REGISTRATION_FEE_LABEL } from "@/lib/payment-guards";
import { getActiveRegistrationFee, loadPricing } from "@/lib/pricing-store";
import { requireAdmin } from "@/lib/require-admin";
import { registrationProfileFromApi } from "@/lib/registration-profile";
import { registrationApiSchema, type RegistrationApiPayload } from "@/lib/registration-schema";
import { revalidateAdminViews } from "@/lib/revalidate-admin";
import { getAgeGroup, jsonMessage } from "@/lib/utils";

function buildDevelopmentNotes(data: RegistrationApiPayload): string {
  const lines: string[] = [];

  if (data.position) lines.push(`Position: ${data.position}`);
  if (data.preferredFoot) lines.push(`Preferred foot: ${data.preferredFoot}`);
  if (data.nationality) lines.push(`Nationality: ${data.nationality}`);
  if (data.previousClub) lines.push(`Previous club: ${data.previousClub}`);
  if (data.parentRelationship) lines.push(`Guardian relationship: ${data.parentRelationship}`);
  if (data.emergencyContactName) lines.push(`Emergency contact: ${data.emergencyContactName}`);
  if (data.emergencyContactPhone) lines.push(`Emergency phone: ${data.emergencyContactPhone}`);
  if (data.medicalInfo) lines.push(`Medical info: ${data.medicalInfo}`);
  if (data.howHeard) lines.push(`How heard: ${data.howHeard}`);

  return lines.join("\n");
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(jsonMessage("Expected JSON body"), { status: 400 });
  }
  const parsed = registrationApiSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(jsonMessage("Invalid registration data", { issues: parsed.error.flatten() }), { status: 400 });
  }

  try {
    const data = parsed.data;
    const ageGroup = getAgeGroup(data.dateOfBirth);
    const developmentNotes = buildDevelopmentNotes(data);

    const result = await db.createRegistration({
      playerName: data.playerName,
      dateOfBirth: data.dateOfBirth,
      ageGroup,
      heightCm: data.heightCm,
      weightKg: data.weightKg,
      registrationProfile: registrationProfileFromApi(data),
      ...(developmentNotes ? { developmentNotes } : {}),
      parent: {
        parentName: data.parentName,
        phoneNumber: data.phoneNumber,
        email: data.email,
        address: data.address
      }
    });

    const pricing = await loadPricing();
    const activeFee = getActiveRegistrationFee(pricing);
    const registrationFeeAmount = activeFee.amount;
    const registrationCurrency = activeFee.currency;
    const dueDate = new Date().toISOString();
    const paymentFor = LEDGER_REGISTRATION_FEE_LABEL;
    const existing = await db.listPaymentsForPlayer(result.player.id);
    if (!isDuplicateOpenInvoice(existing, { paymentFor, dueDate })) {
      await db.createPayment({
        playerId: result.player.id,
        amount: registrationFeeAmount,
        currency: registrationCurrency,
        paymentFor,
        dueDate,
        paymentNotes: `Locked-in registration fee from version effective ${activeFee.effectiveFrom.slice(0, 10)}.`
      });
    }
    await sendRegistrationPaymentRequestEmail({
      email: result.parent.email,
      parentName: result.parent.parentName,
      playerName: result.player.playerName,
      ageGroup,
      amount: registrationFeeAmount,
      currency: registrationCurrency,
      dueDate,
      paymentFor
    });

    revalidateAdminViews();
    return NextResponse.json({ message: "Registration submitted", player: result.player, parent: result.parent }, { status: 201 });
  } catch (e) {
    const errorMessage =
      e instanceof Error
        ? e.message
        : typeof e === "object" && e !== null && "message" in e && typeof (e as { message?: unknown }).message === "string"
          ? (e as { message: string }).message
          : "Registration failed";
    const status = /already registered under this parent/i.test(errorMessage) ? 409 : 500;
    return NextResponse.json(jsonMessage(errorMessage), { status });
  }
}

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const players = await db.listPlayers({ includeWithdrawn: true });
  const enriched = await Promise.all(
    players.map(async (p) => ({
      ...p,
      parent: await db.getParentByPlayerId(p.id)
    }))
  );
  return NextResponse.json({ players: enriched });
}
