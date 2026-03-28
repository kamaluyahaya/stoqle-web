"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/context/authContext";

export default function ReleaseSelectionModal() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const auth = useAuth();

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("showReleaseModal", handleOpen);
    return () => window.removeEventListener("showReleaseModal", handleOpen);
  }, []);

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal Container */}
      <div
        className={`relative w-full max-w-md bg-white rounded-t-[0.5rem] sm:rounded-[0.5rem] pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-8 shadow-2xl transition-all duration-300 transform 
          ${isOpen ? "translate-y-0 opacity-100 scale-100" : "translate-y-full opacity-0 scale-95 sm:translate-y-0"}`}
      >
        <div className="flex flex-col gap-1">

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

          <div className="bg-slate-100 h-2" />

          <button
            onClick={() => setIsOpen(false)}
            className="w-full py-4 bg-white  text-slate-400 font-bold text-center active:scale-95 transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
