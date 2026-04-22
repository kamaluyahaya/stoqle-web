"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShoppingBag, Eye, Store, Send, ChevronRight } from "lucide-react";
import { API_BASE_URL } from "@/src/lib/config";
import { useAuth } from "@/src/context/authContext";
import { fetchCartApi } from "@/src/lib/api/cartApi";

const NO_IMAGE_PLACEHOLDER = "/assets/images/favio.png";

const formatUrl = (url: string) => {
    if (!url) return NO_IMAGE_PLACEHOLDER;
    if (url.startsWith("http")) return url;
    const base = (API_BASE_URL || "").replace(/\/$/, "");
    const path = url.startsWith("/public") ? url : (url.startsWith("/") ? `/public${url}` : `/public/${url}`);
    return `${base}${path}`;
};

type Product = {
    product_id: number;
    title: string;
    price: number | string;
    thumbnail?: string;
    image_url?: string;
    first_image?: string;
    business_id?: number | string;
};

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onSelectProduct: (product: Product) => void;
    businessId: string | number;
    initialTab?: 'view' | 'cart' | 'shop';
};

export const ProductHandoffModal: React.FC<Props> = ({
    isOpen,
    onClose,
    onSelectProduct,
    businessId,
    initialTab = 'view'
}) => {
    const [activeTab, setActiveTab] = useState<'view' | 'cart' | 'shop'>(initialTab);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const ITEMS_PER_PAGE = 10;
    const { token } = useAuth();

    const [isMobile, setIsMobile] = useState(true);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 640);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab);
            setPage(0);
            setProducts([]);
            setHasMore(true);
        }
    }, [isOpen, initialTab]);

    // Reset when tab changes
    useEffect(() => {
        setPage(0);
        setProducts([]);
        setHasMore(true);
    }, [activeTab]);

    useEffect(() => {
        if (!isOpen) return;

        const fetchData = async () => {
            if (loading) return;
            setLoading(true);
            try {
                if (activeTab === 'shop') {
                    // Fetch from API with limit/offset
                    const offset = page * ITEMS_PER_PAGE;
                    const res = await fetch(`${API_BASE_URL}/api/products/business/${businessId}?limit=${ITEMS_PER_PAGE}&offset=${offset}`);
                    const json = await res.json();
                    if (json.status === "success") {
                        const newProducts = json.data?.products || json.data || [];
                        setProducts(prev => page === 0 ? newProducts : [...prev, ...newProducts]);
                        setHasMore(newProducts.length === ITEMS_PER_PAGE);
                    }
                } else if (activeTab === 'cart') {
                    // Fetch cart and filter by businessId
                    const res = await fetchCartApi(token!);
                    if (res.status === "success") {
                        const items = res.data.items || [];
                        const filtered = items
                            .filter((item: any) => String(item.business_id) === String(businessId))
                            .map((item: any) => ({
                                product_id: item.product_id,
                                title: item.product_title || item.product_name || 'Product',
                                price: item.price,
                                thumbnail: item.product_image
                            }));

                        const start = page * ITEMS_PER_PAGE;
                        const paginated = filtered.slice(0, start + ITEMS_PER_PAGE);
                        setProducts(paginated);
                        setHasMore(filtered.length > paginated.length);
                    }
                } else if (activeTab === 'view') {
                    // Get from localStorage "stoqle_viewed_products"
                    const viewed = JSON.parse(localStorage.getItem("stoqle_viewed_products") || "[]");
                    const filtered = viewed.filter((p: any) => String(p.business_id) === String(businessId));

                    const start = page * ITEMS_PER_PAGE;
                    const paginated = filtered.slice(0, start + ITEMS_PER_PAGE);
                    setProducts(paginated);
                    setHasMore(filtered.length > paginated.length);
                }
            } catch (error) {
                console.error("Failed to fetch products", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [activeTab, businessId, isOpen, token, page]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (loading || !hasMore) return;
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop <= clientHeight + 100) {
            setPage(prev => prev + 1);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center pointer-events-none p-0 sm:p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm pointer-events-auto"
                onClick={onClose}
            />
            <motion.div
                initial={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.95, y: 20 }}
                animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
                exit={isMobile ? { y: "100%" } : { opacity: 0, scale: 1.05, y: 10 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="relative w-full max-w-lg bg-white rounded-t-[0.5rem] sm:rounded-[0.5rem] pointer-events-auto flex flex-col h-[80vh] sm:h-[80%] overflow-hidden"
            >
                {/* Drag Handle (Mobile Only) */}
                <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-4 mb-2 shrink-0 sm:hidden" />

                {/* Header */}
                <div className="px-6 py-4 flex items-center justify-between border-b border-slate-50 shrink-0 relative">
                    <div className="w-10 opacity-0 pointer-events-none"><X size={20} /></div>
                    <div className="text-center">
                        <h3 className="text-lg font-bold text-slate-900 tracking-tight">Please select product</h3>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all active:scale-95">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex px-6 shrink-0 gap-8 justify-center">
                    {(['view', 'cart', 'shop'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-3 relative text-[10px] font-black transition-all ${activeTab === tab ? 'text-rose-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <span className="flex items-center gap-1.5">
                                {tab === 'view'}
                                {tab === 'cart'}
                                {tab === 'shop'}
                                {tab === 'view' ? "Viewed" : tab === 'cart' ? "Cart" : "Shop"}
                            </span>
                            {activeTab === tab && (
                                <motion.div
                                    layoutId="handoff-underline"
                                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-[3px] bg-rose-600 rounded-full"
                                />
                            )}
                        </button>
                    ))}
                </div>

                {/* List Container */}
                <div
                    className="flex-1 overflow-y-auto p-6 custom-scrollbar"
                    onScroll={handleScroll}
                >
                    {products.length === 0 && loading ? (
                        <div className="flex-1" />
                    ) : products.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            {activeTab === 'cart' ? (
                                <div className="w-32 h-32 rounded-full flex items-center justify-center mb-4">
                                    <img src="/assets/images/cart.png" className="w-full h-full object-contain" alt="" />
                                </div>
                            ) : (
                                <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mb-4">
                                    <ShoppingBag size={40} />
                                </div>
                            )}
                            <h4 className="text-sm font-bold text-slate-900 mb-1">No items found</h4>
                            <p className="text-[10px] text-slate-400 max-w-[200px]">
                                {activeTab === 'view' ? "You haven't viewed any products from this shop recently." :
                                    activeTab === 'cart' ? "There are no products from this shop in your cart." :
                                        "This shop doesn't have any products listed yet."}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3 pb-4">
                            {Array.isArray(products) && products.map((product) => (
                                <motion.div
                                    key={product.product_id}
                                    whileHover={{ x: 4 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => onSelectProduct(product)}
                                    className="flex items-center gap-4 p-3 bg-white rounded-2xl border border-slate-100 hover:border-rose-200 hover:bg-rose-50 transition-all cursor-pointer group"
                                >
                                    <div className="w-16 h-16 rounded-xl bg-slate-50 overflow-hidden shrink-0 border border-slate-100">
                                        <img
                                            src={formatUrl(product.thumbnail || product.image_url || product.first_image || '')}
                                            alt={product.title}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-xs font-black text-slate-900 line-clamp-2 mb-1">{product.title}</h4>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-black text-rose-500">₦{Number(product.price).toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-rose-500 group-hover:text-white transition-all">
                                        <Send size={14} />
                                    </div>
                                </motion.div>
                            ))}

                            {loading && (
                                <div className="flex justify-center py-4">
                                    <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Tip */}
                <div className="p-6 pt-2 border-t border-slate-50 shrink-0">
                    <p className="text-[9px] font-medium text-slate-400 text-center">
                        Tap any product to send it instantly as an inquiry to the vendor.
                    </p>
                </div>
            </motion.div>
        </div>
    );
};
