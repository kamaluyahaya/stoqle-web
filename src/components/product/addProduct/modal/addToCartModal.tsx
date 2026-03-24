"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { PreviewPayload } from "@/src/types/product";
import { MinusIcon, PlusIcon, XMarkIcon, MapPinIcon, CreditCardIcon, Squares2X2Icon, ListBulletIcon } from "@heroicons/react/24/outline";
import { computeDiscountedPrice, parseNumberLike, parsePercent } from "@/src/lib/utils/product/price";
import { API_BASE_URL } from "@/src/lib/config";
import DeliveryAddressModal from "./deliveryAddressModal";
import DefaultInput from "../../../input/default-input";
import { useAuth } from "@/src/context/authContext";
import { initializePayment, verifyAndCompleteOrder } from "@/src/lib/api/paymentApi";
import { addToCartApi } from "@/src/lib/api/cartApi";
import { fetchMyWallet, walletCheckoutApi } from "@/src/lib/api/walletApi";
import { useWallet } from "@/src/context/walletContext";
import PinVerifyModal from "@/src/components/business/pinVerifyModal";
import PinSetupModal from "@/src/components/business/pinSetupModal";
import { toast } from "sonner";
import Swal from "sweetalert2";
import { estimateDelivery, EstimationResult } from "@/src/lib/deliveryEstimation";
import { fetchUserAddresses } from "@/src/lib/api/addressApi";
import { logUserActivity } from "@/src/lib/api/productApi";

// No need to declare here if we use window.PaystackPop

function formatDuration(value: number | string | undefined | null, unit?: string) {
    if (value == null) return "unknown duration";

    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);

    const u = String(unit ?? "").toLowerCase().trim();

    if (u === "km") return `${n} km`;

    // normalize unit to hours or days
    if (u.startsWith("d")) {
        // value is days
        const days = Math.floor(n);
        const hours = Math.round((n - days) * 24);
        if (hours === 0) return `${days} ${days === 1 ? "day" : "days"}`;
        return `${days} ${days === 1 ? "day" : "days"} ${hours} ${hours === 1 ? "hour" : "hours"}`;
    }

    // treat everything else as hours
    const totalMinutes = Math.round(n * 60);
    if (totalMinutes < 60) return `${totalMinutes} ${totalMinutes === 1 ? "minute" : "minutes"}`;

    const days = Math.floor(totalMinutes / (24 * 60));
    const remainingMinutes = totalMinutes % (24 * 60);
    const hours = Math.floor(remainingMinutes / 60);
    const mins = remainingMinutes % 60;

    let parts = [];
    if (days > 0) parts.push(`${days} ${days === 1 ? "day" : "days"}`);
    if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
    if (mins > 0) parts.push(`${mins} ${mins === 1 ? "minute" : "minutes"}`);

    if (parts.length === 0) return "less than a minute";
    return parts.join(" ");
}

interface AddToCartModalProps {
    open: boolean;
    payload: PreviewPayload | null;
    businessData: any;
    onClose: () => void;
    onConfirm: (data: { selectedOptions: Record<string, string>; quantity: number; sku: any; address?: any; note?: string; paymentMethod?: string }) => void;
    actionType?: "cart" | "buy";
    initialQuantity?: number;
    initialSelectedOptions?: Record<string, string>;
    storedAddress?: any;
    onAddressChange?: (address: any) => void;
    origin?: { x: number; y: number } | null;
}

