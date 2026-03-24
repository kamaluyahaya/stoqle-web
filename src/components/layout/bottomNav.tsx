// src/components/layout/BottomNav.tsx
"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import React from "react";
import { useAuth } from "@/src/context/authContext";
import {
  HomeIcon,
  ShoppingBagIcon,
  PlusIcon,
  ChatBubbleLeftRightIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import {
  HomeIcon as HomeIconSolid,
  ShoppingBagIcon as ShoppingBagIconSolid,
  PlusIcon as PlusIconSolid,
  ChatBubbleLeftRightIcon as ChatBubbleLeftRightIconSolid,
  UserCircleIcon as UserCircleIconSolid,
} from "@heroicons/react/24/solid";

type NavItem = {
  id: string;
  title: string;
  href: string;
  icon: React.ReactNode;
};

import { useChat } from "@/src/context/chatContext";
import { API_BASE_URL } from "@/src/lib/config";

export default function BottomNav() {
  const auth = useAuth();
  const { unreadCount } = useChat();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isLoggedIn =
    !!(auth && (auth.user || (auth as any).token || (auth as any).isAuthenticated || (auth as any).loggedIn));

  const { openLogin } = auth as any;

  // if (!isLoggedIn) return null;
  if (
    pathname === "/cart" || 
    pathname === "/checkout" || 
    (pathname === "/messages" && (searchParams.get("room") || searchParams.get("user"))) || 
    pathname?.startsWith("/shop") ||
    pathname?.startsWith("/profile/business/business-status") ||
    pathname === "/profile/business/customer-order" ||
    pathname?.startsWith("/products/new") ||
    pathname === "/profile/orders" ||
    pathname?.startsWith("/profile/business/inventory") ||
    pathname?.includes("/track/")
  ) return null;

  const rawProfileImage = auth?.user?.business_logo || auth?.user?.profile_pic || auth?.user?.avatar || auth?.user?.photoURL || null;
  const formatUrl = (url: string | null) => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    return url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
  };
  const profileImage = formatUrl(rawProfileImage);

  const items = [
    {
      id: "discover",
      title: "Discover",
      href: "/discover",
      iconOutline: <HomeIcon className="w-5 h-5" aria-hidden />,
      iconSolid: <HomeIconSolid className="w-5 h-5 text-red-500" aria-hidden />,
      protected: false,
    },
    {
      id: "market",
      title: "Market",
      href: "/market",
      iconOutline: <ShoppingBagIcon className="w-5 h-5" aria-hidden />,
      iconSolid: <ShoppingBagIconSolid className="w-5 h-5 text-red-500" aria-hidden />,
      protected: false,
    },
    {
      id: "release",
      title: "Release",
      href: "/release",
      iconOutline: <PlusIcon className="w-5 h-5" aria-hidden />,
      iconSolid: <PlusIconSolid className="w-5 h-5 text-red-500" aria-hidden />,
      protected: true,
    },
    {
      id: "message",
      title: "Message",
      href: "/messages",
      iconOutline: <ChatBubbleLeftRightIcon className="w-5 h-5" aria-hidden />,
      iconSolid: <ChatBubbleLeftRightIconSolid className="w-5 h-5 text-red-500" aria-hidden />,
      badge: unreadCount,
      protected: true,
    },
    {
      id: "profile",
      title: "Profile",
      href: "/profile",
      iconOutline: isLoggedIn && profileImage ? (
        <img src={profileImage} alt="Profile" className="h-6 w-6 rounded-full object-cover" />
      ) : (
        <UserCircleIcon className="h-6 w-6" aria-hidden />
      ),
      iconSolid: isLoggedIn && profileImage ? (
        <img src={profileImage} alt="Profile" className="h-6 w-6 rounded-full object-cover border-2 border-red-500" />
      ) : (
        <UserCircleIconSolid className="h-6 w-6 text-red-500" aria-hidden />
      ),
      protected: true,
    },
  ];

  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] bg-white/95 border-t border-slate-100 backdrop-blur"
      style={{
        // respect notch/safe-area
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="max-w-[900px] mx-auto px-3">
        {/* compact row: icons only on small screens, icon + label inline on md */}
        <div className="flex items-center justify-between gap-1 pt-1 pb-0.5">
          {items.map((it) => {
            const active = pathname === it.href;
            const isProtected = it.protected;

            const handleClick = (e: React.MouseEvent) => {
              if (isProtected && !isLoggedIn) {
                e.preventDefault();
                if (openLogin) {
                  openLogin();
                } else {
                  // fallback if openLogin not available
                  window.location.href = "/login";
                }
              }
            };

            return (
              <Link
                key={it.id}
                href={it.href}
                onClick={handleClick}
                className={`flex-1 min-w-0 flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-2 px-1 py-1 rounded-lg transition
                  ${active ? "text-red-500" : "text-slate-500 hover:text-slate-900"}`}
                aria-current={active ? "page" : undefined}
                aria-label={it.title}
              >
                <div className="relative flex items-center justify-center bg-transparent mt-0 mb-0">
                  {active ? it.iconSolid : it.iconOutline}
                  {isLoggedIn && it.badge ? (
                    <span className="absolute -top-1.5 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white ring-1 ring-white">
                      {it.badge > 99 ? "99+" : it.badge}
                    </span>
                  ) : null}
                </div>
                
                <span className={`text-[9px] sm:text-[10px] md:text-sm md:inline-block whitespace-nowrap mt-0.5 md:mt-0 ${active ? "font-bold text-red-500" : "font-medium"}`}>
                  {it.title}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
