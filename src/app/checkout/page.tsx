"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/src/context/authContext";
import { fetchCartApi } from "@/src/lib/api/cartApi";
import { ChevronLeftIcon, MapPinIcon } from "@heroicons/react/24/outline";
import { API_BASE_URL } from "@/src/lib/config";
import { toast } from "sonner";
import Swal from "sweetalert2";
import DeliveryAddressModal from "@/src/components/product/addProduct/modal/deliveryAddressModal";
import { initializePayment, verifyAndCompleteOrder, recordAbandoned } from "@/src/lib/api/paymentApi";
import DefaultInput from "@/src/components/input/default-input";
import AddressListModal from "@/src/components/modal/addressListModal";
import { fetchUserAddresses, UserAddress } from "@/src/lib/api/addressApi";
import { estimateDelivery, EstimationResult } from "@/src/lib/deliveryEstimation";
import { fetchMyWallet, walletCheckoutApi } from "@/src/lib/api/walletApi";
import { useWallet } from "@/src/context/walletContext";
import PinVerifyModal from "@/src/components/business/pinVerifyModal";
import PinSetupModal from "@/src/components/business/pinSetupModal";
import { logUserActivity } from "@/src/lib/api/productApi";
import ImageViewer from "@/src/components/modal/imageViewer";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import AccountVerificationModal from "@/src/components/modal/accountVerificationModal";
import { VerifiedBadge } from "@/src/components/common/VerifiedBadge";
import { fetchVendorBadgesBatch, type VendorBadge } from "@/src/lib/api/vendorApi";

interface CartItem {
    cart_id: number;
    user_id: number;
    product_id: number;
    sku_id: number | null;
    variant_option_ids: string[] | null;
    quantity: number;
    product_title: string;
    base_price: number;
    has_variants: number;
    use_combinations: number;
    business_name: string;
    business_id: number;
    business_logo: string;
    sku_price: number | null;
    sku_code: string | null;
    variant_label?: string;
    product_image: string;
    price: number;
    total_quantity?: number;
    rapid_refund?: number;
    promotions?: any[];
    sales_discounts?: any[];
    shipping_avg?: string | null;
    shipping_promise?: string | null;
    business_latitude: number;
    business_longitude: number;
    shipping_policies: any[];
    seven_day_no_reason?: number;
    return_shipping_subsidy?: number;
    profile_pic?: string;
}

