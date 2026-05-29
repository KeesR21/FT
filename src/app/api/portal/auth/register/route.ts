import { NextResponse } from "next/server";
import { z } from "zod";
import { createAccount, getAccountByEmail } from "@/lib/parent-account-store";
import { hashPassword } from "@/lib/password-hash";
import { validatePasswordStrength } from "@/lib/password-strength";
import { findLinkedPlayersByEmail } from "@/lib/portal-linked-players";
import { NO_RECORD_ERROR } from "@/lib/portal-errors";
import { jsonMessage } from "@/lib/utils";

const schema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name."),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters.")
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(jsonMessage("Expected JSON body."), { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }
  const { fullName, email, password } = parsed.data;

  const passwordCheck = validatePasswordStrength(password);
  if (!passwordCheck.ok) {
    return NextResponse.json({ message: passwordCheck.reason }, { status: 400 });
  }

  // Reject when no academy parent record matches this email — explicit business rule.
  const linked = await findLinkedPlayersByEmail(email);
  if (linked.parents.length === 0) {
    return NextResponse.json({ message: NO_RECORD_ERROR }, { status: 403 });
  }

  const existing = await getAccountByEmail(email);
  if (existing) {
    return NextResponse.json(
      { message: "An account already exists for that email. Please sign in instead." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  const account = await createAccount({ email, fullName, passwordHash });

  return NextResponse.json(
    {
      message: "Account created successfully. Please log in to continue.",
      account: {
        id: account.id,
        email: account.email,
        fullName: account.fullName
      },
      linkedPlayerCount: linked.players.length
    },
    { status: 201 }
  );
}
