// src/components/product/VariantGroupCard.tsx
"use client";
import React from "react";
import type { VariantGroup, VariantGroupProps } from "@/src/types/product";
import DefaultInput from "../../input/default-input";


export default function VariantGroupCard({
  group,
  groupIndex,
  onUpdateTitle,
  onAddEntry,
  onRemoveGroup,
  children,
}: VariantGroupProps) {
  const FIRST_GROUP_HINTS = "e.g. Color, Size, Material, Style";
const SECOND_GROUP_HINTS = "e.g. Storage, Length, Capacity, Finish";


  return (
    <div className="p-4 border border-slate-200 rounded-lg">
     <div className="flex flex-col sm:flex-row sm:items-center gap-3">
  {/* LEFT — Variant title */}
  <div className="flex-1">
    {/* <DefaultInput label="Variant type" value={group.title} onChange={(e) =>onUpdateTitle}   placeholder={groupIndex === 0 ? FIRST_GROUP_HINTS : SECOND_GROUP_HINTS} required /> */}
<DefaultInput
  label="Variant type"
  placeholder={groupIndex === 0 ? FIRST_GROUP_HINTS : SECOND_GROUP_HINTS}
  value={group.title}
  onChange={(v) => onUpdateTitle(group.id, v)}
  required
/>

  </div>

  {/* RIGHT — Actions */}
  <div className="flex items-center justify-end gap-2 sm:gap-3">
    {group.entries.length !== 0 && (
      <button
        onClick={() => onAddEntry(group.id)}
        className="
          px-2 py-1.5
          rounded-lg
          bg-red-400
          text-sm
          text-white
          hover:bg-slate-400
          transition
        "
      >
        + Entry
      </button>
    )}

    <button
      onClick={() => onRemoveGroup(group.id)}
      className="
        px-3 py-1.5
        rounded-lg
        border border-slate-200
        text-sm
        text-slate-500
        hover:bg-slate-50
        transition
      "
    >
      Remove
    </button>
  </div>
</div>



      <div className="mt-3 grid-cols-1 sm:grid-cols-2 gap-3">
        {group.entries.length === 0 && (
          <div className="text-center">
          <div className=" text-slate-400">
            No entries yet
            
          </div>
          <button
              onClick={() => onAddEntry(group.id)}
              className="px-2 py-1 rounded-lg bg-red-400 text-white text-sm"
            >
              + Entry
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
