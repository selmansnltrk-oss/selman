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
  buyer?: { memberId?: string };
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
) {
  const eligible = orders.flatMap((order) => {
    if (
      !order._id ||
      !order.planId ||
      !PLANS[order.planId] ||
      order.buyer?.memberId !== memberId
    )
      return [];
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
      return [];
    if (order.pausePeriods?.some((p) => p.status === "ACTIVE")) return [];
    if (order.autoRenewCanceled === true && end === null) return [];
    const paid = order.lastPaymentStatus === "PAID";
    // NOT_APPLICABLE is valid only for an explicit, time-bounded Wix trial.
    const trial =
      order.lastPaymentStatus === "NOT_APPLICABLE" &&
      order.currentCycle?.index === 0 &&
      cycle !== null &&
      cycle > now;
    if (!paid && !trial) return [];
    if (order.status === "CANCELED") {
      if (
        order.cancellation?.effectiveAt !== "NEXT_PAYMENT_DATE" ||
        end === null ||
        end <= now
      )
        return [];
    } else if (order.status !== "ACTIVE") return [];
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
