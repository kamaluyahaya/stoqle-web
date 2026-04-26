import { useState, useCallback } from "react";
import { API_BASE_URL } from "@/src/lib/config";
import { fetchProductById } from "@/src/lib/api/productApi";
import { mapProductToPreviewPayload } from "@/src/lib/utils/product/mapping";
import { toast } from "sonner";
import type { PreviewPayload } from "@/src/types/product";

interface UsePostProductsProps {
  auth: any;
  isMobileReels: boolean;
  setIsPaused: (val: boolean) => void;
  activeVideoRef: React.RefObject<HTMLVideoElement | null>;
}

export function usePostProducts({
  auth,
  isMobileReels,
  setIsPaused,
  activeVideoRef
}: UsePostProductsProps) {
  const [selectedProductData, setSelectedProductData] = useState<PreviewPayload | null>(null);
  const [productPreviewOpen, setProductPreviewOpen] = useState(false);
  const [fetchingProductId, setFetchingProductId] = useState<number | null>(null);
  const [hydratedLinkedProducts, setHydratedLinkedProducts] = useState<Record<string, any>>({});

  const formatProductUrl = useCallback((url: string) => {
    if (!url) return "https://via.placeholder.com/800x600?text=No+Image";
    let final = url;
    if (!url.startsWith('http')) {
      final = url.startsWith('/public') ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
    }
    return encodeURI(final);
  }, []);

  const handleProductClick = useCallback(async (productId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (fetchingProductId) return;

    try {
      setFetchingProductId(productId);
      const res = await fetchProductById(productId, auth?.token || undefined);
      if (res?.data?.product) {
        if (!isMobileReels) {
          if (activeVideoRef.current) activeVideoRef.current.pause();
          setIsPaused(true);
        }

        const dbProduct = res.data.product;
        const mappedPayload = mapProductToPreviewPayload(dbProduct, formatProductUrl);
        setSelectedProductData(mappedPayload);
        setProductPreviewOpen(true);
      }
    } catch (err) {
      console.error("fetchProductById error", err);
      toast.error("Failed to load product details");
    } finally {
      setFetchingProductId(null);
    }
  }, [auth?.token, fetchingProductId, formatProductUrl, isMobileReels, setIsPaused, activeVideoRef]);

  return {
    selectedProductData,
    productPreviewOpen,
    setProductPreviewOpen,
    fetchingProductId,
    hydratedLinkedProducts,
    setHydratedLinkedProducts,
    handleProductClick
  };
}
