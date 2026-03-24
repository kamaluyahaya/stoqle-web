"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/src/context/authContext";
import { useCart } from "@/src/context/cartContext";
import { API_BASE_URL } from "@/src/lib/config";

type MenuProps = {
  label: string;
  description?: string;
  items?: { id: string; label: string; onClick?: () => void; href?: string; badge?: number | string }[];
  className?: string;
  avatar?: string | null;
};

function HoverMenu({ label, description, items = [], className = "", avatar }: MenuProps) {
  const [open, setOpen] = useState(false);
  // type-safe timeout ref
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const handleEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(true);
  };
  const handleLeave = () => {
    timerRef.current = setTimeout(() => setOpen(false), 120);
  };

  const handleToggle = () => setOpen((s) => !s);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((s) => !s);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={`relative ${className}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onTouchStart={handleEnter}
    >
      <button
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={handleToggle}
        onKeyDown={onKeyDown}
        className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-black focus:outline-none rounded-full"
      >
        {avatar && <img src={avatar} alt="" className="h-6 w-6 rounded-full object-cover border border-gray-100" />}
        <span>{label}</span>
      </button>

      {/* Dropdown */}
      <div
        role="menu"
        aria-hidden={!open}
        className={`
          absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border-gray-200 bg-white shadow-lg shadow-black/10
          transform transition-all duration-150
          ${open ? "opacity-100 pointer-events-auto translate-y-0" : "opacity-0 pointer-events-none -translate-y-1"}
        `}
      >
        {description && <div className="px-4 py-3 text-sm text-gray-600">{description}</div>}
        {items && items.length > 0 && (
          <ul className="py-1 text-sm text-gray-700">
            {items.map((it: any) => (
              <li
                key={it.id}
                role="menuitem"
              >
                <Link
                  href={it.href || "#"}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 rounded-full cursor-pointer"
                >
                  <span>{it.label}</span>
                  {it.badge !== undefined && (it.badge as number) > 0 && (
                    <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center">
                      {it.badge}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function RightMenus() {
  const router = useRouter();
  const { user, isLoggedIn } = useAuth() as any;
  const { cartCount } = useCart();
  
  const firstName = user?.author_name?.split(" ")[0] || user?.full_name?.split(" ")[0] || "Profile";
  const displayName = user?.business_name || firstName;

  const rawProfileImage = user?.business_logo || user?.profile_pic || user?.avatar || user?.photoURL || null;
  const formatUrl = (url: string | null) => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    return url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
  };
  const profileImage = formatUrl(rawProfileImage);

  return (
    <div className="flex min-w-[200px] items-center justify-end gap-6">
      {isLoggedIn && (
        <HoverMenu
          label={displayName}
          avatar={profileImage}
          items={[
            { id: "profile-1", label: "Wallet", href: "/profile/wallet" },
            { id: "profile-2", label: "Order", href: "/profile/orders" },
            { id: "profile-3", label: "Cart", href: "/cart", badge: cartCount || 0 },
            { id: "profile-4", label: "My Account", href: "/profile" },
          ]}
        />
      )}

      <HoverMenu
        label="Creative Center"
        items={[
          { id: "creative-1", label: "Portfolio", href: "/creative/portfolio" },
          { id: "creative-2", label: "Contact creatives", href: "/creative/contact" },
        ]}
      />

      <HoverMenu
        label="Business Cooperation"
        items={[
          { id: "biz-1", label: "Business account", href: "/business/account" },
          { id: "biz-2", label: "Merchant onboarding", href: "/business/onboarding" },
        ]}
      />
    </div>
  );
}
