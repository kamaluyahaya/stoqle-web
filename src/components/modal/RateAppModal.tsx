"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { StarIcon } from "@heroicons/react/24/solid";
import { API_BASE_URL } from "@/src/lib/config";
import { useAuth } from "@/src/context/authContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function RateAppModal({ open, onClose }: Props) {
  const { token } = useAuth() as any;
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const headers: any = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/api/app/rate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ stars, comment }),
      });
      const data = await res.json();

      if (data.status === "success") {
        toast.success(data.message);
        setComment("");
        setStars(5);
        onClose();
      } else {
        toast.error(data.message || "Failed to submit rating");
      }
    } catch (err) {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[700000] bg-black/50"
            onClick={onClose}
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 220 }}
            className="fixed bottom-0 left-0 right-0 z-[800000] bg-white rounded-t-[0.5rem] shadow-2xl lg:hidden"
          >
            <RateContent
              stars={stars} setStars={setStars}
              comment={comment} setComment={setComment}
              loading={loading} onSubmit={handleSubmit} onClose={onClose}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="hidden lg:block fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[800000] bg-white rounded-[0.5rem] shadow-2xl w-full max-w-md"
          >
            <RateContent
              stars={stars} setStars={setStars}
              comment={comment} setComment={setComment}
              loading={loading} onSubmit={handleSubmit} onClose={onClose}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function RateContent({
  stars, setStars,
  comment, setComment,
  loading, onSubmit, onClose
}: any) {
  return (
    <div className="flex flex-col">
      <div className="flex justify-center pt-3 pb-1 lg:hidden">
        <div className="w-10 h-1 bg-slate-200 rounded-full" />
      </div>

      <div className="flex items-center justify-between px-5 pt-2 pb-4 border-b border-slate-100">
        <h2 className="text-base font-bold text-slate-800">Rate Our Platform</h2>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-slate-100 transition-colors"
        >
          <XMarkIcon className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      <div className="p-5 flex flex-col items-center gap-4">
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <button key={s} onClick={() => setStars(s)} className="p-1 focus:outline-none transition-transform hover:scale-110 active:scale-90">
              <StarIcon className={`w-10 h-10 ${s <= stars ? "text-yellow-400" : "text-slate-200"}`} />
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Tell us what you think (optional)"
          className="w-full h-24 p-3 border border-slate-200 rounded-xl resize-none outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 text-sm transition-all"
        />

        <button
          onClick={onSubmit}
          disabled={loading}
          className="w-full py-3.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-full disabled:opacity-70 transition-colors"
        >
          {loading ? "Submitting..." : "Submit Rating"}
        </button>
      </div>
    </div>
  );
}
