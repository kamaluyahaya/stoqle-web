"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/context/authContext";
import { motion, AnimatePresence } from "framer-motion";

export default function ReleaseSelectionModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();
  const auth = useAuth();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleAction = (type: string) => {
    setIsOpen(false);
    if (type === "album") {
      window.dispatchEvent(new CustomEvent("triggerAlbum"));
    } else if (type === "camera") {
      window.dispatchEvent(new CustomEvent("triggerCamera"));
    } else if (type === "text") {
      window.dispatchEvent(new CustomEvent("triggerNote"));
    } else {
      router.push(`/release?type=${type}`);
    }
  };

  useEffect(() => {
    const handleOpen = (e: any) => {
      setIsOpen(true);
      if (e.detail?.autoClick) {
        handleAction(e.detail.autoClick);
      }
    };
    window.addEventListener("showReleaseModal", handleOpen);
    return () => window.removeEventListener("showReleaseModal", handleOpen);
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal Container */}
          <motion.div
            initial={isMobile ? { y: "100%" } : { scale: 0.85, opacity: 0, y: 20 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={isMobile ? { y: "100%" } : { scale: 0.85, opacity: 0, y: 20 }}
            transition={{
              type: "spring",
              damping: 25,
              stiffness: 250,
              mass: 0.8
            }}
            className="relative w-full max-w-md bg-white rounded-t-[0.5rem] sm:rounded-[0.5rem] pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-8 shadow-2xl overflow-hidden"
          >
            <div className="flex flex-col gap-0">
              {/* Drag handle for mobile */}
              <div className="sm:hidden flex justify-center py-3">
                <div className="w-12 h-1 bg-slate-200 rounded-full" />
              </div>

              <button
                onClick={() => handleAction("album")}
                className="w-full py-4 hover:bg-slate-100 border-b mt-4 border-slate-100 font-bold text-center transition-colors active:scale-[0.98]"
              >
                Choose from album
              </button>

              <div className="border-b border-slate-100 text-center py-4 hover:bg-slate-100" onClick={() => handleAction("camera")}>
                <button

                  className="w-full   text-slate-800 font-bold text-center transition-colors active:scale-[0.98]"
                >
                  Camera
                </button>
                <div className="text-[10px] text-slate-400">
                  Capture & Go live
                </div>
              </div>

              <button
                onClick={() => handleAction("text")}
                className="w-full py-4 hover:bg-slate-100 rounded-2xl text-slate-800 font-bold text-center transition-colors active:scale-[0.98]"
              >
                Text
              </button>

              <div className="bg-slate-50 h-2" />

              <button
                onClick={() => setIsOpen(false)}
                className="w-full py-5 bg-white text-slate-400 font-bold text-center active:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
