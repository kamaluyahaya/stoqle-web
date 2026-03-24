// src/components/category/ManageCategoriesModal.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import type { Category } from "@/src/lib/api/categoryApi";
import { updateCategory } from "@/src/lib/api/categoryApi";
import { toast } from "sonner";
import DefaultInput from "@/src/components/input/default-input";
import DescriptionTextarea from "@/src/components/input/defaultDescTextarea";

type Props = {
  open: boolean;
  onClose: () => void;
  categories: Category[]; // full objects
  onUpdated: (cat: Category) => void; // parent receives updated cat to sync list
};

export default function ManageCategoriesModal({ open, onClose, categories, onUpdated }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const lastScrollY = useRef<number>(0);
  // Lock background scroll while open
  useEffect(() => {
    if (!open) return;

    // Prevent background scrolling while modal is open
    const originalStyle = window.getComputedStyle(document.body).overflow;
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalStyle;
      document.body.style.paddingRight = "0";
    };
  }, [open]);


  if (!open) return null;

  function beginEdit(cat: Category) {
    setEditingId(cat.category_id);
    setName(cat.category_name ?? "");
    setDesc(cat.description ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setName("");
    setDesc("");
  }


  async function saveEdit(id: number) {
    if (!name.trim()) return toast("Category name is required");
    setLoadingId(id);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await updateCategory(
        id,
        { category_name: name.trim(), description: desc.trim() },
        token || undefined
      );

      // normalize response
      const updated: Category = {
        category_id: id,
        category_name: res?.category_name ?? name.trim(),
        description: res?.description ?? desc.trim(),
        updated_at: res?.updated_at ?? new Date().toISOString(),
      };

      onUpdated(updated);


      toast("Category updated");
      cancelEdit();
      // <-- optionally:
      onClose();

    } catch (err: any) {
      console.error("updateCategory error", err);
      toast(err?.message || "Failed to update category");
    } finally {
      setLoadingId(null);
    }
  }



  return (
    <div className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl p-4 sm:p-6 z-10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Manage categories</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-100">
            <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="none">
              <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="space-y-3 max-h-[60vh] overflow-auto">
          {categories.length === 0 && <div className="text-sm text-slate-500">No categories yet</div>}

          {categories.map((c) => (
            <div key={c.category_id} className="border border-slate-200 rounded-xl p-3 flex items-start justify-between gap-4">
              <div className="flex-1">
                {editingId === c.category_id ? (
                  <div className="space-y-2">
                    <DefaultInput label="Category name" value={name} onChange={setName} placeholder="Category" required />
                    <DescriptionTextarea
                      value={desc}
                      onChange={setDesc}
                      placeholder="Write category description(Optional)..."
                      maxLength={100}
                    />
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => saveEdit(c.category_id)} disabled={loadingId === c.category_id} className="px-3 py-2 rounded-full bg-red-500 text-white text-sm">
                        {loadingId === c.category_id ? "Saving..." : "Save"}
                      </button>
                      <button onClick={cancelEdit} className="px-3 py-2 rounded-full  text-sm">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-sm font-medium text-slate-900">{c.category_name}</div>
                    <div className="text-xs text-slate-500 mt-1">{c.description || <span className="italic text-slate-400">No description</span>}</div>
                    <div className="text-xs text-slate-400 mt-1">Created: {new Date(c.created_at || "").toLocaleString()}</div>
                  </>
                )}
              </div>

              <div className="flex-shrink-0">
                {editingId === c.category_id ? null : (
                  <button onClick={() => beginEdit(c)} className="text-xs px-3 py-2 rounded-full bg-slate-50">
                    Edit
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-full border">Close</button>
        </div>
      </div>
    </div>
  );
}
