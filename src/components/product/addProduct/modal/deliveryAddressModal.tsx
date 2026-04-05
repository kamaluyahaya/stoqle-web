"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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

declare global {
    interface Window {
        google?: any;
    }
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

    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [sessionToken, setSessionToken] = useState<any>(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const [inputRect, setInputRect] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
    const addressInputRef = useRef<HTMLDivElement>(null);

    const [mapsReady, setMapsReady] = useState(false);
    const [mapsError, setMapsError] = useState<string>("");

    const containerRef = useRef<HTMLDivElement>(null);
    const serviceRef = useRef<any>(null);
    const loadAttemptedRef = useRef(false);

    const { token } = useAuth();

    const debug = (...args: any[]) => {
        console.log("[DeliveryAddressModal]", ...args);
    };

    // Close suggestions on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const loadGooglePlaces = () => {
        if (typeof window === "undefined") return;
        if (!open) return;

        const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

        debug("Opening modal. Checking Google Places setup...");
        debug("API key present:", !!GOOGLE_MAPS_API_KEY);
        debug("Current window.google:", !!window.google);
        debug("Current window.google.maps:", !!window.google?.maps);
        debug("Current window.google.maps.places:", !!window.google?.maps?.places);

        if (!GOOGLE_MAPS_API_KEY) {
            const msg = "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing";
            console.error("[DeliveryAddressModal]", msg);
            setMapsError(msg);
            return;
        }

        const scriptId = "google-maps-geocoding-script"; // Unified ID to match geocoding.ts

        const initPlacesService = (retryCount = 0) => {
            try {
                if (window.google?.maps?.places) {
                    serviceRef.current = new window.google.maps.places.AutocompleteService();
                    setMapsReady(true);
                    setMapsError("");
                    debug("Google Places loaded successfully.");
                } else if (retryCount < 5) {
                    // Sometimes the core SDK loads before the library sub-module is injected
                    debug(`Places library not found yet. Retrying (${retryCount + 1})...`);
                    setTimeout(() => initPlacesService(retryCount + 1), 300);
                } else {
                    const msg = "Google Maps script loaded, but 'places' library is missing. Ensure the script tag includes '&libraries=places'.";
                    console.error("[DeliveryAddressModal]", msg);
                    setMapsError(msg);
                }
            } catch (err) {
                console.error("[DeliveryAddressModal] Failed to init Places service:", err);
                setMapsError("Failed to initialize Google Places service");
            }
        };

        if (window.google?.maps?.places) {
            initPlacesService();
            return;
        }

        // Detect ANY existing Google Maps script on the page to prevent "multiple API" errors
        let script = document.getElementById(scriptId) as HTMLScriptElement | null;
        if (!script) {
            script = Array.from(document.getElementsByTagName("script")).find((s) =>
                s.src.includes("maps.googleapis.com/maps/api/js")
            ) as HTMLScriptElement | null;
        }

        if (!script) {
            debug("Google Maps script not found. Creating script tag...");
            script = document.createElement("script");
            script.id = scriptId;
            script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
            script.async = true;
            script.defer = true;

            script.onload = () => {
                debug("Google Maps script onload fired.");
                initPlacesService();
            };

            script.onerror = (e) => {
                console.error("[DeliveryAddressModal] Google Maps script failed to load:", e);
                setMapsError("Google Maps script failed to load");
            };

            document.head.appendChild(script);
        } else {
            debug("Google Maps script already exists on page. Checking for library...");
            
            // If script exists but URL doesn't have places, we might need a reload or to warn
            const hasPlacesInUrl = script.src.includes("libraries=places") || script.src.includes("libraries=...,places") || script.src.includes("libraries=places,...");
            
            if (window.google?.maps?.places) {
                initPlacesService();
            } else if (!hasPlacesInUrl) {
                debug("Existing script missing 'places' library. Appending library...");
                // Force reload with places if possible, or at least try to load it
                const newSrc = script.src.includes("libraries=") 
                    ? script.src.replace(/libraries=([^&]+)/, "libraries=$1,places")
                    : `${script.src}&libraries=places`;
                
                // Note: Simply changing src might not work for Google Maps API once initialized.
                // But we can try to append a new script if the first one hasn't initialized google.maps yet.
                if (!window.google?.maps) {
                    script.src = newSrc;
                } else {
                    console.warn("[DeliveryAddressModal] Google Maps initialized without 'places'. Autocomplete may fail.");
                }
                
                const waitForLoad = setInterval(() => {
                    if (window.google?.maps?.places) {
                        clearInterval(waitForLoad);
                        initPlacesService();
                    }
                }, 300);
                setTimeout(() => clearInterval(waitForLoad), 5000);
            } else {
                const waitForLoad = setInterval(() => {
                    if (window.google?.maps?.places) {
                        clearInterval(waitForLoad);
                        debug("Google Places library finally available.");
                        initPlacesService();
                    }
                }, 300);

                setTimeout(() => {
                    clearInterval(waitForLoad);
                    if (!window.google?.maps?.places) {
                        const msg = "Google Places library missing. Script on page might not have 'libraries=places' in its URL.";
                        console.error("[DeliveryAddressModal]", msg);
                        setMapsError(msg);
                    }
                }, 7000);
            }
        }
    };

    useEffect(() => {
        if (!open) return;
        if (loadAttemptedRef.current) return;

        loadAttemptedRef.current = true;
        loadGooglePlaces();
    }, [open]);

    // Update position of suggestions dropdown
    useEffect(() => {
        if (showSuggestions && addressInputRef.current) {
            const updateRect = () => {
                const rect = addressInputRef.current?.getBoundingClientRect();
                if (rect) {
                    setInputRect({ top: rect.bottom, left: rect.left, width: rect.width });
                }
            };
            updateRect();
            window.addEventListener("scroll", updateRect, true);
            window.addEventListener("resize", updateRect);
            return () => {
                window.removeEventListener("scroll", updateRect, true);
                window.removeEventListener("resize", updateRect);
            };
        }
    }, [showSuggestions]);

    useEffect(() => {
        if (open && mapsReady && !sessionToken && window.google?.maps?.places) {
            try {
                const token = new window.google.maps.places.AutocompleteSessionToken();
                setSessionToken(token);
                debug("Created new AutocompleteSessionToken:", token);
            } catch (err) {
                console.error("[DeliveryAddressModal] Session token creation failed:", err);
            }
        }
    }, [open, mapsReady, sessionToken]);

    useEffect(() => {
        if (!open || !address || address.length < 3 || isSelecting) {
            if (!address || address.length < 3 || isSelecting) {
                setSuggestions([]);
                setShowSuggestions(false);
            }
            return;
        }

        const timeoutId = setTimeout(() => {
            const service = serviceRef.current;

            debug("Typing detected. Current address:", address);
            debug("Maps ready:", mapsReady);
            debug("Service available:", !!service);
            debug("Session token available:", !!sessionToken);

            if (!service) {
                console.warn("[DeliveryAddressModal] AutocompleteService not ready yet.");
                return;
            }

            try {
                // If a region (State/City) is already selected, use it to contextually improve street-level results
                // This is especially important in cities like Kaduna where street names might be generic
                const searchQuery = region && !address.includes(region) ? `${address}, ${region}` : address;

                const request: any = {
                    input: searchQuery,
                    sessionToken: sessionToken || undefined,
                    componentRestrictions: { country: "NG" },
                };

                // Add location biasing if we can derive a specific focus area from the region string
                // Note: For 'Nigeria, State, City' format, we prioritize the last parts
                if (region) {
                    const parts = region.split(",").map(p => p.trim());
                    if (parts.length >= 2) {
                        request.origin = undefined; // We could use coordinates here if available
                        debug("Searching with region context:", searchQuery);
                    }
                }

                service.getPlacePredictions(
                    request,
                    (predictions: any, status: any) => {
                        debug("Prediction callback status:", status);
                        debug("Predictions response:", predictions);

                        if (status === "OK" && Array.isArray(predictions) && predictions.length > 0) {
                            setSuggestions(predictions);
                            setShowSuggestions(true);
                            console.log("[DeliveryAddressModal] Suggestions shown:", predictions.length);
                        } else if (status === "ZERO_RESULTS") {
                            setSuggestions([]);
                            setShowSuggestions(false);
                            console.log("[DeliveryAddressModal] No suggestions found for:", address);
                        } else {
                            setSuggestions([]);
                            setShowSuggestions(false);
                            console.warn("[DeliveryAddressModal] Autocomplete failed with status:", status);
                        }
                    }
                );
            } catch (err) {
                console.error("[DeliveryAddressModal] Autocomplete fetch error:", err);
                setSuggestions([]);
                setShowSuggestions(false);
            }
        }, 450);

        return () => clearTimeout(timeoutId);
    }, [address, open, isSelecting, sessionToken, mapsReady]);

    useEffect(() => {
        if (!open) return;

        debug("Modal opened. Initial data:", initialData);

        if (initialData) {
            setRecipientName(initialData.recipientName || "");
            setContactNo(initialData.contactNo || "");
            setRegion(initialData.region || "");
            setAddress(initialData.address || "");
            setIsDefault(initialData.isDefault || false);
        } else {
            setRecipientName("");
            setContactNo("");
            setRegion("");
            setAddress("");
            setIsDefault(false);
        }
    }, [open, initialData]);

    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    const handlePickContact = async () => {
        debug("Contact picker opened.");

        if ("contacts" in navigator && "ContactsManager" in window) {
            try {
                const props = ["name", "tel"];
                const opts = { multiple: false };
                // @ts-ignore
                const contacts = await navigator.contacts.select(props, opts);
                debug("Contacts selected:", contacts);

                if (contacts.length > 0) {
                    const contact = contacts[0];
                    if (contact.name && contact.name.length > 0) {
                        setRecipientName(contact.name[0]);
                    }
                    if (contact.tel && contact.tel.length > 0) {
                        const digits = contact.tel[0].replace(/\D/g, "");
                        setContactNo(digits || "");
                    }
                }
            } catch (err) {
                console.error("[DeliveryAddressModal] Contacts picker error:", err);
            }
        } else {
            toast.info("Contact picking is not supported on this browser. Please enter manually.");
        }
    };

    const finalSave = async (coords?: { latitude: number; longitude: number } | null) => {
        setIsGeocoding(true);
        let lat = coords?.latitude;
        let lng = coords?.longitude;

        debug("finalSave called with coords:", coords);
        debug("Current region:", region);
        debug("Current address:", address);

        if (lat === undefined || lng === undefined) {
            lat = 6.5244;
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

            debug("Fallback coordinates used:", { lat, lng });
        }

        const regionParts = region.split(",").map((p) => p.trim());

        const addressData = {
            recipientName,
            contactNo: String(contactNo),
            region,
            address,
            isDefault,
            latitude: lat,
            longitude: lng,
        };

        debug("Prepared addressData:", addressData);

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
                    is_default: isDefault,
                };

                debug("API payload:", apiData);

                if (initialData?.address_id) {
                    debug("Updating existing address:", initialData.address_id);
                    await updateUserAddress(initialData.address_id, apiData, token);
                    toast.success("Address updated successfully");
                } else {
                    debug("Creating new address...");
                    const res = await createUserAddress(apiData, token);
                    debug("Create address response:", res);

                    if (res.data?.address_id) {
                        (addressData as any).address_id = res.data.address_id;
                    }

                    toast.success("Address saved to your profile");
                }
            } catch (err) {
                console.error("[DeliveryAddressModal] Failed to sync address with DB:", err);
                toast.error("Saved locally, but failed to sync with database");
            }
        } else {
            debug("No auth token found. Skipping DB sync.");
        }

        setIsGeocoding(false);
        onSave(addressData);
        onClose();
    };

    const handleSave = async () => {
        debug("Save button clicked.");

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
        const regionParts = region.split(",").map((p) => p.trim());
        const state = regionParts[1] || "";
        const lga = regionParts[2] || "";
        const fullAddress = arrangeAddressForNigeria(address, lga, state);

        debug("Geocoding full address:", fullAddress);

        try {
            const coords = await geocodeAddress(fullAddress);
            debug("Geocode result:", coords);

            if (coords) {
                await finalSave(coords);
            } else {
                console.warn("[DeliveryAddressModal] Geocoding returned null.");
                setIsGeocoding(false);
                setShowGeocodeWarning(true);
            }
        } catch (err) {
            console.error("[DeliveryAddressModal] Geocoding error:", err);
            setIsGeocoding(false);
            setShowGeocodeWarning(true);
        }
    };

    return (
        <AnimatePresence>
            {open && (
                <div
                    key="delivery-address-container"
                    className="fixed inset-0 z-[20005] flex items-end sm:items-center justify-center p-0 outline-none"
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                >
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/50"
                        onClick={onClose}
                    />

                    <motion.div
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        initial={{ y: "100%", opacity: 0.5 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: "100%", opacity: 0.5 }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="relative w-full max-w-lg bg-white rounded-t-[0.5rem] sm:rounded-[0.5rem] z-10 h-[92vh] sm:h-auto max-h-[95vh] flex flex-col overflow-hidden"
                    >
                        <div className="p-5 flex items-center justify-center border-b border-slate-100 bg-white relative">
                            <button
                                onClick={onClose}
                                className="absolute left-4 p-2 rounded-full hover:bg-slate-100 transition text-slate-800"
                            >
                                <ChevronLeftIcon className="w-6 h-6 stroke-[2.5]" />
                            </button>
                            <h2 className="text-sm font-bold text-slate-900">
                                {initialData ? "Edit Delivery Address" : "Add Delivery Address"}
                            </h2>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 pb-20 space-y-4">
                            <div className="relative">
                                <DefaultInput
                                    label="Recipient"
                                    value={recipientName}
                                    onChange={setRecipientName}
                                    placeholder="Full Name"
                                    required
                                />
                                <button
                                    onClick={handlePickContact}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition shadow-sm"
                                    title="Pick from contacts"
                                >
                                    <UserCircleIcon className="w-5 h-5" />
                                </button>
                            </div>

                            <NumberInput
                                label="Contact No"
                                value={contactNo}
                                onChange={setContactNo}
                                placeholder="080 000 0000"
                                required
                                maxLength={11}
                            />

                            <AddressSelectionModal
                                title="Region"
                                hintText="State, LGA"
                                isRequired
                                hierarchy={countries}
                                value={region}
                                onSelected={setRegion}
                            />

                            <div className="border-b border-slate-200"></div>

                            <div className="relative" ref={containerRef}>
                                <div className="relative" ref={addressInputRef}>
                                    <DefaultInput
                                        label="Address"
                                        value={address}
                                        onChange={(val: string) => {
                                            debug("Address input changed:", val);
                                            setIsSelecting(false); // Enable suggestions again when user types
                                            setAddress(val);
                                        }}
                                        placeholder="Street, Building, Apartment No"
                                        required
                                    />
                                    {address && (
                                        <button
                                            onClick={() => { setAddress(""); setSuggestions([]); setShowSuggestions(false); }}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-tighter"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>

                                {mapsError ? (
                                    <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                                        <div className="font-bold mb-1">Google Places debug</div>
                                        <div>{mapsError}</div>
                                    </div>
                                ) : null}

                                {/* Portaled Suggestions - To override modal overflow boundaries */}
                                {typeof document !== 'undefined' && createPortal(
                                    <AnimatePresence>
                                        {showSuggestions && suggestions.length > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                style={{
                                                    position: 'fixed',
                                                    top: inputRect.top + 8,
                                                    left: inputRect.left,
                                                    width: inputRect.width,
                                                    zIndex: 20100
                                                }}
                                                className="bg-white border border-slate-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.18)] max-h-64 overflow-y-auto no-scrollbar py-2 pointer-events-auto"
                                            >
                                                <div className="px-5 pt-2 pb-1 text-[10px] uppercase tracking-widest font-bold text-slate-400">
                                                    Suggestions
                                                </div>

                                                {suggestions.map((p: any) => (
                                                    <button
                                                        key={p.place_id}
                                                        type="button"
                                                        onClick={() => {
                                                            debug("Suggestion selected:", p);
                                                            setAddress(p.description);
                                                            setIsSelecting(true);
                                                            setSuggestions([]);
                                                            setShowSuggestions(false);
                                                        }}
                                                        className="w-full text-left px-5 py-4 hover:bg-slate-50 border-b border-slate-50 last:border-b-0 transition-colors flex flex-col gap-0.5 group"
                                                    >
                                                        <div className="text-sm text-slate-900 font-bold group-hover:text-red-600 transition truncate">
                                                            {p.structured_formatting?.main_text || p.description}
                                                        </div>
                                                        <div className="text-[11px] text-slate-400 truncate font-semibold">
                                                            {p.structured_formatting?.secondary_text || p.description}
                                                        </div>
                                                    </button>
                                                ))}

                                                <div className="p-3 bg-slate-50/30 flex justify-end">
                                                    <img
                                                        src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png"
                                                        alt="Powered by Google"
                                                        className="h-3 opacity-40 grayscale hover:grayscale-0 transition"
                                                    />
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>,
                                    document.body
                                )}
                            </div>

                            <div className="flex items-center justify-between bg-white rounded-2xl border-slate-100">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-800">Set as Default Address</span>
                                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                                        Use for all future orders
                                    </span>
                                </div>
                                <button
                                    onClick={() => setIsDefault(!isDefault)}
                                    className={`w-12 h-6 rounded-full transition-all relative ${isDefault ? "bg-red-500" : "bg-slate-200"
                                        }`}
                                >
                                    <div
                                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isDefault ? "right-1" : "left-1"
                                            }`}
                                    />
                                </button>
                            </div>

                            <div className="border-b border-slate-200"></div>

                            <div className="text-[10px] text-slate-400 leading-relaxed">
                                Open the browser console to see Google Places debug logs.
                            </div>
                        </div>

                        <div className="p-1 border-slate-100 bg-white px-4">
                            <button
                                onClick={handleSave}
                                disabled={isGeocoding}
                                className={`w-full py-3 rounded-full bg-red-600 hover:bg-red-700 text-white font-black text-sm shadow-red-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${isGeocoding ? "opacity-70 cursor-not-allowed" : ""
                                    }`}
                            >
                                {isGeocoding ? (
                                    <>
                                        <svg
                                            className="animate-spin h-4 w-4 text-white"
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                        >
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                            ></circle>
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                            ></path>
                                        </svg>
                                        <span>Verifying Address...</span>
                                    </>
                                ) : (
                                    "Save and Use"
                                )}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

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
                            className="relative bg-white w-full max-w-md rounded-[0.5rem] shadow-2xl p-8 text-center sm:p-10"
                        >
                            <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-500">
                                <FaExclamationTriangle size={36} />
                            </div>
                            <h4 className="text-2xl font-extrabold text-slate-900 mb-4 tracking-tight">
                                Check Delivery Address
                            </h4>
                            <div className="space-y-4 mb-8">
                                <p className="text-slate-600 leading-relaxed text-[15px]">
                                    Courier may be unable to deliver your order as the address provided may be missing the{" "}
                                    <span className="font-bold text-slate-900">building/house number</span>.
                                </p>
                                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-left">
                                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
                                        Provided Address
                                    </p>
                                    <p className="text-sm text-slate-700 font-medium leading-tight">
                                        {(() => {
                                            const parts = region.split(",").map((p) => p.trim());
                                            return arrangeAddressForNigeria(address, parts[2] || "", parts[1] || "");
                                        })()}
                                    </p>
                                </div>
                                <p className="text-sm text-slate-400">Please check if the address provided is correct.</p>
                            </div>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => setShowGeocodeWarning(false)}
                                    className="w-full py-3 rounded-full font-bold bg-slate-900 text-white hover:bg-slate-800 transition shadow-xl shadow-slate-200"
                                >
                                    Edit Address
                                </button>
                                <button
                                    onClick={async () => {
                                        setShowGeocodeWarning(false);
                                        await finalSave(null);
                                    }}
                                    className="w-full py-3 rounded-full font-bold text-slate-500 hover:bg-slate-50 transition border border-transparent hover:border-slate-100 mt-1"
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