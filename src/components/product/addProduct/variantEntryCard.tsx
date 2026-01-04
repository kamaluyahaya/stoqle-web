"use client";
import type { VariantEntry, VariantEntryCardProps } from "@/src/types/product";



export default function VariantEntryCard({
  entry,
  samePriceForAll,
  sharedPrice,
  onRemove,
  onEdit,
  allowImages = true,
  showQuantity = false,
}: VariantEntryCardProps) {

  const displayPrice =
    samePriceForAll ? sharedPrice : entry.price;

  return (
   <div className="relative border border-slate-200 rounded-xl bg-slate-50 overflow-hidden flex flex-col md:flex-row items-center w-full">
  {/* REMOVE BUTTON */}
  <button
    onClick={onRemove}
    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center shadow"
  >
    ✕
  </button>

  {/* IMAGE */}
  {allowImages && entry.imagePreviews.length > 0 && (
    <div className="flex-shrink-0 w-16 h-16 m-3 rounded-lg bg-slate-100 overflow-hidden">
      <img
        src={entry.imagePreviews[0]}
        alt={entry.name}
        className="w-full h-full object-cover"
      />
    </div>
  )}

  {/* INFO */}
  <div className="flex-1 p-3 text-center md:text-left space-y-1">
    <div className="font-medium text-slate-900">
      {entry.name}
      {showQuantity && (
        <span className="text-slate-400 text-sm"> ({entry.quantity})</span>
      )}
    </div>

    {displayPrice != null && (
      <div className="text-sm text-slate-600">
        ₦{Number(displayPrice).toLocaleString()}
      </div>
    )}

    {/* EDIT LINK */}
    <button
      onClick={onEdit}
      className="text-xs text-blue-600 hover:underline mt-1"
    >
      Edit
    </button>
  </div>
</div>

  );
}
