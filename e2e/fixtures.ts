import { test as base, expect } from "@playwright/test";
// Browser-only test double. Not compiled into Electron or production bundles.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      const active = {
        phase: "active",
        access: true,
        member: {
          _id: "financial-fixture",
          name: "Test Member",
          email: "fixture@example.invalid",
        },
        subscription: {
          planName: "Aylık Üyelik",
          status: "ACTIVE",
          autoRenewCanceled: false,
          accessUntil: null,
          nextRenewal: null,
        },
        leaseUntil: new Date(Date.now() + 300000).toISOString(),
      };
      Object.assign(window, {
        defterMembership: {
          state: async () => active,
          check: async () => active,
          login: async () => active,
          logout: async () => ({ phase: "signed-out", access: false }),
          website: async () => {},
          subscribe: () => () => {},
        },
      });
    });
    await use(page);
  },
});
export { expect };
