/// <reference types="vitest/globals" />
import { db as mockDb } from "@/lib/mock-db";
import { POST as createAdminPayment } from "@/app/api/admin/payments/route";
import { PATCH as actOnAdminPayment } from "@/app/api/admin/payments/[id]/route";
import { POST as createRegistration } from "@/app/api/registrations/route";
import { PATCH as setRegistrationStatus } from "@/app/api/registrations/[id]/status/route";

/** Full body required by `registrationApiSchema` (must differ from `playerName` for guardian). */
function registrationPayload(
  overrides: Partial<{
    playerName: string;
    dateOfBirth: string;
    heightCm: number;
    weightKg: number;
    parentName: string;
    phoneNumber: string;
    email: string;
    address: string;
  }> = {}
) {
  const playerName = overrides.playerName ?? "Integration Player";
  const parentName = overrides.parentName ?? "Integration Guardian";
  return {
    playerName,
    dateOfBirth: overrides.dateOfBirth ?? "2015-06-10",
    position: "midfielder",
    preferredFoot: "right",
    nationality: "Rwandan",
    previousClub: "",
    heightCm: overrides.heightCm ?? 140,
    weightKg: overrides.weightKg ?? 36,
    parentRelationship: "father" as const,
    parentName,
    phoneNumber: overrides.phoneNumber ?? "+250788123456",
    email: overrides.email ?? "integration@example.com",
    address: overrides.address ?? "KG 12 St, Kigali, Rwanda",
    emergencyContactName: "Emergency Contact",
    emergencyContactPhone: "+250788999000",
    medicalInfo: "None",
    howHeard: "friend" as const,
    ...overrides
  };
}

function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function register(payload: ReturnType<typeof registrationPayload>) {
  const res = await createRegistration(jsonRequest("http://localhost/api/registrations", "POST", payload));
  const data = await res.json();
  return { res, data };
}

describe("registration and payments integration", () => {
  it("reuses parent for siblings and blocks duplicate child registration", async () => {
    const familyEmail = `family.${Date.now()}@example.com`;
    const base = registrationPayload({
      dateOfBirth: "2016-05-10",
      heightCm: 132,
      weightKg: 31,
      parentName: "Parent Multi",
      phoneNumber: "+250780111222",
      email: familyEmail,
      address: "Nyarutarama, Kigali"
    });

    const first = await register({ ...base, playerName: "Kid Alpha" });
    expect(first.res.status).toBe(201);
    expect(first.data.player.registrationProfile?.nationality).toBe("Rwandan");

    const second = await register({ ...base, playerName: "Kid Beta" });
    expect(second.res.status).toBe(201);
    expect(second.data.parent.id).toBe(first.data.parent.id);

    const duplicate = await register({ ...base, playerName: "Kid Alpha" });
    expect(duplicate.res.status).toBe(409);

    const firstPayments = mockDb.listPaymentsForPlayer(first.data.player.id);
    const secondPayments = mockDb.listPaymentsForPlayer(second.data.player.id);
    expect(firstPayments.some((p) => /registration fee/i.test(p.paymentFor))).toBe(true);
    expect(secondPayments.some((p) => /registration fee/i.test(p.paymentFor))).toBe(true);
  });

  it("prevents duplicate monthly invoice per child per month", async () => {
    const reg = await register(
      registrationPayload({
        playerName: `Invoice Kid ${Date.now()}`,
        dateOfBirth: "2015-04-22",
        parentName: "Invoice Parent",
        phoneNumber: "+250780222333",
        email: `invoice.${Date.now()}@example.com`,
        address: "Remera, Kigali"
      })
    );
    expect(reg.res.status).toBe(201);

    const dueDate = "2030-06-15";
    const payload = {
      playerId: reg.data.player.id,
      amount: 45000,
      currency: "RWF",
      lineKind: "monthly" as const,
      dueDate
    };
    const first = await createAdminPayment(jsonRequest("http://localhost/api/admin/payments", "POST", payload));
    expect(first.status).toBe(201);

    const second = await createAdminPayment(jsonRequest("http://localhost/api/admin/payments", "POST", payload));
    expect(second.status).toBe(409);
  });

  it("guards admission until registration fee is confirmed", async () => {
    const reg = await register(
      registrationPayload({
        playerName: `Guard Kid ${Date.now()}`,
        dateOfBirth: "2014-09-14",
        heightCm: 146,
        weightKg: 40,
        parentName: "Guard Parent",
        phoneNumber: "+250780444555",
        email: `guard.${Date.now()}@example.com`,
        address: "Gisozi, Kigali"
      })
    );
    expect(reg.res.status).toBe(201);
    const playerId = reg.data.player.id as string;

    const blocked = await setRegistrationStatus(
      jsonRequest(`http://localhost/api/registrations/${playerId}/status`, "PATCH", { status: "approved" }),
      { params: Promise.resolve({ id: playerId }) }
    );
    expect(blocked.status).toBe(409);

    const regFee = mockDb
      .listPaymentsForPlayer(playerId)
      .find((p) => /registration fee/i.test(p.paymentFor));
    expect(regFee).toBeDefined();

    const confirm = await actOnAdminPayment(
      jsonRequest(`http://localhost/api/admin/payments/${regFee!.id}`, "PATCH", {
        action: "confirm",
        paymentMethod: "cash",
        paymentNotes: "integration-test"
      }),
      { params: Promise.resolve({ id: regFee!.id }) }
    );
    expect(confirm.status).toBe(200);

    const updatedPlayer = mockDb.getPlayer(playerId);
    expect(updatedPlayer?.registrationStatus).toBe("approved");

    const monthlyInvoice = mockDb
      .listPaymentsForPlayer(playerId)
      .find((p) => /^Monthly fee — /i.test(p.paymentFor));
    expect(monthlyInvoice).toBeDefined();
    expect(monthlyInvoice?.status).not.toBe("paid");
  });
});
