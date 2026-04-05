"use client";

import { useEffect, useRef, useState } from "react";
import RightMenus from "../right-menus";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/src/context/authContext"; // adjust path if needed
import { useCart } from "@/src/context/cartContext";
import { API_BASE_URL } from "@/src/lib/config";
import SearchModal from "../modal/SearchModal";
import SearchResultsModal from "../modal/SearchResultsModal";
import {
  Bars3Icon,
  XMarkIcon,
  UserPlusIcon,
  SparklesIcon,
  DocumentTextIcon,
  ChatBubbleOvalLeftIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  InformationCircleIcon,
  QrCodeIcon,
  QuestionMarkCircleIcon,
  Cog6ToothIcon,
  ChevronLeftIcon,
  MagnifyingGlassIcon,
  ChevronRightIcon,
  CreditCardIcon
} from "@heroicons/react/24/outline";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/src/context/walletContext";
type Props = {
  height: number;
};

export default function Navbar({ height }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // const [searchTab, setSearchTab] = useState<string | undefined>(undefined);
  const [showMobileMenu, setShowMobileMenu] = useState(false); // new: mobile dropdown open
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null); // new: which submenu is visible
  const searchRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null); // ref for click outside
  const router = useRouter();
  const { token, user, openLogin } = useAuth();
  const { cartCount } = useCart();
  const { openWallet } = useWallet();
  const lastPath = useRef(pathname);

  useEffect(() => {
    // Clear search query when navigating to a new non-search page
    if (pathname !== "/search" && pathname !== lastPath.current) {
      setSearchQuery("");
    }
    lastPath.current = pathname;
  }, [pathname]);

  const openTypingModal = () => {
    const params = new URLSearchParams(window.location.search);
    params.set('typing', 'true');
    const newUrl = `${pathname}?${params.toString()}`;
    if (pathname === "/search") {
      router.replace(newUrl);
    } else {
      router.push(newUrl);
    }
  };

  // best-effort logged-in check
  const isLoggedIn =
    Boolean(
      (user ||
        token)
    );

  const firstName = user?.author_name?.split(" ")[0] || user?.full_name?.split(" ")[0] || "Profile";
  const displayName = user?.business_name || firstName;

  const rawProfileImage = user?.business_logo || user?.profile_pic || user?.avatar || user?.photoURL || null;
  const formatUrl = (url: string | null) => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    return url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
  };
  const profileImage = formatUrl(rawProfileImage);

  const MobileSubmenuRow = ({ label, href, badge }: { label: string; href: string; badge?: number | string }) => (
    <li>
      <Link
        href={href}
        className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 group transition-colors"
        onClick={() => {
          setShowMobileMenu(false);
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

  useEffect(() => {
    if (showMobileSearch) {
      const t = setTimeout(() => searchRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [showMobileSearch]);

  // close mobile search/menu when crossing sm/lg breakpoints
  useEffect(() => {
    const handleResize = () => {
      // Tailwind sm breakpoint = 640px, lg = 1024px
      if (window.innerWidth >= 640) {
        setShowMobileSearch(false);
      }
      if (window.innerWidth >= 1024) {
        setShowMobileMenu(false);
        setActiveSubmenu(null);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // click outside / escape to close mobile menu
  useEffect(() => {
    if (showMobileMenu) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    const handleClick = (e: MouseEvent) => {
      if (!showMobileMenu) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMobileMenu(false);
        setActiveSubmenu(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowMobileMenu(false);
        setActiveSubmenu(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [showMobileMenu]);

  return (
    <>
      <SearchModal
        isOpen={showMobileSearch || searchParams.get('typing') === 'true'}
        onClose={() => {
          if (searchParams.get('typing') === 'true') {
            router.back();
          }
          setShowMobileSearch(false);
          setSearchQuery("");
        }}
        initialQuery={searchQuery}
        onSearch={(q, tab) => {
          setSearchQuery(q);
          setShowMobileSearch(false);
          const searchUrl = `/search?q=${encodeURIComponent(q)}${tab ? `&tab=${tab}` : ''}`;
          if (pathname === "/search") {
            router.replace(searchUrl);
          } else {
            router.push(searchUrl);
          }
        }}
      />

      <AnimatePresence>
        {showMobileMenu && isLoggedIn && (
          <>
            {/* Logged-In Full-Page Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileMenu(false)}
              className="fixed inset-0 z-[400000] bg-black/60 "
            />

            {/* Logged-In Mobile Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-screen w-[75%] bg-white z-[500000] flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Header (Top of Drawer) */}
              <div className="p-4 mt-5 relative flex items-center justify-center border-gray-50 bg-white">
                {user && (
                    <Link
                      href="/profile/business/business-status"
                      onClick={() => setShowMobileMenu(false)}
                      className="bg-red-500 text-white px-6 py-1.5 rounded-full text-xs font-extrabold shadow-sm active:scale-95 transition-all"
                    >
                      {Boolean(user?.is_business_owner || user?.business_name || user?.business_id || user?.isBusiness) ? "My shop" : "Open Store"}
                    </Link>
                )}

                <button
                  onClick={() => setShowMobileMenu(false)}
                  className="absolute right-4 p-2 rounded-full hover:bg-slate-50 transition-colors"
                >
                  <XMarkIcon className="h-5 w-5 text-slate-400" />
                </button>
              </div>


              {/* Main Scrollable Menu Section */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Group 1: Personal / Social - prioritizing per user request */}
                <MenuGroup>
                  <DrawerItem
                    label="Add friends"
                    icon={UserPlusIcon}
                    href={`/user/profile/${user?.id || user?.user_id}?tab=friends`}
                    onClick={() => setShowMobileMenu(false)}
                  />
                  <DrawerItem
                    label="Draft"
                    icon={DocumentTextIcon}
                    href="/profile?tab=Drafts"
                    onClick={() => setShowMobileMenu(false)}
                  />
                </MenuGroup>

                {/* Group 2: Creator & Comments */}
                <MenuGroup>
                  <DrawerItem
                    label="Creator center"
                    icon={SparklesIcon}
                    href="/creative/portfolio"
                    onClick={() => setShowMobileMenu(false)}
                  />
                  <DrawerItem
                    label="My comments"
                    icon={ChatBubbleOvalLeftIcon}
                    href="/profile?tab=Comments"
                    onClick={() => setShowMobileMenu(false)}
                  />
                </MenuGroup>

                {/* Group 3: Shopping & Finance - Wallet under Order */}
                <MenuGroup>
                  <DrawerItem
                    label="Order"
                    icon={ShoppingBagIcon}
                    href="/profile/orders"
                    onClick={() => setShowMobileMenu(false)}
                  />
                  <DrawerItem
                    label="Wallet"
                    icon={CreditCardIcon}
                    onClick={() => {
                      setShowMobileMenu(false);
                      openWallet();
                    }}
                  />
                  <DrawerItem
                    label="Cart"
                    icon={ShoppingCartIcon}
                    href="/cart"
                    badge={cartCount}
                    onClick={() => setShowMobileMenu(false)}
                  />
                </MenuGroup>

                {/* Group 4: Information */}
                <MenuGroup>
                  <DrawerItem
                    label="Community Guidelines"
                    icon={InformationCircleIcon}
                    href="/help/guidelines"
                    onClick={() => setShowMobileMenu(false)}
                  />
                </MenuGroup>
              </div>



              {/* Bottom Footer Section */}
              <div className="p-6  border-gray-100">
                <div className="flex items-center justify-around">
                  {[
                    { label: "Scan", icon: QrCodeIcon, href: "/scan" },
                    { label: "Help center", icon: QuestionMarkCircleIcon, href: "/help/faq" },
                    { label: "Settings", icon: Cog6ToothIcon, href: "/settings" },
                  ].map((item, idx) => (
                    <Link
                      key={idx}
                      href={item.href}
                      onClick={() => { }}
                      className="flex flex-col items-center gap-1 group"
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-100 group-hover:border-red-500 transition-all">
                        <item.icon className="w-4 h-4 text-slate-400 group-hover:text-red-500 transition-colors" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-900 transition-colors">
                        {item.label}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <header
        className={`fixed top-0 inset-x-0 bg-white backdrop-blur-md p-2 ${pathname === "/messages" || pathname?.startsWith("/shop") || pathname === "/profile/business/customer-order" || pathname?.includes("/track/") || pathname?.startsWith("/profile/business/inventory")
          ? "hidden sm:block"
          : ""
          }`}
        style={{ height, zIndex: (showMobileMenu || showMobileSearch) ? 300000 : 1000 }}
      >
        <div className="mx-auto flex h-full items-center px-4 w-full">
          {/* ---------- Desktop & Tablet: Logo & main search ---------- */}
          <Link href="/discover" className="flex min-w-[32px] sm:min-w-[160px] items-center cursor-pointer">
            <div className="rounded-full bg-red-500 px-3 py-1.5 text-md font-semibold text-white">
              stoqle
            </div>
          </Link>

          {/* CENTER — Search (desktop / tablet) */}
          <div className="flex flex-1 justify-center px-6">
            <div
              className="relative w-full max-w-2xl hidden sm:block cursor-pointer"
              onClick={openTypingModal}
            >
              <div className="
                    w-full
                    rounded-full
                    bg-gray-100
                    px-5
                    py-2
                    pr-11
                    text-sm
                    text-gray-500
                    transition
                    hover:ring-1
                    hover:ring-gray-300
                    flex
                    items-center
                  "
              >
                Search products, orders, or vendors
              </div>

              {/* Search Icon (decorative on desktop) */}
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1010.5 3a7.5 7.5 0 006.15 13.65z" />
                </svg>
              </span>
            </div>
          </div>

          {/* RIGHT — Desktop menus */}
          <div className="hidden lg:block">
            <RightMenus />
          </div>

          {/* RIGHT — Mobile icons (search icon + hamburger). Visible under lg */}
          <div className="flex items-center gap-2 lg:hidden">
            {/* Search icon: visible only on very small screens (sm:hidden) */}
            <button
              onClick={openTypingModal}
              className="sm:hidden rounded-full p-2 hover:bg-gray-100"
              aria-label="Open search"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1010.5 3a7.5 7.5 0 006.15 13.65z" />
              </svg>
            </button>

            {/* Hamburger + optional anchored dropdown / drawer trigger */}
            <div className="relative">
              <button
                className="rounded-full p-2 hover:bg-gray-100 transition-all duration-300"
                aria-label="Menu"
                onClick={() => {
                  setShowMobileMenu((s) => !s);
                  setActiveSubmenu(null);
                }}
              >
                <div className="relative w-5 h-5">
                  <div
                    className={`absolute inset-0 transition-all duration-300 transform ${showMobileMenu ? 'rotate-90 opacity-0' : 'rotate-0 opacity-100'}`}
                  >
                    <Bars3Icon className="h-5 w-5 text-gray-700" />
                  </div>
                  <div
                    className={`absolute inset-0 transition-all duration-300 transform ${showMobileMenu ? 'rotate-0 opacity-100' : '-rotate-90 opacity-0'}`}
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-700" />
                  </div>
                </div>
              </button>

              {/* 2. Legacy Dropdown (For Logged Out Users - keep simplicity) */}
              {showMobileMenu && !isLoggedIn && (
                <div
                  className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-gray-200/60 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.08)] z-[2000]"
                  role="menu"
                  aria-label="Mobile menu"
                >
                  {/* Dropdown content */}
                  <div className="p-2">
                    {/* Back header shown when in a submenu */}
                    {activeSubmenu && (
                      <div className="flex items-center gap-2 mb-3">
                        <button
                          onClick={() => setActiveSubmenu(null)}
                          aria-label="Back"
                          className="p-2 rounded-full hover:bg-gray-100/10"
                        >
                          <ChevronLeftIcon className="h-4 w-4 text-gray-700" />
                        </button>

                        <div className="flex-1 px-3 py-2 rounded-md">
                          <div className="text-sm font-bold text-black">{activeSubmenu}</div>
                        </div>
                      </div>
                    )}

                    {!activeSubmenu && (
                      <div>
                        <ul className="flex flex-col gap-1">
                          <li>
                            <button
                              className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 font-medium text-gray-800"
                              onClick={() => setActiveSubmenu("Creative Center")}
                            >
                              Creative Center
                              {/* Forward iOS arrow */}
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </li>
                        </ul>

                        {/* divider */}
                        <div className="my-2  " />

                        <ul className="flex flex-col gap-1">
                          <li>
                            <button
                              className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 font-medium text-gray-800"
                              onClick={() => setActiveSubmenu("Help and Customer Service")}
                            >
                              Help and Customer Service
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </li>
                        </ul>

                        {/* Login button (only when NOT logged in) */}
                        <div className="mt-3 flex justify-center pb-2">
                          <button
                            onClick={async () => {
                              await openLogin();
                            }}
                            className="w-[90%] rounded-full bg-red-500 text-white px-6 py-2 text-sm font-bold shadow-sm active:scale-95 transition-all"
                          >
                            Login
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}

// ── Styled Menu Components ─────────────────────────────────────

function MenuGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-slate-50 border border-slate-100/50 rounded-2xl overflow-hidden divide-y divide-slate-100/60 ">
      {children}
    </div>
  );
}

function DrawerItem({
  label,
  icon: Icon,
  href,
  onClick,
  badge,
}: {
  label: string;
  icon: any;
  href?: string;
  onClick: () => void;
  badge?: number;
}) {
  const content = (
    <div className="flex items-center justify-between p-4 hover:bg-slate-100 active:bg-slate-200 transition-all group active:scale-[0.99] cursor-pointer">
      <div className="flex items-center gap-4">
        <Icon className="w-5 h-5 text-slate-500 group-hover:text-red-500 transition-colors" />
        <span className="font-bold text-slate-800 text-[14px] tracking-tight">
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {badge !== undefined && badge > 0 && (
          <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-extrabold min-w-[18px] text-center shadow-sm">
            {badge}
          </span>
        )}
        <ChevronRightIcon className="w-4 h-4 text-slate-300" />
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} onClick={onClick}>
        {content}
      </Link>
    );
  }

  return (
    <div onClick={onClick}>
      {content}
    </div>
  );
}
