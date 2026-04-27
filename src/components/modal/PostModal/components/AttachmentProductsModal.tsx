import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { ShoppingBag } from "lucide-react";
import StoqleLoader from "@/src/components/common/StoqleLoader";
import CachedImage from "@/src/components/common/CachedImage";
import { PostModalContext } from "../types";
import { safeFetch } from "@/src/lib/api/handler";
import { API_BASE_URL } from "@/src/lib/config";

interface AttachmentProductsModalProps {
  ctx: PostModalContext;
  onClose: () => void;
  onInsertToken: (token: string, metadata: any) => void;
}

type SubTabType = "purchased" | "cart" | "my_products";

export default function AttachmentProductsModal({ ctx, onClose, onInsertToken }: AttachmentProductsModalProps) {
  const { auth, formatUrl } = ctx;
  const [subTab, setSubTab] = useState<SubTabType>("cart");

  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const LIMIT = 10;

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [cache, setCache] = useState<Record<string, any[]>>({});

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setData([]);
    setPage(1);
    setHasMore(true);
    fetchProductsData(subTab, 1);
  }, [subTab]);

  const fetchProductsData = async (type: SubTabType, currentPage: number) => {
    const cacheKey = `${type}_${currentPage}`;
    if (cache[cacheKey]) {
      setData(cache[cacheKey]);
      return;
    }

    setLoading(true);
    try {
      let endpoint = "";
      if (type === "purchased") endpoint = "/api/orders/customer";
      else if (type === "cart") endpoint = "/api/cart";
      else if (type === "my_products") endpoint = `/api/products/business/${auth?.user?.business_id || auth?.user?.user_id}?limit=${LIMIT}&offset=${(currentPage - 1) * LIMIT}`;

      if (!endpoint) return;

      const json: any = await safeFetch(`${API_BASE_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${auth?.token}` }
      });

      let items = [];
      if (type === "cart") {
        items = json?.data?.items || [];
      } else if (type === "purchased") {
        const masterOrders = json?.data || [];
        items = masterOrders.flatMap((m: any) =>
          (m.vendors || []).flatMap((v: any) =>
            (v.shipments || []).flatMap((s: any) => s.items || [])
          )
        );
        items = Array.from(new Map(items.map((item: any) => [item?.product_id, item])).values());
      } else {
        items = json?.data?.products || [];
      }

      const validItems = items.filter(Boolean);
      setData(prev => currentPage === 1 ? validItems : [...prev, ...validItems]);
      setCache(prev => ({ ...prev, [cacheKey]: validItems }));

      // Infinite scroll logic: if fewer than LIMIT, no more. (Only my_products actually supports pagination right now, others are flat lists)
      if (type !== "my_products" || validItems.length < LIMIT) {
        setHasMore(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const bottom = e.currentTarget.scrollHeight - e.currentTarget.scrollTop <= e.currentTarget.clientHeight + 100;
    if (bottom && !loading && hasMore) {
      setPage(p => p + 1);
      fetchProductsData(subTab, page + 1);
    }
  };

  const handleProductSelect = (product: any) => {
    if (!product) return;
    const title = product.product_name || product.product_title || product.title || "Product";
    const shortTitle = title.length > 20 ? title.substring(0, 20) + "..." : title;
    onInsertToken(`[Product: ${shortTitle}]`, {
      type: "product",
      id: product.product_id || product.id,
      display: `[Product: ${shortTitle}]`
    });
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: "100%" }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed bottom-0 left-0 right-0 z-[200] bg-white rounded-t-[0.5rem] flex flex-col h-[80vh] sm:max-h-[80vh] sm:absolute sm:w-full sm:max-w-md sm:left-1/2 sm:-translate-x-1/2"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        ref={containerRef}
      >
        <div className="flex items-center justify-between px-5 py-4 ">
          <h3 className="text-md text-center font-bold text-slate-800 tracking-tight">Attach Product</h3>
          <button
            onClick={onClose}
            className="p-2 -mr-2 bg-slate-100/50 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto relative flex flex-col">
          <div className="flex px-4 py-3 gap-6 overflow-x-auto no-scrollbar border-b border-slate-100 shrink-0 relative">
            {([
              "cart",
              "purchased",
              ...(auth?.user?.business_id ? ["my_products" as const] : [])
            ]).map(tab => (
              <button
                key={tab}
                onClick={() => setSubTab(tab as SubTabType)}
                className={`pb-2 text-sm font-bold whitespace-nowrap transition-colors relative ${subTab === tab ? "text-slate-800" : "text-slate-400 hover:text-slate-600"
                  }`}
              >
                {tab === "cart" ? "Cart" : tab === "purchased" ? "Purchased" : "My Products"}
                {subTab === tab && (
                  <motion.div
                    layoutId="activeProductTabIndicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500 rounded-full"
                  />
                )}
              </button>
            ))}
          </div>
          <div className="flex-1 p-4 overflow-y-auto min-h-[250px]" onScroll={handleScroll}>
            {loading && page === 1 ? (
              <div className="h-full flex items-center justify-center">
                <StoqleLoader size={32} />
              </div>
            ) : data.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm font-medium">No products found</div>
            ) : (
              <div className="flex flex-col gap-3 pb-6">
                {data.map((product: any, idx: number) => {
                  const title = product.product_name || product.product_title || product.title || "Product";
                  const imageUrl = product.product_image || product.media?.[0]?.url || product.images?.[0];

                  return (
                    <button
                      key={product.product_id || idx}
                      onClick={() => handleProductSelect(product)}
                      className="flex items-center gap-3 p-2 bg-slate-50 rounded-[0.5rem] border border-slate-100 hover:border-rose-200 transition-colors"
                    >
                      <div className="w-16 h-16 rounded-[0.5rem] bg-slate-200 overflow-hidden shrink-0">
                        {imageUrl ? (
                          <CachedImage src={formatUrl(imageUrl)} alt={title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-100">
                            <ShoppingBag className="w-6 h-6 opacity-20" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col text-left flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{title}</p>
                        <p className="text-xs font-semibold text-rose-500 mt-0.5">₦{parseFloat(product.price || product.unit_price || product.base_price || 0).toLocaleString()}</p>
                      </div>
                    </button>
                  );
                })}
                {loading && page > 1 && (
                  <div className="py-4 flex justify-center">
                    <StoqleLoader size={24} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
