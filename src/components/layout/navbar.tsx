"use client";

import { useEffect, useRef, useState } from "react";
import RightMenus from "../right-menus";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/src/context/authContext"; // adjust path if needed
import SearchModal from "../modal/SearchModal";
import SearchResultsModal from "../modal/SearchResultsModal";
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

      <header
        className={`fixed top-0 inset-x-0 z-30 bg-white backdrop-blur-md p-2 ${pathname === "/messages" || pathname?.startsWith("/shop") || pathname === "/profile/business/customer-order" || pathname?.includes("/track/") || pathname?.startsWith("/profile/business/inventory")
          ? "hidden sm:block"
          : ""
          }`}
        style={{ height }}
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

            {/* Hamburger + anchored dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                className="rounded-full p-2 hover:bg-gray-100"
                aria-label="Menu"
                onClick={() => {
                  setShowMobileMenu((s) => !s);
                  setActiveSubmenu(null);
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* Dropdown container anchored under the hamburger */}
              {showMobileMenu && (
                <div
                  className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-gray-200/60 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.08)] z-50"
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
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>

                        {/* Title: bold white on dark background for readability */}
                        <div className="flex-1 px-3 py-2 rounded-md">
                          <div className="text-sm font-bold text-black">{activeSubmenu}</div>
                        </div>
                      </div>
                    )}

                    {/* Main menu list */}
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
                        <div className="my-2 border-t border-gray-100" />

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
                        {!isLoggedIn && (
                          <div className="mt-3 flex justify-center">
                            <div className="my-2 border-t border-gray-100" />
                            <button
                              onClick={async () => {
                                setShowMobileMenu(false);
                                setActiveSubmenu(null);
                                await openLogin();
                              }}
                              className="rounded-full bg-red-500 text-white px-6 py-2 text-sm font-medium shadow-sm"
                            >
                              Login
                            </button>
                          </div>
                        )}

                      </div>
                    )}

                    {/* Submenu: Creative Center */}
                    {activeSubmenu === "Creative Center" && (

                      <ul className="flex flex-col gap-1">
                        <div className="my-2 border-t border-gray-100" />
                        <li>
                          <Link
                            href="/creative/portfolio"
                            className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 group transition-colors"
                            onClick={() => {
                              setShowMobileMenu(false);
                              setActiveSubmenu(null);
                            }}
                          >
                            <span className="text-gray-500">Portfolio</span>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4 text-transparent group-hover:text-gray-400 transition-transform transform -translate-y-0.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M11 7h6v6" />
                            </svg>
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/creative/contact"
                            className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 group transition-colors"
                            onClick={() => {
                              setShowMobileMenu(false);
                              setActiveSubmenu(null);
                            }}
                          >
                            <span className="text-gray-500">Contact creatives</span>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4 text-transparent group-hover:text-gray-400 transition-transform transform -translate-y-0.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M11 7h6v6" />
                            </svg>
                          </Link>
                        </li>
                      </ul>
                    )}

                    {/* Submenu: Business Cooperation */}
                    {activeSubmenu === "Business Cooperation" && (
                      <ul className="flex flex-col gap-1">
                        <div className="my-2 border-t border-gray-100" />
                        <li>
                          <Link
                            href="/business/account"
                            className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 group transition-colors"
                            onClick={() => {
                              setShowMobileMenu(false);
                              setActiveSubmenu(null);
                            }}
                          >
                            <span className="text-gray-500">Business account</span>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4 text-transparent group-hover:text-gray-400 transition-transform transform -translate-y-0.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M11 7h6v6" />
                            </svg>
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/business/onboarding"
                            className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 group transition-colors"
                            onClick={() => {
                              setShowMobileMenu(false);
                              setActiveSubmenu(null);
                            }}
                          >
                            <span className="text-gray-500">Merchant onboarding</span>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4 text-transparent group-hover:text-gray-400 transition-transform transform -translate-y-0.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M11 7h6v6" />
                            </svg>
                          </Link>
                        </li>
                      </ul>
                    )}

                    {/* Submenu: Help and Customer Service */}
                    {activeSubmenu === "Help and Customer Service" && (

                      <ul className="flex flex-col gap-1">
                        <div className="my-2 border-t border-gray-100" />
                        <li>
                          <Link
                            href="/help/faq"
                            className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 group transition-colors"
                            onClick={() => {
                              setShowMobileMenu(false);
                              setActiveSubmenu(null);
                            }}
                          >
                            <span className="text-gray-500">FAQ</span>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-transparent group-hover:text-gray-400 transition-transform transform -translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M11 7h6v6" />
                            </svg>
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/help/contact"
                            className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 group transition-colors"
                            onClick={() => {
                              setShowMobileMenu(false);
                              setActiveSubmenu(null);
                            }}
                          >
                            <span className="text-gray-500">Contact support</span>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-transparent group-hover:text-gray-400 transition-transform transform -translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M11 7h6v6" />
                            </svg>
                          </Link>
                        </li>
                      </ul>
                    )}

                    {/* Submenu: Privacy, Agreement */}
                    {activeSubmenu === "Privacy, Agreement" && (
                      <ul className="flex flex-col gap-1">
                        <div className="my-2 border-t border-gray-100" />
                        <li>
                          <Link
                            href="/legal/terms"
                            className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 group transition-colors"
                            onClick={() => {
                              setShowMobileMenu(false);
                              setActiveSubmenu(null);
                            }}
                          >
                            <span className="text-gray-500">Terms of Service</span>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-transparent group-hover:text-gray-400 transition-transform transform -translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M11 7h6v6" />
                            </svg>
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/legal/privacy"
                            className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 group transition-colors"
                            onClick={() => {
                              setShowMobileMenu(false);
                              setActiveSubmenu(null);
                            }}
                          >
                            <span className="text-gray-500">Privacy Policy</span>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-transparent group-hover:text-gray-400 transition-transform transform -translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M11 7h6v6" />
                            </svg>
                          </Link>
                        </li>
                      </ul>
                    )}

                    {/* Submenu: About Stoqle */}
                    {activeSubmenu === "About Stoqle" && (
                      <ul className="flex flex-col gap-1">
                        <div className="my-2 border-t border-gray-100" />
                        <li>
                          <Link
                            href="/about/team"
                            className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 group transition-colors"
                            onClick={() => {
                              setShowMobileMenu(false);
                              setActiveSubmenu(null);
                            }}
                          >
                            <span className="text-gray-500">Our team</span>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-transparent group-hover:text-gray-400 transition-transform transform -translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M11 7h6v6" />
                            </svg>
                          </Link>
                        </li>
                        <li>
                          <Link
                            href="/about/careers"
                            className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 group transition-colors"
                            onClick={() => {
                              setShowMobileMenu(false);
                              setActiveSubmenu(null);
                            }}
                          >
                            <span className="text-gray-500">Careers</span>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-transparent group-hover:text-gray-400 transition-transform transform -translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M11 7h6v6" />
                            </svg>
                          </Link>
                        </li>
                      </ul>
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
