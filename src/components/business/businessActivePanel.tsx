// src/components/EditBusinessProfile.tsx
"use client";
import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
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
import WithdrawModal from "./withdrawModal";
import TransferModal from "./transferModal";
import PinSetupModal from "./pinSetupModal";
import ShopProfileModal from "./policyModal/shopProfileModal";
import { API_BASE_URL } from "@/src/lib/config";
import { useWallet } from "@/src/context/walletContext";
import { toast } from "sonner";
import { InformationCircleIcon, QuestionMarkCircleIcon } from "@heroicons/react/24/outline";

export default function EditBusinessProfile({
  apiBase = "",
  business = null,
  businessPolicy = null,
  wallet = null,
  pendingOrdersCount = 0,
  customerDeliveredCount = 0,
  onRefresh,
  onReplayGuide,
}: {
  apiBase?: string;
  business?: any | null;
  businessPolicy?: any | null;
  wallet?: any | null;
  pendingOrdersCount?: number;
  customerDeliveredCount?: number;
  onRefresh?: () => void;
  onReplayGuide?: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { wallet: localWallet, updateBalance: setLocalWallet, refreshWallet } = useWallet();
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isPinSetupModalOpen, setIsPinSetupModalOpen] = useState(false);

  useEffect(() => {
    setIsWithdrawModalOpen(searchParams.get('withdraw') === 'true');
  }, [searchParams]);



  const handleOpenWithdraw = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('withdraw', 'true');
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const handleCloseWithdraw = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('withdraw');
    router.push(`?${params.toString()}`, { scroll: false });
  };
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
    shopProfile,
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
  } = useEditBusinessProfile({ apiBase, business, businessPolicy, onRefresh });

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

  // ── Policy-set detection ────────────────────────────────────────────
  // Maps each KEYS.xxx to its live state value so we can inspect whether
  // the server already has meaningful data for it.
  const policyValueMap: Record<string, string> = {
    [KEYS.shopProfile]: shopProfile,
    [KEYS.shipping]: shipping,
    [KEYS.refunds]: refunds,
    [KEYS.payment]: payment,
    [KEYS.customerService]: customerService,
    [KEYS.address]: address,
    [KEYS.market]: market,
    [KEYS.promo]: promo,
    [KEYS.discount]: discount,
  };

  /**
   * Returns true when the server-loaded value for a key indicates that the
   * vendor has already configured that policy section.
   * Each key has slightly different semantics so we inspect the parsed JSON.
   */
  const isPolicySet = (key: string): boolean => {
    const raw = policyValueMap[key] ?? "";
    if (!raw || raw === "null" || raw === "undefined" || raw === "\"\"" || raw.trim() === "") return false;
    try {
      const parsed = JSON.parse(raw);
      // Arrays (promo, discount, shipping durations)
      if (Array.isArray(parsed)) return parsed.length > 0;
      if (parsed && typeof parsed === "object") {
        switch (key) {
          case KEYS.shipping:
            // consider set if there is at least one shipping duration OR a delivery notice
            return (
              (Array.isArray(parsed.shipping_duration) && parsed.shipping_duration.length > 0) ||
              Boolean(parsed.delivery_notice)
            );
          case KEYS.refunds:
            // consider set if any flag is true OR additional_info is present
            return (
              parsed.return_shipping_subsidy === true ||
              parsed.seven_day_no_reason_return === true ||
              parsed.rapid_refund === true ||
              parsed.late_shipment_compensation === true ||
              parsed.fake_one_pay_four === true ||
              Boolean(parsed.additional_info)
            );
          case KEYS.payment:
            // consider set if account number is present
            return Boolean(parsed.acct_no);
          case KEYS.customerService:
            return Boolean(parsed.cs_reply_time) || Boolean(parsed.default_welcome_message);
          case KEYS.address:
            return Boolean(parsed.address_line_1) || Boolean(parsed.city);
          case KEYS.market:
            return Boolean(parsed.from_market);
          case KEYS.shopProfile:
            return Boolean(parsed.business_name) || Boolean(parsed.bio);
          default:
            // For unknown keys: object is set if it has any own-value keys
            return Object.values(parsed).some((v) => v !== null && v !== undefined && v !== "");
        }
      }
      // primitive non-empty string
      return String(parsed).trim().length > 0;
    } catch {
      return raw.trim().length > 0;
    }
  };

  /**
   * renderStatus:
   * - "Saved ✓"   emerald  → user just saved this key in the current session
   * - "Update"    green    → key is already configured on the server
   * - "Not set"   amber    → key has never been saved to the server
   */
  const renderStatus = (key: string) => {
    const justSaved = Array.isArray(dirtyKeys) && dirtyKeys.includes(key);
    if (justSaved) {
      return (
        <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-xs">
          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Saved
        </span>
      );
    }
    if (isPolicySet(key)) {
      return (
        <span className="inline-flex items-center gap-1 text-green-600 font-semibold text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
          Update
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-amber-500 font-semibold text-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
        Not set
      </span>
    );
  };


  const formatAddress = (addrJson?: string | null) => {
    if (!addrJson) return "No address provided";
    try {
      const parsed = typeof addrJson === 'string' ? JSON.parse(addrJson) : addrJson;
      const line1 = parsed.address_line_1 || parsed.line1 || "";
      const city = parsed.city || "";
      const state = parsed.state || "";
      return [line1, city, state].filter(Boolean).join(", ");
    } catch {
      return addrJson;
    }
  };

  const setupCompletionRate = Object.keys(policyValueMap).filter(isPolicySet).length / Object.keys(policyValueMap).length;
  const isSetupIncomplete = !isPolicySet(KEYS.shipping) || !isPolicySet(KEYS.refunds) || !isPolicySet(KEYS.payment);

  return (
    <div className="pb-1 bg-slate-100 p-4">
      <div className="max-w-7xl mx-auto px-1 pt-2 space-y-4">
        {/* Help / Guide Access (Desktop Subtle) */}
        <div className="hidden lg:flex justify-end pr-2">
          <button
            onClick={onReplayGuide}
            className="flex items-center gap-2 text-[10px] text-slate-400 hover:text-rose-500 transition-colors"
          >
            <QuestionMarkCircleIcon className="w-4 h-4" /> Replay Onboarding Guide
          </button>
        </div>

        {/* Suggestion Banner */}
        {isSetupIncomplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border-2 border-rose-100 rounded-[0.5rem] p-2 shadow-xl shadow-rose-100/20 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 bg-rose-500/5 blur-3xl rounded-full" />
            <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                {/* <h4 className="text-sm font-black text-slate-900 mb-1">Finish your business setup</h4> */}
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  Your profile is missing key trust factors. Shops with complete delivery and refund policies earn up to <span className="text-rose-500 font-bold">4.5x more revenue</span>.
                </p>
              </div>
              <button
                onClick={onReplayGuide}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 text-white rounded-full text-[11px] font-black shadow-lg shadow-slate-100 hover:bg-rose-600 transition-all active:scale-95"
              >
                Guide Me
              </button>
            </div>
          </motion.div>
        )}
        {/* Header */}
        <div className="flex flex-col items-center">
          <div
            className="rounded-full bg-white p-2 shadow flex items-center justify-center cursor-pointer hover:scale-105 transition-transform active:scale-95"
            onClick={() => openEditor("Shop Profile", KEYS.shopProfile, shopProfile)}
            title="Edit Shop Profile"
          >
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
          <div className="mt-2 text-center">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {/* <div className="font-semibold text-slate-900 text-lg truncate">{displayName}</div> */}
              <div className="text-xs font-semibold px-2 py-1 rounded-full capitalize bg-emerald-50 text-emerald-700">
                {business?.business_status}
              </div>
            </div>

            <div className="mt-4 flex flex-col items-center">
            </div>
          </div>
        </div>

        {/* Actionable Orders Marquee */}
        {(pendingOrdersCount > 0 || customerDeliveredCount > 0) && (
          <div
            className={`w-full border-y py-1 overflow-hidden group cursor-pointer ${pendingOrdersCount > 0 ? "bg-orange-50 border-orange-100" : "bg-blue-50 border-blue-100"
              }`}
            onClick={() => {
              if (pendingOrdersCount > 0) {
                router.push("/profile/business/customer-order");
              } else {
                router.push("/profile/orders");
              }
            }}
          >
            <div className="flex animate-marquee whitespace-nowrap">
              <div className="flex items-center gap-12 px-4">
                {pendingOrdersCount > 0 ? (
                  <>
                    <span className="text-[10px] text-orange-700 font-bold  tracking-wider flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                      ⚠️ You have ({pendingOrdersCount}) new {pendingOrdersCount === 1 ? 'order' : 'orders'} waiting to be shipped! Please process them as soon as possible. Click here to view.
                    </span>
                    <span className="text-[10px] text-orange-700 font-bold  tracking-wider flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                      ⚠️ You have ({pendingOrdersCount}) new {pendingOrdersCount === 1 ? 'order' : 'orders'} waiting to be shipped! Please process them as soon as possible. Click here to view.
                    </span>
                    <span className="text-[10px] text-orange-700 font-bold  tracking-wider flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                      ⚠️ You have ({pendingOrdersCount}) new {pendingOrdersCount === 1 ? 'order' : 'orders'} waiting to be shipped! Please process them as soon as possible. Click here to view.
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[10px] text-blue-700 font-bold  tracking-wider flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      📦 You have ({customerDeliveredCount}) {customerDeliveredCount === 1 ? 'order' : 'orders'} delivered! Please click here to confirm receipt and release payment to vendor.
                    </span>
                    <span className="text-[10px] text-blue-700 font-bold  tracking-wider flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      📦 You have ({customerDeliveredCount}) {customerDeliveredCount === 1 ? 'order' : 'orders'} delivered! Please click here to confirm receipt and release payment to vendor.
                    </span>
                    <span className="text-[10px] text-blue-700 font-bold  tracking-wider flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      📦 You have ({customerDeliveredCount}) {customerDeliveredCount === 1 ? 'order' : 'orders'} delivered! Please click here to confirm receipt and release payment to vendor.
                    </span>
                  </>
                )}
              </div>
            </div>

            <style jsx>{`
              @keyframes marquee {
                0% { transform: translateX(0); }
                100% { transform: translateX(-33.33%); }
              }
              .animate-marquee {
                display: flex;
                animation: marquee 30s linear infinite;
              }
              .group:hover .animate-marquee {
                animation-play-state: paused;
              }
            `}</style>
          </div>
        )}

        {/* Action grid */}
        <div id="guide-wallet-actions" className="mt-2 w-full">
          <div className="grid grid-cols-4 gap-2 lg:gap-5">
            <Link href="/profile/business/customer-order" className="block">
              <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white hover:shadow transition">
                <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center">
                  <FaShoppingCart className="text-slate-700" size={18} />
                </div>
                <span className="text-xs font-medium text-slate-700">Orders</span>
              </div>
            </Link>

            <div
              onClick={() => {
                if (!isPolicySet(KEYS.shipping)) {
                  toast.error("Please update your Shipping Info before accessing Inventory.");
                  openEditor("Shipping Info", KEYS.shipping, normalizeShippingForModal(shipping));
                  return;
                }
                router.push("/profile/business/inventory");
              }}
              className="block cursor-pointer"
            >
              <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white hover:shadow transition">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <FaBox className="text-slate-700" size={18} />
                </div>
                <span className="text-xs font-medium text-slate-700">Inventory</span>
              </div>
            </div>

            <div
              className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white hover:shadow transition cursor-pointer"
              onClick={() => {
                if (!localWallet?.has_pin) {
                  setIsPinSetupModalOpen(true);
                } else {
                  setIsTransferModalOpen(true);
                }
              }}
            >
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <FaWallet className="text-slate-700" size={18} />
              </div>
              <span className="text-xs font-medium text-slate-700">Transfer</span>
            </div>

            <div
              className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white hover:shadow transition cursor-pointer"
              onClick={() => {
                if (!localWallet?.has_pin) {
                  setIsPinSetupModalOpen(true);
                } else {
                  handleOpenWithdraw();
                }
              }}
            >
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <FaArrowDown className="text-slate-700" size={18} />
              </div>
              <span className="text-xs font-medium text-slate-700">Withdraw</span>
            </div>
          </div>
        </div>

        {/* Editable cards */}
        <div className="mt-6 space-y-4">
          <div className="bg-white rounded-xl ">
            <div onClick={() => openEditor("Shop Profile", KEYS.shopProfile, shopProfile)} className="px-4 py-3 cursor-pointer flex items-center">
              <div className="flex-1">
                <div className="text-sm text-slate-800 font-medium">Shop Profile</div>
                <div className="text-sm mt-1">{renderStatus(KEYS.shopProfile)}</div>
              </div>
              <FaChevronRight className="text-slate-300" />
            </div>
          </div>

          <div id="guide-shipping" className="bg-white rounded-xl ">
            <div onClick={() => openEditor("Shipping Info", KEYS.shipping, normalizeShippingForModal(shipping))} className="px-4 py-3 cursor-pointer flex items-center">
              <div className="flex-1">
                <div className="text-sm text-slate-800 font-medium">Shipping info</div>
                <div className="text-sm mt-1">{renderStatus(KEYS.shipping)}</div>
              </div>
              <FaChevronRight className="text-slate-300" />
            </div>
            <div className="h-px bg-slate-100" />
            <div id="guide-refunds" onClick={() => openEditor("Return & Refunds", KEYS.refunds, refunds)} className="px-4 py-3 cursor-pointer flex items-center">
              <div className="flex-1">
                <div className="text-sm text-slate-800 font-medium">Return & Refunds</div>
                <div className="text-sm mt-1">{renderStatus(KEYS.refunds)}</div>
              </div>
              <FaChevronRight className="text-slate-300" />
            </div>
          </div>

          <div className="bg-white rounded-xl ">
            <div id="guide-payment" onClick={() => openEditor("Payment Info", KEYS.payment, payment)} className="px-4 py-3 cursor-pointer flex items-center">
              <div className="flex-1">
                <div className="text-sm text-slate-800 font-medium">Payment Info</div>
                <div className="text-sm mt-1">{renderStatus(KEYS.payment,)}</div>
              </div>
              <FaChevronRight className="text-slate-300" />
            </div>
            <div className="h-px bg-slate-100" />
            <div id="guide-customer-service" onClick={() => openEditor("Customer Service", KEYS.customerService, customerService)} className="px-4 py-3 cursor-pointer flex items-center">
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

          <div id="guide-market" className="bg-white rounded-xl ">
            <div onClick={() => openEditor("Market Affiliation", KEYS.market, market)} className="px-4 py-3 cursor-pointer flex items-center">
              <div className="flex-1">
                <div className="text-sm text-slate-800 font-medium">Market Affiliation</div>
                <div className="text-sm mt-1">{renderStatus(KEYS.market)}</div>
              </div>
              <FaChevronRight className="text-slate-300" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm">
            <div id="guide-promo" onClick={() => openEditor("Promotional Sale", KEYS.promo, promo)} className="px-4 py-3 cursor-pointer flex items-center">
              <div className="flex-1">
                <div className="text-sm text-slate-800 font-medium">Promotional Sale</div>
                <div className="text-sm mt-1">{renderStatus(KEYS.promo)}</div>
              </div>
              <FaChevronRight className="text-slate-300" />
            </div>
            <div className="h-px bg-slate-100" />
            <div id="guide-discount" onClick={() => openEditor("Sales Discount", KEYS.discount, discount)} className="px-4 py-3 cursor-pointer flex items-center">
              <div className="flex-1">
                <div className="text-sm text-slate-800 font-medium">Sales Discount</div>
                <div className="text-sm mt-1">{renderStatus(KEYS.discount)}</div>
              </div>
              <FaChevronRight className="text-slate-300" />
            </div>
          </div>
        </div>

        {isSyncing && (
          <div className="pb-10 mb-10 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-100 shadow-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Background Syncing...
            </div>
          </div>
        )}
      </div>

      {
        isLoading && (
          <div className="fixed inset-0 z-40 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30" />
            <div className="relative bg-white rounded-xl p-6 shadow">
              <div className="animate-spin h-8 w-8 border-4 border-rose-400 border-t-transparent rounded-full" />
              <div className="mt-3 text-sm text-slate-700">Loading…</div>
            </div>
          </div>
        )
      }

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
        businessId={business?.business_id}
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

      <WithdrawModal
        isOpen={isWithdrawModalOpen}
        onClose={handleCloseWithdraw}
        activePaymentJson={payment}
        isPaymentDirty={dirtyKeys.includes(KEYS.payment)}
        onEditAccount={() => {
          handleCloseWithdraw();
          openEditor("Payment Info", KEYS.payment, payment);
        }}
        availableBalance={Number(localWallet?.available_balance || 0)}
        onBalanceUpdate={(newBal) => setLocalWallet(newBal)}
        role="vendor"
      />

      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        availableBalance={Number(localWallet?.available_balance || 0)}
        onBalanceUpdate={(newBal) => setLocalWallet(newBal)}
      />

      <PinSetupModal
        isOpen={isPinSetupModalOpen}
        onClose={() => setIsPinSetupModalOpen(false)}
        onSuccess={() => {
          refreshWallet();
          setIsTransferModalOpen(true);
        }}
      />

      <ShopProfileModal
        open={modalOpen && modalProps?.key === KEYS.shopProfile}
        initialValue={modalProps?.value ?? shopProfile}
        onClose={() => setModalOpen(false)}
        onSave={async (formData) => {
          // If it's a FormData (has files), hit the API immediately
          // because we can't stage files in localStorage easily.
          const token = localStorage.getItem("token");
          const bizId = business?.business_id;

          if (!bizId || !token) {
            console.error("Missing business_id or token");
            return;
          }

          try {
            const res = await fetch(`${API_BASE_URL}/api/business/${bizId}`, {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${token}`,
              },
              body: formData,
            });

            if (!res.ok) {
              const err = await res.json();
              throw new Error(err.message || "Failed to update profile");
            }

            // After success, clear staged text for fields we just committed
            const textData: Record<string, any> = {};
            formData.forEach((value, key) => {
              if (!(value instanceof File)) {
                textData[key] = value;
              }
            });

            await saveEditorValue(KEYS.shopProfile, JSON.stringify(textData));
            toast.success("Shop profile updated successfully!");
            if (onRefresh) onRefresh();
          } catch (e: any) {
            console.error("Upload failed", e);
            toast.error(e.message || "Failed to upload profile");
          }
        }}
      />
    </div >
  );
}
