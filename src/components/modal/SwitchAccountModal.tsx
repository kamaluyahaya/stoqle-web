"use client";
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon, PlusCircleIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/src/context/authContext";
import { API_BASE_URL } from "@/src/lib/config";
import { toast } from "sonner";
import Swal from "sweetalert2";

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
    return raw ? JSON.parse(raw) : [];
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
  const id = user.user_id || user.id;
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
  const updated = existing.some((a) => a.user_id === id)
    ? existing.map((a) => (a.user_id === id ? entry : a))
    : [...existing, entry];
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
  const prevTokenRef = useRef<string | null>(null);

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
      // new login successful — accounts already upserted via the useEffect above
      setAccounts(getSavedAccounts());
    }
    prevTokenRef.current = token;
  }, [token]);

  const getDisplayName = (acc: SavedAccount) =>
    acc.business_name || acc.full_name || acc.author_name || "User";

  const isActive = (acc: SavedAccount) =>
    acc.user_id === (user?.user_id || user?.id);

  const switchTo = async (acc: SavedAccount) => {
    if (isActive(acc) || switching) return;
    setSwitching(acc.user_id);

    try {
      // 1. Fetch full profile to ensure we have current verified status/info
      // Even for old saved accounts missing email/phone_no, this restores them.
      const resp = await fetch(`${API_BASE_URL}/api/profile/view/${acc.user_id}`, {
        headers: { Authorization: `Bearer ${acc.token}` },
      });
      const json = await resp.json();
      const liveUser = json?.data?.user;

      const userObj = {
        user_id: acc.user_id,
        full_name: liveUser?.full_name || acc.full_name,
        author_name: liveUser?.author_name || acc.author_name,
        business_name: liveUser?.business_name || acc.business_name,
        profile_pic: liveUser?.profile_pic || acc.profile_pic,
        email: liveUser?.email || acc.email,
        phone_no: liveUser?.phone_no || acc.phone_no,
        stoqle_id: liveUser?.stoqle_id || acc.stoqle_id,
      };

      // 2. Persist new active account (Full data)
      localStorage.setItem("token", acc.token);
      localStorage.setItem("user", JSON.stringify(userObj));

      // 3. Update auth context (Immediate UI feedback)
      _onLoginSuccess(userObj, acc.token);

      // Auto-update the saved list with the most recent info too
      upsertSavedAccount(userObj, acc.token);

      // Log the switch activity to backend
      try {
        await fetch(`${API_BASE_URL}/api/activity/generic`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${acc.token}`
          },
          body: JSON.stringify({
            action: 'switch_account',
            metadata: {
              target_user_id: acc.user_id,
              target_email: acc.email
            }
          })
        });
      } catch (err) {
        console.warn('Failed to log switch activity', err);
      }

      toast.success(`Switched to ${getDisplayName(acc)} successfully`);
      onClose();

      // FULL RELOAD logic to ensure all pages (Discovery, Market, etc.) refresh with the new session
      setTimeout(() => {
        window.location.reload();
      }, 500); // slightly longer delay to ensure storage writes complete
    } catch (err: any) {
      console.error("Account switch fetch error:", err);

      // Log failed switch attempt
      try {
        await fetch(`${API_BASE_URL}/api/activity/generic`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${acc.token}`
          },
          body: JSON.stringify({
            action: 'failed_switch_account',
            metadata: {
              target_user_id: acc.user_id,
              error: err.message
            }
          })
        });
      } catch (logErr) {
        console.warn('Failed to log failure action', logErr);
      }

      toast.error("Failed to restore full account info. Retrying with basic info...");

      // Fallback: switch with base metadata if API fails
      localStorage.setItem("token", acc.token);
      localStorage.setItem("user", JSON.stringify(acc));
      _onLoginSuccess(acc, acc.token);
      onClose();
      setTimeout(() => window.location.reload(), 500);
    } finally {
      setSwitching(null);
    }
  };

  const removeAccount = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Check if Swal works with the modal's z-index (Swal is very high by default)
    const result = await Swal.fire({
      title: "Remove Account?",
      text: "This will remove the account from your saved list.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444", // rose-500
      cancelButtonColor: "#94a3b8", // slate-400
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
    onClose();
    if (onAddAccount) {
      // Let parent handle: it waits for exit animation to clear the high-z backdrop
      // before opening the login modal (which lives at a lower z-index in Shell)
      onAddAccount();
    } else {
      // Fallback: small delay so the backdrop exit animation clears first
      setTimeout(() => openLogin(), 400);
    }
  };

  const activeUserId = user?.user_id || user?.id;
  const activeUsername = user?.stoqle_id || user?.user_id || user?.id || "you";

  // Responsive: bottom-sheet on mobile, centerose dialog on lg
  return (
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

          {/* Desktop: Centerose Dialog */}
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
  );
}

// ── Sharose modal content ──────────────────────────────────────
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
                    ? "bg-rose-50 border border-rose-100"
                    : isLoading
                      ? "bg-slate-100 opacity-70"
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
                  <p className={`text-sm ${active ? "text-rose-600" : "text-slate-800"}`}>
                    {getDisplayName(acc)}
                  </p>
                  <p className="text-xs text-slate-400 truncate">stoqle ID: {acc.stoqle_id || acc.user_id}</p>
                </div>

                {/* Status */}
                <div className="shrink-0 flex items-center gap-2">
                  {active ? (
                    <span className="flex items-center gap-1 text-[10px]  text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      <CheckCircleIcon className="w-3 h-3" />
                      Active
                    </span>
                  ) : (
                    <button
                      onClick={(e) => removeAccount(acc.user_id, e)}
                      className="text-[10px]  text-slate-400 hover:text-rose-500 bg-slate-100 hover:bg-rose-50 px-2 py-1 rounded-full transition-colors"
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
            className="w-full flex items-center gap-3 p-3 rounded-2xl border-2 border-dashed border-slate-200 hover:border-rose-300 hover:bg-rose-50/40 transition-all group active:scale-[0.98]"
          >
            <div className="w-12 h-12 rounded-full bg-slate-100 group-hover:bg-rose-100 flex items-center justify-center transition-colors shrink-0">
              <PlusCircleIcon className="w-6 h-6 text-slate-400 group-hover:text-rose-500 transition-colors" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm text-slate-500 group-hover:text-rose-500 transition-colors">
                Add another account
              </p>
              <p className="text-xs text-slate-400">Log in with a different account</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