export default function AddToCartModal({
    open,
    payload,
    businessData,
    onClose,
    onConfirm,
    actionType = "cart",
    initialQuantity = 1,
    initialSelectedOptions = {},
    storedAddress: propStoredAddress,
    onAddressChange,
    origin,
}: AddToCartModalProps) {
    const [currentActionType, setCurrentActionType] = useState(actionType);
    const [quantity, setQuantity] = useState(initialQuantity);
    const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(initialSelectedOptions);
    const [addressModalOpen, setAddressModalOpen] = useState(false);
    const [internalStoredAddress, setInternalStoredAddress] = useState<any>(null);
    const [fullImage, setFullImage] = useState<string | null>(null);
    const [variantViewModes, setVariantViewModes] = useState<Record<string, 'gallery' | 'list'>>({});

    // Sync state if prop changes or when modal is opened
    useEffect(() => {
        if (open) {
            setCurrentActionType(actionType);
        }
    }, [actionType, open]);

    // Automatically set initial view mode for variant groups
    useEffect(() => {
        if (open && payload?.variantGroups) {
            const initialModes: Record<string, "gallery" | "list"> = {};
            const groupCount = payload.variantGroups.length;

            payload.variantGroups.forEach((g) => {
                const groupHasImages = g.entries.some(
                    (ent) => ent.images && ent.images.length > 0
                );

                let shouldBeList = false;
                if (groupCount > 1) {
                    // If multiple groups, use list if it has images and more than 3 variants
                    if (groupHasImages && g.entries.length > 3) {
                        shouldBeList = true;
                    }
                } else {
                    // If only one group, use list automatically if more than 6 variants
                    if (g.entries.length > 6) {
                        shouldBeList = true;
                    }
                }

                initialModes[g.id] = shouldBeList ? "list" : "gallery";
            });
            setVariantViewModes(initialModes);
        }
    }, [open, payload]);

    const switchToBuyMode = () => {
        // Ensure all required variant groups have a selection before switching
        if (payload?.variantGroups && payload.variantGroups.length > 0) {
            for (const group of payload.variantGroups) {
                if (!selectedOptions[group.id]) {
                    toast.error(`Please select ${group.title || "an option"}`);
                    return;
                }
            }
        }
        setCurrentActionType("buy");
    };

    const activeAddress = propStoredAddress !== undefined ? propStoredAddress : internalStoredAddress;

    const [sellerNote, setSellerNote] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("paystack");
    const [isPaying, setIsPaying] = useState(false);

    // Global Wallet Context
    const { wallet, refreshWallet, isLoading: walletLoading } = useWallet();

    const [showPinModal, setShowPinModal] = useState(false);
    const [pinLoading, setPinLoading] = useState(false);
    const [pinError, setPinError] = useState<string | null>(null);
    const [showPinSetup, setShowPinSetup] = useState(false);
    const [estimation, setEstimation] = useState<EstimationResult | null>(null);

    const policy = businessData?.policy ?? null;

    const effectiveReturnPolicy = useMemo(() => {
        if (payload?.policyOverrides && !payload.policyOverrides.useStoreDefaultReturn) {
            const over = payload.policyOverrides.returnPolicy;
            return {
                seven_day_no_reason: (over?.['7dayNoReasonReturn'] || over?.sevenDayNoReasonReturn) ? 1 : 0,
                rapid_refund: over?.rapidRefund ? 1 : 0,
                return_shipping_subsidy: over?.returnShippingSubsidy ? 1 : 0,
                return_window: over?.returnWindow ?? 3
            };
        }
        return policy?.returns ?? {};
    }, [payload?.policyOverrides, policy]);

    const effectiveShippingPolicies = useMemo(() => {
        if (payload?.policyOverrides && !payload.policyOverrides.useStoreDefaultShipping) {
            const over = payload.policyOverrides.shippingPolicy;
            return [
                { kind: "avg", value: over?.avgDuration, unit: over?.avgUnit },
                { kind: "promise", value: over?.promiseDuration, unit: over?.promiseUnit },
                { kind: "delivery_radius_km", value: over?.radiusKm, unit: "km" }
            ];
        }
        return (policy?.shipping || policy?.shipping_duration) ?? [];
    }, [payload?.policyOverrides, policy]);

    const effectivePromotions = useMemo(() => {
        if (payload?.policyOverrides && !payload.policyOverrides.useStoreDefaultPromotions) {
            return payload.policyOverrides.promotions ?? [];
        }
        return policy?.promotions ?? [];
    }, [payload?.policyOverrides, policy]);

    const effectiveSaleDiscounts = useMemo(() => {
        if (payload?.policyOverrides && !payload.policyOverrides.useStoreDefaultPromotions) {
            return payload.policyOverrides.saleDiscount ? [payload.policyOverrides.saleDiscount] : [];
        }
        return policy?.sales_discounts ?? [];
    }, [payload?.policyOverrides, policy]);

    const displayAvgDuration = useMemo(() => {
        if (estimation && !estimation.is_available) return null;
        if (estimation?.is_available && estimation.estimated_delivery_time) {
            const estTime = new Date(estimation.estimated_delivery_time);
            if (estTime.getTime() > 0) {
                const now = new Date();
                const diffMs = estTime.getTime() - now.getTime();
                return `Ships within ${formatDuration(Math.max(0, diffMs / (1000 * 60 * 60)), "hours")}`;
            }
        }
        const shippingAvg = effectiveShippingPolicies.find((s: any) => s.kind === "avg" || s.type === "avg");
        const val = shippingAvg ? formatDuration(shippingAvg.value, shippingAvg.unit) : "8 hours";
        return `Ships within ${val} on average`;
    }, [estimation, effectiveShippingPolicies]);

    const displayPromiseDuration = useMemo(() => {
        if (estimation && !estimation.is_available) return null;
        if (estimation?.is_available && estimation.shipping_deadline) {
            const deadLine = new Date(estimation.shipping_deadline);
            if (deadLine.getTime() > 0) {
                const now = new Date();
                const diffMs = deadLine.getTime() - now.getTime();
                return `Promise to ship within ${formatDuration(Math.max(0, diffMs / (1000 * 60 * 60)), "hours")}`;
            }
        }
        const shippingPromise = effectiveShippingPolicies.find((s: any) => s.kind === "promise" || s.type === "promise");
        const val = shippingPromise ? formatDuration(shippingPromise.value, shippingPromise.unit) : "48 hours";
        return `Promise to ship within ${val}`;
    }, [estimation, effectiveShippingPolicies]);

    const [loading, setLoading] = useState(false);
    const { user, token } = useAuth();
    const router = useRouter();
    const isOwner = useMemo(() => {
        if (!user || !payload) return false;

        // 1. Check User ID match (direct ownership)
        const currentUserId = user.user_id || user.id || user.id_signup;
        const productUserId = payload.userId || (payload as any).user_id || businessData?.business?.user_id;

        if (currentUserId && productUserId && Number(currentUserId) === Number(productUserId)) return true;

        // 2. Check Business ID match (business ownership/staff)
        const currentBizId = user.business_id || user.business?.business_id || user.business?.id;
        const productBizId = payload.businessId || (payload as any).business_id || businessData?.business?.business_id;

        if (currentBizId && productBizId && Number(currentBizId) === Number(productBizId)) return true;

        return false;
    }, [user, payload, businessData]);

    const loadSavedAddress = async () => {
        if (!token) return;
        try {
            const res = await fetchUserAddresses(token);
            const def = res.data.find((a: any) => a.is_default);
            if (def) {
                const mapped = {
                    recipientName: def.full_name,
                    contactNo: def.phone,
                    region: `Nigeria, ${def.state}, ${def.city}`,
                    address: def.address_line1,
                    isDefault: def.is_default,
                    latitude: def.latitude,
                    longitude: def.longitude,
                    address_id: def.address_id
                };
                setInternalStoredAddress(mapped);
                if (onAddressChange && !propStoredAddress) {
                    onAddressChange(mapped);
                }
            }
        } catch (e) {
            console.error("Failed to fetch address from DB", e);
        }
    };

    useEffect(() => {
        if (open && user && token) {
            refreshWallet();
        }
    }, [open, user, token, refreshWallet]);

    // Local fetchWalletBalance removed in favor of useWallet

    useEffect(() => {
        if (open && token) {
            loadSavedAddress();
        }
    }, [open, token]);

    // Load Paystack Script
    useEffect(() => {
        if (open && typeof window !== 'undefined') {
            const scriptUrl = "https://js.paystack.co/v2/inline.js";
            if (!document.querySelector(`script[src="${scriptUrl}"]`)) {
                const script = document.createElement("script");
                script.src = scriptUrl;
                script.async = true;
                script.onload = () => console.log("Paystack script loaded");
                document.body.appendChild(script);
            }
        }
    }, [open]);

    // Reset state when modal opens or product changes
    useEffect(() => {
        if (open && payload) {
            setQuantity(initialQuantity);
            setSelectedOptions(initialSelectedOptions);
            setSellerNote(""); // Reset note when product changes

            // If no valid selection from props, perform auto-selection
            if (Object.keys(initialSelectedOptions).length === 0) {
                const initial: Record<string, string> = {};

                if (payload.useCombinations && payload.skus && payload.skus.length > 0) {
                    // STRICT Priority: Find enabled & in-stock SKUs, then pick the one with MIN price
                    const availableSkus = payload.skus.filter(s => s.enabled && Number(s.quantity || 0) > 0);
                    const candidates = availableSkus.length > 0 ? availableSkus : payload.skus.filter(s => s.enabled);

                    if (candidates.length > 0) {
                        const cheapestSku = candidates.reduce((prev, curr) => {
                            const prevPrice = prev.price !== "" ? Number(prev.price) : Infinity;
                            const currPrice = curr.price !== "" ? Number(curr.price) : Infinity;
                            return currPrice < prevPrice ? curr : prev;
                        }, candidates[0]);

                        payload.variantGroups.forEach(group => {
                            const match = group.entries.find(e => cheapestSku.variantOptionIds.includes(e.id));
                            if (match) initial[group.id] = match.id;
                        });
                    }
                } else {
                    payload.variantGroups.forEach((group) => {
                        if (group.entries && group.entries.length > 0) {
                            const sortedEntries = [...group.entries].sort((a, b) => {
                                const stockA = Number(a.quantity ?? 0);
                                const stockB = Number(b.quantity ?? 0);
                                if (stockA > 0 && stockB <= 0) return -1;
                                if (stockB > 0 && stockA <= 0) return 1;

                                const priceA = a.price !== null && a.price !== undefined ? Number(a.price) : Infinity;
                                const priceB = b.price !== null && b.price !== undefined ? Number(b.price) : Infinity;
                                return priceA - priceB;
                            });
                            initial[group.id] = sortedEntries[0].id;
                        }
                    });
                }
                setSelectedOptions(initial);
            }
        }
    }, [open, payload?.productId, initialQuantity]);

    // Validation for delivery range
    useEffect(() => {
        if (!open || !businessData?.business || !activeAddress) {
            setEstimation(null);
            return;
        }

        const vendorLoc = {
            latitude: Number(businessData.business.latitude),
            longitude: Number(businessData.business.longitude)
        };
        const customerLoc = {
            latitude: Number(activeAddress.latitude),
            longitude: Number(activeAddress.longitude)
        };

        if (isNaN(vendorLoc.latitude) || isNaN(vendorLoc.longitude) || isNaN(customerLoc.latitude) || isNaN(customerLoc.longitude)) {
            setEstimation(null);
            return;
        }

        const policies = effectiveShippingPolicies;
        const result = estimateDelivery(vendorLoc, customerLoc, policies);
        setEstimation(result);
    }, [open, businessData, activeAddress, effectiveShippingPolicies]);

    const currentSku = useMemo(() => {
        if (!payload || !payload.useCombinations || !payload.skus) return null;
        const selectedIds = Object.values(selectedOptions).map(String);
        return payload.skus.find((s) =>
            s.variantOptionIds.every((id) => selectedIds.includes(String(id)))
        );
    }, [payload?.useCombinations, payload?.skus, selectedOptions]);

    const availableStock = useMemo(() => {
        if (!payload) return 0;

        // 1. COMBINATIONS MODE (SKUs)
        if (payload.useCombinations && payload.skus && payload.skus.length > 0) {
            if (currentSku) {
                if (Number(currentSku.price || (payload.samePriceForAll ? payload.sharedPrice : 0) || 0) <= 0) return 0;
                return Number(currentSku.quantity || 0);
            }

            // If not fully selected, calculate potential stock based on current selections
            const selectedIds = Object.values(selectedOptions).map(String);
            if (selectedIds.length === 0) {
                // No selection: Total of all enabled SKUs
                return payload.skus.reduce((acc, s) => s.enabled ? acc + Number(s.quantity || 0) : acc, 0);
            }

            // Partial selection: Sum of SKUs that match selected options and have valid price
            const matchingSkus = payload.skus.filter(s =>
                s.enabled &&
                Number(s.price || (payload.samePriceForAll ? payload.sharedPrice : 0) || 0) > 0 &&
                selectedIds.every(id => s.variantOptionIds.map(String).includes(id))
            );
            return matchingSkus.reduce((acc, s) => acc + Number(s.quantity || 0), 0);
        }

        // 2. SIMPLE VARIANTS MODE (No combinations)
        if (payload.variantGroups && payload.variantGroups.length > 0) {
            let minStock = Infinity;
            let hasStockOnSelection = false;
            let selectionsMade = 0;

            for (const group of payload.variantGroups) {
                const selectedId = selectedOptions[group.id];
                if (selectedId) {
                    selectionsMade++;
                    const entry = group.entries.find(e => e.id === selectedId);
                    if (entry && entry.quantity !== undefined && entry.quantity !== null && entry.quantity !== "") {
                        const entryPrice = Number(entry.price || (payload.samePriceForAll ? payload.sharedPrice : 0) || 0);
                        if (!payload.samePriceForAll && entryPrice <= 0) {
                            minStock = 0;
                        } else {
                            minStock = Math.min(minStock, Number(entry.quantity));
                        }
                        hasStockOnSelection = true;
                    }
                }
            }

            if (hasStockOnSelection) return minStock;

            // If nothing selected yet, return total possible stock (usually sum of the primary variant group)
            if (selectionsMade === 0) {
                // Sum up the first variant group as a representative total
                const firstGroupTotal = payload.variantGroups[0].entries.reduce((acc, e) => acc + Number(e.quantity || 0), 0);
                return firstGroupTotal || Number(payload.quantity || 0);
            }

            // Fallback for selections that don't have explicit variant quantities
            if (Number(payload.price || 0) <= 0 && !payload.samePriceForAll) return 0;
            return Number(payload.quantity || 0);
        }

        // 3. NO VARIANTS MODE
        if (Number(payload.price || 0) <= 0) return 0;
        return Number(payload.quantity || 0);
    }, [payload, currentSku, selectedOptions]);

    const isAllSelected = useMemo(() => {
        if (!payload || !payload.variantGroups || payload.variantGroups.length === 0) return true;
        return payload.variantGroups.every(g => !!selectedOptions[g.id]);
    }, [payload, selectedOptions]);

    // Track available quantity: cap if currently higher than new available stock
    useEffect(() => {
        if (quantity > availableStock && availableStock > 0) {
            setQuantity(availableStock);
        } else if (availableStock === 0 && quantity > 0) {
            // Keep at 1 if everything is somehow 0, but usually disable the button
            // setQuantity(0);
        }
    }, [availableStock, quantity]);

    const basePriceValue = useMemo(() => {
        if (!payload) return null;
        if (
            payload.samePriceForAll &&
            payload.sharedPrice !== null &&
            payload.sharedPrice !== undefined
        ) {
            return Number(payload.sharedPrice);
        }
        if (payload?.useCombinations && currentSku) {
            return currentSku.price !== ""
                ? Number(currentSku.price)
                : parseNumberLike(payload.sharedPrice ?? payload.price ?? null);
        }
        if (!payload.samePriceForAll && payload.variantGroups) {
            for (const group of payload.variantGroups) {
                const selectedId = selectedOptions[group.id];
                if (selectedId) {
                    const entry = group.entries.find((e) => e.id === selectedId);
                    if (
                        entry &&
                        entry.price !== undefined &&
                        entry.price !== null &&
                        String(entry.price) !== ""
                    ) {
                        return Number(entry.price);
                    }
                }
            }
        }
        return parseNumberLike(payload.price ?? null);
    }, [payload, currentSku, selectedOptions]);


    const shippingArray = effectiveShippingPolicies;
    const shippingPromise = shippingArray.find((s: any) => s.kind === "promise" || s.type === "promise") ?? null;

    const formatUrl = (url: string) => {
        if (!url) return "/assets/images/favio.png";
        let formatted = url;
        if (!url.startsWith("http")) {
            formatted = url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
        }
        return encodeURI(formatted);
    };

    const productImg = useMemo(() => {
        if (!payload) return "";
        if (payload.variantGroups) {
            for (const group of payload.variantGroups) {
                const selectedId = selectedOptions[group.id];
                const entry = group.entries.find((e) => e.id === selectedId);
                if (entry?.images && entry.images.length > 0) {
                    return entry.images[0].url || (entry.images[0] as any).imagePreviews?.[0];
                }
            }
        }
        return payload?.productImages?.[0]?.url || "";
    }, [payload, selectedOptions]);

    const activeDiscount = useMemo(() => {
        const now = new Date();
        const promo = effectivePromotions.find((p: any) => {
            const start = (p.start_date || p.start) ? new Date(p.start_date || p.start) : null;
            const end = (p.end_date || p.end) ? new Date(p.end_date || p.end) : null;
            const discValue = Number(p.discount_percent ?? p.discount ?? 0);
            return (discValue > 0) && (!start || now >= start) && (!end || now <= end);
        });
        if (promo) {
            return { 
                percent: Number(promo.discount_percent ?? promo.discount ?? 0), 
                name: promo.title || promo.occasion || "Promotion" 
            };
        }

        const sale = effectiveSaleDiscounts.find((d: any) => Number(d.discount_percent ?? d.discount ?? 0) > 0);
        if (sale) {
            return { 
                percent: Number(sale.discount_percent ?? sale.discount ?? 0), 
                name: (sale as any).title || (sale as any).discount_type || (sale as any).type || "Sales Discount" 
            };
        }

        return { percent: 0, name: "" };
    }, [effectivePromotions, effectiveSaleDiscounts]);

    const activeDiscountPercent = activeDiscount.percent;
    const activeDiscountName = activeDiscount.name;

    const finalUnitPrice = useMemo(() => {
        const base = basePriceValue || 0;
        if (activeDiscountPercent > 0 && activeDiscountPercent < 100) {
            return base * (1 - activeDiscountPercent / 100);
        }
        return base;
    }, [basePriceValue, activeDiscountPercent]);

    const price = finalUnitPrice || 0;
    const originalPrice = basePriceValue || 0;

    const returns = effectiveReturnPolicy;

    const imageRef = React.useRef<HTMLDivElement>(null);

    const animateToCart = () => {
        if (!imageRef.current) return;
        const cartIcon = document.getElementById("cart-icon-ref");
        if (!cartIcon) return;

        const imgRect = imageRef.current.getBoundingClientRect();
        const cartRect = cartIcon.getBoundingClientRect();

        const flyer = document.createElement("div");
        flyer.style.position = "fixed";
        flyer.style.top = `${imgRect.top}px`;
        flyer.style.left = `${imgRect.left}px`;
        flyer.style.width = `${imgRect.width}px`;
        flyer.style.height = `${imgRect.height}px`;
        flyer.style.backgroundImage = `url("${productImg}")`;
        flyer.style.backgroundSize = "cover";
        flyer.style.borderRadius = "16px";
        flyer.style.zIndex = "99999";
        flyer.style.pointerEvents = "none";
        flyer.style.transition = "all 0.8s cubic-bezier(0.42, 0, 0.58, 1)";
        document.body.appendChild(flyer);

        // Force reflow
        flyer.offsetWidth;

        flyer.style.top = `${cartRect.top + 10}px`;
        flyer.style.left = `${cartRect.left + 15}px`;
        flyer.style.width = "20px";
        flyer.style.height = "20px";
        flyer.style.opacity = "0.4";
        flyer.style.transform = "rotate(360deg)";

        setTimeout(() => {
            flyer.remove();
            // Subtle pulse on cart icon
            cartIcon.classList.add("scale-110");
            setTimeout(() => cartIcon.classList.remove("scale-110"), 200);
        }, 800);
    };

    const handlePinSubmit = async (pin: string) => {
        setPinLoading(true);
        setPinError(null);
        try {
            const amount = price * quantity;
            const metadata = {
                product_id: Number(payload?.productId || (payload as any)?.id || (payload as any)?.product_id),
                quantity,
                sku_id: currentSku ? Number(currentSku.id) : null,
                sku_price: currentSku ? Number(currentSku.price) : null,
                variant_option_ids: Object.values(selectedOptions).map(Number),
                selectedOptions,
                address: activeAddress,
                note: sellerNote,
                business_id: Number(payload?.businessId || (payload as any)?.business_id),
                product_image: productImg,
                customer_account_name: user?.full_name || user?.fullName || `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || user?.username,
                customer_account_email: user?.email,
                customer_account_phone: user?.phone_no || user?.phone || user?.contactNo,
                type: "direct_buy"
            };

            const res = await walletCheckoutApi({
                amount: amount,
                pin,
                metadata,
                email: user?.email ?? undefined
            });

            if (res.status === 'success' || res.success) {
                setShowPinModal(false);
                refreshWallet();
                toast.success("Order placed successfully!");
                onClose();
                logUserActivity({ product_id: payload?.productId, action_type: 'purchase', category: payload?.category }, token);

                Swal.fire({
                    title: "Order Placed Successfully!",
                    text: "Your order has been confirmed using your Stoqle wallet. You can track it in your profile.",
                    icon: "success",
                    showCancelButton: true,
                    confirmButtonText: "View Orders",
                    cancelButtonText: "Close",
                    confirmButtonColor: "#f43f5e", // rose-500
                    cancelButtonColor: "#94a3b8", // slate-400
                    customClass: {
                        popup: "rounded-[2rem]",
                        confirmButton: "rounded-xl font-bold px-6 py-3",
                        cancelButton: "rounded-xl font-bold px-6 py-3"
                    }
                }).then((result) => {
                    if (result.isConfirmed) {
                        router.push("/profile/orders");
                    }
                });
            } else {
                setPinError(res.message || "Incorrect PIN");
            }
        } catch (error: any) {
            setPinError(error?.body?.message || error?.message || "Payment failed");
        } finally {
            setPinLoading(false);
        }
    };

    const handleConfirmClick = async () => {
        if (!payload) return;

        // Check internet connection
        if (!navigator.onLine) {
            Swal.fire({
                title: "No Internet Connection",
                text: "Please connect to the internet to proceed with your payment.",
                icon: "warning",
                confirmButtonText: "OK",
                confirmButtonColor: "#f43f5e", // rose-500
                customClass: {
                    popup: "rounded-[2rem]",
                    confirmButton: "rounded-xl font-bold px-6 py-3",
                }
            });
            return;
        }

        // Restriction: Owner cannot buy their own product
        if (isOwner) {
            Swal.fire({
                title: "Not Allowed",
                text: "You cannot purchase your own products.",
                icon: "warning",
                confirmButtonText: "I understand",
                confirmButtonColor: "#f43f5e",
                customClass: {
                    popup: "rounded-[2rem]",
                    confirmButton: "rounded-xl font-bold px-6 py-3",
                }
            });
            return;
        }

        // Check if out of stock
        if (isAllSelected && availableStock <= 0) {
            toast.error("This product is currently out of stock.");
            return;
        }

        // Ensure all required variant groups have a selection
        if (payload.variantGroups && payload.variantGroups.length > 0) {
            for (const group of payload.variantGroups) {
                if (!selectedOptions[group.id]) {
                    toast.error(`Please select ${group.title || "an option"}`);
                    return;
                }
            }
        }

        if (currentActionType === "buy") {
            if (!activeAddress || !activeAddress.latitude) {
                setAddressModalOpen(true);
                return;
            }

            if (estimation && !estimation.is_available) {
                toast.error(estimation.message || "Vendor does not deliver to your location.");
                return;
            }

            if (paymentMethod === "paystack") {
                if (!user?.email) {
                    toast.error("Please login to proceed with payment");
                    return;
                }

                try {
                    setIsPaying(true);
                    const amount = price * quantity;
                    const res = await initializePayment({
                        email: user.email,
                        amount: amount,
                        metadata: {
                            product_id: payload.productId,
                            quantity,
                            sku_id: currentSku ? Number(currentSku.id) : null,
                            sku_price: currentSku ? Number(currentSku.price) : null,
                            variant_option_ids: Object.values(selectedOptions).map(Number),
                            selectedOptions, // legacy
                            address: activeAddress,
                            note: sellerNote,
                            business_id: payload.businessId,
                            product_image: productImg,
                            customer_account_name: user?.full_name || user?.fullName || `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || user?.username,
                            customer_account_email: user?.email,
                            customer_account_phone: user?.phone_no || user?.phone || user?.contactNo
                        }
                    });

                    if (res.status && res.data.access_code) {
                        const PaystackPop = (window as any).PaystackPop;
                        if (!PaystackPop) {
                            toast.error("Payment system is still loading. Please try again in a moment.");
                            setIsPaying(false);
                            return;
                        }

                        const paystack = new PaystackPop();
                        paystack.resumeTransaction(res.data.access_code, {
                            onSuccess: async (response: any) => {
                                setIsPaying(true);
                                try {
                                    const completeRes = await verifyAndCompleteOrder(response.reference);
                                    if (completeRes.status) {
                                        toast.success("Order placed successfully!");
                                        onClose(); // Close the modal
                                        logUserActivity({ product_id: payload.productId, action_type: 'purchase', category: payload.category }, token);

                                        Swal.fire({
                                            title: "Order Placed Successfully!",
                                            text: "Your order has been confirmed. You can track it in your profile.",
                                            icon: "success",
                                            showCancelButton: true,
                                            confirmButtonText: "View Orders",
                                            cancelButtonText: "Close",
                                            confirmButtonColor: "#f43f5e", // rose-500
                                            cancelButtonColor: "#94a3b8", // slate-400
                                            customClass: {
                                                popup: "rounded-[2rem]",
                                                confirmButton: "rounded-xl font-bold px-6 py-3",
                                                cancelButton: "rounded-xl font-bold px-6 py-3"
                                            }
                                        }).then((result) => {
                                            if (result.isConfirmed) {
                                                router.push("/profile/orders");
                                            }
                                        });
                                    }
                                } catch (e) {
                                    console.error("Order completion error", e);
                                    toast.error("Failed to complete order logic. Please contact support.");
                                } finally {
                                    setIsPaying(false);
                                }
                            },
                            onCancel: () => {
                                toast("Payment cancelled");
                            }
                        });
                    } else {
                        toast.error("Failed to initialize payment modal. Please try again.");
                    }
                } catch (err) {
                    console.error("Payment error", err);
                    toast.error("Payment initialization failed");
                } finally {
                    setIsPaying(false);
                }
            } else if (paymentMethod === "stoqle_pay") {
                const amount = price * quantity;
                const availableBalance = wallet?.available_balance ?? 0;
                if (availableBalance < amount) {
                    toast.error(`Insufficient StoqlePay balance. Your balance: ₦${availableBalance.toLocaleString()}`);
                    return;
                }
                if (!wallet?.has_pin) {
                    setShowPinSetup(true);
                    return;
                }

                setShowPinModal(true);
            } else {
                // Other methods
                onConfirm({
                    selectedOptions,
                    quantity,
                    sku: currentSku,
                    address: activeAddress,
                    note: sellerNote,
                    paymentMethod
                });
            }
        } else {
            // "Cart" mode: Persist to DB
            if (!user || !token) {
                toast.error("Please login to add items to cart");
                return;
            }

            try {
                setIsPaying(true); // Using isPaying as a generic loading state for simplicity
                const cartData: any = {
                    product_id: Number(payload.productId),
                    quantity: quantity,
                };

                if (payload.useCombinations && currentSku) {
                    cartData.sku_id = Number(currentSku.id);
                } else if (Object.keys(selectedOptions).length > 0) {
                    cartData.variant_option_ids = Object.values(selectedOptions);
                }

                await addToCartApi(cartData, token);
                animateToCart();
                window.dispatchEvent(new CustomEvent("cart-updated"));

                // Sync across tabs
                const channel = new BroadcastChannel('stoqle_cart_sync');
                channel.postMessage('update');
                channel.close();

                toast.success("Added to cart successfully!");
                onConfirm({ selectedOptions, quantity, sku: currentSku });
                logUserActivity({ product_id: payload.productId, action_type: 'cart', category: payload.category }, token);
                // We don't onClose immediately to let the animation finish if desired, 
                // but usually onClose is fine if the animation is on document.body
                setTimeout(() => onClose(), 600);
            } catch (err: any) {
                console.error("Add to cart error", err);
                toast.error(err?.body?.message || "Failed to add to cart");
            } finally {
                setIsPaying(false);
            }
        }
    };

    const handleAddressSave = (addressData: any) => {
        setAddressModalOpen(false);
        setInternalStoredAddress(addressData);
        if (onAddressChange) {
            onAddressChange(addressData);
        }
    };

    return (
        <AnimatePresence>
            {open && payload && (
                <div
                    key="add-to-cart-container"
                    className="fixed inset-0 z-[20000] flex items-end sm:items-center justify-center p-0 outline-none"
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

                    <PinVerifyModal
                        isOpen={showPinModal}
                        isLoading={pinLoading}
                        errorMessage={pinError}
                        onClose={() => setShowPinModal(false)}
                        onSuccess={handlePinSubmit}
                        title="Authorize StoqlePay"
                        description={`Please enter your 4-digit PIN to authorize the payment of ₦${(price * quantity).toLocaleString()} from your Stoqle wallet.`}
                    />
                    <PinSetupModal
                        isOpen={showPinSetup}
                        onClose={() => setShowPinSetup(false)}
                        onSuccess={() => {
                            refreshWallet();
                            setShowPinSetup(false);
                            setShowPinModal(true);
                        }}
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.3 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.3 }}
                        transition={{ type: "spring", damping: 30, stiffness: 300 }}
                        style={{
                            transformOrigin: origin ? `${origin.x}px ${origin.y}px` : "center"
                        }}
                        className={`relative w-full max-w-lg bg-white rounded-t-[0.5rem] sm:rounded-[0.5rem] shadow-2xl z-10 ${currentActionType === 'buy' ? 'h-full' : 'h-[80vh]'} sm:h-auto max-h-[90vh] flex flex-col overflow-hidden`}
                    >
                        {/* Header with Image, Price and Quantity Selector Together */}
                        <div className="bg-emerald-100/40">
                            {returns?.return_shipping_subsidy === 1 && returns?.seven_day_no_reason === 1 && returns?.rapid_refund === 1 ? (
                                <div className="items-center gap-1 p-2 text-center text-[12px] font-bold text-emerald-700">
                                    Return shipping subsidy | 7Days no reason return | Rapid Refund
                                </div>
                            ) : returns?.return_shipping_subsidy === 1 && returns?.seven_day_no_reason === 1 ? (
                                <div className="items-center gap-1 p-2 text-center text-[12px] font-bold text-emerald-700">
                                    Return shipping subsidy | 7Days no reason return
                                </div>
                            ) : returns?.return_shipping_subsidy === 1 && returns?.rapid_refund === 1 ? (
                                <div className="items-center gap-1 p-2 text-center text-[12px] font-bold text-emerald-700">
                                    Return shipping subsidy | Rapid Refund
                                </div>
                            ) : returns?.seven_day_no_reason === 1 && returns?.rapid_refund === 1 ? (
                                <div className="items-center gap-1 p-2 text-center text-[12px] font-bold text-emerald-700">
                                    7Days no reason return | Rapid Refund
                                </div>
                            ) : returns?.return_shipping_subsidy === 1 ? (
                                <div className="items-center gap-1 p-2 text-center text-[12px] font-bold text-emerald-700">
                                    Return shipping subsidy
                                </div>
                            ) : returns?.seven_day_no_reason === 1 ? (
                                <div className="items-center gap-1 p-2 text-center text-[12px] font-bold text-emerald-700">
                                    Vendor support 7Days no reason return
                                </div>
                            ) : returns?.rapid_refund === 1 ? (
                                <div className="items-center gap-1 p-2 text-center text-[12px] font-bold text-emerald-700">
                                    Rapid Refund
                                </div>
                            ) : (
                                <div className="items-center gap-1 p-2 px-5 text-center text-[11px] font-bold text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">
                                    Product does not support 7days no reason return, no return shipping subsidy, no rapid refund
                                </div>
                            )}

                            {currentActionType === "buy" && (
                                <div className="border-t border-emerald-200/50 p-2.5 px-5 bg-white flex items-center justify-between">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <MapPinIcon className="w-4 h-4 text-slate-400 shrink-0" />
                                        {activeAddress ? (
                                            <div className="text-[11px] text-slate-600 truncate">
                                                Delivering to <span className="font-bold text-slate-800">{activeAddress.recipientName}</span>,
                                                at <span className="font-bold text-slate-800">{activeAddress.address} {activeAddress.region}</span>,
                                                <span className="text-slate-500 ml-1">{activeAddress.contactNo}</span>
                                            </div>
                                        ) : (
                                            <div className="text-[11px] text-slate-500 italic">
                                                Please fill the address first for product
                                            </div>
                                        )}
                                    </div>
                                    {estimation && !estimation.is_available && (
                                        <div className="text-[10px] text-red-600 font-bold px-5 py-1 bg-red-50 border-t border-red-100 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                                            {estimation.message}
                                        </div>
                                    )}
                                    <button
                                        onClick={() => setAddressModalOpen(true)}
                                        className="text-[11px] font-black text-red-500 hover:text-red-600 shrink-0 ml-4 underline underline-offset-2"
                                    >
                                        {activeAddress ? "Change" : "Add Address"}
                                    </button>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="absolute top-1 right-4 p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                        <div className="p-5 flex items-start gap-4 border-b border-slate-100 relative">
                            <div
                                ref={imageRef}
                                className="w-24 h-24 rounded-lg overflow-hidden bg-slate-50 border border-slate-100 flex-shrink-0 relative group cursor-zoom-in"
                                onClick={() => setFullImage(productImg)}
                            >
                                <img
                                    src={productImg}
                                    alt={payload.title}
                                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                />
                                <div className="absolute top-1 right-1 p-1 bg-black/40 text-white rounded-md opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                                    </svg>
                                </div>
                            </div>
                            <div className="flex-1 min-w-0 pr-6">
                                <div className="flex flex-col">
                                    <div className="lg:text-2xl sm:text-xl font-bold text-red-600">
                                        ₦{(price * quantity).toLocaleString()}
                                    </div>
                                    {quantity > 1 && (
                                        <div className="text-[10px] font-bold text-slate-400">
                                            ₦ {price.toLocaleString()} / piece
                                        </div>
                                    )}
                                </div>


                            </div>

                            {/* Integrated Quantity Selector */}
                            <div className="mt-1 flex items-center gap-3">
                                <div className="flex items-center bg-slate-100/80 rounded-full px-1 py-1 border border-slate-200 shadow-sm">
                                    <button
                                        onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                        disabled={quantity <= 1}
                                        className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm hover:bg-slate-50 disabled:opacity-50 transition"
                                    >
                                        <MinusIcon className="w-3.5 h-3.5 text-slate-700 stroke-[3]" />
                                    </button>
                                    <span className="text-sm font-black w-10 text-center text-slate-800">{quantity}</span>
                                    <button
                                        onClick={() => setQuantity(q => Math.min(availableStock, q + 1))}
                                        disabled={quantity >= availableStock}
                                        className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm hover:bg-slate-50 disabled:opacity-50 transition"
                                    >
                                        <PlusIcon className="w-3.5 h-3.5 text-slate-700 stroke-[3]" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Variant Groups (Scrollable Content) */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-8">
                            {payload.variantGroups.map((g, idx) => {
                                const groupHasImages = g.entries.some(
                                    (ent) => ent.images && ent.images.length > 0
                                );
                                const viewMode = variantViewModes[g.id] || 'gallery';

                                return (
                                    <div key={g.id || `group-${idx}`} className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="text-xs   tracking-widest text-slate-900 flex items-center gap-2">
                                                {g.title || "Choose Option"}
                                            </div>

                                            {groupHasImages && (
                                                <button
                                                    onClick={() => setVariantViewModes(prev => ({ ...prev, [g.id]: viewMode === 'gallery' ? 'list' : 'gallery' }))}
                                                    className="text-[13px]  tracking-tight text-slate-500 hover:text-red-600 bg-white px-2.5 py-1 rounded-full  transition-all flex items-center gap-1 active:scale-95"
                                                >
                                                    {viewMode === 'gallery' ? (
                                                        <>
                                                            <ListBulletIcon className="w-3.5 h-3.5" />
                                                            <span>List view</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Squares2X2Icon className="w-3.5 h-3.5" />
                                                            <span>Gallery view</span>
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>

                                        <div
                                            className={
                                                groupHasImages
                                                    ? (viewMode === 'gallery' ? "grid grid-cols-3 gap-2.5" : "flex flex-wrap gap-2")
                                                    : "flex flex-wrap gap-2.5"
                                            }
                                        >
                                            {g.entries.map((e, idx) => {
                                                const hasImage =
                                                    e.images &&
                                                    e.images.length > 0 &&
                                                    (e.images[0].url || (e.images[0] as any).imagePreviews?.[0]);
                                                const productFallbackUrl = payload.productImages?.[0]?.url;

                                                const isSelected = selectedOptions[g.id] === e.id;

                                                // Stock logic for individual buttons
                                                let stock = Number(e.quantity ?? 0);
                                                if (payload.useCombinations) {
                                                    const otherSelectedIds = Object.entries(selectedOptions)
                                                        .filter(([gid]) => gid !== g.id)
                                                        .map(([, id]) => id);

                                                    const matchingSkus = payload.skus?.filter(
                                                        (sku) =>
                                                            sku.enabled &&
                                                            Number(sku.price || (payload.samePriceForAll ? payload.sharedPrice : 0) || 0) > 0 &&
                                                            sku.variantOptionIds.includes(e.id) &&
                                                            otherSelectedIds.every((oid) => sku.variantOptionIds.includes(oid))
                                                    ) || [];

                                                    stock = matchingSkus.reduce(
                                                        (acc, s) => acc + Number(s.quantity || 0),
                                                        0
                                                    );
                                                }

                                                const isPriceInvalid = !payload.useCombinations && !payload.samePriceForAll && Number(e.price || 0) <= 0;
                                                const isOutOfStock = stock <= 0 || isPriceInvalid;

                                                if (groupHasImages) {
                                                    const displayUrl = hasImage
                                                        ? e.images![0].url || (e.images![0] as any).imagePreviews?.[0]
                                                        : productFallbackUrl;

                                                    if (viewMode === 'list') {
                                                        return (
                                                            <button
                                                                key={`list-opt-${e.id || idx}`}
                                                                onClick={() => {
                                                                    setSelectedOptions((prev) => {
                                                                        if (prev[g.id] === e.id) {
                                                                            const next = { ...prev };
                                                                            delete next[g.id];
                                                                            return next;
                                                                        }
                                                                        return { ...prev, [g.id]: e.id };
                                                                    });
                                                                }}
                                                                className={`group relative flex items-center gap-2 px-1 py-1 rounded-lg border-[0.5px] transition-all text-left min-h-[36px] ${isSelected
                                                                    ? "border-red-500 bg-red-50 shadow-sm"
                                                                    : "border-white bg-slate-100 hover:border-slate-200"
                                                                    } ${isOutOfStock ? "opacity-30 grayscale cursor-allowed" : "cursor-pointer"}`}
                                                            >
                                                                <div className="w-7 h-7 rounded-sm overflow-hidden bg-slate-100 flex-shrink-0 relative group/img">
                                                                    {displayUrl ? (
                                                                        <img src={displayUrl} alt={e.name} className="w-full h-full object-cover transition-transform group-hover/btn:scale-105" />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                            </svg>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className="flex-1 flex items-center justify-between min-w-0 pr-1.5">
                                                                    <div className="text-[10px] text-red-500 font-semibold whitespace-nowrap overflow-hidden text-ellipsis">{e.name}</div>
                                                                </div>

                                                                {stock <= 3 && !isOutOfStock && (
                                                                    <div className="absolute -top-1.5 right-1 z-30 bg-white text-[6px] text-red-500 px-1 font-semibold rounded-[2px] border-[0.5px] shadow-sm ring-1 ring-white">
                                                                        {stock} left
                                                                    </div>
                                                                )}


                                                            </button>
                                                        );
                                                    }

                                                    return (
                                                        <button
                                                            key={`img-opt-${e.id || idx}`}
                                                            onClick={() => {
                                                                setSelectedOptions((prev) => {
                                                                    if (prev[g.id] === e.id) {
                                                                        const next = { ...prev };
                                                                        delete next[g.id];
                                                                        return next;
                                                                    }
                                                                    return { ...prev, [g.id]: e.id };
                                                                });
                                                            }}
                                                            className={`relative flex flex-col p-1.5 rounded-xl bg-red-100/50 border transition-all text-left group/btn ${isSelected
                                                                ? "border-red-500 bg-red-50/30 text-red-500"
                                                                : "border-white bg-slate-100 hover:border-slate-200"
                                                                } ${isOutOfStock ? "opacity-40 grayscale cursor-pointer" : "cursor-pointer"
                                                                }`}
                                                        >
                                                            {/* STOCK FLAG */}
                                                            {!isOutOfStock && stock <= 3 && (
                                                                <div className="absolute -top-1.5 -right-1 z-30 bg-white text-[8px] text-red-500 border-[0.5px] px-1.5 py-0.5 rounded-sm font-black  ring-1 ring-white">
                                                                    {stock} left
                                                                </div>
                                                            )}

                                                            {isOutOfStock && (
                                                                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 rounded-xl">
                                                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter shadow-sm bg-white/90 px-1 py-0.5 rounded border border-slate-200">
                                                                        Sold Out
                                                                    </span>
                                                                </div>
                                                            )}

                                                            {displayUrl ? (
                                                                <div
                                                                    className="w-full aspect-square rounded-lg overflow-hidden mb-1.5 bg-slate-50 border border-slate-100 relative group/img"
                                                                >
                                                                    <img
                                                                        src={displayUrl}
                                                                        alt={e.name}
                                                                        className="w-full h-full object-cover group-hover/btn:scale-105 transition-transform"
                                                                    />
                                                                    <div
                                                                        onClick={(ev) => { ev.stopPropagation(); setFullImage(displayUrl); }}
                                                                        className="absolute top-1 right-1 p-1 bg-black/40 hover:bg-black/60 text-white rounded-md z-20 opacity-100 sm:opacity-0 sm:group-hover/img:opacity-100 transition-opacity cursor-zoom-in"
                                                                        title="View full screen"
                                                                    >
                                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                                                                        </svg>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="w-full aspect-square rounded-lg overflow-hidden mb-1.5 bg-slate-100 flex items-center justify-center text-slate-300">
                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                    </svg>
                                                                </div>
                                                            )}
                                                            <div className="text-[10px] font-bold text-red-500 line-clamp-1 px-0.5 text-center w-full">
                                                                {e.name}
                                                            </div>
                                                        </button>
                                                    );
                                                } else {
                                                    return (
                                                        <button
                                                            key={`txt-opt-${e.id || idx}`}
                                                            onClick={() => {
                                                                setSelectedOptions((prev) => {
                                                                    if (prev[g.id] === e.id) {
                                                                        const next = { ...prev };
                                                                        delete next[g.id];
                                                                        return next;
                                                                    }
                                                                    return { ...prev, [g.id]: e.id };
                                                                });
                                                            }}
                                                            className={`relative px-4 py-2 rounded-lg border-[0.5px] text-[11px] font-black transition-all  flex items-center gap-2 ${isSelected
                                                                ? "border-red-500 bg-red-50 text-red-600 shadow-red-100"
                                                                : "border-white bg-slate-100 text-slate-700 hover:border-slate-200"
                                                                } ${isOutOfStock ? "opacity-30 line-through cursor-pointer" : "cursor-pointer"
                                                                }`}
                                                        >
                                                            {/* STOCK FLAG FOR TEXT BUTTONS */}
                                                            {!isOutOfStock && stock <= 3 && (
                                                                <div className="absolute -top-2 -right-1 z-30 text-[7px] text-red-500 px-2 rounded-sm font-semibold bg-white border-[0.5px] ring-1 ring-white">
                                                                    {stock} left
                                                                </div>
                                                            )}
                                                            <span>{e.name}</span>
                                                        </button>
                                                    );
                                                }
                                            })}
                                        </div>
                                    </div>
                                );
                            })}



                            {/* Checkout Specifics */}
                            {currentActionType === "buy" && (

                                <div className="space-y-6 mt-4">
                                    {/* Seller Note */}
                                    <div className="space-y-3">

                                        <DefaultInput
                                            label="Note"
                                            value={sellerNote}
                                            onChange={setSellerNote}
                                            placeholder="Note optional (seller confirm)"
                                        />
                                    </div>
                                    {/* Integrated Price Summary moved from footer to scrollable area */}
                                    <div className="space-y-2.5 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-500 font-medium">Subtotal</span>
                                            <span className="text-slate-900 font-bold">₦{(originalPrice * quantity).toLocaleString()}</span>
                                        </div>

                                        {activeDiscountPercent > 0 && (
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-slate-600 font-medium">{activeDiscountName}</span>
                                                <span className="text-red-500 font-bold">-₦{((originalPrice - price) * quantity).toLocaleString()}</span>
                                            </div>
                                        )}

                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-500 font-medium">Shipping Fee</span>
                                            <span className="text-emerald-600 font-bold uppercase tracking-wider">Free</span>
                                        </div>

                                        {/* Total Savings */}
                                        {activeDiscountPercent > 0 && (
                                            <div className="flex justify-between items-center text-xs text-rose-600 font-black pt-1 border-t border-rose-100/50">
                                                <span>Total Savings</span>
                                                <span>-₦{((originalPrice - price) * quantity).toLocaleString()}</span>
                                            </div>
                                        )}
                                    </div>



                                    {/* Payment Method */}
                                    <div className="space-y-3">
                                        <div className="text-xs font-black  tracking-widest text-slate-800 flex items-center gap-2">
                                            <div className="w-1 h-3 bg-red-500 rounded-full" />
                                            Payment Method
                                        </div>
                                        <div className="space-y-3">
                                            {[
                                                { id: "paystack", label: "Paystack Payment", sub: "Card, Transfer, USSD", icon: "/assets/images/paystack.png" },
                                                {
                                                    id: "stoqle_pay",
                                                    label: "StoqlePay Wallet",
                                                    sub: walletLoading ? "Fetching balance..." : (wallet !== null ? `Balance: ₦${(wallet.available_balance ?? 0).toLocaleString()}` : "Fast in-app payment"),
                                                    icon: "/assets/images/logo.png",
                                                    insufficient: wallet !== null && (wallet.available_balance ?? 0) < (price * quantity)
                                                }
                                            ].map((pm) => (
                                                <button
                                                    key={pm.id}
                                                    onClick={() => setPaymentMethod(pm.id)}
                                                    className={`w-full flex items-center justify-between p-4 rounded-2xl  transition-all text-left ${paymentMethod === pm.id
                                                        ? "border-red-500 bg-red-50/30"
                                                        : "border-slate-100 bg-white hover:border-slate-200"
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative w-10 h-10 rounded-xl bg-white p-2 flex items-center justify-center shrink-0 ">
                                                            <img src={pm.icon} alt={pm.label} className="w-full h-full object-contain" />
                                                            {pm.id === 'stoqle_pay' && pm.insufficient && (
                                                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[8px] text-white font-bold">!</div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm text-slate-800 flex items-center gap-2">
                                                                {pm.label}
                                                                {pm.id === 'stoqle_pay' && pm.insufficient && (
                                                                    <span className="text-[10px] text-red-500 font-bold bg-red-50 px-1.5 py-0.5 rounded-full border border-red-100">Insufficient</span>
                                                                )}
                                                            </div>
                                                            <div className={`text-[10px] ${pm.id === 'stoqle_pay' && pm.insufficient ? 'text-red-400 font-bold' : 'text-slate-500'}`}>{pm.sub}</div>
                                                        </div>
                                                    </div>
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === pm.id ? "border-red-500 bg-red-500" : "border-slate-200"}`}>
                                                        {paymentMethod === pm.id && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>

                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-3 border-t border-slate-100 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">


                            <div className="mb-2">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                                    {/* <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> */}
                                    {displayAvgDuration && (
                                        <span className="text-[10px] text-emerald-600 truncate w-full text-center">
                                            {displayAvgDuration} | <span className="text-slate-400">Promise to ship within {shippingPromise ? formatDuration(shippingPromise.value, shippingPromise.unit) : "48 hours"}</span>

                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className={`flex items-center gap-4 ${currentActionType === 'buy' ? 'justify-between' : ''}`}>
                                {currentActionType === 'buy' ? (
                                    <>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black  tracking-widest text-slate-400 leading-none mb-1">Total</span>
                                            <span className="text-lg font-black text-red-600 leading-none">₦{(price * quantity).toLocaleString()}</span>
                                        </div>

                                        {/* <div className="flex-1 flex flex-col items-center justify-center min-w-0 px-2">

                                            {displayPromiseDuration && (
                                                <span className="text-[8px] font-medium text-slate-400 truncate w-full text-center mt-0.5">
                                                    Delayed compensation guanrantee
                                                </span>
                                            )}
                                        </div> */}

                                        <button
                                            onClick={handleConfirmClick}
                                            disabled={isPaying || isOwner || (estimation !== null && !estimation.is_available) || (paymentMethod === 'stoqle_pay' && wallet !== null && (wallet.available_balance ?? 0) < (price * quantity))}
                                            className="flex-1 max-w-[220px] py-3 bg-gradient-to-r from-red-600 to-rose-600 text-white font-black rounded-full shadow-xl shadow-red-100 hover:shadow-red-200 transition-all active:scale-[0.98] disabled:grayscale disabled:opacity-50 disabled:cursor-not-allowed text-xs tracking-widest"
                                        >
                                            {isPaying ? "Processing..." : (isOwner ? "Owning this product" : (isAllSelected && availableStock <= 0 ? "Out of Stock" : (estimation && !estimation.is_available ? "Out of Delivery Range" : "Pay Now")))}
                                        </button>
                                    </>
                                ) : (

                                    <div className="ml-auto flex flex-1 overflow-hidden rounded-full bg-white">
                                        {isOwner ? (
                                            <div className="flex-1 py-2 text-center text-xs font-bold text-slate-400 bg-slate-50 italic">
                                                Owning this product
                                            </div>
                                        ) : (
                                            <>
                                                <button onClick={handleConfirmClick} disabled={isPaying || isOwner || (estimation !== null && !estimation.is_available) || (paymentMethod === 'stoqle_pay' && wallet !== null && (wallet.available_balance ?? 0) < (price * quantity))}
                                                    className={`flex-1 py-1.5 text-[11px] font-bold  bg-red-50 hover:bg-red-100 transition ${isAllSelected && availableStock <= 0 ? "text-slate-500" : "text-red-500"}`}>{isPaying ? "Adding..." : (isOwner ? "Owning this product" : (isAllSelected && availableStock <= 0 ? "Out of Stock" : `Add to cart`))}</button>
                                                <button onClick={switchToBuyMode} disabled={isPaying || isOwner}
                                                    className="flex-1 py-1.5 text-[11px] font-bold text-white bg-red-600 hover:bg-red-500 transition">Buy now</button>
                                            </>
                                        )}
                                    </div>

                                    // <button
                                    //     onClick={handleConfirmClick}

                                    //     className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl shadow-xl shadow-red-100 transition-all active:scale-[0.98] disabled:grayscale disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                    // >
                                    //     {isPaying ? "Adding..." : (isOwner ? "Owning this product" : (isAllSelected && availableStock <= 0 ? "Out of Stock" : `Confirm · ₦ ${(price * quantity).toLocaleString()}`))}
                                    // </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

            <DeliveryAddressModal
                key="delivery-address-modal"
                open={addressModalOpen}
                onClose={() => setAddressModalOpen(false)}
                onSave={handleAddressSave}
                initialData={activeAddress}
            />

            {/* Full Screen Image Overlay */}
            <AnimatePresence>
                {fullImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[22000] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm"
                        onClick={() => setFullImage(null)}
                    >
                        <button
                            onClick={() => setFullImage(null)}
                            className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-50 backdrop-blur-md"
                        >
                            <XMarkIcon className="w-7 h-7" />
                        </button>

                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="relative w-full h-full flex items-center justify-center"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img
                                src={fullImage}
                                alt="Full screen preview"
                                className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </AnimatePresence>
    );
}
