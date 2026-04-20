// src/components/layout/BottomNav.tsx
"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter, useParams } from "next/navigation";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/src/context/authContext";
import {
  HomeIcon,
  ShoppingBagIcon,
  PlusIcon,

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
import { Home, MessageCircleMore } from "lucide-react";

export default function BottomNav() {
  const auth = useAuth();
  const { unreadCount } = useChat();
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter(); // add router
  const searchParams = useSearchParams();
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  // Prevents hydration mismatch — auth state is client-only
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const isLoggedIn =
    !!(auth && (auth.user || (auth as any).token || (auth as any).isAuthenticated || (auth as any).loggedIn));

  const { openLogin } = auth as any;

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
    pathname === "/release" ||
    pathname?.includes("/track/") ||
    !!params?.username
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
      iconOutline: <Home className="w-5 h-5" aria-hidden />,
      iconSolid: <Home className="w-5 h-5 text-rose-500" aria-hidden />,
      protected: false,
    },
    {
      id: "market",
      title: "Market",
      href: "/market",
      iconOutline: <ShoppingBagIcon className="w-5 h-5" aria-hidden />,
      iconSolid: <ShoppingBagIconSolid className="w-5 h-5 text-rose-500" aria-hidden />,
      protected: false,
    },
    {
      id: "release",
      title: "Release",
      href: "/release",
      iconOutline: <PlusIcon className="w-6 h-6 text-white" strokeWidth={3} aria-hidden />,
      iconSolid: <PlusIconSolid className="w-6 h-6 text-white" aria-hidden />,
      protected: true,
      isSpecial: true,
    },
    {
      id: "message",
      title: "Message",
      href: "/messages",
      iconOutline: <MessageCircleMore className="w-5 h-5" aria-hidden />,
      iconSolid: <MessageCircleMore className="w-5 h-5 text-rose-500" aria-hidden />,
      badge: unreadCount,
      protected: true,
    },
    {
      id: "profile",
      title: "Profile",
      href: "/profile",
      iconOutline: mounted && isLoggedIn && profileImage ? (
        <img src={profileImage} alt="Profile" className="h-6 w-6 rounded-full object-cover" />
      ) : (
        <UserCircleIcon className="h-6 w-6" aria-hidden />
      ),
      iconSolid: mounted && isLoggedIn && profileImage ? (
        <img src={profileImage} alt="Profile" className="h-6 w-6 rounded-full object-cover border-2 border-rose-500" />
      ) : (
        <UserCircleIconSolid className="h-6 w-6 text-rose-500" aria-hidden />
      ),
      protected: true,
    },
  ];

  return (
    <>
      <nav
        aria-label="Primary"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] bg-white/95 border-slate-100 backdrop-blur"
        style={{
          // respect notch/safe-area
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="max-w-[900px] mx-auto px-3">
          <div className="flex items-center justify-between gap-1 pt-0.5 pb-0">
            {items.map((it) => {
              const active = pathname === it.href;
              const isProtected = it.protected;
              const isRelease = it.id === "release";

              const handleClick = async (e: React.MouseEvent) => {
                e.preventDefault();
                if (active) {
                  // If tapping active tab, trigger refresh
                  window.dispatchEvent(new CustomEvent("nav-refresh", { detail: { path: it.href } }));
                  return;
                }

                if (isProtected) {
                  const ok = await auth.ensureLoggedIn();
                  if (!ok) return;
                }

                if (isRelease) {
                  window.dispatchEvent(new CustomEvent("showReleaseModal"));
                  return;
                }

                router.push(it.href);
              };

              return (
                <button
                  key={it.id}
                  onClick={handleClick}
                  className={`flex-1 min-w-0 flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-2 px-1 py-0.5 rounded-lg transition
                    ${active ? "text-rose-500" : "text-slate-500 hover:text-slate-900"}`}
                  aria-current={active ? "page" : undefined}
                  aria-label={it.title}
                >
                  <div className={`relative flex items-center justify-center transition-all ${isRelease ? "bg-rose-500 rounded-[0.5rem] p-1 px-4 shadow-lg shadow-rose-200 active:scale-95" : "bg-transparent mt-0 mb-0"}`}>
                    {active ? it.iconSolid : it.iconOutline}
                    {isLoggedIn && it.badge ? (
                      <span className="absolute -top-1.5 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white ring-1 ring-white">
                        {it.badge > 99 ? "99+" : it.badge}
                      </span>
                    ) : null}
                  </div>

                  {!isRelease && (
                    <span className={`text-[9px] sm:text-[10px] md:text-sm md:inline-block whitespace-nowrap mt-0.5 md:mt-0 ${active ? "font-bold text-rose-500" : "font-medium"}`}>
                      {it.title}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
