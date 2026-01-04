"use client";
import React, { useEffect, useState } from "react";
import DefaultInput from "@/src/components/input/default-input";
import CategorySelectionModal from "@/src/components/input/default-select";
import ProductMedia from "@/src/components/product/addProduct/productMedia";
import VariantGroupCard from "@/src/components/product/addProduct/variantGroupCard";
import VariantEntryCard from "@/src/components/product/addProduct/variantEntryCard";
import useVariantGroups from "@/src/hooks/useVariantGroup";
import { cryptoRandomId } from "@/src/lib/utils/utils";
import { fetchBusinessMe, postProduct } from "@/src/lib/api/productApi";
import type { ParamKV, PreviewPayload, VariantEntry } from "@/src/types/product";
import { toast } from "sonner";
import VariantEntryModal from "@/src/components/product/addProduct/modal/variantEntryModal";
import ParamsEditor from "@/src/components/product/addProduct/paramEditor";
import ParamsModal from "@/src/components/product/addProduct/modal/paramModal";
import NumberInput from "@/src/components/input/defaultNumberInput";
import DescriptionTextarea from "@/src/components/input/defaultDescTextarea";
import PreviewModal from "@/src/components/product/addProduct/modal/previewModal";

/* ===========================
   Main AddProductPage
   =========================== */
export default function AddProductPage({ onSubmit }: { onSubmit?: (payload: FormData | any) => void }) {
  // --- product basics + media/state (unchanged) ---
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<string[]>(["Electronics", "Clothing", "Shoes"]);
  const [newCategory, setNewCategory] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [hasVariants, setHasVariants] = useState(false);

  const [productImages, setProductImages] = useState<File[]>([]);
  const [productVideo, setProductVideo] = useState<File | null>(null);

  const [params, setParams] = useState<ParamKV[]>([]);
  const {
    variantGroups,
    addVariantGroup,
    removeVariantGroup,
    updateVariantGroupTitle,
    setGroupAllowImages,
    removeVariantEntry,
    updateVariantEntry,
    setVariantGroups,
  } = useVariantGroups();

  const [samePriceForAll, setSamePriceForAll] = useState<boolean>(true);
  const [sharedPrice, setSharedPrice] = useState<number | null>(null);

  // ---------- modal / add / edit state ----------
  const [modalOpen, setModalOpen] = useState(false);
  // editing: { groupId, entry? } -> entry undefined means "add new"
  const [editing, setEditing] = useState<{ groupId: string; entry?: VariantEntry } | null>(null);

  /* ---- Param modal state ---- */
  const [paramModalOpen, setParamModalOpen] = useState(false);
  const [editingParam, setEditingParam] = useState<ParamKV | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPayload, setPreviewPayload] = useState<PreviewPayload | null>(null);
  const [submitting, setSubmitting] = useState(false);



// after
const [modalOptions, setModalOptions] = useState<{ allowImages?: boolean; showQuantity?: boolean; existingNames?: string[] }>({});

// openAddEntryModal
const openAddEntryModal = (groupId: string) => {
  setEditing({ groupId });
  const index = variantGroups.findIndex((g) => g.id === groupId);
  const showQuantity = index === 0;
  const allowImagesFlag = variantGroups[index]?.allowImages ?? false;

  const existingNames = (variantGroups[index]?.entries || [])
    .map((e) => (e.name || "").trim().toLowerCase())
    .filter(Boolean);

  setModalOptions({ allowImages: allowImagesFlag, showQuantity, existingNames });
  setModalOpen(true);
};

