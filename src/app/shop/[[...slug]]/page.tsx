"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/src/context/authContext";
import { API_BASE_URL } from "@/src/lib/config";
import { formatUrl } from "@/src/lib/utils/media";
import { fetchBusinessProducts, fetchProductById, logUserActivity } from "@/src/lib/api/productApi";
import ShopHeader from "@/src/components/shop/shopHeader";
import { formatDuration } from "@/src/lib/utils/product/duration";
import ProductPreviewModal from "@/src/components/product/addProduct/modal/previewModal";
import ShimmerGrid from "@/src/components/shimmer";
import type { PreviewPayload } from "@/src/types/product";
import { mapProductToPreviewPayload } from "@/src/lib/utils/product/mapping";
import { useCache } from "@/src/context/cacheContext";
import { idbGet, idbSet } from "@/src/lib/utils/idb";
import { SHOP_CACHE } from "@/src/lib/cache";

// Icons for bottom navigation
import { HomeIcon, ListBulletIcon, CalendarDaysIcon, ShoppingCartIcon } from "@heroicons/react/24/outline";
import { HomeIcon as HomeIconSolid, ListBulletIcon as ListBulletIconSolid, CalendarDaysIcon as CalendarDaysIconSolid } from "@heroicons/react/24/solid";
import Image from "next/image";
import PostShareModal from "@/src/components/modal/PostShareModal";
import { toast } from "sonner";

const NO_IMAGE_PLACEHOLDER = "/assets/images/favio.png";

