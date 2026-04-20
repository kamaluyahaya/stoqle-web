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
import { fetchBusinessMe, fetchProductById, patchProduct, checkConversionSafety, convertToVariantProduct, convertToSimpleProduct } from "@/src/lib/api/productApi";
import type { ParamKV, PreviewPayload, VariantEntry, ProductSku } from "@/src/types/product";
import { toast } from "sonner";
import VariantEntryModal from "@/src/components/product/addProduct/modal/variantEntryModal";
import AddCategoryModal from "@/src/components/product/addProduct/modal/categoryModel";
import ManageCategoriesModal from "@/src/components/product/addProduct/modal/manageCategory";
import ParamsEditor from "@/src/components/product/addProduct/paramEditor";
import ParamsModal from "@/src/components/product/addProduct/modal/paramModal";
import NumberInput from "@/src/components/input/defaultNumberInput";
import DescriptionTextarea from "@/src/components/input/defaultDescTextarea";
import PreviewModal from "@/src/components/product/addProduct/modal/previewModal";
import { BusinessPolicy } from "@/src/types/business";
import { fetchMyCategories, type Category } from "@/src/lib/api/categoryApi";
import VariantSkuSection from "@/src/components/product/addProduct/variantSkuSection";
import ProductPolicySettings from "@/src/components/product/addProduct/productPolicySettings";
import { ArrowLeft, ChevronLeft, Eye, Save, Globe, Package, Settings, ShieldCheck, Tag, Info } from "lucide-react";
import { useAuth } from "@/src/context/authContext";

