"use client";
import React, { useEffect, useState } from "react";
import DefaultInput from "@/src/components/input/default-input";
import CategorySelectionModal from "@/src/components/input/default-select-search";
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
import useProductDrafts from "@/src/hooks/useProductDrafts";
import DraftsModal from "@/src/components/product/addProduct/modal/draftsModal";
import { ProductDraft, ProductSku } from "@/src/types/product";
import { useMemo } from "react";

// inside AddProductPage file top imports
import { fetchMyCategories, postCategory, type Category } from "@/src/lib/api/categoryApi";
import { useCallback } from "react";
import AddCategoryModal from "@/src/components/product/addProduct/modal/categoryModel";
import ManageCategoriesModal from "@/src/components/product/addProduct/modal/manageCategory";
import VariantSkuSection from "@/src/components/product/addProduct/variantSkuSection";


/* ===========================
   Main AddProductPage
   =========================== */
export default function AddProductPage({ onSubmit }: { onSubmit?: (payload: FormData | any) => void }) {
  // --- product basics + media/state (unchanged) ---

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [hasVariants, setHasVariants] = useState(false);

  const [productImages, setProductImages] = useState<File[]>([]);
  const [productVideo, setProductVideo] = useState<File | null>(null);
  const [openManageCategories, setOpenManageCategories] = useState(false);


  const handleCategoryUpdated = (updatedRaw: any) => {
    const updated: Category = updatedRaw?.data ?? updatedRaw?.category ?? updatedRaw;

    console.debug("handleCategoryUpdated received:", updatedRaw, "normalized:", updated);

    setCategories((prev) => {
      const prevItem = prev.find((c) => c.category_id === updated.category_id);

      if (!prevItem) {
        // if not found, add to the top and select it (use id -> name)
        if (!category) setCategory(updated.category_name);
        return [updated, ...prev];
      }

      // replace existing item
      const newList = prev.map((c) => (c.category_id === updated.category_id ? updated : c));

      // if current selected value equals the old name, update selection to new name
      if (category === prevItem.category_name) {
        setCategory(updated.category_name);
      }

      return newList;
    });

    // close manage modal so user sees the refreshed selection/list
    setOpenManageCategories(false);
  };




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
  const [uploadProgress, setUploadProgress] = useState(0);

  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState(""); // store the category_name string
  const [openAddCategory, setOpenAddCategory] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);




  // after
  const [modalOptions, setModalOptions] = useState<{ allowImages?: boolean; showQuantity?: boolean; existingNames?: string[] }>({});

  /* ---- SKU / Combination state ---- */
  const [skus, setSkus] = useState<ProductSku[]>([]);
  const [useCombinations, setUseCombinations] = useState(false);

  // Sync SKUs with Variant Groups
  useEffect(() => {
    if (!hasVariants) return;

    // 1. Calculate combinations
    let newCombos: { ids: string[]; names: string[] }[] = [{ ids: [], names: [] }];
    let hasEntries = false;

    variantGroups.forEach(group => {
      if (group.entries.length === 0) return;
      hasEntries = true;
      const next: { ids: string[]; names: string[] }[] = [];
      group.entries.forEach(entry => {
        newCombos.forEach(c => {
          next.push({
            ids: [...c.ids, entry.id],
            names: [...c.names, entry.name]
          });
        });
      });
      newCombos = next;
    });

    if (!hasEntries) {
      setSkus([]);
      return;
    }

    // 2. Map to ProductSku while preserving existing values where possible
    setSkus((prev) => {
      const updated: ProductSku[] = newCombos.map(combo => {
        const comboKey = combo.ids.join("-");
        const existing = prev.find(s => s.variantOptionIds.join("-") === comboKey);

        if (existing) return existing;

        return {
          id: cryptoRandomId(),
          name: combo.names.join(" / "),
          variantOptionIds: combo.ids,
          price: (samePriceForAll ? (sharedPrice ?? "") : "") as number | "",
          quantity: "" as number | "",
          enabled: true
        };
      });
      return updated;
    });

  }, [variantGroups, hasVariants, samePriceForAll, sharedPrice]);

  // --- Drafts State ---
  const { drafts, saveDraft, deleteDraft } = useProductDrafts();
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [draftsModalOpen, setDraftsModalOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Mark as dirty when any main field changes
  useEffect(() => {
    if (title || description || category || price !== "" || quantity !== "" || productImages.length > 0 || variantGroups.length > 0 || params.length > 0) {
      setIsDirty(true);
    }
  }, [title, description, category, price, quantity, productImages, variantGroups, params]);

  // Navigation guard
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const handleSaveDraft = useCallback(async (isAuto = false) => {
    const draftData: Omit<ProductDraft, "id" | "lastSaved"> = {
      title,
      description,
      category,
      price,
      quantity,
      hasVariants,
      variantGroups,
      params,
      samePriceForAll,
      sharedPrice,
      productImages,
      productVideo,
      skus,
      useCombinations,
    };
    try {
      const id = await saveDraft(draftData, currentDraftId || undefined);
      setCurrentDraftId(id);
      setIsDirty(false);
      if (!isAuto) toast("Draft saved successfully");
    } catch (e) {
      console.error("Draft save failed", e);
      if (!isAuto) toast("Failed to save draft");
    }
  }, [title, description, category, price, quantity, hasVariants, variantGroups, params, samePriceForAll, sharedPrice, productImages, productVideo, saveDraft, currentDraftId]);

  // Auto-save every 30 seconds if dirty
  useEffect(() => {
    if (!isDirty) return;
    const timer = setTimeout(() => {
      handleSaveDraft(true);
    }, 30000);
    return () => clearTimeout(timer);
  }, [isDirty, handleSaveDraft]);

  const handleLoadDraft = (draft: ProductDraft) => {
    setTitle(draft.title || "");
    setDescription(draft.description || "");
    setCategory(draft.category || "");
    setPrice(draft.price);
    setQuantity(draft.quantity);
    setHasVariants(draft.hasVariants);

    // Regenerate blob URLs for variant images since they expire on refresh
    const restoredVariantGroups = (draft.variantGroups || []).map(group => ({
      ...group,
      entries: group.entries.map(entry => ({
        ...entry,
        imagePreviews: (entry.images || []).map(file => URL.createObjectURL(file))
      }))
    }));
    setVariantGroups(restoredVariantGroups);

    setParams(draft.params);
    setSamePriceForAll(draft.samePriceForAll);
    setSharedPrice(draft.sharedPrice);
    setProductImages(draft.productImages || []);
    setProductVideo(draft.productVideo || null);
    setSkus(draft.skus || []);
    setUseCombinations(!!draft.useCombinations);
    setCurrentDraftId(draft.id);
    setIsDirty(false);
    setDraftsModalOpen(false);
    toast("Draft loaded");
  };

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

  // helper to normalise server response -> Category[]
  const normalizeCategoryResponse = (body: any): Category[] => {
    if (!body) return [];
    if (Array.isArray(body)) return body;
    if (Array.isArray(body?.data)) return body.data;
    // sometimes the API wraps in { categories: [] } or { result: [] }
    if (Array.isArray(body?.categories)) return body.categories;
    if (Array.isArray(body?.result)) return body.result;
    // unexpected shape — return empty and log so you can inspect
    console.warn("Unexpected categories response shape:", body);
    return [];
  };

  const loadCategories = useCallback(async () => {
    try {
      setLoadingCategories(true);
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      // debug: log token presence
      console.debug("loadCategories token present:", !!token);

      const body = await fetchMyCategories(token || undefined).catch((err) => {
        console.error("fetchMyCategories error:", err);
        throw err;
      });

      // If fetchMyCategories already returns Category[], assign directly.
      // But to be defensive in case API returns wrapped payload, normalise:
      const list = Array.isArray(body) ? body : normalizeCategoryResponse(body);
      console.debug("Loaded categories:", list);
      setCategories(list);

      // If no category selected yet, pick the first one
      if (!category && list && list.length > 0) setCategory(list[0].category_name);
    } catch (err: any) {
      console.error("Failed to load categories", err);
      toast("Failed to load categories. Check console/network.");
    } finally {
      setLoadingCategories(false);
    }
  }, [category]);


  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Add category
  // when a new category is created via modal
  const handleCategoryCreated = (newCat: Category) => {
    // Add optimistically and auto-select
    setCategories((prev) => {
      // avoid duplicate
      const filtered = prev.filter((p) => p.category_id !== newCat.category_id);
      return [newCat, ...filtered];
    });
    setCategory(newCat.category_name);

    // close the modal (you call this elsewhere too)
    setOpenAddCategory(false);

    // Optionally re-fetch server list to canonicalise (uncomment if you prefer)
    // loadCategories();
  };


  // Reset Form
  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCategory("");
    setPrice("");
    setQuantity("");
    setHasVariants(false);
    setProductImages([]);
    setProductVideo(null);
    setParams([]);
    setVariantGroups([]);
    setSamePriceForAll(true);
    setSharedPrice(null);
    setSkus([]);
    setUseCombinations(false);
    setUploadProgress(0);
  };

  // Submit product
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

      let variantsPayload: any[] = [];
      if (hasVariants) {
        variantsPayload = variantGroups.map((g) => ({
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
        form.append("use_combinations", String(useCombinations));
        if (useCombinations) {
          form.append("skus", JSON.stringify(skus.filter(s => s.enabled)));
        }

        for (const g of variantGroups) {
          for (const e of g.entries) {
            (e.images || []).forEach((f) => form.append(`variant_${g.id}_${e.id}`, f));
          }
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

      setUploadProgress(0); // init
      const res = await postProduct(form, token, (percent) => {
        setUploadProgress(percent);
      });

      console.info("=== POST /api/products RESPONSE ===", res);

      // Delay slightly for UX so user sees 100% completion before overlay drops
      setTimeout(async () => {
        toast("Product saved successfully.");

        // Clear draft if it exists
        if (currentDraftId) {
          await deleteDraft(currentDraftId);
          setCurrentDraftId(null);
        }
        setIsDirty(false);

        resetForm();
        if (onSubmit) onSubmit(form);
        setSubmitting(false); // only close when fully over
      }, 500);

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
      setSubmitting(false); // End process on error
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
      useCombinations,
      skus,
    };
  };

  const CATEGORY_NAMES = categories.map((c) => c.category_name);
  // open preview
  const openPreview = () => {
    const payload = buildPreviewPayload();
    setPreviewPayload(payload);
    setPreviewOpen(true);
  };


  // ---------- render ----------
  return (
    <>
      {/* Uploading Progress Overlay */}
      {submitting && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm text-center">
            <h3 className="text-lg font-bold text-slate-800 mb-2 mt-4">Uploading Product</h3>
            <p className="text-sm text-slate-500 mb-6">Please wait while we securely upload your assets.</p>

            <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden mb-2 shadow-inner">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-in-out"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>

            <p className="font-semibold text-blue-600 mb-2">{uploadProgress}%</p>
          </div>
        </div>
      )}

      <div className="mx-auto p-4 sm:p-6 bg-slate-100">
        {/* Draft Banner */}
        {drafts.length > 0 && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
              <span className="text-sm font-medium text-red-800">
                You have {drafts.length} saved draft{drafts.length > 1 ? "s" : ""}
              </span>
            </div>
            <button
              onClick={() => setDraftsModalOpen(true)}
              className="px-4 py-1.5 bg-white border border-red-200 text-red-600 text-xs font-semibold rounded-full hover:bg-red-50 transition-colors"
            >
              View Drafts
            </button>
          </div>
        )}

        <div className="bg-white border border-slate-200 overflow-hidden">
          {/* header */}
          <div className="p-4 sm:p-6 border-b border-slate-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="lg:text-2xl text-sm font-semibold">Add product</div>
              </div>


              <div className="flex gap-2 w-full sm:w-auto">
                <button onClick={openPreview} className="px-3 py-2 rounded-full bg-slate-50 w-full sm:w-auto text-sm font-medium">Preview</button>
                <button onClick={() => handleSaveDraft()} className="px-3 py-2 rounded-full bg-slate-50 w-full sm:w-auto text-sm font-medium">Save Draft</button>

                <button onClick={handleSubmit} disabled={submitting} className="px-4 py-2 rounded-full bg-red-500 text-white w-full sm:w-auto text-sm font-medium">
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
                {/* Header + Add new */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs p-1 font-medium text-red-700"><button onClick={() => setOpenManageCategories(true)} className="">Manage</button>
                    </span>

                    <button
                      type="button"
                      onClick={() => setOpenAddCategory(true)}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      Add new
                    </button>
                  </div>

                  <CategorySelectionModal
                    key={categories.map(c => c.category_id).join('-')}
                    title={loadingCategories ? "Loading category" : "Select category"}
                    options={categories.map((c) => c.category_name)}
                    value={category}
                    onSelected={setCategory}
                    hintText={loadingCategories ? "Category loading…" : "Choose a Category"}
                    isRequired
                    triggerLabel="Category name"
                  />



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
                            allowImages={g.allowImages}
                            useCombinations={useCombinations} // ✅ Pass flag
                            samePriceForAll={samePriceForAll}
                            sharedPrice={sharedPrice}
                            onRemove={() => removeVariantEntry(g.id, e.id)}
                            onEdit={() => openEditEntryModal(g.id, e)}
                          />
                        ))}
                      </div>
                    </VariantGroupCard>
                  ))}

                  {/* SKU Management Toggle & Section */}
                  {variantGroups.length >= 1 && (
                    <div className="mt-8 border-t border-dashed border-slate-200 pt-6">
                      <label className="flex items-center gap-3 cursor-pointer group w-fit">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={useCombinations}
                            onChange={(e) => setUseCombinations(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-900">Manage Combination Pricing & Stock</span>
                          <span className="text-xs text-slate-500">Enable this to set individual prices for combos like "12GB / Black"</span>
                        </div>
                      </label>

                      {useCombinations && (
                        <VariantSkuSection
                          skus={skus}
                          setSkus={setSkus}
                          samePriceForAll={samePriceForAll}
                          sharedPrice={sharedPrice}
                        />
                      )}
                    </div>
                  )}

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
        useCombinations={useCombinations} // ✅ Pass flag
        samePriceForAll={samePriceForAll}
        sharedPrice={sharedPrice}
        allowImages={modalOptions.allowImages}
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
      <AddCategoryModal
        open={openAddCategory}
        onClose={() => setOpenAddCategory(false)}
        onCreated={(newCat: Category) => {
          handleCategoryCreated(newCat);
        }}
      />

      <ManageCategoriesModal
        open={openManageCategories}
        categories={categories}
        onClose={() => setOpenManageCategories(false)}
        onUpdated={handleCategoryUpdated}
      />

      <DraftsModal
        open={draftsModalOpen}
        drafts={drafts}
        onClose={() => setDraftsModalOpen(false)}
        onSelect={handleLoadDraft}
        onDelete={deleteDraft}
      />



    </>
  );
}
