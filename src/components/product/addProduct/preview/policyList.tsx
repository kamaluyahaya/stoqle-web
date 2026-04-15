import React from "react";
import {
  TruckIcon,
  ClockIcon,
  ArrowPathIcon,
  LifebuoyIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { formatDuration } from "@/src/lib/utils/product/duration";

type PolicyListProps = {
  businessData: any;
  loading?: boolean;
  error?: string | null;
  openPolicyModal: (title: string, body: string, type?: "shipping" | "policy") => void;
  payload?: any;
  selectedOptions?: Record<string, string>;
  onSelectClick?: () => void;
  onAddressClick?: () => void;
  estimation?: any;
  storedAddress?: any;
};


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
    const storeReturns = policy?.returns ?? {};
    if (payload?.policyOverrides && !payload.policyOverrides.useStoreDefaultReturn) {
      const over = payload.policyOverrides.returnPolicy;
      return {
        seven_day_no_reason: (over?.['7dayNoReasonReturn'] ?? over?.sevenDayNoReasonReturn) !== undefined
          ? (over?.['7dayNoReasonReturn'] || over?.sevenDayNoReasonReturn ? 1 : 0)
          : (storeReturns.seven_day_no_reason ?? 0),
        rapid_refund: over?.rapidRefund !== undefined
          ? (over.rapidRefund ? 1 : 0)
          : (storeReturns.rapid_refund ?? 0),
        return_shipping_subsidy: over?.returnShippingSubsidy !== undefined
          ? (over.returnShippingSubsidy ? 1 : 0)
          : (storeReturns.return_shipping_subsidy ?? 0),
        late_shipment: over?.lateShipmentCompensation !== undefined
          ? (over.lateShipmentCompensation ? 1 : 0)
          : (storeReturns.late_shipment ?? 0),
        fake_one_pay_four: over?.fakeOnePayFour !== undefined
          ? (over.fakeOnePayFour ? 1 : 0)
          : (storeReturns.fake_one_pay_four ?? 0),
        return_window: over?.returnWindow ?? storeReturns.return_window ?? 3,
        additional_info: over?.additionalInfo ?? storeReturns.additional_info
      };
    }
    return storeReturns;
  }, [payload?.policyOverrides, policy]);

  const effectiveShippingPolicies = React.useMemo(() => {
    const storeShipping = (policy?.shipping || policy?.shipping_duration) ?? [];
    const getStoreRule = (kind: string) => storeShipping.find((s: any) => s.kind === kind || s.type === kind);

    if (payload?.policyOverrides && !payload.policyOverrides.useStoreDefaultShipping) {
      const over = payload.policyOverrides.shippingPolicy;
      const rules = [];

      // Avg Duration
      const avgRule = getStoreRule("avg");
      rules.push({
        kind: "avg",
        value: over?.avgDuration ?? avgRule?.value,
        unit: over?.avgUnit ?? avgRule?.unit
      });

      // Promise Duration
      const promiseRule = getStoreRule("promise");
      rules.push({
        kind: "promise",
        value: over?.promiseDuration ?? promiseRule?.value,
        unit: over?.promiseUnit ?? promiseRule?.unit
      });

      // Delivery Radius
      const radiusRule = getStoreRule("delivery_radius_km");
      rules.push({
        kind: "delivery_radius_km",
        value: over?.radiusKm ?? radiusRule?.value,
        unit: "km"
      });

      return rules as any[];
    }
    return storeShipping;
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
  if (!businessData) return <div className="mt-2 text-xs text-slate-400">No business details available</div>;

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
  const fromText = addressParts.join(", ");

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

    // 7-day return
    if (returns?.seven_day_no_reason === 1) {
      lines.push("7-day no reason return:");
      lines.push("When the corresponding conditions are met, consumers can apply for a \"7-day no-reason return\".");
      lines.push("");
    } else {
      lines.push("No return without a valid reason:");
      lines.push("This product does not support a \"7-day no-reason return\". A valid reason (e.g. damaged goods, wrong item) is required for all returns.");
      lines.push("");
    }

    // Rapid refund
    if (returns?.rapid_refund === 1) {
      lines.push("Rapid refund:");
      lines.push("Under qualifying conditions, users with good credit can receive immediate refunds when applying for a [Pre-shipment Refund] or after [submitting a return request and shipping the returned item].");
      lines.push("");
    }

    // Shipping subsidy
    if (returns?.return_shipping_subsidy === 1) {
      lines.push("Return shipping subsidy:");
      lines.push("Provided by the seller, returns and exchanges can enjoy free first weight (within one kilogram) for delivery methods provided by the platform, such as door-to-door pickup. If you choose to ship back on your own, the shipping cost will be subsidized according to the first weight standard.");
      lines.push("");
    }

    // Late shipment
    if (returns?.late_shipment === 1) {
      lines.push("Late shipment compensation:");
      lines.push("If the order is not shipped within the promised fulfillment time, you will receive compensation for the delay.");
      lines.push("");
    }

    // Fake one pay four
    if (returns?.fake_one_pay_four === 1) {
      lines.push("Fake one pay four:");
      lines.push("If the product is proven to be a counterfeit, the seller is committed to providing a refund of four times the original purchase price.");
      lines.push("");
    }

    if (returns?.additional_info) {
      lines.push("Additional Policy Details:");
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
            onClick={() => openPolicyModal("Shipping Information", buildShippingInfoBody(), "shipping")}
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
                    {fromText && (
                      <span className="text-[11px] text-slate-400 group-hover:text-red-500 transition-colors leading-snug truncate">
                        {fromText}
                      </span>
                    )}
                    <span className="font-medium text-[10px] text-slate-500 mt-0.5">
                      {deliveryRadius ? `Free delivery up to ${deliveryRadius.value} km ` : "· Free delivery within Kaduna axis"}
                      {estimation?.is_available && ` · ${estimation.distance_km} km away`}
                      {!estimation?.is_available && storedAddress && ` | ${estimation?.message || "Outside coverage"}`}
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
            onClick={() => openPolicyModal("Service Description", buildReturnSubsidyBody(), "policy")}
            className="w-full flex items-center gap-3 py-1 rounded-md hover:bg-slate-50 text-left"
            aria-haspopup="dialog"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2 min-w-0">
                <ArrowPathIcon className="w-5 h-5 text-slate-500 flex-shrink-0" />
                <div className="min-w-0">
                  <div className={`font-medium truncate text-slate-600`}>
                    {(() => {
                      const active = [];
                      if (returns?.return_shipping_subsidy === 1) active.push("Return shipping subsidy");
                      if (returns?.seven_day_no_reason === 1) active.push("7-day no reason return");
                      if (returns?.rapid_refund === 1) active.push("Rapid refund");
                      if (returns?.late_shipment === 1) active.push("Late shipment compensation");
                      if (returns?.fake_one_pay_four === 1) active.push("Fake one pay four");

                      if (active.length > 0) {
                        return <div className="truncate">{active.join(" | ")}</div>;
                      }

                      return (
                        <div className="truncate text-slate-400">
                          Product has no return subsidy
                        </div>
                      );
                    })()}
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
                    <div className="font-medium text-slate-600 truncate flex">Selected: <div className="bg-slate-200 px-2 ml-2 flex rounded">{selectedText}</div></div>
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
              onClick={() => openPolicyModal("Returns — notes", String(returns.additional_info), "policy")}
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
