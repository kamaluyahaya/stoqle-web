"use client";
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon, PlusCircleIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/src/context/authContext";
import { API_BASE_URL } from "@/src/lib/config";
import { toast } from "sonner";
import Swal from "sweetalert2";
import StoqleLoader from "@/src/components/common/StoqleLoader";

const DEFAULT_AVATAR = "/assets/images/favio.png";

export type SavedAccount = {
  user_id: string;
  full_name?: string;
  author_name?: string;
  business_name?: string;
  profile_pic?: string;
  email?: string;
  phone_no?: string;
  stoqle_id?: string | number;
  token: string;
};

export function formatUrl(url: string | null | undefined): string {
  if (!url) return DEFAULT_AVATAR;
  if (url.startsWith("http")) return url;
  return url.startsWith("/public")
    ? `${API_BASE_URL}${url}`
    : `${API_BASE_URL}/public/${url}`;
}

export const STORAGE_KEY = "stoqle_saved_accounts";

export function getSavedAccounts(): SavedAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // ⚡ DEDUPLICATE: Ensure every user_id is unique to prevent React key collisions (Error 179)
    const map = new Map<string, SavedAccount>();
    parsed.forEach((acc: any) => {
      const id = String(acc.user_id || acc.id);
      if (id && id !== "undefined") {
        map.set(id, { ...acc, user_id: id });
      }
    });

    return Array.from(map.values()).slice(0, 5); // Keep only first 5 unique accounts
  } catch {
    return [];
  }
}

