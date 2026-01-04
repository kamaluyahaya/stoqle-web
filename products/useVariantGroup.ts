// src/hooks/useVariantGroups.ts
"use client";
import { useEffect, useState } from "react";
import type { VariantGroup, VariantEntry } from "@/src/types/product";
import { cryptoRandomId } from "@/src/lib/utils/utils";

/**
 * Encapsulates variant-groups state + helpers.
 * Keeps the same semantics as your original component.
 */
export default function useVariantGroups(initial?: VariantGroup[]) {
  const [variantGroups, setVariantGroups] = useState<VariantGroup[]>(
    () =>
      initial ??
      [
        { id: cryptoRandomId(), title: "Color", entries: [], allowImages: true },
        { id: cryptoRandomId(), title: "Size", entries: [], allowImages: false },
      ]
  );

  const addVariantGroup = () => {
    if (variantGroups.length >= 2) return;
    setVariantGroups((g) => [...g, { id: cryptoRandomId(), title: "Variant", entries: [], allowImages: false }]);
  };

  const removeVariantGroup = (groupId: string) =>
    setVariantGroups((g) => g.filter((gg) => gg.id !== groupId));

  const updateVariantGroupTitle = (groupId: string, newTitle: string) =>
    setVariantGroups((g) => g.map((gg) => (gg.id === groupId ? { ...gg, title: newTitle } : gg)));

  const setGroupAllowImages = (groupId: string) =>
    setVariantGroups((g) => g.map((gg) => ({ ...gg, allowImages: gg.id === groupId })));

  const addVariantEntry = (groupId: string, seed?: Partial<VariantEntry>) =>
    setVariantGroups((g) =>
      g.map((gg) =>
        gg.id === groupId
          ? {
              ...gg,
              entries: [
                ...gg.entries,
                {
                  id: cryptoRandomId(),
                  name: "",
                  quantity: 0,
                  price: seed?.price ?? null,
                  images: [],
                  imagePreviews: [],
                },
              ],
            }
          : gg
      )
    );

  const removeVariantEntry = (groupId: string, entryId: string) =>
    setVariantGroups((g) => g.map((gg) => (gg.id === groupId ? { ...gg, entries: gg.entries.filter((e) => e.id !== entryId) } : gg)));

  const updateVariantEntry = (groupId: string, entryId: string, patch: Partial<VariantEntry>) =>
    setVariantGroups((g) =>
      g.map((gg) =>
        gg.id === groupId ? { ...gg, entries: gg.entries.map((e) => (e.id === entryId ? { ...e, ...patch } : e)) } : gg
      )
    );

  // helpers to find entry
  const getVariantEntry = (groupId: string, entryId: string) => {
    const g = variantGroups.find((gg) => gg.id === groupId);
    return g?.entries.find((e) => e.id === entryId) ?? null;
  };

  // for external convenience
  return {
    variantGroups,
    setVariantGroups,
    addVariantGroup,
    removeVariantGroup,
    updateVariantGroupTitle,
    setGroupAllowImages,
    addVariantEntry,
    removeVariantEntry,
    updateVariantEntry,
    getVariantEntry,
  } as const;
}
