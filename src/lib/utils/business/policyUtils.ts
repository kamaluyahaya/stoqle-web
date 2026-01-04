// src/utils/policyUtils.ts
import { KEYS } from "./profilePrefs";

/** parse if JSON else return raw string/null */
export function safeParse<T = any>(value: string | null): T | string | null {
  if (value === null || value === undefined || value === "" || value === "null") {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    // fallback: if it's not valid JSON, just return the raw string
    return value;
  }
}


/** Remove null / undefined values recursively (keeps empty strings & false/0) */
export function pruneNulls(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(pruneNulls).filter((v) => v !== null && v !== undefined);
  }
  if (obj && typeof obj === "object") {
    const out: any = {};
    Object.entries(obj).forEach(([k, v]) => {
      if (v === null || v === undefined) return;
      const cleaned = pruneNulls(v);
      if (cleaned === null || cleaned === undefined) return;
      out[k] = cleaned;
    });
    return Object.keys(out).length ? out : null;
  }
  return obj;
}


export function mapPolicyToPrefs(policy: any): Record<string, string> {
  const out: Record<string, string> = {};

  if (!policy) {
    // return empty strings for keys to make overlay code simpler
    Object.values(KEYS).forEach((k) => (out[k] = ""));
    return out;
  }

  const shippingObj: any = {
    delivery_notice: policy.core?.delivery_notice ?? policy.delivery_notice ?? "",
    shipping_duration: Array.isArray(policy.shipping)
      ? policy.shipping.map((s: any) => ({ type: s.kind ?? s.type, value: s.value, unit: s.unit }))
      : policy.shipping_duration ?? [],
    additional_info: policy.returns?.additional_info ?? policy.additional_info ?? "",
  };

  const refundsObj: any = {
    return_shipping_subsidy: !!(policy.returns?.return_shipping_subsidy ?? policy.return_shipping_subsidy),
    seven_day_no_reason_return: !!(policy.returns?.seven_day_no_reason ?? policy.seven_day_no_reason_return),
    rapid_refund: !!(policy.returns?.rapid_refund ?? policy.rapid_refund),
    additional_info: policy.returns?.additional_info ?? policy.additional_info ?? "",
  };

  const paymentFirst = Array.isArray(policy.payments) ? policy.payments[0] : (policy.payment ?? null);
  const paymentObj: any = paymentFirst
    ? {
        acct_no: paymentFirst.account_number ?? paymentFirst.account_no ?? paymentFirst.accountNo ?? null,
        acct_name: paymentFirst.account_name ?? paymentFirst.accountName ?? null,
        bank_name: paymentFirst.bank_name ?? paymentFirst.bankName ?? null,
        bank_code: paymentFirst.bank_code ?? paymentFirst.bankCode ?? null,
        cod: !!paymentFirst.cod_enabled,
        pod: !!paymentFirst.pod_enabled,
        supportAvailable: !!paymentFirst.support_available,
        paystack_meta: paymentFirst.paystack_meta ?? null,
      }
    : {};

  const cs = policy.customer_service ?? policy.cs ?? {};
  const csObj: any = {
    cs_reply_time: cs.reply_time ?? cs.replyTime ?? "",
    cs_good_reviews_summary: cs.good_reviews_threshold ?? cs.cs_good_reviews_summary ?? 0,
    default_welcome_message: cs.welcome_message ?? cs.default_welcome_message ?? "",
  };

  const address = policy.address ?? {};
  const addressObj: any = {
    address_line_1: address.line1 ?? address.address_line_1 ?? address.street ?? "",
    address_line_2: address.line2 ?? address.address_line_2 ?? "",
    city: address.city ?? "",
    state: address.state ?? address.region ?? "",
    postal_code: address.postal_code ?? address.postalCode ?? "",
    country: address.country ?? "NG",
  };

  const market = policy.market_affiliation ?? policy.market ?? {};
  const marketObj: any = {
    from_market: market.market_name ?? market.from_market ?? "",
    note: market.note ?? "",
    trusted_partner: !!market.trusted_partner,
  };

  const promotionsArr = Array.isArray(policy.promotions)
    ? policy.promotions.map((p: any) => ({
        occasion: p.title ?? p.occasion ?? p.name ?? "",
        start: p.start_date ?? p.start ?? null,
        end: p.end_date ?? p.end ?? null,
        isActive: p.is_active ?? p.isActive ?? null,
        discount: p.discount_percent ? Number(p.discount_percent) : (p.discount ? Number(p.discount) : null),
      }))
    : [];

  const discountsArr = Array.isArray(policy.sales_discounts)
    ? policy.sales_discounts.map((d: any) => ({
        type: d.discount_type ?? d.type ?? "",
        discount: d.discount_percent ? Number(d.discount_percent) : (d.discount ? Number(d.discount) : null),
      }))
    : [];

  // stringified shapes (matching your prior localStorage format)
  out[KEYS.shipping] = JSON.stringify(shippingObj);
  out[KEYS.refunds] = JSON.stringify(refundsObj);
  out[KEYS.payment] = JSON.stringify(paymentObj);
  out[KEYS.customerService] = JSON.stringify(csObj);
  out[KEYS.address] = JSON.stringify(addressObj);
  out[KEYS.market] = JSON.stringify(marketObj);
  out[KEYS.promo] = JSON.stringify(promotionsArr);
  out[KEYS.discount] = JSON.stringify(discountsArr);

  // simple fields
  out[KEYS.name] = (policy.business_name ?? policy.name ?? "") as string;
  out[KEYS.region] = (policy.region ?? policy.state ?? "") as string;

  return out;
}

/**
 * savePolicyToLocal(policy)
 * - Optional convenience: persist the mapped policy to localStorage.
 * - Use this ONLY when you explicitly want to store the server policy in localStorage.
 */
export async function savePolicyToLocal(policy: any) {
  if (!policy) return;
  const mapped = mapPolicyToPrefs(policy);
  await Promise.all(
    Object.entries(mapped).map(([k, v]) => {
      try {
        localStorage.setItem(k, v ?? "");
      } catch {
        // ignore
      }
      return Promise.resolve();
    })
  );
}

/**
 * Legacy compat: keep assignPolicyToPrefs but make it call mapPolicyToPrefs and
 * optionally save only when `saveToLocal` === true. Default: DO NOT SAVE.
 */
export async function assignPolicyToPrefs(policy: any, saveToLocal = false) {
  // normalize arrays so empty ones are always []
  if (policy) {
    policy.promotions = Array.isArray(policy.promotions) ? policy.promotions : [];
    policy.sales_discounts = Array.isArray(policy.sales_discounts) ? policy.sales_discounts : [];
  }

  const mapped = mapPolicyToPrefs(policy);
  if (saveToLocal) {
    await savePolicyToLocal(policy);
  }
  return mapped;
}

