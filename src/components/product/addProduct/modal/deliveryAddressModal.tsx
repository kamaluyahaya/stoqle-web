"use client";

import React, { useState, useEffect } from "react";
import { ChevronLeftIcon, UserCircleIcon } from "@heroicons/react/24/outline";
import DefaultInput from "../../../input/default-input";
import NumberInput from "../../../input/default-phone-number";
import AddressSelectionModal from "../../../business/addressSelectionModal";
import { countries } from "@/src/lib/api/country";
import { geocodeAddress, arrangeAddressForNigeria } from "@/src/lib/geocoding";
import { motion, AnimatePresence } from "framer-motion";
import { FaExclamationTriangle } from "react-icons/fa";
import { useAuth } from "@/src/context/authContext";
import { createUserAddress, updateUserAddress } from "@/src/lib/api/addressApi";
import { toast } from "sonner";

interface DeliveryAddressModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (address: any) => void;
    initialData?: any;
}

export default function DeliveryAddressModal({
    open,
    onClose,
    onSave,
    initialData,
}: DeliveryAddressModalProps) {
    const [recipientName, setRecipientName] = useState("");
    const [contactNo, setContactNo] = useState("");
    const [region, setRegion] = useState("");
    const [address, setAddress] = useState("");
    const [isDefault, setIsDefault] = useState(false);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [showGeocodeWarning, setShowGeocodeWarning] = useState(false);

    // Google Places Suggestions
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Load Places Library and fetch suggestions
    const [isSelecting, setIsSelecting] = useState(false);
    const [debugStatus, setDebugStatus] = useState<string>("");

    // Management of Session Token for Google Autocomplete (improves reliability and billing efficiency)
    const [sessionToken, setSessionToken] = useState<any>(null);

    // One-time load of Google Maps Places Library
    useEffect(() => {
        if (!open) return;
        const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!GOOGLE_MAPS_API_KEY) return;

        const scriptId = "google-maps-geocoding-script";
        if (!(window as any).google?.maps?.places) {
            if (!document.getElementById(scriptId)) {
                const script = document.createElement("script");
                script.id = scriptId;
                script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
                script.async = true;
                document.head.appendChild(script);
            }
        }
    }, [open]);

    // Create session token when modal opens or typing starts
    useEffect(() => {
        if (open && (window as any).google?.maps?.places && !sessionToken) {
            setSessionToken(new (window as any).google.maps.places.AutocompleteSessionToken());
        }
    }, [open, sessionToken]);

    useEffect(() => {
        // Validation check before querying Google Places
        if (!open || !address || address.length < 3 || isSelecting) {
            if (!address || address.length < 3) {
                setSuggestions([]);
                setShowSuggestions(false);
                setSessionToken(null);
            }
            if (isSelecting) setIsSelecting(false);
            return;
        }

        const fetchPredictions = async () => {
            if (!(window as any).google?.maps?.places) return;

            try {
                const service = new (window as any).google.maps.places.AutocompleteService();
                service.getPlacePredictions({
                    input: address,
                    sessionToken: sessionToken || undefined,
                    componentRestrictions: { country: "NG" },
                }, (predictions: any, status: any) => {
                    setDebugStatus(status);
                    if (status === "OK") {
                        setSuggestions(predictions || []);
                        setShowSuggestions(!!(predictions && predictions.length > 0));
                    } else if (status === "ZERO_RESULTS") {
                        setSuggestions([]);
                        setShowSuggestions(false);
                    } else {
                        console.warn("Places status:", status);
                        setSuggestions([]);
                        setShowSuggestions(false);
                    }
                });
            } catch (err) {
                console.error("Autocomplete exception:", err);
            }
        };

        const timeoutId = setTimeout(fetchPredictions, 500);
        return () => clearTimeout(timeoutId);
    }, [address, open, isSelecting, sessionToken]);

    // Load address from initialData or localStorage on mount
    useEffect(() => {
        if (!open) return;

        if (initialData) {
            setRecipientName(initialData.recipientName || "");
            setContactNo(initialData.contactNo || "");
            setRegion(initialData.region || "");
            setAddress(initialData.address || "");
            setIsDefault(initialData.isDefault || false);
        } else {
            // Reset fields if no initialData
            setRecipientName("");
            setContactNo("");
            setRegion("");
            setAddress("");
            setIsDefault(false);
        }
    }, [open, initialData]);

    // Prevent background scroll
    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    const handlePickContact = async () => {
        // Feature detection for Contacts Picker API (mostly mobile Chrome/Safari)
        if ("contacts" in navigator && "ContactsManager" in window) {
            try {
                const props = ["name", "tel"];
                const opts = { multiple: false };
                // @ts-ignore
                const contacts = await navigator.contacts.select(props, opts);
                if (contacts.length > 0) {
                    const contact = contacts[0];
                    if (contact.name && contact.name.length > 0) {
                        setRecipientName(contact.name[0]);
                    }
                    if (contact.tel && contact.tel.length > 0) {
                        // Strip non-digits and try to set as number
                        const digits = contact.tel[0].replace(/\D/g, "");
                        setContactNo(digits || "");
                    }
                }
            } catch (err) {
                console.error("Contacts picker error:", err);
            }
        } else {
            toast.info("Contact picking is not supported on this browser. Please enter manually.");
        }
    };

    const { token } = useAuth();

    const finalSave = async (coords?: { latitude: number; longitude: number } | null) => {
        setIsGeocoding(true);
        let lat = coords?.latitude;
        let lng = coords?.longitude;

        // Fallback to mock coordinates if geocoding failed totally
        if (lat === undefined || lng === undefined) {
            lat = 6.5244; // Default Lagos
            lng = 3.3792;

            if (region.includes("Abuja")) {
                lat = 9.0765;
                lng = 7.3986;
            } else if (region.includes("Kano")) {
                lat = 12.0022;
                lng = 8.5920;
            } else if (region.includes("Port Harcourt")) {
                lat = 4.8156;
                lng = 7.0498;
            } else if (region.includes("Ibadan")) {
                lat = 7.3775;
                lng = 3.9470;
            }
        }

        const regionParts = region.split(",").map(p => p.trim());

        const addressData = {
            recipientName,
            contactNo: String(contactNo),
            region,
            address,
            isDefault,
            latitude: lat,
            longitude: lng,
        };

        // If logged in, sync with database
        if (token) {
            try {
                const apiData = {
                    full_name: recipientName,
                    phone: String(contactNo),
                    address_line1: address,
                    country: regionParts[0] || "Nigeria",
                    state: regionParts[1] || "",
                    city: regionParts[2] || "",
                    latitude: lat,
                    longitude: lng,
                    is_default: isDefault
                };

                if (initialData?.address_id) {
                    await updateUserAddress(initialData.address_id, apiData, token);
                    toast.success("Address updated successfully");
                } else {
                    const res = await createUserAddress(apiData, token);
                    if (res.data?.address_id) {
                        (addressData as any).address_id = res.data.address_id;
                    }
                    toast.success("Address saved to your profile");
                }
            } catch (err) {
                console.error("Failed to sync address with DB:", err);
                toast.error("Saved locally, but failed to sync with database");
            }
        }

        setIsGeocoding(false);
        onSave(addressData);
        onClose();
    };

    const handleSave = async () => {
        if (!recipientName) {
            toast.error("Recipient name is required");
            return;
        }
        if (recipientName.trim().length <= 2) {
            toast.error("Recipient name must be more than 2 characters");
            return;
        }
        if (!contactNo) {
            toast.error("Contact number is required");
            return;
        }
        const phoneStr = String(contactNo).trim();
        if (phoneStr.length < 10 || phoneStr.length > 11) {
            toast.error("Contact number must be between 10 and 11 digits");
            return;
        }
        if (!region) {
            toast.error("Region (State, LGA) is required");
            return;
        }
        if (!address) {
            toast.error("Detailed address is required");
            return;
        }

        setIsGeocoding(true);
        const regionParts = region.split(",").map(p => p.trim());
        const state = regionParts[1] || "";
        const lga = regionParts[2] || "";
        const fullAddress = arrangeAddressForNigeria(address, lga, state);

        try {
            const coords = await geocodeAddress(fullAddress);
            if (coords) {
                await finalSave(coords);
            } else {
                setIsGeocoding(false);
                setShowGeocodeWarning(true);
            }
        } catch (err) {
            console.error("Geocoding error", err);
            setIsGeocoding(false);
            setShowGeocodeWarning(true);
        }
    };

    return (
        <AnimatePresence>
            {open && (
                <div
                    key="delivery-address-container"
                    className="fixed inset-0 z-[20005] flex items-end sm:items-center justify-center p-0 outline-none" role="dialog" aria-modal="true"
                >
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/50"
                        onClick={onClose}
                    />

                    <motion.div
                        initial={{ y: "100%", opacity: 0.5 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: "100%", opacity: 0.5 }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="relative w-full max-w-lg bg-white rounded-t-[0.5rem] sm:rounded-[0.5rem] z-10 h-[92vh] sm:h-auto max-h-[95vh] flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-5 flex items-center justify-center border-b border-slate-100 bg-white relative">
                            <button
                                onClick={onClose}
                                className="absolute left-4 p-2 rounded-full hover:bg-slate-100 transition text-slate-800"
                            >
                                <ChevronLeftIcon className="w-6 h-6 stroke-[2.5]" />
                            </button>
                            <h2 className="text-sm font-bold text-slate-900">{initialData ? "Edit Delivery Address" : "Add Delivery Address"}</h2>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-5 pb-20 space-y-2">
                            {/* Recipient Name with Contact Picker */}
                            <DefaultInput
                                label="Recipient"
                                value={recipientName}
                                onChange={setRecipientName}
                                placeholder="Full Name"
                                required
                            />

                            {/* Contact Number */}
                            <NumberInput
                                label="Contact No"
                                value={contactNo}
                                onChange={setContactNo}
                                placeholder="080 000 0000"
                                required
                                maxLength={11}
                            />

                            {/* Region Selection */}
                            <AddressSelectionModal
                                title="Region"
                                hintText="State, LGA"
                                isRequired
                                hierarchy={countries}
                                value={region}
                                onSelected={setRegion}
                            />
                            <div className="border-b border-slate-200"></div>

                             {/* Detailed Address */}
                             <div className="relative z-[20015]">
                                <DefaultInput
                                    label="Address"
                                    value={address}
                                    onChange={(val) => {
                                        setAddress(val);
                                    }}
                                    placeholder="Street, Building, Apartment No"
                                    required
                                />

                                {/* Suggestions Dropdown */}
                                <AnimatePresence>
                                    {showSuggestions && suggestions.length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0 }}
                                            className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] z-[20020] max-h-64 overflow-y-auto"
                                        >
                                            {suggestions.map((p: any) => (
                                                <button
                                                    key={p.place_id}
                                                    type="button"
                                                    onClick={() => {
                                                        setIsSelecting(true);
                                                        setAddress(p.description);
                                                        setSuggestions([]);
                                                        setShowSuggestions(false);
                                                    }}
                                                    className="w-full text-left px-5 py-4 hover:bg-slate-50 border-b border-slate-50 last:border-b-0 transition flex flex-col gap-0.5"
                                                >
                                                    <div className="text-sm text-slate-900 font-bold truncate">
                                                        {p.structured_formatting?.main_text || p.description}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 truncate font-medium">
                                                        {p.structured_formatting?.secondary_text || p.description}
                                                    </div>
                                                </button>
                                            ))}
                                            
                                            {/* Google Attribution */}
                                            <div className="p-3 bg-slate-50/50 flex justify-end">
                                               <img src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png" alt="Powered by Google" className="h-3 opacity-50" />
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                             </div>

                            {/* Status Indicator (Searching) */}
                            {(address.length >= 3 && !isSelecting) && (
                                <div className="px-4 py-2 flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        {(suggestions.length === 0 && !showSuggestions) ? (
                                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                                        ) : (
                                            <div className="w-2 h-2 bg-green-500 rounded-full" />
                                        )}
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                            {suggestions.length > 0 ? `${suggestions.length} Suggestions Found` : "Searching Map..."}
                                        </span>
                                    </div>
                                    
                                    {/* Diagnostic Info (Debugging) */}
                                    <div className="text-[9px] text-slate-300 font-mono flex flex-col gap-0.5">
                                        <div className="flex items-center gap-2">
                                            <span>Status: <span className="text-slate-500 uppercase">{debugStatus || "Idle"}</span></span>
                                            <span>•</span>
                                            <span>Library: <span className={!!(window as any).google?.maps?.places ? "text-green-500" : "text-amber-500"}>
                                                {!!(window as any).google?.maps?.places ? "Ready" : "Waiting"}
                                            </span></span>
                                        </div>
                                        <div className="truncate max-w-[200px]">
                                            <span className="text-slate-400">Query: </span>
                                            <span className="text-slate-500">[{address}]</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Default Toggle */}
                            <div className="flex items-center justify-between bg-white rounded-2xl  border-slate-100 pt-4">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-800">Set as Default Address</span>
                                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Use for all future orders</span>
                                </div>
                                <button
                                    onClick={() => setIsDefault(!isDefault)}
                                    className={`w-12 h-6 rounded-full transition-all relative ${isDefault ? "bg-red-500" : "bg-slate-200"}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isDefault ? "right-1" : "left-1"}`} />
                                </button>
                            </div>
                            <div className="border-b border-slate-200"></div>
                        </div>

                        {/* Footer */}
                        <div className="p-1  border-slate-100 bg-white px-4">
                            <button
                                onClick={handleSave}
                                disabled={isGeocoding}
                                className={`w-full py-2 rounded-full bg-red-600 hover:bg-red-700 text-white font-black text-sm shadow-red-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${isGeocoding ? "opacity-70 cursor-not-allowed" : ""}`}
                            >
                                {isGeocoding ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>Verifying...</span>
                                    </>
                                ) : "Save and Use"}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Geocode Warning Modal */}
            <AnimatePresence>
                {showGeocodeWarning && (
                    <div className="fixed inset-0 z-[21000] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                            onClick={() => setShowGeocodeWarning(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 text-center sm:p-10"
                        >
                            <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-500">
                                <FaExclamationTriangle size={36} />
                            </div>
                            <h4 className="text-2xl font-extrabold text-slate-900 mb-4 tracking-tight">Check Delivery Address</h4>
                            <div className="space-y-4 mb-8">
                                <p className="text-slate-600 leading-relaxed text-[15px]">
                                    Courier may be unable to deliver your order as the address provided may be missing the
                                    <span className="font-bold text-slate-900"> building/house number</span>.
                                </p>
                                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-left">
                                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Provided Address</p>
                                    <p className="text-sm text-slate-700 font-medium leading-tight">
                                        {(() => {
                                            const parts = region.split(",").map(p => p.trim());
                                            return arrangeAddressForNigeria(address, parts[2] || "", parts[1] || "");
                                        })()}
                                    </p>
                                </div>
                                <p className="text-sm text-slate-400">
                                    Please check if the address provided is correct.
                                </p>
                            </div>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => setShowGeocodeWarning(false)}
                                    className="w-full py-4 rounded-2xl font-bold bg-slate-900 text-white hover:bg-slate-800 transition shadow-xl shadow-slate-200"
                                >
                                    Edit Address
                                </button>
                                <button
                                    onClick={async () => {
                                        setShowGeocodeWarning(false);
                                        await finalSave(null);
                                    }}
                                    className="w-full py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition border border-transparent hover:border-slate-100 mt-1"
                                >
                                    It is correct
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </AnimatePresence>
    );
}
