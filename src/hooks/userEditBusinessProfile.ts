// src/hooks/useEditBusinessProfile.tsx
"use client";
import { useEffect, useState, useMemo, SetStateAction, Dispatch } from "react";
import { toast } from "sonner";
import {
  KEYS,
  loadField,
  saveField,
  clearAll,
  hasPendingPrefsDataSync,
  markDirty,
  getDirtyKeys,
  clearDirty,
} from "../lib/utils/business/profilePrefs";
import {
  safeParse,
  pruneNulls,
  mapPolicyToPrefs,
} from "../lib/utils/business/policyUtils";

export function useEditBusinessProfile({
  apiBase = "",
  business = null,
  businessPolicy = null,
}: {
  apiBase?: string;
  business?: any | null;
  businessPolicy?: any | null;
}) {
  const [name, setName] = useState("");
  const [shipping, setShipping] = useState("");
  const [refunds, setRefunds] = useState("");
  const [payment, setPayment] = useState("");
  const [customerService, setCustomerService] = useState("");
  const [address, setAddress] = useState("");
  const [market, setMarket] = useState("");
  const [promo, setPromo] = useState("");
  const [discount, setDiscount] = useState("");
  const [region, setRegion] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalProps, setModalProps] = useState<{ title: string; key: string; value: string } | null>(null);

  // tracked dirty keys (so UI updates when keys are marked/cleared)
  const [dirtyKeys, setDirtyKeys] = useState<string[]>([]);

  // helper that updates local dirtyKeys state from storage
  function refreshDirtyKeys() {
    try {
      setDirtyKeys(getDirtyKeys());
    } catch {
      setDirtyKeys([]);
    }
  }

  /** small helper — only set if changed (avoids unnecessary renders) */
