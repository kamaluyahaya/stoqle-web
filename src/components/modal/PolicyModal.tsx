"use client";
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { API_BASE_URL } from "@/src/lib/config";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  endpoint: string; // e.g. "/api/app/privacy-policy"
}

type PolicySection = {
  id: number;
  section_title?: string;
  title?: string; // some endpoints use 'title' instead of 'section_title'
  content: string;
};

export default function PolicyModal({ open, onClose, title, endpoint }: Props) {
  const [data, setData] = useState<PolicySection[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetch(`${API_BASE_URL}${endpoint}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.status === "success") {
            setData(json.data);
          } else {
            toast.error(json.message || "Failed to load");
          }
        })
        .catch(() => toast.error("Network error"))
        .finally(() => setLoading(false));
    } else {
      setData([]);
    }
  }, [open, endpoint]);

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
            className="fixed bottom-0 left-0 right-0 z-[800000] bg-white rounded-t-[0.5rem] shadow-2xl overflow-hidden lg:hidden"
            style={{ maxHeight: "85vh" }}
          >
            <PolicyContent title={title} loading={loading} data={data} onClose={onClose} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="hidden lg:block fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[800000] bg-white rounded-[0.5rem] shadow-2xl overflow-hidden w-full max-w-lg"
            style={{ maxHeight: "80vh" }}
          >
            <PolicyContent title={title} loading={loading} data={data} onClose={onClose} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function PolicyContent({
  title,
  loading,
  data,
  onClose,
}: {
  title: string;
  loading: boolean;
  data: PolicySection[];
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col h-full" style={{ maxHeight: "inherit" }}>
      <div className="flex justify-center pt-3 pb-1 lg:hidden shrink-0">
        <div className="w-10 h-1 bg-slate-200 rounded-full" />
      </div>

      <div className="flex items-center justify-between px-5 pt-2 pb-4 border-b border-slate-100 shrink-0">
        <h2 className="text-base font-bold text-slate-800">{title}</h2>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-slate-100 transition-colors"
        >
          <XMarkIcon className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {loading ? (
          <div className="flex justify-center items-center py-10">
            <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : data.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-10">No information available.</p>
        ) : (
          data.map((item) => (
            <div key={item.id} className="space-y-2 text-slate-700">
              <h3 className="font-bold text-sm">
                {item.section_title || item.title}
              </h3>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {item.content}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
