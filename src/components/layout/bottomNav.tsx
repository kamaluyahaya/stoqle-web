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

export default function BottomNav() {
  const auth = useAuth();
  const pathname = usePathname();

  // best-effort "logged in" check (adjust if your auth exposes a specific flag)
  const isLoggedIn =
    !!(auth && (auth.user || (auth as any).token || (auth as any).isAuthenticated || (auth as any).loggedIn));

  if (!isLoggedIn) return null;

  const items: NavItem[] = [
    {
      id: "discover",
      title: "Discover",
      href: "/discover",
      icon: <HomeIcon className="w-5 h-5" aria-hidden />,
    },
    {
      id: "market",
      title: "Market",
      href: "/market",
      icon: <ShoppingBagIcon className="w-5 h-5" aria-hidden />,
    },
    {
      id: "release",
      title: "Release",
      href: "/release",
      icon: <PlusIcon className="w-5 h-5" aria-hidden />,
    },
    {
      id: "message",
      title: "Message",
      href: "/messages",
      icon: <ChatBubbleLeftRightIcon className="w-5 h-5" aria-hidden />,
    },
    {
      id: "profile",
      title: "Profile",
      href: "/profile",
      icon: <UserCircleIcon className="w-5 h-5" aria-hidden />,
    },
  ];

  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-[70] bg-white/95 border-t border-slate-100 backdrop-blur"
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
            return (
              <Link
                key={it.id}
                href={it.href}
                className={`flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 rounded-lg transition
                  ${active ? "text-rose-600" : "text-slate-600 hover:text-slate-900"}`}
                aria-current={active ? "page" : undefined}
                aria-label={it.title}
              >
                <div
                  className={`flex items-center justify-center rounded-md w-9 h-6 ${
                    active ? "bg-rose-100" : "bg-transparent"
                  }`}
                >
                  {it.icon}
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
