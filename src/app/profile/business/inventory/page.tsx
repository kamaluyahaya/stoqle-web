"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
    Package,
    Search,
    Filter,
    ChevronDown,
    ChevronUp,
    AlertTriangle,
    Inbox,
    History,
    Edit3,
    Check,
    X,
    MoreVertical,
    ArrowRight,
    TrendingDown,
    TrendingUp,
    Loader2,
    RefreshCcw,
    LayoutGrid,
    List,
    Eye,
    MinusCircle,
    PlusCircle,
    Save,
    ArrowUpDown,
    ChevronLeft,
    FileText,
    Printer,
    Download,
    Calendar,
    User,
    // Users,
    BarChart3,
    Users
} from "lucide-react";
import { idbGet, idbSet } from "@/src/lib/utils/idb";
import { smartInventoryApi } from "@/src/lib/api/inventoryApi";
import { checkDeletionSafety, deleteProduct as apiDeleteProduct, fetchBusinessMe as fetchBusinessApi } from "@/src/lib/api/productApi";
import { useAuth } from "@/src/context/authContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { PreviewPayload, } from "@/src/types/product";
import PreviewModal from "@/src/components/product/addProduct/modal/previewModal";
import { fetchProductById as fetchProductByIdApi } from "@/src/lib/api/productApi";
import CustomersTab from "@/src/components/business/inventory/CustomersTab";
import InsightsTab from "@/src/components/business/inventory/InsightsTab";
import ProductInsightModal from "@/src/components/business/inventory/ProductInsightModal";
import { API_BASE_URL } from "@/src/lib/config";

// --- Types ---
interface InventoryItem {
    product_id: number;
    business_id: number;
    business_slug?: string;
    inventory_id: number;
    name: string;
    category: string;
    base_price: string;
    has_variants: boolean;
    use_combinations: boolean;
    product_sku: string;
    prod_status: string;
    total_quantity: number;
    reserved: number;
    available: number;
    low_stock_alert: number;
    image_url: string;
    variants: VariantItem[];
}

interface VariantItem {
    id: number;
    type: 'sku' | 'option';
    name: string;
    sku: string;
    price: string;
    total_quantity: number;
    reserved: number;
    available: number;
    low_stock_alert: number;
    inventory_id: number;
    image_url?: string;
}

interface Adjustment {
    adjustment_id: number;
    change_type: 'addition' | 'subtraction';
    quantity_change: number;
    reason: string;
    previous_quantity: number;
    new_quantity: number;
    created_at: string;
    adjusted_by_name?: string;
    variant_name?: string;
}

