"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PreviewPayload } from "@/src/types/product";
import { MinusIcon, PlusIcon, XMarkIcon, MapPinIcon, CreditCardIcon } from "@heroicons/react/24/outline";
import { computeDiscountedPrice, parseNumberLike, parsePercent } from "@/src/lib/utils/product/price";
import { API_BASE_URL } from "@/src/lib/config";
import DeliveryAddressModal from "./deliveryAddressModal";
import DefaultInput from "../../../input/default-input";
import { useAuth } from "@/src/context/authContext";
import { initializePayment, verifyAndCompleteOrder } from "@/src/lib/api/paymentApi";
import { addToCartApi } from "@/src/lib/api/cartApi";
import { toast } from "sonner";
import Swal from "sweetalert2";

// No need to declare here if we use window.PaystackPop


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
}: AddToCartModalProps) {
    const [quantity, setQuantity] = useState(initialQuantity);
    const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(initialSelectedOptions);
    const [addressModalOpen, setAddressModalOpen] = useState(false);
    const [internalStoredAddress, setInternalStoredAddress] = useState<any>(null);

    // Sync with prop if provided, otherwise use internal
    const activeAddress = propStoredAddress !== undefined ? propStoredAddress : internalStoredAddress;

    const [sellerNote, setSellerNote] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("paystack");
    const [isPaying, setIsPaying] = useState(false);
    const { user, token } = useAuth();
    const router = useRouter();
    const currentUserBizId = user?.business_id || (user as any)?.business?.business_id;
    const isOwner = currentUserBizId && payload?.businessId && Number(currentUserBizId) === Number(payload.businessId);

    const loadSavedAddress = () => {
        const saved = localStorage.getItem("stoqle_delivery_address");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setInternalStoredAddress(parsed);
                if (onAddressChange && !propStoredAddress) {
                    onAddressChange(parsed);
                }
            } catch (e) {
                console.error("Failed to parse saved address", e);
            }
        }
    };

    useEffect(() => {
        if (open) {
            loadSavedAddress();
        }
    }, [open]);

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

    const policy = businessData?.policy ?? null;
    const shippingArray = Array.isArray(policy?.shipping) ? policy.shipping : Array.isArray(policy?.shipping_duration) ? policy.shipping_duration : [];
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

    const formatDuration = (value: number | string | undefined | null, unit?: string) => {
        if (value == null) return "unknown duration";
        const n = Number(value);
        if (!Number.isFinite(n)) return String(value);
        const u = String(unit ?? "").toLowerCase().trim();
        if (u.startsWith("d")) {
            const days = Math.floor(n);
            const hours = Math.round((n - days) * 24);
            if (hours === 0) return `${days} ${days === 1 ? "day" : "days"}`;
            return `${days} ${days === 1 ? "day" : "days"} ${hours} ${hours === 1 ? "hour" : "hours"}`;
        }
        const totalHours = Math.round(n);
        if (totalHours < 24) return `${totalHours} ${totalHours === 1 ? "hour" : "hours"}`;
        const days = Math.floor(totalHours / 24);
        const hours = totalHours % 24;
        if (hours === 0) return `${days} ${days === 1 ? "day" : "days"}`;
        return `${days} ${days === 1 ? "day" : "days"} ${hours} ${hours === 1 ? "hour" : "hours"}`;
    };

    const activeDiscount = useMemo(() => {
        if (!policy) return { percent: 0, name: "" };
        const now = new Date();
        const promo = (policy.promotions || []).find((p: any) => {
            const start = p.start_date ? new Date(p.start_date) : null;
            const end = p.end_date ? new Date(p.end_date) : null;
            return (Number(p.discount_percent) > 0) && (!start || now >= start) && (!end || now <= end);
        });
        if (promo) return { percent: Number(promo.discount_percent), name: promo.title || "Promotion" };

        const sale = (policy.sales_discounts || []).find((d: any) => Number(d.discount_percent) > 0);
        if (sale) return { percent: Number(sale.discount_percent), name: (sale as any).title || (sale as any).discount_type || "Sales Discount" };

        return { percent: 0, name: "" };
    }, [policy]);

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

    const returns = policy?.returns ?? {};

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
        const currentUserBizId = user?.business_id || (user as any)?.business?.business_id;
        if (currentUserBizId && Number(currentUserBizId) === Number(payload.businessId)) {
            toast.error("You are not allow to purchase your product");
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

        if (actionType === "buy") {
            if (!activeAddress) { // Fix: Use activeAddress instead of storedAddress
                setAddressModalOpen(true);
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
            } else {
                // StoqlePay or other methods
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

    if (!open || !payload) return null;

    return (
        <div
            className="fixed inset-0 z-[20000] flex items-end sm:items-center justify-center p-0"
            role="dialog"
            aria-modal="true"
        >
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />

            <div className={`relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl z-10 ${actionType === 'buy' ? 'h-full' : 'h-[80vh]'} sm:h-auto max-h-[100vh] flex flex-col overflow-hidden`}>
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

                    {actionType === "buy" && (
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
                    <div ref={imageRef} className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 flex-shrink-0">
                        <img
                            src={productImg}
                            alt={payload.title}
                            className="w-full h-full object-cover"
                        />
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
                <div className="flex-1 overflow-y-auto p-5 space-y-8 bg-slate-50/30">
                    {payload.variantGroups.map((g) => (
                        <div key={g.id} className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="text-xs font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
                                    <div className="w-1 h-3 bg-red-500 rounded-full" />
                                    {g.title || "Choose Option"}
                                </div>
                            </div>

                            <div
                                className={
                                    g.entries.some((e) => e.images && e.images.length > 0)
                                        ? "grid grid-cols-3 gap-2.5"
                                        : "flex flex-wrap gap-2.5"
                                }
                            >
                                {g.entries.map((e) => {
                                    const hasImage =
                                        e.images &&
                                        e.images.length > 0 &&
                                        (e.images[0].url || (e.images[0] as any).imagePreviews?.[0]);
                                    const groupHasImages = g.entries.some(
                                        (ent) => ent.images && ent.images.length > 0
                                    );
                                    const productFallbackUrl = payload.productImages?.[0]?.url;

                                    const isSelected = selectedOptions[g.id] === e.id;

                                    // Stock logic for individual buttons
                                    let stock = Number(e.quantity ?? 0);
                                    if (payload.useCombinations) {
                                        const otherSelectedIds = Object.entries(selectedOptions)
                                            .filter(([gid]) => gid !== g.id)
                                            .map(([, id]) => id);

                                        // Find ALL enabled SKUs that include both this option 'e.id' 
                                        // and all currently selected options from other groups
                                        // AND have a valid price
                                        const matchingSkus = payload.skus?.filter(
                                            (sku) =>
                                                sku.enabled &&
                                                Number(sku.price || (payload.samePriceForAll ? payload.sharedPrice : 0) || 0) > 0 &&
                                                sku.variantOptionIds.includes(e.id) &&
                                                otherSelectedIds.every((oid) => sku.variantOptionIds.includes(oid))
                                        ) || [];

                                        // Total stock is the sum of all potential matching SKUs
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

                                        return (
                                            <button
                                                key={e.id}
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
                                                    <div className="absolute -top-1.5 -right-1 z-30 bg-red-600 text-[8px] text-white px-1.5 py-0.5 rounded-sm font-black shadow-md ring-1 ring-white">
                                                        {stock} LEFT
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
                                                    <div className="w-full aspect-square rounded-lg overflow-hidden mb-1.5 bg-slate-50 border border-slate-100">
                                                        <img
                                                            src={displayUrl}
                                                            alt={e.name}
                                                            className="w-full h-full object-cover group-hover/btn:scale-105 transition-transform"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="w-full aspect-square rounded-lg overflow-hidden mb-1.5 bg-slate-100 flex items-center justify-center text-slate-300">
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                        </svg>
                                                    </div>
                                                )}
                                                <div className="text-[10px] font-bold text-slate-800 line-clamp-1 px-0.5 text-center w-full">
                                                    {e.name}
                                                </div>
                                            </button>
                                        );
                                    } else {
                                        return (
                                            <button
                                                key={e.id}
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
                                                className={`relative px-4 py-2 rounded-xl border text-[11px] font-black transition-all shadow-sm flex items-center gap-2 ${isSelected
                                                    ? "border-red-500 bg-red-50 text-red-600 shadow-red-100"
                                                    : "border-white bg-white text-slate-700 hover:border-slate-200"
                                                    } ${isOutOfStock ? "opacity-30 line-through cursor-pointer" : "cursor-pointer"
                                                    }`}
                                            >
                                                {/* STOCK FLAG FOR TEXT BUTTONS */}
                                                {!isOutOfStock && stock <= 3 && (
                                                    <div className="absolute -top-2 -right-1 z-30 bg-red-600 text-[7px] text-white px-1 py-0.5 rounded-sm font-black shadow-sm ring-1 ring-white">
                                                        {stock}
                                                    </div>
                                                )}
                                                <span>{e.name}</span>
                                            </button>
                                        );
                                    }
                                })}
                            </div>
                        </div>
                    ))}

                    {/* Seller Note */}
                    <div className="space-y-3">

                        <DefaultInput
                            label="Note"
                            value={sellerNote}
                            onChange={setSellerNote}
                            placeholder="Note optional (seller confirm)"
                        />
                    </div>

                    {/* Checkout Specifics */}
                    {actionType === "buy" && (
                        <div className="space-y-6 mt-4">
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
                                        { id: "stoqle_pay", label: "StoqlePay Wallet", sub: "Fast in-app payment", icon: "/assets/images/logo.png" }
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
                                                <div className="w-10 h-10 rounded-xl bg-white p-2 flex items-center justify-center shrink-0 ">
                                                    <img src={pm.icon} alt={pm.label} className="w-full h-full object-contain" />
                                                </div>
                                                <div>
                                                    <div className="text-sm text-slate-800">{pm.label}</div>
                                                    <div className="text-[10px] text-slate-500">{pm.sub}</div>
                                                </div>
                                            </div>
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === pm.id ? "border-red-500 bg-red-500" : "border-slate-200"}`}>
                                                {paymentMethod === pm.id && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                {/* <div className="space-y-2">
                                    {[
                                        { id: "paystack", label: "Paystack Payment", sub: "Credit/Debit Card, Transfer, USSD" },
                                        { id: "stoqle_pay", label: "StoqlePay Wallet", sub: "Fast & Secure in-app wallet" }
                                    ].map((pm) => (
                                        <button
                                            key={pm.id}
                                            onClick={() => setPaymentMethod(pm.id)}
                                            className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${paymentMethod === pm.id
                                                ? "border-red-500 bg-red-50/30"
                                                : "border-white bg-white hover:border-slate-200"
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-xl ${paymentMethod === pm.id ? "bg-red-500 text-white" : "bg-slate-100 text-slate-400"}`}>
                                                    <CreditCardIcon className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-slate-800">{pm.label}</div>
                                                    <div className="text-[10px] text-slate-500">{pm.sub}</div>
                                                </div>
                                            </div>
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === pm.id ? "border-red-500 bg-red-500" : "border-slate-200"
                                                }`}>
                                                {paymentMethod === pm.id && <div className="w-2 h-2 bg-white rounded-full" />}
                                            </div>
                                        </button>
                                    ))}
                                </div> */}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-5 border-t border-slate-100 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">


                    <div className="mb-4 space-y-1.5 px-1">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            Promise to ship within {shippingPromise ? formatDuration(shippingPromise.value, shippingPromise.unit) : "48 hours"}
                        </div>
                    </div>

                    <div className={`flex items-center gap-4 ${actionType === 'buy' ? 'justify-between' : ''}`}>
                        {actionType === 'buy' ? (
                            <>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Total</span>
                                    <span className="text-lg font-black text-red-600 leading-none">₦{(price * quantity).toLocaleString()}</span>
                                </div>
                                <button
                                    onClick={handleConfirmClick}
                                    disabled={isPaying || isOwner || (isAllSelected && availableStock <= 0)}
                                    className="flex-1 max-w-[220px] py-3.5 bg-gradient-to-r from-red-600 to-rose-600 text-white font-black rounded-2xl shadow-xl shadow-red-100 hover:shadow-red-200 transition-all active:scale-[0.98] disabled:grayscale disabled:opacity-50 disabled:cursor-not-allowed text-xs uppercase tracking-widest"
                                >
                                    {isPaying ? "Processing..." : (isOwner ? "Owning this product" : (isAllSelected && availableStock <= 0 ? "Out of Stock" : "Pay Now"))}
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={handleConfirmClick}
                                disabled={isPaying || isOwner || (isAllSelected && availableStock <= 0)}
                                className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl shadow-xl shadow-red-100 transition-all active:scale-[0.98] disabled:grayscale disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                                {isPaying ? "Adding..." : (isOwner ? "Owning this product" : (isAllSelected && availableStock <= 0 ? "Out of Stock" : `Confirm · ₦ ${(price * quantity).toLocaleString()}`))}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <DeliveryAddressModal
                open={addressModalOpen}
                onClose={() => setAddressModalOpen(false)}
                onSave={handleAddressSave}
            />
        </div>
    );
}
