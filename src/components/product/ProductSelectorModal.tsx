// src/components/product/ProductSelectorModal.tsx
"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon, EyeIcon, CheckIcon } from "@heroicons/react/24/outline";
import { FilmIcon } from "lucide-react";
import { useAuth } from "@/src/context/authContext";
import { fetchProductById } from "@/src/lib/api/productApi";
import ProductPreviewModal from "@/src/components/product/addProduct/modal/previewModal";
import { mapProductToPreviewPayload } from "@/src/lib/utils/product/mapping";
import type { PreviewPayload } from "@/src/types/product";
import { API_BASE_URL } from "@/src/lib/config";

const NO_IMAGE_PLACEHOLDER = "/assets/images/favio.png";

const formatUrl = (url: string) => {
  if (!url) return NO_IMAGE_PLACEHOLDER;
  if (url.startsWith("http")) return url;
  const base = (API_BASE_URL || "").replace(/\/$/, "");
  const path = url.startsWith("/public") ? url : (url.startsWith("/") ? `/public${url}` : `/public/${url}`);
  return `${base}${path}`;
};

type Props = {
  onClose: () => void;
  onSelect: (product: any | null) => void;
  selectedId: number | null;
};

export default function ProductSelectorModal({ onClose, onSelect, selectedId }: Props) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/products/unlinked/linking?unlinked=false`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          setProducts(json.data?.products || []);
        }
      } catch (e) {
        console.error("Failed to fetch products for linking", e);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [token]);

  const [isProductPreviewOpen, setIsProductPreviewOpen] = useState(false);
  const [previewPayload, setPreviewPayload] = useState<PreviewPayload | null>(null);
  const [fetchingPreviewId, setFetchingPreviewId] = useState<number | null>(null);

  const onProductPreview = async (e: React.MouseEvent, productId: number) => {
    e.stopPropagation();
    if (fetchingPreviewId) return;
    try {
      setFetchingPreviewId(productId);
      const res = await fetchProductById(productId, token);
      if (res?.data?.product) {
        const payload = mapProductToPreviewPayload(res.data.product, formatUrl);
        setPreviewPayload(payload);
        setIsProductPreviewOpen(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFetchingPreviewId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[200000] flex items-end sm:items-center justify-center p-0">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="relative w-full max-w-lg bg-white h-[80vh] sm:h-[600px] rounded-t-[0.5rem] sm:rounded-[0.5rem] shadow-2xl z-10 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-4 flex items-center justify-between border-b border-slate-50">
          <h3 className="text-sm font-bold text-slate-900">Link a Product</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
            <XMarkIcon className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Remove link option if something is already selected */}
        {selectedId && (
          <button
            onClick={() => { onSelect(null); onClose(); }}
            className="mx-4 mt-3 flex items-center gap-3 p-3 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-rose-300 hover:text-rose-500 transition-all text-xs font-bold"
          >
            <XMarkIcon className="w-4 h-4" />
            Remove linked product
          </button>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-3">
              <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-medium text-slate-400">Loading your products...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 px-8">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                <FilmIcon className="w-8 h-8" />
              </div>
              <p className="text-xs text-slate-400">
                Your products will appear here. Make sure they are published and not deleted.
              </p>
            </div>
          ) : (
            products.map((p) => {
              const displayPrice = p.min_variant_price || p.min_sku_price || p.price;
              const isSelected = selectedId === p.product_id;
              return (
                <button
                  key={p.product_id}
                  onClick={() => {
                    onSelect(isSelected ? null : p);
                    onClose();
                  }}
                  className={`w-full flex items-center gap-4 p-3 rounded-2xl transition-all border-2 ${isSelected
                      ? "border-rose-500 bg-rose-50/50"
                      : "border-slate-50 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-200"
                    }`}
                >
                  {/* Product thumbnail — clicking opens preview */}
                  <div
                    onClick={(e) => onProductPreview(e, p.product_id)}
                    className="w-14 h-14 rounded-xl bg-white border border-slate-100 overflow-hidden flex-shrink-0 relative group"
                  >
                    {p.first_image || p.image_url || p.thumbnail || p.image ? (
                      <img
                        src={formatUrl(p.first_image || p.image_url || p.thumbnail || p.image)}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                        alt=""
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-300">
                        <FilmIcon className="w-6 h-6" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-all">
                      {fetchingPreviewId === p.product_id ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <EyeIcon className="w-4 h-4 text-white opacity-0 group-hover:opacity-100" />
                      )}
                    </div>
                  </div>

                  {/* Product info */}
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{p.title}</p>
                    <p className="text-xs font-black text-rose-500">
                      ₦{Number(displayPrice).toLocaleString()}
                      {(p.min_variant_price || p.min_sku_price) && (
                        <span className="text-[10px] font-medium ml-1">Starts at</span>
                      )}
                    </p>
                  </div>

                  {/* Check mark */}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${isSelected ? "bg-rose-500 text-white" : "bg-slate-200 text-transparent"
                      }`}
                  >
                    <CheckIcon className="w-4 h-4" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {isProductPreviewOpen && previewPayload && (
          <ProductPreviewModal
            open={isProductPreviewOpen}
            payload={previewPayload}
            zIndex={3000000}
            onClose={() => {
              setIsProductPreviewOpen(false);
              setPreviewPayload(null);
            }}
          />
        )}
      </motion.div>
    </div>
  );
}