// openEditEntryModal
const openEditEntryModal = (groupId: string, entry: VariantEntry) => {
  const entryWithPreviews = {
    ...entry,
    imagePreviews: entry.imagePreviews || entry.images?.map((f) => URL.createObjectURL(f)) || [],
  };

  setEditing({ groupId, entry: entryWithPreviews });
  const index = variantGroups.findIndex((g) => g.id === groupId);
  const showQuantity = index === 0;
  const allowImagesFlag = variantGroups[index]?.allowImages ?? false;

  const existingNames = (variantGroups[index]?.entries || [])
    .filter((e) => e.id !== entry.id) // exclude the entry being edited
    .map((e) => (e.name || "").trim().toLowerCase())
    .filter(Boolean);

  setModalOptions({ allowImages: allowImagesFlag, showQuantity, existingNames });
  setModalOpen(true);
};

  // ---------- param handlers ----------
  // open add modal
  const openAddParam = () => {
    setEditingParam(null);
    setParamModalOpen(true);
  };

  // open edit modal for existing param
  const openEditParam = (param: ParamKV) => {
    setEditingParam(param);
    setParamModalOpen(true);
  };

  // handle submit from param modal
  const handleParamSubmit = (data: { key: string; value: string }) => {
    if (editingParam) {
      // edit existing
      updateParam(editingParam.id, data);
    } else {
      // add new
      setParams((p) => [...p, { id: cryptoRandomId(), key: data.key, value: data.value }]);
    }
    setParamModalOpen(false);
    setEditingParam(null);
    
  };

  
  // remove param
  const removeParam = (id: string) => setParams((p) => p.filter((pp) => pp.id !== id));

  // update param patch helper
  const updateParam = (id: string, patch: Partial<ParamKV>) =>
    setParams((p) => p.map((pp) => (pp.id === id ? { ...pp, ...patch } : pp)));

  // seed & sync shared price (unchanged)
  const seedAndApplySharedPrice = (nextSame: boolean) => {
    if (nextSame) {
      let seed: number | null = null;
      outer: for (const g of variantGroups) {
        for (const e of g.entries) {
          if (e.price !== null && e.price !== undefined) {
            seed = Number(e.price);
            break outer;
          }
        }
      }
      if (seed === null && price !== "") {
        const parsed = Number(price);
        if (!Number.isNaN(parsed)) seed = parsed;
      }
      setSharedPrice(seed);
      if (seed !== null) {
        setVariantGroups((s) => s.map((g) => ({ ...g, entries: g.entries.map((e) => ({ ...e, price: seed })) })));
      } else {
        setVariantGroups((s) => s.map((g) => ({ ...g, entries: g.entries.map((e) => ({ ...e, price: null })) })));
      }
    }
    setSamePriceForAll(nextSame);
  };

  useEffect(() => {
    if (!samePriceForAll) return;
    if (sharedPrice === null || sharedPrice === undefined) return;
    setVariantGroups((s) => s.map((g) => ({ ...g, entries: g.entries.map((e) => ({ ...e, price: Number(sharedPrice) })) })));
  }, [sharedPrice, samePriceForAll, setVariantGroups]);

  // When updating a group entry's images:
  const handleVariantImagesChange = (groupId: string, entryId: string, files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files).slice(0, 1);
    const previews: string[] = [];
    const validated: File[] = [];

    incoming.forEach((f) => {
      if (!f.type.startsWith("image/")) return;
      validated.push(f);
      previews.push(URL.createObjectURL(f));
    });

    // update only the targeted entry in the targeted group
    updateVariantEntry(groupId, entryId, { images: validated, imagePreviews: previews });
  };

  // Add / Edit submit handler for modal
  const handleModalSubmit = (entryData: Omit<VariantEntry, "id">) => {
    if (!editing) return;
    const { groupId, entry } = editing;

    if (entry) {
      // editing existing entry
      updateVariantEntry(groupId, entry.id, entryData);
    } else {
      // adding new entry
      setVariantGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, entries: [...g.entries, { id: cryptoRandomId(), ...entryData }] }
            : g
        )
      );
    }

    setModalOpen(false);
    setEditing(null);
  };

  // Add category
  const addCategory = () => {
    if (!newCategory.trim()) return;
    if (categories.includes(newCategory.trim())) {
      toast("Category already exists.");
      setNewCategory("");
      return;
    }
    setCategories((c) => [newCategory.trim(), ...c]);
    setCategory(newCategory.trim());
    setNewCategory("");
  };

  // Submit product (unchanged)
  const handleSubmit = async () => {
  if (!title.trim()) return toast("Please add a product name.");
  if (!category.trim()) return toast("Please choose or add a category.");

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  if (!token) {
    toast("Authentication required. Please login again.");
    return;
  }

  if (submitting) return; // guard

  setSubmitting(true);
  try {
    const form = new FormData();
    form.append("title", title);
    form.append("description", description);
    form.append("category", category);

    if (!hasVariants) {
      if (price !== "") form.append("price", String(price));
      if (quantity !== "") form.append("quantity", String(quantity));
    }

    productImages.forEach((f) => form.append("files", f));
    if (productVideo) form.append("product_video", productVideo);

  const variantsPayload = variantGroups.map((g) => ({
  id: g.id,
  title: g.title,
  entries: g.entries.map((e) => ({
    id: e.id,
    name: e.name,
    quantity: e.quantity,
    price: samePriceForAll ? sharedPrice ?? null : e.price ?? null,
    options: e.options || [], // ✅ now works without TS error
  })),
}));



    form.append("variant_meta", JSON.stringify(variantsPayload));

    for (const g of variantGroups) {
      for (const e of g.entries) {
        (e.images || []).forEach((f) => form.append(`variant_${g.id}_${e.id}`, f));
      }
    }

    form.append("params", JSON.stringify(params.map((p) => ({ key: p.key, value: p.value }))));

    const biz = await fetchBusinessMe(token);
    const businessId = biz?.data?.business?.business_id ?? biz?.data?.business_id ?? biz?.business_id;
    if (!businessId) {
      toast("business_id missing from server response.");
      setSubmitting(false);
      return;
    }
    form.append("business_id", String(businessId));

    console.info("=== PRODUCT SUBMIT PREVIEW ===", {
      title,
      category,
      variantsPayload,
      productImages: productImages.map((f) => f.name),
    });

    const res = await postProduct(form, token);
    console.info("=== POST /api/products RESPONSE ===", res);
    toast("Product saved successfully.");
    if (onSubmit) onSubmit(form);
  } catch (err: any) {
    console.error("Product submit error:", err);
    // try to show useful server message
    const serverMsg =
      err?.body?.message || err?.body?.error || (typeof err === "string" ? err : null);
    if (serverMsg) {
      toast(`Failed to save product: ${serverMsg}`);
    } else {
      toast("Failed to save product. See console.");
    }
  } finally {
    setSubmitting(false);
  }
};


  // build preview payload (sync)
