"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/src/context/authContext";
import { API_BASE_URL } from "@/src/lib/config";
import { fetchBusinessProducts, fetchProductById } from "@/src/lib/api/productApi";
import ShopHeader from "@/src/components/shop/shopHeader";
import ProductPreviewModal from "@/src/components/product/addProduct/modal/previewModal";
import ShimmerGrid from "@/src/components/shimmer";
import type { PreviewPayload } from "@/src/types/product";

// Icons for bottom navigation
import { HomeIcon, ListBulletIcon, CalendarDaysIcon, ShoppingCartIcon } from "@heroicons/react/24/outline";
import { HomeIcon as HomeIconSolid, ListBulletIcon as ListBulletIconSolid, CalendarDaysIcon as CalendarDaysIconSolid } from "@heroicons/react/24/solid";

const NO_IMAGE_PLACEHOLDER = "/assets/images/favio.png";

export default function VendorShopPage() {
    const params = useParams();
    const businessId = params?.businessId;
    const router = useRouter();
    const auth = useAuth();

    const [profileApi, setProfileApi] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState<any[]>([]);
    const [productsLoading, setProductsLoading] = useState(false);

    // Bottom Navigation State
    const [activeNav, setActiveNav] = useState<"Home" | "Categories" | "New release">("Home");

    // Home Sub-tabs State
    const [homeTab, setHomeTab] = useState<"Featured" | "Best Sellers" | "Latest" | "Prices">("Featured");

    // Selected category in Categories tab
    const [selectedCategory, setSelectedCategory] = useState<string>("All");

    // Product Modal State
    const [selectedProductPayload, setSelectedProductPayload] = useState<PreviewPayload | null>(null);
    const [productModalOpen, setProductModalOpen] = useState(false);
    const [fetchingProduct, setFetchingProduct] = useState(false);

    const formatUrl = (url: string) => {
        if (!url) return NO_IMAGE_PLACEHOLDER;
        if (url.startsWith("http")) return url;
        return url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
    };

    // Fetch Business Profile (using userId from some mapping or assume businessId is enough?)
    // Actually, we need to fetch by businessId. Let's assume our profile API can handle businessId 
    // or we need a new endpoint. 
    useEffect(() => {
        async function loadShop() {
            if (!businessId) return;
            setLoading(true);
            try {
                // Here we ideally need a way to get the owner userId from businessId to use existing profile API
                // or a specific business fetch API. For now, let's try to fetch products first.
                const res = await fetch(`${API_BASE_URL}/api/products/business/${businessId}?limit=100`);
                const data = await res.json();
                const foundProducts = data?.data?.products || data?.data || data || [];
                setProducts(foundProducts);

                // Let's also try to get business details. 
                // We'll build a synthetic profileApi object if we can't find a direct endpoint.
                const bizRes = await fetch(`${API_BASE_URL}/api/business/${businessId}`);
                const bizData = await bizRes.json();
                if (bizData.ok) {
                    setProfileApi(bizData.data);
                }
            } catch (err) {
                console.error("Shop load error:", err);
            } finally {
                setLoading(false);
            }
        }
        loadShop();
    }, [businessId]);

    const handleProductClick = async (productId: number) => {
        if (fetchingProduct) return;
        setFetchingProduct(true);
        try {
            const res = await fetchProductById(productId);
            if (res?.data?.product) {
                const dbProduct = res.data.product;
                const mapped: PreviewPayload = {
                    productId: dbProduct.product_id,
                    title: dbProduct.title,
                    description: dbProduct.description,
                    category: dbProduct.category,
                    hasVariants: dbProduct.has_variants === 1,
                    price: dbProduct.price ?? "",
                    quantity: dbProduct.quantity ?? "",
                    businessId: Number(dbProduct.business_id),
                    productImages: (dbProduct.media || []).filter((m: any) => m.type === "image").length > 0
                        ? (dbProduct.media || []).filter((m: any) => m.type === "image").map((m: any) => ({ name: "img", url: formatUrl(m.url) }))
                        : (dbProduct.first_image || dbProduct.image_url)
                            ? [{ name: "img", url: formatUrl(dbProduct.first_image || dbProduct.image_url) }]
                            : [],
                    productVideo: (() => {
                        const vid = (dbProduct.media || []).find((m: any) => m.type === "video");
                        if (vid) return { name: "vid", url: formatUrl(vid.url) };
                        if (dbProduct.product_video) return { name: "vid", url: formatUrl(dbProduct.product_video) };
                        return null;
                    })(),
                    useCombinations: dbProduct.use_combinations === 1,
                    params: (dbProduct.params || []).map((p: any) => ({ key: p.param_key, value: p.param_value })),
                    samePriceForAll: dbProduct.same_price_for_all === 1,
                    sharedPrice: dbProduct.price ?? "",
                    variantGroups: (dbProduct.variant_groups || []).map((g: any) => ({
                        id: String(g.group_id),
                        title: g.title,
                        allowImages: g.allow_images === 1,
                        entries: (g.options || []).map((o: any) => ({
                            id: String(o.option_id),
                            name: o.name,
                            price: o.price,
                            quantity: o.initial_quantity || 0,
                            images: (o.media || []).map((m: any) => ({ name: "img", url: formatUrl(m.url) }))
                        }))
                    })),
                    skus: (dbProduct.skus || []).map((s: any) => {
                        let vIds: string[] = [];
                        try {
                            vIds = typeof s.variant_option_ids === 'string'
                                ? JSON.parse(s.variant_option_ids)
                                : (s.variant_option_ids || []);
                        } catch (e) { }

                        const inventoryMatch = (dbProduct.inventory || []).find((inv: any) => inv.sku_id === s.sku_id);
                        return {
                            id: String(s.sku_id),
                            name: s.sku_code || "Combination",
                            variantOptionIds: vIds.map(String),
                            price: s.price ?? "",
                            quantity: inventoryMatch ? inventoryMatch.quantity : (s.quantity ?? 0),
                            enabled: s.status === 'active'
                        };
                    })
                };
                setSelectedProductPayload(mapped);
                setProductModalOpen(true);
            }
        } catch (e) { console.error(e); }
        finally { setFetchingProduct(false); }
    };

    const categoriesList = useMemo(() => {
        const cats = new Set<string>();
        products.forEach(p => { if (p.category) cats.add(p.category); });
        return ["All", ...Array.from(cats)];
    }, [products]);

    const filteredProducts = useMemo(() => {
        let list = [...products];

        if (activeNav === "Home") {
            if (homeTab === "Latest") list.sort((a, b) => b.product_id - a.product_id);
            if (homeTab === "Prices") list.sort((a, b) => Number(a.price) - Number(b.price));
            // Featured/Best sellers could use some logic like likes_count
            if (homeTab === "Featured" || homeTab === "Best Sellers") list.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
        } else if (activeNav === "Categories") {
            if (selectedCategory !== "All") list = list.filter(p => p.category === selectedCategory);
        }

        return list;
    }, [products, activeNav, homeTab, selectedCategory]);

    const formatReleaseDate = (dateStr: string) => {
        if (!dateStr || dateStr === 'Unknown') return 'Unknown';
        const date = new Date(dateStr);
        const now = new Date();
        const dDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const dNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const diffTime = dNow.getTime() - dDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Yesterday";
        if (diffDays < 30) {
            const m = (date.getMonth() + 1).toString().padStart(2, '0');
            const d = date.getDate().toString().padStart(2, '0');
            return `${m}-${d}`;
        }

        const months = Math.floor(diffDays / 30);
        if (months < 12) return `${months} mo ago`;
        return `${Math.floor(months / 12)} yr ago`;
    };

    // Grouped products for "New release" (Calendar)
    const groupedByDate = useMemo(() => {
        const groupsMap: Record<string, { label: string, products: any[], timestamp: number }> = {};
        products.forEach(p => {
            const dateObj = p.created_at ? new Date(p.created_at) : null;
            // Use date-only string as a stable key
            const dateKey = dateObj ? new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).toISOString() : 'Unknown';

            if (!groupsMap[dateKey]) {
                groupsMap[dateKey] = {
                    label: formatReleaseDate(dateKey),
                    products: [],
                    timestamp: dateObj ? dateObj.getTime() : 0
                };
            }
            groupsMap[dateKey].products.push(p);
        });

        return Object.values(groupsMap).sort((a, b) => b.timestamp - a.timestamp);
    }, [products]);

    const renderProductItem = (p: any) => (
        <article
            key={p.product_id}
            onClick={() => handleProductClick(p.product_id)}
            className="bg-white rounded-xl overflow-hidden  border border-slate-100 flex flex-col group cursor-pointer"
        >
            <div className="relative aspect-square bg-slate-100 overflow-hidden">
                <img
                    src={formatUrl(p.first_image || p.image_url)}
                    alt={p.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                {p.product_video && (
                    <div className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5.14v14l11-7-11-7z" /></svg>
                    </div>
                )}
            </div>
            <div className="p-2">
                <h3 className="text-[11px] font-bold text-slate-700 line-clamp-1 truncate">{p.title}</h3>
                <p className="text-xs font-bold text-slate-900 mt-1">₦{Number(p.price || 0).toLocaleString()}</p>
            </div>
        </article>
    );

    return (
        <div className="min-h-screen bg-white pb-24">
            <ShopHeader
                profileApi={profileApi}
                displayName={profileApi?.business?.business_name || ""}
            />

            <main className="px-4 relative bg-white rounded-2xl p-4 -mt-6 z-10">

                {/* HOMEPAGE CONTENT */}
                {activeNav === "Home" && (
                    <>
                        <div className="flex gap-4 border-slate-200 overflow-x-auto no-scrollbar mb-4 p-2">
                            {["Featured", "Best Sellers", "Latest", "Prices"].map((t: any) => (
                                <button
                                    key={t}
                                    onClick={() => setHomeTab(t)}
                                    className={`pb-2 text-sm font-bold transition-all whitespace-nowrap ${homeTab === t ? "text-red-500 border-b-2 border-red-500" : "text-slate-500"}`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>

                        {loading ? <ShimmerGrid count={8} /> : (
                            <div className="grid grid-cols-2 p-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">

                                {filteredProducts.map(renderProductItem)}
                            </div>
                        )}
                    </>
                )}

                {/* CATEGORIES CONTENT */}
                {activeNav === "Categories" && (
                    <div className="flex gap-4 h-[calc(100vh-280px)]">
                        {/* Left sidebar - Sidebar stays left even on mobile but we'll use a narrow column */}
                        <div className="w-1/4 min-w-[100px] border-r border-slate-200 overflow-y-auto pr-2 no-scrollbar">
                            {categoriesList.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`w-full text-left py-3 px-2 text-xs font-bold rounded-lg mb-1 transition-all ${selectedCategory === cat ? "bg-red-50 text-red-600" : "text-slate-600 hover:bg-slate-100"}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                        {/* Right products */}
                        <div className="flex-1 overflow-y-auto no-scrollbar">
                            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                                {filteredProducts.map(renderProductItem)}
                            </div>
                        </div>
                    </div>
                )}

                {/* NEW RELEASE CONTENT (Calendar style) */}
                {activeNav === "New release" && (
                    <div className="space-y-6">
                        {/* Sub-nav for dates at top */}
                        <div className="flex gap-2 sticky top-0 z-20 bg-white/90  pt-1 overflow-x-auto no-scrollbar ">
                            {groupedByDate.map((group, idx) => (
                                <button
                                    key={group.label + idx}
                                    onClick={() => {
                                        const el = document.getElementById(`date-group-${idx}`);
                                        if (el) {
                                            const yOffset = -100;
                                            const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
                                            window.scrollTo({ top: y, behavior: 'smooth' });
                                        }
                                    }}
                                    className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 rounded-full text-[10px] font-bold text-slate-600 whitespace-nowrap transition-all shadow-sm"
                                >
                                    {group.label}
                                </button>
                            ))}
                        </div>

                        {groupedByDate.map((group, idx) => (
                            <div key={group.label + idx} id={`date-group-${idx}`} className="">
                                <div className="flex items-center justify-between mb-3 bg-white px-3 py-2 rounded-lg border border-slate-100 sticky top-12 z-10 transition-all">
                                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">{group.label}</h2>
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">{group.products.length} Products</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {group.products.map(renderProductItem)}
                                </div>
                            </div>
                        ))}

                        {groupedByDate.length === 0 && (
                            <div className="py-20 text-center">
                                <p className="text-slate-400 text-sm font-medium">No new releases found.</p>
                            </div>
                        )}
                    </div>
                )}

            </main>

            {/* BOTTOM NAVIGATION */}
            <nav className="fixed lg:bottom-0 bottom-10 left-0 lg:left-40 w-full lg:w-[calc(100%-160px)] bg-white px-6 py-2 pb-2 flex items-center justify-around z-[999]">
                <button onClick={() => setActiveNav("Home")} className="flex flex-col items-center gap-1 group">
                    {activeNav === "Home" ? <HomeIconSolid className="w-4 h-4 text-red-500" /> : <HomeIcon className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />}
                    <span className={`text-[10px] font-bold ${activeNav === "Home" ? "text-red-500" : "text-slate-400"}`}>Home</span>
                </button>
                <button onClick={() => setActiveNav("Categories")} className="flex flex-col items-center gap-1 group">
                    {activeNav === "Categories" ? <ListBulletIconSolid className="w-4 h-4 text-red-500" /> : <ListBulletIcon className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />}
                    <span className={`text-[10px] font-bold ${activeNav === "Categories" ? "text-red-500" : "text-slate-400"}`}>Categories</span>
                </button>
                <button onClick={() => setActiveNav("New release")} className="flex flex-col items-center gap-1 group">
                    {activeNav === "New release" ? <CalendarDaysIconSolid className="w-4 h-4 text-red-500" /> : <CalendarDaysIcon className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />}
                    <span className={`text-[10px] font-bold ${activeNav === "New release" ? "text-red-500" : "text-slate-400"}`}>New release</span>
                </button>
            </nav>

            {productModalOpen && selectedProductPayload && (
                <ProductPreviewModal
                    open={productModalOpen}
                    payload={selectedProductPayload}
                    onClose={() => setProductModalOpen(false)}
                    onProductClick={handleProductClick}
                />
            )}

            {/* FLOATING CART BUTTON */}
            <button
                onClick={() => router.push('/cart')}
                className="fixed bottom-28 right-6 z-[998] bg-red-600 text-white p-2 rounded-full shadow-2xl hover:bg-red-700 transition-all active:scale-95 flex items-center justify-center"
            >
                <ShoppingCartIcon className="w-5 h-5" />
            </button>
        </div>
    );
}
