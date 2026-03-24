"use client";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams, useRouter } from "next/navigation";
import DefaultInput from "@/src/components/input/default-input";
import CategorySelectionModal from "@/src/components/input/default-select-search";
import ProductMedia from "@/src/components/product/addProduct/productMedia";
import VariantGroupCard from "@/src/components/product/addProduct/variantGroupCard";
import VariantEntryCard from "@/src/components/product/addProduct/variantEntryCard";
import useVariantGroups from "@/src/hooks/useVariantGroup";
import { cryptoRandomId } from "@/src/lib/utils/utils";
import { fetchBusinessMe, postProduct } from "@/src/lib/api/productApi";
import type { ParamKV, PreviewPayload, VariantEntry, ProductSku, ProductDraft } from "@/src/types/product";
import { toast } from "sonner";
import VariantEntryModal from "@/src/components/product/addProduct/modal/variantEntryModal";
import ParamsEditor from "@/src/components/product/addProduct/paramEditor";
import ParamsModal from "@/src/components/product/addProduct/modal/paramModal";
import NumberInput from "@/src/components/input/defaultNumberInput";
import DescriptionTextarea from "@/src/components/input/defaultDescTextarea";
import PreviewModal from "@/src/components/product/addProduct/modal/previewModal";
import useProductDrafts from "@/src/hooks/useProductDrafts";
import DraftsModal from "@/src/components/product/addProduct/modal/draftsModal";
import { BusinessPolicy } from "@/src/types/business";
import { fetchMyCategories, postCategory, type Category } from "@/src/lib/api/categoryApi";
import AddCategoryModal from "@/src/components/product/addProduct/modal/categoryModel";
import ManageCategoriesModal from "@/src/components/product/addProduct/modal/manageCategory";
import VariantSkuSection from "@/src/components/product/addProduct/variantSkuSection";
import ProductPolicySettings from "@/src/components/product/addProduct/productPolicySettings";
import { ArrowLeft, ChevronLeft, Eye, Save, Globe, Package, Settings, ShieldCheck, Tag, Info, ChevronRight } from "lucide-react";


/* ===========================
   Main AddProductPage
   =========================== */