function formatDuration(value: number | string | undefined | null, unit?: string) {
    if (value == null) return "8 hours";

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

function getDisplayShipping(estimation: EstimationResult | null, policies: any[]) {
    let avgStr = "8 hours";
    let promiseStr = "48 hours";
    let avgVal = 8;
    let promiseVal = 48;

    const orderTime = new Date();

    if (estimation?.is_available && estimation.estimated_delivery_time.getTime() > 0) {
        const diffMs = estimation.estimated_delivery_time.getTime() - orderTime.getTime();
        avgVal = Math.max(0, diffMs / (1000 * 60 * 60));
        avgStr = formatDuration(avgVal, "hours");
    } else {
        const p = (policies || []).find((s: any) => s.kind === "avg" || s.type === "avg");
        if (p) {
            avgVal = (p.unit?.toLowerCase().startsWith('d')) ? p.value * 24 : p.value;
            avgStr = formatDuration(p.value, p.unit);
        }
    }

    if (estimation?.is_available && estimation.shipping_deadline.getTime() > 0) {
        const diffMs = estimation.shipping_deadline.getTime() - orderTime.getTime();
        promiseVal = Math.max(0, diffMs / (1000 * 60 * 60));
        promiseStr = formatDuration(promiseVal, "hours");
    } else {
        const p = (policies || []).find((s: any) => s.kind === "promise" || s.type === "promise");
        if (p) {
            promiseVal = (p.unit?.toLowerCase().startsWith('d')) ? p.value * 24 : p.value;
            promiseStr = formatDuration(p.value, p.unit);
        }
    }

    return { avgStr, promiseStr, avgVal, promiseVal };
}

function isPromotionActive(promotion: any) {
    if (!promotion) return false;
    if (promotion.isActive === false) return false;
    const now = new Date();
    const startDate = promotion.start_date || promotion.start;
    const endDate = promotion.end_date || promotion.end;

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    return (!start || start <= now) && (!end || end >= now);
}

function ProductPromoIndicator({ promotion }: { promotion: any }) {
    const [timeLeft, setTimeLeft] = useState<string | null>(null);
    const endDateStr = promotion?.end_date || promotion?.end;

    const isActive = useMemo(() => isPromotionActive(promotion), [promotion]);

    useEffect(() => {
        if (!isActive || !endDateStr) return;

        const timer = setInterval(() => {
            const now = new Date();
            const end = new Date(endDateStr);
            const diff = end.getTime() - now.getTime();

            if (diff <= 0) {
                setTimeLeft("Ended");
                clearInterval(timer);
            } else {
                const h = Math.floor(diff / (1000 * 60 * 60));
                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((diff % (1000 * 60)) / 1000);
                setTimeLeft(`${h}h ${m}m ${s}s`);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [isActive, endDateStr]);

    if (!isActive) return null;

    const discountValue = promotion.discount_percent || promotion.discount || 0;
    const promoTitle = promotion.title || promotion.occasion || promotion.type || promotion.discount_type || "Discount";

    return (
        <div className="mt-1 flex items-center gap-1.5 ">
            <span className="text-[10px] font-bold text-rose-600  tracking-tighter bg-rose-50 px-1 rounded-sm">
                {discountValue}% OFF · {promoTitle}
            </span>
            {timeLeft && (
                <span className="text-[9px] text-slate-400 font-medium">
                    Ends in {timeLeft}
                </span>
            )}
        </div>
    );
}

import { useAudio } from "@/src/context/audioContext";

export default function CheckoutPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, token, ensureLoggedIn, isHydrated, _onLoginSuccess, ensureAccountVerified } = useAuth();
    const { playSound } = useAudio();

    const [items, setItems] = useState<CartItem[]>([]);
    const [selectedIds, setSelectedIds] = useState<number[]>(() => {
        if (typeof window === 'undefined') return [];
        const saved = sessionStorage.getItem("stoqle_checkout_ids");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) return parsed;
            } catch (e) { }
        }
        return [];
    });
    const [loading, setLoading] = useState(true);
    const [address, setAddress] = useState<any>(null);
    const [addressModalOpen, setAddressModalOpen] = useState(false);
    const [vendorNotes, setVendorNotes] = useState<Record<number, string>>({});
    const [paymentMethod, setPaymentMethod] = useState("paystack");
    const [isProcessing, setIsProcessing] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);

    // Global Wallet Context
    const { wallet, refreshWallet, isLoading: walletLoading } = useWallet();

    const [showPinModal, setShowPinModal] = useState(false);
    const [pinLoading, setPinLoading] = useState(false);
    const [pinError, setPinError] = useState<string | null>(null);
    const [showPinSetup, setShowPinSetup] = useState(false);

    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerSrc, setViewerSrc] = useState<string | null>(null);
    const [vendorBadges, setVendorBadges] = useState<Record<number, VendorBadge>>({});

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Verify IDs are actually present
        if (selectedIds.length === 0) {
            const saved = sessionStorage.getItem("stoqle_checkout_ids");
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setSelectedIds(parsed);
                        return;
                    }
                } catch (e) { }
            }
            // If still no IDs and we are not loading, go back
            if (!loading) router.push("/cart");
        }
    }, [router, selectedIds, loading]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const scriptUrl = "https://js.paystack.co/v2/inline.js";
            if (!document.querySelector(`script[src="${scriptUrl}"]`)) {
                const script = document.createElement("script");
                script.src = scriptUrl;
                script.async = true;
                script.onload = () => console.log("Paystack script loaded");
                document.body.appendChild(script);
            }
        }
    }, []);

    // Stabilize background to prevent white flashes during payment popup
    useEffect(() => {
        if (typeof document !== 'undefined') {
            if (isProcessing) {
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = '';
            }
        }
    }, [isProcessing]);

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 50) {
                setIsScrolled(true);
            } else {
                setIsScrolled(false);
            }
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const fetchCart = async () => {
        if (!token) return;
        try {
            const res = await fetchCartApi(token);
            if (res.status === 'success') {
                const fetchedItems: CartItem[] = res.data?.items || [];

                // Deduplicate by cart_id to prevent "duplicate key" crashes in checkout
                const uniqueItems = fetchedItems.filter((item, index, self) =>
                    index === self.findIndex((t) => t.cart_id === item.cart_id)
                );

                // ONLY show items that were selected for checkout
                const filterose = uniqueItems.filter(item => selectedIds.includes(item.cart_id));
                setItems(filterose);

                // Batch-fetch vendor badges in one network call
                const uniqueBusinessIds = [...new Set(filterose.map(i => i.business_id))];
                if (uniqueBusinessIds.length > 0) {
                    fetchVendorBadgesBatch(uniqueBusinessIds)
                        .then(badges => setVendorBadges(badges))
                        .catch(() => { }); // badge fetch is non-critical
                }

                if (filterose.length === 0 && !loading) {
                    toast.error("No items selected for checkout");
                    router.push("/cart");
                }
            }
        } catch (err) {
            console.error("Fetch cart error", err);
            toast.error("Failed to load cart items");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isHydrated) return;

        const checkAuth = async () => {
            if (token) {
                fetchCart();
                refreshWallet();
                fetchDefaultAddress();
            } else {
                const loggedIn = await ensureLoggedIn();
                if (!loggedIn) {
                    router.push("/cart");
                }
            }
        };

        checkAuth();
    }, [token, isHydrated, selectedIds, user?.phone_no]);

    const fetchDefaultAddress = async () => {
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
                setAddress(mapped);
            }
        } catch (err) {
            console.error("Fetch address error", err);
        }
    };

    // Removed local fetchWalletBalance in favor of useWallet hook

    const formatUrl = (url: string) => {
        if (!url) return "";
        let formatted = url;
        if (!url.startsWith("http")) {
            formatted = url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
        }
        return encodeURI(formatted);
    };

    const groupedItems = useMemo(() => {
        const groupList: {
            business_id: number;
            business_name: string;
            business_logo: string;
            profile_pic?: string;
            shipments: {
                shipment_id: string; // duration based key
                items: CartItem[];
                subtotal: number;
                discount: number;
                estimation: EstimationResult | null;
                avgStr: string;
                avgVal: number;
                promiseStr: string;
                promiseVal: number;
                promos: string[];
            }[];
        }[] = [];

        items.forEach(item => {
            let vendorGroup = groupList.find(g => g.business_id === item.business_id);
            if (!vendorGroup) {
                vendorGroup = {
                    business_id: item.business_id,
                    business_name: item.business_name,
                    business_logo: item.business_logo || item.profile_pic || "",
                    profile_pic: item.profile_pic,
                    shipments: []
                };
                groupList.push(vendorGroup);
            }

            // Calculate display shipping for this specific item
            let itemEst: EstimationResult | null = null;
            if (address && item.business_latitude && item.business_longitude) {
                itemEst = estimateDelivery(
                    { latitude: Number(item.business_latitude), longitude: Number(item.business_longitude) },
                    { latitude: Number(address.latitude), longitude: Number(address.longitude) },
                    item.shipping_policies || []
                );
            }
            const { avgStr, promiseStr, avgVal, promiseVal } = getDisplayShipping(itemEst, item.shipping_policies || []);
            const shipmentKey = `${avgStr}-${promiseStr}`;

            let shipment = vendorGroup.shipments.find(s => s.shipment_id === shipmentKey);
            if (!shipment) {
                shipment = {
                    shipment_id: shipmentKey,
                    items: [],
                    subtotal: 0,
                    discount: 0,
                    estimation: itemEst,
                    avgStr,
                    avgVal,
                    promiseStr,
                    promiseVal,
                    promos: []
                };
                vendorGroup.shipments.push(shipment);
            }

            shipment.items.push(item);

            // Extract promos/sales
            const activePromo = (item.promotions || []).find(isPromotionActive);
            const activeSale = (item.sales_discounts || []).find(isPromotionActive);

            if (activePromo) {
                const promoTitle = activePromo.title || activePromo.occasion || "Promotion";
                const promoDiscount = activePromo.discount_percent || activePromo.discount || 0;
                const label = `${promoTitle} (${promoDiscount}% off)`;
                if (!shipment.promos.includes(label)) shipment.promos.push(label);
            } else if (activeSale) {
                const saleTitle = activeSale.discount_type || activeSale.type || activeSale.occasion || "Sale";
                const saleDiscount = activeSale.discount_percent || activeSale.discount || 0;
                const label = `${saleTitle} (${saleDiscount}% off)`;
                if (!shipment.promos.includes(label)) shipment.promos.push(label);
            }

            const isAnyDiscountActive = !!(activePromo || activeSale);
            const itemPrice = isAnyDiscountActive ? item.price : (item.base_price || item.price);
            const itemBasePrice = item.base_price || item.price;

            const itemBaseTotal = itemBasePrice * item.quantity;
            const itemFinalTotal = itemPrice * item.quantity;

            shipment.subtotal += itemBaseTotal;
            shipment.discount += (itemBaseTotal - itemFinalTotal);
        });

        // Sort shipments WITHIN each vendor by fastest first
        groupList.forEach((vendor: any) => {
            vendor.shipments.sort((a: any, b: any) => a.avgVal - b.avgVal);
        });

        // Sort VENDORS by their fastest shipment
        groupList.sort((a: any, b: any) => {
            const minA = Math.min(...a.shipments.map((s: any) => s.avgVal));
            const minB = Math.min(...b.shipments.map((s: any) => s.avgVal));
            return minA - minB;
        });

        return groupList;
    }, [items, address, address?.address_id]);

    const globalSummary = useMemo(() => {
        let subtotal = 0;
        let totalDiscount = 0;

        groupedItems.forEach(group => {
            group.shipments.forEach(shipment => {
                subtotal += shipment.subtotal;
                totalDiscount += shipment.discount;
            });
        });

        const grandTotal = subtotal - totalDiscount;

        return {
            subtotal,
            totalDiscount,
            grandTotal,
            breakdowns: totalDiscount > 0 ? [["Total Savings", totalDiscount]] : []
        };
    }, [groupedItems]);

    const { grandTotal } = globalSummary;

    const handlePlaceOrder = async (overrideUser?: any) => {
        const currentUser = overrideUser || user;
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

        if (!address) {
            setAddressModalOpen(true);
            toast.info("Please set a delivery address");
            return;
        }

        // Unified check for phone and email before allowing purchase
        const verifiedUser = await ensureAccountVerified() as any;
        if (!verifiedUser) {
            setIsProcessing(false);
            return;
        }

        if (paymentMethod === "paystack") {

            const unreachableVendor = groupedItems.find(g =>
                g.shipments.some(s => s.estimation && !s.estimation.is_available)
            );
            if (unreachableVendor) {
                const unreachableShipments = unreachableVendor.shipments.filter(s => s.estimation && !s.estimation.is_available);
                const itemNames = unreachableShipments.flatMap(s => s.items.map(i => i.product_title)).join(", ");
                toast.error(`One or more vendors cannot deliver to your location. Please remove: ${itemNames}`);
                return;
            }

            try {
                setIsProcessing(true);
                // In a real multi-vendor checkout, you might initialize one payment or multiple.
                // Assuming the backend handles "bulk" checkout from cart

                const metadata = {
                    cart_ids: selectedIds,
                    customer_id: verifiedUser?.user_id || verifiedUser?.id,
                    address,
                    vendor_notes: vendorNotes,
                    type: "multi_vendor_checkout"
                };

                const res = await initializePayment({
                    email: verifiedUser.email,
                    amount: grandTotal,
                    metadata
                });

                if (res.status && res.data.access_code) {
                    const PaystackPop = (window as any).PaystackPop;
                    if (!PaystackPop) {
                        toast.error("Payment system is loading...");
                        setIsProcessing(false);
                        return;
                    }

                    const paystack = new PaystackPop();
                    paystack.resumeTransaction(res.data.access_code, {
                        onSuccess: async (response: any) => {
                            try {
                                const completeRes = await verifyAndCompleteOrder(response.reference);
                                if (completeRes.status) {
                                    sessionStorage.removeItem("stoqle_checkout_ids");

                                    // Broadcast update to refresh cart across tabs
                                    const channel = new BroadcastChannel('stoqle_cart_sync');
                                    channel.postMessage('update');
                                    channel.close();

                                    toast.success("Order placed successfully!");
                                    playSound("order_placed");

                                    // Log activities for each item
                                    items.forEach(item => {
                                        logUserActivity({ product_id: item.product_id, action_type: 'purchase' }, token);
                                    });

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
                            }
                            catch (e) {
                                toast.error("Verification failed. Contact support.");
                            }
                            finally {
                                setIsProcessing(false);
                            }
                        },
                        onCancel: () => {
                            setIsProcessing(false);
                            toast("Payment cancelled");
                            if (res.data.reference) {
                                recordAbandoned(res.data.reference, 'cancelled', token ?? undefined)
                                    .catch(e => console.error("Leak error logging cancel", e));
                            }
                        }
                    });
                } else {
                    toast.error(res.message || "Could not initialize payment");
                    setIsProcessing(false);
                }
            } catch (err) {
                console.error(err);
                toast.error("Payment failed to initialize");
                setIsProcessing(false);
            }
        } else if (paymentMethod === "stoqle_pay") {
            const availableBalance = wallet?.available_balance ?? 0;
            if (availableBalance < grandTotal) {
                toast.error(`Insufficient StoqlePay balance. Your balance: ₦${availableBalance.toLocaleString()}`);
                return;
            }

            if (!wallet?.has_pin) {
                setShowPinSetup(true);
                return;
            }

            setShowPinModal(true);
        }
    };

    const handlePinSubmit = async (pin: string) => {
        setPinLoading(true);
        setPinError(null);
        try {
            // Re-verify account to get ultra-fresh user for StoqlePay
            const verifiedUser = await ensureAccountVerified() as any;
            if (!verifiedUser) {
                setPinLoading(false);
                return;
            }

            const metadata = {
                cart_ids: selectedIds,
                customer_id: Number(verifiedUser?.user_id || verifiedUser?.id),
                address,
                vendor_notes: vendorNotes,
                customer_account_name: verifiedUser?.full_name || verifiedUser?.fullName || `${verifiedUser?.first_name || ""} ${verifiedUser?.last_name || ""}`.trim() || verifiedUser?.username,
                customer_account_email: verifiedUser?.email,
                customer_account_phone: verifiedUser?.phone_no || verifiedUser?.phone || verifiedUser?.contactNo,
                type: "multi_vendor_checkout"
            };
            const res = await walletCheckoutApi({
                amount: grandTotal,
                pin,
                metadata,
                email: verifiedUser?.email ?? undefined
            });

            if (res.status === 'success' || res.success) {
                setShowPinModal(false);
                refreshWallet();
                sessionStorage.removeItem("stoqle_checkout_ids");

                // Broadcast update
                const channel = new BroadcastChannel('stoqle_cart_sync');
                channel.postMessage('update');
                channel.close();

                toast.success("Order placed successfully!");
                playSound("order_placed");

                // Log activities for each item
                items.forEach(item => {
                    logUserActivity({ product_id: item.product_id, action_type: 'purchase' }, token);
                });

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

    if (loading) {
        return (
            <div className="bg-slate-100/70 min-h-screen pb-40">
                <header className="sticky top-0 z-[1100] bg-white px-6 py-4 flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full shimmer-bg" />
                    <div className="h-4 w-32 shimmer-bg rounded-md" />
                </header>

                <main className="mt-2 p-3 space-y-4">
                    {/* Address Shimmer */}
                    <div className="bg-white px-5 py-4 h-12 shimmer-bg" />

                    {/* Vendor Item Shimmers */}
                    {[1, 2].map((i) => (
                        <div key={i} className="bg-white overflow-hidden space-y-px">
                            <div className="px-5 py-3 h-10 shimmer-bg" />
                            <div className="p-5 flex gap-4">
                                <div className="w-20 h-20 rounded-xl shimmer-bg" />
                                <div className="flex-1 space-y-3">
                                    <div className="h-4 w-3/4 shimmer-bg rounded-md" />
                                    <div className="h-3 w-1/4 shimmer-bg rounded-md" />
                                    <div className="flex justify-between items-center">
                                        <div className="h-4 w-20 shimmer-bg rounded-md" />
                                        <div className="h-3 w-8 shimmer-bg rounded-md" />
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 h-12 shimmer-bg" />
                        </div>
                    ))}

                    {/* Summary Shimmer */}
                    <div className="bg-white p-5 space-y-4 h-40 shimmer-bg" />

                    {/* Payment Shimmer */}
                    <div className="bg-white p-5 space-y-4 h-48 shimmer-bg" />
                </main>

                {/* Bottom Bar Shimmer */}
                <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-100 p-2 h-20 shimmer-bg" />
            </div>
        );
    }

    return (
        <div className={`transition-colors duration-500 bg-slate-100/70 pb-40 ${isProcessing ? "pointer-events-none" : ""}`}>
            <PinVerifyModal
                isOpen={showPinModal}
                isLoading={pinLoading}
                errorMessage={pinError}
                onClose={() => setShowPinModal(false)}
                onSuccess={handlePinSubmit}
                title="Authorize StoqlePay"
                description={`Please enter your 4-digit PIN to authorize the payment of ₦${grandTotal.toLocaleString()} from your Stoqle wallet.`}
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
            {/* Header & Sticky Address Area */}
            <div className={`sticky transition-all duration-500 bg-white ${isScrolled ? "top-0 z-[2500] " : "top-[64px] z-[1100]"}`}>
                <header className="px-4 py-2 flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-slate-100 rounded-full lg:hidden"
                    >
                        <ChevronLeftIcon className="w-5 h-5 text-slate-700" strokeWidth={2.5} />
                    </button>
                    <h1 className="text-sm text-center font-bold text-slate-900">Confirm Order</h1>
                </header>

                {/* Address Section */}
                <section className="px-5 pb-3  border-slate-50">
                    <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2 text-xs text-slate-800">
                            <MapPinIcon className="w-4 h-4 text-rose-500" />
                            {address ? (
                                <span className="font-semibold">{address.recipientName}  +234 {address.contactNo}</span>
                            ) : (
                                <span className="text-slate-400 italic">Set delivery address</span>
                            )}
                        </div>
                        <button
                            onClick={() => setAddressModalOpen(true)}
                            className="text-[10px] font-bold   text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-full border border-rose-100 transition-all"
                        >
                            {address ? "Change" : "Select Address"}
                        </button>
                    </div>
                </section>
            </div>

            <main className="px-4 space-y-4">


                {/* Items Grouped by Vendor & Shipment */}
                {groupedItems.map((group) => (
                    <section key={group.business_id} className="bg-white overflow-hidden space-y-4 pb-4">
                        {/* Vendor Header */}
                        <div className="px-5 py-3 flex items-center gap-2 border-b border-slate-50">
                            <img src={formatUrl(group.business_logo) || formatUrl(group.profile_pic || "") || "/assets/images/favio.png"} alt={group.business_name} className="w-5 h-5 rounded-full object-cover border border-slate-200" />
                            <span className="text-sm font-bold text-slate-800">{group.business_name}</span>
                            {vendorBadges[group.business_id]?.verified_badge && (
                                <VerifiedBadge label={vendorBadges[group.business_id].badge_label} size="xs" />
                            )}
                        </div>

                        {group.shipments.map((shipment, sIdx) => (
                            <div key={`${shipment.shipment_id}-${sIdx}`} className="space-y-2">
                                {/* Shipment Divider/Label if multiple shipments exist */}
                                {group.shipments.length > 1 && (
                                    <div className="px-5 flex items-center gap-3">
                                        <div className="h-px flex-1 bg-slate-100"></div>
                                        <span className="text-[10px] font-black text-slate-400  tracking-widest whitespace-nowrap">Shipment {sIdx + 1}</span>
                                        <div className="h-px flex-1 bg-slate-100"></div>
                                    </div>
                                )}

                                {shipment.estimation && !shipment.estimation.is_available && (
                                    <div className="mx-5 mb-2 p-3 bg-rose-50 border border-rose-100 rounded-xl">
                                        <p className="text-[11px] text-rose-600 font-bold leading-relaxed whitespace-pre-wrap">
                                            ⚠️ {shipment.estimation.message}
                                        </p>
                                        <p className="text-[10px] text-rose-500 mt-1 italic">
                                            Please remove items in this shipment to proceed.
                                        </p>
                                    </div>
                                )}

                                {/* Items in this Shipment */}
                                <div className="space-y-px">
                                    {shipment.items.map((item, idx) => (
                                        <div key={`${item.cart_id}-${idx}`} className="px-5 py-3 flex flex-col gap-1 hover:bg-slate-50/50 transition-colors">
                                            <div className="flex gap-4">
                                                <div
                                                    onClick={() => { setViewerSrc(formatUrl(item.product_image)); setViewerOpen(true); }}
                                                    className="w-20 h-20 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-50 cursor-pointer active:scale-95 transition-transform"
                                                >
                                                    <img src={formatUrl(item.product_image)} className="w-full h-full object-cover" alt={item.product_title} />
                                                </div>
                                                <div className="flex-1 min-w-0 flex justify-between gap-4">
                                                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                                                        <h3 className="text-sm font-medium text-slate-900 truncate lg:line-clamp-2 leading-snug">{item.product_title}</h3>
                                                        {item.variant_label && (
                                                            <div className="text-[10px] font-bold text-slate-400">{item.variant_label}</div>
                                                        )}
                                                        {(() => {
                                                            const activePromo = (item.promotions || []).find(isPromotionActive);
                                                            if (activePromo) {
                                                                return <ProductPromoIndicator promotion={activePromo} />;
                                                            }
                                                            const activeSale = (item.sales_discounts || []).find(isPromotionActive);
                                                            if (activeSale) {
                                                                return <ProductPromoIndicator promotion={activeSale} />;
                                                            }
                                                            return null;
                                                        })()}
                                                        <div className="flex flex-wrap gap-1.5 mt-0.5">
                                                            {item.seven_day_no_reason === 1 && (
                                                                <span className="text-[9px] px-2 py-0.3 text-rose-600 rounded border border-rose-100">7-day no reason return</span>
                                                            )}
                                                            {item.rapid_refund === 1 && (
                                                                <span className="text-[9px] px-2 py-0.3 text-rose-600 rounded border border-rose-100">Rapid Refund</span>
                                                            )}
                                                            {item.return_shipping_subsidy === 1 && (
                                                                <span className="text-[9px] px-2 py-0.3 text-rose-600 rounded border border-rose-100">Return Subsidy</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-0.5 text-right min-w-[80px]">
                                                        <div className="text-[9px] text-rose-500 whitespace-nowrap">Final Price ₦{item.price.toLocaleString()}</div>
                                                        {(item.base_price || 0) > item.price && (
                                                            <div className="text-xs text-slate-400 line-through">₦{item.base_price.toLocaleString()}</div>
                                                        )}
                                                        <div className="text-xs font-bold text-slate-900">x{item.quantity}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Delivery Info Section for this Shipment */}
                                <div className="px-5 py-2 mx-5 mt-2 bg-slate-50 rounded-xl space-y-1 lg:space-y-0 lg:flex lg:items-center lg:justify-between lg:gap-4">
                                    <div className="flex items-center gap-2 text-[10px] text-slate-600 overflow-hidden">
                                        <span className="font-bold text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-100 whitespace-nowrap">Delivery info</span>
                                        <span className="whitespace-nowrap text-emerald-600 font-bold shrink-0">Ships within {shipment.avgStr} in average</span>
                                        <span className="text-slate-300">|</span>
                                        <span className="truncate">Free shipping</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-medium lg:text-right truncate">
                                        Promise to ship within {shipment.promiseStr}, delayed compensation guarantee
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Order Note for this Vendor */}
                        <div className="bg-white px-5 pt-2">
                            <DefaultInput
                                label="Add a note to seller"
                                value={vendorNotes[group.business_id] || ""}
                                onChange={(val) => setVendorNotes(prev => ({ ...prev, [group.business_id]: val }))}
                                placeholder="Any special instruction?"
                            />
                        </div>
                    </section>
                ))}

                {/* Unified Order Summary */}
                <section className="bg-white  p-5  space-y-4">

                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">Subtotal</span>
                            <span className="font-bold text-slate-900">₦{globalSummary.subtotal.toLocaleString()}</span>
                        </div>

                        {globalSummary.totalDiscount > 0 && (
                            <div className="space-y-1">
                                {globalSummary.breakdowns.map(([name, amount], i) => (
                                    <div key={i} className="flex justify-between items-center text-xs text-slate-600 font-medium">
                                        <span>{name}</span>
                                        <span className="text-rose-500">-₦{amount.toLocaleString()}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between items-center text-sm text-rose-600 font-bold pt-1 border-t border-rose-50/50">
                                    <span>Total Savings</span>
                                    <span>-₦{globalSummary.totalDiscount.toLocaleString()}</span>
                                </div>
                            </div>
                        )}

                        <div className="pt-3 border-t border-slate-50 text-right justify-between items-right">
                            <span className="text-sm  text-slate-600 text-right">Total:  </span>
                            <span className="text-xl font-bold text-slate-800">₦{globalSummary.grandTotal.toLocaleString()}</span>
                        </div>
                    </div>
                </section>

                {/* Payment Method Section */}
                <section className="bg-white space-y-4">

                    <div className="space-y-3">
                        {[
                            { id: "paystack", label: "Paystack Payment", sub: "Card, Transfer, USSD", icon: "/assets/images/paystack.png" },
                            {
                                id: "stoqle_pay",
                                label: "StoqlePay Wallet",
                                sub: walletLoading ? "Fetching balance..." : (wallet?.available_balance !== null ? `Balance: ₦${(wallet?.available_balance ?? 0).toLocaleString()}` : "Fast in-app payment"),
                                icon: "/assets/images/logo.png",
                                insufficient: wallet?.available_balance !== null && (wallet?.available_balance ?? 0) < grandTotal
                            }
                        ].map((pm) => (
                            <button
                                key={pm.id}
                                onClick={() => setPaymentMethod(pm.id)}
                                className={`w-full flex items-center justify-between p-4 rounded-2xl  transition-all text-left ${paymentMethod === pm.id
                                    ? "border-rose-500 bg-rose-50/30"
                                    : "border-slate-100 bg-white hover:border-slate-200"
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="relative w-10 h-10 rounded-xl bg-white p-2 flex items-center justify-center shrink-0 ">
                                        <img src={pm.icon} alt={pm.label} className="w-full h-full object-contain" />
                                        {pm.id === 'stoqle_pay' && pm.insufficient && (
                                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full flex items-center justify-center text-[8px] text-white font-bold">!</div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-sm text-slate-800 flex items-center gap-2">
                                            {pm.label}
                                            {pm.id === 'stoqle_pay' && pm.insufficient && (
                                                <span className="text-[10px] text-rose-500 font-bold bg-rose-50 px-1.5 py-0.5 rounded-full border border-rose-100">Insufficient</span>
                                            )}
                                        </div>
                                        <div className={`text-[10px] ${pm.id === 'stoqle_pay' && pm.insufficient ? 'text-rose-400 font-bold' : 'text-slate-500'}`}>{pm.sub}</div>
                                    </div>
                                </div>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === pm.id ? "border-rose-500 bg-rose-500" : "border-slate-200"}`}>
                                    {paymentMethod === pm.id && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                </div>
                            </button>
                        ))}
                    </div>
                </section>
            </main>

            {/* Bottom Final Checkout Bar */}
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-100 p-2">
                <div className="max-w-3xl mx-auto flex items-center justify-between gap-6">
                    <div className="flex-1 flex-col">
                        <span className="text-[12px]  text-slate-800 ">Total: </span>
                        <span className="text-sm  text-rose-600 tracking-tight">₦{grandTotal.toLocaleString()}</span>
                    </div>

                    <button
                        onClick={handlePlaceOrder}
                        disabled={isProcessing || items.length === 0 || (paymentMethod === 'stoqle_pay' && wallet?.available_balance !== null && (wallet?.available_balance ?? 0) < grandTotal)}
                        className=" bg-gradient-to-r from-rose-600 to-rose-600 text-white px-4 py-1 rounded-2xl  hover:shadow-rose-300 transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale flex items-center justify-center"
                    >
                        {isProcessing ? (
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Processing...</span>
                            </div>
                        ) : (
                            `Pay now`
                        )}
                    </button>
                </div>
            </div>

            <AddressListModal
                open={addressModalOpen}
                onClose={() => setAddressModalOpen(false)}
                onSelect={(selectedAddr: UserAddress) => {
                    const mapped = {
                        recipientName: selectedAddr.full_name,
                        contactNo: selectedAddr.phone,
                        region: `Nigeria, ${selectedAddr.state}, ${selectedAddr.city}`,
                        address: selectedAddr.address_line1,
                        isDefault: selectedAddr.is_default,
                        latitude: selectedAddr.latitude,
                        longitude: selectedAddr.longitude,
                        address_id: selectedAddr.address_id
                    };
                    setAddress(mapped);
                    setAddressModalOpen(false);
                }}
                onUpdate={fetchDefaultAddress}
            />

            <ImageViewer
                src={viewerSrc}
                onClose={() => { setViewerOpen(false); setViewerSrc(null); }}
            />
        </div>
    );
}
