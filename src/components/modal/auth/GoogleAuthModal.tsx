"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldCheck, ChevronDown } from "lucide-react";
import { CheckIcon } from "@heroicons/react/24/outline";
import { getNextZIndex } from "@/src/lib/utils/z-index";

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  showAgreement: () => void;
  showPrivacy: () => void;
  onCloseAll?: () => void;
  agreed: boolean;
  setAgreed: (val: boolean) => void;
}

const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  showAgreement,
  showPrivacy,
  onCloseAll,
  agreed,
  setAgreed
}) => {
  const [modalZIndex, setModalZIndex] = useState(() => getNextZIndex());

  React.useEffect(() => {
    if (isOpen) {
      setModalZIndex(getNextZIndex());
    }
  }, [isOpen]);

  const handleStartAuth = () => {
    if (agreed) {
      onConfirm();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ zIndex: modalZIndex }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />

          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onMouseDown={(e) => e.stopPropagation()}
            className="relative bg-white w-full sm:max-w-sm rounded-t-[0.5rem] sm:rounded-[0.5rem] shadow-2xl overflow-hidden flex flex-col p-4 items-center text-center z-10"
          >
            {/* Mobile Pull Handle */}

            {/* Header */}
            <div className="w-full flex justify-end absolute top-2 right-8">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="p-2 rounded-full bg-slate-50 text-slate-400 hover:text-slate-900 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>



            <h2 className="text-sm font-bold text-slate-800 ">Continue with Google</h2>

            <div className="border-b w-full mt-5 border-slate-100" />

            {/* Agreement Section */}
            <div className="w-full  mb-5 mt-10">
              <div className="flex items-start gap-2 text-left">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setAgreed(!agreed);
                  }}
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all shrink-0
                            ${agreed ? "bg-rose-500 border-rose-500 shadow-lg shadow-rose-100 scale-110" : "bg-white border-slate-200"}
                        `}
                >
                  {agreed && <CheckIcon className="w-4 h-4 text-white stroke-[4]" />}
                </button>
                <div className="text-[12px] text-slate-500 leading-snug">
                  I agree to Stoqle's{" "}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); showAgreement(); }}
                    className="text-rose-500 hover:underline"
                  >
                    User Agreement
                  </button>
                  {" "} & {" "}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); showPrivacy(); }}
                    className="text-rose-500 hover:underline"
                  >
                    Privacy Policy
                  </button>
                </div>
              </div>
            </div>

            {/* Google Icon Button */}
            <div className="relative group">
              <AnimatePresence>
                {agreed && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1.2, opacity: 0.2 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute inset-0 bg-rose-400 rounded-full blur-xl"
                  />
                )}
              </AnimatePresence>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartAuth();
                }}
                disabled={!agreed}
                className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 shadow-xl
                        ${agreed
                    ? "bg-white border-slate-100 hover:scale-110 active:scale-95 cursor-pointer shadow-rose-100/50"
                    : "bg-slate-50 border-transparent cursor-not-allowed opacity-40 grayscale"
                  }
                    `}
              >
                <svg className="w-10 h-10" viewBox="0 0 533.5 544.3">
                  <path fill="#4285F4" d="M533.5 278.4c0-18.5-1.5-37-4.9-54.7H272v103.6h147.1c-6.3 34-25.6 62.8-54.7 82v68h88.3c51.6-47.6 81.8-117.8 81.8-199z" />
                  <path fill="#34A853" d="M272 544.3c73.6 0 135.4-24.3 180.6-66.2l-88.3-68c-24.5 16.5-56 26.1-92.3 26.1-71 0-131.2-47.9-152.6-112.2H27.4v70.8C71.8 482.5 165.4 544.3 272 544.3z" />
                  <path fill="#FBBC05" d="M119.4 324.9c-10.6-31.7-10.6-65.8 0-97.5V156.6H27.4C-1 204.2-1 299.8 27.4 348.4l92-23.5z" />
                  <path fill="#EA4335" d="M272 107.7c39.4 0 74.7 13.6 102.5 40.2l76.8-76.8C406 23.6 344.2 0 272 0 165.4 0 71.8 61.8 27.4 156.6l92 70.5C140.8 155.6 201 107.7 272 107.7z" />
                </svg>
              </button>
            </div>

            <p className={`mt-6 text-[12px] transition-colors duration-500
                ${agreed ? "text-rose-500 animate-pulse" : "text-slate-300"}
            `}>
              {agreed ? "Tap to Continue" : "Agree to Unlock"}
            </p>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default GoogleAuthModal;
