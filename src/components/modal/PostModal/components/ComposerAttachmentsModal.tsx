import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Camera, FileText, MapPin, ShoppingBag } from "lucide-react";
import { PostModalContext } from "../types";

interface ComposerAttachmentsModalProps {
  ctx: PostModalContext;
  onClose: () => void;
}

export default function ComposerAttachmentsModal({ ctx, onClose }: ComposerAttachmentsModalProps) {
  const { setActiveAttachmentModal } = ctx;
  const containerRef = useRef<HTMLDivElement>(null);

  const mainOptions = [
    { id: "media", icon: <Camera className="w-6 h-6" />, label: "Media" },
    { id: "posts", icon: <FileText className="w-6 h-6" />, label: "Posts" },
    { id: "location", icon: <MapPin className="w-6 h-6" />, label: "Location" },
    { id: "products", icon: <ShoppingBag className="w-6 h-6" />, label: "Products" },
  ] as const;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: "100%" }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed bottom-0 left-0 right-0 z-[200] bg-white flex flex-col h-[30vh] sm:max-h-[30vh] sm:absolute sm:w-full sm:max-w-md sm:left-1/2 sm:-translate-x-1/2"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        ref={containerRef}
      >


        <div className="flex-1 min-h-[200px] relative">
          <div className="grid grid-cols-4 gap-4 p-6">
            {mainOptions.map(opt => (
              <button
                key={opt.id}
                onClick={() => {
                  setActiveAttachmentModal?.(opt.id);
                }}
                className="flex flex-col items-center gap-3 group"
              >
                <div className="w-14 h-14 rounded-[0.5rem] bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-rose-50 group-hover:text-rose-500 group-hover:border-rose-100 transition-all group-active:scale-95">
                  {opt.icon}
                </div>
                <span className="text-xs font-semibold text-slate-600 tracking-tight">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
