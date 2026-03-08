import React from "react";
import { LifebuoyIcon, BuildingStorefrontIcon, ShoppingCartIcon } from "@heroicons/react/24/outline";

export default function ActionBar({ onAddToCart, onBuyNow, onOpenChat, cartCount = 0, shopLogo }: any) {
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  return (
    <div onMouseDown={stop} className="fixed lg:sticky left-0 bottom-0 z-40 w-full border-t border-slate-100 bg-white/95 backdrop-blur px-1 py-1">
      <div className="flex items-center gap-1">
        <button onMouseDown={stop} className="flex flex-col items-center justify-center w-14">
          <div className="rounded-xl bg-white flex items-center justify-center overflow-hidden hover:shadow-sm">{shopLogo ? <img src={String(shopLogo)} alt="Shop logo" className="h-5 w-5 object-cover  mt-1 border border-slate-300 rounded-full p-1" /> : <BuildingStorefrontIcon className="w-5 h-5 text-slate-600" />}</div>
          <span className="text-[11px] text-slate-800 font-bold">Shop</span>
        </button>

        <button onMouseDown={stop} onClick={() => onOpenChat && onOpenChat()} className="flex flex-col items-center justify-center w-14">
          <div className=" rounded-xl bg-white flex items-center justify-center hover:shadow-sm"><LifebuoyIcon className="w-5 h-5 text-slate-600" /></div>
          <span className="font-bold text-[11px] text-slate-800">Service</span>
        </button>

        <div className="relative flex flex-col items-center ">
          <button onMouseDown={stop} className=" rounded-xl bg-white flex items-center justify-center hover:shadow-sm"><ShoppingCartIcon className="w-5 h-5 text-slate-600" /></button>
          {cartCount > 0 && <div className="absolute top-2 right-2 w-1 h-1 p-2 rounded-full bg-rose-500 text-white text-[11px] font-semibold flex items-center justify-center">{cartCount}</div>}
          <span className="text-[11px] text-slate-800 font-bold ">Cart</span>
        </div>

        <div className="ml-auto flex flex-1 overflow-hidden rounded-full bg-white">
          <button onMouseDown={stop} onClick={onAddToCart} className="flex-1 py-2 text-sm font-bold text-red-500 bg-red-50 hover:bg-red-100 transition">Add to cart</button>
          <button onMouseDown={stop} onClick={onBuyNow} className="flex-1 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-500 transition">Buy now</button>
        </div>
      </div>
    </div>
  );
}