"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

interface Step {
  targetId: string;
  action: string;
}

const STEPS: Step[] = [
  {
    targetId: "guide-cart-item",
    action: "Mark a product to include it in your checkout list."
  },
  {
    targetId: "guide-cart-select-all",
    action: "Or use 'Select All' to quickly checkout everything in your cart."
  },
  {
    targetId: "guide-cart-checkout",
    action: "Finally, click Checkout to confirm your order and proceed to payment."
  }
];

interface CartWalkthroughProps {
  onComplete?: () => void;
  forceShow?: boolean;
}

export default function CartWalkthrough({ onComplete, forceShow }: CartWalkthroughProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const hasSeen = localStorage.getItem("stoqle_cart_guide_completed");
    if (!hasSeen || forceShow) {
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [forceShow]);

  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;

    const updateSpotlight = () => {
      const step = STEPS[currentStep];
      const el = document.getElementById(step.targetId);
      if (el) {
        setSpotlightRect(el.getBoundingClientRect());
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        setSpotlightRect(null);
      }
    };

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
      window.removeEventListener("resize", updateSpotlight);
      window.removeEventListener("scroll", updateSpotlight);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isVisible, currentStep]);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      finish();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const finish = () => {
    setIsVisible(false);
    localStorage.setItem("stoqle_cart_guide_completed", "true");
    onComplete?.();
  };

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (!isVisible) return null;

  const currentData = STEPS[currentStep];
  const showBelow = spotlightRect && spotlightRect.top < 200;

  const bubbleWidth = typeof window !== 'undefined' ? (isMobile ? Math.min(280, window.innerWidth * 0.94) : 280) : 280;
  const spotlightX = spotlightRect ? spotlightRect.left + spotlightRect.width / 2 : 0;
  const preferredLeft = isMobile ? (typeof window !== 'undefined' ? window.innerWidth / 2 : 0) : spotlightX;

  // Viewport clamping
  const margin = 20;
  const clampedLeft = typeof window !== 'undefined'
    ? Math.max(bubbleWidth / 2 + margin, Math.min(window.innerWidth - bubbleWidth / 2 - margin, preferredLeft))
    : preferredLeft;

  const bubbleX = clampedLeft;
  const relativeTailX = (spotlightX - (bubbleX - bubbleWidth / 2));
  const tailPercent = Math.max(10, Math.min(90, (relativeTailX / bubbleWidth) * 100));

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden">
      <svg className="absolute inset-0 w-full h-full pointer-events-auto">
        <defs>
          <mask id="cart-spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {spotlightRect && (
              <motion.rect
                layoutId="cart-spotlight"
                x={spotlightRect.left - 8}
                y={spotlightRect.top - 8}
                width={spotlightRect.width + 16}
                height={spotlightRect.height + 16}
                rx="12"
                fill="black"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.7)"
          mask="url(#cart-spotlight-mask)"
        />
      </svg>

      <div className="absolute inset-0 pointer-events-none">
        <AnimatePresence mode="wait">
          {spotlightRect && (
            <motion.div
              key={currentStep}
              className="absolute pointer-events-auto"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{
                opacity: 1,
                scale: 1,
                left: clampedLeft,
                top: showBelow ? spotlightRect.bottom + 20 : spotlightRect.top - 20
              }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              style={{
                translateX: "-50%",
                translateY: showBelow ? "0%" : "-100%",
                width: "min(280px, 94vw)"
              }}
            >
              <div className="bg-white text-slate-900 rounded-[0.5rem] p-3 sm:p-5 relative shadow-2xl border border-slate-100">
                {showBelow ? (
                  <div
                    className="absolute -top-1.5 w-3 h-3 bg-white rotate-45 border-l border-t border-slate-100"
                    style={{ left: `${tailPercent}%`, }}
                  />
                ) : (
                  <div
                    className="absolute -bottom-1.5 w-3 h-3 bg-white rotate-45 border-r border-b border-slate-100"
                    style={{ left: `${tailPercent}%`, }}
                  />
                )}

                <div className="flex flex-col gap-3 sm:gap-4">

                  <p className="text-[11px] sm:text-[13px] leading-relaxed  text-center font-semibold text-slate-800">
                    {currentData.action}
                  </p>

                  <div className="flex items-center justify-between pt-2 sm:pt-3">
                    <button
                      disabled={currentStep === 0}
                      onClick={handleBack}
                      className="text-[9px] sm:text-[10px] font-black flex items-center gap-1 disabled:opacity-0 hover:text-rose-500 transition-colors"
                    >
                      <ChevronLeftIcon className="w-3 h-3" strokeWidth={3} /> Back
                    </button>
                    <button
                      onClick={handleNext}
                      className="px-3 sm:px-4 py-1.5 sm:py-2 bg-rose-600 rounded-full text-[9px] sm:text-[10px] font-black text-white flex items-center gap-2 hover:bg-rose-500 active:scale-95 transition-all shadow-md shadow-rose-100"
                    >
                      {currentStep === STEPS.length - 1 ? "Got it!" : (
                        <>Next <ChevronRightIcon className="w-3 h-3" strokeWidth={3} /></>
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
