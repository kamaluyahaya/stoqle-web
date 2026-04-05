"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/src/context/authContext";
import { API_BASE_URL } from "@/src/lib/config";
import { fetchBusinessProducts, fetchProductById, logUserActivity } from "@/src/lib/api/productApi";
import ShopHeader from "@/src/components/shop/shopHeader";
import ProductPreviewModal from "@/src/components/product/addProduct/modal/previewModal";
import ShimmerGrid from "@/src/components/shimmer";
import type { PreviewPayload } from "@/src/types/product";
import { mapProductToPreviewPayload } from "@/src/lib/utils/product/mapping";

// Icons for bottom navigation
import { HomeIcon, ListBulletIcon, CalendarDaysIcon, ShoppingCartIcon } from "@heroicons/react/24/outline";
import { HomeIcon as HomeIconSolid, ListBulletIcon as ListBulletIconSolid, CalendarDaysIcon as CalendarDaysIconSolid } from "@heroicons/react/24/solid";
import Image from "next/image";

const NO_IMAGE_PLACEHOLDER = "/assets/images/favio.png";

export default function VendorShopPage() {
    const params = useParams();
    const slug = params?.slug;
    const router = useRouter();
    const auth = useAuth();

    const [profileApi, setProfileApi] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState<any[]>([]);
    const [productsLoading, setProductsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

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
    const [clickPos, setClickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [columns, setColumns] = useState(2);
    const [hasUnviewedReleases, setHasUnviewedReleases] = useState(false);

    const newestReleaseId = useMemo(() => {
        if (!Array.isArray(products) || !products.length) return 0;
        return Math.max(...products.map(p => p.product_id));
    }, [products]);

    useEffect(() => {
        if (!slug || !newestReleaseId) return;
        const lastSeen = localStorage.getItem(`shop_last_seen_${slug}`);
        if (!lastSeen || Number(lastSeen) < newestReleaseId) {
            setHasUnviewedReleases(true);
        } else {
            setHasUnviewedReleases(false);
        }

        // If currently on New release tab, mark as seen
        if (activeNav === "New release") {
            localStorage.setItem(`shop_last_seen_${slug}`, String(newestReleaseId));
            setHasUnviewedReleases(false);
        }
    }, [slug, newestReleaseId, activeNav]);

    useEffect(() => {
        const updateColumns = () => {
            const w = window.innerWidth;
            if (w < 700) setColumns(2);
            else if (w < 1350) setColumns(3);
            else if (w < 1650) setColumns(4);
            else setColumns(5);
        };
        updateColumns();
        window.addEventListener('resize', updateColumns);
        return () => window.removeEventListener('resize', updateColumns);
    }, []);

    const formatUrl = (url: string) => {
        if (!url) return NO_IMAGE_PLACEHOLDER;
        let formatted = url;
        if (!url.startsWith("http")) {
            formatted = url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
        }
        return encodeURI(formatted);
    };

    // Fetch Business Profile (using userId from some mapping or assume businessId is enough?)
    // Actually, we need to fetch by businessId. Let's assume our profile API can handle businessId 
    // or we need a new endpoint. 
    useEffect(() => {
        async function loadShop() {
            if (!slug) return;
            setLoading(true);
            try {
                // Here we ideally need a way to get the owner userId from slug to use existing profile API
                // or a specific business fetch API. For now, let's try to fetch products first.
                const res = await fetch(`${API_BASE_URL}/api/products/business/${slug}?limit=100`);
                const data = await res.json();
                const foundProducts = (data?.status === "success" && Array.isArray(data?.data?.products)) ? data.data.products : [];
                setProducts(foundProducts);

                // Let's also try to get business details.
                const bizRes = await fetch(`${API_BASE_URL}/api/business/${slug}`);
                const bizData = await bizRes.json();
                if (bizData.ok && bizData.data) {
                    setProfileApi(bizData.data);
                }
            } catch (err) {
                console.error("Shop load error:", err);
            } finally {
                setLoading(false);
            }
        }
        loadShop();
    }, [slug]);

    const updateUrl = (productId: number | null, replace: boolean = false) => {
        const urlParams = new URLSearchParams(window.location.search);
        if (productId) {
            urlParams.set("product_id", String(productId));
        } else {
            urlParams.delete("product_id");
        }
        const search = urlParams.toString();
        const newUrl = `${window.location.pathname}${search ? `?${search}` : ""}`;
        if (newUrl !== window.location.pathname + window.location.search) {
            if (replace) {
                window.history.replaceState(window.history.state, "", newUrl);
            } else {
                window.history.pushState(window.history.state, "", newUrl);
            }
        }
    };

    const handleProductClick = async (productId: number, arg2?: string | boolean | React.MouseEvent, e?: React.MouseEvent) => {
        if (fetchingProduct) return;

        let actualEvent: React.MouseEvent | undefined;
        let replaceUrl = false;

        if (typeof arg2 === 'boolean') {
            replaceUrl = arg2;
            actualEvent = e;
        } else if (arg2 && typeof arg2 === 'object' && 'clientX' in arg2) {
            actualEvent = arg2 as React.MouseEvent;
        }

        if (actualEvent) {
            setClickPos({ x: actualEvent.clientX, y: actualEvent.clientY });
        } else {
            setClickPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        }

        updateUrl(productId, replaceUrl);
        setFetchingProduct(true);
        try {
            const res = await fetchProductById(productId);
            if (res?.data?.product) {
                const dbProduct = res.data.product;
                const mapped = mapProductToPreviewPayload(dbProduct, formatUrl);
                setSelectedProductPayload(mapped);
                setProductModalOpen(true);
                logUserActivity({ product_id: productId, action_type: 'view', category: dbProduct.category }, auth.token);
            }
        } catch (e) { console.error(e); }
        finally { setFetchingProduct(false); }
    };

    // Deep linking and Back button support
    useEffect(() => {
        const handleRouteChange = () => {
            const urlParams = new URLSearchParams(window.location.search);
            const productId = urlParams.get("product_id");

            if (productId) {
                const pid = Number(productId);
                if (!productModalOpen && !fetchingProduct && selectedProductPayload?.productId !== pid) {
                    handleProductClick(pid, true); // Use replace when triggered by route change
                }
            } else if (productModalOpen) {
                setProductModalOpen(false);
                setSelectedProductPayload(null);
            }
        };

        window.addEventListener('popstate', handleRouteChange);
        handleRouteChange(); // Initial check
        return () => window.removeEventListener('popstate', handleRouteChange);
    }, [productModalOpen, fetchingProduct, selectedProductPayload]);

    const categoriesList = useMemo(() => {
        const cats = new Set<string>();
        if (Array.isArray(products)) {
            products.forEach(p => { if (p.category) cats.add(p.category); });
        }
        return ["All", ...Array.from(cats)];
    }, [products]);

    const filteredProducts = useMemo(() => {
        if (!Array.isArray(products)) return [];
        let list = [...products];

        // Implementation of professional multi-word search
        if (searchTerm.trim() !== "") {
            const rawTerm = searchTerm.toLowerCase();
            const words = rawTerm.split(/\s+/).filter(w => w.length > 0);

            list = list.filter(p => {
                const title = (p.title || p.product_name || "").toLowerCase();
                const desc = (p.description || "").toLowerCase();
                const cat = (p.category || "").toLowerCase();
                const price = String(p.price || "");
                const discount = String(p.promo_discount || p.sale_discount || "");

                // "Professional" matching: if any specific word matches any field
                return words.some(w =>
                    title.includes(w) ||
                    desc.includes(w) ||
                    cat.includes(w) ||
                    price.includes(w) ||
                    discount.includes(w)
                );
            });

            // Sort by search relevance (matches in title weigh more than description)
            list.sort((a, b) => {
                const getScore = (prod: any) => {
                    const t = (prod.title || prod.product_name || "").toLowerCase();
                    let s = 0;
                    words.forEach(w => {
                        if (t.includes(w)) s += 10;
                        if ((prod.category || "").toLowerCase().includes(w)) s += 5;
                        if ((prod.description || "").toLowerCase().includes(w)) s += 1;
                    });
                    return s;
                };
                return getScore(b) - getScore(a);
            });
        }

        if (activeNav === "Home") {
            if (homeTab === "Latest") list.sort((a, b) => b.product_id - a.product_id);
            if (homeTab === "Prices") list.sort((a, b) => Number(a.price) - Number(b.price));
            // Featured/Best sellers could use some logic like likes_count
            if (homeTab === "Featured") list.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
            if (homeTab === "Best Sellers") list.sort((a, b) => (Number(b.sold_count) || 0) - (Number(a.sold_count) || 0));
        } else if (activeNav === "Categories") {
            if (selectedCategory !== "All") list = list.filter(p => p.category === selectedCategory);
        }

        return list;
    }, [products, activeNav, homeTab, selectedCategory, searchTerm]);

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
        if (Array.isArray(products)) {
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
        }

        return Object.values(groupsMap).sort((a, b) => b.timestamp - a.timestamp);
    }, [products]);

    const renderProductItem = (p: any) => (
        <article
            key={p.product_id}
            onClick={(e) => handleProductClick(p.product_id, e)}
            className="bg-white rounded-[0.5rem] overflow-hidden mx-2 border border-slate-100 flex flex-col group cursor-pointer"
        >
            <div className="relative aspect-square bg-slate-100 relative">
                <Image
                    src={formatUrl(p.first_image || p.image_url)}
                    alt={p.title}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover group-hover:scale-110 transition-transform duration-500"
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
        <div className="min-h-dvh bg-white pb-24">
            <ShopHeader
                profileApi={profileApi}
                displayName={profileApi?.business?.business_name || ""}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
            />

            <main className="px-4 relative bg-white rounded-[0.5rem] p-4 -mt-6 z-10">

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
                            <div
                                className="grid gap-1 sm:gap-4"
                                style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
                            >
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
                            <div
                                className="grid gap-3"
                                style={{ gridTemplateColumns: `repeat(${columns > 3 ? columns - 1 : 2}, minmax(0, 1fr))` }}
                            >
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
                                    <h2 className="text-sm font-bold text-slate-800  tracking-tight">{group.label}</h2>
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">{group.products.length} Products</span>
                                </div>
                                <div
                                    className="grid gap-4"
                                    style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
                                >
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
            <nav className="fixed bottom-0 left-0 lg:left-[300px] right-0 bg-white/95 backdrop-blur-md px-6 py-2 flex items-center justify-around z-[999] pb-[calc(0.5rem+env(safe-area-inset-bottom))] transition-[left] duration-300">
                <button onClick={() => setActiveNav("Home")} className="flex flex-col items-center gap-1 group">
                    {activeNav === "Home" ? <HomeIconSolid className="w-4 h-4 text-red-500" /> : <HomeIcon className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />}
                    <span className={`text-[10px] font-bold ${activeNav === "Home" ? "text-red-500" : "text-slate-400"}`}>Home</span>
                </button>
                <button onClick={() => setActiveNav("Categories")} className="flex flex-col items-center gap-1 group">
                    {activeNav === "Categories" ? <ListBulletIconSolid className="w-4 h-4 text-red-500" /> : <ListBulletIcon className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />}
                    <span className={`text-[10px] font-bold ${activeNav === "Categories" ? "text-red-500" : "text-slate-400"}`}>Categories</span>
                </button>
                <button 
                  onClick={() => {
                    setActiveNav("New release");
                    if (newestReleaseId) {
                      localStorage.setItem(`shop_last_seen_${slug}`, String(newestReleaseId));
                      setHasUnviewedReleases(false);
                    }
                  }} 
                  className="flex flex-col items-center gap-1 group"
                >
                    <div className="relative">
                      {activeNav === "New release" ? <CalendarDaysIconSolid className="w-4 h-4 text-red-500" /> : <CalendarDaysIcon className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />}
                      {hasUnviewedReleases && activeNav !== "New release" && (
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-[1.5px] border-white ring-1 ring-red-500/20" />
                      )}
                    </div>
                    <span className={`text-[10px] font-bold ${activeNav === "New release" ? "text-red-500" : "text-slate-400"}`}>New release</span>
                </button>
            </nav>

            {productModalOpen && selectedProductPayload && (
                <ProductPreviewModal
                    open={productModalOpen}
                    payload={selectedProductPayload}
                    origin={clickPos}
                    onClose={() => {
                        setProductModalOpen(false);
                        setSelectedProductPayload(null);
                        updateUrl(null);
                    }}
                    onShopClick={() => {
                        setProductModalOpen(false);
                        setSelectedProductPayload(null);
                        updateUrl(null);
                    }}
                    onProductClick={handleProductClick}
                />
            )}

            {/* FLOATING CART BUTTON */}
            <button
                id="cart-icon-ref"
                onClick={() => router.push('/cart')}
                className="fixed bottom-20 right-6 z-[998] bg-red-600 text-white p-2.5 rounded-full shadow-2xl hover:bg-red-700 transition-all active:scale-95 flex items-center justify-center border-4 border-white"
            >
                <ShoppingCartIcon className="w-5 h-5" />
            </button>
        </div>
    );
}