export function persistAccounts(accounts: SavedAccount[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

/**
 * After a successful login, merge the new account into the saved list.
 * Call this from _onLoginSuccess wrapper so new accounts are auto-saved.
 */
export function upsertSavedAccount(user: any, token: string) {
  const existing = getSavedAccounts();
  const id = String(user.user_id || user.id);
  if (!id || id === "undefined") return;

  const entry: SavedAccount = {
    user_id: id,
    full_name: user.full_name,
    author_name: user.author_name,
    business_name: user.business_name,
    profile_pic: user.profile_pic || user.avatar,
    email: user.email,
    phone_no: user.phone_no,
    stoqle_id: user.stoqle_id,
    token,
  };

  // Filter out any existing entries for this ID (to replace them)
  const otherAccounts = existing.filter((a) => a.user_id !== id);

  // Limit to 5 accounts total
  if (otherAccounts.length >= 5) {
    persistAccounts(otherAccounts);
    return;
  }

  const updated = [entry, ...otherAccounts]; // Put latest account at the top
  persistAccounts(updated);
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called when user taps "Add another account" — parent handles opening login so z-index is correct */
  onAddAccount?: () => void;
}

export default function SwitchAccountModal({ open, onClose, onAddAccount }: Props) {
  const { user, token, _onLoginSuccess, openLogin } = useAuth() as any;
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);
  const [switching, setSwitching] = useState<string | null>(null);
  const [isReloading, setIsReloading] = useState(false);
  const prevTokenRef = useRef<string | null>(null);
  // Guards against concurrent/double switch calls
  const switchLockRef = useRef(false);

  // Sync current account on mount/change
  useEffect(() => {
    if (!user || !token) return;
    upsertSavedAccount(user, token);
    setAccounts(getSavedAccounts());
  }, [user, token]);

  // Refresh list when modal opens
  useEffect(() => {
    if (open) setAccounts(getSavedAccounts());
  }, [open]);

  // Detect when a new account was added (token changed after openLogin resolved)
  useEffect(() => {
    if (token && token !== prevTokenRef.current && prevTokenRef.current !== null) {
      setAccounts(getSavedAccounts());
    }
    prevTokenRef.current = token;
  }, [token]);

  const getDisplayName = (acc: SavedAccount) =>
    acc.business_name || acc.full_name || acc.author_name || "User";

  const isActive = (acc: SavedAccount) => {
    const activeId = String(user?.user_id || user?.id || "");
    return acc.user_id === activeId;
  };

  const switchTo = async (acc: SavedAccount) => {
    // Prevent double-click / concurrent switches
    if (isActive(acc) || switching || switchLockRef.current) return;
    switchLockRef.current = true;
    setSwitching(acc.user_id);

    try {
      // ------------------------------------------------------------------
      // Step 0: Mark current account as offline (switch_away)
      // ------------------------------------------------------------------
      if (token) {
        fetch(`${API_BASE_URL}/api/activity/generic`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: "switch_away",
            metadata: {
              target_user_id: acc.user_id
            }
          }),
        }).catch(() => { });
      }

      // ------------------------------------------------------------------
      // Step 1: Validate the saved token is still accepted by the backend.
      //         Using /api/auth/profile/me guarantees we only proceed with
      //         a token that the backend actually accepts (not 401/403).
      // ------------------------------------------------------------------
      const validateResp = await fetch(`${API_BASE_URL}/api/auth/profile/me`, {
        headers: { Authorization: `Bearer ${acc.token}` },
      });

      if (!validateResp.ok) {
        // Token is invalid / rejected — remove stale account and inform user
        const updated = getSavedAccounts().filter((a) => a.user_id !== acc.user_id);
        persistAccounts(updated);
        setAccounts(updated);
        toast.error(
          `Session for ${getDisplayName(acc)} has expired. Please log in again.`
        );
        return;
      }

      const validateJson = await validateResp.json();
      const liveUser = validateJson?.data?.user || validateJson?.data || null;

      // ------------------------------------------------------------------
      // Step 2: Build a clean, authoritative user object, preferring live
      //         data but falling back to the saved snapshot.
      // ------------------------------------------------------------------
      const userObj = {
        user_id: acc.user_id,
        full_name: liveUser?.full_name || acc.full_name,
        author_name: liveUser?.author_name || acc.author_name,
        business_name: liveUser?.business_name || acc.business_name,
        profile_pic: liveUser?.profile_pic || acc.profile_pic,
        email: liveUser?.email || acc.email,
        phone_no: liveUser?.phone_no || acc.phone_no,
        stoqle_id: liveUser?.stoqle_id || acc.stoqle_id,
        is_business_owner: liveUser?.is_business_owner ?? false,
        business_id: liveUser?.business_id || null,
        isBusiness: liveUser?.isBusiness ?? false,
      };

      // ------------------------------------------------------------------
      // Step 3: Atomically commit the switch.
      //   - Write to localStorage FIRST (source of truth on reload)
      //   - Then update auth context (triggers React re-render)
      //   - Then update saved accounts list
      // All three happen synchronously before any async work.
      // ------------------------------------------------------------------
      localStorage.setItem("token", acc.token);
      localStorage.setItem("user", JSON.stringify(userObj));
      // Keep cookie in sync (7 days)
      document.cookie = `token=${acc.token}; path=/; max-age=604800; SameSite=Lax`;

      _onLoginSuccess(userObj, acc.token);
      upsertSavedAccount(userObj, acc.token);

      // ------------------------------------------------------------------
      // Step 4: Log the switch to the backend (fire-and-forget, non-blocking)
      // ------------------------------------------------------------------
      fetch(`${API_BASE_URL}/api/activity/generic`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${acc.token}`,
        },
        body: JSON.stringify({
          action: "switch_account",
          metadata: {
            target_user_id: acc.user_id,
            target_email: acc.email,
          },
        }),
      }).catch((err) => console.warn("Failed to log switch activity", err));

      toast.success(`Switched to ${getDisplayName(acc)} successfully`);
      onClose();

      // Show full-screen loader immediately before the page reloads
      setIsReloading(true);
      setTimeout(() => {
        window.location.reload();
      }, 600);
    } catch (err: any) {
      console.error("Account switch error:", err);
      toast.error("Could not switch account. Please try again.");
    } finally {
      setSwitching(null);
      switchLockRef.current = false;
    }
  };

  const removeAccount = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const result = await Swal.fire({
      title: "Remove Account?",
      text: "This will remove the account from your saved list.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#94a3b8",
      confirmButtonText: "Yes, remove it",
    });

    if (result.isConfirmed) {
      const updated = accounts.filter((a) => a.user_id !== id);
      persistAccounts(updated);
      setAccounts(updated);
      toast.success("Account removed");
    }
  };

  const handleAddAccount = () => {
    if (accounts.length >= 5) {
      toast.error("Maximum 5 accounts allowed. Please remove one first.");
      return;
    }
    onClose();
    if (onAddAccount) {
      onAddAccount();
    } else {
      setTimeout(() => openLogin(), 400);
    }
  };

  const activeUserId = String(user?.user_id || user?.id || "");
  const activeUsername = user?.stoqle_id || user?.user_id || user?.id || "you";

  return (
    <>
      {/* Full-screen reload loader — shown immediately on account switch */}
      <AnimatePresence>
        {isReloading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[9999999] bg-transparent flex flex-col items-center justify-center gap-4"
          >
            <StoqleLoader size={56} />
            <p className="text-[13px] font-bold text-slate-400 tracking-wider">Switching account…</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[600000] bg-black/50"
              onClick={onClose}
            />

            {/* Mobile: Bottom Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="fixed bottom-0 left-0 right-0 z-[700000] bg-white rounded-t-[0.5rem] shadow-2xl overflow-hidden lg:hidden"
              style={{ maxHeight: "82vh" }}
            >
              <ModalContent
                accounts={accounts}
                activeUserId={activeUserId}
                activeUsername={activeUsername}
                switching={switching}
                isActive={isActive}
                getDisplayName={getDisplayName}
                switchTo={switchTo}
                removeAccount={removeAccount}
                handleAddAccount={handleAddAccount}
                onClose={onClose}
                isMobile
              />
            </motion.div>

            {/* Desktop: Centered Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="hidden lg:block fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[700000] bg-white rounded-[0.5rem] shadow-2xl overflow-hidden w-full max-w-md"
              style={{ maxHeight: "80vh" }}
            >
              <ModalContent
                accounts={accounts}
                activeUserId={activeUserId}
                activeUsername={activeUsername}
                switching={switching}
                isActive={isActive}
                getDisplayName={getDisplayName}
                switchTo={switchTo}
                removeAccount={removeAccount}
                handleAddAccount={handleAddAccount}
                onClose={onClose}
                isMobile={false}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Shared modal content ──────────────────────────────────────
function ModalContent({
  accounts,
  activeUserId,
  activeUsername,
  switching,
  isActive,
  getDisplayName,
  switchTo,
  removeAccount,
  handleAddAccount,
  onClose,
  isMobile,
}: {
  accounts: SavedAccount[];
  activeUserId: string;
  activeUsername: string;
  switching: string | null;
  isActive: (acc: SavedAccount) => boolean;
  getDisplayName: (acc: SavedAccount) => string;
  switchTo: (acc: SavedAccount) => void;
  removeAccount: (id: string, e: React.MouseEvent) => void;
  handleAddAccount: () => void;
  onClose: () => void;
  isMobile: boolean;
}) {
  return (
    <div className="flex flex-col" style={{ maxHeight: isMobile ? "82vh" : "80vh" }}>
      {/* Pull handle (mobile only) */}
      {isMobile && (
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-slate-100 shrink-0">
        <div>
          <h2 className="text-base font-bold text-slate-800">Switch Account</h2>
          <p className="text-xs text-slate-400 mt-0.5">Logged in as @{activeUsername}</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-slate-100 transition-colors"
        >
          <XMarkIcon className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      {/* Account List */}
      <div className="overflow-y-auto flex-1">
        <div className="px-4 pt-4 space-y-2">
          {accounts.map((acc) => {
            const active = isActive(acc);
            const isLoading = switching === acc.user_id;

            return (
              <div
                key={acc.user_id}
                onClick={() => switchTo(acc)}
                className={`flex items-center gap-3 p-3 rounded-2xl transition-all cursor-pointer select-none
                  ${active
                    ? "bg-slate-100 border border-slate-200"
                    : isLoading
                      ? "bg-slate-100 opacity-70 pointer-events-none"
                      : "bg-slate-50 hover:bg-slate-100 active:scale-[0.98]"
                  }`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <img
                    src={formatUrl(acc.profile_pic)}
                    alt={getDisplayName(acc)}
                    className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/assets/images/favio.png";
                    }}
                  />
                  {active && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white" />
                  )}
                  {isLoading && (
                    <div className="absolute inset-0 rounded-full bg-white/60 flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                {/* Name & ID */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${active ? "text-rose-500" : "text-slate-800"}`}>
                    {getDisplayName(acc)}
                  </p>
                  <p className="text-xs text-slate-400 truncate">stoqle ID: {acc.stoqle_id || acc.user_id}</p>
                </div>

                {/* Status */}
                <div className="shrink-0 flex items-center gap-2">
                  {active ? (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      <CheckCircleIcon className="w-3 h-3" />
                      Active
                    </span>
                  ) : (
                    <button
                      onClick={(e) => removeAccount(acc.user_id, e)}
                      className="text-[10px] text-slate-400 hover:text-rose-500 bg-slate-100 hover:bg-rose-50 px-2 py-1 rounded-full transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add account row */}
        <div className="px-4 pt-3 pb-6">
          <button
            onClick={handleAddAccount}
            disabled={accounts.length >= 5}
            className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 border-dashed transition-all group active:scale-[0.98]
              ${accounts.length >= 5
                ? "border-slate-100 bg-slate-50 cursor-not-allowed"
                : "border-slate-200 hover:border-rose-300 hover:bg-rose-50/40"
              }`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors shrink-0
              ${accounts.length >= 5 ? "bg-slate-200" : "bg-slate-100 group-hover:bg-rose-100"}`}
            >
              <PlusCircleIcon className={`w-6 h-6 transition-colors ${accounts.length >= 5 ? "text-slate-300" : "text-slate-400 group-hover:text-rose-500"}`} />
            </div>
            <div className="flex-1 text-left">
              <p className={`text-sm transition-colors ${accounts.length >= 5 ? "text-slate-300" : "text-slate-500 group-hover:text-rose-500"}`}>
                {accounts.length >= 5 ? "Account limit reached" : "Add another account"}
              </p>
              <p className="text-xs text-slate-400">
                {accounts.length >= 5 ? "Remove an account to add a new one" : "Log in with a different account"}
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
