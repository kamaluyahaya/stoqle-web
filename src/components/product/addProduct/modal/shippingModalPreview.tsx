"use client";

import React, { useState, useEffect } from "react";
import {
  TrashIcon,
  PencilSquareIcon,
  PlusIcon,
  CheckCircleIcon,
  MapPinIcon
} from "@heroicons/react/24/outline";
import DeliveryAddressModal from "./deliveryAddressModal";
import { useAuth } from "@/src/context/authContext";
import { fetchUserAddresses, deleteUserAddress, setDefaultAddress } from "@/src/lib/api/addressApi";
import { motion, AnimatePresence } from 'framer-motion';
import { copyToClipboard } from '@/src/lib/utils/utils';
import { toast } from "sonner";

type ShippingModalProps = {
  open: boolean;
  title?: string | null;
  body?: string | null;
  onClose: () => void;
  onAddressChange?: (address: any) => void;
  deliveryNotice?: string | null;
  estimateDuration?: string | null;
};

export default function ShippingModal({ open, title, body, onClose, onAddressChange, deliveryNotice, estimateDuration }: ShippingModalProps) {
  const { token } = useAuth();
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
      const res = await fetchUserAddresses(token);
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

      // Stable sort by ID to prevent position jumping when default changes
      const sorted = mappedDb.sort((a: any, b: any) => Number(a.address_id) - Number(b.address_id));
      setAddresses(sorted);

      const def = sorted.find((a: any) => a.isDefault);
      if (def) {
        setActiveAddressId(String(def.address_id));
        if (onAddressChange) onAddressChange(def);
      } else if (sorted.length > 0) {
        if (!activeAddressId) {
          setActiveAddressId(String(sorted[0].address_id));
          if (onAddressChange) onAddressChange(sorted[0]);
        }
      }
    } catch (e) {
      console.error("Failed to load addresses", e);
    }
  };

  useEffect(() => {
    if (open) loadAddresses();
  }, [open, token]);

  const handleSelectAddress = (addr: any) => {
    setActiveAddressId(String(addr.address_id));
    if (onAddressChange) onAddressChange(addr);
  };

  const handleDeleteAddress = async (id: any) => {
    if (!token) return;
    try {
      const numericId = (typeof id === "number" ? id : Number(id)) as number;
      await deleteUserAddress(numericId, token);
      toast.success("Address deleted");
      loadAddresses();
    } catch (e) {
      toast.error("Failed to delete address");
    }
  };

  const handleSetDefault = async (addrId: string | number) => {
    if (!token) return;
    try {
      const numericId = Number(addrId);
      await setDefaultAddress(numericId, token);
      toast.success("Default address updated");
      loadAddresses();
    } catch (e) {
      toast.error("Failed to set default address");
    }
  };

  if (!open) return null;

  console.log("ShippingModal deliveryNotice prop:", deliveryNotice);

  return (
    <div className="fixed inset-0 z-[600000] flex items-end lg:items-center justify-center p-0 lg:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div
        className="relative bg-white w-full sm:max-w-sm h-[80vh] sm:h-auto sm:max-h-[85vh] rounded-t-[0.5rem] sm:rounded-[0.5rem] p-4 border-t sm:border border-slate-100 shadow-2xl flex flex-col justify-between"

        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white sticky top-0 z-30 lg:rounded-t-[0.5rem] md:rounded-t-[0.5rem] rounded-t-[0.5rem] border-b border-slate-50">
          <div className="relative flex flex-col items-start justify-center px-5 py-4 min-h-[4rem]">
            <div className="flex items-center w-full relative">
              <div className="w-10 h-10 shrink-0" /> {/* Spacer for balance */}
              <h3 className="absolute left-1/2 -translate-x-1/2 text-base text-slate-800 truncate max-w-[60%] text-center">
                {title ?? "Shipping Information"}
              </h3>
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all ml-auto shrink-0"
                aria-label="Close"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {(estimateDuration || true) && (
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[10px]  w-full overflow-hidden">
                <span className="text-emerald-600 shrink-0">Estimate shipping within {estimateDuration || "8-48h"}</span>
                <span className="text-slate-200 shrink-0">|</span>
                <span className="text-slate-400 truncate">Delayed compensation guarantee</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Address Section */}
          <div className="bg-white mt-2 flex flex-col min-h-0">
            <div className="px-5 py-4 flex items-center justify-between border-b border-slate-50">
              <h2 className="text-[12px] text-slate-800">Select delivery address</h2>
              <button
                onClick={() => { setEditingAddress(null); setAddressModalOpen(true); }}
                className="text-red-500 text-xs  rounded-full hover:bg-red-50 transition-colors flex items-center gap-1"
              >
                Add Address
              </button>
            </div>

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar px-5 pb-5 space-y-4">
              {addresses.length === 0 ? (
                <div className="py-10 flex flex-col items-center justify-center text-slate-400 gap-3 border-2 border-dashed border-slate-100 rounded-xl">
                  <MapPinIcon className="w-8 h-8 opacity-20" />
                  <p className="text-xs">No addresses found</p>
                </div>
              ) : (
                addresses.map((addr) => {
                  const isActive = activeAddressId === String(addr.address_id);
                  const maskPhone = (p: string) => {
                    const c = p.replace(/\D/g, "");
                    return c.length >= 7 ? `${c.slice(0, 3)}****${c.slice(-4)}` : p;
                  };
                  const formatPhone = (p: string) => {
                    const c = p.replace(/\D/g, "");
                    const m = c.match(/^(\d{3})(\d{3})(\d{4})$/);
                    return m ? `${m[1]}-${m[2]}-${m[3]}` : p;
                  };

                  return (
                    <div
                      key={addr.id}
                      onClick={() => handleSelectAddress(addr)}
                      className={`relative p-4 rounded-[0.5rem] border transition-all cursor-pointer ${isActive ? "border-red-500 bg-red-50/10 shadow-sm" : "border-slate-100 bg-white hover:border-slate-200"
                        }`}
                    >
                      {/* Name | Masked Phone */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className=" text-[13px] text-slate-900">
                          {addr.recipientName} | {maskPhone(addr.contactNo)}
                        </span>
                        {isActive && <CheckCircleIcon className="w-3.5 h-3.5 text-red-500" />}
                      </div>

                      {/* Info lines */}
                      <div className="text-[12px] text-slate-500 space-y-0.5">
                        <p className="font-medium text-slate-600">{formatPhone(addr.contactNo)}</p>
                        <p className="truncate text-slate-500">{addr.address}, {addr.region}</p>
                      </div>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                        <div className="flex items-center">
                          {addr.isDefault ? (
                            <span className="text-[10px]  text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                              Default
                            </span>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSetDefault(addr.address_id);
                              }}
                              className="text-[10px]  text-slate-300 hover:text-slate-500 border border-slate-100 px-2 py-0.5 rounded-md transition-colors"
                            >
                              Set Default
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingAddress(addr);
                              setAddressModalOpen(true);
                            }}
                            className="text-[11px]  text-slate-400 hover:text-slate-900"
                          >
                            Modify
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(`${addr.recipientName}\n${addr.contactNo}\n${addr.address}, ${addr.region}`);
                              toast.success("Copied to clipboard");
                            }}
                            className="text-[11px]  text-slate-400 hover:text-slate-900"
                          >
                            Copy
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAddress(addr.address_id);
                            }}
                            className="text-[11px]  text-slate-400 hover:text-red-500"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Info Body */}
          <div className="p-5 bg-white text-sm text-slate-700 mt-2">
            {!body ? (
              <div className="text-slate-400 text-center py-10">No shipping details provided.</div>
            ) : (
              <div className="whitespace-pre-wrap break-words text-xs leading-relaxed space-y-4">
                {body.split("\n").map((line, idx) => {
                  const isHeading = line.trim().endsWith(":") || line.includes("Breakdown ---");
                  return (
                    <div key={idx} className={isHeading ? " text-sm text-slate-800 border-b border-slate-50 pb-1 mt-6 first:mt-0" : ""}>
                      {line}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Vendor Delivery Notice - Pinned to bottom for fixed visibility */}
        {deliveryNotice && (
          <div className="p-5 ">
            <div className="flex items-start gap-3">

              <div>
                <h4 className="text-[10px] font-black  mb-1">Vendor Delivery Notice</h4>
                <p className="text-[12px] text-slate-600 leading-relaxed italic">
                  "{deliveryNotice}"
                </p>
              </div>
            </div>
          </div>
        )}

        <DeliveryAddressModal
          open={addressModalOpen}
          onClose={() => setAddressModalOpen(false)}
          onSave={loadAddresses}
          initialData={editingAddress}
        />
      </div>
    </div>
  );
}
