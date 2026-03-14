// src/components/layout/BottomNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { useAuth } from "@/src/context/authContext";
import {
  HomeIcon,
  ShoppingBagIcon,
  PlusIcon,
  ChatBubbleLeftRightIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";

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

  const isLoggedIn =
    !!(auth && (auth.user || (auth as any).token || (auth as any).isAuthenticated || (auth as any).loggedIn));

  const { openLogin } = auth as any;

  // if (!isLoggedIn) return null;
  if (
    pathname === "/cart" || 
    pathname === "/checkout" || 
    pathname === "/messages" || 
    pathname?.startsWith("/shop") ||
    pathname?.startsWith("/profile/business/business-status") ||
    pathname?.startsWith("/products/new")
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
      icon: <HomeIcon className="w-5 h-5" aria-hidden />,
      protected: false,
    },
    {
      id: "market",
      title: "Market",
      href: "/market",
      icon: <ShoppingBagIcon className="w-5 h-5" aria-hidden />,
      protected: false,
    },
    {
      id: "release",
      title: "Release",
      href: "/release",
      icon: <PlusIcon className="w-5 h-5" aria-hidden />,
      protected: true,
    },
    {
      id: "message",
      title: "Message",
      href: "/messages",
      icon: <ChatBubbleLeftRightIcon className="w-5 h-5" aria-hidden />,
      badge: unreadCount,
      protected: true,
    },
    {
      id: "profile",
      title: "Profile",
      href: "/profile",
      icon: isLoggedIn && profileImage ? (
        <img src={profileImage} alt="Profile" className="h-6 w-6 rounded-full object-cover" />
      ) : (
        <UserCircleIcon className="h-6 w-6" aria-hidden />
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
        <div className="flex items-center justify-between gap-1 py-2">
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
                className={`flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 rounded-lg transition
                  ${active ? "text-rose-600" : "text-slate-600 hover:text-slate-900"}`}
                aria-current={active ? "page" : undefined}
                aria-label={it.title}
              >
                <div
                  className={`relative flex items-center justify-center rounded-md w-9 h-6 ${active ? "bg-rose-100" : "bg-transparent"
                    }`}
                >
                  {it.icon}
                  {isLoggedIn && it.badge ? (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white ring-1 ring-white">
                      {it.badge > 99 ? "99+" : it.badge}
                    </span>
                  ) : null}
                </div>

                {/* label placed inline to the right of the icon on md+, hidden on small screens */}
                <span className="text-sm font-medium hidden md:inline-block whitespace-nowrap">
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