function safeSet(
  setter: Dispatch<SetStateAction<string>>,
  value: string
) {
  setter((prev) => (prev === value ? prev : value));
}

  async function loadLocalPrefs() {
    const n = (await loadField(KEYS.name)) ?? "";
    const s = (await loadField(KEYS.shipping)) ?? "";
    const r = (await loadField(KEYS.refunds)) ?? "";
    const p = (await loadField(KEYS.payment)) ?? "";
    const a = (await loadField(KEYS.address)) ?? "";
    const m = (await loadField(KEYS.market)) ?? "";
    const cs = (await loadField(KEYS.customerService)) ?? "";
    const pr = (await loadField(KEYS.promo)) ?? "";
    const d = (await loadField(KEYS.discount)) ?? "";
    const rg = (await loadField(KEYS.region)) ?? "";

    return {
      name: n,
      shipping: s,
      refunds: r,
      payment: p,
      address: a,
      market: m,
      customerService: cs,
      promo: pr,
      discount: d,
      region: rg,
    };
  }

  /* ---------- Fetch helper ---------- */
  async function fetchLatestPolicyFromApi(bizId?: number | null) {
    if (!apiBase) return null;
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) return null;

    try {
      const tryUrls = [
        `${apiBase.replace(/\/$/, "")}/api/business/me`,
        bizId ? `${apiBase.replace(/\/$/, "")}/api/business/${encodeURIComponent(String(bizId))}` : undefined,
      ].filter(Boolean) as string[];

      for (const url of tryUrls) {
        try {
          const res = await fetch(url, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) continue;
          const json = await res.json();
          const possiblePolicy =
            json.policy ?? json.businessPolicy ?? json.business_policy ?? json.data?.policy ?? json;
          return possiblePolicy;
        } catch (e) {
          // try next
        }
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  /* ---------- INITIAL MOUNT: map API policy -> state (no localStorage writes) ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);

      // 1) Get server policy (prefer prop; fallback to fetching)
      let policyObj = businessPolicy;
      if (!policyObj && apiBase) {
        try {
          policyObj = await fetchLatestPolicyFromApi(business?.business_id ?? null);
        } catch (err) {
          console.warn("Failed to fetch business policy:", err);
        }
      }

      // 2) Map server policy -> shapes (stringified) WITHOUT saving to localStorage
      if (!cancelled && policyObj) {
        try {
          const mapped = mapPolicyToPrefs(policyObj);
          safeSet(setShipping, mapped[KEYS.shipping] ?? "");
          safeSet(setRefunds, mapped[KEYS.refunds] ?? "");
          safeSet(setPayment, mapped[KEYS.payment] ?? "");
          safeSet(setCustomerService, mapped[KEYS.customerService] ?? "");
          safeSet(setAddress, mapped[KEYS.address] ?? "");
          safeSet(setMarket, mapped[KEYS.market] ?? "");
          safeSet(setPromo, mapped[KEYS.promo] ?? "");
          safeSet(setDiscount, mapped[KEYS.discount] ?? "");
          safeSet(setName, mapped[KEYS.name] ?? "");
          safeSet(setRegion, mapped[KEYS.region] ?? "");
        } catch (err) {
          console.error("mapPolicyToPrefs -> apply error:", err);
        }
      }

      // 3) Overlay any staged local edits on top of mapped API values (so user's drafts show)
      try {
        const staged = await loadLocalPrefs();
        if (!cancelled && staged) {
          if (staged.name) safeSet(setName, staged.name);
          if (staged.shipping) safeSet(setShipping, staged.shipping);
          if (staged.refunds) safeSet(setRefunds, staged.refunds);
          if (staged.payment) safeSet(setPayment, staged.payment);
          if (staged.address) safeSet(setAddress, staged.address);
          if (staged.market) safeSet(setMarket, staged.market);
          if (staged.customerService) safeSet(setCustomerService, staged.customerService);
          if (staged.promo) safeSet(setPromo, staged.promo);
          if (staged.discount) safeSet(setDiscount, staged.discount);
          if (staged.region) safeSet(setRegion, staged.region);
        }
      } catch (err) {
        console.warn("failed to overlay staged edits:", err);
      }

      // 4) initialize dirtyKeys from storage (so submit button state is correct)
      refreshDirtyKeys();

      if (!cancelled) setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // re-run when businessPolicy or apiBase changes
  }, [businessPolicy, apiBase]);

  // warn on unload if there are staged edits (uses profilePrefs.hasPendingPrefsDataSync)
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasPendingPrefsDataSync()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // hasAnyFilledField is now strictly "are there dirty keys?"
  const hasAnyFilledField = useMemo(() => {
    return dirtyKeys.length > 0;
  }, [dirtyKeys]);

  function openEditor(title: string, key: string, value: string) {
    setModalProps({ title, key, value });
    setModalOpen(true);
  }

  /**
   * saveEditorValue: saves *only* the edited section to localStorage (staging).
   * Marks the key dirty so the UI enables Submit.
   */
  async function saveEditorValue(key: string, val: string) {
    await saveField(key, val);
    try {
      markDirty(key); // mark as edited by the user
    } catch (err) {
      // ignore
    }
    // refresh dirty keys to update UI
    refreshDirtyKeys();

    switch (key) {
      case KEYS.name: setName(val); break;
      case KEYS.shipping: setShipping(val); break;
      case KEYS.refunds: setRefunds(val); break;
      case KEYS.payment: setPayment(val); break;
      case KEYS.customerService: setCustomerService(val); break;
      case KEYS.address: setAddress(val); break;
      case KEYS.market: setMarket(val); break;
      case KEYS.promo: setPromo(val); break;
      case KEYS.discount: setDiscount(val); break;
      case KEYS.region: setRegion(val); break;
      default: break;
    }
  }

  async function saveProfile() {
    if (isSyncing) return;
    setIsSyncing(true);

    // read staged edits (so we send the latest staged edits)
    const staged = await loadLocalPrefs();

    // build payload using staged fields if present, else use current state
    const shippingVal = staged.shipping ?? shipping;
    const refundsVal = staged.refunds ?? refunds;
    const paymentVal = staged.payment ?? payment;
    const customerServiceVal = staged.customerService ?? customerService;
    const addressVal = staged.address ?? address;
    const marketVal = staged.market ?? market;
    const promoVal = staged.promo ?? promo;
    const discountVal = staged.discount ?? discount;

    const shippingParsed = safeParse(shippingVal);
    let shippingDuration: any[] = [];
    if (Array.isArray(shippingParsed)) {
      shippingDuration = shippingParsed;
    } else if (shippingParsed && typeof shippingParsed === "object") {
      shippingDuration = Array.isArray(shippingParsed.shipping_duration) ? shippingParsed.shipping_duration : [];
    }

    const refundsParsed = safeParse(refundsVal);
    const paymentParsed = safeParse(paymentVal);
    const customerServiceParsed = safeParse(customerServiceVal);
    const addressParsed = safeParse(addressVal);
    const marketParsed = safeParse(marketVal);
    const promoParsed = safeParse(promoVal);
    

    let promotions: any[] = [];
    if (Array.isArray(promoParsed)) promotions = promoParsed;
    else if (promoParsed && typeof promoParsed === "object") {
      promotions = promoParsed.promotions ?? promoParsed.promotion_list ?? promoParsed.list ?? [];
    }

  // Only include promotion if user staged/edited it
const promotionObj =
  dirtyKeys.includes(KEYS.promo) && promoParsed
    ? (() => {
        // Normalize to a single object
        if (Array.isArray(promoParsed)) return promoParsed[0] ?? null;
        if (promoParsed.promotions && Array.isArray(promoParsed.promotions))
          return promoParsed.promotions[0] ?? null;
        if (promoParsed.promotion_list && Array.isArray(promoParsed.promotion_list))
          return promoParsed.promotion_list[0] ?? null;
        if (promoParsed.type || promoParsed.name) return promoParsed;
        return null;
      })()
    : null;

// Only include promotions if user staged/edited them
const promotionsPayload =
  dirtyKeys.includes(KEYS.promo) && promoParsed
    ? (() => {
        // Normalize to array
        if (Array.isArray(promoParsed)) return promoParsed;
        if (promoParsed.promotions && Array.isArray(promoParsed.promotions))
          return promoParsed.promotions;
        if (promoParsed.promotion_list && Array.isArray(promoParsed.promotion_list))
          return promoParsed.promotion_list;
        // Single object case
        if (promoParsed.type || promoParsed.name) return [promoParsed];
        return [];
      })()
    : undefined;



   

    const shippingObj = typeof shippingParsed === "string" ? { delivery_notice: shippingParsed } : (shippingParsed || {});
    const refundsObj = typeof refundsParsed === "string" ? {} : (refundsParsed || {});
    const paymentObj = typeof paymentParsed === "string" ? {} : (paymentParsed || {});
    const csObj = typeof customerServiceParsed === "string" ? {} : (customerServiceParsed || {});
    const addressObj = typeof addressParsed === "string" ? {} : (addressParsed || {});
    const marketObj = typeof marketParsed === "string" ? {} : (marketParsed || {});

    const bizId = business?.business_id ?? (() => {
      try { const val = localStorage.getItem("business_id"); return val ? Number(val) : null; } catch { return null; }
    })();

    if (!bizId) {
      toast("No business id available. Please open the business page and try again.");
      setIsSyncing(false);
      return;
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      toast("No auth token found. Please sign in.");
      setIsSyncing(false);
      return;
    }
// normalize single discount object (support a few possible shapes)
const discountParsed = safeParse(discountVal);
// Only include discount if user staged/edited it
const discountObj =
  dirtyKeys.includes(KEYS.discount) && discountParsed
    ? (() => {
        if (Array.isArray(discountParsed.discounts) && discountParsed.discounts.length > 0)
          return discountParsed.discounts[0];
        if (Array.isArray(discountParsed) && discountParsed.length > 0)
          return discountParsed[0];
        if (discountParsed.type || discountParsed.discount !== undefined)
          return discountParsed;
        if (Array.isArray(discountParsed.discount_list) && discountParsed.discount_list.length > 0)
          return discountParsed.discount_list[0];
        return null;
      })()
    : null;

const discountsPayload = discountObj
  ? [
      {
        type: discountObj.type ?? discountObj.name ?? "Vendor Discount",
        discount: Number(discountObj.discount ?? discountObj.discount_percent ?? 0),
      },
    ]
  : undefined; // <--- use undefined to **not overwrite** if unchanged


  // Only include shipping if it was staged/edited
const shippingPayload = dirtyKeys.includes(KEYS.shipping)
  ? {
      delivery_notice: shippingObj.delivery_notice ?? shippingObj.deliveryNotice ?? (typeof shippingParsed === "string" ? shippingParsed : undefined),
      shipping_duration: shippingDuration,
      additional_info: shippingObj.additional_info ?? shippingObj.additionalInfo ?? shippingObj.note ?? undefined,
    }
  : undefined;

const payload: any = {
  delivery_notice: shippingObj.delivery_notice ?? shippingObj.deliveryNotice ?? (typeof shippingParsed === "string" ? shippingParsed : undefined),
  // shipping_duration: shippingDuration,
  ...(shippingPayload ? shippingPayload : {}),
  promotions:promotionsPayload,
  discounts: discountsPayload,

  // refunds
  return_shipping_subsidy: refundsObj.return_shipping_subsidy ?? refundsObj.returnShippingSubsidy ?? undefined,
  seven_day_no_reason_return: refundsObj.seven_day_no_reason_return ?? refundsObj.sevenDayNoReasonReturn ?? undefined,
  rapid_refund: refundsObj.rapid_refund ?? refundsObj.rapidRefund ?? undefined,
  additional_info: shippingObj.additional_info ?? shippingObj.additionalInfo ?? shippingObj.note ?? undefined,

  // payment
  acct_no: paymentObj.acct_no ?? paymentObj.account_no ?? undefined,
  acct_name: paymentObj.acct_name ?? paymentObj.account_name ?? undefined,
  bank_name: paymentObj.bank_name ?? paymentObj.bankName ?? undefined,
  bank_code: paymentObj.bank_code ?? paymentObj.bankCode ?? undefined,
  cod: paymentObj.cod ?? undefined,
  pod: paymentObj.pod ?? undefined,

  // customer service
  supportAvailable: csObj.supportAvailable ?? undefined,
  cs_reply_time: csObj.cs_reply_time ?? csObj.reply_time ?? undefined,
  cs_good_reviews_summary:
    csObj.cs_good_reviews_summary !== undefined ? Number(csObj.cs_good_reviews_summary) : undefined,
  default_welcome_message: csObj.default_welcome_message ?? undefined,

  // address
  address_line_1: addressObj.address_line_1 ?? addressObj.line1 ?? undefined,
  address_line_2: addressObj.address_line_2 ?? addressObj.line2 ?? undefined,
  city: addressObj.city ?? undefined,
  state: addressObj.state ?? addressObj.region ?? undefined,
  postal_code: addressObj.postal_code ?? undefined,
  country: addressObj.country ?? undefined,

  // market
  from_market: marketObj.from_market ?? undefined,
  note: marketObj.note ?? undefined,
  trusted_partner: marketObj.trusted_partner ?? undefined,
};


    const cleaned = pruneNulls(payload);

    try {
      if (!apiBase) {
        await new Promise((r) => setTimeout(r, 800));
        console.debug("Mock send policy:", cleaned);
      } else {
        const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/business/${encodeURIComponent(String(bizId))}/policy`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(cleaned),
        });

      if (!res.ok) {
  let payload: any = null;
  try {
    payload = await res.json();
  } catch {}
  
  throw new ApiError(
    payload?.message || `Server returned ${res.status}`,
    payload?.code,
    res.status,
    payload
  );
}

      }

      // on success: clear staging cache and dirty markers
      await clearAll(); // removes staged fields and DIRTY marker in profilePrefs.clearAll()
      clearDirty(); // just to be explicit / safe

      // refresh local dirtyKeys state so submit disables
      refreshDirtyKeys();

      // fetch latest authoritative policy and map into state
      const latestPolicy = apiBase ? await fetchLatestPolicyFromApi(bizId) : businessPolicy;
      if (latestPolicy) {
        const mapped = mapPolicyToPrefs(latestPolicy);
        safeSet(setShipping, mapped[KEYS.shipping] ?? "");
        safeSet(setRefunds, mapped[KEYS.refunds] ?? "");
        safeSet(setPayment, mapped[KEYS.payment] ?? "");
        safeSet(setCustomerService, mapped[KEYS.customerService] ?? "");
        safeSet(setAddress, mapped[KEYS.address] ?? "");
        safeSet(setMarket, mapped[KEYS.market] ?? "");
        safeSet(setPromo, mapped[KEYS.promo] ?? "");
        safeSet(setDiscount, mapped[KEYS.discount] ?? "");
        safeSet(setName, mapped[KEYS.name] ?? "");
        safeSet(setRegion, mapped[KEYS.region] ?? "");
      } else {
        // no policy returned - clear these UI fields
        setShipping("");
        setRefunds("");
        setPayment("");
        setCustomerService("");
        setAddress("");
        setMarket("");
        setPromo("");
        setDiscount("");
      }

      toast("Business policy synced successfully");
    } catch (e: any) {
  if (e instanceof ApiError && e.code === "ACCOUNT_ALREADY_EXISTS") {
    // Friendly toast, no scary console.error
    toast.info(e.message); 
    setIsSyncing(false);
    return;
  }

  // Fallback for other errors
  toast.error(e?.message ?? "Failed to sync business profile");
  console.error("saveProfile error:", e);
} finally {
  setIsSyncing(false);
}

  }

  return {
    // state
    name,
    shipping,
    refunds,
    payment,
    customerService,
    address,
    market,
    promo,
    discount,
    region,
    isLoading,
    isSyncing,
    modalOpen,
    modalProps,
    hasAnyFilledField, // true only when there are dirty keys (unsaved edits)

    // actions
    setName,
    setShipping,
    setRefunds,
    setPayment,
    setCustomerService,
    setAddress,
    setMarket,
    setPromo,
    setDiscount,
    setRegion,
    openEditor,
    setModalOpen,
    saveEditorValue,
    saveProfile,
    loadLocalPrefs,
    // expose dirty keys if needed by UI
    dirtyKeys,
  } as const;
}

class ApiError extends Error {
  code?: string;
  status?: number;
  raw?: any;
  constructor(message: string, code?: string, status?: number, raw?: any) {
    super(message);
    this.code = code;
    this.status = status;
    this.raw = raw;
  }
}