export default function SmartInventoryPage() {
    const auth = useAuth();
    const { token, user } = auth;
    const router = useRouter();

    // State
    const [products, setProducts] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<"inventory" | "customers" | "insights">("inventory");
    const [activeTab, setActiveTab] = useState<"all" | "low_stock" | "out_of_stock">("all");

    // UI State
    const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());
    const [editingId, setEditingId] = useState<{ id: number; field: 'total' } | null>(null);
    const [editValue, setEditValue] = useState<number>(0);
    const [historyDrawer, setHistoryDrawer] = useState<{ open: boolean; item: InventoryItem | VariantItem | null }>({ open: false, item: null });
    const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [activeMenu, setActiveMenu] = useState<number | null>(null);
    const [deleteModal, setDeleteModal] = useState<{ open: boolean; item: InventoryItem | null; safety: any | null; loading: boolean }>({ open: false, item: null, safety: null, loading: false });
    const [previewPayload, setPreviewPayload] = useState<PreviewPayload | null>(null);
    const [loadingPreview, setLoadingPreview] = useState<number | null>(null);
    const [insightModal, setInsightModal] = useState<{ open: boolean; product: InventoryItem | null }>({ open: false, product: null });
    const [businessData, setBusinessData] = useState<any>(null);
    const [customerCount, setCustomerCount] = useState<number>(0);

    // Stats
    const stats = useMemo(() => {
        const totalItems = products.length;
        let lowStock = 0;
        let outOfStock = 0;
        let totalReserved = 0;
        let totalQuantity = 0;

        products.forEach(p => {
            totalReserved += p.reserved;
            totalQuantity += p.total_quantity;
            if (p.available <= 0) outOfStock++;
            else if (p.available <= (p.low_stock_alert || 5)) lowStock++;

            p.variants.forEach(v => {
                totalReserved += v.reserved;
            });
        });

        return { totalItems, lowStock, outOfStock, totalReserved, totalQuantity };
    }, [products]);

    useEffect(() => {
        const hydrate = async () => {
            try {
                const cached = await idbGet<InventoryItem[]>("inventory_cache");
                if (cached && cached.length > 0) {
                    setProducts(cached);
                    setLoading(false);
                }
            } catch (e) { console.error("Cache hydration error:", e); }
        };
        hydrate();

        const handleMobileInsight = (e: any) => {
            setInsightModal({ open: true, product: e.detail });
        };
        window.addEventListener('open-insight', handleMobileInsight);
        return () => window.removeEventListener('open-insight', handleMobileInsight);
    }, []);

    // Data Fetching (Non-blocking revalidation)
    const loadInventory = async (isRefresh = false) => {
        if (!token) return;
        try {
            if (isRefresh) setRefreshing(true);

            const data = await smartInventoryApi.getSmartInventory({
                search: searchQuery,
                filter: activeTab === 'all' ? undefined : activeTab
            });

            const newProducts = data.products || [];
            setProducts(newProducts);

            // Background Sync: Update only if it's the main list
            if (!searchQuery && activeTab === 'all') {
                idbSet("inventory_cache", newProducts).catch(console.error);
            }
        } catch (err: any) {
            if (!isRefresh && products.length === 0) {
                toast.error("Failed to load inventory");
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const loadBusiness = async () => {
        if (!token) return;
        try {
            const res = await fetchBusinessApi(token);
            if (res?.ok) setBusinessData(res.data?.business);
        } catch (err) {
            console.error("Failed to load business details");
        }
    };

    const loadCustomerCount = async () => {
        if (!token) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/customers`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (Array.isArray(data)) {
                setCustomerCount(data.length);
            }
        } catch (err) {
            console.error("Failed to load customer count", err);
        }
    };

    useEffect(() => {
        loadBusiness();
        loadCustomerCount();
    }, [token]);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadInventory();
        }, searchQuery ? 400 : 0); // No delay for initial load
        return () => clearTimeout(timer);
    }, [token, searchQuery, activeTab]);

    // Actions
    const toggleExpand = (id: number) => {
        const product = products.find(p => p.product_id === id);
        if (!product?.has_variants || product.variants.length === 0) {
            toast.info("No variants attached to this product.");
            return;
        }

        const next = new Set(expandedProducts);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedProducts(next);
    };

    const startEdit = (id: number, currentVal: number, hasVariants?: boolean) => {
        if (hasVariants) {
            toggleExpand(id);
            return;
        }
        setEditingId({ id, field: 'total' });
        setEditValue(currentVal);
    };

    const cancelEdit = () => {
        setEditingId(null);
    };

    /**
     * Optimistic Stock Update
     */
    const saveEdit = async (invId: number) => {
        const oldProducts = [...products];
        const newProducts = products.map(p => {
            if (p.inventory_id === invId) {
                const diff = editValue - p.total_quantity;
                return { ...p, total_quantity: editValue, available: p.available + diff };
            }
            const variantIdx = p.variants.findIndex(v => v.inventory_id === invId);
            if (variantIdx !== -1) {
                const newVariants = [...p.variants];
                const diff = editValue - newVariants[variantIdx].total_quantity;
                newVariants[variantIdx] = { ...newVariants[variantIdx], total_quantity: editValue, available: newVariants[variantIdx].available + diff };

                // Also update parent if needed (depends on how total_quantity is calculated, 
                // but usually total_quantity of parent handles sum of variants. For now we just update the specific item.)
                return { ...p, variants: newVariants };
            }
            return p;
        });

        // Step 1: UI updates instantly
        setProducts(newProducts);
        setEditingId(null);

        try {
            // Step 2: Background Sync
            await smartInventoryApi.quickUpdateStock({
                inventory_id: invId,
                new_quantity: editValue,
                reason: "Manual adjustment via Smart Dashboard"
            });
            toast.success("Stock updated successfully");
            // Sync up IDB
            idbSet("inventory_cache", newProducts).catch(console.error);
        } catch (err) {
            toast.error("Update failed");
            setProducts(oldProducts); // Revert
        }
    };

    const openHistory = async (item: InventoryItem | VariantItem) => {
        setHistoryDrawer({ open: true, item });
        setLoadingHistory(true);
        try {
            const isProduct = 'product_id' in item;
            const data = await smartInventoryApi.getAdjustments(
                isProduct ? { product_id: (item as InventoryItem).product_id } : { inventory_id: item.inventory_id }
            );
            setAdjustments(data.adjustments || []);
        } catch (err) {
            toast.error("Failed to load history");
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleDeleteClick = async (product: InventoryItem) => {
        setActiveMenu(null);
        setDeleteModal({ open: true, item: product, safety: null, loading: true });
        try {
            if (!token) return;
            const res = await checkDeletionSafety(product.product_id, token);
            setDeleteModal(prev => ({ ...prev, safety: res.data || res, loading: false }));
        } catch (err) {
            toast.error("Failed to check deletion safety");
            setDeleteModal({ open: false, item: null, safety: null, loading: false });
        }
    };

    /**
     * Optimistic Deletion
     */
    const confirmDeletion = async (permanent: boolean) => {
        if (!deleteModal.item || !token) return;
        const targetId = deleteModal.item.product_id;
        const oldProducts = [...products];

        // Step 1: UI updates instantly
        setProducts(products.filter(p => p.product_id !== targetId));
        setDeleteModal({ open: false, item: null, safety: null, loading: false });

        try {
            // Step 2: Background Sync
            await apiDeleteProduct(targetId, token, permanent);
            toast.success(permanent ? "Product permanently deleted" : "Product archived successfully");
            idbSet("inventory_cache", products.filter(p => p.product_id !== targetId)).catch(console.error);
        } catch (err: any) {
            toast.error(err.body?.message || "Action failed");
            setProducts(oldProducts); // Revert
        }
    };

    const openProductPreview = async (productId: number | string) => {
        const targetId = Number(productId);
        const product = products.find(p => Number(p.product_id) === targetId);

        let initialPayload: PreviewPayload | null = null;

        if (product) {
            // 1. Open instantly with local data
            initialPayload = {
                productId: product.product_id,
                businessId: product.business_id,
                title: product.name,
                description: "Loading full details...",
                category: product.category,
                price: Number(product.base_price),
                quantity: product.total_quantity,
                hasVariants: Boolean(product.has_variants),
                useCombinations: Boolean(product.use_combinations),
                productImages: [{ url: product.image_url, name: "Primary" }],
                productVideo: null,
                params: [],
                variantGroups: [],
                skus: [],
                samePriceForAll: true,
                sharedPrice: Number(product.base_price),
                policyOverrides: undefined
            };
            setPreviewPayload(initialPayload);
        }

        // 2. Hydrate full details from API (works even if product was not in local list)
        setLoadingPreview(targetId);
        try {
            const res = await fetchProductByIdApi(targetId, token);
            const data = res.data?.product || res.data || res;
            if (!data) throw new Error("Product data empty");

            const fullPayload: PreviewPayload = {
                productId: data.product_id,
                businessId: data.business_id,
                title: data.title,
                description: data.description,
                category: data.category_name || data.category,
                price: Number(data.price),
                quantity: data.quantity,
                hasVariants: Boolean(data.has_variants),
                useCombinations: Boolean(data.use_combinations),
                productImages: (data.media || []).filter((m: any) => m.type === 'image' || !m.type).map((m: any, i: number) => ({
                    url: m.url || m,
                    name: `Image ${i + 1}`
                })),
                productVideo: data.media?.find((m: any) => m.type === 'video')?.url ? {
                    url: data.media.find((m: any) => m.type === 'video').url,
                    name: "Product Video"
                } : null,
                params: data.params || [],
                variantGroups: (data.variant_groups || data.variants_structure || []).map((g: any) => ({
                    id: String(g.group_id || g.id),
                    title: g.title,
                    allowImages: !!g.allow_images,
                    entries: (g.options || g.entries || []).map((o: any) => ({
                        id: String(o.option_id || o.id),
                        name: o.name,
                        quantity: o.quantity || o.initial_quantity || 0,
                        price: o.price,
                        images: o.media?.map((m: any) => ({ url: m.url })) || []
                    }))
                })),
                skus: (data.skus || []).map((s: any) => ({
                    ...s,
                    id: String(s.sku_id || s.id),
                    variantOptionIds: s.variant_option_ids ? (typeof s.variant_option_ids === 'string' ? JSON.parse(s.variant_option_ids) : s.variant_option_ids).map(String) : []
                })),
                samePriceForAll: Boolean(data.same_price_for_all),
                sharedPrice: Number(data.shared_price || data.price),
                policyOverrides: data.policy_overrides || undefined
            };
            setPreviewPayload(fullPayload);
        } catch (err) {
            console.error("Background preview load failed:", err);
            if (!product) {
                toast.error("Could not load product details.");
            }
        } finally {
            setLoadingPreview(null);
        }
    };

    // UI Helpers
    const getStockBadge = (available: number, lowAlert: number) => {
        if (available <= 0) return <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-700 font-medium">Out of Stock</span>;
        if (available <= (lowAlert || 5)) return <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-700 font-medium">Low Stock</span>;
        return <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-700 font-medium">In Stock</span>;
    };

    return (
        <div className="min-h-screen bg-slate-100 pb-20">
            {/* Header */}
            <div className="sticky top-0 lg:top-16 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 pt-[env(safe-area-inset-top,12px)]">
                <div className="flex items-center justify-between gap-4 py-3">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600 sm:hidden"
                        >
                            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
                        </button>
                        <div className="hidden sm:flex items-center gap-2 p-1 bg-slate-100 rounded-xl overflow-x-auto scrollbar-hide">
                            <button
                                onClick={() => setViewMode('inventory')}
                                className={`px-4 py-2 rounded-[0.5rem] text-sm transition-all whitespace-nowrap ${viewMode === 'inventory' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Inventory
                            </button>
                            <button
                                onClick={() => setViewMode('customers')}
                                className={`px-4 py-2 rounded-[0.5rem] text-sm  transition-all whitespace-nowrap ${viewMode === 'customers' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Customers {customerCount > 0 && `(${customerCount})`}
                            </button>
                            <button
                                onClick={() => setViewMode('insights')}
                                className={`px-4 py-2 rounded-[0.5rem] text-sm  transition-all whitespace-nowrap ${viewMode === 'insights' ? 'bg-white text-rose-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Shop Insights
                            </button>
                        </div>
                        <h1 className="text-lg font-black text-slate-900 sm:hidden">
                            {viewMode === 'inventory' ? 'Inventory' : viewMode === 'customers' ? `Customers (${customerCount})` : 'Shop Insights'}
                        </h1>
                    </div>

                    <div className="flex items-center gap-3">
                        {refreshing && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                        <button
                            onClick={() => loadInventory(true)}
                            className="p-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors hidden sm:flex items-center justify-center shadow-sm"
                            title="Refresh"
                        >
                            <RefreshCcw className={`w-4 h-4 text-slate-600 ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={async () => {
                                const ok = await auth.ensureAccountVerified();
                                if (ok) router.push('/profile/business/inventory/add-product');
                            }}
                            className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-rose-600 text-white rounded-full shadow-md shadow-rose-200 hover:bg-rose-700 active:scale-[0.98] transition-all text-[10px] sm:text-xs font-bold whitespace-nowrap"
                        >
                            Add product
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-4 max-w-7xl mx-auto space-y-6">

                {viewMode === 'customers' && <CustomersTab />}
                {viewMode === 'insights' && (
                    <InsightsTab
                        products={products}
                        onProductClick={openProductPreview}
                        onInsightClick={(product) => setInsightModal({ open: true, product })}
                        loadingPreview={loadingPreview}
                        totalCustomers={customerCount}
                    />
                )}

                {viewMode === 'inventory' && (
                    <>
                        {/* Stats Row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <StatCard
                                label="Total Products"
                                value={stats.totalItems}
                                icon={<Inbox className="w-5 h-5 text-slate-600" />}
                                color="red"
                            />
                            <StatCard
                                label="Low Stock Items"
                                value={stats.lowStock}
                                icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
                                color="amber"
                                alert={stats.lowStock > 0}
                            />
                            <StatCard
                                label="Out of Stock"
                                value={stats.outOfStock}
                                icon={<MinusCircle className="w-5 h-5 text-rose-600" />}
                                color="red"
                                alert={stats.outOfStock > 0}
                            />
                            <StatCard
                                label="Reserved Stock"
                                value={stats.totalReserved}
                                icon={<ArrowRight className="w-5 h-5 text-emerald-600" />}
                                color="emerald"
                            />
                        </div>

                        {/* Controls */}
                        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-[0.5rem] border border-slate-200">
                            <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-[0.5rem]">
                                <TabButton active={activeTab === 'all'} onClick={() => setActiveTab('all')}>All</TabButton>
                                <TabButton active={activeTab === 'low_stock'} onClick={() => setActiveTab('low_stock')}>Low Stock</TabButton>
                                <TabButton active={activeTab === 'out_of_stock'} onClick={() => setActiveTab('out_of_stock')}>Out of Stock</TabButton>
                            </div>

                            <div className="relative w-full md:w-80">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search by name or SKU..."
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Inventory Table (Desktop/Tablet) */}
                        <div className="hidden md:block bg-white rounded-[0.5rem] border border-slate-200">
                            <div className="">
                                <table className="w-full text-left border-collapse min-w-[900px]">
                                    <thead>
                                        <tr className="bg-slate-50/50 border-b border-slate-200">
                                            <th className="px-6 py-4 text-xs font-semibold text-slate-500  tracking-wider">Product Info</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-slate-500  tracking-wider text-center">Available</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-slate-500  tracking-wider text-center">Reserved</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-slate-500  tracking-wider text-center">In Hand (Total)</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-slate-500  tracking-wider">Status</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-slate-500  tracking-wider text-right whitespace-nowrap">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {loading ? (
                                            Array(5).fill(0).map((_, i) => <SkeletonRow key={i} />)
                                        ) : products.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="px-6 py-20 text-center">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <Inbox className="w-12 h-12 text-slate-200" />
                                                        <p className="text-slate-500 font-medium">No inventory items found.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            products.map(product => (
                                                <React.Fragment key={product.product_id}>
                                                    <tr
                                                        className={`${expandedProducts.has(product.product_id) ? 'bg-slate-50/30' : 'hover:bg-slate-50/30'} group transition-colors ${activeMenu === product.product_id ? 'relative z-[60]' : ''}`}
                                                    >
                                                        {/* Info */}
                                                        <td className="px-6 py-2.5">
                                                            <div className="flex items-center gap-4">
                                                                <div
                                                                    className="relative group cursor-pointer"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleExpand(product.product_id);
                                                                    }}
                                                                >
                                                                    {/* Main Product Image */}
                                                                    <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-200 relative z-10">
                                                                        {product.image_url ? (
                                                                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                                                        ) : (
                                                                            <Package className="w-full h-full p-3 text-slate-300" />
                                                                        )}
                                                                    </div>
                                                                    {/* Variant Circles (if anyone has images) */}
                                                                    {product.variants.length > 0 && product.variants.some(v => v.image_url) && (
                                                                        <div className="flex -space-x-3 mt-1.5 ml-0.5">
                                                                            {product.variants.slice(0, 4).map((v, idx) => (
                                                                                <div
                                                                                    key={v.id}
                                                                                    className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 overflow-hidden flex-shrink-0 shadow-sm first:ml-0 group-hover:translate-x-0.5 transition-transform"
                                                                                    style={{ zIndex: 5 - idx }}
                                                                                    title={v.name}
                                                                                >
                                                                                    <img
                                                                                        src={v.image_url || product.image_url}
                                                                                        alt={v.name}
                                                                                        className="w-full h-full object-cover"
                                                                                    />
                                                                                </div>
                                                                            ))}
                                                                            {product.variants.length > 4 && (
                                                                                <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-600 z-[20] shadow-sm ml-1">
                                                                                    +{product.variants.length - 4}
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <p
                                                                        onClick={() => openProductPreview(product.product_id)}
                                                                        className="text-sm font-semibold text-slate-900 cursor-pointer hover:text-rose-600 transition-colors line-clamp-1 flex items-center gap-2"
                                                                    >
                                                                        {product.name}
                                                                        {loadingPreview === product.product_id && <Loader2 className="w-3 h-3 animate-spin text-rose-500" />}
                                                                    </p>
                                                                    <p className="text-xs text-slate-500">{product.category}</p>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        {/* Available */}
                                                        <td className="px-6 py-2.5 text-center">
                                                            <span className={`text-sm font-bold ${product.available <= 0 ? 'text-rose-500' : 'text-slate-900'}`}>{product.available}</span>
                                                        </td>

                                                        {/* Reserved */}
                                                        <td className="px-6 py-2.5 text-center">
                                                            <span className={`text-sm font-medium ${product.reserved > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                                                                {product.reserved > 0 ? `+${product.reserved}` : '0'}
                                                            </span>
                                                        </td>

                                                        {/* Total (In Hand) */}
                                                        <td
                                                            className="px-6 py-2.5 text-center"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <EditableCell
                                                                id={product.product_id}
                                                                value={product.total_quantity}
                                                                inventory_id={product.inventory_id}
                                                                isEditing={editingId?.id === product.product_id}
                                                                onSave={() => saveEdit(product.inventory_id)}
                                                                onCancel={cancelEdit}
                                                                onStartEdit={() => startEdit(product.product_id, product.total_quantity, Boolean(product.has_variants))}
                                                                editValue={editValue}
                                                                setEditValue={setEditValue}
                                                                hasVariants={Boolean(product.has_variants)}
                                                                isExpanded={expandedProducts.has(product.product_id)}
                                                            />
                                                        </td>

                                                        {/* Status */}
                                                        <td className="px-6 py-2.5">
                                                            {getStockBadge(product.available, product.low_stock_alert)}
                                                        </td>

                                                        {/* Actions */}
                                                        <td className="px-6 py-2.5 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                {Boolean(product.has_variants) && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            toggleExpand(product.product_id);
                                                                        }}
                                                                        className={`p-2 rounded-lg transition-all ${expandedProducts.has(product.product_id) ? 'bg-rose-50 text-rose-600' : 'hover:bg-slate-100 text-slate-400'}`}
                                                                    >
                                                                        {expandedProducts.has(product.product_id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        openHistory(product);
                                                                    }}
                                                                    className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-all"
                                                                    title="View History"
                                                                >
                                                                    <History className="w-4 h-4" />
                                                                </button>

                                                                <div className="relative">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setActiveMenu(activeMenu === product.product_id ? null : product.product_id);
                                                                        }}
                                                                        className={`p-2 rounded-lg transition-all ${activeMenu === product.product_id ? 'bg-rose-50 text-rose-600' : 'hover:bg-slate-100 text-slate-400'}`}
                                                                        title="Manage Product"
                                                                    >
                                                                        <MoreVertical className="w-4 h-4" />
                                                                    </button>

                                                                    <AnimatePresence>
                                                                        {activeMenu === product.product_id && (
                                                                            <>
                                                                                <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)} />
                                                                                <motion.div
                                                                                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                                                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                                                                    className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-2xl z-[100] overflow-hidden"
                                                                                >
                                                                                    <div className="p-2 space-y-1">
                                                                                        <button
                                                                                            onClick={() => {
                                                                                                setActiveMenu(null);
                                                                                                router.push(`/profile/business/inventory/edit-product?product_id=${product.product_id}`);
                                                                                            }}
                                                                                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-all text-left"
                                                                                        >
                                                                                            <Edit3 className="w-4 h-4 text-slate-400" />
                                                                                            Edit Details
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={() => {
                                                                                                setActiveMenu(null);
                                                                                                setInsightModal({ open: true, product });
                                                                                            }}
                                                                                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-all text-left"
                                                                                        >
                                                                                            <TrendingUp className="w-4 h-4 text-amber-500" />
                                                                                            Product Insight
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={() => window.open(`/shop/${product.business_slug || product.business_id}?product_id=${product.product_id}`, '_blank')}
                                                                                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-all text-left"
                                                                                        >
                                                                                            <Eye className="w-4 h-4 text-slate-400" />
                                                                                            View on Shop
                                                                                        </button>
                                                                                        <div className="my-1 border-t border-slate-100" />
                                                                                        <button
                                                                                            onClick={() => handleDeleteClick(product)}
                                                                                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-lg transition-all text-left"
                                                                                        >
                                                                                            <MinusCircle className="w-4 h-4 text-rose-400" />
                                                                                            Delete Product
                                                                                        </button>
                                                                                    </div>
                                                                                </motion.div>
                                                                            </>
                                                                        )}
                                                                    </AnimatePresence>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>

                                                    {/* Variants Expansion */}
                                                    <AnimatePresence>
                                                        {expandedProducts.has(product.product_id) && (
                                                            <motion.tr
                                                                initial={{ opacity: 0, height: 0 }}
                                                                animate={{ opacity: 1, height: 'auto' }}
                                                                exit={{ opacity: 0, height: 0 }}
                                                            >
                                                                <td colSpan={7} className="px-6 py-0 bg-slate-50/50">
                                                                    <div className="pl-12 pr-4 py-4 space-y-2">
                                                                        <div className="flex items-center justify-between mb-2">
                                                                            <p className="text-[10px] font-bold text-slate-400  tracking-widest pl-2">Product Variants</p>
                                                                        </div>
                                                                        <div className="grid grid-cols-6 items-center px-3 py-1 bg-slate-100/50 rounded-t-lg border-x border-t border-slate-200 text-[10px] font-bold text-slate-500  tracking-tight">
                                                                            <div className="col-span-1">Variant Name</div>
                                                                            <div className="col-span-1 text-center">Available</div>
                                                                            <div className="col-span-1 text-center">Reserved</div>
                                                                            <div className="col-span-1 text-center">In Hand</div>
                                                                            <div className="col-span-1">Status</div>
                                                                            <div className="col-span-1 text-right pr-2">Logs</div>
                                                                        </div>
                                                                        {product.variants.map((v, i) => (
                                                                            <motion.div
                                                                                key={v.id}
                                                                                initial={{ opacity: 0, x: -10 }}
                                                                                animate={{ opacity: 1, x: 0 }}
                                                                                transition={{ delay: i * 0.05 }}
                                                                                className={`grid grid-cols-6 items-center bg-white border border-slate-200 ${i === product.variants.length - 1 ? 'rounded-b-lg' : 'border-b-0'} p-2 shadow-sm hover:border-rose-300 transition-all`}
                                                                            >
                                                                                <div className="col-span-1 flex items-center gap-3">
                                                                                    {product.variants.some(vv => vv.image_url) && (
                                                                                        <div className="w-6 h-6 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                                                                                            <img
                                                                                                src={v.image_url || product.image_url}
                                                                                                alt={v.name}
                                                                                                className="w-full h-full object-cover shadow-sm"
                                                                                            />
                                                                                        </div>
                                                                                    )}
                                                                                    <span className="text-sm font-medium text-slate-700">{v.name}</span>
                                                                                </div>
                                                                                <div className="col-span-1 text-center font-bold text-sm text-slate-900">{v.available}</div>
                                                                                <div className="col-span-1 text-center text-sm font-medium text-amber-500">{v.reserved > 0 ? `+${v.reserved}` : '0'}</div>
                                                                                <div className="col-span-1 flex justify-center">
                                                                                    <EditableCell
                                                                                        id={v.id}
                                                                                        value={v.total_quantity}
                                                                                        inventory_id={v.inventory_id}
                                                                                        isEditing={editingId?.id === v.id}
                                                                                        onSave={saveEdit}
                                                                                        onCancel={cancelEdit}
                                                                                        onStartEdit={() => startEdit(v.id, v.total_quantity)}
                                                                                        editValue={editValue}
                                                                                        setEditValue={setEditValue}
                                                                                        compact
                                                                                    />
                                                                                </div>
                                                                                <div className="col-span-1">{getStockBadge(v.available, v.low_stock_alert)}</div>
                                                                                <div className="col-span-1 text-right">
                                                                                    <button
                                                                                        onClick={() => openHistory(v)}
                                                                                        className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-rose-600 rounded-md transition-all"
                                                                                    >
                                                                                        <History className="w-3.5 h-3.5" />
                                                                                    </button>
                                                                                </div>
                                                                            </motion.div>
                                                                        ))}
                                                                    </div>
                                                                </td>
                                                            </motion.tr>
                                                        )}
                                                    </AnimatePresence>
                                                </React.Fragment>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Mobile View */}
                        <div className="md:hidden space-y-1">
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <div key={i} className="h-32 bg-white rounded-xl border border-slate-200 animate-pulse mb-3" />
                                ))
                            ) : products.length === 0 ? (
                                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                                    <Inbox className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                                    <p className="text-slate-500 font-medium">No items found.</p>
                                </div>
                            ) : (
                                products.map(product => (
                                    <MobileProductCard
                                        key={product.product_id}
                                        product={product}
                                        onExpand={toggleExpand}
                                        onHistory={openHistory}
                                        onMenu={setActiveMenu}
                                        expanded={expandedProducts.has(product.product_id)}
                                        activeMenu={activeMenu}
                                        getStockBadge={getStockBadge}
                                        editingId={editingId}
                                        editValue={editValue}
                                        setEditValue={setEditValue}
                                        saveEdit={saveEdit}
                                        cancelEdit={cancelEdit}
                                        startEdit={startEdit}
                                        handleDeleteClick={handleDeleteClick}
                                        router={router}
                                        onPreview={openProductPreview}
                                        loadingPreview={loadingPreview}
                                    />
                                ))
                            )}
                        </div>

                        {/* History Side Drawer */}
                        <AnimatePresence>
                            {historyDrawer.open && (
                                <div className="fixed inset-0 z-[1100] flex justify-end">
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        onClick={() => setHistoryDrawer({ open: false, item: null })}
                                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                                    />
                                    <motion.div
                                        initial={{ x: '100%' }}
                                        animate={{ x: 0 }}
                                        exit={{ x: '100%' }}
                                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                        className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col p-0"
                                    >
                                        <div className="flex items-center justify-between p-6 border-b border-slate-200">
                                            <div className="flex items-center gap-2">
                                                <History className="w-5 h-5 text-rose-600" />
                                                <div>
                                                    <h2 className="text-lg font-bold text-slate-900">Inventory Logs</h2>
                                                    <p className="text-xs text-slate-500">{historyDrawer.item?.name}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setHistoryDrawer({ open: false, item: null })}
                                                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-all"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                            {loadingHistory ? (
                                                <div className="flex flex-col items-center justify-center py-20 gap-3">
                                                    <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
                                                    <p className="text-sm text-slate-500">Retrieving logs...</p>
                                                </div>
                                            ) : adjustments.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
                                                    <Inbox className="w-12 h-12 text-slate-200" />
                                                    <p className="text-slate-500 font-medium">No movement logs found.</p>
                                                    <p className="text-xs text-slate-400">All historical adjustments will appear here.</p>
                                                </div>
                                            ) : (
                                                <div className="relative space-y-6 before:absolute before:inset-y-0 before:left-[11px] before:w-0.5 before:bg-slate-100">
                                                    {adjustments.map((log, idx) => (
                                                        <div key={log.adjustment_id} className="relative pl-8 animate-in fade-in slide-in-from-right-2" style={{ animationDelay: `${idx * 50}ms` }}>
                                                            <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center ${log.change_type === 'addition' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                                                                {log.change_type === 'addition' ? <PlusCircle className="w-3 h-3 text-white" /> : <MinusCircle className="w-3 h-3 text-white" />}
                                                            </div>
                                                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 hover:shadow-md transition-all">
                                                                <div className="flex items-center justify-between">
                                                                    <span className={`text-[10px] font-bold  tracking-wider px-2 py-0.5 rounded-full ${log.change_type === 'addition' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                                        {log.change_type === 'addition' ? 'Stock Addition' : 'Stock Removal'}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400 font-medium">{new Date(log.created_at).toLocaleString()}</span>
                                                                </div>
                                                                {log.variant_name && (
                                                                    <p className="text-[10px] font-bold text-rose-500  tracking-tight">Variant: {log.variant_name}</p>
                                                                )}
                                                                <p className="text-sm font-semibold text-slate-900">
                                                                    {log.change_type === 'addition' ? '+' : '-'}{log.quantity_change} units
                                                                </p>
                                                                <p className="text-xs text-slate-600 italic bg-amber-50 px-2 py-1 rounded border border-amber-100/50">"{log.reason}"</p>
                                                                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                                                                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                                                        <div className="flex flex-col">
                                                                            <span>From: <b className="text-slate-700">{log.previous_quantity}</b></span>
                                                                            <span>To: <b className="text-rose-600 font-bold">{log.new_quantity}</b></span>
                                                                        </div>
                                                                    </div>
                                                                    <span className="text-[10px] text-slate-500">By: <b className="text-slate-800">{log.adjusted_by_name || 'System'}</b></span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                </div>
                            )}
                        </AnimatePresence>

                        {/* Delete/Archive Confirmation Modal */}
                        <AnimatePresence>
                            {deleteModal.open && (
                                <div className="fixed inset-0 z-[1110] flex items-end sm:items-center justify-center p-0 md:p-4">
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                                        onClick={() => !deleteModal.loading && setDeleteModal({ open: false, item: null, safety: null, loading: false })}
                                    />
                                    <motion.div
                                        initial={{ opacity: 0, y: "100%" }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: "100%" }}
                                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                        className="relative bg-white rounded-t-3xl md:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden sm:max-h-[90vh] max-h-[70vh] flex flex-col"
                                    >
                                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />
                                        <div className="p-6 overflow-y-auto">
                                            <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mb-4">
                                                <AlertTriangle className="w-6 h-6 text-rose-600 text-center" />
                                            </div>
                                            <h3 className="text-xl font-bold text-slate-900 mb-2 text-center">
                                                {deleteModal.loading && !deleteModal.safety ? "Checking safety..." : "Delete Product?"}
                                            </h3>

                                            {deleteModal.loading && !deleteModal.safety ? (
                                                <div className="flex items-center gap-3 py-4">
                                                    <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                                                    <p className="text-sm text-slate-500 font-medium">Checking for orders and usage history...</p>
                                                </div>
                                            ) : (
                                                <>
                                                    {deleteModal.safety?.canDelete ? (
                                                        <p className="text-slate-600 mb-6 ">
                                                            Are you sure you want to permanently delete <span className="font-bold text-slate-900">"{deleteModal.item?.name}"</span>?
                                                            This action cannot be undone.
                                                        </p>
                                                    ) : (
                                                        <p className="text-slate-600 mb-6 font-medium">
                                                            This product has existing orders, history, or activity and <span className="font-bold text-rose-600">cannot be deleted</span>.
                                                            You can archive it instead to hide it from your shop.
                                                        </p>
                                                    )}

                                                    <div className="flex flex-col gap-3">
                                                        {deleteModal.safety?.canDelete ? (
                                                            <button
                                                                disabled={deleteModal.loading}
                                                                onClick={() => confirmDeletion(true)}
                                                                className="w-full py-3 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 transition-all flex items-center justify-center gap-2"
                                                            >
                                                                {deleteModal.loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Permanently Delete"}
                                                            </button>
                                                        ) : (
                                                            <button
                                                                disabled={deleteModal.loading}
                                                                onClick={() => confirmDeletion(false)}
                                                                className="w-full py-2 bg-rose-500 text-white rounded-full hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                                                            >
                                                                {deleteModal.loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Archive Product"}
                                                            </button>
                                                        )}
                                                        <button
                                                            disabled={deleteModal.loading}
                                                            onClick={() => setDeleteModal({ open: false, item: null, safety: null, loading: false })}
                                                            className="w-full py-2 bg-white text-slate-600 border border-slate-200 rounded-full hover:bg-slate-50 transition-all"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </motion.div>
                                </div>
                            )}
                        </AnimatePresence>
                    </>
                )}

                {/* Global Modals */}
                {previewPayload && (
                    <PreviewModal
                        open={true}
                        payload={previewPayload}
                        onClose={() => setPreviewPayload(null)}
                    />
                )}
                <ProductInsightModal
                    isOpen={insightModal.open}
                    onClose={() => setInsightModal({ open: false, product: null })}
                    product={insightModal.product}
                />

                {/* Mobile Bottom Navigation */}
                <div className="fixed bottom-0 left-0 right-0 z-[100] bg-white border-t border-slate-200 px-6 py-3 pb-[env(safe-area-inset-bottom,12px)] sm:hidden flex items-center justify-between shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
                    <button
                        onClick={() => setViewMode('inventory')}
                        className={`flex flex-col items-center gap-1 transition-all ${viewMode === 'inventory' ? 'text-rose-500 scale-110' : 'text-slate-400'}`}
                    >
                        <Package className={`w-4 h-4 ${viewMode === 'inventory' ? 'fill-rose-50' : ''}`} />
                        <span className="text-[10px] ">Inventory</span>
                    </button>

                    <button
                        onClick={() => setViewMode('customers')}
                        className={`flex flex-col items-center gap-1 transition-all ${viewMode === 'customers' ? 'text-rose-500 scale-110' : 'text-slate-400'}`}
                    >
                        <div className="relative">
                            <Users className={`w-4 h-4 ${viewMode === 'customers' ? 'fill-rose-50' : ''}`} />
                            {customerCount > 0 && (
                                <span className="absolute -top-1.5 -right-2 bg-rose-600 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                                    {customerCount > 99 ? '99+' : customerCount}
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] ">Customers</span>
                    </button>

                    <button
                        onClick={() => setViewMode('insights')}
                        className={`flex flex-col items-center gap-1 transition-all ${viewMode === 'insights' ? 'text-rose-500 scale-110' : 'text-slate-400'}`}
                    >
                        <BarChart3 className={`w-4 h-4 ${viewMode === 'insights' ? 'fill-rose-50' : ''}`} />
                        <span className="text-[10px] ">Insights</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

const MobileProductCard = React.memo(({
    product,
    onExpand,
    onHistory,
    onMenu,
    expanded,
    activeMenu,
    getStockBadge,
    editingId,
    editValue,
    setEditValue,
    saveEdit,
    cancelEdit,
    startEdit,
    handleDeleteClick,
    router,
    onPreview,
    loadingPreview
}: any) => {
    return (
        <div className={`bg-white rounded-2xl border ${expanded ? 'border-rose-200 ring-2 ring-rose-50' : 'border-slate-200 shadow-sm'} transition-all duration-300 ${activeMenu === product.product_id ? 'relative z-[30]' : 'relative'}`}>
            <div className="p-4 space-y-4">
                {/* Header: Info & Menu */}
                <div className="flex items-start gap-4">
                    <div
                        className="w-20 h-20 rounded-xl bg-slate-50 overflow-hidden border border-slate-100 shrink-0 cursor-pointer"
                        onClick={() => onPreview(product.product_id)}
                    >
                        <img
                            src={product.image_url || "/placeholder.png"}
                            className="w-full h-full object-cover"
                            alt={product.name}
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                                <h4
                                    onClick={() => onPreview(product.product_id)}
                                    className="font-black text-slate-900 leading-tight text-xs tracking-wider line-clamp-2 cursor-pointer hover:text-rose-600 transition-colors flex items-center gap-2"
                                >
                                    {product.name}
                                    {loadingPreview === product.product_id && <Loader2 className="w-3 h-3 animate-spin text-rose-500" />}
                                </h4>
                                <p className="text-[10px] text-slate-400 font-bold  tracking-[0.15em] mt-1">
                                    {product.category}
                                </p>
                            </div>
                            <div className="relative">
                                <button
                                    onClick={() => onMenu(activeMenu === product.product_id ? null : product.product_id)}
                                    className={`p-2 rounded-lg transition-all ${activeMenu === product.product_id ? 'bg-rose-600 text-white' : 'bg-slate-50 text-slate-400 border border-slate-100 hover:bg-slate-100'}`}
                                >
                                    <MoreVertical className="w-4 h-4" />
                                </button>

                                <AnimatePresence>
                                    {activeMenu === product.product_id && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.9, y: -10 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.9, y: -10 }}
                                            className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-[0.5rem] z-[100] overflow-hidden shadow-2xl ring-1 ring-black/5"
                                        >
                                            <div className="p-2 space-y-1">
                                                <button
                                                    onClick={() => {
                                                        onMenu(null);
                                                        router.push(`/profile/business/inventory/edit-product?product_id=${product.product_id}`);
                                                    }}
                                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-xl transition-all"
                                                >
                                                    <Edit3 className="w-4 h-4 text-rose-500" />
                                                    Edit Details
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        onMenu(null);
                                                        // Using the parent's generic way to trigger insight modal
                                                        // (passed down via a prop if we want, or just dispatching an event. We'll pass it as onInsight)
                                                        if (typeof window !== 'undefined') {
                                                            window.dispatchEvent(new CustomEvent('open-insight', { detail: product }));
                                                        }
                                                    }}
                                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-xl transition-all"
                                                >
                                                    <TrendingUp className="w-4 h-4 text-amber-500" />
                                                    Product Insight
                                                </button>
                                                <button
                                                    onClick={() => window.open(`/shop/${product.business_id}?product_id=${product.product_id}`, '_blank')}
                                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-xl transition-all"
                                                >
                                                    <Eye className="w-4 h-4 text-emerald-500" />
                                                    View in shop
                                                </button>
                                                <div className="my-1 border-t border-slate-100 mx-1" />
                                                <button
                                                    onClick={() => {
                                                        onMenu(null);
                                                        handleDeleteClick(product);
                                                    }}
                                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                                >
                                                    <MinusCircle className="w-4 h-4" />
                                                    Delete
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {getStockBadge(product.available, product.low_stock_alert)}
                        </div>
                    </div>
                </div>

                {/* Stats Section */}
                <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-1 flex items-stretch">
                    <div className="flex-1 px-3 py-2.5 text-center">
                        <p className="text-[9px] font-black text-slate-400  tracking-widest mb-1.5 opacity-60">Available</p>
                        <p className={`text-sm font-black ${product.available <= 0 ? 'text-rose-500' : 'text-slate-900 border-b-2 border-rose-100 inline-block'}`}>
                            {product.available}
                        </p>
                    </div>
                    <div className="w-px bg-slate-200/50 my-2" />
                    <div className="flex-1 px-3 py-2.5 text-center">
                        <p className="text-[9px] font-black text-slate-400  tracking-widest mb-1.5 opacity-60">Reserved</p>
                        <p className={`text-sm font-black ${product.reserved > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                            {product.reserved > 0 ? `+${product.reserved}` : '0'}
                        </p>
                    </div>
                    <div className="w-px bg-slate-200 my-2" />
                    <div className="flex-1 px-3 py-2.5 text-center">
                        <p className="text-[9px] font-black text-slate-400  tracking-widest mb-1.5 opacity-60">In Hand</p>
                        <div className="flex justify-center scale-90 origin-center bg-white rounded-lg shadow">
                            <EditableCell
                                id={product.product_id}
                                value={product.total_quantity}
                                inventory_id={product.inventory_id}
                                isEditing={editingId?.id === product.product_id}
                                onSave={() => saveEdit(product.inventory_id)}
                                onCancel={cancelEdit}
                                onStartEdit={() => startEdit(product.product_id, product.total_quantity, Boolean(product.has_variants))}
                                editValue={editValue}
                                setEditValue={setEditValue}
                                hasVariants={Boolean(product.has_variants)}
                                isExpanded={expanded}
                                compact
                            />
                        </div>
                    </div>
                </div>

                {/* Main Actions */}
                <div className="flex items-center gap-2 pt-1">
                    <button
                        onClick={() => onHistory(product)}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 text-slate-600 rounded-full text-[10px] font-black tracking-widest  active:scale-95 transition-all shadow-sm shadow-slate-100"
                    >
                        <History className="w-3.5 h-3.5" />
                        History
                    </button>
                    {product.has_variants && (
                        <button
                            onClick={() => onExpand(product.product_id)}
                            className={`flex-[1.5] flex items-center justify-center gap-2 py-3 rounded-full text-[10px] font-black  active:scale-95 transition-all border ${expanded ? 'bg-rose-500 border-rose-500 text-white shadow-xl shadow-rose-100' : 'bg-rose-50 border-rose-100 text-rose-700'}`}
                        >
                            <LayoutGrid className="w-3.5 h-3.5" />
                            {expanded ? "Hide variants" : `Variants (${product.variants.length})`}
                        </button>
                    )}
                </div>
            </div>

            {/* Variants Mobile View */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-slate-50/30 border-t border-slate-100 p-4 space-y-3"
                    >
                        <div className="flex items-center justify-between mb-1 px-1">
                            <h5 className="text-[9px] font-black text-rose-400 tracking-[0.2em] ">Variant Breakdown</h5>
                        </div>
                        {product.variants.map((v: any, idx: number) => (
                            <motion.div
                                key={v.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="bg-white p-3 rounded-[0.5rem] border border-slate-200 space-y-3 hover:border-rose-200 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 overflow-hidden shrink-0 shadow-inner">
                                            <img
                                                src={v.image_url || product.image_url}
                                                className="w-full h-full object-cover"
                                                alt={v.name}
                                            />
                                        </div>
                                        <p className="text-xs font-black text-slate-800 tracking-tight">{v.name}</p>
                                    </div>
                                    <button
                                        onClick={() => onHistory(v)}
                                        className="p-2 hover:bg-slate-50 text-slate-300 hover:text-rose-400 rounded-xl transition-all"
                                    >
                                        <History className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="grid grid-cols-3 gap-2 border-t border-slate-50">
                                    <div className="text-center">
                                        <p className="text-[8px] font-bold text-slate-400  tracking-wider mb-0.5">Avail</p>
                                        <p className="text-xs font-black text-slate-900">{v.available}</p>
                                    </div>
                                    <div className="text-center border-x border-slate-100/50">
                                        <p className="text-[8px] font-bold text-slate-400  tracking-wider mb-0.5">Resv</p>
                                        <p className={`text-xs font-black ${v.reserved > 0 ? 'text-amber-500' : 'text-slate-300'}`}>{v.reserved}</p>
                                    </div>
                                    <div className="text-center flex flex-col items-center">
                                        <p className="text-[8px] font-bold text-slate-400  tracking-wider mb-0.5">Hand</p>
                                        <div className="bg-slate-50 rounded-lg shadow-inner scale-75 origin-top px-1">
                                            <EditableCell
                                                id={v.id}
                                                value={v.total_quantity}
                                                inventory_id={v.inventory_id}
                                                isEditing={editingId?.id === v.id}
                                                onSave={saveEdit}
                                                onCancel={cancelEdit}
                                                onStartEdit={() => startEdit(v.id, v.total_quantity)}
                                                editValue={editValue}
                                                setEditValue={setEditValue}
                                                compact
                                            />
                                        </div>
                                    </div>
                                    <div>{getStockBadge(v.available, v.low_stock_alert)}</div>
                                </div>

                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});

// --- Sub-components (StatCard, etc) ---

const StatCard = React.memo(({ label, value, icon, color, alert }: { label: string; value: number | string; icon: any; color: string; alert?: boolean }) => {
    const colors: Record<string, string> = {
        red: "bg-rose-50 text-rose-600",
        amber: "bg-amber-100 text-amber-700",
        emerald: "bg-emerald-50 text-emerald-600",
    };

    return (
        <div className={`bg-white px-5 py-4 rounded-[0.5rem] border ${alert ? 'border-rose-200 ring-2 ring-rose-50' : 'border-slate-200'}  relative overflow-hidden group hover:shadow-md transition-all`}>
            <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black text-slate-400 tracking-[0.1em] ">{label}</span>
                <div className={`${colors[color]} w-8 h-8 rounded-lg flex items-center justify-center shrink-0`}>
                    {React.cloneElement(icon, { size: 16 })}
                </div>
            </div>
            <div className="flex items-baseline gap-1">
                <h3 className="text-2xl font-black text-slate-900 leading-none">{value.toLocaleString()}</h3>
            </div>
            {alert && (
                <div className="absolute top-2 right-2 flex h-2 w-2 pointer-events-none">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </div>
            )}
            <div className={`absolute bottom-0 left-0 h-1 transition-all group-hover:w-full w-8 ${colors[color].split(' ')[0]}`} />
        </div>
    );
});

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${active ? 'bg-white shadow-sm text-rose-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
            {children}
        </button>
    );
}

function EditableCell({
    id, value, inventory_id, isEditing, onSave, onCancel, onStartEdit, editValue, setEditValue, compact = false, hasVariants = false, isExpanded = false
}: {
    id: number;
    value: number;
    inventory_id: number;
    isEditing: boolean;
    onSave: (invId: number) => void;
    onCancel: () => void;
    onStartEdit: () => void;
    editValue: number;
    setEditValue: (v: number) => void;
    compact?: boolean;
    hasVariants?: boolean;
    isExpanded?: boolean;
}) {
    if (isEditing) {
        return (
            <div className="flex items-center justify-center gap-1 animate-in zoom-in-95 duration-200">
                <input
                    autoFocus
                    type="number"
                    className="w-16 h-8 text-center bg-white border-2 border-rose-500 rounded-md outline-none text-sm font-bold shadow-sm"
                    value={editValue}
                    onChange={(e) => setEditValue(Number(e.target.value))}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') onSave(inventory_id);
                        if (e.key === 'Escape') onCancel();
                    }}
                />
                <div className="flex flex-col gap-0.5">
                    <button onClick={() => onSave(inventory_id)} className="p-0.5 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors">
                        <Check className="w-3 h-3" />
                    </button>
                    <button onClick={onCancel} className="p-0.5 bg-slate-200 text-slate-600 rounded hover:bg-slate-300 transition-colors">
                        <X className="w-3 h-3" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            onClick={onStartEdit}
            className={`inline-flex items-center justify-center gap-2 px-3 py-1 rounded-lg border-2 border-transparent hover:border-rose-100 hover:bg-rose-50/50 cursor-pointer group transition-all ${compact ? 'py-0.5 px-2' : ''}`}
        >
            <span className={`text-sm font-bold ${hasVariants ? 'text-rose-600' : 'text-slate-600'} group-hover:text-rose-600`}>{value}</span>
            {hasVariants ? (
                isExpanded ? (
                    <ChevronUp className="w-3 h-3 text-rose-400 group-hover:text-rose-600 transition-colors" />
                ) : (
                    <ChevronDown className="w-3 h-3 text-rose-400 group-hover:text-rose-600 transition-colors" />
                )
            ) : (
                <Edit3 className="w-3 h-3 text-slate-300 group-hover:text-rose-400 transition-colors" />
            )}
        </div>
    );
}

function SkeletonRow() {
    return (
        <tr className="animate-pulse">
            <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-slate-100 rounded-lg" />
                    <div className="space-y-2">
                        <div className="h-4 w-32 bg-slate-100 rounded" />
                        <div className="h-3 w-20 bg-slate-100 rounded" />
                    </div>
                </div>
            </td>
            <td className="px-6 py-4"><div className="h-6 w-16 bg-slate-100 rounded" /></td>
            <td className="px-6 py-4"><div className="h-6 w-8 mx-auto bg-slate-100 rounded" /></td>
            <td className="px-6 py-4"><div className="h-6 w-8 mx-auto bg-slate-100 rounded" /></td>
            <td className="px-6 py-4"><div className="h-8 w-16 mx-auto bg-slate-100 rounded" /></td>
            <td className="px-6 py-4"><div className="h-6 w-20 bg-slate-100 rounded" /></td>
            <td className="px-6 py-4 text-right"><div className="h-8 w-8 ml-auto bg-slate-100 rounded" /></td>
        </tr>
    );
}