export default function EditProductPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const productId = searchParams.get("product_id");
  const { token } = useAuth();

  // --- Core State ---
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [businessId, setBusinessId] = useState<string | number>("");
  const [hasVariants, setHasVariants] = useState(false);
  const [productType, setProductType] = useState<'simple' | 'variant' | null>(null);

  const [productImages, setProductImages] = useState<(File | string)[]>([]);
  const [productVideo, setProductVideo] = useState<File | string | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [businessLogo, setBusinessLogo] = useState("");

  const [params, setParams] = useState<ParamKV[]>([]);
  const {
    variantGroups,
    setVariantGroups,
    addVariantGroup,
    removeVariantGroup: baseRemoveVariantGroup,
    updateVariantGroupTitle,
    setGroupAllowImages,
    removeVariantEntry: baseRemoveVariantEntry,
    updateVariantEntry,
  } = useVariantGroups();

  const removeVariantGroup = useCallback((groupId: string) => {
    const group = variantGroups.find(g => g.id === groupId);
    if (!group) return;

    const hasDependency = group.entries.some(e =>
      (e.reservedQuantity || 0) > 0 || (e.soldCount || 0) > 0
    );

    if (hasDependency) {
      toast.error("Cannot remove this variant type — it’s linked to existing orders.");
      return;
    }

    baseRemoveVariantGroup(groupId);
  }, [variantGroups, baseRemoveVariantGroup]);

  const removeVariantEntry = useCallback((groupId: string, entryId: string) => {
    const group = variantGroups.find(g => g.id === groupId);
    const entry = group?.entries.find(e => e.id === entryId);

    if (entry && ((entry.reservedQuantity || 0) > 0 || (entry.soldCount || 0) > 0)) {
      toast.error("Cannot remove this variant option—it has existing orders.");
      return;
    }

    baseRemoveVariantEntry(groupId, entryId);
  }, [variantGroups, baseRemoveVariantEntry]);

  const [samePriceForAll, setSamePriceForAll] = useState<boolean>(true);
  const [sharedPrice, setSharedPrice] = useState<number | null>(null);
  const [skus, setSkus] = useState<ProductSku[]>([]);
  const [useCombinations, setUseCombinations] = useState(false);

  // Auto-disable combinations if groups < 2
  useEffect(() => {
    if (useCombinations && variantGroups.length < 2) {
      setUseCombinations(false);
      toast.error("Requires at least 2 variant groups.");
    }
  }, [variantGroups.length, useCombinations]);

  // --- Policy State ---
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

  // --- UI State ---
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [openAddCategory, setOpenAddCategory] = useState(false);
  const [openManageCategories, setOpenManageCategories] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<{ groupId: string; entry?: VariantEntry } | null>(null);
  const [modalOptions, setModalOptions] = useState<{ allowImages?: boolean; showQuantity?: boolean; existingNames?: string[] }>({});
  const [paramModalOpen, setParamModalOpen] = useState(false);
  const [editingParam, setEditingParam] = useState<ParamKV | null>(null);
  const [previewPayload, setPreviewPayload] = useState<PreviewPayload | null>(null);

  // --- Conversion State ---
  const [showConvertToVariantModal, setShowConvertToVariantModal] = useState(false);
  const [showConvertToSimpleModal, setShowConvertToSimpleModal] = useState(false);
  const [safetyCheckResult, setSafetyCheckResult] = useState<any>(null);
  const [checkingSafety, setCheckingSafety] = useState(false);
  const [selectedPrimaryVariantId, setSelectedPrimaryVariantId] = useState<string>("");
  const [conversionSuccess, setConversionSuccess] = useState<boolean>(false);

  // --- Data Loading ---
  const loadProduct = useCallback(async () => {
    if (!productId || !token) return;
    try {
      setLoading(true);
      const res = await fetchProductById(productId, token);
      console.log("EditProduct fetch res:", res);
      // API returns { status: 'success', data: { product: { ... } } }
      const data = (res as any)?.data?.product || (res as any)?.data || res;

      if (!data || Object.keys(data).length === 0) throw new Error("Product data is empty or malformed");

      const inventory = data.inventory || [];

      setTitle(data.title || "");
      setDescription(data.description || "");
      setCategory(data.category_name || (data as any).category?.category_name || data.category || "");
      setPrice(data.price || "");
      setBusinessId(data.business_id || "");

      const baseInv = inventory.find((i: any) => !i.variant_option_id && !i.sku_id);
      setQuantity(baseInv ? baseInv.quantity : (data.quantity || 0));

      setHasVariants(!!data.has_variants);
      setProductType(data.has_variants ? 'variant' : 'simple');
      setUseCombinations(!!data.use_combinations);

      // Media
      if (data.media) {
        const images = data.media.filter((m: any) => m.type === 'image').map((m: any) => m.url);
        const video = data.media.find((m: any) => m.type === 'video')?.url || null;
        setProductImages(images);
        setProductVideo(video);
      }

      // Params
      if (data.params) {
        setParams(data.params.map((p: any) => ({
          id: String(p.param_id || cryptoRandomId()),
          key: p.param_key,
          value: p.param_value
        })));
      }

      // Variants
      if (data.variant_groups) {
        let hasImageGroup = false;
        const groups = data.variant_groups.map((g: any) => {
          if (!!g.allow_images) hasImageGroup = true;
          return {
            id: String(g.group_id),
            title: g.title,
            allowImages: !!g.allow_images,
            entries: (g.options || []).map((o: any) => {
              const inv = inventory.find((i: any) => String(i.variant_option_id) === String(o.option_id));
              return {
                id: String(o.option_id),
                name: o.name,
                quantity: inv ? inv.quantity : (o.initial_quantity || 0),
                price: o.price,
                soldCount: o.sold_count || 0,
                reservedQuantity: inv ? (inv.reserved_quantity || 0) : 0,
                imagePreviews: o.media?.map((m: any) => m.url) || [],
                images: [], // New files go here
              };
            })
          };
        });

        // Ensure at least one group has images as default if none were marked
        if (groups.length > 0 && !hasImageGroup) {
          groups[0].allowImages = true;
        }

        setVariantGroups(groups);
      }

      // SKUs from server
      if (data.skus) {
        setSkus(data.skus.map((s: any) => {
          const inv = inventory.find((i: any) => String(i.sku_id) === String(s.sku_id));
          return {
            id: String(s.sku_id), // Keep server ID 
            name: s.sku_code || "Variant Combination",
            variantOptionIds: JSON.parse(s.variant_option_ids || "[]").map(String),
            price: (s.price === null || s.price === undefined) ? "" : Number(s.price),
            quantity: inv ? inv.quantity : 0,
            reservedQuantity: inv ? (inv.reserved_quantity || 0) : 0,
            enabled: s.status === 'active'
          };
        }));
      }

      // 4. Determine Pricing Strategy
      if (data.has_variants) {
        let allPrices: number[] = [];
        if (data.use_combinations && data.skus) {
          allPrices = data.skus
            .filter((s: any) => s.status === 'active' && s.price !== null && s.price !== undefined)
            .map((s: any) => Number(s.price));
        } else if (data.variant_groups) {
          // If not using combinations, check variant prices
          allPrices = data.variant_groups
            .flatMap((g: any) => (g.options || []))
            .filter((o: any) => o.price !== null && o.price !== undefined)
            .map((o: any) => Number(o.price));
        }

        const uniquePrices = Array.from(new Set(allPrices));
        if (uniquePrices.length === 1) {
          setSamePriceForAll(true);
          setSharedPrice(uniquePrices[0]);
        } else if (uniquePrices.length > 1) {
          setSamePriceForAll(false);
          setSharedPrice(null);
        } else {
          setSamePriceForAll(true);
        }
      } else {
        setSamePriceForAll(true);
        if (data.price) setSharedPrice(Number(data.price));
      }

      // Policies
      if (data.policy_settings) {
        const ps = data.policy_settings;
        setUseStoreDefaultReturn(!!ps.use_store_default_return);
        setReturnPolicy({
          returnShippingSubsidy: !!ps.return_shipping_subsidy,
          sevenDayNoReasonReturn: !!ps.seven_day_no_reason_return,
          rapidRefund: !!ps.rapid_refund,
          lateShipmentCompensation: !!ps.late_shipment,
          fakeOnePayFour: !!ps.fake_one_pay_four,
          returnWindow: ps.return_window || 3,
        });

        setUseStoreDefaultShipping(!!ps.use_store_default_shipping);
        setShippingPolicy({
          avgDuration: ps.avg_duration || 24,
          avgUnit: ps.avg_unit || "hours",
          promiseDuration: ps.promise_duration || 48,
          promiseUnit: ps.promise_unit || "hours",
          radiusKm: ps.radius_km || 50,
        });

        setUseStoreDefaultPromotions(!!ps.use_store_default_promotions);
        setPromotions(ps.promotions_data ? JSON.parse(ps.promotions_data) : []);
        setSaleDiscount(ps.sale_discount_data ? JSON.parse(ps.sale_discount_data) : { type: "", discount: 0 });
      }

    } catch (err: any) {
      console.error("Failed to load product", err);
      toast.error("Failed to load product details");
    } finally {
      setLoading(false);
    }
  }, [productId, token, setVariantGroups]);

  const loadCategories = useCallback(async () => {
    try {
      setLoadingCategories(true);
      const body = await fetchMyCategories(token || undefined);
      const list = Array.isArray(body) ? body : ((body as any)?.data || []);
      setCategories(list);
    } catch (err) {
      console.error("Failed to load categories", err);
    } finally {
      setLoadingCategories(false);
    }
  }, [token]);

  const loadBusinessSettings = useCallback(async () => {
    if (!token) return;
    try {
      const biz = await fetchBusinessMe(token);
      const bizData = biz?.data?.business ?? biz?.business ?? biz;
      if (bizData) {
        setBusinessName(bizData.business_name || bizData.name || "Vendor");
        setBusinessLogo(bizData.logo || bizData.business_logo || "");
      }
    } catch (e) {
      console.error("Failed to load business settings", e);
    }
  }, [token]);

  // Sync SKUs with Variant Groups (Calculates the names)
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

        if (existing) {
          // Keep existing but update name to ensure accuracy if someone edited variant names
          const nextName = combo.names.join(" / ");
          // If same price is enabled, ensure the existing SKU uses the shared price
          return { ...existing, name: nextName };
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

  useEffect(() => {
    loadProduct();
    loadCategories();
    loadBusinessSettings();
  }, [loadProduct, loadCategories, loadBusinessSettings]);

  // --- Handlers ---
  const handleModalSubmit = (entryData: Omit<VariantEntry, "id">) => {
    if (!editing) return;
    const { groupId, entry } = editing;

    if (entry) {
      updateVariantEntry(groupId, entry.id, entryData);
    } else {
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

  const seedAndApplySharedPrice = (nextSame: boolean) => {
    if (nextSame) {
      let seed: number | null = sharedPrice;
      if (seed === null && price !== "") seed = Number(price);
      setSharedPrice(seed);
    }
    setSamePriceForAll(nextSame);
  };

  // --- Conversion Handlers ---
  const handleCheckSafety = async () => {
    if (!productId || !token) return;
    try {
      setCheckingSafety(true);
      const res = await checkConversionSafety(productId, token);
      setSafetyCheckResult(res.data);
      return res.data;
    } catch (err: any) {
      toast.error(err.body?.message || "Failed to check conversion safety");
      return null;
    } finally {
      setCheckingSafety(false);
    }
  };

  const resetModals = () => {
    setShowConvertToVariantModal(false);
    setShowConvertToSimpleModal(false);
    setConversionSuccess(false);
    setSafetyCheckResult(null);
    setSelectedPrimaryVariantId("");
  };

  const handleConvertToVariant = async () => {
    if (!productId || !token) return;
    const safety = await handleCheckSafety();
    if (!safety) return;
    if (!safety.isSafe) return; // The modal will update itself with safetyCheckResult

    try {
      setSubmitting(true);
      await convertToVariantProduct(productId, token);
      setConversionSuccess(true);
      setProductType('variant');
      // Wait a moment then reload
      setTimeout(() => {
        resetModals();
        loadProduct();
      }, 2000);
    } catch (err: any) {
      toast.error(err.body?.message || "Conversion failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConvertToSimple = async () => {
    if (!productId || !token || !selectedPrimaryVariantId) return;
    try {
      setSubmitting(true);
      await convertToSimpleProduct(productId, selectedPrimaryVariantId, token);
      setConversionSuccess(true);
      setProductType('simple');
      // Wait a moment then reload
      setTimeout(() => {
        resetModals();
        loadProduct();
      }, 2000);
    } catch (err: any) {
      toast.error(err.body?.message || "Conversion failed");
    } finally {
      setSubmitting(false);
    }
  };

  const onToggleHasVariants = async (checked: boolean) => {
    if (checked === hasVariants) return;
    if (checked) {
      handleCheckSafety(); // Check safety in background for variant conversion too
      setShowConvertToVariantModal(true);
    } else {
      handleCheckSafety(); // Load safety details
      setShowConvertToSimpleModal(true); // Always show, the modal itself handles !isSafe
    }
  };

  const handleSubmit = async () => {
    if (title.trim().length < 3) return toast.error("Product name must be at least 3 characters.");
    if (!category.trim()) return toast.error("Please choose a category.");
    if (productImages.length === 0) return toast.error("Please upload at least one product image.");
    if (submitting || !productId || !token) return;

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("title", title);
      form.append("description", description);
      form.append("category", category);

      if (!hasVariants) {
        if (!price || Number(price) < 100) return toast.error("Product price must be at least 100 Naira.");
        form.append("price", String(price));
        form.append("quantity", String(quantity));
      } else {
        // --- Variant Structure Validation ---
        if (variantGroups.length === 0) return toast.error("Requires at least 2 variant groups..");
        for (const g of variantGroups) {
          if (!g.title.trim()) return toast.error("Please provide a title for all variant groups.");
          if (g.entries.length === 0) return toast.error(`Please add at least one option to the group: ${g.title}`);
        }

        // Validation for prices
        if (samePriceForAll && (!sharedPrice || Number(sharedPrice) < 100)) {
          return toast.error("Shared price for variants must be at least 100 Naira.");
        }

        if (useCombinations) {
          const invalidSku = skus.find(s => s.enabled && (!s.price || Number(s.price) < 100));
          if (!samePriceForAll && invalidSku) {
            return toast.error(`Price for combination: ${invalidSku.name} must be at least 100 Naira.`);
          }
        } else {
          // Check individual entries
          for (const g of variantGroups) {
            const invalidEntry = g.entries.find(e => !samePriceForAll && (!e.price || Number(e.price) < 100));
            if (invalidEntry) {
              return toast.error(`Price for variant: ${invalidEntry.name} must be at least 100 Naira.`);
            }
          }
        }
      }

      // Handle Media - Send existing URLs as JSON to help backend track deletions
      const existingImages = productImages.filter(i => typeof i === "string");
      const newImages = productImages.filter(i => typeof i !== "string") as File[];

      form.append("existing_images", JSON.stringify(existingImages));

      // Send the full order of images (URLs for existing, placeholders for new files)
      const fullImageOrder = productImages.map((img) => {
        if (typeof img === "string") return img;
        const index = newImages.indexOf(img);
        return `file:${index}`;
      });
      form.append("full_image_order", JSON.stringify(fullImageOrder));

      newImages.forEach(f => form.append("files", f));

      if (productVideo) {
        if (typeof productVideo === "string") {
          form.append("existing_video", productVideo);
        } else {
          form.append("product_video", productVideo);
        }
      }

      // Variants
      if (hasVariants) {
        const variantsPayload = variantGroups.map((g) => ({
          id: g.id,
          title: g.title,
          entries: g.entries.map((e) => ({
            id: e.id,
            name: e.name,
            quantity: e.quantity,
            price: samePriceForAll ? sharedPrice ?? null : e.price ?? null,
            existing_images: e.imagePreviews?.filter(url => typeof url === "string") || [],
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

      form.append("has_variants", String(hasVariants));
      form.append("params", JSON.stringify(params.map((p) => ({ key: p.key, value: p.value }))));

      // Policy Overrides
      const policyData = {
        useStoreDefaultReturn,
        returnPolicy,
        useStoreDefaultShipping,
        shippingPolicy,
        useStoreDefaultPromotions,
        promotions,
        saleDiscount,
      };
      form.append("policy_overrides", JSON.stringify(policyData));

      const res = await patchProduct(productId, form, token, (percent) => setUploadProgress(percent));
      toast.success("Product updated successfully");
      router.push("/profile/business/inventory");
    } catch (err: any) {
      console.error("Update failed", err);
      toast.error(err?.body?.message || "Failed to update product");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-500 font-medium">Loading product data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-100">
      {/* Upload Progress Overlay */}
      {submitting && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center">
            <Globe className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-pulse" />
            <h3 className="text-xl font-bold text-slate-800 mb-2">Updating Product</h3>
            <p className="text-sm text-slate-500 mb-6 font-medium">Synchronizing changes with your shop catalog...</p>

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
      <div className="sticky top-0 lg:top-16 z-[1050] bg-white/95 backdrop-blur-md border-b border-slate-200 pt-[env(safe-area-inset-top,12px)]">
        <div className=" px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="p-2 lg:hidden hover:bg-slate-100 rounded-full transition-colors text-slate-700 active:scale-95"
            >
              <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
            </button>
            <div className="flex flex-col">
              <h4 className="text-sm font-bold text-slate-900 truncate max-w-[200px] sm:max-w-md">
                Edit: {title || "Product"}
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const payload: PreviewPayload = {
                  productId: productId ? Number(productId) : undefined,
                  businessId: businessId ? Number(businessId) : undefined,
                  title,
                  description,
                  category,
                  price: price === "" ? 0 : Number(price),
                  quantity: quantity === "" ? 0 : Number(quantity),
                  hasVariants,
                  useCombinations,
                  productImages: productImages.map((img, i) => ({
                    url: typeof img === "string" ? img : URL.createObjectURL(img),
                    file: typeof img === "string" ? undefined : img,
                    name: `Image ${i + 1}`,
                  })),
                  productVideo: productVideo ? {
                    url: typeof productVideo === "string" ? productVideo : URL.createObjectURL(productVideo),
                    file: typeof productVideo === "string" ? undefined : productVideo,
                    name: "Product Video"
                  } : null,
                  params: params.map(p => ({ key: p.key, value: p.value })),
                  variantGroups: variantGroups.map(g => ({
                    id: g.id,
                    title: g.title,
                    allowImages: g.allowImages,
                    entries: g.entries.map(e => ({
                      id: e.id,
                      name: e.name,
                      quantity: e.quantity,
                      price: e.price,
                      images: e.images?.map((img, idx) => ({
                        url: typeof img === "string" ? img : URL.createObjectURL(img),
                        file: typeof img === "string" ? undefined : img,
                        name: `Variant Image ${idx + 1}`
                      })) || []
                    }))
                  })),
                  skus: skus || [],
                  samePriceForAll,
                  sharedPrice,
                  policyOverrides: {
                    useStoreDefaultReturn,
                    returnPolicy,
                    useStoreDefaultShipping,
                    shippingPolicy,
                    useStoreDefaultPromotions,
                    promotions,
                    saleDiscount,
                  }
                };
                setPreviewPayload(payload);
              }}
              className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-full transition-all"
            >
              <Eye className="w-4 h-4" /> Preview Live
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="hidden sm:flex items-center gap-2 px-6 py-2 bg-rose-500 hover:bg-rose-700 text-white rounded-full text-sm font-bold shadow-lg shadow-rose-200 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              Update
            </button>
          </div>
        </div>
      </div>

      <div className=" p-4 sm:p-6 pb-24 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form Column (Desktop: Left, Mobile: Middle) */}
          <div className="lg:col-span-2 lg:row-span-2 order-2 lg:order-1 space-y-6">

            {/* 1. Basic Information */}
            <div className="bg-white border border-slate-200  overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-800">Basic Information</h2>
              </div>
              <div className="p-6 space-y-5">
                <DefaultInput
                  label="Product Name"
                  value={title}
                  onChange={setTitle}
                  placeholder="e.g. Premium Leather Jacket"
                  required
                />

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs p-1 font-medium text-rose-700"><button onClick={() => setOpenManageCategories(true)} className="">Manage</button>
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
                    title={loadingCategories ? "Loading..." : "Category catalog"}
                    options={categories.map((c) => c.category_name)}
                    value={category}
                    onSelected={setCategory}
                    isRequired
                    triggerLabel="Category"
                  />
                </div>

                <DescriptionTextarea
                  value={description}
                  onChange={setDescription}
                  placeholder="Tell your customers about the unique features and quality of this product..."
                  maxLength={1000}
                />
              </div>
            </div>

            {/* 1.5 Product Type Selection */}
            <div className="bg-white overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                <Tag className="w-4 h-4 text-slate-400" />
                <h2 className="text-sm font-bold text-slate-800">Product Type</h2>
              </div>
              <div className="p-6 grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => onToggleHasVariants(false)}
                  className={`p-4 rounded-xl border-[0.5px] transition-all flex flex-col items-center gap-2 ${productType === 'simple' ? "border-rose-500 bg-rose-50 text-rose-700 " : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-300"}`}
                >
                  <span className="text-sm  tracking-tight">Simple Product</span>
                  <p className="text-[10px] font-medium text-center opacity-70">Single price and fixed stock quantity</p>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleHasVariants(true)}
                  className={`p-4 rounded-xl border-[0.5px] transition-all flex flex-col items-center gap-2 ${productType === 'variant' ? "border-rose-500 bg-rose-50 text-rose-700 " : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-300"}`}
                >
                  <span className="text-sm  tracking-tight">Variant Product</span>
                  <p className="text-[10px] font-medium text-center opacity-70">Multiple sizes, colors or options</p>
                </button>
              </div>
            </div>

            {/* 2. Pricing & Stock (Only for simple products) */}
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
                    <h2 className="text-sm font-bold text-slate-800">Pricing & Base Inventory</h2>
                  </div>
                  <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <NumberInput label="Retail Price (NGN)" value={price} onChange={setPrice} placeholder="0.00" required />
                      <p className="text-[10px] text-slate-400 font-medium italic">Base price for customers</p>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700">In Hand Quantity</label>
                        <div className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-500">Read Only</div>
                      </div>
                      <div className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl flex items-center px-4 text-slate-600 font-bold opacity-75">
                        {quantity} Units available
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">To adjust stock, use the Inventory History table.</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 3. Variant Management */}
            <AnimatePresence>
              {productType === 'variant' && (
                <motion.div
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
                      {hasVariants && (
                        <button
                          onClick={addVariantGroup}
                          disabled={variantGroups.length >= 2}
                          className="px-4 py-1.5 rounded-full text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-30 transition-all shadow-md active:scale-95"
                        >
                          + Add Group
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-6 space-y-8">
                    {/* Pricing Strategy */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-4 bg-slate-50 rounded-[0.5px] border border-slate-100">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-900 mb-1">Pricing Strategy</span>
                        <span className="text-[10px] text-slate-400 font-medium">Choose how variants are priced across the group</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-white p-1 rounded-full border border-slate-200">
                        <button
                          onClick={() => seedAndApplySharedPrice(true)}
                          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${samePriceForAll ? "bg-rose-500 text-white" : "text-slate-500 hover:text-slate-700"}`}
                        >
                          Single Price
                        </button>
                        <button
                          onClick={() => seedAndApplySharedPrice(false)}
                          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${!samePriceForAll ? "bg-rose-500 text-white" : "text-slate-500 hover:text-slate-700"}`}
                        >
                          Different price
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
                        onAddEntry={(groupId) => {
                          setEditing({ groupId });
                          const showQuantity = idx === 0;
                          const existingNames = g.entries.map(e => e.name.toLowerCase());
                          setModalOptions({ allowImages: g.allowImages, showQuantity, existingNames });
                          setModalOpen(true);
                        }}
                        onRemoveGroup={variantGroups.length > 1 ? removeVariantGroup : undefined}
                      >
                        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
                          {g.entries.map((e) => (
                            <VariantEntryCard
                              key={e.id}
                              entry={e}
                              allowImages={g.allowImages}
                              useCombinations={useCombinations}
                              samePriceForAll={samePriceForAll}
                              sharedPrice={sharedPrice}
                              onRemove={() => removeVariantEntry(g.id, e.id)}
                              onEdit={() => {
                                setEditing({ groupId: g.id, entry: e });
                                const showQuantity = idx === 0;
                                const existingNames = g.entries.filter(ee => ee.id !== e.id).map(ee => ee.name.toLowerCase());
                                setModalOptions({ allowImages: g.allowImages, showQuantity, existingNames });
                                setModalOpen(true);
                              }}
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
                                  toast.info("Requires at least 2 variant groups.");
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
                          <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-100">
                            <Info className="w-4 h-4 shrink-0" />
                            <p className="text-[10px] font-bold leading-tight">Quantities are read-only here. To adjust specific SKU stock, use the inventory management panel.</p>
                          </div>
                          <VariantSkuSection
                            skus={skus}
                            setSkus={setSkus}
                            samePriceForAll={samePriceForAll}
                            sharedPrice={sharedPrice}
                            readOnlyStock={true}
                            variantGroups={variantGroups}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 4. Product Parameters */}
            <div className="bg-white border border-slate-200  overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-purple-100 rounded-lg text-purple-600">
                    <Globe className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm font-bold text-slate-800">Specifications & Parameters</h2>
                </div>
                <button
                  onClick={() => { setEditingParam(null); setParamModalOpen(true); }}
                  className="text-xs font-bold text-purple-600 hover:text-purple-700  tracking-tighter"
                >
                  + Add Spec
                </button>
              </div>
              <div className="p-6">
                <ParamsEditor
                  params={params}
                  onAdd={() => { setEditingParam(null); setParamModalOpen(true); }}
                  onEdit={(p) => { setEditingParam(p); setParamModalOpen(true); }}
                  onRemove={(id) => setParams(prev => prev.filter(p => p.id !== id))}
                />
              </div>
            </div>

            {/* 5. Policy Settings */}
            <div className="bg-white border border-slate-200  overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                <div className="p-1.5 bg-orange-100 rounded-lg text-orange-600">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-800">Business Policy Overrides</h2>
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
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-slate-400" />
                  <h2 className="text-sm font-bold text-slate-800">Product Assets</h2>
                </div>
                <div className="p-4">
                  <ProductMedia
                    productImages={productImages}
                    setProductImages={setProductImages}
                    productVideo={productVideo}
                    setProductVideo={setProductVideo as any}
                    businessName={businessName}
                    businessLogo={businessLogo}
                  />
                  <div className="mt-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                    <p className="text-[11px] font-bold text-blue-700 flex items-center gap-2">
                      <Tag className="w-3 h-3" /> Professional tip:
                    </p>
                    <p className="text-[10px] text-blue-600 font-medium leading-relaxed mt-1">High-quality lifestyle shots and short review videos significantly increase conversion rates.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column Slot 2 - Quick Actions (Desktop: Right-Bottom, Mobile: Bottom) */}
          <div className="lg:col-span-1 order-3 lg:order-3">
            <div className="lg:sticky lg:top-[500px] p-6 bg-slate-900 rounded-2xl shadow-lg text-white">
              <h3 className="text-sm font-bold mb-1">Update Inventory?</h3>
              <p className="text-[10px] text-slate-400 mb-6">Review your changes before updating the live catalog.</p>
              <div className="space-y-3">
                <button
                  onClick={() => handleSubmit()}
                  disabled={submitting}
                  className="w-full py-3 bg-rose-500 hover:bg-rose-500 rounded-xl text-xs font-bold transition-all shadow-lg shadow-rose-900/40 active:scale-95 disabled:opacity-50"
                >
                  {submitting ? "Updating..." : "Confirm & Update"}
                </button>
                <button
                  onClick={() => router.back()}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95"
                >
                  Cancel & Return
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Modals */}
      <VariantEntryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleModalSubmit}
        initialData={editing?.entry}
        allowImages={modalOptions.allowImages}
        useCombinations={useCombinations}
        samePriceForAll={samePriceForAll}
        sharedPrice={sharedPrice}
        existingNames={modalOptions.existingNames}
        readOnlyQuantity={true}
      />
      <ParamsModal
        open={paramModalOpen}
        onClose={() => setParamModalOpen(false)}
        onSubmit={(data) => {
          if (editingParam) {
            setParams(prev => prev.map(p => p.id === editingParam.id ? { ...p, ...data } : p));
          } else {
            setParams(prev => [...prev, { id: cryptoRandomId(), ...data }]);
          }
          setParamModalOpen(false);
        }}
        initialData={editingParam || undefined}
      />
      {/* Convert to Variant Modal */}
      <AnimatePresence>
        {showConvertToVariantModal && (
          <div className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
              onClick={resetModals}
            />

            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white rounded-t-[0.5rem] sm:rounded-[0.5rem] max-w-md w-full p-8 border border-slate-100 overflow-hidden relative z-10"
            >
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <Settings className="w-24 h-24" />
              </div>

              {!conversionSuccess ? (
                <>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Convert to Variant Product?</h3>

                  {safetyCheckResult && !safetyCheckResult.isSafe ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl flex gap-3">
                        <Info className="w-5 h-5 text-orange-500 shrink-0" />
                        <p className="text-sm font-medium text-orange-900 leading-snug">
                          Product has active or historical usage ({safetyCheckResult.totalOrders} total orders) and cannot be converted.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-slate-400  tracking-widest px-1">Blocking Orders ({safetyCheckResult.activeOrders?.length || 0})</p>
                        <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-slate-50/50">
                          {safetyCheckResult.activeOrders?.map((ord: any) => (
                            <div key={ord.order_id} className="p-3 flex items-center justify-between">
                              <div className="flex flex-col">
                                <span className="text-[11px] font-bold text-slate-700">Order #{ord.order_id}</span>
                                <span className="text-[9px] text-slate-400 font-medium">{ord.created_at ? new Date(ord.created_at).toLocaleDateString() : 'N/A'}</span>
                              </div>
                              <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold capitalize ${ord.status === 'processing' ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-600'}`}>
                                {ord.status || 'Active'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={resetModals}
                        className="w-full py-3 rounded-full bg-rose-500 text-white font-bold text-sm hover:bg-slate-800 transition-all"
                      >
                        I Understand
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                        Converting to a variant product will create a default variant automatically and move your current stock in-hand into that variant.
                      </p>

                      <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl mb-6">
                        <p className="text-xs font-bold text-blue-900 mb-1">Integration Details:</p>
                        <ul className="text-[10px] text-blue-700 space-y-1 list-disc pl-4 font-medium">
                          <li>Current stock ({quantity} Units) moves to "Default" variant.</li>
                          <li>The product enables multi-option management.</li>
                          <li>You can then add sizes, colors, and separate prices.</li>
                        </ul>
                      </div>

                      <div className="space-y-3">
                        <button
                          onClick={handleConvertToVariant}
                          disabled={submitting || checkingSafety}
                          className="w-full py-3.5 rounded-2xl bg-rose-500 text-white font-bold text-sm hover:bg-rose-500 shadow-lg shadow-rose-200 active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                          {submitting ? "Converting..." : "Yes, Convert Now"}
                        </button>
                        <button
                          onClick={resetModals}
                          className="w-full py-3 rounded-full bg-slate-50 text-slate-500 font-bold text-sm hover:bg-slate-100 transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="py-4 text-center">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Success!</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    The product has been converted. Your stock is now managed under a "Default" variant.
                  </p>
                  <p className="text-[10px] text-slate-400 mt-4 italic">Refreshing product details...</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Convert to Simple Modal */}
      <AnimatePresence>
        {showConvertToSimpleModal && safetyCheckResult && (
          <div className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
              onClick={resetModals}
            />

            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white rounded-[0.5rem] max-w-lg w-full border border-slate-100 h-[70vh] flex flex-col relative z-10 overflow-hidden"
            >
              {!conversionSuccess ? (
                <>
                  <div className="flex-1 overflow-y-auto p-8 pb-0">
                    <h3 className="text-sm text-center font-bold text-slate-900 mb-2">Convert to Simple Product?</h3>

                    {!safetyCheckResult.isSafe ? (
                      <div className="space-y-4">
                        <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl flex gap-3">
                          <Info className="w-5 h-5 text-orange-500 shrink-0" />
                          <p className="text-base font-medium text-orange-900 leading-snug">
                            Product has active or historical variant usage ({safetyCheckResult.totalOrders} total orders) and cannot be converted.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-slate-400  tracking-widest px-1">Blocking Orders ({safetyCheckResult.activeOrders?.length || 0})</p>
                          <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-slate-50/50">
                            {safetyCheckResult.activeOrders?.map((ord: any) => (
                              <div key={ord.id} className="p-3 flex items-center justify-between">
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-bold text-slate-700">Order #{ord.id}</span>
                                  <span className="text-[9px] text-slate-400 font-medium">{ord.created_at ? new Date(ord.created_at).toLocaleDateString() : 'N/A'}</span>
                                </div>
                                <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold capitalize ${ord.status === 'processing' ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-600'}`}>
                                  {ord.status || 'Active'}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-3 mt-8 pb-8">
                          <button
                            onClick={resetModals}
                            className="w-full py-3 rounded-full bg-rose-500 text-white font-bold text-sm hover:bg-slate-800 transition-all font-medium"
                          >
                            I Understand
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-slate-500 text-[11px] mb-6 leading-relaxed">
                          Converting to a simple product will remove the variant structure. <strong>Please choose which variant should represent this product</strong> (it will keep its price and stock).
                        </p>

                        <div className="space-y-2 mb-8 pr-2 custom-scrollbar">
                          {variantGroups.flatMap(g => g.entries).map(entry => (
                            <button
                              key={entry.id}
                              onClick={() => setSelectedPrimaryVariantId(entry.id)}
                              className={`w-full p-4 rounded-2xl border-2 text-left transition-all flex items-center justify-between group ${selectedPrimaryVariantId === entry.id ? 'border-rose-500 bg-rose-50' : 'border-slate-100 hover:border-slate-300 bg-slate-50'}`}
                            >
                              <div>
                                <span className={`block font-bold text-sm ${selectedPrimaryVariantId === entry.id ? 'text-rose-900' : 'text-slate-700'}`}>{entry.name}</span>
                                <span className="text-[10px] text-slate-500">Stock: {entry.quantity} | Price: {entry.price}</span>
                              </div>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedPrimaryVariantId === entry.id ? 'border-rose-500 bg-rose-500' : 'border-slate-300 bg-white'}`}>
                                {selectedPrimaryVariantId === entry.id && <div className="w-2 h-2 rounded-full bg-white" />}
                              </div>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {safetyCheckResult.isSafe && (
                    <div className="p-8 border-t border-slate-50 bg-white shrink-0">
                      <div className="flex gap-3">
                        <button
                          onClick={resetModals}
                          className="flex-1 py-3.5 rounded-2xl bg-slate-50 text-slate-500 font-bold text-sm hover:bg-slate-100 transition-all font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleConvertToSimple}
                          disabled={submitting || !selectedPrimaryVariantId}
                          className="flex-1 py-3.5 rounded-2xl bg-rose-500 text-white font-bold text-sm hover:bg-rose-500 shadow-lg shadow-rose-200 active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                          {submitting ? "Converting..." : "Finalize"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-8 text-center flex-1 flex flex-col justify-center">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Product Simplified!</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    The variant structure has been removed. All data has been successfully merged into the main product record.
                  </p>
                  <p className="text-[10px] text-slate-400 mt-6 italic font-medium">Resetting catalog details...</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AddCategoryModal
        open={openAddCategory}
        onClose={() => setOpenAddCategory(false)}
        onCreated={(newCat: any) => {
          loadCategories();
          setCategory(newCat.category_name);
        }}
      />
      <ManageCategoriesModal
        open={openManageCategories}
        onClose={() => setOpenManageCategories(false)}
        categories={categories}
        onUpdated={() => loadCategories()}
      />
      <PreviewModal
        open={!!previewPayload}
        payload={previewPayload}
        onClose={() => setPreviewPayload(null)}
      />

      {/* Mobile Bottom Navigation (Update + Preview) */}
      <div className="fixed bottom-0 left-0 right-0 z-[1000]  bg-white border-t border-slate-200 px-6 py-2 pb-[env(safe-area-inset-bottom,16px)] sm:hidden flex items-center gap-4 shadow-[0_-8px_30px_rgb(0,0,0,0.06)] backdrop-blur-md bg-white/90">
        <button
          onClick={() => {
            const payload: PreviewPayload = {
              productId: productId ? Number(productId) : undefined,
              businessId: businessId ? Number(businessId) : undefined,
              title,
              description,
              category,
              price: price === "" ? 0 : Number(price),
              quantity: quantity === "" ? 0 : Number(quantity),
              hasVariants,
              useCombinations,
              productImages: productImages.map((img, i) => ({
                url: typeof img === "string" ? img : URL.createObjectURL(img),
                file: typeof img === "string" ? undefined : img,
                name: `Image ${i + 1}`,
              })),
              productVideo: productVideo ? {
                url: typeof productVideo === "string" ? productVideo : URL.createObjectURL(productVideo),
                file: typeof productVideo === "string" ? undefined : productVideo,
                name: "Product Video"
              } : null,
              params: params.map(p => ({ key: p.key, value: p.value })),
              variantGroups: variantGroups.map(g => ({
                id: g.id,
                title: g.title,
                allowImages: g.allowImages,
                entries: g.entries.map(e => ({
                  id: e.id,
                  name: e.name,
                  quantity: e.quantity,
                  price: e.price,
                  images: e.images?.map((img, idx) => ({
                    url: typeof img === "string" ? img : URL.createObjectURL(img),
                    file: typeof img === "string" ? undefined : img,
                    name: `Variant Image ${idx + 1}`
                  })) || []
                }))
              })),
              skus: skus || [],
              samePriceForAll,
              sharedPrice,
              policyOverrides: {
                useStoreDefaultReturn,
                returnPolicy,
                useStoreDefaultShipping,
                shippingPolicy,
                useStoreDefaultPromotions,
                promotions,
                saleDiscount,
              }
            };
            setPreviewPayload(payload);
          }}
          className="p-3 bg-slate-100 text-slate-600 rounded-full active:scale-95 transition-all"
          title="Preview Product"
        >
          <Eye className="w-6 h-6" />
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex-1 py-3 bg-rose-500 active:bg-rose-700 text-white rounded-full text-[12px] font-bold shadow-lg shadow-rose-200 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              Updating...
            </>
          ) : (
            "Update Product"
          )}
        </button>
      </div>
    </div>
  );
}
