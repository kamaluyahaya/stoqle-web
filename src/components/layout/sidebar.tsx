// sidebar.tsx
"use client";

import { Profiler, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  HomeIcon as HomeOutline,
  StarIcon as StarOutline,
  MagnifyingGlassIcon,
  BookmarkIcon as BookmarkOutline,
  ChatBubbleLeftRightIcon as ChatOutline,
  Bars3Icon,
  ShoppingBagIcon,
  ShoppingCartIcon,
} from "@heroicons/react/24/outline";
import { UserCircleIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/src/context/authContext";
import { useChat } from "@/src/context/chatContext";
import { useCart } from "@/src/context/cartContext";
import { fetchCartApi } from "@/src/lib/api/cartApi";
import { API_BASE_URL } from "@/src/lib/config";

type Props = {
  navHeight: number;
  width: number;
};

export default function Sidebar({ navHeight, width }: Props) {
  const router = useRouter();
  const auth = useAuth();
  const { unreadCount } = useChat();
  const { cartCount } = useCart();
  const pathname = usePathname();

  const [showMenu, setShowMenu] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // Directly check auth.user
  const isLoggedIn = !!auth?.user;

  const firstName = auth?.user?.author_name?.split(" ")[0] || auth?.user?.full_name?.split(" ")[0] || "Profile";
  const rawProfileImage = auth?.user?.business_logo || auth?.user?.profile_pic || auth?.user?.avatar || auth?.user?.photoURL || null;
  const formatUrl = (url: string | null) => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    return url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
  };
  const profileImage = formatUrl(rawProfileImage);

  const ProfileIcon = () =>
    isLoggedIn && profileImage ? (
      <img src={profileImage} alt="Profile" className="h-6 w-6 rounded-full object-cover" />
    ) : (
      <UserCircleIcon className="h-6 w-6 text-gray-500" />
    );

  const loginTips = [
    {
      icon: StarOutline,
      text: "Find high-quality content that understands you better.",
    },
    {
      icon: MagnifyingGlassIcon,
      text: "Search for the latest product recommendations and reviews.",
    },
    {
      icon: BookmarkOutline,
      text: "View saved and liked notes.",
    },
    {
      icon: ChatOutline,
      text: "To better interact and communicate with others.",
    },
  ];


  // click outside and escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        showMenu &&
        menuRef.current &&
        !menuRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setShowMenu(false);
        setActiveSubmenu(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowMenu(false);
        setActiveSubmenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [showMenu]);

  // helper: navigate with optional auth gate
  const navWithAuth = async (href: string, requireLogin = false) => {
    if (!requireLogin) {
      router.push(href);
      return;
    }

    // require login: try to ensure logged in (this opens modal via AuthProvider)
    const ok = await auth.ensureLoggedIn();
    if (ok) {
      router.push(href);
    } else {
      // user cancelled login — do nothing or optionally show toast
      return;
    }
  };

  const MenuItem = ({
    label,
    Outline,
    href,
    requireLogin = false,
    badgeCount = 0,
  }: {
    label: string;
    Outline: any;
    href: string;
    requireLogin?: boolean;
    badgeCount?: number;
  }) => (
    <li>
      <Link
        href={href}
        onClick={async (e) => {
          if (pathname === href) {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent("nav-refresh", { detail: { path: href } }));
            return;
          }
          if (requireLogin) {
            e.preventDefault();
            const ok = await auth.ensureLoggedIn();
            if (ok) {
              if (label === "Upload") {
                window.dispatchEvent(new CustomEvent("showReleaseModal"));
              } else {
                router.push(href);
              }
            }
          }
        }}
        className="w-full flex items-center justify-between rounded-full px-4 py-3 font-bold text-slate-700 hover:bg-slate-100 cursor-pointer group transition-colors"
      >
        <div className="flex items-center gap-3">
          <Outline className="h-5 w-5 text-gray-500" />
          <span>{label}</span>
        </div>
        {badgeCount > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
      </Link>
    </li>
  );

  const SubmenuRow = ({ label, href, badge }: { label: string; href: string; badge?: number | string }) => (
    <li>
      <Link
        href={href}
        className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 group transition-colors"
        onClick={() => {
          setShowMenu(false);
          setActiveSubmenu(null);
        }}
      >
        <span className="text-gray-500">{label}</span>
        <div className="flex items-center gap-2">
          {badge !== undefined && (badge as number) > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center">
              {badge}
            </span>
          )}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-transparent group-hover:text-gray-400 transition-transform transform -translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M11 7h6v6" />
          </svg>
        </div>
      </Link>
    </li>
  );

  return (
    <aside
      className="fixed top-0 left-0 z-10 h-screen bg-white flex flex-col hidden lg:flex"
      style={{ width }}
    >
      {/* Top spacer for navbar */}
      <div style={{ height: navHeight }} />

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Main Menu */}
        <ul className="space-y-2 text-slate-600">
          {/* public */}
          <MenuItem label="Discover" Outline={HomeOutline} href="/discover" />
          <MenuItem label="Market" Outline={ShoppingBagIcon} href="/market" />

          {/* gated */}
          <MenuItem
            label="Upload"
            Outline={() => (
              <div className="h-5 w-5 rounded-md border border-gray-400 flex items-center justify-center">
                <span className="text-gray-500 font-bold">+</span>
              </div>
            )}
            href="/release"
            requireLogin={true}
          />

          <MenuItem label="Cart" Outline={ShoppingCartIcon} href="/cart" requireLogin={true} badgeCount={cartCount} />

          <MenuItem label="Messages" Outline={ChatOutline} href="/messages" requireLogin={true} badgeCount={unreadCount} />
          <MenuItem
            label={isLoggedIn ? firstName : "Profile"}
            Outline={ProfileIcon}
            href="/profile"
            requireLogin={true}
          />


        </ul>

        {/* Login Section */}
        {/* Login Section (hidden when logged in or still hydrating) */}
        {auth.isHydrated && !isLoggedIn && (
          <div className="w-full">
            <button
              onClick={() => {
                auth.openLogin();
              }}
              className="w-full rounded-full bg-red-500 text-white py-3 text-sm font-medium shadow-sm hover:bg-red-600 transition"
            >
              Log in now
            </button>

            <div className="mt-3 space-y-2 text-gray-500 text-xs leading-snug border border-gray-200 rounded-xl p-3">
              {loginTips.map(({ icon: Icon, text }, idx) => (
                <p key={idx} className="flex items-start gap-2">
                  <Icon className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  {text}
                </p>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Fixed Hamburger Menu */}
      <div className="p-4 border-gray-200 bg-white sticky bottom-0 z-20">
        <button
          ref={buttonRef}
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu((s) => !s);
            if (showMenu) setActiveSubmenu(null);
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-slate-100 w-full transition-all duration-300"
        >
          <div className="relative w-5 h-5">
            <div className={`absolute inset-0 transition-all duration-300 transform ${showMenu ? 'rotate-90 opacity-0' : 'rotate-0 opacity-100'}`}>
              {isLoggedIn && profileImage ? (
                <img src={profileImage} alt="Profile" className="h-5 w-5 rounded-full object-cover" />
              ) : (
                <Bars3Icon className="h-5 w-5 text-gray-700" />
              )}
            </div>
            <div className={`absolute inset-0 transition-all duration-300 transform ${showMenu ? 'rotate-0 opacity-100' : '-rotate-90 opacity-0'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
          <span className="text-md font-bold text-gray-700">More</span>
        </button>

        {showMenu && (
          <div
            ref={menuRef}
            className="absolute right-0 bottom-full mb-2 w-64 rounded-xl border border-gray-200/60 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.08)] z-[2000]"
          >
            <div className="p-2">
              {activeSubmenu && (
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={() => setActiveSubmenu(null)}
                    className="p-2 rounded-full hover:bg-gray-100"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 text-gray-700"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="text-sm font-bold text-black">{activeSubmenu}</div>
                </div>
              )}

              {!activeSubmenu && (
                <ul className="flex flex-col gap-1">
                  {isLoggedIn && (
                    <li>
                      <button
                        className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 font-medium text-gray-800"
                        onClick={() => setActiveSubmenu("My Profile")}
                      >
                        <div className="flex items-center gap-2">
                          {isLoggedIn && profileImage && (
                            <img src={profileImage} alt="Profile" className="h-6 w-6 rounded-full object-cover border border-gray-100" />
                          )}
                          <span className="truncate max-w-[140px]">{auth?.user?.business_name || firstName}</span>
                        </div>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 text-gray-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </li>
                  )}
                  <li>
                    <button
                      className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 font-medium text-gray-800"
                      onClick={() => setActiveSubmenu("Creative Center")}
                    >
                      Creative Center
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </li>
                  <li>
                    <button
                      className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 font-medium text-gray-800"
                      onClick={() => setActiveSubmenu("Business Cooperation")}
                    >
                      Business Cooperation
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </li>
                  <div className="my-2 border-t border-gray-100" />
                  <li>
                    <button
                      className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 font-medium text-gray-800"
                      onClick={() => setActiveSubmenu("Help and Customer Service")}
                    >
                      Help and Customer Service
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </li>
                  <li>
                    <button
                      className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 font-medium text-gray-800"
                      onClick={() => setActiveSubmenu("Privacy, Agreement")}
                    >
                      Privacy, Agreement
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </li>
                  <li>
                    <button
                      className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 font-medium text-gray-800"
                      onClick={() => setActiveSubmenu("About Stoqle")}
                    >
                      About Stoqle
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </li>
                </ul>
              )}

              {/* Submenus */}
              {activeSubmenu === "My Profile" && (
                <ul className="flex flex-col gap-1">
                  <SubmenuRow label="Wallet" href="/profile/wallet" />
                  <SubmenuRow label="Order" href="/profile/orders" />
                  <SubmenuRow label="Cart" href="/cart" badge={cartCount || 0} />
                  <SubmenuRow label="My Account" href="/profile" />
                </ul>
              )}
              {activeSubmenu === "Creative Center" && (

                <ul className="flex flex-col gap-1">

                  <SubmenuRow label="Portfolio" href="/creative/portfolio" />
                  <SubmenuRow label="Contact creatives" href="/creative/contact" />
                </ul>
              )}

              {activeSubmenu === "Business Cooperation" && (
                <ul className="flex flex-col gap-1">
                  <SubmenuRow label="Business account" href="/business/account" />
                  <SubmenuRow label="Merchant onboarding" href="/business/onboarding" />
                </ul>
              )}
              {activeSubmenu === "Help and Customer Service" && (
                <ul className="flex flex-col gap-1">
                  <SubmenuRow label="FAQ" href="/help/faq" />
                  <SubmenuRow label="Contact support" href="/help/contact" />
                </ul>
              )}
              {activeSubmenu === "Privacy, Agreement" && (
                <ul className="flex flex-col gap-1">
                  <SubmenuRow label="Terms of Service" href="/legal/terms" />
                  <SubmenuRow label="Privacy Policy" href="/legal/privacy" />
                  <SubmenuRow label="Community Guidelines" href="/community-guidelines" />
                </ul>
              )}

              {activeSubmenu === "About Stoqle" && (
                <ul className="flex flex-col gap-1">
                  <SubmenuRow label="Our team" href="/about/team" />
                  <SubmenuRow label="Careers" href="/about/careers" />
                </ul>
              )}

            </div>
          </div>
        )}
      </div>
    </aside>
  );
}