export default function VendorShopPage() {
    const params = useParams();
    const slugArr = params?.slug as string[] | undefined;
    const bizSlug = slugArr?.[0] || "";
    const initialProductSlug = slugArr?.[1];

    const router = useRouter();
    const auth = useAuth();
    const { getScrollPosition, setScrollPosition, getActiveTab, setActiveTab } = useCache();

    const [profileApi, setProfileApi] = useState<any>(() => bizSlug ? SHOP_CACHE[bizSlug]?.profileApi || null : null);
    const [loading, setLoading] = useState<boolean>(() => bizSlug ? !SHOP_CACHE[bizSlug]?.products?.length : true);
    const [products, setProducts] = useState<any[]>(() => bizSlug ? SHOP_CACHE[bizSlug]?.products || [] : []);
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
    const [fetchingProduct, setFetchingProduct] = useState<number | string | null>(null);
    const [clickPos, setClickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [columns, setColumns] = useState(2);
    const [hasUnviewedReleases, setHasUnviewedReleases] = useState(false);

    // Share Modal State
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [shareUrl, setShareUrl] = useState("");
    const [isSharing, setIsSharing] = useState(false);

    const newestReleaseId = useMemo(() => {
        if (!Array.isArray(products) || !products.length) return 0;
        return Math.max(...products.map(p => p.product_id));
    }, [products]);

    // Shop Visitor Background Tracking
    const trackedVisitRef = useRef(false);
    useEffect(() => {
        if (!bizSlug || !profileApi?.business || trackedVisitRef.current) return;
        
        const bizId = profileApi.business.business_id || profileApi.business.id;
        const ownerId = profileApi.business.user_id;
        const currentUserId = auth?.user?.user_id ? String(auth.user.user_id) : null;
        
        // Prevent owners from inflating their own numbers
        if (currentUserId === String(ownerId)) {
            trackedVisitRef.current = true;
            return;
        }

        trackedVisitRef.current = true;
        
        setTimeout(() => {
            try {
              let sessionId = localStorage.getItem('stoqle_guest_session');
              if (!sessionId) {
                  sessionId = 'sg_' + Math.random().toString(36).substring(2, 15);
                  localStorage.setItem('stoqle_guest_session', sessionId);
              }
              
              const headers: any = { "Content-Type": "application/json" };
              if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
              
              fetch(`${API_BASE_URL.replace(/\/$/, "")}/api/business/${bizId}/visit`, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({ visitor_id: currentUserId, session_id: sessionId })
              }).catch(() => {});
            } catch (err) {}
        }, 1500);
    }, [bizSlug, profileApi?.business, auth?.user]);

    useEffect(() => {
        if (!bizSlug || !newestReleaseId) return;
        const lastSeen = localStorage.getItem(`shop_last_seen_${bizSlug}`);
        if (!lastSeen || Number(lastSeen) < newestReleaseId) {
            setHasUnviewedReleases(true);
        } else {
            setHasUnviewedReleases(false);
        }

        // If currently on New release tab, mark as seen
        if (activeNav === "New release") {
            localStorage.setItem(`shop_last_seen_${bizSlug}`, String(newestReleaseId));
            setHasUnviewedReleases(false);
        }
    }, [bizSlug, newestReleaseId, activeNav]);

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

    // Record scroll position
    useEffect(() => {
        const handleScroll = () => {
            if (bizSlug) setScrollPosition(`shop_${bizSlug}`, window.scrollY);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [bizSlug]);

    // Restore scroll position after loading
    useEffect(() => {
        if (!loading && bizSlug) {
            const pos = getScrollPosition(`shop_${bizSlug}`);
            if (pos > 0) {
                // Wait for a bit for content to render
                setTimeout(() => window.scrollTo(0, pos), 50);
            }
        }
    }, [loading, bizSlug]);



    // Hybrid IDB + Memory Cache & Revalidation Strategy
    useEffect(() => {
        if (!bizSlug) return;

        let memoryHit = false;

        // 1. Module-Level Memory Cache Check (Instant Rendering)
        if (SHOP_CACHE[bizSlug]) {
            setProducts(SHOP_CACHE[bizSlug].products);
            setProfileApi(SHOP_CACHE[bizSlug].profileApi);
            setLoading(false);
            memoryHit = true;
        } else {
            // 2. Persistent IDB Hydration Check (Blink-Eye Rendering)
            idbGet<any>(`shop_cache_${bizSlug}`).then((cachedData) => {
                if (cachedData && !memoryHit) {
                    SHOP_CACHE[bizSlug] = cachedData;
                    setProducts(cachedData.products);
                    setProfileApi(cachedData.profileApi);
                    setLoading(false);
                }
            }).catch(console.error);
        }

        const savedTab = getActiveTab(`shop_${bizSlug}_nav`);
        if (savedTab) setActiveNav(savedTab as any);

        // 3. Background Data Fetching (Stale-while-Revalidate)
        async function loadShopSilently() {
            // Deduplication: Avoid fetching if the cache is extremely fresh (< 5 mins)
            if (SHOP_CACHE[bizSlug] && SHOP_CACHE[bizSlug].lastFetchedAt) {
                const age = Date.now() - SHOP_CACHE[bizSlug].lastFetchedAt;
                if (age < 5 * 60 * 1000) return;
            }
            try {
                const res = await fetch(`${API_BASE_URL}/api/products/business/${bizSlug}?limit=100`);
                const data = await res.json();
                const foundProducts = (data?.status === "success" && Array.isArray(data?.data?.products)) ? data.data.products : [];

                const bizRes = await fetch(`${API_BASE_URL}/api/business/${bizSlug}`);
                const bizData = await bizRes.json();
                if (bizData.ok && bizData.data) {
                    const newData = {
                        profileApi: bizData.data,
                        products: foundProducts,
                        lastFetchedAt: Date.now(),
                        activeNav: "Home",
                        categories: []
                    };

                    setProfileApi(newData.profileApi);
                    setProducts(newData.products);
                    setLoading(false);

                    // Sync up caching tiers silently
                    SHOP_CACHE[bizSlug] = newData;
                    idbSet(`shop_cache_${bizSlug}`, newData).catch(console.error);
                }
            } catch (err) {
                console.error("Shop background sync error:", err);
            }
        }

        loadShopSilently();
    }, [bizSlug, getActiveTab]);

    // Save active nav state
    useEffect(() => {
        if (bizSlug) setActiveTab(`shop_${bizSlug}_nav`, activeNav);
    }, [activeNav, bizSlug]);

    const updateUrl = (productId: number | string | null, replace: boolean = false, productSlug?: string) => {
        const urlParams = new URLSearchParams(window.location.search);
        let newUrl = `/shop/${bizSlug}`;

        if (productSlug) {
            newUrl += `/${productSlug}`;
            urlParams.delete("product_id");
        } else if (productId) {
            urlParams.set("product_id", String(productId));
        } else {
            urlParams.delete("product_id");
        }

        const search = urlParams.toString();
        const finalUrl = newUrl + (search ? `?${search}` : "");

        if (finalUrl !== window.location.pathname + window.location.search) {
            if (replace) {
                window.history.replaceState(window.history.state, "", finalUrl);
            } else {
                window.history.pushState(window.history.state, "", finalUrl);
            }
        }
    };

    const handleProductClick = async (productId: number | string, arg2?: string | boolean | React.MouseEvent, e?: React.MouseEvent, bSlug?: string, isSocial?: boolean, ps?: string) => {
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

        const isNumericId = typeof productId === 'number' || (typeof productId === 'string' && /^\d+$/.test(productId));
        const pid = isNumericId ? Number(productId) : null;
        const identifier = ps || (isNumericId ? pid : productId);
        if (!identifier) return;

        updateUrl(pid, replaceUrl, ps);
        setFetchingProduct(identifier);
        try {
            const res = await fetchProductById(identifier, auth.token);
            if (res?.data?.product) {
                const dbProduct = res.data.product;
                const mapped = mapProductToPreviewPayload(dbProduct, formatUrl);
                setSelectedProductPayload(mapped);
                setProductModalOpen(true);
                logUserActivity({ product_id: dbProduct.product_id, action_type: 'view', category: dbProduct.category }, auth.token);

                // Ensure URL has slug
                updateUrl(dbProduct.product_id, true, dbProduct.slug || dbProduct.product_slug);
            }
        } catch (e) { console.error(e); }
        finally { setFetchingProduct(null); }
    };

    // Deep linking and Back button support
    useEffect(() => {
        const handleRouteChange = () => {
            const urlParams = new URLSearchParams(window.location.search);
            const productId = urlParams.get("product_id");

            const currentPath = window.location.pathname;
            const segments = currentPath.startsWith('/shop') ? currentPath.slice(6).split('/').filter(Boolean) : [];
            const currentSlug = segments.length >= 2 ? segments[1] : null;

            if (productId) {
                const pid = Number(productId);
                if (!productModalOpen && !fetchingProduct && selectedProductPayload?.productId !== pid) {
                    handleProductClick(pid, true);
                }
            } else if (currentSlug) {
                if (!productModalOpen && !fetchingProduct && selectedProductPayload?.slug !== currentSlug) {
                    handleProductClick("", true, undefined, undefined, false, currentSlug);
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

    const handleShopShare = async () => {
        if (!profileApi?.business?.business_id) return;
        setIsSharing(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/shop/share`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${auth.token}`
                },
                body: JSON.stringify({ business_id: profileApi.business.business_id })
            });
            const json = await res.json();
            if (json.ok && json.data?.shareUrl) {
                setShareUrl(json.data.shareUrl);
                setShareModalOpen(true);
            } else {
                toast.error("Failed to generate share link");
            }
        } catch (err) {
            console.error(err);
            toast.error("Network error");
        } finally {
            setIsSharing(false);
        }
    };

    const renderProductItem = (p: any) => {
        const promo = p.promo_discount || p.sale_discount;
        const hasReturnSubsidy = p.return_shipping_subsidy || profileApi?.policy?.returns?.return_shipping_subsidy === 1;
        const hasSevenDayReturn = p.seven_day_no_reason || profileApi?.policy?.returns?.seven_day_no_reason === 1;
        const shippingAvg = (p.shipping_policies || profileApi?.policy?.shipping || profileApi?.policy?.shipping_duration || []).find((s: any) => s.kind === "avg" || s.type === "avg");
        const shippingDuration = shippingAvg ? formatDuration(shippingAvg.value, shippingAvg.unit) : null;

        return (
            <article
                key={p.product_id}
                onClick={(e) => handleProductClick(p.product_id, e, undefined, undefined, false, p.slug || p.product_slug)}
                className="bg-white rounded-[0.5rem] overflow-hidden mx-2 border border-slate-100 flex flex-col group cursor-pointer"
            >
                <div className="relative aspect-square bg-slate-100">
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
                    <div className="mt-1 flex items-center gap-1.5 h-4">
                        {promo > 0 ? (
                            <>
                                <span className="text-xs font-bold text-slate-900">₦{Math.round(Number(p.price || 0) * (1 - promo / 100)).toLocaleString()}</span>
                                <span className="text-[10px] text-rose-500 line-through">₦{Number(p.price || 0).toLocaleString()}</span>
                            </>
                        ) : (
                            <span className="text-xs font-bold text-slate-900">₦{Number(p.price || 0).toLocaleString()}</span>
                        )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1 min-h-[14px]">
                        {promo > 0 ? (
                            <span className="text-[9px] text-rose-500 border-rose-500 border-[0.2px] px-1.5 py-0.5 ">
                                {p.promo_title || p.sale_type || "Sale"} {promo}% OFF
                            </span>
                        ) : (p.total_quantity !== undefined && p.total_quantity !== null && Number(p.total_quantity) <= 4) ? (
                            <span className="text-[9px] text-rose-500 font-bold uppercase tracking-tight">
                                Only {Number(p.total_quantity)} Left
                            </span>
                        ) : hasSevenDayReturn ? (
                            <span className="text-[9px] text-blue-600 border-blue-500 border-[0.2px] px-1.5 py-0.5 ">
                                7-day no reason return
                            </span>
                        ) : hasReturnSubsidy ? (
                            <span className="text-[9px] text-emerald-600 border-emerald-500 border-[0.2px] px-1.5 py-0.5 ">
                                Return shipping subsidy
                            </span>
                        ) : shippingDuration ? (
                            <span className="text-[9px] text-emerald-600 border-emerald-500  ">
                                Ships in {shippingDuration}
                            </span>
                        ) : null}
                    </div>
                </div>
            </article>
        );
    };

    return (
        <div className="min-h-dvh bg-white pb-24">
            <ShopHeader
                profileApi={profileApi}
                displayName={profileApi?.business?.business_name || ""}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onShare={handleShopShare}
            />

            <main className="px-4 relative bg-white rounded-[0.5rem] p-4 -mt-6 z-10">

                {/* HOMEPAGE CONTENT */}
                {activeNav === "Home" && (
                    <>
                        <div className="flex gap-4 border-slate-200 overflow-x-auto no-scrollbar mb-4 p-2">
                            {loading ? (
                                <>
                                    <div className="h-4 w-16 bg-slate-100 animate-pulse rounded my-2" />
                                    <div className="h-4 w-16 bg-slate-100 animate-pulse rounded my-2" />
                                    <div className="h-4 w-16 bg-slate-100 animate-pulse rounded my-2" />
                                    <div className="h-4 w-16 bg-slate-100 animate-pulse rounded my-2" />
                                </>
                            ) : (
                                ["Featured", "Best Sellers", "Latest", "Prices"].map((t: any) => (
                                    <button
                                        key={t}
                                        onClick={() => setHomeTab(t)}
                                        className={`pb-2 text-sm font-bold transition-all whitespace-nowrap ${homeTab === t ? "text-rose-500 border-b-2 border-rose-500" : "text-slate-500"}`}
                                    >
                                        {t}
                                    </button>
                                ))
                            )}
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
                            {loading ? (
                                <div className="space-y-4 pt-4">
                                    <div className="h-4 w-full bg-slate-100 animate-pulse rounded" />
                                    <div className="h-4 w-5/6 bg-slate-100 animate-pulse rounded" />
                                    <div className="h-4 w-full bg-slate-100 animate-pulse rounded" />
                                    <div className="h-4 w-4/6 bg-slate-100 animate-pulse rounded" />
                                </div>
                            ) : (
                                categoriesList.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`w-full text-left py-3 px-2 text-xs font-bold rounded-lg mb-1 transition-all ${selectedCategory === cat ? "bg-rose-50 text-rose-500" : "text-slate-600 hover:bg-slate-100"}`}
                                    >
                                        {cat}
                                    </button>
                                ))
                            )}
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
                            {groupedByDate.map((group: any, idx: number) => (
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

                        {groupedByDate.map((group: any, idx: number) => (
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
                    {activeNav === "Home" ? <HomeIconSolid className="w-4 h-4 text-rose-500" /> : <HomeIcon className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />}
                    <span className={`text-[10px] font-bold ${activeNav === "Home" ? "text-rose-500" : "text-slate-400"}`}>Home</span>
                </button>
                <button onClick={() => setActiveNav("Categories")} className="flex flex-col items-center gap-1 group">
                    {activeNav === "Categories" ? <ListBulletIconSolid className="w-4 h-4 text-rose-500" /> : <ListBulletIcon className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />}
                    <span className={`text-[10px] font-bold ${activeNav === "Categories" ? "text-rose-500" : "text-slate-400"}`}>Categories</span>
                </button>
                <button
                    onClick={() => {
                        setActiveNav("New release");
                        if (newestReleaseId) {
                            localStorage.setItem(`shop_last_seen_${bizSlug}`, String(newestReleaseId));
                            setHasUnviewedReleases(false);
                        }
                    }}
                    className="flex flex-col items-center gap-1 group"
                >
                    <div className="relative">
                        {activeNav === "New release" ? <CalendarDaysIconSolid className="w-4 h-4 text-rose-500" /> : <CalendarDaysIcon className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />}
                        {hasUnviewedReleases && activeNav !== "New release" && (
                            <div className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full border-[1.5px] border-white ring-1 ring-rose-500/20" />
                        )}
                    </div>
                    <span className={`text-[10px] font-bold ${activeNav === "New release" ? "text-rose-500" : "text-slate-400"}`}>New release</span>
                </button>
            </nav>

            {productModalOpen && selectedProductPayload && (
                <ProductPreviewModal
                    open={productModalOpen}
                    payload={selectedProductPayload}
                    origin={clickPos}
                    onClose={() => {
                        const params = new URLSearchParams(window.location.search);
                        const pathSegments = window.location.pathname.split('/').filter(Boolean);
                        // If we are on a product-specific URL, use back() to return cleanly
                        if (params.has('product_id') || pathSegments.length > 2) {
                            router.back();
                        } else {
                            // Otherwise just close and ensure URL is clean via replace
                            setProductModalOpen(false);
                            setSelectedProductPayload(null);
                            updateUrl(null, true);
                        }
                    }}
                    onShopClick={() => {
                        setProductModalOpen(false);
                        setSelectedProductPayload(null);
                        updateUrl(null, true);
                    }}
                    onProductClick={handleProductClick}
                />
            )}

            {/* FLOATING CART BUTTON */}
            <button
                id="cart-icon-ref"
                onClick={() => router.push('/cart')}
                className="fixed bottom-20 right-6 z-[998] bg-rose-500 text-white p-2.5 rounded-full shadow-2xl hover:bg-rose-700 transition-all active:scale-95 flex items-center justify-center border-4 border-white"
            >
                <ShoppingCartIcon className="w-5 h-5" />
            </button>

            {shareModalOpen && (
                <PostShareModal
                    isOpen={shareModalOpen}
                    onClose={() => setShareModalOpen(false)}
                    shareUrl={shareUrl}
                    title={`Check out ${profileApi?.business?.business_name || 'this shop'} on Stoqle!`}
                    isLoading={isSharing}
                    onGenerate={async () => shareUrl}
                />
            )}
        </div>
    );
}
