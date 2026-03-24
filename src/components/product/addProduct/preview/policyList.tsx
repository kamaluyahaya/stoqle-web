import React from "react";
import {
  TruckIcon,
  ClockIcon,
  ArrowPathIcon,
  LifebuoyIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

type PolicyListProps = {
  businessData: any;
  loading?: boolean;
  error?: string | null;
  openPolicyModal: (title: string, body: string) => void;
  payload?: any;
  selectedOptions?: Record<string, string>;
  onSelectClick?: () => void;
  onAddressClick?: () => void;
  estimation?: any;
  storedAddress?: any;
};

/** Convert numeric value + unit into a friendly string.
 * Examples:
 *   formatDuration(48, 'hours') => '2 days'
 *   formatDuration(49, 'hours') => '2 days 1 hour'
 *   formatDuration(3, 'days') => '3 days'
 *   formatDuration(36, 'hours') when unit='hours' => '1 day 12 hours'
 */
function formatDuration(value: number | string | undefined | null, unit?: string) {
  if (value == null) return "unknown duration";

  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);

  const u = String(unit ?? "").toLowerCase().trim();

  if (u === "km") return `${n} km`;

  // normalize unit to hours or days
  if (u.startsWith("d")) {
    // value is days
    const days = Math.floor(n);
    const hours = Math.round((n - days) * 24);
    if (hours === 0) return `${days} ${days === 1 ? "day" : "days"}`;
    return `${days} ${days === 1 ? "day" : "days"} ${hours} ${hours === 1 ? "hour" : "hours"}`;
  }

  // treat everything else as hours
  const totalMinutes = Math.round(n * 60);
  if (totalMinutes < 60) return `${totalMinutes} ${totalMinutes === 1 ? "minute" : "minutes"}`;

  const days = Math.floor(totalMinutes / (24 * 60));
  const remainingMinutes = totalMinutes % (24 * 60);
  const hours = Math.floor(remainingMinutes / 60);
  const mins = remainingMinutes % 60;

  let parts = [];
  if (days > 0) parts.push(`${days} ${days === 1 ? "day" : "days"}`);
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  if (mins > 0) parts.push(`${mins} ${mins === 1 ? "minute" : "minutes"}`);

  if (parts.length === 0) return "less than a minute";
  return parts.join(" ");
}

