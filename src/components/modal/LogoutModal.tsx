"use client";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowsRightLeftIcon, ArrowRightOnRectangleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/src/context/authContext";
import { formatUrl } from "./SwitchAccountModal";

interface Props {
  open: boolean;
  onClose: () => void;
  onSwitchAccount: () => void;
  onConfirmLogout: () => void;
}

export default function LogoutModal({ open, onClose, onSwitchAccount, onConfirmLogout }: Props) {
  const { user } = useAuth() as any;

  const displayName =
    user?.business_name || user?.full_name || user?.author_name || "User";
  const username = user?.user_id || user?.id || "";
  const avatar = formatUrl(user?.profile_pic || user?.avatar);

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
          >
            <SheetContent
              displayName={displayName}
              username={username}
              avatar={avatar}
              onClose={onClose}
              onSwitchAccount={onSwitchAccount}
              onConfirmLogout={onConfirmLogout}
            />
          </motion.div>

          {/* Desktop: Centered Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="hidden lg:block fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[700000] bg-white rounded-[0.5rem] shadow-2xl overflow-hidden w-full max-w-sm"
          >
            <SheetContent
              displayName={displayName}
              username={username}
              avatar={avatar}
              onClose={onClose}
              onSwitchAccount={onSwitchAccount}
              onConfirmLogout={onConfirmLogout}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function SheetContent({
  displayName,
  username,
  avatar,
  onClose,
  onSwitchAccount,
  onConfirmLogout,
}: {
  displayName: string;
  username: string;
  avatar: string;
  onClose: () => void;
  onSwitchAccount: () => void;
  onConfirmLogout: () => void;
}) {
  return (
    <div className="flex flex-col">
      {/* Pull handle (visible on mobile via parent class, but we keep it always for now) */}
      <div className="flex justify-center pt-3 pb-1 lg:hidden">
        <div className="w-10 h-1 bg-slate-200 rounded-full" />
      </div>

      {/* Close button row */}
      <div className="flex justify-end px-4 pt-3 lg:pt-4">
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-slate-100 transition-colors"
        >
          <XMarkIcon className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      {/* Profile summary */}
      <div className="flex flex-col items-center px-6 pb-6 pt-2">
        <div className="relative mb-3">
          <img
            src={avatar}
            alt={displayName}
            className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-md"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/assets/images/favio.png";
            }}
          />
          {/* Green online dot */}
          <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white" />
        </div>
        <p className="text-base font-bold text-slate-800">{displayName}</p>
        <p className="text-xs text-slate-400 mt-0.5">@{username}</p>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-100 mx-4" />

      {/* Actions */}
      <div className="px-4 py-4 space-y-2">
        {/* Switch account */}
        <button
          onClick={onSwitchAccount}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 active:scale-[0.98] transition-all group"
        >
          <div className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center border border-slate-100">
            <ArrowsRightLeftIcon className="w-5 h-5 text-slate-500" />
          </div>
          <span className="text-sm font-semibold text-slate-700">Switch account</span>
        </button>

        {/* Logout */}
        <button
          onClick={onConfirmLogout}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-red-50 hover:bg-red-100 active:scale-[0.98] transition-all"
        >
          <div className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center border border-red-100">
            <ArrowRightOnRectangleIcon className="w-5 h-5 text-red-500" />
          </div>
          <span className="text-sm font-semibold text-red-500">Logout</span>
        </button>

        {/* Cancel */}
        <button
          onClick={onClose}
          className="w-full py-3 text-sm font-semibold text-slate-400 hover:text-slate-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
