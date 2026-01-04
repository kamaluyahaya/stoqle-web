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
      {
        id: cryptoRandomId(),
        title: "",        // ✅ EMPTY
        entries: [],
        allowImages: true,
      },
    ]
);

const addVariantGroup = () => {
  setVariantGroups((g) => {
    if (g.length >= 2) return g;

    const isFirstGroup = g.length === 0;

    return [
      ...g,
      {
        id: cryptoRandomId(),
        title: "",
        entries: [],
        allowImages: isFirstGroup, // 👈 key fix
      },
    ];
  });
};


  const removeVariantGroup = (groupId: string) =>
    setVariantGroups((g) => g.filter((gg) => gg.id !== groupId));

  const updateVariantGroupTitle = (groupId: string, newTitle: string) =>
    setVariantGroups((g) => g.map((gg) => (gg.id === groupId ? { ...gg, title: newTitle } : gg)));

const isDuplicateVariantName = (
  groupId: string,
  name: string,
  ignoreEntryId?: string
) => {
  const group = variantGroups.find((g) => g.id === groupId);
  if (!group) return false;

  const normalized = name.trim().toLowerCase();

  return group.entries.some(
    (e) =>
      e.id !== ignoreEntryId &&
      e.name.trim().toLowerCase() === normalized
  );
};

const setGroupAllowImages = (groupId: string) => {
  setVariantGroups((prev) =>
    prev.map((g) => ({
      ...g,
      allowImages: g.id === groupId,
      // DO NOT clear entries or imagePreviews
    }))
  );
};


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
const updateVariantEntry = (
  groupId: string,
  entryId: string,
  patch: Partial<VariantEntry>
) =>
  setVariantGroups((g) =>
    g.map((gg) => {
      if (gg.id !== groupId) return gg;

      if (patch.name) {
        const normalized = patch.name.trim().toLowerCase();
        const duplicate = gg.entries.some(
          (e) =>
            e.id !== entryId &&
            e.name.trim().toLowerCase() === normalized
        );

        if (duplicate) {
          throw new Error("Duplicate variant name");
        }
      }

      return {
        ...gg,
        entries: gg.entries.map((e) =>
          e.id === entryId ? { ...e, ...patch } : e
        ),
      };
    })
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
