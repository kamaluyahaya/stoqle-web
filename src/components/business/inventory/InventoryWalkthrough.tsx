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
    targetId: "inventory-guide-add",
    action: "Ready to grow? Click here to add your first product to the store!"
  },
  {
    targetId: "inventory-guide-customers",
    action: "View your loyal customers and their order history right here."
  },
  {
    targetId: "inventory-guide-insights",
    action: "Gain deep insights into your business performance and top products."
  }
];

export default function InventoryWalkthrough({ onComplete, forceShow }: { onComplete?: () => void, forceShow?: boolean }) {
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
    const hasSeen = localStorage.getItem("stoqle_inventory_guide_completed");
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
      let el = document.getElementById(step.targetId);

      // Fallback for mobile specific bottom navigation
      if (!el || (isMobile && step.targetId !== "inventory-guide-add")) {
        const mobileEl = document.getElementById(`${step.targetId}-mobile`);
        if (mobileEl) el = mobileEl;
      }

      if (el) {
        setSpotlightRect(el.getBoundingClientRect());
        // Only scroll if not in bottom nav range to avoid jumping
        const rect = el.getBoundingClientRect();
        if (rect.top > window.innerHeight - 100) {
          // Near bottom nav
        } else {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
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
  }, [isVisible, currentStep, isMobile]);

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
    localStorage.setItem("stoqle_inventory_guide_completed", "true");
    onComplete?.();
  };

  if (!isVisible) return null;

  const currentData = STEPS[currentStep];
  const showBelow = spotlightRect && spotlightRect.top < 250;

  const bubbleWidth = typeof window !== 'undefined' ? (isMobile ? Math.min(280, window.innerWidth * 0.94) : 320) : 320;
  const spotlightX = spotlightRect ? spotlightRect.left + spotlightRect.width / 2 : 0;
  const preferredLeft = isMobile ? (typeof window !== 'undefined' ? window.innerWidth / 2 : 0) : spotlightX;

  // Viewport clamping to prevent hiding off-screen
  const margin = 20;
  const clampedLeft = typeof window !== 'undefined'
    ? Math.max(bubbleWidth / 2 + margin, Math.min(window.innerWidth - bubbleWidth / 2 - margin, preferredLeft))
    : preferredLeft;

  const bubbleX = clampedLeft;
  const relativeTailX = (spotlightX - (bubbleX - bubbleWidth / 2));
  const tailPercent = Math.max(10, Math.min(90, (relativeTailX / bubbleWidth) * 100));

  return (
    <div className="fixed inset-0 z-[10000] pointer-events-none overflow-hidden">
      <svg className="absolute inset-0 w-full h-full pointer-events-auto">
        <defs>
          <mask id="inventory-spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {spotlightRect && (
              <motion.rect
                layoutId="inventory-spotlight"
                x={spotlightRect.left - 8}
                y={spotlightRect.top - 8}
                width={spotlightRect.width + 16}
                height={spotlightRect.height + 16}
                rx="14"
                fill="black"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.75)"
          mask="url(#inventory-spotlight-mask)"
        />
      </svg>

      <div className="absolute inset-0 pointer-events-none">
        <AnimatePresence mode="wait">
          {spotlightRect && (
            <motion.div
              key={currentStep}
              className="absolute pointer-events-auto"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{
                opacity: 1,
                scale: 1,
                left: clampedLeft,
                top: showBelow ? spotlightRect.bottom + 50 : spotlightRect.top - 50
              }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              style={{
                translateX: "-50%",
                translateY: showBelow ? "0%" : "-100%",
                width: bubbleWidth
              }}
            >
              {/* Animated Hand Image Pointer */}
              <motion.div
                initial={{ y: 0 }}
                animate={{ y: showBelow ? [-15, 0, -15] : [15, 0, 15] }}
                transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
                className="absolute"
                style={{
                  left: `${tailPercent}%`,
                  translateX: "-50%",
                  top: showBelow ? "-55px" : "auto",
                  bottom: showBelow ? "auto" : "-55px",
                  rotateX: showBelow ? 0 : 180,
                  rotateZ: showBelow ? 180 : 0
                }}
              >
                <img
                  src="/assets/images/hand.png"
                  alt="Point here"
                  className="w-12 h-12 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.3)]"
                />
              </motion.div>

              <div className="bg-white text-slate-900 rounded-[0.5rem] p-5 shadow-2xl border border-slate-100">
                <div className="flex flex-col gap-4">

                  <p className="text-[14px] text-center font-semibold leading-relaxed  text-slate-800">
                    {currentData.action}
                  </p>

                  <div className="flex items-center justify-between pt-1 ">
                    <button
                      disabled={currentStep === 0}
                      onClick={handleBack}
                      className="text-[10px] font-black flex items-center gap-1 disabled:opacity-0 hover:text-rose-500 transition-colors"
                    >
                      <ChevronLeftIcon className="w-4 h-4" strokeWidth={3} /> Back
                    </button>
                    <button
                      onClick={handleNext}
                      className="px-5 py-2 bg-slate-900 rounded-full text-[10px] font-black text-white flex items-center gap-2 hover:bg-rose-600 active:scale-95 transition-all shadow-lg"
                    >
                      {currentStep === STEPS.length - 1 ? "Finish" : (
                        <>Next <ChevronRightIcon className="w-4 h-4" strokeWidth={3} /></>
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
