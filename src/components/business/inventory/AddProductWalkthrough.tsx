"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon, SparklesIcon } from "@heroicons/react/24/outline";

interface Step {
  targetId: string;
  title: string;
  action: string;
  emoji: string;
}

const STEPS: Step[] = [
  {
    targetId: "ap-guide-media",
    emoji: "📸",
    title: "Product Photos & Video",
    action: "Start by uploading clear, high-quality product photos. Great images boost sales by up to 40%. You can also add a short product video!"
  },
  {
    targetId: "ap-guide-info",
    emoji: "✏️",
    title: "Product Info",
    action: "Give your product a clear name, pick a category, and write a description that sells. Customers judge quickly — make it count!"
  },
  {
    targetId: "ap-guide-type",
    emoji: "🏷️",
    title: "Choose Product Type",
    action: "Simple Product = single price & one stock level. Variant Product = multiple options like sizes or colours, each with their own stock."
  },
  {
    targetId: "ap-guide-variants",
    emoji: "🎨",
    title: "Setting Up Variants",
    action: "Create groups like 'Color' or 'Size', then add options within each group. Enable Advanced Combination Logic if each combination (e.g. Red-XL) needs its own stock count."
  },
  {
    targetId: "ap-guide-specs",
    emoji: "📋",
    title: "Specifications",
    action: "Add extra product details like Material, Weight, or Origin. These help customers make informed decisions and improve search results."
  },
  {
    targetId: "ap-guide-policies",
    emoji: "🛡️",
    title: "Product Policies",
    action: "Customize return and shipping policies per product. By default, your store-wide settings apply — only override if this item is different."
  },
  {
    targetId: "ap-guide-publish",
    emoji: "🚀",
    title: "Publish Your Product",
    action: "Everything looks good? Hit 'Confirm & Publish' to make it live! Or save a draft to come back later."
  }
];

const LOCAL_KEY = "stoqle_add_product_guide_completed";

