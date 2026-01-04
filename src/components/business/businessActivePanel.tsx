// src/components/EditBusinessProfile.tsx
"use client";
import { FaCat, FaChevronRight, FaStore, FaBox, FaShoppingCart, FaWallet, FaArrowDown } from "react-icons/fa";
import { KEYS } from "@/src/lib/utils/business/profilePrefs";
import RefundsModal from "./policyModal/refundsModal";
import PaymentInfoModal from "./policyModal/paymentInfoModal";
import MarketModal from "./policyModal/marketModal";
import ShippingInfoModal from "./policyModal/shippingInfo";
import PromotionsModal from "./policyModal/promotionsModal";
import CustomerServiceModal from "./policyModal/customerServiceModal";
import BusinessAddressModal from "./policyModal/businessAddressModal";
import { SaleDiscountModal } from "./policyModal/saleDiscountModal";
import { useEditBusinessProfile } from "@/src/hooks/userEditBusinessProfile";

export default function EditBusinessProfile({
  apiBase = "",
  business = null,
  businessPolicy = null,
}: {
  apiBase?: string;
  business?: any | null;
  businessPolicy?: any | null;
}) {
  const {
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
    isLoading,
    isSyncing,
    modalOpen,
    modalProps,
    hasAnyFilledField,
    // actions
    openEditor,
    setModalOpen,
    saveEditorValue,
    saveProfile,
    // dirty keys
    dirtyKeys,
  } = useEditBusinessProfile({ apiBase, business, businessPolicy });

  const displayName = business?.business_name ?? name ?? "Business name";

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="text-center">
          <div className="h-12 w-12 rounded-full bg-white shadow flex items-center justify-center mb-3">
            <FaCat className="text-2xl text-orange-400" />
          </div>
          <div className="text-sm text-slate-500">Loading…</div>
        </div>
      </div>
    );
  }
  type ShippingDurationItem = {
  type: string;
  value: number;
  unit: string;
};

function normalizeShippingForModal(shippingJson: string) {
  try {
    const parsed = JSON.parse(shippingJson);

    // Handle object-based payload (correct format)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const durations = Array.isArray(parsed.shipping_duration)
        ? parsed.shipping_duration
        : [];

      const normalized = durations.map((item: ShippingDurationItem) => {
        let val = item.value;
        let unit = item.unit;

        if (unit === "hours" && val >= 24 && val < 24 * 7) {
          unit = "days";
          val = Math.ceil(val / 24);
        } else if (unit === "hours" && val >= 24 * 7) {
          unit = "weeks";
          val = Math.ceil(val / (24 * 7));
        }

        return { ...item, value: val, unit };
      });

      return JSON.stringify({
        delivery_notice: typeof parsed.delivery_notice === "string" ? parsed.delivery_notice : "",
        shipping_duration: normalized,
        additional_info: parsed.additional_info ?? "",
      });
    }

    // Legacy array-only format
    if (Array.isArray(parsed)) {
      return JSON.stringify({
        delivery_notice: "",
        shipping_duration: parsed,
        additional_info: "",
      });
    }
  } catch {
    // fall through
  }

  return shippingJson ?? "";
}

  // helper to decide whether to show the "Updated" badge for a given key
// helper to decide whether to show the "Updated" badge for a given key
const showUpdated = (key: string) => {
  return Array.isArray(dirtyKeys) && dirtyKeys.includes(key);
};


