import React, { useEffect, useState } from "react";
import { LifebuoyIcon, BuildingStorefrontIcon, ShoppingCartIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/src/context/authContext";
import { fetchCartApi } from "@/src/lib/api/cartApi";
import { useRouter } from "next/navigation";

export default function ActionBar({ onAddToCart, onBuyNow, onOpenChat, onCartClick, onShopClick, cartCount = 0, shopLogo, businessId }: any) {
  const router = useRouter();
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const { token, user } = useAuth();
  const currentUserBizId = user?.business_id || (user as any)?.business?.business_id;
  const isOwner = currentUserBizId && businessId && Number(currentUserBizId) === Number(businessId);
  const [localCount, setLocalCount] = useState(cartCount);

  const loadCount = async () => {
    if (!token) return;
    try {
      const res = await fetchCartApi(token);
      if (res.status === "success" && res.data?.items) {
        setLocalCount(res.data.items.length);
      }
    } catch (err) {
      console.error("Failed to fetch cart count:", err);
    }
  };

  useEffect(() => {
    loadCount();
  }, [token]);

  // Listen for custom "cart-updated" event for instant feedback
  useEffect(() => {
    const handleUpdate = () => {
      loadCount();
    };
    window.addEventListener("cart-updated", handleUpdate);
    return () => window.removeEventListener("cart-updated", handleUpdate);
  }, [token]);

  useEffect(() => {
    if (cartCount > 0 && cartCount !== localCount) {
      setLocalCount(cartCount);
    }
  }, [cartCount]);

  return (
    <div onMouseDown={stop} className="fixed lg:sticky left-0 bottom-0 z-40 w-full border-t border-slate-100 bg-white/95 backdrop-blur px-1 py-1">
      <div className="flex items-center gap-1">
        <button
          onMouseDown={stop}
          onClick={() => onShopClick ? onShopClick() : businessId && router.push(`/shop/${businessId}`)}
          className="flex flex-col items-center justify-center w-14"
        >
          <div className="rounded-xl bg-white flex items-center justify-center overflow-hidden hover:shadow-sm">
            {shopLogo ? (
              <img src={String(shopLogo)} alt="Shop logo" className="h-5 w-5 object-cover mt-1 border border-slate-300 rounded-full p-1" />
            ) : (
              <BuildingStorefrontIcon className="w-5 h-5 text-slate-600" />
            )}
          </div>
          <span className="text-[11px] text-slate-800 font-bold">Shop</span>
        </button>

        <button onMouseDown={stop} onClick={() => onOpenChat && onOpenChat()} className="flex flex-col items-center justify-center w-14">
          <div className=" rounded-xl bg-white flex items-center justify-center hover:shadow-sm"><LifebuoyIcon className="w-5 h-5 text-slate-600" /></div>
          <span className="font-bold text-[11px] text-slate-800">Service</span>
        </button>

        <div id="cart-icon-ref" onClick={() => onCartClick ? onCartClick() : router.push("/cart")} className="relative flex flex-col items-center group w-14 cursor-pointer">
          <button onMouseDown={stop} className="rounded-xl bg-white flex items-center justify-center hover:shadow-sm transition-transform active:scale-95">
            <ShoppingCartIcon className="w-5 h-5 text-slate-600" />
          </button>
          {localCount > 0 && (
            <div className="absolute -top-1 right-3 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center shadow-sm border border-white">
              {localCount}
            </div>
          )}
          <span className="text-[11px] text-slate-800 font-bold">Cart</span>
        </div>

        <div className="ml-auto flex flex-1 overflow-hidden rounded-full bg-white">
          {isOwner ? (
            <div className="flex-1 py-2 text-center text-xs font-bold text-slate-400 bg-slate-50 italic">
              Owning this product
            </div>
          ) : (
            <>
              <button onMouseDown={stop} onClick={onAddToCart} className="flex-1 py-1.5 text-[11px] font-bold text-red-500 bg-red-50 hover:bg-red-100 transition">Add to cart</button>
              <button onMouseDown={stop} onClick={onBuyNow} className="flex-1 py-1.5 text-[11px] font-bold text-white bg-red-600 hover:bg-red-500 transition">Buy now</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}