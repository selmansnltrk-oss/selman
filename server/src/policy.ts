export const SITE_ID = "ece5420a-0b61-4879-8872-0e899f7628b5";
export const PLANS: Record<string, { label: string; price: string }> =
  Object.freeze({
    "8ca42153-8cfb-4f1a-ad5a-7819a781ec42": {
      label: "Aylık Üyelik",
      price: "119 TL/ay",
    },
    "77a5c1a3-b8b6-4669-b346-570a06a05778": {
      label: "Yıllık Üyelik",
      price: "899 TL/yıl",
    },
  });
export interface WixOrder {
  _id?: string;
  planId?: string;
  buyer?: { memberId?: string; contactId?: string };
  status?: string;
  lastPaymentStatus?: string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  autoRenewCanceled?: boolean | null;
  cancellation?: { effectiveAt?: string };
  currentCycle?: {
    index?: number;
    startedDate?: Date | string | null;
    endedDate?: Date | string | null;
  };
  pausePeriods?: {
    status?: string;
    pauseDate?: Date | string | null;
    resumeDate?: Date | string | null;
  }[];
}
function timestamp(value: Date | string | null | undefined) {
  if (value === null || value === undefined) return null;
  const n = +new Date(value);
  return Number.isFinite(n) ? n : NaN;
}
export function entitlement(
  orders: WixOrder[],
  memberId: string,
  now = Date.now(),
  onReject?: (reason: string) => void,
) {
  const reject = (reason: string) => {
    onReject?.(reason);
    return [];
  };
  const eligible = orders.flatMap((order) => {
    if (!order._id) return reject("missing_order_id");
    if (!order.planId || !Object.hasOwn(PLANS, order.planId))
      return reject("plan_not_allowed");
    // contactId is a different identifier; never compare it with memberId.
    if (order.buyer?.memberId !== memberId) return reject("member_mismatch");
    const start = timestamp(order.startDate),
      end = timestamp(order.endDate),
      cycle = timestamp(order.currentCycle?.endedDate);
    if (
      start === null ||
      !Number.isFinite(start) ||
      start > now ||
      (end !== null && (!Number.isFinite(end) || end <= now)) ||
      (cycle !== null && !Number.isFinite(cycle))
    )
      return reject("invalid_or_expired_dates");
    if (order.pausePeriods?.some((p) => p.status === "ACTIVE"))
      return reject("paused");
    if (order.autoRenewCanceled === true && end === null)
      return reject("canceled_without_end");
    // Wix NOT_APPLICABLE means no payment was necessary (free/assigned plans
    // or trials). It is not an unpaid/failed payment and requires no cycle index.
    const paid =
      order.lastPaymentStatus === "PAID" ||
      order.lastPaymentStatus === "NOT_APPLICABLE";
    if (!paid) return reject("payment_not_entitled");
    if (order.status === "CANCELED") {
      if (
        order.cancellation?.effectiveAt !== "NEXT_PAYMENT_DATE" ||
        end === null ||
        end <= now
      )
        return reject("cancellation_effective");
    } else if (order.status !== "ACTIVE") return reject("status_not_active");
    // Do not infer expiry by adding 30/365 days or by using displayed plan prices.
    const accessUntil = end === null ? null : new Date(end).toISOString();
    const refreshAt = Math.min(
      now + 5 * 60_000,
      end ?? Infinity,
      cycle !== null && cycle > now ? cycle : Infinity,
    );
    return [
      {
        orderId: order._id,
        planId: order.planId,
        planName: PLANS[order.planId].label,
        status: order.status,
        paymentStatus: order.lastPaymentStatus,
        autoRenewCanceled: order.autoRenewCanceled === true,
        accessUntil,
        nextRenewal:
          order.autoRenewCanceled || order.status === "CANCELED"
            ? null
            : cycle === null
              ? null
              : new Date(cycle).toISOString(),
        leaseUntil: new Date(refreshAt).toISOString(),
      },
    ];
  });
  eligible.sort((a, b) => +new Date(b.leaseUntil) - +new Date(a.leaseUntil));
  return eligible[0] ?? null;
}
