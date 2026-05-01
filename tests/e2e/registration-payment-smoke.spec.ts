import { expect, test } from "@playwright/test";

test("register -> admin approve -> membership -> timetable notification smoke", async ({ request, baseURL }) => {
  const seed = Date.now();
  const parentEmail = `smoke.parent.${seed}@example.com`;
  const playerName = `Smoke Kid ${seed}`;
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@ftprlions.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin123";

  const registerRes = await request.post(`${baseURL}/api/registrations`, {
    data: {
      playerName,
      dateOfBirth: "2015-03-03",
      heightCm: 138,
      weightKg: 35,
      parentName: "Smoke Parent",
      phoneNumber: "+250 780 222 111",
      email: parentEmail,
      address: "Kigali"
    }
  });
  expect(registerRes.ok()).toBeTruthy();
  const registerBody = await registerRes.json();
  const playerId = registerBody.player.id as string;

  const loginRes = await request.post(`${baseURL}/api/admin/login`, {
    data: { email: adminEmail, password: adminPassword }
  });
  expect(loginRes.ok()).toBeTruthy();

  const blockedAdmission = await request.patch(`${baseURL}/api/registrations/${playerId}/status`, {
    data: { status: "approved" }
  });
  expect(blockedAdmission.status()).toBe(409);

  const paymentsRes = await request.get(`${baseURL}/api/admin/payments`);
  expect(paymentsRes.ok()).toBeTruthy();
  const paymentsBody = await paymentsRes.json();
  const regInvoice = (paymentsBody.payments as Array<{ id: string; playerId: string; paymentFor: string }>).find(
    (p) => p.playerId === playerId && /registration fee/i.test(p.paymentFor)
  );
  expect(regInvoice).toBeTruthy();

  const confirmRegRes = await request.patch(`${baseURL}/api/admin/payments/${regInvoice!.id}`, {
    data: { action: "confirm", paymentMethod: "cash", paymentNotes: "smoke test confirm registration fee" }
  });
  expect(confirmRegRes.ok()).toBeTruthy();

  const refreshPaymentsRes = await request.get(`${baseURL}/api/admin/payments`);
  expect(refreshPaymentsRes.ok()).toBeTruthy();
  const refreshPaymentsBody = await refreshPaymentsRes.json();
  const monthlyInvoice = (
    refreshPaymentsBody.payments as Array<{ id: string; playerId: string; paymentFor: string; uiStatus: string }>
  ).find((p) => p.playerId === playerId && /monthly fee —/i.test(p.paymentFor) && p.uiStatus !== "paid");
  expect(monthlyInvoice).toBeTruthy();

  const confirmMonthlyRes = await request.patch(`${baseURL}/api/admin/payments/${monthlyInvoice!.id}`, {
    data: { action: "confirm", paymentMethod: "mobile_money", mobileMoneyRef: `SMOKE-${seed}` }
  });
  expect(confirmMonthlyRes.ok()).toBeTruthy();
  const confirmMonthlyBody = await confirmMonthlyRes.json();
  expect(confirmMonthlyBody.membership?.startsAt).toBeTruthy();
  expect(confirmMonthlyBody.membership?.endsAt).toBeTruthy();

  const playerDetailRes = await request.get(`${baseURL}/api/admin/players/${playerId}`);
  expect(playerDetailRes.ok()).toBeTruthy();
  const playerDetail = await playerDetailRes.json();
  expect(playerDetail.player.registrationStatus).toBe("approved");
  expect(playerDetail.player.subscriptionValidUntil).toBeTruthy();

  const sessionRes = await request.post(`${baseURL}/api/timetable`, {
    data: {
      title: `Smoke session ${seed}`,
      ageGroup: playerDetail.player.ageGroup,
      kind: "training",
      startsAt: "2030-01-12T09:00:00.000Z",
      endsAt: "2030-01-12T10:00:00.000Z",
      locationName: "Main Pitch",
      kitRequirements: "Blue kit"
    }
  });
  expect(sessionRes.status()).toBe(201);

  const dispatchRes = await request.post(`${baseURL}/api/notifications/dispatch`, {
    data: {
      type: "weekly_timetable",
      ageGroup: playerDetail.player.ageGroup,
      email: parentEmail
    }
  });
  expect(dispatchRes.ok()).toBeTruthy();
});
