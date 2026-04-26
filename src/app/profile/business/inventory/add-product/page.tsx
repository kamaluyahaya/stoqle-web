"use client";
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
import { ArrowLeft, ChevronLeft, Eye, Save, Globe, Package, Settings, ShieldCheck, Tag, Info, ChevronRight, X } from "lucide-react";
import { useAuth } from "@/src/context/authContext";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import AddProductWalkthrough from "@/src/components/business/inventory/AddProductWalkthrough";
import { VendorBotModal } from "@/src/components/modal/VendorBotModal";
import { Sparkles } from "lucide-react";


/* ===========================
   Main AddProductPage
   =========================== */
export default function AddProductPage({ onSubmit }: { onSubmit?: (payload: FormData | any) => void }) {
  const router = useRouter();
  const auth = useAuth();
  // --- product basics + media/state (unchanged) ---

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [hasVariants, setHasVariants] = useState(false);
  const [productType, setProductType] = useState<'simple' | 'variant' | null>(null);

  // Sync productType with hasVariants when loaded from draft or changed
  useEffect(() => {
    if (hasVariants) {
      setProductType('variant');
    } else if (price !== "" || quantity !== "") {
      setProductType('simple');
    }
  }, [hasVariants]); // don't add price/quantity to deps to avoid loops, just run once on mount/load

  const [productImages, setProductImages] = useState<(File | string)[]>([]);
  const [productVideo, setProductVideo] = useState<File | string | null>(null);
  const [videoThumbnail, setVideoThumbnail] = useState<Blob | null>(null);
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimmingProgress, setTrimmingProgress] = useState(0);
  const ffmpegRef = useRef<any>(null);

  const [businessName, setBusinessName] = useState("");
  const [businessLogo, setBusinessLogo] = useState("");

  const loadFFmpeg = async () => {
    if (ffmpegRef.current) return ffmpegRef.current;
    const ffmpeg = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    ffmpegRef.current = ffmpeg;
    return ffmpeg;
  };

  const handleVideoProcess = async (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    const tempVideo = document.createElement("video");
    tempVideo.preload = "metadata";

    tempVideo.onloadedmetadata = () => {
      tempVideo.currentTime = 2.5; // Grab thumbnail at 2.5s
    };

    let thumbnailCaptured = false;
    tempVideo.onseeked = async () => {
      if (thumbnailCaptured) return;
      thumbnailCaptured = true;

      // 1. Capture Thumbnail
      const canvas = document.createElement("canvas");
      canvas.width = tempVideo.videoWidth;
      canvas.height = tempVideo.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) setVideoThumbnail(blob);
        }, "image/jpeg", 0.8);
      }

      const duration = tempVideo.duration;
      // 2. Perform Trimming if > 90 seconds
      if (duration > 90) {
        setIsTrimming(true);
        setTrimmingProgress(10);
        try {
          const ffmpeg = await loadFFmpeg();
          setTrimmingProgress(30);
          const inputName = 'input.mp4';
          const outputName = 'output.mp4';
          await ffmpeg.writeFile(inputName, await fetchFile(file));
          setTrimmingProgress(50);
          // 1 minute 30 seconds = 90
          await ffmpeg.exec(['-i', inputName, '-t', '90', '-c', 'copy', outputName]);
          setTrimmingProgress(80);
          const data = await ffmpeg.readFile(outputName);
          const trimmedBlob = new Blob([(data as any).buffer], { type: 'video/mp4' });
          const trimmedFile = new File([trimmedBlob], "trimmed_product.mp4", { type: 'video/mp4' });
          setProductVideo(trimmedFile);
          toast.success("Video optimized and trimmed to 1:30!");
          await ffmpeg.deleteFile(inputName);
          await ffmpeg.deleteFile(outputName);
        } catch (err) {
          console.error("FFmpeg error:", err);
          toast.error("Trimming failed, using original video.");
          setProductVideo(file);
        } finally {
          setIsTrimming(false);
          setTrimmingProgress(100);
          URL.revokeObjectURL(objectUrl);
        }
      } else {
        setProductVideo(file);
        URL.revokeObjectURL(objectUrl);
      }
    };

    tempVideo.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      toast.error("Could not process video file.");
    };

    tempVideo.src = objectUrl;
  };

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
    lateShipmentCompensation: false,
    fakeOnePayFour: false,
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
      const bizData = biz?.data?.business ?? biz?.business ?? biz;
      if (bizData) {
        setBusinessName(bizData.business_name || bizData.name || "Vendor");
        setBusinessLogo(bizData.logo || bizData.business_logo || "");
      }
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
        lateShipmentCompensation: !!storePolicy.returns.late_shipment,
        fakeOnePayFour: !!storePolicy.returns.fake_one_pay_four,
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
  const [vendorBotOpen, setVendorBotOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Mark as dirty when any main field changes (including video/thumbnail)
  useEffect(() => {
    if (title || description || price !== "" || quantity !== "" || productImages.length > 0 || productVideo || videoThumbnail || variantGroups.length > 0 || params.length > 0) {
      setIsDirty(true);
    }
  }, [title, description, price, quantity, productImages, productVideo, videoThumbnail, variantGroups, params]);

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
      lastAutoSave: isAuto ? new Date().toISOString() : undefined,
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

    // Ensure we have a placeholder title for nameless drafts
    if (!draftData.title || draftData.title.trim() === "") {
      draftData.title = `Untitled Draft (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
    }
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

  const handleLoadDraft = (draft: ProductDraft) => {
    setTitle(draft.title || "");
    setDescription(draft.description || "");
    setCategory(draft.category || "");
    setPrice(draft.price);
    setQuantity(draft.quantity);
    setHasVariants(draft.hasVariants);
    setProductType(draft.hasVariants ? 'variant' : (draft.price !== "" || draft.quantity !== "" ? 'simple' : null));

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
    if (!productType) return toast("Please select a Product Type (Simple or Variant).");
    if (productImages.length === 0) return toast("Please upload at least one product image.");

    const ok = await auth.ensureAccountVerified();
    if (!ok) return;

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
      form.append("status", "active");

      if (!hasVariants) {
        if (price !== "") form.append("price", String(price));
        if (quantity !== "") form.append("quantity", String(quantity));
      }

      productImages.forEach((f) => {
        if (typeof f !== "string") form.append("files", f);
      });
      if (productVideo && typeof productVideo !== "string") {
        form.append("product_video", productVideo);
        if (videoThumbnail) {
          form.append("files", new File([videoThumbnail], "video_thumb.jpg", { type: "image/jpeg" }));
        }
      }

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
      <div className="sticky top-0 lg:top-16 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 pt-[env(safe-area-inset-top,12px)]">
        <div className="px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className=" lg:hidden hover:bg-slate-100 rounded-full transition-colors text-slate-700 active:scale-95"
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
              onClick={() => setVendorBotOpen(true)}
              className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-full transition-all"
              title="Vendor Assistant AI"
            >
              <Sparkles className="w-4 h-4" /> AI Assistant
            </button>
            <button
              onClick={openPreview}
              className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-full transition-all"
            >
              <Eye className="w-4 h-4" /> Preview
            </button>

            {/* Save as Draft (Top Navbar on mobile) */}
            <button
              onClick={() => handleSaveDraft()}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-full transition-all sm:hidden"
            >
              Save as Draft
            </button>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="hidden sm:flex items-center gap-2 px-6 py-2 bg-rose-500 hover:bg-rose-700 text-white rounded-full text-sm font-bold shadow-md shadow-rose-200 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? "Publishing..." : "Publish Product"}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto p-4 sm:p-6 pb-24 space-y-6">
        {/* Draft Banner */}
        {drafts.length > 0 && (
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-[0.3px] flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </div>
              <span className="text-sm font-bold text-rose-900">
                You have {drafts.length} saved draft{drafts.length > 1 ? "s" : ""}
              </span>
            </div>
            <button
              onClick={() => setDraftsModalOpen(true)}
              className="px-5 py-2 bg-white border border-rose-200 text-rose-500 text-xs font-bold rounded-full hover:bg-rose-50 shadow-sm transition-all active:scale-95"
            >
              Restore Draft
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form Column (Desktop: Left, Mobile: Middle) */}
          <div className="lg:col-span-2 lg:row-span-2 order-2 lg:order-1 space-y-6">

            {/* 1. Basic Information */}
            <div id="ap-guide-info" className="bg-white border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-800">Product Info.</h2>
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
                    <span className="text-xs p-1 font-medium text-rose-700">
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

            {/* 1.5 Product Type Selection */}
            <div id="ap-guide-type" className="bg-white overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                <Tag className="w-4 h-4 text-slate-400" />
                <h2 className="text-sm font-bold text-slate-800">Product Type</h2>
              </div>
              <div className="p-6 grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setProductType('simple');
                    setHasVariants(false);
                  }}
                  className={`p-4 rounded-xl border-[0.5px] transition-all flex flex-col items-center gap-2 ${productType === 'simple' ? "border-rose-500 bg-rose-50 text-rose-700 " : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-300"}`}
                >
                  <span className="text-sm  tracking-tight">Simple Product</span>
                  <p className="text-[10px] font-medium text-center opacity-70">Single price and fixed stock quantity</p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setProductType('variant');
                    setHasVariants(true);
                    if (variantGroups.length === 0) addVariantGroup();
                  }}
                  className={`p-4 rounded-xl border-[0.5px] transition-all flex flex-col items-center gap-2 ${productType === 'variant' ? "border-rose-500 bg-rose-50 text-rose-700 " : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-300"}`}
                >
                  <span className="text-sm  tracking-tight">Variant Product</span>
                  <p className="text-[10px] font-medium text-center opacity-70">Multiple sizes, colors or options</p>
                </button>
              </div>
            </div>

            {/* 2. Pricing & Stock (Simple Product only) */}
            <AnimatePresence>
              {productType === 'simple' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white border border-slate-200 overflow-hidden shadow-sm"
                >
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
                </motion.div>
              )}
            </AnimatePresence>

            {/* 3. Variant Management */}
            <AnimatePresence>
              {productType === 'variant' && (
                <motion.div
                  id="ap-guide-variants"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white border border-slate-200 overflow-hidden shadow-sm"
                >
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-slate-800">Variations</h2>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={addVariantGroup}
                        disabled={variantGroups.length >= 2}
                        className="px-4 py-1.5 rounded-full text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-30 transition-all shadow-md"
                      >
                        + Add Group
                      </button>
                    </div>
                  </div>

                  <div className="p-6 space-y-8">
                    {/* Pricing Strategy */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-4 bg-slate-50 rounded-[0.5px] border border-slate-100">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-900 mb-1">Pricing Strategy</span>
                        <span className="text-[10px] text-slate-400 font-medium tracking-wide ">Shared vs Individual</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-white p-1 rounded-full border border-slate-200">
                        <button
                          onClick={() => seedAndApplySharedPrice(true)}
                          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${samePriceForAll ? "bg-rose-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                        >
                          Single Price
                        </button>
                        <button
                          onClick={() => seedAndApplySharedPrice(false)}
                          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${!samePriceForAll ? "bg-rose-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
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
                            className="w-full bg-white rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-900 focus:ring-1 focus:ring-rose-100 outline-none"
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
                        onRemoveGroup={variantGroups.length > 1 ? removeVariantGroup : undefined}
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

                          {/* Add Placeholder Button */}
                          <button
                            onClick={() => openAddEntryModal(g.id)}
                            className="flex flex-col items-center justify-center min-h-[82px] border-2 border-dashed border-slate-200 rounded-xl p-4 bg-slate-50 hover:bg-slate-100/80 hover:border-rose-300 transition-all group cursor-pointer"
                          >
                            <div className="w-6 h-6 rounded-full border-2 border-slate-300 group-hover:border-rose-400 flex items-center justify-center text-slate-400 group-hover:text-rose-500 transition-colors">
                              <span className="text-sm font-bold">+</span>
                            </div>
                            <span className="mt-1 text-[10px] font-bold text-slate-400 group-hover:text-rose-500 uppercase tracking-tighter">Add option</span>
                          </button>
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
                            <div className="w-12 h-6 bg-slate-200 rounded-full peer peer-checked:bg-rose-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-6"></div>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-800 tracking-tight">Advanced Combination Logic</span>
                            <span className="text-[10px] font-medium text-slate-500 tracking-widest ">Pricing & Stock per combo</span>
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
                </motion.div>
              )}
            </AnimatePresence>

            {/* 4. Specifications */}
            <div id="ap-guide-specs" className="bg-white border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-purple-100 rounded-lg text-purple-600">
                    <Globe className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm font-bold text-slate-800">Specifications & Parameters</h2>
                </div>
                <button
                  onClick={openAddParam}
                  className="text-xs font-bold text-purple-600 hover:text-purple-700  tracking-tighter transition-colors"
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
            <div id="ap-guide-policies" className="bg-white border border-slate-200 overflow-hidden shadow-sm">
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
              <div id="ap-guide-media" className="bg-white border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-slate-400" />
                    <h2 className="text-sm font-bold text-slate-800">Product Assets</h2>
                  </div>
                  {!hasVariants && <span className="text-[10px] font-bold text-rose-500  tracking-widest">Required</span>}
                </div>
                <div className="p-4">
                  <ProductMedia
                    productImages={productImages}
                    setProductImages={setProductImages as any}
                    productVideo={productVideo}
                    setProductVideo={setProductVideo as any}
                    onProcessVideo={handleVideoProcess}
                    businessName={businessName}
                    businessLogo={businessLogo}
                  />
                  <div className="mt-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                    <p className="text-[11px] font-bold text-blue-700 flex items-center gap-2  tracking-tight">
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
            <div id="ap-guide-publish" className="lg:sticky lg:top-[500px] p-6 bg-slate-900 rounded-2xl shadow-lg text-white">
              <h3 className="text-sm font-bold mb-1">Ready to Publish?</h3>
              <p className="text-[10px] text-slate-400 mb-6">Review your specifications and variants before going live.</p>
              <div className="space-y-3">
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full py-3 bg-rose-500 hover:bg-rose-500 rounded-xl text-xs font-bold transition-all shadow-lg shadow-rose-900/40 active:scale-95 disabled:opacity-50"
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

      {/* Add Product Guided Walkthrough */}
      <AddProductWalkthrough />

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
      {/* Trimming Overlay */}
      <AnimatePresence>
        {isTrimming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-slate-900/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="w-full max-w-md">
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-rose-500/20 blur-3xl rounded-full scale-150 animate-pulse" />
                <div className="relative h-24 w-24 mx-auto rounded-3xl bg-white shadow-2xl flex items-center justify-center">
                  <div className="h-12 w-12 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
                </div>
              </div>

              <h2 className="text-2xl font-black text-white mb-2  tracking-tighter">Optimizing Video</h2>
              <p className="text-slate-400 text-sm font-medium mb-8">Trimming to 1:30 and generating thumbnail...</p>

              <div className="space-y-3">
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-rose-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${trimmingProgress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-black text-slate-500  tracking-widest">
                  <span>Processing wasm</span>
                  <span>{trimmingProgress}%</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation (Publish + Preview) */}
      <div className="fixed bottom-0 left-0 right-0 z-[100]  bg-white border-t border-slate-200 px-6 py-2 pb-[env(safe-area-inset-bottom,16px)] sm:hidden flex items-center gap-4 shadow-[0_-8px_30px_rgb(0,0,0,0.06)] backdrop-blur-md bg-white/90">
        <button
          onClick={openPreview}
          className="p-3 bg-slate-100 text-slate-600 rounded-full active:scale-95 transition-all"
          title="Preview Product"
        >
          <Eye className="w-6 h-6" />
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex-1 py-3 bg-rose-500 active:bg-rose-700 text-white rounded-full text-[12px]  shadow-rose-200 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              Publishing...
            </>
          ) : (
            "Publish Product"
          )}
        </button>
      </div>

      <VendorBotModal 
        isOpen={vendorBotOpen} 
        onClose={() => setVendorBotOpen(false)} 
        onProductPreview={(p) => {
          setPreviewPayload(p);
          setPreviewOpen(true);
        }}
      />
    </div>
  );
}
