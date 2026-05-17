import { useState, useCallback, useEffect, useRef } from "react";
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
  activePostId: string | number;
  post: any;
  reelsList?: any[];
  currentReelIndex?: number;
  isModalFullyVisible: boolean;
}

export function usePostProducts({
  auth,
  isMobileReels,
  setIsPaused,
  activeVideoRef,
  activePostId,
  post,
  reelsList,
  currentReelIndex,
  isModalFullyVisible
}: UsePostProductsProps) {
  const [selectedProductData, setSelectedProductData] = useState<PreviewPayload | null>(null);
  const [productPreviewOpen, setProductPreviewOpen] = useState(false);
  const [fetchingProductId, setFetchingProductId] = useState<number | null>(null);
  const [hydratedLinkedProducts, setHydratedLinkedProducts] = useState<Record<string, any>>({});
  
  // Track which products we've already tried to hydrate to avoid infinite loops
  const hydrationAttempted = useRef<Set<number>>(new Set());

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
        
        // Also update our hydration cache since we have the full data now
        setHydratedLinkedProducts(prev => ({
          ...prev,
          [activePostId]: dbProduct
        }));

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
  }, [auth?.token, fetchingProductId, formatProductUrl, isMobileReels, setIsPaused, activeVideoRef, activePostId]);

  // AUTO-HYDRATION: Fetch full product details when a post with a linked product is shown
  useEffect(() => {
    const currentItem = isMobileReels && reelsList && currentReelIndex !== undefined 
      ? reelsList[currentReelIndex] 
      : post;
      
    if (!currentItem?.is_product_linked || !currentItem?.linked_product?.product_id || !isModalFullyVisible) return;
    
    const productId = Number(currentItem.linked_product.product_id);
    const postIdStr = String(currentItem.id || activePostId);
    
    // Only hydrate if not already hydrated and not already attempted
    if (!hydratedLinkedProducts[postIdStr] && !hydrationAttempted.current.has(productId)) {
      hydrationAttempted.current.add(productId);
      
      fetchProductById(productId, auth?.token || undefined)
        .then(res => {
          if (res?.data?.product) {
            setHydratedLinkedProducts(prev => ({
              ...prev,
              [postIdStr]: res.data.product
            }));
          }
        })
        .catch(err => {
          console.warn(`Failed to auto-hydrate product ${productId}`, err);
        });
    }
  }, [activePostId, post, isMobileReels, reelsList, currentReelIndex, auth?.token, hydratedLinkedProducts]);

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