export default function AddProductPage({ onSubmit }: { onSubmit?: (payload: FormData | any) => void }) {
  const router = useRouter();
  // --- product basics + media/state (unchanged) ---

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [hasVariants, setHasVariants] = useState(false);

  const [productImages, setProductImages] = useState<(File | string)[]>([]);
  const [productVideo, setProductVideo] = useState<File | string | null>(null);
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
    // Auto-disable combinations if groups < 2
    if (useCombinations && variantGroups.length < 2) {
      setUseCombinations(false);
      toast("Advanced Combination Logic disabled: Requires at least 2 variant groups.");
    }

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

        if (existing) {
          return existing;
        }

        return {
          id: cryptoRandomId(),
          name: combo.names.join(" / "),
          variantOptionIds: combo.ids,
          price: "" as number | "",
          quantity: "" as number | "",
          enabled: true
        };
      });
      return updated;
    });
  }, [variantGroups, hasVariants, samePriceForAll, sharedPrice]);

  /* ---- Policy States ---- */
  const [useStoreDefaultReturn, setUseStoreDefaultReturn] = useState(true);
  const [returnPolicy, setReturnPolicy] = useState({
    returnShippingSubsidy: false,
    sevenDayNoReasonReturn: true,
    rapidRefund: false,
    returnWindow: 3,
  });

  const [useStoreDefaultShipping, setUseStoreDefaultShipping] = useState(true);
  const [shippingPolicy, setShippingPolicy] = useState({
    avgDuration: 24,
    avgUnit: "hours",
    promiseDuration: 48,
    promiseUnit: "hours",
    radiusKm: 50,
  });

  const [useStoreDefaultPromotions, setUseStoreDefaultPromotions] = useState(true);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [saleDiscount, setSaleDiscount] = useState<any>({ type: "", discount: 0 });

  /* ---- Store Defaults / Policy Fetching ---- */
  const [storePolicy, setStorePolicy] = useState<BusinessPolicy | null>(null);

  const loadBusinessSettings = useCallback(async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) return;
    try {
      const biz = await fetchBusinessMe(token);
      const policyResponse = biz?.data?.policy ?? biz?.policy;
      if (policyResponse) {
        setStorePolicy(policyResponse);
      }
    } catch (e) {
      console.error("Failed to load business settings", e);
    }
  }, []);

  useEffect(() => {
    loadBusinessSettings();
  }, [loadBusinessSettings]);

  // UseStoreDefault Sync: Return Policy
  useEffect(() => {
    if (useStoreDefaultReturn && storePolicy?.returns) {
      setReturnPolicy({
        returnShippingSubsidy: !!storePolicy.returns.return_shipping_subsidy,
        sevenDayNoReasonReturn: !!storePolicy.returns.seven_day_no_reason,
        rapidRefund: !!storePolicy.returns.rapid_refund,
        returnWindow: 3,
      });
    }
  }, [useStoreDefaultReturn, storePolicy]);

  // UseStoreDefault Sync: Shipping Policy
  useEffect(() => {
    if (useStoreDefaultShipping && storePolicy?.shipping) {
      const avg = storePolicy.shipping.find(s => s.kind === "avg");
      const promise = storePolicy.shipping.find(s => s.kind === "promise");
      setShippingPolicy({
        avgDuration: avg?.value ?? 24,
        avgUnit: avg?.unit ?? "hours",
        promiseDuration: promise?.value ?? 48,
        promiseUnit: promise?.unit ?? "hours",
        radiusKm: 50,
      });
    }
  }, [useStoreDefaultShipping, storePolicy]);

  // UseStoreDefault Sync: Promotions
  useEffect(() => {
    if (useStoreDefaultPromotions && storePolicy) {
      if (storePolicy.promotions && storePolicy.promotions.length > 0) {
        setPromotions(storePolicy.promotions.map(p => ({
          occasion: p.title,
          discount: Number(p.discount_percent),
          isActive: true,
          start: p.start_date,
          end: p.end_date
        })));
      } else {
        setPromotions([]);
      }

      if (storePolicy.sales_discounts && storePolicy.sales_discounts.length > 0) {
        setSaleDiscount({
          type: storePolicy.sales_discounts[0].discount_type,
          discount: Number(storePolicy.sales_discounts[0].discount_percent)
        });
      } else {
        setSaleDiscount({ type: "", discount: 0 });
      }
    }
  }, [useStoreDefaultPromotions, storePolicy]);

  // --- Drafts State ---
  const { drafts, saveDraft, deleteDraft } = useProductDrafts();
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [draftsModalOpen, setDraftsModalOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Mark as dirty when any main field changes (except only category)
  useEffect(() => {
    if (title || description || price !== "" || quantity !== "" || productImages.length > 0 || variantGroups.length > 0 || params.length > 0) {
      setIsDirty(true);
    }
  }, [title, description, price, quantity, productImages, variantGroups, params]);

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
      policyOverrides: {
        useStoreDefaultReturn,
        returnPolicy,
        useStoreDefaultShipping,
        shippingPolicy,
        useStoreDefaultPromotions,
        promotions,
        saleDiscount,
      },
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
        imagePreviews: (entry.images || []).map(file => (typeof file === "string" ? file : URL.createObjectURL(file)))
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

    // Load Policy Overrides if they exist
    if (draft.policyOverrides) {
      setUseStoreDefaultReturn(draft.policyOverrides.useStoreDefaultReturn);
      setReturnPolicy(draft.policyOverrides.returnPolicy);
      setUseStoreDefaultShipping(draft.policyOverrides.useStoreDefaultShipping);
      setShippingPolicy(draft.policyOverrides.shippingPolicy);
      setUseStoreDefaultPromotions(draft.policyOverrides.useStoreDefaultPromotions);
      setPromotions(draft.policyOverrides.promotions);
      setSaleDiscount(draft.policyOverrides.saleDiscount);
    }

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
      imagePreviews: entry.imagePreviews || entry.images?.map((f) => (typeof f === "string" ? f : URL.createObjectURL(f))) || [],
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
    }
    setSamePriceForAll(nextSame);
  };

  useEffect(() => {
    if (!samePriceForAll) return;
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
    if (title.trim().length < 3) return toast("Product name must be at least 3 characters.");
    if (!category.trim()) return toast("Please choose or add a category.");
    if (productImages.length === 0) return toast("Please upload at least one product image.");

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      toast("Authentication required. Please login again.");
      return;
    }

    // --- Price & Stock Validation ---
    if (!hasVariants) {
      if (!price || Number(price) < 100) return toast("Product price must be at least 100 Naira.");
      if (!quantity && quantity !== 0) return toast("Please set the product stock quantity.");
    } else {
      // --- Variant Structure Validation ---
      if (variantGroups.length === 0) return toast("Please add at least one variant group (e.g. 'Size' or 'Color').");
      for (const g of variantGroups) {
        if (!g.title.trim()) return toast("Please provide a title for all variant groups.");
        if (g.entries.length === 0) return toast(`Please add at least one option to the group: ${g.title}`);
      }

      if (samePriceForAll) {
        if (!sharedPrice || Number(sharedPrice) < 100) {
          return toast("Shared price for variants must be at least 100 Naira.");
        }
      }

      // If combinations are used, check SKU stock
      if (useCombinations) {
        const enabledSkus = skus.filter(s => s.enabled);
        if (enabledSkus.length === 0) return toast("Please enable at least one variant combination.");

        for (const s of enabledSkus) {
          if (!s.quantity && s.quantity !== 0) {
            return toast(`Please set stock for: ${s.name}`);
          }
          if (!samePriceForAll && (!s.price || Number(s.price) < 100)) {
            return toast(`Price for: ${s.name} must be at least 100 Naira.`);
          }
        }
      } else {
        // Simple variant validation
        for (const g of variantGroups) {
          for (const e of g.entries) {
            if (!e.quantity && e.quantity !== 0) {
              return toast(`Please set stock for: ${e.name}`);
            }
            if (!samePriceForAll && (!e.price || Number(e.price) < 100)) {
              return toast(`Price for: ${e.name} must be at least 100 Naira.`);
            }
          }
        }
      }
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

      productImages.forEach((f) => {
        if (typeof f !== "string") form.append("files", f);
      });
      if (productVideo && typeof productVideo !== "string") form.append("product_video", productVideo);

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
          const skusPayload = skus.filter(s => s.enabled).map(s => ({
            ...s,
            price: samePriceForAll ? (sharedPrice ?? s.price) : s.price
          }));
          form.append("skus", JSON.stringify(skusPayload));
        }

        for (const g of variantGroups) {
          for (const e of g.entries) {
            (e.images || []).forEach((f) => form.append(`variant_${g.id}_${e.id}`, f));
          }
        }
      }

      form.append("params", JSON.stringify(params.map((p) => ({ key: p.key, value: p.value }))));

      // Append Policy Overrides
      const policyData = {
        useStoreDefaultReturn: useStoreDefaultReturn,
        returnPolicy: returnPolicy,
        useStoreDefaultShipping: useStoreDefaultShipping,
        shippingPolicy: shippingPolicy,
        useStoreDefaultPromotions: useStoreDefaultPromotions,
        promotions: promotions,
        saleDiscount: saleDiscount,
      };
      form.append("policy_overrides", JSON.stringify(policyData));

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
        productImages: productImages.map((f) => (typeof f === "string" ? f : (f as File).name)),
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
        
        // Redirect to inventory
        router.push("/profile/business/inventory");
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
    const mapFileForPreview = (f?: File | string | null) => {
      if (!f) return undefined;
      // If it's already a URL string, extract filename or use default
      if (typeof f === "string") {
        return { url: f, name: f.split("/").pop() || "image" };
      }
      // If it's a File object
      try {
        return { file: f, name: (f as File).name, url: URL.createObjectURL(f as File) };
      } catch (err) {
        console.error("Preview creation failed:", err);
        return { file: f as File, name: (f as File).name || "file" };
      }
    };

    const productImagesMapped = productImages.map((f) => mapFileForPreview(f) || { name: typeof f === "string" ? f : (f as File).name });
    const productVideoMapped = productVideo ? mapFileForPreview(productVideo) : null;

    const variantGroupsMapped = variantGroups.map((g) => ({
      id: g.id,
      title: g.title,
      allowImages: g.allowImages,
      entries: g.entries.map((e) => ({
        id: e.id,
        name: e.name,
        quantity: e.quantity as number | "" | undefined,
        price: e.price as number | null | undefined,
        images: (e.images || []).map(img => mapFileForPreview(img)).filter(Boolean) as any
      }))
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
      useCombinations: useCombinations,
      skus,
      policyOverrides: {
        useStoreDefaultReturn,
        returnPolicy,
        useStoreDefaultShipping,
        shippingPolicy,
        useStoreDefaultPromotions,
        promotions,
        saleDiscount,
      },
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
    <div className="bg-slate-100 min-h-screen">
      {/* Uploading Progress Overlay */}
      {submitting && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center">
            <Globe className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-pulse" />
            <h3 className="text-xl font-bold text-slate-800 mb-2">Publishing Product</h3>
            <p className="text-sm text-slate-500 mb-6 font-medium">Securing your assets and updating shop catalog...</p>

            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-blue-500 transition-all duration-300 ease-in-out"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="font-bold text-blue-600 text-lg">{uploadProgress}%</p>
          </div>
        </div>
      )}

      {/* Top Sticky Header */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-700 active:scale-95"
            >
              <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
            </button>
            <div className="flex flex-col">
              <h4 className="text-sm font-bold text-slate-900 truncate max-w-[200px] sm:max-w-md">
                Add New Product
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={openPreview}
              className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-full transition-all"
            >
              <Eye className="w-4 h-4" /> Preview
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-full text-sm font-bold shadow-lg shadow-red-200 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {submitting ? "Publishing..." : "Publish Product"}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto p-4 sm:p-6 pb-24 space-y-6">
        {/* Draft Banner */}
        {drafts.length > 0 && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-[0.3px] flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </div>
              <span className="text-sm font-bold text-red-900">
                You have {drafts.length} saved draft{drafts.length > 1 ? "s" : ""}
              </span>
            </div>
            <button
              onClick={() => setDraftsModalOpen(true)}
              className="px-5 py-2 bg-white border border-red-200 text-red-600 text-xs font-bold rounded-full hover:bg-red-50 shadow-sm transition-all active:scale-95"
            >
              Restore Draft
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form Column (Desktop: Left, Mobile: Middle) */}
          <div className="lg:col-span-2 lg:row-span-2 order-2 lg:order-1 space-y-6">

            {/* 1. Basic Information */}
            <div className="bg-white border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-800">Basic Information</h2>
              </div>
              <div className="p-6 space-y-5">
                <DefaultInput
                  label="Product Name"
                  value={title}
                  onChange={setTitle}
                  placeholder="e.g. Vintage Leather Satchel"
                  required
                />

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs p-1 font-medium text-red-700">
                      <button onClick={() => setOpenManageCategories(true)} className="hover:underline">Manage</button>
                    </span>
                    <button
                      type="button"
                      onClick={() => setOpenAddCategory(true)}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      + Add new category
                    </button>
                  </div>
                  <CategorySelectionModal
                    key={categories.map(c => c.category_id).join('-')}
                    title={loadingCategories ? "Loading..." : "Select category"}
                    options={categories.map((c) => c.category_name)}
                    value={category}
                    onSelected={setCategory}
                    isRequired
                    triggerLabel="Product Category"
                  />
                </div>

                <DescriptionTextarea
                  value={description}
                  onChange={setDescription}
                  placeholder="Describe your product in detail..."
                  maxLength={1000}
                />
              </div>
            </div>

            {/* 2. Pricing & Stock (Simple Product only) */}
            {!hasVariants && (
              <div className="bg-white border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                  <div className="p-1.5 bg-green-100 rounded-lg text-green-600">
                    <Tag className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm font-bold text-slate-800">Pricing & Inventory</h2>
                </div>
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <NumberInput label="Retail Price (NGN)" value={price} onChange={setPrice} placeholder="0.00" required />
                    <p className="text-[10px] text-slate-400 font-medium italic">Base price for customers</p>
                  </div>
                  <div className="space-y-1.5">
                    <NumberInput label="Initial Stock Quantity" value={quantity} onChange={setQuantity} placeholder="0" required />
                    <p className="text-[10px] text-slate-400 font-medium italic">Available units in hand</p>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Variant Management */}
            <div className="bg-white border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-800">Variations</h2>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer relative">
                    <input
                      type="checkbox"
                      checked={hasVariants}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setHasVariants(checked);
                        if (checked && variantGroups.length === 0) {
                          addVariantGroup();
                        }
                      }}
                      className="appearance-none w-4 h-4 rounded-full border-2 border-red-500 checked:bg-red-500 checked:border-red-500 focus:ring-2 focus:ring-red-400 relative"
                    />
                    <span className={`absolute left-1.5 top-1.0 w-1 h-2 pointer-events-none transform rotate-45 border-r-2 border-b-2 border-white transition-all ${hasVariants ? "scale-100" : "scale-0"}`} />
                    <span className="text-sm font-bold text-slate-700 select-none">Has variants</span>
                  </label>

                  {hasVariants && (
                    <button
                      onClick={addVariantGroup}
                      disabled={variantGroups.length >= 2}
                      className="px-4 py-1.5 rounded-full text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-30 transition-all shadow-md"
                    >
                      + Add Group
                    </button>
                  )}
                </div>
              </div>

              {hasVariants ? (
                <div className="p-6 space-y-8">
                  {/* Pricing Strategy */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-4 bg-slate-50 rounded-[0.5px] border border-slate-100">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-900 mb-1">Pricing Strategy</span>
                      <span className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">Shared vs Individual</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white p-1 rounded-full border border-slate-200">
                      <button
                        onClick={() => seedAndApplySharedPrice(true)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${samePriceForAll ? "bg-red-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                      >
                        Single Price
                      </button>
                      <button
                        onClick={() => seedAndApplySharedPrice(false)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${!samePriceForAll ? "bg-red-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                      >
                        Different prices
                      </button>
                    </div>
                    {samePriceForAll && (
                      <div className="flex-1 max-w-[150px]">
                        <input
                          type="number"
                          value={sharedPrice ?? ""}
                          onChange={(e) => setSharedPrice(e.target.value === "" ? null : Number(e.target.value))}
                          className="w-full bg-white rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-900 focus:ring-1 focus:ring-red-100 outline-none"
                          placeholder="Shared Price"
                        />
                      </div>
                    )}
                  </div>

                  {variantGroups.map((g, idx) => (
                    <VariantGroupCard
                      key={g.id}
                      groupIndex={idx}
                      group={g}
                      onUpdateTitle={updateVariantGroupTitle}
                      onSetAllowImages={setGroupAllowImages}
                      onAddEntry={openAddEntryModal}
                      onRemoveGroup={removeVariantGroup}
                    >
                      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                        {g.entries.map((e) => (
                          <VariantEntryCard
                            key={e.id}
                            entry={e}
                            allowImages={g.allowImages}
                            useCombinations={useCombinations}
                            samePriceForAll={samePriceForAll}
                            sharedPrice={sharedPrice}
                            onRemove={() => removeVariantEntry(g.id, e.id)}
                            onEdit={() => openEditEntryModal(g.id, e)}
                          />
                        ))}
                      </div>
                    </VariantGroupCard>
                  ))}

                  {/* Combo Toggle */}
                  <div className="pt-6 border-t border-dashed border-slate-200">
                    <label className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-all duration-200">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={useCombinations}
                            onChange={(e) => {
                              if (e.target.checked && variantGroups.length < 2) {
                                toast.info("Add more variant groups (e.g. Size and Color) to use advanced combination logic.");
                                return;
                              }
                              setUseCombinations(e.target.checked);
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-12 h-6 bg-slate-200 rounded-full peer peer-checked:bg-red-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-6"></div>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-800 tracking-tight">Advanced Combination Logic</span>
                          <span className="text-[10px] font-medium text-slate-500 tracking-widest uppercase">Pricing & Stock per combo</span>
                        </div>
                      </div>
                    </label>

                    {useCombinations && (
                      <div className="mt-6 pb-4">
                        <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 shadow-sm">
                          <Info className="w-4 h-4 shrink-0" />
                          <p className="text-[10px] font-bold leading-tight">Quantities specified here will be your initial stock distribution.</p>
                        </div>
                        <VariantSkuSection
                          skus={skus}
                          setSkus={setSkus}
                          samePriceForAll={samePriceForAll}
                          sharedPrice={sharedPrice}
                          variantGroups={variantGroups}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center bg-slate-50/30">
                  <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-500">Standard Simple Product</p>
                  <p className="text-xs text-slate-400 mt-1">Enable "Has variants" to add multiple sizes or colors.</p>
                </div>
              )}
            </div>

            {/* 4. Specifications */}
            <div className="bg-white border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-purple-100 rounded-lg text-purple-600">
                    <Globe className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm font-bold text-slate-800">Specifications & Parameters</h2>
                </div>
                <button
                  onClick={openAddParam}
                  className="text-xs font-bold text-purple-600 hover:text-purple-700 uppercase tracking-tighter transition-colors"
                >
                  + Add parameters
                </button>
              </div>
              <div className="p-6">
                <ParamsEditor
                  params={params}
                  onAdd={openAddParam}
                  onEdit={openEditParam}
                  onRemove={removeParam}
                />
              </div>
            </div>

            {/* 5. Policies */}
            <div className="bg-white border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                <div className="p-1.5 bg-orange-100 rounded-lg text-orange-600">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-800">Business Policies</h2>
              </div>
              <div className="p-6">
                <ProductPolicySettings
                  useStoreDefaultReturn={useStoreDefaultReturn}
                  setUseStoreDefaultReturn={setUseStoreDefaultReturn}
                  returnPolicy={returnPolicy}
                  setReturnPolicy={setReturnPolicy}
                  useStoreDefaultShipping={useStoreDefaultShipping}
                  setUseStoreDefaultShipping={setUseStoreDefaultShipping}
                  shippingPolicy={shippingPolicy}
                  setShippingPolicy={setShippingPolicy}
                  useStoreDefaultPromotions={useStoreDefaultPromotions}
                  setUseStoreDefaultPromotions={setUseStoreDefaultPromotions}
                  promotions={promotions}
                  setPromotions={setPromotions}
                  saleDiscount={saleDiscount}
                  setSaleDiscount={setSaleDiscount}
                />
              </div>
            </div>
          </div>

          {/* Right Column Slot 1 - Media (Desktop: Right-Top, Mobile: Top) */}
          <div className="lg:col-span-1 order-1 lg:order-2">
            <div className="sticky top-24 space-y-6">
              <div className="bg-white border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-slate-400" />
                    <h2 className="text-sm font-bold text-slate-800">Product Assets</h2>
                  </div>
                  {!hasVariants && <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Required</span>}
                </div>
                <div className="p-4">
                  <ProductMedia
                    productImages={productImages}
                    setProductImages={setProductImages as any}
                    productVideo={productVideo}
                    setProductVideo={setProductVideo as any}
                  />
                  <div className="mt-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                    <p className="text-[11px] font-bold text-blue-700 flex items-center gap-2 uppercase tracking-tight">
                      <Tag className="w-3 h-3" /> Retail Pro Tip:
                    </p>
                    <p className="text-[10px] text-blue-600 font-medium leading-relaxed mt-1.5">
                      Ensure your product lighting is clear. High-definition images with multiple angles increase sales by up to 40%.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column Slot 2 - Quick Actions (Desktop: Right-Bottom, Mobile: Bottom) */}
          <div className="lg:col-span-1 order-3 lg:order-3">
            <div className="lg:sticky lg:top-[500px] p-6 bg-slate-900 rounded-2xl shadow-lg text-white">
              <h3 className="text-sm font-bold mb-1">Ready to Publish?</h3>
              <p className="text-[10px] text-slate-400 mb-6">Review your specifications and variants before going live.</p>
              <div className="space-y-3">
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full py-3 bg-red-500 hover:bg-red-600 rounded-xl text-xs font-bold transition-all shadow-lg shadow-red-900/40 active:scale-95 disabled:opacity-50"
                >
                  {submitting ? "Publishing..." : "Confirm & Publish"}
                </button>
                <button
                  onClick={() => handleSaveDraft()}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95"
                >
                  Save as Draft
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <VariantEntryModal
        key={editing?.groupId ?? "variant-entry-modal"}
        open={modalOpen}
        initialData={editing?.entry ?? null}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSubmit={handleModalSubmit}
        useCombinations={useCombinations}
        samePriceForAll={samePriceForAll}
        sharedPrice={sharedPrice}
        allowImages={modalOptions.allowImages}
        existingNames={modalOptions.existingNames}
      />

      <AnimatePresence>
        {paramModalOpen && (
          <ParamsModal
            key={editingParam ? editingParam.id : `new-param`}
            open={paramModalOpen}
            initialData={editingParam ? { key: editingParam.key, value: editingParam.value } : null}
            onClose={() => {
              setParamModalOpen(false);
              setEditingParam(null);
            }}
            onSubmit={handleParamSubmit}
          />
        )}
      </AnimatePresence>

      <PreviewModal
        open={previewOpen}
        payload={previewPayload}
        onClose={() => setPreviewOpen(false)}
        onConfirm={() => handleSubmit()}
      />

      <AddCategoryModal
        open={openAddCategory}
        onClose={() => setOpenAddCategory(false)}
        onCreated={handleCategoryCreated}
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
    </div>
  );
}
