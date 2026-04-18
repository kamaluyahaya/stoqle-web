"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import {
  ShieldCheckIcon,
  Cog6ToothIcon,
  BellIcon,
  LanguageIcon,
  LockClosedIcon,
  TrashIcon,
  AdjustmentsHorizontalIcon,
  MapPinIcon,
  InformationCircleIcon,
  ArrowsRightLeftIcon,
  ArrowRightOnRectangleIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { useAuth } from "@/src/context/authContext";
import { toast } from "sonner";
import SwitchAccountModal from "@/src/components/modal/SwitchAccountModal";
import LogoutModal from "@/src/components/modal/LogoutModal";
import AboutStoqleModal from "@/src/components/modal/AboutStoqleModal";
import AddressListModal from "@/src/components/modal/addressListModal";
// Render LoginModal directly here so it sits OUTSIDE the Shell's z-[99999] stacking
// context and can properly appear over our switch-modal backdrop (z-[600000]).
import LoginModal from "@/src/components/modal/auth/loginModal";

const getStorageSize = () => {
  let total = 0;
  if (typeof window === "undefined") return "0.0KB";

  // Local Storage
  for (let x in localStorage) {
    if (localStorage.hasOwnProperty(x)) {
      total += ((localStorage[x].length + x.length) * 2);
    }
  }

  // Session Storage
  for (let x in sessionStorage) {
    if (sessionStorage.hasOwnProperty(x)) {
      total += ((sessionStorage[x].length + x.length) * 2);
    }
  }

  const kb = total / 1024;
  if (kb < 1024) return kb.toFixed(1) + "KB";
  return (kb / 1024).toFixed(1) + "MB";
};

