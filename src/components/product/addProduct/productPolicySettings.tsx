"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Tag, ShieldCheck, Truck, Percent, ChevronRight, X, Clock, MapPin, CheckCircle2, Info, ArrowRight } from "lucide-react";
import { generateDefaultOccasions, getAvailableOccasionsFrom, Occasion } from "../../business/policyModal/promotionsModal";
import ReturnShippingSubsidyModal from "../../business/policyModal/returnShippingSubsidyModal";
import SevenDayReturnModal from "../../business/policyModal/sevenDayReturnModal";
import RapidRefundModal from "../../business/policyModal/rapidRefundModal";
import NumberInput from "@/src/components/input/defaultNumberInput";
import DefaultSelect from "@/src/components/input/default-select";
import { toast } from "sonner";

type ProductPolicyProps = {
  // Return policy
  useStoreDefaultReturn: boolean;
  setUseStoreDefaultReturn: (v: boolean) => void;
  returnPolicy: {
    returnShippingSubsidy: boolean;
    sevenDayNoReasonReturn: boolean;
    rapidRefund: boolean;
    lateShipmentCompensation: boolean;
    fakeOnePayFour: boolean;
    returnWindow: number;
  };
  setReturnPolicy: (v: any) => void;

  // Shipping policy
  useStoreDefaultShipping: boolean;
  setUseStoreDefaultShipping: (v: boolean) => void;
  shippingPolicy: {
    avgDuration: number;
    avgUnit: string;
    promiseDuration: number;
    promiseUnit: string;
    radiusKm: number;
  };
  setShippingPolicy: (v: any) => void;

  // Promotions & Discounts
  useStoreDefaultPromotions: boolean;
  setUseStoreDefaultPromotions: (v: boolean) => void;
  promotions: any[];
  setPromotions: (v: any[]) => void;
  saleDiscount: any;
  setSaleDiscount: (v: any) => void;
};

const UNITS = ["hours", "days", "weeks"];

const DISCOUNT_OPTIONS = [
  "Black Friday",
  "New customer",
  "Cyber Monday",
  "Back to School",
  "Holiday Sale",
  "Clearance",
  "Flash Sale",
  "Loyalty Reward",
  "Birthday Discount",
  "Referral Bonus",
  "Seasonal Offer",
];