const buildPreviewPayload = (): PreviewPayload => {
  // helper to map File -> { name, url }
  const mapFileForPreview = (f?: File | null) => {
    if (!f) return undefined;
    try {
      return { file: f, name: f.name, url: URL.createObjectURL(f) };
    } catch {
      return { file: f, name: f.name };
    }
  };

  const productImagesMapped = productImages.map((f) => mapFileForPreview(f) || { name: f.name });
  const productVideoMapped = productVideo ? mapFileForPreview(productVideo) : null;

  const variantGroupsMapped = variantGroups.map((g) => ({
  id: g.id,
  title: g.title,
  allowImages: g.allowImages,
  entries: g.entries.map((e) => ({
    id: e.id,
    name: e.name,
    quantity: e.quantity,
    price: samePriceForAll ? sharedPrice ?? null : e.price ?? null,
    images: (e.images || []).map((f) => mapFileForPreview(f) || { name: f.name }),
    options: e.options || [], // ✅ safe
  })),
}));


  return {
    title,
    description,
    category,
    hasVariants,
    price,
    quantity,
    samePriceForAll,
    sharedPrice,
    productImages: productImagesMapped,
    productVideo: productVideoMapped,
    variantGroups: variantGroupsMapped,
    params: params.map((p) => ({ key: p.key, value: p.value })),
    
  };
};

  // open preview
