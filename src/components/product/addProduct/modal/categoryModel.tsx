// src/components/category/AddCategoryModal.tsx
"use client";
import React, { useState } from "react";
import DefaultInput from "@/src/components/input/default-input";
import { toast } from "sonner";
import { postCategory } from "@/src/lib/api/categoryApi";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (newCategory: any) => void; // Category type from API
};

export default function AddCategoryModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleCreate = async () => {
    if (!name.trim()) return toast("Category name is required.");
    setLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) throw new Error("Authentication required");

      const created = await postCategory({ category_name: name.trim(), description: description.trim() }, token || undefined);
      toast("Category created.");
      onCreated(created);
      // clear
      setName("");
      setDescription("");
      onClose();
    } catch (err: any) {
      console.error("create category error", err);
      toast(err?.message || "Failed to create category.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-75 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-5 z-10">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="text-lg font-semibold">Add category</h3>
          <button onClick={onClose} className="text-slate-600 hover:bg-slate-100 rounded-md p-1">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
              <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <DefaultInput label="Category name" value={name} onChange={setName} placeholder="e.g. Electronics" required />
          <div>
            <label className="text-sm font-medium block mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description"
              rows={3}
              className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-slate-200"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-full bg-slate-50">Cancel</button>
          <button onClick={handleCreate} disabled={loading} className="px-4 py-2 rounded-full bg-red-500 text-white">
            {loading ? "Saving..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
