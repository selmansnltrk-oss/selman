import { it, expect, vi } from "vitest";
import { WixProvider } from "../server/src/wix";
import { entitlement, PLANS } from "../server/src/policy";
const tokens = {
  accessToken: {
    value: "test-only",
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  },
  refreshToken: { value: "test-only-refresh", role: "member" as const },
};
function fixture(response: unknown) {
  const provider = new WixProvider("7b23a54e-e11b-4d43-b738-e5704e8723e6");
  const list = vi.fn().mockResolvedValue(response);
  vi.spyOn(provider, "client").mockReturnValue({
    auth: { getTokens: () => tokens },
    members: {
      getCurrentMember: async () => ({
        member: {
          _id: "verified-member",
          status: "APPROVED",
          contactId: "different-contact",
        },
      }),
    },
    orders: { memberListOrders: list },
  } as never);
  return { provider, list };
}
it("uses authenticated member orders without admin queries or caller-supplied buyer IDs", async () => {
  const { provider, list } = fixture({ orders: [] });
  const value = await provider.inspect(tokens);
  expect(value.member._id).toBe("verified-member");
  expect(list).toHaveBeenCalledWith({ limit: 50, offset: 0 });
});
it("missing orders or query failures are errors, not an empty subscription list", async () => {
  await expect(fixture({}).provider.inspect(tokens)).rejects.toThrow(
    "INVALID_ORDER_RESPONSE",
  );
  const { provider, list } = fixture({ orders: [] });
  list.mockRejectedValue(Error("network"));
  await expect(provider.inspect(tokens)).rejects.toThrow("network");
});
it("accepts Wix no-payment-needed active grants, still rejects other owners and invalid plans/statuses", () => {
  const now = Date.now();
  const order = {
    _id: "order-not-member-or-plan",
    planId: Object.keys(PLANS)[0],
    buyer: { memberId: "verified-member", contactId: "different-contact" },
    status: "ACTIVE",
    lastPaymentStatus: "NOT_APPLICABLE",
    startDate: new Date(now - 60000),
    endDate: new Date(now + 60000),
  };
  expect(entitlement([order], "verified-member", now)).not.toBeNull();
  expect(entitlement([order], "different-contact", now)).toBeNull();
  for (const patch of [
    { buyer: { memberId: "other-member", contactId: "verified-member" } },
    { planId: "unapproved-plan" },
    { status: "ENDED" },
    { endDate: new Date(now - 1) },
    { lastPaymentStatus: "FAILED" },
    { lastPaymentStatus: "UNPAID" },
    { lastPaymentStatus: "PENDING" },
  ])
    expect(
      entitlement([{ ...order, ...patch }], "verified-member", now),
    ).toBeNull();
});

it("accepts the monthly plan ID shown in Wix and rejects the previously mistyped ID", () => {
  const now = Date.now();
  const order = {
    _id: "test-order", planId: "e8ad2153-8cfb-4f1a-ad5a-7819a781ec42",
    buyer: { memberId: "verified-member" }, status: "ACTIVE",
    lastPaymentStatus: "PAID", startDate: new Date(now - 60000),
    endDate: new Date(now + 60000),
  };
  expect(entitlement([order], "verified-member", now)?.planName).toBe("Aylık Üyelik");
  expect(entitlement([{ ...order, planId: "8ca42153-8cfb-4f1a-ad5a-7819a781ec42" }], "verified-member", now)).toBeNull();
});