export default function AddProductWalkthrough({ onComplete, forceShow }: { onComplete?: () => void; forceShow?: boolean }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const hasSeen = localStorage.getItem(LOCAL_KEY);
    if (!hasSeen || forceShow) {
      const timer = setTimeout(() => setIsVisible(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [forceShow]);

  useEffect(() => {
    document.body.style.overflow = isVisible ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;

    const updateSpotlight = () => {
      const el = document.getElementById(STEPS[currentStep].targetId);
      if (el) {
        setSpotlightRect(el.getBoundingClientRect());
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        setSpotlightRect(null);
      }
    };

    // Use a ResizeObserver or an interval to check for element visibility changes
    // (e.g. when user toggles Simple/Variant product)
    const interval = setInterval(updateSpotlight, 1000);

    updateSpotlight();
    window.addEventListener("resize", updateSpotlight);
    window.addEventListener("scroll", updateSpotlight);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handleBack();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", updateSpotlight);
      window.removeEventListener("scroll", updateSpotlight);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isVisible, currentStep]);

  const handleNext = () => {
    let next = currentStep + 1;
    while (next < STEPS.length) {
      if (document.getElementById(STEPS[next].targetId)) {
        setCurrentStep(next);
        return;
      }
      next++;
    }
    finish();
  };

  const handleBack = () => {
    let prev = currentStep - 1;
    while (prev >= 0) {
      if (document.getElementById(STEPS[prev].targetId)) {
        setCurrentStep(prev);
        return;
      }
      prev--;
    }
  };

  const finish = () => {
    setIsVisible(false);
    localStorage.setItem(LOCAL_KEY, "true");
    onComplete?.();
  };

  if (!isVisible) return null;

  const step = STEPS[currentStep];
  const showBelow = spotlightRect ? spotlightRect.top < 280 : true;

  const bubbleWidth = isMobile ? Math.min(300, window.innerWidth * 0.94) : 340;
  const spotlightX = spotlightRect ? spotlightRect.left + spotlightRect.width / 2 : window.innerWidth / 2;
  const preferredLeft = isMobile ? window.innerWidth / 2 : spotlightX;
  const margin = 20;
  const clampedLeft = Math.max(bubbleWidth / 2 + margin, Math.min(window.innerWidth - bubbleWidth / 2 - margin, preferredLeft));
  const bubbleX = clampedLeft;
  const relativeTailX = spotlightX - (bubbleX - bubbleWidth / 2);
  const tailPercent = Math.max(8, Math.min(92, (relativeTailX / bubbleWidth) * 100));

  const progressPct = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div className="fixed inset-0 z-[10000] pointer-events-none overflow-hidden">
      {/* Dimmed Spotlight Overlay */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto">
        <defs>
          <mask id="ap-spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {spotlightRect && (
              <motion.rect
                layoutId="ap-spotlight"
                x={spotlightRect.left - 10}
                y={spotlightRect.top - 10}
                width={spotlightRect.width + 20}
                height={spotlightRect.height + 20}
                rx="12"
                fill="black"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.72)" mask="url(#ap-spotlight-mask)" />
      </svg>

      {/* Tooltip */}
      <div className="absolute inset-0 pointer-events-none">
        <AnimatePresence mode="wait">
          {spotlightRect && (
            <motion.div
              key={currentStep}
              className="absolute pointer-events-auto"
              initial={{ opacity: 0, scale: 0.92, y: 8 }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
                left: clampedLeft,
                top: showBelow ? spotlightRect.bottom + 52 : spotlightRect.top - 52
              }}
              exit={{ opacity: 0, scale: 0.92, y: 8 }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              style={{
                translateX: "-50%",
                translateY: showBelow ? "0%" : "-100%",
                width: bubbleWidth
              }}
            >
              {/* Animated Hand Pointer */}
              <motion.div
                animate={{ y: showBelow ? [-12, 0, -12] : [12, 0, 12] }}
                transition={{ repeat: Infinity, duration: 0.9, ease: "easeInOut" }}
                className="absolute"
                style={{
                  left: `${tailPercent}%`,
                  translateX: "-50%",
                  top: showBelow ? "-52px" : "auto",
                  bottom: showBelow ? "auto" : "-52px",
                  rotateZ: showBelow ? 180 : 0
                }}
              >
                <img
                  src="/assets/images/hand.png"
                  alt="Pointing here"
                  className="w-11 h-11 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.35)]"
                />
              </motion.div>

              {/* Bubble */}
              <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
                {/* Progress Bar */}
                <div className="h-1 bg-slate-100">
                  <motion.div
                    className="h-full bg-rose-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>

                <div className="p-4 sm:p-5 space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{step.emoji}</span>
                      <div>
                        <p className="text-[9px] font-black tracking-widest text-rose-500 uppercase">
                          Step {currentStep + 1} of {STEPS.length}
                        </p>
                        <p className="text-sm font-black text-slate-900 leading-tight">{step.title}</p>
                      </div>
                    </div>
                    <button onClick={finish} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600">
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Description */}
                  <p className="text-[12px] sm:text-[13px] leading-relaxed text-slate-600 font-medium">
                    {step.action}
                  </p>

                  {/* Footer Nav */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <button
                      disabled={currentStep === 0}
                      onClick={handleBack}
                      className="flex items-center gap-1 text-[10px] font-black text-slate-400 hover:text-rose-500 disabled:opacity-0 transition-colors"
                    >
                      <ChevronLeftIcon className="w-3.5 h-3.5" /> Back
                    </button>

                    {/* Step Dots */}
                    <div className="flex items-center gap-1">
                      {STEPS.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentStep(i)}
                          className={`h-1.5 rounded-full transition-all duration-300 ${i === currentStep ? "w-5 bg-rose-500" : "w-1.5 bg-slate-200 hover:bg-slate-300"}`}
                        />
                      ))}
                    </div>

                    <button
                      onClick={handleNext}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-full text-[10px] font-black shadow-md shadow-rose-100 active:scale-95 transition-all"
                    >
                      {currentStep === STEPS.length - 1 ? (
                        <><SparklesIcon className="w-3.5 h-3.5" /> Done!</>
                      ) : (
                        <>Next <ChevronRightIcon className="w-3.5 h-3.5" /></>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
