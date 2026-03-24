// components/business/modals/CustomerServiceModal.tsx
"use client";

import React, { useEffect, useState } from "react";
import DescriptionTextarea from "../../input/defaultDescTextarea";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  open: boolean;
  prefKey: string; // e.g. "business_customer_service"
  initialValue: string; // JSON string (may be empty)
  businessName?: string;
  onClose: () => void;
  onSave?: (payloadJson: string) => Promise<void> | void;
};

const REPLY_OPTIONS = [
  "Within 1 hour",
  "Within 6 hours",
  "Within 12 hours",
  "Within 24 hours",
  "Within 48 hours",
  "Within 72 hours",
];

const RATING_OPTIONS = ["5.0", "4.5", "4.0", "3.5", "3.0", "2.5", "2.0", "1.5", "1.0"];

function parseInitial(initial?: string | null) {
  if (!initial) return null;
  try {
    const parsed = JSON.parse(initial);
    if (parsed && typeof parsed === "object") return parsed;
    return null;
  } catch {
    return null;
  }
}

export default function CustomerServiceModal({
  open,
  prefKey,
  initialValue,
  businessName,
  onClose,
  onSave,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // preset mode or custom
  const [useCustom, setUseCustom] = useState(false);
  const [replyPreset, setReplyPreset] = useState<string>(REPLY_OPTIONS[2]); // default Within 12 hours

  // custom structured: number + unit
  const [customNumber, setCustomNumber] = useState<number | "">("");
  const [customUnit, setCustomUnit] = useState<"seconds" | "minutes" | "hours" | "days">("hours");
  // free text fallback
  const [customText, setCustomText] = useState<string>("");

  const [goodReviewRating, setGoodReviewRating] = useState<number>(5.0);
  const [welcomeDm, setWelcomeDm] = useState<string>("");

  const FALLBACK_WELCOME = `Hi! 👋 Thanks for contacting ${businessName || "us"}. We will reply shortly.`;

  useEffect(() => {
    if (!open) return;
    setLoading(true);

    try {
      const parsed =
        parseInitial(initialValue) ?? parseInitial(localStorage.getItem(prefKey) ?? undefined);

      if (parsed && typeof parsed === "object") {
        // reply time detection
        const rt =
          parsed.cs_reply_time ??
          parsed.replyTime ??
          parsed.reply_time ??
          parsed.reply_time_text ??
          parsed.cs_reply_time_text ??
          parsed.reply_time_text;

        if (typeof rt === "string") {
          // if matches preset, use preset
          if (REPLY_OPTIONS.includes(rt)) {
            setUseCustom(false);
            setReplyPreset(rt);
            setCustomNumber("");
            setCustomText("");
          } else {
            // try to parse "Within 15 minutes" / "Within 2 days" etc
            const regex = /within\s+(\d+)\s*(second|second|minute|minutes|hour|hours|day|days)/i;
            const m = rt.match(regex);
            if (m) {
              const n = Number(m[1]);
              const unitRaw = m[2].toLowerCase();
              const unit =
                unitRaw.startsWith("second") ? "seconds" : unitRaw.startsWith("minute") ? "minutes" : unitRaw.startsWith("hour") ? "hours" : "days";
              setUseCustom(true);
              setCustomNumber(Number.isFinite(n) ? n : "");
              setCustomUnit(unit as "seconds" | "minutes" | "hours" | "days");
              setCustomText("");
            } else {
              // fallback to raw custom text
              setUseCustom(true);
              setCustomNumber("");
              setCustomText(rt);
              setCustomUnit("hours");
            }
          }
        } else {
          // not a string: fallback
          setUseCustom(false);
          setReplyPreset(REPLY_OPTIONS[2]);
        }

        // rating
        const gr =
          parsed.cs_good_reviews_summary ??
          parsed.goodReviewSummary ??
          parsed.good_review_summary ??
          parsed.rating;
        const numericRating = Number(gr);
        setGoodReviewRating(
          Number.isFinite(numericRating) && numericRating >= 1 && numericRating <= 5
            ? numericRating
            : 5.0
        );

        // welcome message
        const wm =
          parsed.default_welcome_message ??
          parsed.welcomeDm ??
          parsed.welcome_dm ??
          parsed.welcomeMessage ??
          parsed.welcome_message;
        setWelcomeDm(typeof wm === "string" ? wm : "");
      } else {
        // defaults
        setUseCustom(false);
        setReplyPreset(REPLY_OPTIONS[2]);
        setCustomNumber("");
        setCustomText("");
        setGoodReviewRating(5.0);
        setWelcomeDm("");
      }
    } catch (e) {
      console.error("Failed parse customer service initial:", e);
      setUseCustom(false);
      setReplyPreset(REPLY_OPTIONS[2]);
      setCustomNumber("");
      setCustomText("");
      setGoodReviewRating(5.0);
      setWelcomeDm("");
    } finally {
      setLoading(false);
    }
  }, [open, initialValue, prefKey]);

  // prevent background scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function renderPresetList() {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {REPLY_OPTIONS.map((opt) => (
          <button
            key={opt}
            onClick={() => {
              setUseCustom(false);
              setReplyPreset(opt);
            }}
            className={`text-left p-3 rounded-lg border ${!useCustom && replyPreset === opt
              ? "border-rose-400 bg-rose-50"
              : "border-slate-100 bg-white hover:bg-slate-50"
              }`}
          >
            <div className="text-sm font-medium">{opt}</div>
            <div className="text-xs text-slate-400">Shown to customers as: “{opt}”</div>
          </button>
        ))}
      </div>
    );
  }

  function renderCustomEditor() {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Structured (recommended)</label>
        </div>

        <div className="flex gap-2">
          <input
            type="number"
            min={1}
            value={customNumber === "" ? "" : String(customNumber)}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") return setCustomNumber("");
              const n = Number(v);
              if (Number.isFinite(n) && n >= 0) setCustomNumber(n);
            }}
            className="w-24 px-3 py-2 border rounded-lg"
            placeholder="e.g. 15"
          />
          <select
            value={customUnit}
            onChange={(e) =>
              setCustomUnit(e.target.value as "seconds" | "minutes" | "hours" | "days")
            }
            className="px-3 py-2 border rounded-lg"
          >
            <option value="seconds">seconds</option>
            <option value="minutes">minutes</option>
            <option value="hours">hours</option>
            <option value="days">days</option>
          </select>

          <div className="flex-1 text-xs text-slate-500 p-2">Preview:{" "}
            <span className="font-medium">
              {customNumber !== "" ? `Within ${customNumber} ${customUnit}` : "—"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  async function handleSave() {
    // basic validation
    let finalReplyText = "";

    if (useCustom) {
      if (customText.trim() !== "") {
        finalReplyText = customText.trim();
      } else if (customNumber !== "" && Number.isFinite(Number(customNumber)) && Number(customNumber) > 0) {
        // sanitize pluralization: we'll just use the unit as provided (minutes/hours/days)
        finalReplyText = `Within ${customNumber} ${customUnit}`;
      } else {
        window.alert("Please provide a custom reply time (number + unit) or a custom text.");
        return;
      }
    } else {
      if (!replyPreset || replyPreset.trim() === "") {
        window.alert("Please choose a reply time.");
        return;
      }
      finalReplyText = replyPreset;
    }

    if (!(goodReviewRating >= 1.0 && goodReviewRating <= 5.0)) {
      window.alert("Please choose a rating between 1.0 and 5.0.");
      return;
    }

    const welcomeToSave = welcomeDm.trim() === "" ? FALLBACK_WELCOME : welcomeDm.trim();

    setSaving(true);

    const payloadObj = {
      cs_reply_time: finalReplyText,
      cs_good_reviews_summary: Number(goodReviewRating),
      default_welcome_message: welcomeToSave,
    };

    const payloadJson = JSON.stringify(payloadObj);

    try {
      try {
        localStorage.setItem(prefKey, payloadJson);
      } catch (e) {
        console.error("Failed to persist customer service to localStorage", e);
      }

      if (onSave) await onSave(payloadJson);
    } catch (e) {
      console.error(e);
      window.alert("Failed to save customer service settings.");
    } finally {
      setSaving(false);
      onClose();
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[1001] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => (saving ? null : onClose())}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-2xl bg-white lg:rounded-2xl rounded-t-2xl shadow-xl p-5 z-10 flex flex-col"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Customer Service</h3>
              <button onClick={() => (saving ? null : onClose())} className="text-sm px-3 py-1 rounded-md hover:bg-slate-100">
                <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <div className="mt-4 max-h-[60vh] overflow-auto">
              {loading ? (
                <div className="py-8 text-center text-sm text-slate-500">Loading…</div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-semibold text-slate-900">Reply time</label>
                        <p className="text-xs text-slate-500 mt-1">Choose how quickly you reply to customers. You can use a preset or set a custom time.</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="text-xs text-slate-500">Use custom</label>
                        <input
                          type="checkbox"
                          checked={useCustom}
                          onChange={(e) => setUseCustom(e.target.checked)}
                          className="h-4 w-4"
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      {!useCustom ? renderPresetList() : renderCustomEditor()}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                    <label className="text-sm font-semibold text-slate-900">Good reviews rating</label>
                    <p className="text-xs text-slate-500 mt-1 mb-2">Select the rating you aim for (used in summaries).</p>
                    <select
                      value={goodReviewRating.toFixed(1)}
                      onChange={(e) => setGoodReviewRating(Number(e.target.value))}
                      className="w-full border border-slate-200 rounded-lg p-3 text-sm"
                    >
                      {RATING_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                    <label className="text-sm font-semibold text-slate-900">Welcome DM</label>
                    <p className="text-xs text-slate-500 mt-1 mb-2">Default message sent to new customers who DM you.</p>
                    <DescriptionTextarea
                      value={welcomeDm}
                      onChange={setWelcomeDm}
                      placeholder={FALLBACK_WELCOME}
                      maxLength={500}
                    />
                    <div className="text-xs text-slate-400 mt-2">If left empty a friendly default will be used.</div>
                  </div>

                  <div className="text-xs text-slate-500">Tip: A short and clear reply time (e.g. “Within 2 hours”) sets the right expectation and reduces follow-up messages.</div>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => (saving ? null : onClose())} className="px-4 py-2 rounded-lg bg-white border" disabled={saving}>
                Cancel
              </button>
              <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-rose-500 text-white font-semibold" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