export default function ProductPolicySettings({
  useStoreDefaultReturn,
  setUseStoreDefaultReturn,
  returnPolicy,
  setReturnPolicy,
  useStoreDefaultShipping,
  setUseStoreDefaultShipping,
  shippingPolicy,
  setShippingPolicy,
  useStoreDefaultPromotions,
  setUseStoreDefaultPromotions,
  promotions,
  setPromotions,
  saleDiscount,
  setSaleDiscount,
}: ProductPolicyProps) {
  const [tempPromo, setTempPromo] = useState<any>(promotions.length > 0 ? promotions[0] : null);

  const [showSubsidyInfo, setShowSubsidyInfo] = useState(false);
  const [showSevenDayInfo, setShowSevenDayInfo] = useState(false);
  const [showRapidRefundInfo, setShowRapidRefundInfo] = useState(false);

  useEffect(() => {
    if (promotions.length > 0) {
      setTempPromo(promotions[0]);
    }
  }, [promotions]);

  const availableCampaigns = useMemo(() => {
    const all = generateDefaultOccasions(true);
    return getAvailableOccasionsFrom(all);
  }, []);

  const selectCampaignForReview = (camp: Occasion) => {
    setTempPromo({
      occasion: camp.name,
      discount: 10,
      isActive: true,
      start: camp.windowStart,
      end: camp.windowEnd
    });
  };

  const finalizeJoin = () => {
    if (tempPromo) {
      setPromotions([tempPromo]);
    }
  };

  const leaveCampaign = () => {
    setPromotions([]);
    setTempPromo(null);
  };

  const updateReturnPolicy = (field: string, value: any) => {
    setReturnPolicy({ ...returnPolicy, [field]: value });
  };

  const getInHours = (val: number, unit: string) => {
    if (unit === "weeks") return val * 168;
    if (unit === "days") return val * 24;
    return val;
  };

  const updateShippingPolicy = (field: string, value: any) => {
    let nextPolicy = { ...shippingPolicy, [field]: value };

    // Validation: avgDuration should not be more than promiseDuration
    const avgHrs = getInHours(nextPolicy.avgDuration, nextPolicy.avgUnit);
    const promiseHrs = getInHours(nextPolicy.promiseDuration, nextPolicy.promiseUnit);

    if (avgHrs > promiseHrs) {
      if (field === "avgDuration" || field === "avgUnit") {
        // If user increased avg, we increase promise to match
        if (nextPolicy.promiseUnit === "weeks") nextPolicy.promiseDuration = Math.ceil(avgHrs / 168);
        else if (nextPolicy.promiseUnit === "days") nextPolicy.promiseDuration = Math.ceil(avgHrs / 24);
        else nextPolicy.promiseDuration = avgHrs;

        toast.info(`Promise Delivery updated to ensure it's not less than Avg. Ship Duration.`);
      } else if (field === "promiseDuration" || field === "promiseUnit") {
        // If user decreased promise, we decrease avg to match
        if (nextPolicy.avgUnit === "weeks") nextPolicy.avgDuration = Math.floor(promiseHrs / 168);
        else if (nextPolicy.avgUnit === "days") nextPolicy.avgDuration = Math.floor(promiseHrs / 24);
        else nextPolicy.avgDuration = promiseHrs;

        toast.info(`Avg. Ship Duration capped to match the new Promise Delivery duration.`);
      }
    }

    setShippingPolicy(nextPolicy);
  };

  return (
    <div className="space-y-6">
      {/* 1. Return & Refund Policy */}
      <div className="bg-white rounded p-4 border border-slate-100 ">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-[14px] font-bold text-slate-900">Return & Refund Policy</h3>
          <div className="flex bg-slate-100 p-0.5 rounded-full border border-slate-200 self-start sm:self-auto">
            <button
              onClick={() => setUseStoreDefaultReturn(true)}
              className={`px-4 py-1.5 rounded-full text-xs transition-all ${useStoreDefaultReturn ? "bg-white shadow-sm text-rose-600" : "text-slate-500"
                }`}
            >
              Use Store Default
            </button>
            <button
              onClick={() => setUseStoreDefaultReturn(false)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${!useStoreDefaultReturn ? "bg-white shadow-sm text-rose-600" : "text-slate-500"
                }`}
            >
              Customize
            </button>
          </div>
        </div>

        {!useStoreDefaultReturn && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="space-y-4 pt-2"
          >
            <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 mb-2">
              <p className="text-xs text-blue-700 font-medium">✨ Products with flexible return policies sell faster</p>
            </div>

            {/* Toggles */}
            <div className="space-y-3">
              <PolicyToggle
                label="Return shipping subsidy"
                sub="Vendor covers return logistics costs"
                checked={returnPolicy.returnShippingSubsidy}
                onChange={(v) => updateReturnPolicy('returnShippingSubsidy', v)}
                onInfoClick={() => setShowSubsidyInfo(true)}
              />
              <PolicyToggle
                label="7-day no reason return"
                sub="Flexible returns within 7 days"
                checked={returnPolicy.sevenDayNoReasonReturn}
                onChange={(v) => updateReturnPolicy('sevenDayNoReasonReturn', v)}
                onInfoClick={() => setShowSevenDayInfo(true)}
              />

              {!returnPolicy.sevenDayNoReasonReturn && (
                <div className="pl-11 pr-4 py-2">
                  <DefaultSelect
                    title="Problem reporting window"
                    triggerLabel="Issue Reporting Period"
                    options={["1 day", "2 days", "3 days"]}
                    value={returnPolicy.returnWindow === 1 ? "1 day" : `${returnPolicy.returnWindow} days`}
                    onSelected={(val) => {
                      const days = parseInt(val.split(" ")[0]);
                      updateReturnPolicy("returnWindow", days);
                    }}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Select the number of days buyers have to report product issues.</p>
                </div>
              )}

              <PolicyToggle
                label="Rapid refund"
                sub="Instant refund for eligible returns"
                checked={returnPolicy.rapidRefund}
                onChange={(v) => updateReturnPolicy('rapidRefund', v)}
                onInfoClick={() => setShowRapidRefundInfo(true)}
              />
              <PolicyToggle
                label="Late shipment compensation"
                sub="Coupon or refund if shipment is delayed"
                checked={returnPolicy.lateShipmentCompensation}
                onChange={(v) => updateReturnPolicy('lateShipmentCompensation', v)}
              />
              <PolicyToggle
                label="Fake one pay four"
                sub="4x compensation for counterfeit items"
                checked={returnPolicy.fakeOnePayFour}
                onChange={(v) => updateReturnPolicy('fakeOnePayFour', v)}
              />
            </div>
          </motion.div>
        )}
      </div>

      {/* 2. Shipping Settings */}
      <div className="bg-white rounded p-4 border border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-[14px] font-bold text-slate-900">Shipping Settings</h3>
          <div className="flex bg-slate-100 p-0.5 rounded-full border border-slate-200 self-start sm:self-auto">
            <button
              onClick={() => setUseStoreDefaultShipping(true)}
              className={`px-4 py-1.5 rounded-full text-xs  transition-all ${useStoreDefaultShipping ? "bg-white shadow-sm text-rose-600" : "text-slate-500"
                }`}
            >
              Use Store Default
            </button>
            <button
              onClick={() => setUseStoreDefaultShipping(false)}
              className={`px-4 py-1.5 rounded-full text-xs  transition-all ${!useStoreDefaultShipping ? "bg-white shadow-sm text-rose-600" : "text-slate-500"
                }`}
            >
              Customize
            </button>
          </div>
        </div>

        {!useStoreDefaultShipping && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="space-y-4 pt-2"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-0">
                <NumberInput
                  label="Avg. Ship Duration"
                  value={shippingPolicy.avgDuration}
                  onChange={(val) => updateShippingPolicy('avgDuration', val === "" ? 0 : val)}
                  placeholder="Avg duration"
                />
                <DefaultSelect
                  title="Choose unit"
                  triggerLabel="Avg. Ship Unit"
                  options={UNITS}
                  value={shippingPolicy.avgUnit}
                  onSelected={(val) => updateShippingPolicy('avgUnit', val)}
                />
              </div>

              <div className="space-y-0">
                <NumberInput
                  label="Promise Delivery"
                  value={shippingPolicy.promiseDuration}
                  onChange={(val) => updateShippingPolicy('promiseDuration', val === "" ? 0 : val)}
                  placeholder="Promise duration"
                />
                <DefaultSelect
                  title="Choose unit"
                  triggerLabel="Promise Delivery Unit"
                  options={UNITS}
                  value={shippingPolicy.promiseUnit}
                  onSelected={(val) => updateShippingPolicy('promiseUnit', val)}
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="text-xs font-semibold text-slate-500 mb-1 block ">Coverage Radius (KM)</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="500"
                  value={shippingPolicy.radiusKm}
                  onChange={(e) => updateShippingPolicy('radiusKm', parseInt(e.target.value))}
                  className="flex-1 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  style={{
                    background: `linear-gradient(to right, #f43f5e ${((shippingPolicy.radiusKm - 1) / (500 - 1)) * 100
                      }%, #f1f5f9 ${((shippingPolicy.radiusKm - 1) / (500 - 1)) * 100}%)`,
                  }}
                />
                <span className="text-sm font-bold text-slate-700 w-16 text-right">{shippingPolicy.radiusKm} KM</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* 3. Promotional and Sales Discount */}
      <div className="bg-white rounded p-4 border border-slate-100 ">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-[14px] font-bold text-slate-900">Promotions & Discounts</h3>
          <div className="flex bg-slate-100 p-0.5 rounded-full border border-slate-200 self-start sm:self-auto">
            <button
              onClick={() => setUseStoreDefaultPromotions(true)}
              className={`px-4 py-1.5 rounded-full text-xs  transition-all ${useStoreDefaultPromotions ? "bg-white shadow-sm text-rose-600" : "text-slate-500"
                }`}
            >
              Use Store Default
            </button>
            <button
              onClick={() => setUseStoreDefaultPromotions(false)}
              className={`px-4 py-1.5 rounded-full text-xs  transition-all ${!useStoreDefaultPromotions ? "bg-white shadow-sm text-rose-600" : "text-slate-500"
                }`}
            >
              Customize
            </button>
          </div>
        </div>

        {!useStoreDefaultPromotions && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="space-y-6 pt-2"
          >
            {/* Campaigns */}
            <div>
              <p className="text-xs font-bold text-slate-500  mb-3">Join Seasonal Campaigns</p>
              <div className="flex flex-wrap gap-2">
                {availableCampaigns.map((camp: Occasion) => {
                  const isJoined = promotions.some(p => p.occasion === camp.name);
                  const isReviewing = tempPromo?.occasion === camp.name;
                  return (
                    <button
                      key={`${camp.name}-${camp.windowStart}`}
                      onClick={() => selectCampaignForReview(camp)}
                      className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all flex items-center gap-2 ${isJoined
                        ? "bg-rose-500 border-rose-600 text-white shadow-lg shadow-rose-200"
                        : isReviewing
                          ? "bg-rose-50 border-rose-300 text-rose-700 shadow-sm"
                          : "bg-white border-slate-200 text-slate-600 hover:border-rose-400"
                        }`}
                    >
                      {isJoined && <CheckCircle2 className="w-3 h-3" />}
                      {camp.name}
                    </button>
                  );
                })}
              </div>

              <AnimatePresence>
                {tempPromo && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="mt-6 p-5 bg-white rounded-2xl border border-rose-100 shadow-xl shadow-rose-100/20"
                  >
                    <div className="flex flex-col md:flex-row gap-6 mb-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="w-3.5 h-3.5 text-rose-500" />
                          <span className="text-[10px] font-bold text-slate-400 tracking-wider">Campaign Duration</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="px-3 py-1.5 bg-rose-50 rounded-lg text-xs font-black text-rose-600 border border-rose-100 min-w-[100px] text-center">
                            {tempPromo.start}
                          </div>
                          <div className="w-4 h-[1px] bg-slate-200"></div>
                          <div className="px-3 py-1.5 bg-rose-50 rounded-lg text-xs font-black text-rose-600 border border-rose-100 min-w-[100px] text-center">
                            {tempPromo.end}
                          </div>
                        </div>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Percent className="w-3.5 h-3.5 text-rose-500" />
                          <span className="text-[10px] font-bold text-slate-400  tracking-wider">Discount for campaign</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <input
                            type="range"
                            min="1"
                            max="90"
                            value={tempPromo.discount || 10}
                            onChange={(e) => {
                              setTempPromo({ ...tempPromo, discount: parseInt(e.target.value) });
                            }}
                            className="flex-1 h-1.5 bg-rose-100 rounded-lg appearance-none cursor-pointer accent-rose-500"
                            style={{
                              background: `linear-gradient(to right, #f43f5e ${(((tempPromo.discount || 10) - 1) / (90 - 1)) * 100
                                }%, #ffe4e6 ${(((tempPromo.discount || 10) - 1) / (90 - 1)) * 100}%)`,
                            }}
                          />
                          <div className="w-14 h-10 flex items-center justify-center bg-rose-600 rounded-xl text-sm font-black text-white shadow-lg shadow-rose-200">
                            {tempPromo.discount}%
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 border-t border-slate-50 pt-5">
                      {promotions.some(p => p.occasion === tempPromo.occasion) ? (
                        <button
                          onClick={leaveCampaign}
                          className="flex-1 bg-white border border-slate-200 text-slate-500 h-10 rounded-full text-sm font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                        >
                          <X className="w-4 h-4" /> Leave Campaign
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => setTempPromo(null)}
                            className="px-6 bg-white border border-slate-200 text-slate-500 h-10 rounded-full text-sm font-bold hover:bg-slate-50 transition-all"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={finalizeJoin}
                            className="flex-1 bg-slate-300  h-10 rounded-full text-sm font-black hover:bg-rose-700 transition-all flex items-center justify-center gap-2"
                          >
                            Join {tempPromo.occasion}
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Sale Discount */}
            <div className="pt-2 border-t border-slate-50">
              {/* <p className="text-xs font-bold text-slate-500  mb-3">Direct Product Discount</p> */}
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <DefaultSelect
                  title="Discount Type"
                  triggerLabel="Direct Discount"
                  options={["No special discount", ...DISCOUNT_OPTIONS]}
                  value={saleDiscount?.type || "No special discount"}
                  onSelected={(val) => setSaleDiscount({ ...saleDiscount, type: val === "No special discount" ? "" : val })}
                />

                {saleDiscount?.type && (
                  <div className="flex-1 w-full flex items-center gap-3 bg-rose-50/50 p-2 rounded-xl border border-rose-100">
                    <input
                      type="range"
                      min="1"
                      max="90"
                      value={saleDiscount?.discount || 0}
                      onChange={(e) => setSaleDiscount({ ...saleDiscount, discount: parseInt(e.target.value) })}
                      className="flex-1 h-1.5 bg-rose-100 rounded-lg appearance-none cursor-pointer accent-rose-500"
                      style={{
                        background: `linear-gradient(to right, #f43f5e ${(((saleDiscount?.discount || 0) - 1) / (90 - 1)) * 100
                          }%, #ffe4e6 ${(((saleDiscount?.discount || 0) - 1) / (90 - 1)) * 100}%)`,
                      }}
                    />
                    <span className="text-md font-black text-rose-600 w-12 text-right">{saleDiscount?.discount || 0}%</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Modals */}
      <ReturnShippingSubsidyModal
        open={showSubsidyInfo}
        onClose={() => setShowSubsidyInfo(false)}
      />
      <SevenDayReturnModal
        open={showSevenDayInfo}
        onClose={() => setShowSevenDayInfo(false)}
      />
      <RapidRefundModal
        open={showRapidRefundInfo}
        onClose={() => setShowRapidRefundInfo(false)}
      />
    </div>
  );
}

function PolicyToggle({ label, sub, checked, onChange, onInfoClick }: { label: string; sub: string; checked: boolean; onChange: (v: boolean) => void; onInfoClick?: () => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="min-w-0 pr-2">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="text-[13px] font-bold text-slate-900">{label}</p>
          {onInfoClick && (
            <button
              onClick={onInfoClick}
              className="w-4 h-4 flex items-center justify-center bg-slate-100 border border-slate-200 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
            >
              <Info className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-500 leading-tight">{sub}</p>
      </div>
      <label className="inline-flex items-center cursor-pointer ml-4">
        <input
          type="checkbox"
          checked={!!checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <span
          className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${checked ? "bg-rose-500" : "bg-slate-200"
            }`}
        >
          <span
            className={`bg-white w-4 h-4 rounded-full shadow transform transition-transform ${checked ? "translate-x-5" : "translate-x-0"
              }`}
          />
        </span>
      </label>
    </div>
  );
}