const openPreview = () => {
  const payload = buildPreviewPayload();
  setPreviewPayload(payload);
  setPreviewOpen(true);
};


  // ---------- render ----------
  return (
    <>
      <div className="mx-auto p-4 sm:p-6 bg-slate-100">
        <div className="bg-white border border-slate-200 overflow-hidden">
          {/* header */}
          <div className="p-4 sm:p-6 border-b border-slate-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="lg:text-2xl text-sm font-semibold">Add product</div>
              </div>

              
              <div className="flex gap-2 w-full sm:w-auto">
                <button onClick={openPreview} className="px-3 py-2 rounded-full bg-slate-50 w-full sm:w-auto">Preview</button>

                {/* <button onClick={() => console.info("Preview payload in console")} className="px-3 py-2 rounded-full bg-slate-50 w-full sm:w-auto">Preview</button> */}
                
                <button onClick={handleSubmit} disabled={submitting} className="px-4 py-2 rounded-full bg-red-500 text-white w-full sm:w-auto">
  {submitting ? "Saving..." : "Save product"}
</button>
{/* <button onClick={handleSubmit} className="px-4 py-2 rounded-full bg-red-500 text-white w-full sm:w-auto">Save product</button> */}
              </div>
            </div>

          </div>

          {/* body */}
          <div className="p-4 sm:p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-4">
                <DefaultInput label="Product name" value={title} onChange={setTitle} placeholder="Product name" required />
                <div>
                  <CategorySelectionModal title="Choose category" options={categories} value={category} onSelected={(v) => setCategory(v)} hintText="Choose category" isRequired triggerLabel="Category" />
                </div>

                <DescriptionTextarea
                    value={description}
                    onChange={setDescription}
                    placeholder="Write a short description about the product..."
                    maxLength={500}
                  />

                {!hasVariants && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <NumberInput label="Price" value={price} onChange={setPrice} placeholder="Product price" required />
                    <NumberInput label="Quantity" value={quantity} onChange={setQuantity} placeholder="Quantity" required />
                    </div>
                )}
              </div>

              <ProductMedia productImages={productImages} setProductImages={setProductImages} productVideo={productVideo} setProductVideo={setProductVideo} />
            </div>

            {/* Variants */}
            <div className="pt-4 border-slate-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <label className="text-sm font-medium">Variants</label>
                  <div className="text-xs text-slate-500">Add up to 2 variant groups (e.g. Color, Size). Leave empty if product has no variants.</div>
                </div>

                <div className="flex gap-2 items-center">
                  <label className="flex items-center gap-2 cursor-pointer relative">
                    <input type="checkbox" checked={hasVariants} onChange={(e) => setHasVariants(e.target.checked)} className="appearance-none w-4 h-4 rounded-full border-2 border-red-500 checked:bg-red-500 checked:border-red-500 focus:ring-2 focus:ring-red-400 relative" />
                    <span className={`absolute left-1.5 top-1.0 w-1 h-2 pointer-events-none transform rotate-45 border-r-2 border-b-2 border-white transition-all ${hasVariants ? "scale-100" : "scale-0"}`} />
                    <span className="text-sm select-none">Has variants</span>
                  </label>

                  <button onClick={addVariantGroup} disabled={variantGroups.length >= 2} className="px-3 py-1 rounded-lg text-sm bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:hover:bg-red-500">+ Add group</button>
                </div>
              </div>

              {hasVariants ? (
                <div className="mt-4 space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
  <label className="flex items-center gap-2">
    <input
      type="radio"
      name="variantPricing"
      checked={samePriceForAll}
      onChange={() => seedAndApplySharedPrice(true)}
    />
    <span className="text-sm">Same price for all variants</span>
  </label>

  <label className="flex items-center gap-2">
    <input
      type="radio"
      name="variantPricing"
      checked={!samePriceForAll}
      onChange={() => seedAndApplySharedPrice(false)}
    />
    <span className="text-sm">Different prices per variant</span>
  </label>

  {samePriceForAll && (
    <div className="mt-2 sm:mt-0 sm:ml-4">
      <label className="text-xs text-slate-500 block">Price (applies to all variants)</label>
      <input
  type="number"
  min={0} // prevents native input decrement below 0
  value={sharedPrice ?? ""}
  onChange={(e) => {
    const value = e.target.value === "" ? null : Number(e.target.value);
    // ignore negative values
    if (value !== null && value < 0) return;
    setSharedPrice(value);
  }}
  className="w-full
    rounded-xl
    border border-slate-300
    px-5
    py-2
    pr-11
    text-sm
    text-black
    caret-red-500
    outline-none
    transition
    focus:ring-1
    focus:ring-slate-200"
  placeholder="Price"
/>

    </div>
  )}
</div>


                 {variantGroups.map((g, groupIndex) => (
                  
                  <VariantGroupCard
                    key={g.id}
                       groupIndex={groupIndex} // ✅ HERE
                    group={g}
                    onUpdateTitle={updateVariantGroupTitle}
                    onSetAllowImages={setGroupAllowImages}
                    onAddEntry={openAddEntryModal}
                    onRemoveGroup={removeVariantGroup}
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {g.entries.map((e) => (
                        <VariantEntryCard
                          key={e.id}
                          entry={e}
                          samePriceForAll={samePriceForAll}
                          sharedPrice={sharedPrice}
                          allowImages={g.allowImages}
                          showQuantity={groupIndex === 0}   // ✅ THIS IS IT
                          onRemove={() => removeVariantEntry(g.id, e.id)}
                          onEdit={() => openEditEntryModal(g.id, e)}
                        />
                      ))}
                    </div>
                  </VariantGroupCard>
                ))}

                </div>
              ) : (
                <div className="mt-4 text-sm text-slate-500">Product has no variants</div>
              )}
            </div>

            {/* Params editor (inline preview + modal) */}
            <ParamsEditor
              params={params}
              onAdd={openAddParam}
              onEdit={openEditParam}
              onRemove={removeParam}
            />

            <div className="pt-4 mb-20 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex gap-2 w-full sm:w-auto">
                <button onClick={openPreview} className="px-3 py-2 rounded-full bg-slate-50 w-full sm:w-auto">Preview</button>

                {/* <button onClick={() => console.info("Preview payload in console")} className="px-3 py-2 rounded-lg bg-slate-50 w-full sm:w-auto">Preview</button> */}
                <button onClick={handleSubmit} disabled={submitting} className="px-4 py-2 rounded-full bg-red-500 text-white w-full sm:w-auto">
  {submitting ? "Saving..." : "Save product"}