export default function SettingsPage() {
  const router = useRouter();
  const { logout } = useAuth() as any;
  const [showSwitchAccount, setShowSwitchAccount] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showAddresses, setShowAddresses] = useState(false);
  // Local login modal — bypasses the Shell z-[99999] wrapper entirely
  const [showAddLogin, setShowAddLogin] = useState(false);
  const [cacheSize, setCacheSize] = useState("0.0KB");
  const [isClearing, setIsClearing] = useState(false);

  React.useEffect(() => {
    setCacheSize(getStorageSize());
  }, []);

  const handleClearCache = async () => {
    if (isClearing) return;
    setIsClearing(true);

    try {
      // 1. Preserve critical session & authentication data
      const authToken = localStorage.getItem("token");
      const authUser = localStorage.getItem("user");
      const savedAccounts = localStorage.getItem("stoqle_saved_accounts");
      const locationName = localStorage.getItem("user_location_name");

      // 2. Comprehensive System Clean
      // Clear localStorage but immediately restore auth to prevent logout
      localStorage.clear();
      if (authToken) localStorage.setItem("token", authToken);
      if (authUser) localStorage.setItem("user", authUser);
      if (savedAccounts) localStorage.setItem("stoqle_saved_accounts", savedAccounts);
      if (locationName) localStorage.setItem("user_location_name", locationName);

      // 3. Clear transient session state
      sessionStorage.clear();

      // 4. Deep Clean: Browser Cache API (Images, Assets, API Responses)
      if (typeof window !== "undefined" && "caches" in window) {
        try {
          const cacheKeys = await caches.keys();
          await Promise.all(cacheKeys.map((key) => caches.delete(key)));
        } catch (e) {
          console.warn("CacheStorage clearing skipped or failed", e);
        }
      }

      // 5. Professional UI Feedback
      setCacheSize("0.0KB");
      toast.success("System cache optimized.");
    } catch (err) {
      console.error("Cache purge failed:", err);
      toast.error("Partial cleanup completed.");
    } finally {
      setIsClearing(false);
    }
  };

  const handleConfirmLogout = () => {
    logout?.();
    setShowLogout(false);
    router.push("/discover");
    toast.success("Logged out successfully.");
  };

  const handleSwitchFromLogout = () => {
    setShowLogout(false);
    setTimeout(() => setShowSwitchAccount(true), 200);
  };

  /**
   * "Add account": close switch modal, wait for backdrop exit, then show
   * our LOCAL LoginModal which renders at its own z-[200000] without being
   * capped by Shell's z-[99999] parent stacking context.
   */
  const handleAddAccount = () => {
    setShowSwitchAccount(false);
    // 400ms: enough for framer-motion spring exit to complete
    setTimeout(() => setShowAddLogin(true), 400);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Mobile/Tablet Top Header (hidden on lg) */}
      <div className="sticky top-0 z-[100] bg-slate-100 flex items-center px-4 h-14 lg:hidden mb-5">
        <button onClick={() => router.back()} className="p-1 -ml-1 text-slate-800">
          <FaChevronLeft size={17} />
        </button>
        <div className="absolute left-1/2 -translate-x-1/2 text-base font-bold text-slate-800 tracking-tight py-4">
          Settings
        </div>
      </div>

      {/* Desktop header title (no back arrow) */}
      <div className="hidden lg:flex items-center px-6 h-16 pt-2 mb-4">
        <h1 className="text-xl font-bold text-slate-800 tracking-tight">Settings</h1>
      </div>

      <div className="flex-1 px-4 lg:px-6 pb-12 space-y-5 w-full">

        {/* Group 1 — Account & Preferences */}
        <ProfileGroup>
          <SettingsRow
            label="Account security"
            icon={<ShieldCheckIcon className="w-5 h-5 text-slate-500" />}
            onClick={() => router.push("/settings/account-security")}
          />
          <SettingsRow
            label="General"
            icon={<Cog6ToothIcon className="w-5 h-5 text-slate-500" />}
            onClick={() => router.push("/settings/general")}
          />
          <SettingsRow
            label="Notification"
            icon={<BellIcon className="w-5 h-5 text-slate-500" />}
            onClick={() => router.push("/settings/notifications")}
          />
          <SettingsRow
            label="Language and translation"
            icon={<LanguageIcon className="w-5 h-5 text-slate-500" />}
            onClick={() => toast.info("Language and translation features are coming soon!")}
          />
          <SettingsRow
            label="Privacy"
            icon={<LockClosedIcon className="w-5 h-5 text-slate-500" />}
            onClick={() => router.push("/settings/privacy")}
          />
        </ProfileGroup>

        {/* Group 2 — Storage & Content */}
        <ProfileGroup>
          <SettingsRow
            label={isClearing ? "Optimizing..." : "Clear cache"}
            icon={isClearing ? (
              <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
            ) : (
              <TrashIcon className="w-5 h-5 text-slate-500" />
            )}
            rightElement={!isClearing && <span className="text-[13px] font-bold text-slate-400 mr-1">{cacheSize}</span>}
            onClick={handleClearCache}
          />
          <SettingsRow
            label="Content Preferences"
            icon={<AdjustmentsHorizontalIcon className="w-5 h-5 text-slate-500" />}
            onClick={() => toast.info("Content Preferences features are coming soon!")}
          />
          <SettingsRow
            label="Delivery addresses"
            icon={<MapPinIcon className="w-5 h-5 text-slate-500" />}
            onClick={() => setShowAddresses(true)}
          />
        </ProfileGroup>

        {/* Single Row — About */}
        <ProfileGroup>
          <SettingsRow
            label="About Stoqle"
            icon={<InformationCircleIcon className="w-5 h-5 text-slate-500" />}
            onClick={() => setShowAbout(true)}
          />
        </ProfileGroup>

        {/* Group 3 — Account Actions */}
        <ProfileGroup>
          <SettingsRow
            label="Switch account"
            icon={<ArrowsRightLeftIcon className="w-5 h-5 text-slate-500" />}
            onClick={() => setShowSwitchAccount(true)}
          />
          <SettingsRow
            label="Logout"
            icon={<ArrowRightOnRectangleIcon className="w-5 h-5 text-rose-500" />}
            labelClassName="text-rose-500 font-semibold"
            onClick={() => setShowLogout(true)}
            hideChevron
          />
        </ProfileGroup>

        {/* Footer Links */}
        <div className="flex flex-col items-center gap-3 pt-4 pb-2">
          {[
            { label: "Personal information List", href: "/help/personal-information" },
            { label: "Cooperation List", href: "/help/cooperation" },
            { label: "Stoqle User Service Agreement", href: "/help/user-service-agreement" },
            { label: "Stoqle User Privacy Policy", href: "/help/privacy-policy" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs text-blue-400 hover:text-blue-600 underline-offset-2 hover:underline transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

      </div>

      {/* ── Modals ── */}

      {/* Switch Account */}
      <SwitchAccountModal
        open={showSwitchAccount}
        onClose={() => setShowSwitchAccount(false)}
        onAddAccount={handleAddAccount}
      />

      {/* Logout Confirmation */}
      <LogoutModal
        open={showLogout}
        onClose={() => setShowLogout(false)}
        onSwitchAccount={handleSwitchFromLogout}
        onConfirmLogout={handleConfirmLogout}
      />

      {/* About Stoqle */}
      <AboutStoqleModal
        open={showAbout}
        onClose={() => setShowAbout(false)}
      />

      {/* Delivery Addresses */}
      <AddressListModal
        open={showAddresses}
        onClose={() => setShowAddresses(false)}
        onSelect={() => setShowAddresses(false)}
        onUpdate={() => { }}
      />

      {/*
        Local LoginModal — rendered HERE (not via Shell) so it escapes the
        Shell's z-[99999] stacking context. We give it z-[800000] inline so
        it appears above everything else on the page.
      */}
      {showAddLogin && (
        <div style={{ zIndex: 800000, position: "fixed", inset: 0 }}>
          <LoginModal
            isOpen={showAddLogin}
            onClose={() => {
              setShowAddLogin(false);
              // After login, reopen the switch modal so user sees the new account
              setTimeout(() => setShowSwitchAccount(true), 200);
            }}
          />
        </div>
      )}
    </div>
  );
}

// ── ProfileGroup ──────────────────────────────────────────────
function ProfileGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl overflow-hidden">
      <div className="divide-y divide-slate-100">{children}</div>
    </div>
  );
}

// ── SettingsRow ────────────────────────────────────────────────
function SettingsRow({
  label,
  icon,
  onClick,
  hideChevron = false,
  labelClassName = "",
  rightElement,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  hideChevron?: boolean;
  labelClassName?: string;
  rightElement?: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className="px-5 py-[1.1rem] flex items-center gap-3.5 cursor-pointer active:bg-slate-50 transition-colors"
    >
      <div className="shrink-0">{icon}</div>
      <span className={`flex-1 text-[15px] font-medium text-slate-700 ${labelClassName}`}>
        {label}
      </span>
      {rightElement}
      {!hideChevron && (
        <FaChevronRight className="text-slate-300 shrink-0" size={12} />
      )}
    </div>
  );
}
