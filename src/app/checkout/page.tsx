"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/src/context/authContext";
import { fetchCartApi } from "@/src/lib/api/cartApi";
import { ArrowLeftIcon, MapPinIcon, CreditCardIcon, ChatBubbleLeftEllipsisIcon, BackwardIcon } from "@heroicons/react/24/outline";
import { API_BASE_URL } from "@/src/lib/config";
import { toast } from "sonner";
import Swal from "sweetalert2";
import DeliveryAddressModal from "@/src/components/product/addProduct/modal/deliveryAddressModal";
import { initializePayment, verifyAndCompleteOrder } from "@/src/lib/api/paymentApi";
import DefaultInput from "@/src/components/input/default-input";
import { ForwardIcon } from "lucide-react";

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
    return_shipping_subsidy?: number;
    seven_day_no_reason?: number;
    rapid_refund?: number;
    promotions?: any[];
    sales_discounts?: any[];
    shipping_avg?: string | null;
    shipping_promise?: string | null;
}

export default function CheckoutPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, token } = useAuth();

    const [items, setItems] = useState<CartItem[]>([]);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const [address, setAddress] = useState<any>(null);
    const [addressModalOpen, setAddressModalOpen] = useState(false);
    const [vendorNotes, setVendorNotes] = useState<Record<number, string>>({});
    const [paymentMethod, setPaymentMethod] = useState("paystack");
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const savedAddress = localStorage.getItem("stoqle_delivery_address");
        if (savedAddress) {
            try {
                setAddress(JSON.parse(savedAddress));
            } catch (e) {
                console.error("Failed to parse address", e);
            }
        }

        // Load IDs from sessionStorage
        const savedIds = sessionStorage.getItem("stoqle_checkout_ids");
        if (savedIds) {
            try {
                const parsed = JSON.parse(savedIds);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setSelectedIds(parsed);
                } else {
                    router.push("/cart");
                }
            } catch (e) {
                router.push("/cart");
            }
        } else {
            router.push("/cart");
        }
    }, [router]);

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

    const fetchCart = async () => {
        if (!token) return;
        try {
            const res = await fetchCartApi(token);
            if (res.status === 'success') {
                const fetchedItems: CartItem[] = res.data?.items || [];
                // ONLY show items that were selected for checkout
                const filtered = fetchedItems.filter(item => selectedIds.includes(item.cart_id));
                setItems(filtered);

                if (filtered.length === 0 && !loading) {
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
        if (token) {
            fetchCart();
        } else {
            // setTimeout to prevent flash
            const t = setTimeout(() => {
                if (!token) router.push("/cart");
            }, 1000);
            return () => clearTimeout(t);
        }
    }, [token, selectedIds]);

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
            items: CartItem[];
            subtotal: number;
            discount: number;
        }[] = [];

        items.forEach(item => {
            let group = groupList.find(g => g.business_id === item.business_id);
            if (!group) {
                group = {
                    business_id: item.business_id,
                    business_name: item.business_name,
                    business_logo: item.business_logo,
                    items: [],
                    subtotal: 0,
                    discount: 0
                };
                groupList.push(group);
            }
            group.items.push(item);

            const itemBaseTotal = (item.base_price || item.price) * item.quantity;
            const itemFinalTotal = item.price * item.quantity;

            group.subtotal += itemBaseTotal;
            group.discount += (itemBaseTotal - itemFinalTotal);
        });

        return groupList;
    }, [items]);

    const globalSummary = useMemo(() => {
        let subtotal = 0;
        let totalDiscount = 0;
        const breakdowns: Record<string, number> = {};

        items.forEach(item => {
            const itemBaseTotal = (item.base_price || item.price) * item.quantity;
            const itemFinalTotal = item.price * item.quantity;
            const itemSaving = itemBaseTotal - itemFinalTotal;

            subtotal += itemBaseTotal;
            totalDiscount += itemSaving;

            if (itemSaving > 0) {
                // Find which promotion or sale applies
                let attributedName = "General Discount";

                // Check promotions first
                const promo = (item.promotions || []).find(p => p.discount_percent > 0);
                if (promo) {
                    attributedName = promo.title || "Promotion Discount";
                } else {
                    const sale = (item.sales_discounts || []).find(d => Number(d.discount_percent) > 0);
                    if (sale) {
                        attributedName = (sale as any).title || (sale as any).discount_type || "Sales Discount";
                    }
                }

                breakdowns[attributedName] = (breakdowns[attributedName] || 0) + itemSaving;
            }
        });

        return {
            subtotal,
            totalDiscount,
            grandTotal: subtotal - totalDiscount,
            breakdowns: Object.entries(breakdowns).filter(([_, val]) => val > 0)
        };
    }, [items]);

    const grandTotal = globalSummary.grandTotal;

    const handlePlaceOrder = async () => {
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

        if (paymentMethod === "paystack") {
            if (!user?.email) {
                toast.error("Please login to proceed");
                return;
            }

            try {
                setIsProcessing(true);
                // In a real multi-vendor checkout, you might initialize one payment or multiple.
                // Assuming the backend handles "bulk" checkout from cart

                const metadata = {
                    cart_ids: selectedIds,
                    customer_id: user?.user_id,
                    address,
                    vendor_notes: vendorNotes,
                    type: "multi_vendor_checkout"
                };

                const res = await initializePayment({
                    email: user.email,
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
                        }
                    });
                }
            } catch (err) {
                console.error(err);
                toast.error("Payment failed to initialize");
                setIsProcessing(false);
            }
        } else {
            // StoqlePay or others
            toast.info("Coming soon!");
        }
    };

    if (loading) {
        return (
            <div className="bg-slate-100/70 min-h-screen pb-40">
                <header className="sticky top-0 z-30 bg-white px-6 py-4 flex items-center gap-4">
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
        <div className=" bg-slate-100/70 pb-40">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-white px-6 py-4 flex items-center gap-4">
                <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full">
                    <ArrowLeftIcon className="w-5 h-5 text-slate-700" />
                </button>
                <h1 className="text-sm text-center font-black text-slate-900">Confirm Order</h1>
            </header>

            <main className="mt-2 p-3 space-y-4">
                {/* Address Section */}

                <section className="bg-white px-5 p-3 ">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 text-xs  text-slate-800">
                            <MapPinIcon className="w-4 h-4 text-red-500" />
                            {address ? (
                                <span>{address.recipientName}  +234 {address.contactNo}</span>
                            ) : (
                                <span className="text-slate-400">Set delivery address</span>
                            )}
                        </div>
                        <button
                            onClick={() => setAddressModalOpen(true)}
                            className="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-1 rounded-full border border-red-100 transition-all"
                        >
                            {address ? "Change" : "Add Address"}
                        </button>
                    </div>

                </section>


                {/* Items Grouped by Vendor */}
                {groupedItems.map((group) => (
                    <section key={group.business_id} className="bg-white overflow-hidden">
                        {/* Vendor Header */}
                        <div className="px-5 py-3 flex items-center gap-2">
                            <img
                                src={formatUrl(group.business_logo) || "/assets/images/favio.png"}
                                alt={group.business_name}
                                className="w-5 h-5 rounded-full object-cover border border-slate-200"
                            />
                            <span className="text-sm text-slate-800">{group.business_name}</span>
                        </div>

                        {/* Items */}
                        <div className="divide-y divide-slate-50">
                            {group.items.map((item) => (
                                <div key={item.cart_id} className="p-5 flex flex-col gap-3">
                                    <div className="flex gap-4">
                                        <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-50">
                                            <img src={formatUrl(item.product_image)} className="w-full h-full object-cover" alt={item.product_title} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start gap-3">
                                                <h3 className="text-sm font-medium text-slate-900 line-clamp-2 leading-snug flex-1">{item.product_title}</h3>
                                                <div className="text-right">
                                                    <div className="text-[9px] text-rose-500 whitespace-nowrap">Final Price ₦{item.price.toLocaleString()}</div>
                                                    {(item.base_price || 0) > item.price && (
                                                        <div className="text-xs text-slate-400 line-through">₦{item.base_price.toLocaleString()}</div>
                                                    )}
                                                    <div className="text-xs font-bold text-slate-400 mt-0.5">x{item.quantity}</div>
                                                </div>
                                            </div>

                                            {item.variant_label && (
                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{item.variant_label}</div>
                                            )}

                                            {/* Return policies under variant */}
                                            <div className="flex flex-wrap gap-1.5 mt-2">
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
                                    </div>

                                    {/* Delivery Info Section */}
                                    <div className=" space-y-1.5">
                                        <div className="flex items-center gap-2 text-[10px] text-slate-600">
                                            <span className="font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">Delivery info</span>
                                            <span>Free shipping</span>
                                            <span className="text-slate-300">|</span>
                                            <span>Ships within {item.shipping_avg || "8 hours"}</span>
                                        </div>
                                        <div className=" items-center gap-1.5 text-[10px] text-slate-600 font-medium text-center">
                                            <span>Promise to ship within {item.shipping_promise || "48 hours"} delay compensation guaranteed</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Order Note for this Vendor */}
                        <div className="bg-white border-t border-slate-50">
                            <DefaultInput
                                label="Note"
                                value={vendorNotes[group.business_id] || ""}
                                onChange={(val) => setVendorNotes(prev => ({ ...prev, [group.business_id]: val }))}
                                placeholder="Optional (seller confirm)"
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
                                        <span className="text-red-500">-₦{amount.toLocaleString()}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between items-center text-sm text-rose-600 font-black pt-1 border-t border-rose-50/50">
                                    <span>Total Savings</span>
                                    <span>-₦{globalSummary.totalDiscount.toLocaleString()}</span>
                                </div>
                            </div>
                        )}

                        <div className="pt-3 border-t border-slate-50 text-right justify-between items-right">
                            <span className="text-sm  text-slate-600 text-right">Total:  </span>
                            <span className="text-xl font-black text-slate-800">₦{globalSummary.grandTotal.toLocaleString()}</span>
                        </div>
                    </div>
                </section>

                {/* Payment Method Section */}
                <section className="bg-white space-y-4">

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
                </section>
            </main>

            {/* Bottom Final Checkout Bar */}
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-100 p-2">
                <div className="max-w-3xl mx-auto flex items-center justify-between gap-6">
                    <div className="flex-1 flex-col">
                        <span className="text-[12px]  text-slate-800 tracking-widest">Total</span>
                        <span className="text-sm  text-red-600 tracking-tight">₦{grandTotal.toLocaleString()}</span>
                    </div>

                    <button
                        onClick={handlePlaceOrder}
                        disabled={isProcessing || items.length === 0}
                        className=" bg-gradient-to-r from-red-600 to-rose-600 text-white px-4 py-1 rounded-2xl  hover:shadow-red-300 transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale flex items-center justify-center"
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

            <DeliveryAddressModal
                open={addressModalOpen}
                onClose={() => setAddressModalOpen(false)}
                onSave={(newAddr) => {
                    setAddress(newAddr);
                    setAddressModalOpen(false);
                    localStorage.setItem("stoqle_delivery_address", JSON.stringify(newAddr));
                }}
            />
        </div>
    );
}
