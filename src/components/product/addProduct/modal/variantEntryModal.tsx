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
  samePriceForAll,
  sharedPrice,
  allowImages = false,
  showQuantity = true,
  existingNames = [], // default to empty
}: VariantEntryModal) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [price, setPrice] = useState<number | "">("");
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  useEffect(() => {
    if (!initialData) {
      setName("");
      setQuantity("");
      setPrice("");
      setImages([]);
      setImagePreviews([]);
      return;
    }

    setName(initialData.name ?? "");
    // keep previous quantity if editing; otherwise empty
    setQuantity(initialData.quantity ?? "");
    setPrice(initialData.price ?? "");
    setImages(initialData.images ?? []);
    setImagePreviews(initialData.imagePreviews ?? []);
  }, [initialData]);

  if (!open) return null;

  const handleImageChange = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setImages([file]);
    setImagePreviews([URL.createObjectURL(file)]);
  };

  const removeImage = () => {
    setImages([]);
    setImagePreviews([]);
  };

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

    if (showQuantity && (quantity === "" || quantity <= 0)) {
      toast("Quantity is required and must be greater than 0");
      return;
    }

    if (!samePriceForAll && (price === "" || Number(price) < 0)) {
      toast("Price is required and must be greater than or equal to 0");
      return;
    }

    onSubmit({
      name: trimmed,
      quantity: showQuantity ? Number(quantity || 0) : Number(initialData?.quantity ?? 0),
      price: samePriceForAll ? sharedPrice ?? null : Number(price || 0),
      images: allowImages ? images : [],
      imagePreviews: allowImages ? imagePreviews : [],
    });

    // Reset after submit
    setName("");
    setQuantity("");
    setPrice("");
    setImages([]);
    setImagePreviews([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-75 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={() => onClose()} />

      <div className="relative w-full max-w-2xl bg-white lg:rounded-2xl md:rounded-2xl rounded-t-2xl shadow-xl p-5 z-10 h-[75vh] sm:h-auto flex flex-col">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold mb-4">{initialData ? "Edit Variant" : "Add Variant"}</h3>
          <button onClick={() => onClose()} className="text-sm px-3 py-1 rounded-md hover:bg-slate-100">
            <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="none">
              <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto flex-1 mt-5">
          <DefaultInput label="Variant name" value={name} onChange={setName} placeholder="Variant" required />

          {/* Only show quantity input when showQuantity is true */}
          {showQuantity ? (
            <NumberInput label="Quantity" value={quantity} onChange={setQuantity} placeholder="Quantity" required />
          ) : (
            <div className="text-xs text-slate-500">Quantity is managed per combination for this group.</div>
          )}

          {!samePriceForAll ? (
            <NumberInput label="Variant price" value={price} onChange={setPrice} placeholder="Variant price" required />
          ) : (
            <div className="p-2 rounded-lg text-sm text-slate-500">Using shared price ({sharedPrice ?? "-"})</div>
          )}

          {allowImages && (
            <div className="pt-2">
              {imagePreviews.length > 0 ? (
                <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-200 ">
                  <img src={imagePreviews[0]} className="w-full h-full object-cover" alt="preview" />
                  <button onClick={removeImage} className="absolute top-1 right-1 bg-red-500 rounded-full px-1 text-white text-xs">✕</button>
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
          <button onClick={handleSubmit} className="w-full sm:w-auto px-4 py-2 rounded-full bg-red-500 text-white text-sm">
            {initialData ? "Save" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