</button>
{/* <button onClick={handleSubmit} className="px-4 py-2 rounded-full bg-red-500 text-white w-full sm:w-auto">Save product</button> */}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SINGLE modal instance for add / edit variant entry */}
      <VariantEntryModal
  key={editing?.groupId ?? "variant-entry-modal"} // ✅ THIS
  open={modalOpen}
  initialData={editing?.entry ?? null}
  onClose={() => {
    setModalOpen(false);
    setEditing(null);
  }}
  onSubmit={handleModalSubmit}
  samePriceForAll={samePriceForAll}
  sharedPrice={sharedPrice}
  allowImages={modalOptions.allowImages}
  showQuantity={modalOptions.showQuantity}
  existingNames={modalOptions.existingNames}
/>





      {/* PARAM modal */}
      <ParamsModal
  key={editingParam ? editingParam.id : `new-${Date.now()}`} // ✅ unique key for "add new"
  open={paramModalOpen}
  initialData={editingParam ? { key: editingParam.key, value: editingParam.value } : null}
  onClose={() => {
    setParamModalOpen(false);
    setEditingParam(null);
  }}
  onSubmit={handleParamSubmit}
/>

<PreviewModal
  open={previewOpen}
  payload={previewPayload}
  onClose={() => setPreviewOpen(false)}
  onConfirm={() => {
    // when user confirms from preview, call your existing submit flow
    handleSubmit();
  }}
/>

    </>
  );
}
