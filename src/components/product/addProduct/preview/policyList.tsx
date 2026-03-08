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

  // normalize unit to hours or days
  if (u.startsWith("d")) {
    // value is days
    const days = Math.floor(n);
    const hours = Math.round((n - days) * 24);
    if (hours === 0) return `${days} ${days === 1 ? "day" : "days"}`;
    return `${days} ${days === 1 ? "day" : "days"} ${hours} ${hours === 1 ? "hour" : "hours"}`;
  }

  // treat everything else as hours
  const totalHours = Math.round(n);
  if (totalHours < 24) return `${totalHours} ${totalHours === 1 ? "hour" : "hours"}`;

  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (hours === 0) return `${days} ${days === 1 ? "day" : "days"}`;
  return `${days} ${days === 1 ? "day" : "days"} ${hours} ${hours === 1 ? "hour" : "hours"}`;
}

export default function PolicyList({
  businessData,
  loading,
  error,
  openPolicyModal,
  payload,
  selectedOptions,
  onSelectClick,
}: PolicyListProps) {
  const policy = businessData?.policy ?? null;
  const business = businessData?.business ?? null;

  if (loading) return <div className="text-xs text-slate-400">loading…</div>;
  if (error) return <div className="mt-2 text-xs text-rose-600">{error}</div>;
  if (!businessData || !policy) return <div className="mt-2 text-xs text-slate-400">No business details available</div>;

  const shippingArray = Array.isArray(policy?.shipping) ? policy.shipping : Array.isArray(policy?.shipping_duration) ? policy.shipping_duration : [];
  const shippingAvg = shippingArray.find((s: any) => s.kind === "avg" || s.type === "avg") ?? null;
  const shippingPromise = shippingArray.find((s: any) => s.kind === "promise" || s.type === "promise") ?? null;
  const deliveryNotice = policy?.core?.delivery_notice ?? null;
  const returns = policy?.returns ?? {};
  const addressParts = [
    policy?.market_affiliation?.market_name || null,
    policy?.address?.line1,
    policy?.address?.city,
    policy?.address?.state,
  ].filter(Boolean);
  const fromText = addressParts.join(", ") || business?.business_address || "Unknown";

  // Build a shipping-focused modal body
  const buildShippingInfoBody = () => {
    const lines: string[] = [];

    lines.push(`From: ${fromText}`);
    lines.push("");

    if (shippingPromise) {
      const val = shippingPromise.value;
      const unit = shippingPromise.unit ?? "hours";
      lines.push(`Shipping promise: We promise to ship within ${formatDuration(val, unit)} (${val} ${unit}).`);
      if (shippingPromise?.notes) {
        lines.push("");
        lines.push(`Notes: ${String(shippingPromise.notes)}`);
      }
    } else {
      lines.push("Shipping promise: We aim to ship within 48 hours.");
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

    if (shippingPromise) {
      lines.push(`Promised shipping window: ${formatDuration(shippingPromise.value, shippingPromise.unit)} (${shippingPromise.value} ${shippingPromise.unit})`);
      if (shippingPromise.estimated_handling_time) {
        lines.push(`Estimated handling time: ${String(shippingPromise.estimated_handling_time)}`);
      }
      lines.push("");
      lines.push("If your order is not shipped within the promised period:");
      lines.push("- You may be eligible for delay compensation (coupon or discount).");
      lines.push("- Compensation amount and form vary with product category and marketplace rules.");
      lines.push("");
      if (shippingPromise?.compensation) {
        lines.push(`Configured compensation: ${String(shippingPromise.compensation)}`);
      } else {
        lines.push("Configured compensation: Not specified by seller (marketplace default applies).");
      }
    } else {
      lines.push("No shipping promise configured. Marketplace default shipping guarantee applies (typically 48 hours).");
      lines.push("");
      lines.push("If your order isn't shipped within the expected time, contact support for delay compensation.");
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

  const selectedText = React.useMemo(() => {
    if (!payload?.hasVariants || !payload?.variantGroups?.length) return null;

    const selections = payload.variantGroups.map((group: any) => {
      const optionId = selectedOptions?.[group.id];
      const entry = group.entries.find((e: any) => e.id === optionId);
      return entry ? entry.name : null;
    }).filter(Boolean);

    return selections.length > 0 ? selections.join(", ") : "Select options";
  }, [payload, selectedOptions]);

  return (
    <div className="rounded-lg mt-2 bg-white">
      <div className="flex items-center justify-between ">
        <div className="text-sm font-medium text-slate-800">Business policies</div>
      </div>

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
                  <div className="font-medium truncate text-emerald-600 flex truncate">
                    Ships within {shippingAvg ? formatDuration(shippingAvg.value, shippingAvg.unit) : "8 hours"} in average <div className="text-slate-600 truncate"> | Promise to ship within {shippingPromise ? formatDuration(shippingPromise.value, shippingPromise.unit) : "48 hours"} | Delayed compensation guaranteed </div>
                  </div>
                  <div className="text-xs mt-1 truncate text-slate-500">Kaduna, From {fromText} Free shipping</div>
                </div>
              </div>
            </div>

            <ChevronRightIcon className="w-5 h-5 text-slate-400 shrink-0" />
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

            <ChevronRightIcon className="w-5 h-5 text-slate-400 shrink-0" />
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

              <ChevronRightIcon className="w-5 h-5 text-slate-400 shrink-0" />
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

              <ChevronRightIcon className="w-5 h-5 text-slate-400 shrink-0" />
            </button>
          </li>
        )}

      </ul>
    </div >
  );
}
