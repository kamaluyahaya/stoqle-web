"use client";

import React, { useEffect, useState, useRef } from "react";
import DefaultInput from "../../input/default-input";
import DefaultSelect from "../../input/default-select";
import BusinessAddressModal from "./businessAddressModal";
import { FaCamera, FaStore, FaImage, FaMapMarkerAlt } from "react-icons/fa";
import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
    open: boolean;
    initialValue: string; // JSON string
    onClose: () => void;
    onSave?: (formData: FormData) => Promise<void> | void;
};

export default function ShopProfileModal({ open, initialValue, onClose, onSave }: Props) {
    const CATEGORIES = useMemo(
        () => [
            "All",
            "Food & Groceries",
            "Fashion",
            "Home",
            "Sports",
            "Electronics",
            "Beauty",
            "Toys",
            "Crafts",
            "Kids",
            "Pets",
            "Shoes",
            "Automotive",
        ],
        []
    );

    const [businessName, setBusinessName] = useState("");
    const [businessAddress, setBusinessAddress] = useState("");
    const [businessCategory, setBusinessCategory] = useState("");
    const [bio, setBio] = useState("");
    const [profilePic, setProfilePic] = useState<string | null>(null);
    const [bgPhoto, setBgPhoto] = useState<string | null>(null);

    const [profileFile, setProfileFile] = useState<File | null>(null);
    const [bgFile, setBgFile] = useState<File | null>(null);

    const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const profileInputRef = useRef<HTMLInputElement>(null);
    const bgInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;
        try {
            const parsed = initialValue ? JSON.parse(initialValue) : {};
            setBusinessName(parsed.business_name || "");
            setBusinessAddress(parsed.business_address || "");
            setBusinessCategory(parsed.business_category || "");
            setBio(parsed.bio || "");
            setProfilePic(parsed.profile_pic || parsed.logo || null);
            setBgPhoto(parsed.bg_photo_url || null);
        } catch (e) {
            console.error("Failed to parse initialValue", e);
        }
    }, [open, initialValue]);

    const handleProfileClick = () => profileInputRef.current?.click();
    const handleBgClick = () => bgInputRef.current?.click();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'profile' | 'bg') => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            if (type === 'profile') {
                setProfilePic(reader.result as string);
                setProfileFile(file);
            } else {
                setBgPhoto(reader.result as string);
                setBgFile(file);
            }
        };
        reader.readAsDataURL(file);
    };

    const formatAddress = (addrJson: string) => {
        if (!addrJson) return "";
        try {
            const parsed = JSON.parse(addrJson);
            const line1 = parsed.address_line_1 || parsed.line1 || "";
            const city = parsed.city || "";
            const state = parsed.state || "";
            return [line1, city, state].filter(Boolean).join(", ");
        } catch {
            return addrJson;
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const formData = new FormData();
            formData.append("business_name", businessName);
            formData.append("business_address", businessAddress);
            formData.append("business_category", businessCategory);
            formData.append("bio", bio);

            if (profileFile) {
                formData.append("profile_pic", profileFile);
            }
            if (bgFile) {
                formData.append("bg_photo_url", bgFile);
            }

            if (onSave) await onSave(formData);
        } catch (e) {
            console.error("Save error", e);
        } finally {
            setSaving(false);
            onClose();
        }
    };

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-[1001] flex items-end sm:items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={() => !saving && onClose()}
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="relative bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-slate-900">Shop Profile</h3>
                            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="max-h-[70vh] overflow-y-auto">
                            {/* Photos Section */}
                            <div className="relative">
                                {/* Background Photo */}
                                <div
                                    className="h-32 w-full bg-slate-100 cursor-pointer relative group overflow-hidden"
                                    onClick={handleBgClick}
                                >
                                    {bgPhoto ? (
                                        <img src={bgPhoto} alt="Background" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                                            <FaImage size={24} />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <FaCamera className="text-white text-xl" />
                                    </div>
                                    <input
                                        type="file"
                                        ref={bgInputRef}
                                        onChange={(e) => handleFileChange(e, 'bg')}
                                        className="hidden"
                                        accept="image/*"
                                    />
                                </div>

                                {/* Profile Picture */}
                                <div className="absolute -bottom-10 left-6">
                                    <div
                                        className="w-24 h-24 rounded-full bg-white p-1 shadow-lg cursor-pointer relative group overflow-hidden"
                                        onClick={handleProfileClick}
                                    >
                                        <div className="w-full h-full rounded-full bg-slate-50 overflow-hidden flex items-center justify-center border-2 border-white">
                                            {profilePic ? (
                                                <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                                            ) : (
                                                <FaStore className="text-slate-300 text-3xl" />
                                            )}
                                        </div>
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                                            <FaCamera className="text-white text-lg" />
                                        </div>
                                    </div>
                                    <input
                                        type="file"
                                        ref={profileInputRef}
                                        onChange={(e) => handleFileChange(e, 'profile')}
                                        className="hidden"
                                        accept="image/*"
                                    />
                                </div>
                            </div>

                            <div className="p-6 pt-14 space-y-6">
                                <div className="space-y-4">
                                    <DefaultInput
                                        label="Shop Name"
                                        placeholder="Enter your business name"
                                        value={businessName}
                                        onChange={setBusinessName}
                                    />
                                    <p className="text-[10px] text-slate-400 -mt-2 px-1">
                                        Changing your shop name will keep a record of your previous name.
                                    </p>

                                    <div className="space-y-1.5 px-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Business Address</label>
                                        <button
                                            type="button"
                                            onClick={() => setIsAddressModalOpen(true)}
                                            className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-slate-50 hover:bg-slate-100 transition text-sm text-left"
                                        >
                                            <span className={businessAddress ? "text-slate-900" : "text-slate-400"}>
                                                {formatAddress(businessAddress) || "Select business location"}
                                            </span>
                                            <FaMapMarkerAlt className="text-slate-300 ml-2 shrink-0" />
                                        </button>
                                    </div>

                                    <div className="space-y-1.5 px-1">
                                        <DefaultSelect
                                            title="Choose business category"
                                            options={CATEGORIES}
                                            value={businessCategory}
                                            onSelected={setBusinessCategory}
                                            hintText="Select category"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Shop Bio</label>
                                        <textarea
                                            className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-rose-500/20 transition h-32 text-slate-900 placeholder:text-slate-400 resize-none text-sm"
                                            placeholder="Tell customers about your business..."
                                            value={bio}
                                            onChange={(e) => setBio(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 bg-slate-50/50 flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 px-6 py-3.5 rounded-2xl font-bold text-slate-600 hover:bg-slate-100 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 px-6 py-3.5 rounded-2xl font-bold bg-rose-500 text-white hover:bg-rose-600 shadow-lg shadow-rose-200 disabled:opacity-50 transition"
                            >
                                {saving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>

                    </motion.div>

                    <BusinessAddressModal
                        open={isAddressModalOpen}
                        prefKey="temp_shop_profile_address"
                        initialValue={businessAddress}
                        onClose={() => setIsAddressModalOpen(false)}
                        onSave={(val) => {
                            setBusinessAddress(val);
                            setIsAddressModalOpen(false);
                        }}
                    />
                </div>
            )}
        </AnimatePresence>
    );
}