export default function PolicyList({
  businessData,
  loading,
  error,
  openPolicyModal,
  payload,
  selectedOptions,
  onSelectClick,
  estimation,
  storedAddress,
  onAddressClick,
}: PolicyListProps) {
  const policy = businessData?.policy ?? null;
  const business = businessData?.business ?? null;

  const effectiveReturnPolicy = React.useMemo(() => {
    if (payload?.policyOverrides && !payload.policyOverrides.useStoreDefaultReturn) {
      const over = payload.policyOverrides.returnPolicy;
      return {
        seven_day_no_reason: (over?.['7dayNoReasonReturn'] || over?.sevenDayNoReasonReturn) ? 1 : 0,
        rapid_refund: over?.rapidRefund ? 1 : 0,
        return_shipping_subsidy: over?.returnShippingSubsidy ? 1 : 0,
        return_window: over?.returnWindow ?? 3
      };
    }
    return policy?.returns ?? {};
  }, [payload?.policyOverrides, policy]);

  const effectiveShippingPolicies = React.useMemo(() => {
    if (payload?.policyOverrides && !payload.policyOverrides.useStoreDefaultShipping) {
      const over = payload.policyOverrides.shippingPolicy;
      return [
        { kind: "avg", value: over?.avgDuration, unit: over?.avgUnit },
        { kind: "promise", value: over?.promiseDuration, unit: over?.promiseUnit },
        { kind: "delivery_radius_km", value: over?.radiusKm, unit: "km" }
      ] as any[];
    }
    return (policy?.shipping || policy?.shipping_duration) ?? [];
  }, [payload?.policyOverrides, policy]);

  const vendorLoc = {
    latitude: Number(businessData?.business?.latitude || (businessData?.business as any)?.lat),
    longitude: Number(businessData?.business?.longitude || (businessData?.business as any)?.lng),
  };

  // Use estimation for durations if available
  const displayAvgDuration = React.useMemo(() => {
    if (estimation && !estimation.is_available) return "This vendor does not deliver to your location.";
    if (estimation?.is_available && estimation.estimated_delivery_time.getTime() > 0) {
      const now = new Date();
      const diffMs = estimation.estimated_delivery_time.getTime() - now.getTime();
      return `Ships within ${formatDuration(Math.max(0, diffMs / (1000 * 60 * 60)), "hours")}`;
    }
    const shippingAvg = effectiveShippingPolicies.find((s: any) => s.kind === "avg" || s.type === "avg");
    const val = shippingAvg ? formatDuration(shippingAvg.value, shippingAvg.unit) : "8 hours";
    return `Ships within ${val} on average`;
  }, [estimation, effectiveShippingPolicies]);

  const displayPromiseDuration = React.useMemo(() => {
    if (estimation && !estimation.is_available) return "N/A";
    if (estimation?.is_available && estimation.shipping_deadline.getTime() > 0) {
      const now = new Date();
      const diffMs = estimation.shipping_deadline.getTime() - now.getTime();
      return `Promise to ship within ${formatDuration(Math.max(0, diffMs / (1000 * 60 * 60)), "hours")}`;
    }
    const shippingPromise = effectiveShippingPolicies.find((s: any) => s.kind === "promise" || s.type === "promise");
    const val = shippingPromise ? formatDuration(shippingPromise.value, shippingPromise.unit) : "48 hours";
    return `Promise to ship within ${val}`;
  }, [estimation, effectiveShippingPolicies]);

  const selectedText = React.useMemo(() => {
    if (!payload?.hasVariants || !payload?.variantGroups?.length) return null;

    const selections = payload.variantGroups.map((group: any) => {
      const optionId = selectedOptions?.[group.id];
      const entry = group.entries.find((e: any) => e.id === optionId);
      return entry ? entry.name : null;
    }).filter(Boolean);

    return selections.length > 0 ? selections.join(", ") : "Select options";
  }, [payload, selectedOptions]);

  if (loading) return <div className="text-xs text-slate-400">loading…</div>;
  if (error) return <div className="mt-2 text-xs text-rose-600">{error}</div>;
  if (!businessData || !policy) return <div className="mt-2 text-xs text-slate-400">No business details available</div>;

  const shippingArray = effectiveShippingPolicies;
  const shippingAvg = shippingArray.find((s: any) => s.kind === "avg" || s.type === "avg") ?? null;
  const shippingPromise = shippingArray.find((s: any) => s.kind === "promise" || s.type === "promise") ?? null;
  const deliveryRadius = shippingArray.find((s: any) => s.kind === "delivery_radius_km" || s.type === "delivery_radius_km") ?? null;
  const deliveryNotice = policy?.core?.delivery_notice ?? null;
  const returns = effectiveReturnPolicy;
  const addressParts = [
    policy?.market_affiliation?.market_name || null,
    policy?.address?.city,
    policy?.address?.state,
  ].filter(Boolean);
  const fromText = addressParts.join(", ") || "Unknown";

  // Build a shipping-focused modal body
  const buildShippingInfoBody = () => {
    const lines: string[] = [];
    lines.push(`From: ${fromText}`);
    lines.push("");

    lines.push(`Average handling time: ${displayAvgDuration}`);
    lines.push(displayPromiseDuration);

    if (estimation?.is_available) {
      lines.push("");
      lines.push(`--- Delivery Breakdown ---`);
      lines.push(`Distance: ${estimation.distance_km} km`);
      lines.push(`Vendor prep time: ${formatDuration(estimation.prep_time_hours, "hours")}`);
      lines.push(`Rider travel time: ${formatDuration(estimation.travel_time_hours, "hours")}`);
    }

    if (deliveryRadius) {
      lines.push("");
      lines.push(`Delivery coverage: We can deliver up to ${deliveryRadius.value} km from our store.`);
    }

    lines.push("");
    lines.push("Delivery notice:");
    lines.push(deliveryNotice ? String(deliveryNotice) : "No delivery notice provided.");

    lines.push("");
    lines.push("Delay compensation:");
    lines.push(
      shippingPromise
        ? `If we fail to ship within the promised time (${formatDuration(shippingPromise.value, shippingPromise.unit)}), you are eligible for delay compensation according to the marketplace policy.`
        : "If we fail to ship within the promised time, delayed compensation is guaranteed according to marketplace rules."
    );

    lines.push("");
    lines.push("How this works:");
    lines.push(
      "- We attempt to ship the item from our listed location above.\n- If shipment is delayed beyond the promised timeframe, compensation (coupon or refund) will be provided according to policy exceptions."
    );

    return lines.join("\n");
  };

  const buildDelayCompensationBody = () => {
    const lines: string[] = [];

    lines.push(`Current shipping guarantee: We promise to ship within ${displayPromiseDuration}.`);
    lines.push("");
    lines.push("If your order is not shipped within this period:");
    lines.push("- You may be eligible for delay compensation (coupon or discount).");
    lines.push("- Compensation amount and form vary with product category and marketplace rules.");
    lines.push("");
    if (shippingPromise?.compensation) {
      lines.push(`Configured compensation: ${String(shippingPromise.compensation)}`);
    } else {
      lines.push("Configured compensation: Not specified by seller (marketplace default applies).");
    }

    return lines.join("\n");
  };

  const buildReturnSubsidyBody = () => {
    const lines: string[] = [];
    lines.push(`Return shipping subsidy: ${returns?.return_shipping_subsidy === 1 ? "Supported" : "Not supported"}`);
    if (returns?.rapid_refund === 1) lines.push("Rapid refund: Supported");
    if (returns?.additional_info) {
      lines.push("");
      lines.push(String(returns.additional_info));
    }
    return lines.join("\n");
  };


  return (
    <div className="rounded-lg mt-2 bg-white">
      <ul className="mt-3 space-y-2 text-sm text-slate-700">
        {/* Shipping information */}
        <li>
          <button
            type="button"
            onClick={() => openPolicyModal("Shipping Information", buildShippingInfoBody())}
            className="w-full flex items-center gap-3 py-1 rounded-md hover:bg-slate-50 text-left"
            aria-haspopup="dialog"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2 min-w-0">
                <TruckIcon className="w-5 h-5 text-slate-500 flex-shrink-0" />
                <div className="min-w-0 ">
                  <div className="flex items-center gap-1.5 text-xs font-medium truncate text-slate-600">
                    <span className="text-emerald-600 truncate shrink-0">{displayAvgDuration}</span>
                    <span className="text-slate-300 shrink-0">|</span>
                    <span className="truncate">{displayPromiseDuration}</span>
                  </div>
                  <div
                    className="mt-1 flex flex-col group cursor-pointer"
                  >
                    <span className="text-[11px] text-slate-400 group-hover:text-red-500 transition-colors leading-snug truncate">
                      {fromText}
                    </span>
                    <span className="font-medium text-[10px] text-slate-500 mt-0.5">
                      {estimation?.is_available ? `${estimation.distance_km} km away | Free shipping` : storedAddress ? `· ${estimation?.message || "Calculating..."}` : "· Set address to see distance | Free shipping"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <ChevronRightIcon className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
        </li>
        {/* Returns / subsidy */}
        <li>
          <button
            type="button"
            onClick={() => openPolicyModal("Return shipping subsidy", buildReturnSubsidyBody())}
            className="w-full flex items-center gap-3 py-1 rounded-md hover:bg-slate-50 text-left"
            aria-haspopup="dialog"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2 min-w-0">
                <ArrowPathIcon className="w-5 h-5 text-slate-500 flex-shrink-0" />
                <div className="min-w-0">
                  <div className={`font-medium truncate text-slate-700`}>
                    {/* {returns?.return_shipping_subsidy === 1 ? "Return shipping subsidy · Rapid refund" : "No return shipping subsidy"} */}
                    {returns?.return_shipping_subsidy === 1 && returns?.seven_day_no_reason === 1 && returns?.rapid_refund === 1 ? (
                      <div className="truncate">
                        Return shipping subsidy | 7-days no reason return | Rapid Refund
                      </div>
                    ) : returns?.return_shipping_subsidy === 1 && returns?.seven_day_no_reason === 1 ? (
                      <div className="truncate">
                        Return shipping subsidy | 7-days no reason return
                      </div>
                    ) : returns?.return_shipping_subsidy === 1 && returns?.rapid_refund === 1 ? (
                      <div className="truncate">
                        Return shipping subsidy | Rapid Refund
                      </div>
                    ) : returns?.seven_day_no_reason === 1 && returns?.rapid_refund === 1 ? (
                      <div className="truncate">
                        7-days no reason return | Rapid Refund
                      </div>
                    ) : returns?.return_shipping_subsidy === 1 ? (
                      <div className="">
                        Return shipping subsidy
                      </div>
                    ) : returns?.seven_day_no_reason === 1 ? (
                      <div className="truncate">
                        Vendor support 7-days no reason return
                      </div>
                    ) : returns?.rapid_refund === 1 ? (
                      <div className="">
                        Rapid Refund
                      </div>
                    ) : (
                      <div className="truncate">
                        No return shipping subsidy | No rapid refund | Does not support 7-days no reason return
                      </div>
                    )}
                  </div>
                  {returns?.additional_info && <div className="text-xs text-slate-500 mt-1 truncate">{String(returns.additional_info)}</div>}
                </div>
              </div>
            </div>

            <ChevronRightIcon className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
        </li>

        {/* Selected: */}
        {selectedText && (
          <li>
            <button
              type="button"
              onClick={onSelectClick}
              className="w-full flex items-center gap-3 py-1 rounded-md hover:bg-slate-50 text-left"
              aria-haspopup="dialog"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2 min-w-0">
                  <ClockIcon className="w-5 h-5 text-slate-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-slate-700 truncate flex">Selected: <div className="bg-slate-200 px-2 ml-2 flex">{selectedText}</div></div>
                  </div>
                </div>
              </div>

              <ChevronRightIcon className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          </li>
        )}


        {/* Returns notes — only show if present */}
        {returns?.additional_info && (
          <li>
            <button
              type="button"
              onClick={() => openPolicyModal("Returns — notes", String(returns.additional_info))}
              className="w-full flex items-center gap-3 py-1 rounded-md hover:bg-slate-50 text-left"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2 min-w-0">
                  <LifebuoyIcon className="w-5 h-5 text-slate-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800 truncate">Returns — notes</div>
                    <div className="text-xs text-slate-500 mt-1 truncate">{String(returns.additional_info)}</div>
                  </div>
                </div>
              </div>

              <ChevronRightIcon className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          </li>
        )}

      </ul>
    </div >
  );
}