const renderStatus = (key: string) => {
  return showUpdated(key) ? (
    <span className="text-emerald-600 font-medium">Updated</span>
  ) : (
    <span className="text-slate-400">Edit</span>
  );
};


  return (
    <div className="pb-1 bg-slate-100 p-4">
      <div className="max-w-7xl mx-auto px-1 pt-2 space-y-4">
        {/* Header */}
        <div className="flex flex-col items-center">
          <div className="rounded-full bg-white p-2 shadow flex items-center justify-center">
            {business?.profile_pic ? (
              <img
                src={business.logo ?? business.profile_pic}
                alt={`${displayName} logo`}
                className="h-30 w-30 rounded-full object-cover border border-slate-200"
              />
            ) : (
              <div className="w-16 h-16 rounded-md flex items-center justify-center bg-slate-100 border">
                <FaStore size={18} className="text-slate-500" />
              </div>
            )}
          </div>
          <div className="mt-3 text-center">
            <div className="font-semibold text-slate-900 text-lg truncate">{displayName}</div>
            <div className="text-slate-700 text-sm flex flex-col sm:flex-row sm:justify-center sm:gap-1 break-words mt-1">
              <span className="whitespace-normal">{business?.phone ?? business?.business_email}</span>
              <span className="hidden sm:inline">,</span>
              <span className="whitespace-normal">{business?.business_address}</span>
            </div>
            <div className="inline-block mt-2 text-sm font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full capitalize">
              {business?.business_status}
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-900">NGN 2,002,830.00</div>
          </div>
        </div>

        {/* Action grid */}
        <div className="mt-6 w-full">
          <div className="grid grid-cols-4 gap-2 lg:gap-5">
            <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white hover:shadow transition">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <FaShoppingCart className="text-slate-700" size={18} />
              </div>
              <span className="text-xs font-medium text-slate-700">Orders</span>
            </div>

            <a href="/products/new" className="block">
              <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white hover:shadow transition">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <FaBox className="text-slate-700" size={18} />
                </div>
                <span className="text-xs font-medium text-slate-700">Products</span>
              </div>
            </a>

            <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white hover:shadow transition">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <FaWallet className="text-slate-700" size={18} />
              </div>
              <span className="text-xs font-medium text-slate-700">Transfer</span>
            </div>

            <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white hover:shadow transition">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <FaArrowDown className="text-slate-700" size={18} />
              </div>
              <span className="text-xs font-medium text-slate-700">Withdraw</span>
            </div>
          </div>
        </div>

        {/* Editable cards */}
        <div className="mt-6 space-y-4">
          <div className="bg-white rounded-xl shadow-sm">
            <div onClick={() => openEditor("Shipping Info", KEYS.shipping, normalizeShippingForModal(shipping))} className="px-4 py-3 cursor-pointer flex items-center">
              <div className="flex-1">
                <div className="text-sm text-slate-800 font-medium">Shipping info</div>
                <div className="text-sm mt-1">{renderStatus(KEYS.shipping)}</div>
              </div>
              <FaChevronRight className="text-slate-300" />
            </div>
            <div className="h-px bg-slate-100" />
            <div onClick={() => openEditor("Return & Refunds", KEYS.refunds, refunds)} className="px-4 py-3 cursor-pointer flex items-center">
              <div className="flex-1">
                <div className="text-sm text-slate-800 font-medium">Return & Refunds</div>
                <div className="text-sm mt-1">{renderStatus(KEYS.refunds)}</div>
              </div>
              <FaChevronRight className="text-slate-300" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm">
            <div onClick={() => openEditor("Payment Info", KEYS.payment, payment)} className="px-4 py-3 cursor-pointer flex items-center">
              <div className="flex-1">
                <div className="text-sm text-slate-800 font-medium">Payment Info</div>
                <div className="text-sm mt-1">{renderStatus(KEYS.payment,)}</div>
              </div>
              <FaChevronRight className="text-slate-300" />
            </div>
            <div className="h-px bg-slate-100" />
            <div onClick={() => openEditor("Customer Service", KEYS.customerService, customerService)} className="px-4 py-3 cursor-pointer flex items-center">
              <div className="flex-1">
                <div className="text-sm text-slate-800 font-medium">Customer Service</div>
                <div className="text-sm mt-1">{renderStatus(KEYS.customerService)}</div>
              </div>
              <FaChevronRight className="text-slate-300" />
            </div>
            <div className="h-px bg-slate-100" />
            <div onClick={() => openEditor("Address Info", KEYS.address, address)} className="px-4 py-3 cursor-pointer flex items-center">
              <div className="flex-1">
                <div className="text-sm text-slate-800 font-medium">Address Info</div>
                <div className="text-sm mt-1">{renderStatus(KEYS.address)}</div>
              </div>
              <FaChevronRight className="text-slate-300" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm">
            <div onClick={() => openEditor("Market Affiliation", KEYS.market, market)} className="px-4 py-3 cursor-pointer flex items-center">
              <div className="flex-1">
                <div className="text-sm text-slate-800 font-medium">Market Affiliation</div>
                <div className="text-sm mt-1">{renderStatus(KEYS.market)}</div>
              </div>
              <FaChevronRight className="text-slate-300" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm">
            <div onClick={() => openEditor("Promotional Sale", KEYS.promo, promo)} className="px-4 py-3 cursor-pointer flex items-center">
              <div className="flex-1">
                <div className="text-sm text-slate-800 font-medium">Promotional Sale</div>
                <div className="text-sm mt-1">{renderStatus(KEYS.promo)}</div>
              </div>
              <FaChevronRight className="text-slate-300" />
            </div>
            <div className="h-px bg-slate-100" />
            <div onClick={() => openEditor("Sales Discount", KEYS.discount, discount)} className="px-4 py-3 cursor-pointer flex items-center">
              <div className="flex-1">
                <div className="text-sm text-slate-800 font-medium">Sales Discount</div>
                <div className="text-sm mt-1">{renderStatus(KEYS.discount)}</div>
              </div>
              <FaChevronRight className="text-slate-300" />
            </div>
          </div>
        </div>

        <div className="pb-10 mb-10">
          <button
            className={`w-full px-4 py-3 rounded-full font-semibold transition ${!hasAnyFilledField || isSyncing ? "bg-slate-300 text-slate-500 cursor-not-allowed" : "bg-rose-500 text-white hover:bg-rose-600"}`}
            onClick={async () => { await saveProfile(); }}
            disabled={!hasAnyFilledField || isSyncing}
          >
            {isSyncing ? "Syncing..." : "Submit"}
          </button>
        </div>
      </div>

      {(isLoading || isSyncing) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-xl p-6 shadow">
            <div className="animate-spin h-8 w-8 border-4 border-rose-400 border-t-transparent rounded-full" />
            <div className="mt-3 text-sm text-slate-700">{isSyncing ? "Syncing…" : "Loading…"}</div>
          </div>
        </div>
      )}

      {/* Per-section modals (wired into hook's modal state) */}
      <ShippingInfoModal
        open={modalOpen && modalProps?.key === KEYS.shipping}
        prefKey={KEYS.shipping}
        initialValue={modalProps?.value ?? ""}
        onClose={() => { setModalOpen(false); }}
        onSave={async (payloadJson) => { await saveEditorValue(KEYS.shipping, payloadJson); }}
      />
      <RefundsModal
        open={modalOpen && modalProps?.key === KEYS.refunds}
        prefKey={KEYS.refunds}
        initialValue={modalProps?.value ?? ""}
        onClose={() => { setModalOpen(false); }}
        onSave={async (payloadJson) => { await saveEditorValue(KEYS.refunds, payloadJson); }}
      />
      <PaymentInfoModal
        open={modalOpen && modalProps?.key === KEYS.payment}
        prefKey={KEYS.payment}
        initialValue={modalProps?.value ?? ""}
        onClose={() => { setModalOpen(false); }}
        onSave={async (payloadJson) => { await saveEditorValue(KEYS.payment, payloadJson); }}
      />
      <MarketModal
        open={modalOpen && modalProps?.key === KEYS.market}
        prefKey={KEYS.market}
        initialValue={modalProps?.value ?? ""}
        onClose={() => { setModalOpen(false); }}
        onSave={async (payloadJson) => { await saveEditorValue(KEYS.market, payloadJson); }}
      />
      <PromotionsModal
        open={modalOpen && modalProps?.key === KEYS.promo}
        prefKey={KEYS.promo}
        // initialValue={modalProps?.value ?? ""}
         initialValue={modalProps?.value ?? localStorage.getItem(KEYS.promo) ?? null}
        onClose={() => { setModalOpen(false); }}
        onSave={async (payloadJson) => { await saveEditorValue(KEYS.promo, payloadJson); }}
      />
      <CustomerServiceModal
        open={modalOpen && modalProps?.key === KEYS.customerService}
        prefKey={KEYS.customerService}
        initialValue={modalProps?.value ?? ""}
         businessName={displayName} 
        onClose={() => { setModalOpen(false); }}
        onSave={async (payloadJson) => { await saveEditorValue(KEYS.customerService, payloadJson); }}
      />
      <BusinessAddressModal
        open={modalOpen && modalProps?.key === KEYS.address}
        prefKey={KEYS.address}
        initialValue={modalProps?.value ?? ""}
        onClose={() => { setModalOpen(false); }}
        onSave={async (payloadJson) => { await saveEditorValue(KEYS.address, payloadJson); }}
      />
      <SaleDiscountModal
        open={modalOpen && modalProps?.key === KEYS.discount}
        prefKey={KEYS.discount}
        // initialValue={modalProps?.value ?? null}
        // initialValue={discount || null}
          initialValue={modalProps?.value ?? localStorage.getItem(KEYS.discount) ?? null}

        onClose={() => { setModalOpen(false); }}
        onSave={async (discountJson: string) => { await saveEditorValue(KEYS.discount, discountJson); }}
      />
    </div>
  );
}
