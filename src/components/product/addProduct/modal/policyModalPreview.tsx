

"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  TrashIcon,
  PencilSquareIcon,
  PlusIcon,
  CheckCircleIcon,
  MapPinIcon
} from "@heroicons/react/24/outline";
import DeliveryAddressModal from "./deliveryAddressModal";
import { useAuth } from "@/src/context/authContext";
import { toast } from "sonner";

type PolicyModalProps = {
  open: boolean;
  title?: string | null;
  body?: string | null;
  onClose: () => void;
  onAddressChange?: (address: any) => void;
};

export default function PolicyModal({ open, title, body, onClose, onAddressChange }: PolicyModalProps) {
  const { token } = useAuth();
  const [copied, setCopied] = useState(false);

  // Extract promise duration from body with professional fallbacks
  const promiseDuration = useMemo(() => {
    if (!body) return "48 hours";

    try {
      // 1. Try parsing as JSON
      const parsed = JSON.parse(body);
      const durations = parsed?.shipping_duration || parsed?.shipping || [];
      if (Array.isArray(durations)) {
        const promise = durations.find((d: any) => d.type === "promise" || d.kind === "promise" || d.kind === "express");
        if (promise) {
          return `${promise.value} ${promise.unit}`;
        }
      }
    } catch {
      // 2. If not JSON (string from PolicyList), use robust regex patterns
      const patterns = [
        /promise to ship within (.*?) \(/i,
        /promise to ship within (.*?)(?:\.|,|$)/i,
        /aim to ship within (.*?)(?:\.|,|$)/i,
        /ship within (.*?)(?:\.|,|$)/i
      ];

      for (const p of patterns) {
        const match = body.match(p);
        if (match && match[1]) return match[1].trim();
      }
    }

    return "48 hours"; // Professional default fallback
  }, [body]);

  const [addresses, setAddresses] = useState<any[]>([]);
  const [activeAddressId, setActiveAddressId] = useState<string | null>(null);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<any>(null);

  const loadAddresses = async () => {
    if (!token) {
      setAddresses([]);
      setActiveAddressId(null);
      return;
    }

    try {
      const res = await import("@/src/lib/api/addressApi").then(m => m.fetchUserAddresses(token));
      const dbAddresses = res.data || [];
      const mappedDb = dbAddresses.map((a: any) => ({
        id: String(a.address_id),
        address_id: a.address_id,
        recipientName: a.full_name,
        contactNo: a.phone,
        region: `Nigeria, ${a.state}, ${a.city}`,
        address: a.address_line1,
        isDefault: a.is_default,
        latitude: a.latitude,
        longitude: a.longitude
      }));

      setAddresses(mappedDb);

      // Set active address to the default one if not already set or if it's new load
      const def = mappedDb.find((a: any) => a.isDefault || a.is_default);
      if (def) {
        setActiveAddressId(String(def.address_id));
        if (onAddressChange) onAddressChange(def);
      } else if (mappedDb.length > 0) {
        setActiveAddressId(String(mappedDb[0].address_id));
        if (onAddressChange) onAddressChange(mappedDb[0]);
      }
    } catch (e) {
      console.error("Failed to fetch DB addresses", e);
      toast.error("Failed to load addresses from your profile");
    }
  };

  useEffect(() => {
    if (open) {
      loadAddresses();
    }
  }, [open, token]);

  const handleSelectAddress = (address: any) => {
    setActiveAddressId(String(address.address_id || address.id));
    if (onAddressChange) onAddressChange(address);
  };

  const handleDeleteAddress = async (id: string) => {
    const addrToDelete = addresses.find(a => String(a.address_id || a.id) === String(id));

    if (token && addrToDelete?.address_id) {
      try {
        await import("@/src/lib/api/addressApi").then(m => m.deleteUserAddress(addrToDelete.address_id, token));
        toast.success("Address deleted");
        loadAddresses(); // Refresh list from DB
      } catch (e) {
        console.error("Failed to delete from DB", e);
        toast.error("Failed to delete address");
      }
    }
  };

  const handleAddAddress = () => {
    setEditingAddress(null);
    setAddressModalOpen(true);
  };

  const handleEditAddress = (address: any) => {
    setEditingAddress(address);
    setAddressModalOpen(true);
  };

  const onSaveAddress = (newAddress: any) => {
    setAddressModalOpen(false);
    // The DeliveryAddressModal already handles the DB sync.
    // We just need to refresh our list.
    loadAddresses();
  };

  const formatted = useMemo(() => {
    if (!body) return null;
    const trimmed = body.trim();
    // If JSON string was passed, pretty-print it
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        const parsed = JSON.parse(trimmed);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return body;
      }
    }
    return body;
  }, [body]);

  if (!open) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatted ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[20000] flex items-end sm:items-center justify-center px-0 sm:px-4"
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-slate-100 lg:rounded-2xl md:rounded-2xl rounded-t-2xl shadow-xl z-10 max-h-[85vh] flex flex-col overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Header - Sticky */}
        <div className="bg-white sticky top-0 z-30 border-b border-slate-50 lg:rounded-t-2xl md:rounded-t-2xl rounded-t-2xl shadow-sm">
          <div className="relative flex items-center px-5">
            <div className="w-9 h-9" />
            <h3 className="absolute left-1/2 -translate-x-1/2 text-lg font-medium text-slate-800 truncate max-w-[70%] text-center">
              {title ?? "Shipping Policy"}
            </h3>

            {/* Close button */}
            <button
              onClick={onClose}
              className="ml-auto pt-4 pr-5 rounded-md hover:bg-slate-100"
              aria-label="Close"
            >
              <svg
                className="w-5 h-5 text-slate-600"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M6 6L18 18M6 18L18 6"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          <div className="text-sm text-slate-700 whitespace-pre-wrap p-5">
            Promise to ship within {promiseDuration}, delay compensation guaranteed.
          </div>
        </div>

        {/* Scrollable Content Wrapper */}
        <div className="flex-1 overflow-y-auto">

          {/* Delivery address section */}
          <div className="bg-white mt-2 flex flex-col min-h-0">
            <div className="flex items-center justify-between px-5 pt-5 pb-2">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <MapPinIcon className="w-4 h-4 text-red-500" />
                Delivery Address
              </h4>
              <button
                onClick={handleAddAddress}
                className="text-xs font-bold text-red-500 flex items-center gap-1 hover:bg-red-50 px-2 py-1 rounded-md transition-colors"
              >
                <PlusIcon className="w-3 h-3" />
                Add New
              </button>
            </div>

            <div className="px-5 pb-5">
              {addresses.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-slate-400 text-xs mb-4">
                    No address yet, please add a delivery address first
                  </div>
                  <button
                    onClick={handleAddAddress}
                    className="inline-flex items-center gap-2 border border-red-500 px-6 py-2 rounded-full text-red-500 text-sm font-bold hover:bg-red-50 transition-all active:scale-95"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Add address
                  </button>
                </div>
              ) : (
                <div className="space-y-3 mt-2">
                  {addresses.map((addr) => {
                    const addrId = String(addr.address_id || addr.id);
                    return (
                      <div
                        key={addrId}
                        className={`relative p-4 rounded-2xl border transition-all cursor-pointer ${activeAddressId === addrId
                          ? "border-red-500 bg-red-50/30 ring-1 ring-red-500"
                          : "border-slate-100 bg-slate-50 hover:border-slate-200"
                          }`}
                        onClick={() => handleSelectAddress(addr)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0 pr-8">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-sm text-slate-900 truncate">{addr.recipientName}</span>
                              <span className="text-[10px] text-slate-500 font-medium">{addr.contactNo}</span>
                              {addr.isDefault && (
                                <span className="bg-red-100 text-red-600 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">Default</span>
                              )}
                            </div>
                            <div className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                              {addr.address}, {addr.region}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEditAddress(addr); }}
                              className="p-1.5 rounded-full hover:bg-white text-slate-400 hover:text-blue-500 transition-colors bg-white/50"
                            >
                              <PencilSquareIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteAddress(addrId); }}
                              className="p-1.5 rounded-full hover:bg-white text-slate-400 hover:text-red-500 transition-colors bg-white/50"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {activeAddressId === addrId && (
                          <div className="absolute top-2 right-2">
                            <CheckCircleIcon className="w-5 h-5 text-red-500" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <button
                    onClick={handleAddAddress}
                    className="w-full py-3 mt-2 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center gap-2 text-slate-500 font-medium hover:bg-slate-50 hover:border-slate-300 transition-all text-xs"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Add another address
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="p-5 bg-white text-sm text-slate-700">
            {formatted == null ? (
              <div className="text-slate-400">No details available.</div>
            ) : (
              <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">{formatted}</pre>
            )}
          </div>

          {/* Delivery Notice / Delay Compensation */}
          <div className="bg-white mt-2">
            <div className="text-sm text-slate-700 p-5 whitespace-pre-wrap">
              <p>Delivery Notice</p>

              <div className="text-md font-semibold py-3 text-slate-700 whitespace-pre-wrap">
                Promise to ship within {promiseDuration}, delay compensation guaranteed
              </div>

              <div>
                If you make the payment now, we promise to ship the product within {promiseDuration}.
                If we fail to ship it within the promised time, we will compensate you with a discount coupon of at least 500 naira with no minimum purchase requirement (except for special items and force majeure factors).
              </div>
            </div>
          </div>
        </div>
      </div>

      <DeliveryAddressModal
        open={addressModalOpen}
        onClose={() => setAddressModalOpen(false)}
        onSave={onSaveAddress}
        initialData={editingAddress}
      />
    </div >
  );
}