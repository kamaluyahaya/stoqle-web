"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    XMarkIcon,
    PlusIcon,
    MapPinIcon,
    PencilSquareIcon,
    TrashIcon,
    CheckCircleIcon
} from "@heroicons/react/24/outline";
import { useAuth } from "@/src/context/authContext";
import { fetchUserAddresses, deleteUserAddress, setDefaultAddress, UserAddress } from "@/src/lib/api/addressApi";
import { toast } from "sonner";
import DeliveryAddressModal from "../product/addProduct/modal/deliveryAddressModal";

interface AddressListModalProps {
    open: boolean;
    onClose: () => void;
    onSelect: (address: UserAddress) => void;
    onUpdate?: () => void;
}

export default function AddressListModal({ open, onClose, onSelect, onUpdate }: AddressListModalProps) {
    const { token } = useAuth();
    const [addresses, setAddresses] = useState<UserAddress[]>([]);
    const [loading, setLoading] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);

    const loadAddresses = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await fetchUserAddresses(token);
            setAddresses(res.data || []);
        } catch (err) {
            toast.error("Failed to load addresses");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) loadAddresses();
    }, [open, token]);

    const handleDelete = async (id: number) => {
        if (!token) return;
        if (!confirm("Are you sure you want to delete this address?")) return;
        try {
            await deleteUserAddress(id, token);
            setAddresses(prev => prev.filter(a => a.address_id !== id));
            toast.success("Address deleted");
            if (onUpdate) onUpdate();
        } catch (err) {
            toast.error("Failed to delete address");
        }
    };

    const handleSetDefault = async (id: number) => {
        if (!token) return;
        try {
            await setDefaultAddress(id, token);
            setAddresses(prev => prev.map(a => ({
                ...a,
                is_default: a.address_id === id
            })));
            toast.success("Default address updated");
            if (onUpdate) onUpdate();
        } catch (err) {
            toast.error("Failed to set default address");
        }
    };

    if (!open) return null;

    return (
        <>
            <div className="fixed inset-0 z-[20000] flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                    onClick={onClose}
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-lg bg-white rounded-[0.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
                >
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-900">My Addresses</h3>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 transition">
                            <XMarkIcon className="w-6 h-6 text-slate-500" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {loading && (
                            <div className="flex items-center justify-center py-10">
                                <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        )}

                        {!loading && addresses.length === 0 && (
                            <div className="text-center py-10">
                                <MapPinIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                <p className="text-slate-500">No addresses saved yet</p>
                            </div>
                        )}

                        {addresses.map((addr) => (
                            <div
                                key={addr.address_id}
                                className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${addr.is_default ? "border-rose-100 bg-rose-50/30" : "border-slate-100 hover:border-rose-50"
                                    }`}
                                onClick={() => onSelect(addr)}
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-900">{addr.full_name}</span>
                                        {addr.is_default && (
                                            <span className="text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-full font-bold  tracking-wider">Default</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingAddress(addr);
                                                setShowAddModal(true);
                                            }}
                                            className="p-1.5 rounded-lg hover:bg-white text-slate-400 hover:text-rose-500 transition shadow-sm"
                                        >
                                            <PencilSquareIcon className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(addr.address_id);
                                            }}
                                            className="p-1.5 rounded-lg hover:bg-white text-slate-400 hover:text-rose-500 transition shadow-sm"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-sm text-slate-600 line-clamp-1">{addr.address_line1}</p>
                                <p className="text-xs text-slate-500">{addr.city}, {addr.state}</p>
                                <div className="flex items-center justify-between mt-3">
                                    <span className="text-xs font-medium text-slate-500">{addr.phone}</span>
                                    {!addr.is_default && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleSetDefault(addr.address_id);
                                            }}
                                            className="text-[10px] font-bold text-rose-500 hover:underline"
                                        >
                                            Set as default
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-4 border-t border-slate-50">
                        <button
                            onClick={() => {
                                setEditingAddress(null);
                                setShowAddModal(true);
                            }}
                            className="w-full py-3 rounded-full bg-rose-500 hover:bg-slate-800 text-white font-bold transition flex items-center justify-center gap-2"
                        >
                            <PlusIcon className="w-5 h-5" />
                            <span>Add New Address</span>
                        </button>
                    </div>
                </motion.div>
            </div>

            <DeliveryAddressModal
                open={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSave={() => {
                    loadAddresses();
                    setShowAddModal(false);
                    if (onUpdate) onUpdate();
                }}
                initialData={editingAddress}
            />
        </>
    );
}
