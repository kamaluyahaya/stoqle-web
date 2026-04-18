// src/components/product/addProduct/modal/variantEntryModal.tsx
"use client";
import React, { useEffect, useState } from "react";
import type { VariantEntryModal, VariantEntry } from "@/src/types/product";
import { toast } from "sonner";
import NumberInput from "@/src/components/input/defaultNumberInput";
import DefaultInput from "@/src/components/input/default-input";


export default function VariantEntryModal({
  open,
  initialData = null,
  onClose,
  onSubmit,
  allowImages = false,
  useCombinations, // ✅ NEW
  samePriceForAll,
  sharedPrice,
  existingNames = [], // default to empty
  readOnlyQuantity = false,
}: VariantEntryModal) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState<number | "">(0);
  const [price, setPrice] = useState<number | "">("");
  const [images, setImages] = useState<(File | string)[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  // Only show these fields if NOT using combination manager
  const showFields = !useCombinations;

  useEffect(() => {
    if (!initialData) {
      setName("");
      setQuantity(0);
      setPrice("");
      setImages([]);
      setImagePreviews([]);
      return;
    }

    setName(initialData.name ?? "");
    setQuantity(initialData.quantity ?? "");
    setPrice(initialData.price ?? "");
    setImages(initialData.images ?? []);
    setImagePreviews(initialData.imagePreviews ?? []);
  }, [initialData]);

  const handleImageChange = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setImages([file]);
    setImagePreviews([URL.createObjectURL(file)]);
  };

  const removeImage = () => {
    if (imagePreviews[0] && !imagePreviews[0].startsWith('http')) {
      URL.revokeObjectURL(imagePreviews[0]);
    }
    setImages([]);
    setImagePreviews([]);
  };

  useEffect(() => {
    return () => {
      imagePreviews.forEach(p => {
        if (p && !p.startsWith('http')) URL.revokeObjectURL(p);
      });
    };
  }, [imagePreviews]);

  if (!open) return null;

  const handleSubmit = () => {
    const trimmed = name.trim();
    const normalized = trimmed.toLowerCase();

    // Validation
    if (!trimmed) {
      toast("Variant name is required");
      return;
    }

    // Duplicate check: allow when editing the same entry (name unchanged)
    const initialNameNormalized = initialData?.name?.trim().toLowerCase() ?? null;
    const isDuplicate = existingNames.some((n) => n === normalized);

    if (isDuplicate && initialNameNormalized !== normalized) {
      toast("A variant with this name already exists in this group.");
      return;
    }

    const finalQty = showFields
      ? (quantity === "" ? (readOnlyQuantity ? 0 : "") : Number(quantity))
      : Number(initialData?.quantity ?? 0);

    if (showFields && finalQty === "" && !readOnlyQuantity) {
      toast("Quantity is required and must be 0 or more");
      return;
    }

    onSubmit({
      name: trimmed,
      quantity: Number(finalQty || 0),
      price: showFields ? (samePriceForAll ? sharedPrice ?? null : Number(price || 0)) : (initialData?.price ?? null),
      images: allowImages ? images : [],
      imagePreviews: allowImages ? imagePreviews : [],
    });

    // Reset after submit
    setName("");
    setQuantity(0);
    setPrice("");
    setImages([]);
    setImagePreviews([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={() => onClose()} />

      <div className="relative w-full max-w-2xl bg-white lg:rounded-[0.5rem] md:rounded-[0.5rem] rounded-t-[0.5rem] p-5 z-10 h-[75vh] sm:h-auto flex flex-col">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold mb-4">{initialData ? "Edit Variant Option" : "Add Variant Option"}</h3>
          <button onClick={() => onClose()} className="text-sm px-3 py-1 rounded-md hover:bg-slate-100">
            <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="none">
              <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto flex-1 mt-5">
          <DefaultInput label="Variant option name" value={name} onChange={setName} placeholder="e.g. Red, XL, 128GB" required />

          {showFields ? (
            <div className="grid sm:grid-cols-2 grid-cols-1 gap-4">
              {readOnlyQuantity ? (
                <div className="space-y-1.5 opacity-80">
                  <span className="text-xs font-bold text-slate-700">Stock Status</span>
                  <div className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl flex items-center px-4 text-slate-600 font-bold text-sm">
                    {quantity || 0} Units
                  </div>
                  <p className="text-[9px] text-slate-400 font-bold">Managed in Inventory</p>
                </div>
              ) : (
                <NumberInput label="Quantity" value={quantity} onChange={setQuantity} placeholder="Units in stock" />
              )}
              {!samePriceForAll && (
                <NumberInput label="Option Price (₦)" value={price} onChange={setPrice} placeholder="Price for this option" />
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-dotted border-slate-200">
              Note: Individual price and stock are hidden because you are managing variants globally via <strong>Combinations</strong>.
            </p>
          )}

          {showFields && samePriceForAll && (
            <div className="text-xs text-slate-500 p-2 bg-emerald-50 rounded-lg">
              Using shared price ({sharedPrice ? `₦${sharedPrice.toLocaleString()}` : "Not set"})
            </div>
          )}

          {allowImages && (
            <div className="pt-2">
              {imagePreviews.length > 0 ? (
                <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-200 ">
                  <img src={imagePreviews[0]} className="w-full h-full object-cover" alt="preview" />
                  <button onClick={removeImage} className="absolute top-1 right-1 bg-rose-500 rounded-full px-1 text-white text-xs">✕</button>
                </div>
              ) : (
                <label className="inline-block px-3 py-2 rounded-lg bg-white border border-slate-200 cursor-pointer text-sm">
                  <input type="file" accept="image/*" onChange={(e) => handleImageChange(e.target.files)} className="hidden" />
                  Add image
                </label>
              )}
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col sm:flex-row justify-end gap-2 w-full">
          <button onClick={handleSubmit} className="w-full sm:w-auto px-4 py-2 rounded-full bg-rose-500 text-white text-sm">
            {initialData ? "Save" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
