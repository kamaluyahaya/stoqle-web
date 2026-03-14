

"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  TrashIcon,
  PencilSquareIcon,
  PlusIcon,
  CheckCircleIcon,
  MapPinIcon
} from "@heroicons/react/24/outline";
import DeliveryAddressModal from "./deliveryAddressModal";

type PolicyModalProps = {
  open: boolean;
  title?: string | null;
  body?: string | null;
  onClose: () => void;
  onAddressChange?: (address: any) => void;
};

export default function PolicyModal({ open, title, body, onClose, onAddressChange }: PolicyModalProps) {
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

  const loadAddresses = () => {
    let list: any[] = [];
    const savedList = localStorage.getItem("stoqle_delivery_addresses");
    if (savedList) {
      try {
        list = JSON.parse(savedList);
      } catch (e) {
        console.error("Failed to parse addresses", e);
      }
    }

    const active = localStorage.getItem("stoqle_delivery_address");
    let activeObj: any = null;
    if (active) {
      try {
        activeObj = JSON.parse(active);
        // If we have an active address but it's not in the list, migrate it
        if (list.length === 0 && activeObj) {
          if (!activeObj.id) activeObj.id = Date.now().toString();
          list = [activeObj];
          localStorage.setItem("stoqle_delivery_addresses", JSON.stringify(list));
          localStorage.setItem("stoqle_delivery_address", JSON.stringify(activeObj));
        }
        setActiveAddressId(activeObj?.id || null);
      } catch { }
    }

    setAddresses(list);
  };

  useEffect(() => {
    if (open) {
      loadAddresses();
    }
  }, [open]);

  const saveAddressesToStorage = (newAddresses: any[]) => {
    localStorage.setItem("stoqle_delivery_addresses", JSON.stringify(newAddresses));
    setAddresses(newAddresses);
  };

  const handleSelectAddress = (address: any) => {
    localStorage.setItem("stoqle_delivery_address", JSON.stringify(address));
    setActiveAddressId(address.id);
    if (onAddressChange) onAddressChange(address);
  };

  const handleDeleteAddress = (id: string) => {
    const next = addresses.filter(a => a.id !== id);
    saveAddressesToStorage(next);
    if (activeAddressId === id) {
      if (next.length > 0) {
        handleSelectAddress(next[0]);
      } else {
        localStorage.removeItem("stoqle_delivery_address");
        setActiveAddressId(null);
        if (onAddressChange) onAddressChange(null);
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
    let next: any[];
    if (editingAddress) {
      next = addresses.map(a => a.id === editingAddress.id ? { ...newAddress, id: a.id } : a);
    } else {
      const addressWithId = { ...newAddress, id: Date.now().toString() };
      next = [...addresses, addressWithId];
    }
    saveAddressesToStorage(next);

    // Automatically select it if it's the only one or if it was the one being edited
    if (next.length === 1 || (editingAddress && activeAddressId === editingAddress.id)) {
      const saved = next.find(a => a.id === (editingAddress?.id || next[next.length - 1].id));
      if (saved) handleSelectAddress(saved);
    } else if (!editingAddress) {
      // Also select it if newly added
      handleSelectAddress(next[next.length - 1]);
    }
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
      className="fixed inset-0 z-[20000] flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-slate-100 lg:rounded-2xl md:rounded-2xl rounded-t-2xl shadow-xl z-10 h-[75vh] sm:h-auto flex flex-col">
        {/* Header */}
        <div className="bg-white pb-5 lg:rounded-2xl md:rounded-2xl rounded-t-2xl">
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

          <div className="px-5 pb-5 overflow-auto max-h-[40vh]">
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
                {addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className={`relative p-4 rounded-2xl border transition-all cursor-pointer ${activeAddressId === addr.id
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
                          onClick={(e) => { e.stopPropagation(); handleDeleteAddress(addr.id); }}
                          className="p-1.5 rounded-full hover:bg-white text-slate-400 hover:text-red-500 transition-colors bg-white/50"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {activeAddressId === addr.id && (
                      <div className="absolute top-2 right-2">
                        <CheckCircleIcon className="w-5 h-5 text-red-500" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="overflow-auto p-5 bg-white text-sm text-slate-700">
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

      <DeliveryAddressModal
        open={addressModalOpen}
        onClose={() => setAddressModalOpen(false)}
        onSave={onSaveAddress}
        initialData={editingAddress}
      />
    </div >
  );
}