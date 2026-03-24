"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/src/lib/config";
import { useAuth } from "@/src/context/authContext";
import { useWallet } from "@/src/context/walletContext";
import { ChevronLeft, ChevronDown, ChevronUp, MessageCircle, Package, MapPin, Search, ChevronRight, CheckCircle, AlertTriangle, Clock, X, Star, Info, SlidersHorizontal, XCircle, Truck } from "lucide-react";
import { toast } from "sonner";
import Swal from "sweetalert2";
import Header from "@/src/components/header";
import { confirmOrderReceipt, reportOrderProblem } from "@/src/lib/api/walletApi";
import { cancelOrder } from "@/src/lib/api/orderApi";
import ReturnRefundModal from "@/src/components/orders/ReturnRefundModal";

interface OrderItem {
    order_id: number;
    product_name: string;
    product_image: string | null;
    quantity: number;
    unit_price: number;
    variant_info: string | null;
    status: string;
    item_cancel_reason?: string;
    item_cancel_explanation?: string;
    snapshot_data?: any;
    product_snapshot?: any; // Add for debugging/future-proofing
}

interface Shipment {
    shipment_id: number | string;
    status: string;
    shipping_promise: string | null;
    escrow_id: number | null;
    escrow_status: string | null;
    auto_release_at: string | null;
    items: OrderItem[];
    cancelled_by?: string;
    ship_cancel_reason?: string;
    ship_cancel_explanation?: string;
}

interface VendorOrder {
    sale_id: number;
    master_order_id?: number | string | null;
    vendor_id: number;
    vendor_name: string;
    vendor_logo: string | null;
    reference_no: string;
    total: number;
    status: string;
    business_owner_id?: number;
    reviewed?: boolean;
    review_rating?: number;
    review_comment?: string;
    customer_confirmed?: boolean;
    dispute_status?: 'none' | 'open' | 'closed';
    cancelled_by?: string;
    cancel_reason?: string;
    cancel_explanation?: string;
    shipments: Shipment[];
}

interface MasterOrder {
    order_id: number;
    total_amount: number;
    total_items: number;
    status: string;
    payment_status: string;
    payment_reference: string;
    created_at: string;
    vendors: VendorOrder[];
    customer_confirmed?: boolean; // For local UI state if needed
    dispute_status?: 'none' | 'open' | 'closed';
}

interface PendingCheckout {
    reference: string;
    amount: number;
    status: string;
    items: {
        title: string,
        quantity: number,
        price: number,
        variant_info?: string,
        business_name?: string,
        business_id?: number,
        business_owner_id: number | null,
        product_image?: string | null,
        business_logo?: string | null
    }[];
    created_at: string;
    metadata: any;
}

export default function MyOrdersPage() {
    const { user, token, isHydrated } = useAuth();
    const { refreshWallet } = useWallet();
    const router = useRouter();
    const navbarHeight = 64; // Standard navbar height from Shell
    const [orders, setOrders] = useState<MasterOrder[]>([]);
    const [pendingOrders, setPendingOrders] = useState<PendingCheckout[]>([]);
    const [activeTab, setActiveTab] = useState("All Orders");
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState<number | null>(null);
    const [messageLoading, setMessageLoading] = useState<number | null>(null);

    // Review Modal State
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [selectedOrderForReview, setSelectedOrderForReview] = useState<VendorOrder | null>(null);
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewComment, setReviewComment] = useState("");

    // Report Modal State
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [selectedOrderForReport, setSelectedOrderForReport] = useState<any>(null);
    const [reportReason, setReportReason] = useState("");

    // Comment Popover State
    const [activeCommentSaleId, setActiveCommentSaleId] = useState<number | null>(null);

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [selectedOrderForReturn, setSelectedOrderForReturn] = useState<any>(null);

    // Expansion State
    const [expandedMasters, setExpandedMasters] = useState<Record<number, boolean>>({});
    const [expandedVendors, setExpandedVendors] = useState<Record<number, boolean>>({});

    const toggleMaster = (masterId: number, autoExpand?: boolean, firstVendorId?: number) => {
        setExpandedMasters(prev => {
            const isExpanding = !prev[masterId];
            if (isExpanding && autoExpand && firstVendorId) {
                setExpandedVendors(vPrev => ({ ...vPrev, [firstVendorId]: true }));
            }
            return { ...prev, [masterId]: isExpanding };
        });
    };

    const toggleVendor = (saleId: number) => {
        setExpandedVendors(prev => ({ ...prev, [saleId]: !prev[saleId] }));
    };

    const searchRef = useRef<HTMLInputElement>(null);
    const tabRefs = useRef(new Map<string, HTMLButtonElement>());

    const mainTabs = ["All Orders", "Processing", "Completed", "Cancelled"];

    const formatUrl = (url: string | null) => {
        if (!url) return "";
        if (url.startsWith("http")) return url;
        return url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
    };

    const formatOrderDate = (dateString: string) => {
        if (!dateString) return "";
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return dateString;

        const day = d.toLocaleDateString('en-GB', { day: '2-digit' });
        const month = d.toLocaleDateString('en-GB', { month: 'long' });
        const year = d.toLocaleDateString('en-GB', { year: 'numeric' });
        const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase().replace(/\s+/g, '');

        return `${day} ${month}, ${year} - ${time}`;
    };

    const handleTabClick = (tab: string) => {
        setActiveTab(tab);
        const element = tabRefs.current.get(tab);
        if (element) {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center'
            });
        }
    };

    const fetchOrders = async (showLoading = true) => {
        if (!token) return;
        try {
            if (showLoading) setIsLoading(true);

            // Fetch both completed and pending concurrently
            const [ordersRes, pendingRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/orders/customer`, {
                    headers: { "Authorization": `Bearer ${token}` },
                    cache: 'no-store'
                }),
                fetch(`${API_BASE_URL}/api/payment/my-pending`, {
                    headers: { "Authorization": `Bearer ${token}` },
                    cache: 'no-store'
                })
            ]);

            const ordersData = await ordersRes.json();
            const pendingData = await pendingRes.json();

            if (ordersData.status === "success" || ordersData.success) {
                // Backend now deeply resolves structure!
                setOrders(ordersData.data || []);
            }
            if (pendingData.status === "success" || pendingData.success) {
                setPendingOrders(pendingData.data || []);
            }
        } catch (err) {
            console.error("Fetch orders err:", err);
            toast.error("Internal Server Error");
        } finally {
            if (showLoading) setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isHydrated && token) {
            fetchOrders();
            // Polling for real-time updates
            const interval = setInterval(() => {
                fetchOrders(false);
            }, 15000);
            return () => clearInterval(interval);
        }
    }, [token, isHydrated]);

    const getFilteredOrders = () => {
        let result = orders;

        // Apply Tab Filter First
        if (activeTab === "Processing") {
            // Include anything not fully final (Processing, Ships, Paid, Partially Cancelled but still running)
            result = orders.filter(o => {
                const s = o.status?.toLowerCase();
                return ['processing', 'partially_processing', 'order_placed', 'paid', 'confirmed', 'ready_for_shipping', 'picked_up', 'out_for_delivery', 'pending'].includes(s);
            });
        } else if (activeTab === "Completed") {
            // Fully delivered or delivered + some cancelled
            result = orders.filter(o => {
                const s = o.status?.toLowerCase();
                return ['delivered', 'completed', 'completed_with_cancellations', 'released'].includes(s);
            });
        } else if (activeTab === "Cancelled") {
            // Fully cancelled or refunded
            result = orders.filter(o => {
                const s = o.status?.toLowerCase();
                return ['cancelled', 'refunded'].includes(s);
            });
        } else if (activeTab === "All Orders") {
            result = orders;
        }

        // Apply Search Filter
        if (searchQuery) {
            result = result.filter(order =>
                order.order_id.toString().includes(searchQuery) ||
                order.vendors.some(v =>
                    v.vendor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    v.shipments.some(s => s.items.some(item => item.product_name.toLowerCase().includes(searchQuery.toLowerCase())))
                )
            );
        }

        return result;
    };

    const filteredOrders = getFilteredOrders();

    const getTimeGroup = (dateString: string) => {
        const now = new Date();
        const date = new Date(dateString);

        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const startOfYesterday = new Date(startOfToday);
        startOfYesterday.setDate(startOfYesterday.getDate() - 1);

        const day = now.getDay(); // 0(Sun) - 6(Sat)
        const diffToMonday = (day === 0 ? 6 : day - 1);
        const startOfThisWeek = new Date(startOfToday);
        startOfThisWeek.setDate(startOfThisWeek.getDate() - diffToMonday);

        const startOfLastWeek = new Date(startOfThisWeek);
        startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        if (date >= startOfToday) return 'Today';
        if (date >= startOfYesterday) return 'Yesterday';
        if (date >= startOfThisWeek) return 'This Week';
        if (date >= startOfLastWeek) return 'Last Week';
        if (date >= startOfThisMonth) return 'This month';
        if (date >= startOfLastMonth) return 'Last month';
        return 'Older';
    };

    const groupOrder = ['Today', 'Yesterday', 'This Week', 'Last Week', 'This month', 'Last month', 'Older'];

    const isRefundable = (item: any) => {
        const referenceDate = item.delivered_at || item.completed_at || item.updated_at;
        if (!item || !referenceDate) return false;

        let policy = { seven_day_no_reason: false, return_window: 3 };
        try {
            if (typeof item.return_policy === 'string') policy = JSON.parse(item.return_policy);
            else if (item.return_policy) policy = item.return_policy;
        } catch (e) { }

        const duration = (policy.seven_day_no_reason === true || String(policy.seven_day_no_reason) === "1") ? 7 : (Number(policy.return_window) || 3);

        let deliveredDate: Date;
        if (typeof referenceDate === 'string') {
            deliveredDate = new Date(referenceDate.replace(' ', 'T'));
        } else {
            deliveredDate = new Date(referenceDate as any);
        }

        if (!deliveredDate || isNaN(deliveredDate.getTime())) return false;

        const deadline = new Date(deliveredDate.getTime() + duration * 24 * 60 * 60 * 1000);
        return new Date() <= deadline;
    };

    const groupedOrders = filteredOrders.reduce((groups: Record<string, MasterOrder[]>, order) => {
        const group = getTimeGroup(order.created_at);
        if (!groups[group]) groups[group] = [];
        groups[group].push(order);
        return groups;
    }, {});

    const getStatusColor = (status: string) => {
        const s = status?.toLowerCase();
        switch (s) {
            case "completed":
            case "released":
            case "delivered":
            case "completed_with_cancellations":
                return "bg-green-100 text-green-700";

            case "processing":
            case "partially_processing":
            case "confirmed":
            case "paid":
                return "bg-indigo-100 text-indigo-700";

            case "ready_for_shipping":
            case "out_for_delivery":
                return "bg-blue-100 text-blue-700";

            case "order_placed":
            case "pending":
                return "bg-orange-100 text-orange-700";

            case "cancelled":
            case "refunded":
            case "disputed":
                return "bg-red-100 text-red-700";

            default: return "bg-slate-100 text-slate-700";
        }
    };

    const handleConfirmReceipt = async (escrowId: number, saleId: number) => {
        if (!escrowId) {
            toast.error("Escrow details not found for this delivery.");
            return;
        }

        const { isConfirmed } = await Swal.fire({
            title: 'Confirm Delivery',
            text: 'Did you receive this order? Confirming will release payment to the vendor.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#10B981',
            cancelButtonColor: '#94A3B8',
            confirmButtonText: 'Yes, Received',
            cancelButtonText: 'Not Yet',
            customClass: {
                popup: 'rounded-[1.5rem] p-6',
                confirmButton: 'rounded-xl px-6 py-3 font-bold text-xs',
                cancelButton: 'rounded-xl px-6 py-3 font-bold text-xs'
            }
        });

        if (!isConfirmed) return;

        setIsActionLoading(escrowId); // We use escrow for status track
        try {
            await confirmOrderReceipt(escrowId);
            toast.success("Delivery confirmed! Money released to vendor.");
            fetchOrders(false);
        } catch (err: any) {
            toast.error(err?.body?.message || "Failed to confirm receipt");
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleReportProblem = (escrowId: number, matchItem: any) => {
        setSelectedOrderForReport({ ...matchItem, escrow_id: escrowId });
        setReportReason("");
        setIsReportModalOpen(true);
    };

    const handleCancelOrder = async (order: MasterOrder, vendor: VendorOrder, shipment?: Shipment) => {
        const isShipment = !!shipment;
        const targetId = isShipment ? shipment.shipment_id : vendor.sale_id;

        const { value: reason } = await Swal.fire({
            title: isShipment ? 'Cancel Shipment?' : 'Cancel Order?',
            html: `
                <div class="flex flex-col gap-2 mt-4 text-left" id="cancellation-reasons">
                    <p class="text-xs text-slate-500 mb-2 px-2">Please tell us why you're cancelling this ${isShipment ? 'shipment' : 'order'}:</p>
                    <div class="space-y-2">
                        <button type="button" class="reason-btn w-full p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 hover:border-rose-100 transition-all flex items-center justify-between group active:scale-[0.98]" data-reason="Ordered by mistake">
                            <span class="text-sm font-semibold text-slate-700">Ordered by mistake</span>
                            <div class="w-4 h-4 rounded-full border-2 border-slate-100 group-hover:border-rose-500 flex items-center justify-center transition-colors">
                                <div class="w-2 h-2 rounded-full bg-rose-500 scale-0 group-hover:scale-100 transition-transform"></div>
                            </div>
                        </button>
                        <button type="button" class="reason-btn w-full p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 hover:border-rose-100 transition-all flex items-center justify-between group active:scale-[0.98]" data-reason="Found cheaper elsewhere">
                            <span class="text-sm font-semibold text-slate-700">Found cheaper elsewhere</span>
                            <div class="w-4 h-4 rounded-full border-2 border-slate-100 group-hover:border-rose-500 flex items-center justify-center transition-colors">
                                <div class="w-2 h-2 rounded-full bg-rose-500 scale-0 group-hover:scale-100 transition-transform"></div>
                            </div>
                        </button>
                        <button type="button" class="reason-btn w-full p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 hover:border-rose-100 transition-all flex items-center justify-between group active:scale-[0.98]" data-reason="Delivery too slow">
                            <span class="text-sm font-semibold text-slate-700">Delivery too slow</span>
                            <div class="w-4 h-4 rounded-full border-2 border-slate-100 group-hover:border-rose-500 flex items-center justify-center transition-colors">
                                <div class="w-2 h-2 rounded-full bg-rose-500 scale-0 group-hover:scale-100 transition-transform"></div>
                            </div>
                        </button>
                        <button type="button" class="reason-btn w-full p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 hover:border-rose-100 transition-all flex items-center justify-between group active:scale-[0.98]" data-reason="Changed mind">
                            <span class="text-sm font-semibold text-slate-700">Changed mind</span>
                            <div class="w-4 h-4 rounded-full border-2 border-slate-100 group-hover:border-rose-500 flex items-center justify-center transition-colors">
                                <div class="w-2 h-2 rounded-full bg-rose-500 scale-0 group-hover:scale-100 transition-transform"></div>
                            </div>
                        </button>
                        <button type="button" class="reason-btn w-full p-4 border border-slate-200 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all flex items-center justify-between group active:scale-[0.98]" data-reason="Other">
                            <span class="text-sm font-semibold text-slate-700">Other (optional)</span>
                            <div class="w-4 h-4 rounded-full border-2 border-slate-200 group-hover:border-slate-400 flex items-center justify-center transition-colors text-[10px] font-bold text-slate-400">+</div>
                        </button>
                    </div>
                </div>
            `,
            showConfirmButton: false,
            showCancelButton: true,
            cancelButtonText: 'Keep Order',
            customClass: {
                popup: 'rounded-[2rem] p-6',
                cancelButton: 'rounded-xl px-10 py-3 font-bold text-xs mt-2 w-full border-0 text-slate-500 bg-slate-50 hover:bg-slate-100'
            },
            didOpen: () => {
                const container = document.getElementById('cancellation-reasons');
                const btns = container?.querySelectorAll('.reason-btn');
                btns?.forEach(btn => {
                    btn.addEventListener('click', () => {
                        const r = btn.getAttribute('data-reason');
                        (Swal as any)._stqReason = r;
                        Swal.clickConfirm();
                    });
                });
            },
            preConfirm: () => {
                return (Swal as any)._stqReason;
            }
        });

        if (reason) {
            let finalReason = reason;
            if (reason === 'Other') {
                const { value: otherText } = await Swal.fire({
                    title: 'Cancellation Reason',
                    input: 'textarea',
                    inputPlaceholder: 'Please type your reason here (optional)...',
                    showCancelButton: true,
                    confirmButtonColor: '#F43F5E',
                    confirmButtonText: 'Confirm & Cancel',
                    cancelButtonColor: '#94A3B8',
                    customClass: {
                        popup: 'rounded-[2rem] p-8',
                        input: 'rounded-2xl border-slate-100 text-sm focus:ring-rose-500 h-32',
                        confirmButton: 'rounded-xl px-8 py-3 font-bold text-xs',
                        cancelButton: 'rounded-xl px-8 py-3 font-bold text-xs'
                    }
                });
                if (otherText === undefined) return;
                finalReason = otherText || 'Other';
            }

            setIsActionLoading(vendor.sale_id);
            try {
                // Use the new UNIFIED cancelOrder API
                await cancelOrder(vendor.sale_id, {
                    type: isShipment ? 'shipment' : 'entire',
                    shipment_id: isShipment ? shipment.shipment_id as number : undefined,
                    reason: finalReason,
                    cancelledBy: 'customer'
                });

                Swal.fire({
                    title: 'Cancelled!',
                    text: `Your ${isShipment ? 'shipment' : 'order'} has been cancelled and funds have been returned to your wallet.`,
                    icon: 'success',
                    confirmButtonColor: '#10B981',
                    customClass: {
                        popup: 'rounded-[2rem]',
                        confirmButton: 'rounded-xl px-6 py-3 font-bold   text-xs'
                    }
                });
                fetchOrders(false);
                refreshWallet();
            } catch (err: any) {
                toast.error(err?.body?.message || "Failed to cancel order");
            } finally {
                setIsActionLoading(null);
            }
        }
    };

    const submitReport = async () => {
        if (!selectedOrderForReport) return;
        if (!selectedOrderForReport.escrow_id) {
            toast.error("Order escrow details missing. Please contact support.");
            return;
        }
        if (!reportReason.trim()) {
            toast.error("Please provide a reason for the report.");
            return;
        }

        setIsActionLoading(selectedOrderForReport.sale_id);
        try {
            await reportOrderProblem(selectedOrderForReport.escrow_id, reportReason);
            toast.success("Problem reported. Payment has been held.");
            setIsReportModalOpen(false);
            fetchOrders(false);
        } catch (err: any) {
            toast.error(err?.body?.message || "Failed to report issue");
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleReturnRequest = async (data: { category: string; reason: string; explanation?: string }) => {
        if (!selectedOrderForReturn) return;
        const escrowId = selectedOrderForReturn.shipments[0]?.escrow_id;
        if (!escrowId) {
            toast.error("Order escrow details missing. Please contact support.");
            return;
        }

        setIsActionLoading(selectedOrderForReturn.sale_id);
        try {
            const finalReason = `[${data.category}] ${data.reason}${data.explanation ? `: ${data.explanation}` : ''}`;
            await reportOrderProblem(escrowId, finalReason);
            toast.success("Return request submitted. Administrators will review and contact you.");
            setIsReturnModalOpen(false);
            fetchOrders(false);
        } catch (err: any) {
            toast.error(err?.body?.message || "Failed to submit return request");
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleOpenReview = (vendor: VendorOrder) => {
        setSelectedOrderForReview(vendor);
        setReviewRating(5);
        setReviewComment("");
        setIsReviewModalOpen(true);
    };

    const submitReview = async () => {
        if (!selectedOrderForReview || !token) return;

        setIsActionLoading(selectedOrderForReview.sale_id);
        try {
            const res = await fetch(`${API_BASE_URL}/api/reviews`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    business_id: selectedOrderForReview.vendor_id,
                    order_id: selectedOrderForReview.sale_id,
                    rating: reviewRating,
                    comment: reviewComment
                })
            });
            const data = await res.json();
            if (data.status === 'success' || data.success) {
                toast.success("Review submitted! Thank you.");
                setIsReviewModalOpen(false);
                setSelectedOrderForReview(null);
                await fetchOrders(false);
            } else {
                toast.error(data.message || "Failed to submit review");
            }
        } catch (err) {
            toast.error("Error submitting review");
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleMessageVendor = async (vendor: VendorOrder) => {
        if (!token) {
            router.push("/login");
            return;
        }

        const profileUserId = vendor.business_owner_id;
        if (!profileUserId) {
            toast.error("Could not find vendor contact info");
            return;
        }

        setMessageLoading(vendor.sale_id);

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        };

        try {
            let convId: string | number | null = null;
            const tryEndpoints = [
                { url: `${API_BASE_URL}/api/chat/create`, body: { other_user_id: profileUserId } },
                { url: `${API_BASE_URL}/api/conversations/init`, body: { user_id: profileUserId } },
            ];

            for (const ep of tryEndpoints) {
                try {
                    const resp = await fetch(ep.url, {
                        method: "POST",
                        headers,
                        body: JSON.stringify(ep.body),
                    });

                    const json = await resp.json().catch(() => null);
                    if (resp.ok && json) {
                        convId = json?.chat_room_id ?? json?.data?.chat_room_id ?? json?.id ?? json?.data?.id ?? null;
                        if (convId) break;
                    }
                } catch (err) {
                    console.warn("conversation init attempt failed:", ep.url, err);
                }
            }

            if (convId) {
                router.push(`/messages?room=${convId}&order_ref=${vendor.reference_no}&order_id=${vendor.master_order_id || ""}`);
                return;
            }

            router.push(`/messages?user=${profileUserId}&order_ref=${vendor.reference_no}&order_id=${vendor.master_order_id || ""}`);
        } catch (err) {
            console.error("Failed to init conversation:", err);
            router.push(`/messages?user=${profileUserId}&order_ref=${vendor.reference_no}`);
        } finally {
            setMessageLoading(null);
        }
    };
    const CountdownTimer = ({ targetDate }: { targetDate: string }) => {
        const [timeLeft, setTimeLeft] = useState<string>("");

        useEffect(() => {
            const calculateTimeLeft = () => {
                const now = new Date().getTime();
                const target = new Date(targetDate).getTime();
                const difference = target - now;

                if (difference <= 0) {
                    setTimeLeft("Processing...");
                    return;
                }

                const days = Math.floor(difference / (1000 * 60 * 60 * 24));
                const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));

                let result = "";
                if (days > 0) result += `${days}d `;
                if (hours > 0 || days > 0) result += `${hours}h `;
                result += `${minutes}m`;

                setTimeLeft(result);
            };

            calculateTimeLeft();
            const timer = setInterval(calculateTimeLeft, 60000); // Update every minute

            return () => clearInterval(timer);
        }, [targetDate]);

        return (
            <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100 animate-in fade-in duration-500">
                <Clock size={12} className="animate-pulse" />
                <span className="text-[10px] font-bold  tracking-wider">Auto-confirms in {timeLeft}</span>
            </div>
        );
    };


    const OrderSkeleton = () => (
        <div className="bg-white p-4 animate-pulse">
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-50">
                <div className="flex gap-4 items-center">
                    <div className="w-14 h-14 bg-slate-100 rounded-2xl" />
                    <div className="space-y-2">
                        <div className="w-32 h-4 bg-slate-100 rounded-lg" />
                        <div className="w-20 h-3 bg-slate-50 rounded-lg" />
                    </div>
                </div>
                <div className="w-24 h-8 bg-slate-100 rounded-full" />
            </div>
            <div className="space-y-6">
                {[1, 2].map((i) => (
                    <div key={i} className="flex gap-4">
                        <div className="w-16 h-16 bg-slate-50 rounded-xl" />
                        <div className="flex-1 space-y-2 py-1">
                            <div className="w-2/3 h-4 bg-slate-100 rounded-lg" />
                            <div className="w-1/4 h-3 bg-slate-50 rounded-lg" />
                        </div>
                    </div>
                ))}
            </div>
            <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between gap-4">
                <div className="w-24 h-10 bg-slate-50 rounded-xl" />
                <div className="flex gap-3">
                    <div className="w-32 h-10 bg-slate-100 rounded-2xl" />
                    <div className="w-10 h-10 bg-slate-900/10 rounded-full" />
                </div>
            </div>
        </div>
    );

    if (!isHydrated) {
        return (
            <div className="min-h-screen bg-[#F8FAFC]">
                <div className="h-[60px] md:h-0"></div>
                <main className="md:p-10 pb-20 p-3">
                    <div className="mb-5">
                        <div className="w-48 h-8 bg-slate-200 animate-pulse rounded-xl mb-2" />
                    </div>
                    <div className="grid grid-cols-1 gap-8">
                        {[1, 2, 3, 4].map((i) => <OrderSkeleton key={i} />)}
                    </div>
                </main>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 text-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center  mb-6">
                    <Package className="text-slate-300" size={32} />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Login Required</h2>
                <p className="text-slate-500 max-w-xs mb-8">Please login to access your order history and track deliveries.</p>
                <button
                    onClick={() => router.push("/login")}
                    className="px-8 py-3 bg-black text-white rounded-2xl font-bold  shadow-black/10 active:scale-95 transition"
                >
                    Return to Login
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100">

            <main className=" md:p-10 pb-10 p-3">
                <div
                    className="sticky z-[100] bg-[#F8FAFC]/80 backdrop-blur-md -mx-3 px-4 py-4 md:bg-transparent md:backdrop-none md:p-0 md:border-0 md:mx-0 border-b border-slate-100 md:border-b-0"
                    style={{ top: `${navbarHeight}px` }}
                >
                    <div className="flex items-center justify-between gap-4 min-h-[44px]">
                        {!isSearchOpen ? (
                            <div className="flex items-center gap-2 overflow-hidden">
                                <button
                                    onClick={() => router.back()}
                                    className="md:hidden p-2 -ml-2 rounded-full hover:bg-white transition-colors"
                                    title="Back"
                                >
                                    <ChevronLeft className="h-6 w-6 text-slate-600" />
                                </button>
                                <div className="space-y-0">
                                    <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight whitespace-nowrap">Purchase History</h1>
                                </div>
                                {orders.length > 0 && (
                                    <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-100 flex items-center gap-1.5 w-fit shrink-0">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-[9px] font-bold text-slate-600  ">{orders.length}</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 animate-in slide-in-from-right-4 fade-in duration-300 flex items-center gap-2">
                                <button
                                    onClick={() => router.back()}
                                    className="md:hidden p-2 -ml-2 rounded-full hover:bg-white transition-colors shrink-0"
                                    title="Back"
                                >
                                    <ChevronLeft className="h-6 w-6 text-slate-600" />
                                </button>
                                <div className="relative flex-1">
                                    <input
                                        ref={searchRef}
                                        type="search"
                                        placeholder="Search products, orders..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="
                                            w-full
                                            rounded-lg
                                            bg-white
                                            border border-slate-200
                                            pl-4
                                            pr-10
                                            py-2
                                            text-sm
                                            text-black
                                            caret-rose-500
                                            outline-none
                                            transition
                                            focus:ring-rose-500/10
                                        "
                                        autoFocus
                                        aria-label="Search"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300">
                                        <Search size={16} />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-2 shrink-0 ml-auto">
                            <button
                                onClick={() => {
                                    setIsSearchOpen(!isSearchOpen);
                                    if (isSearchOpen) setSearchQuery("");
                                }}
                                className={`h-8 w-8 flex items-center justify-center rounded-lg border transition-all ${isSearchOpen ? 'bg-rose-500 border-rose-500 text-white  shadow-rose-500/20' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 '}`}
                                title={isSearchOpen ? "Close Search" : "Search Orders"}
                            >
                                {isSearchOpen ? <X size={20} /> : <Search size={20} />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Tabs Navigation */}
                <div
                    className="flex items-center gap-1 overflow-x-auto no-scrollbar py-2 mb-6 -mx-3 px-2 sticky z-[90] bg-[#F8FAFC]/95 backdrop-blur-sm border-b border-slate-100 md:static md:bg-transparent md:backdrop-none md:border-b-0 md:mx-0 md:py-1"
                    style={{ top: `${navbarHeight + (window?.innerWidth < 768 ? 76 : 0)}px` }}
                >
                    {mainTabs.map((tab) => {
                        const isOrderDisputed = (o: MasterOrder) =>
                            o.dispute_status === 'open' ||
                            o.status?.toLowerCase() === 'cancelled' ||
                            o.status?.toLowerCase() === 'canceled' ||
                            o.status?.toLowerCase() === 'disputed' ||
                            o.status?.toLowerCase() === 'refunded';

                        const count =
                            tab === "All Orders" ? orders.length :
                                tab === "Processing" ? orders.filter(o => ['processing', 'partially_processing', 'order_placed', 'paid', 'confirmed', 'shipped', 'picked_up', 'out_for_delivery', 'pending'].includes(o.status?.toLowerCase() || '')).length :
                                    tab === "Completed" ? orders.filter(o => ['delivered', 'completed', 'completed_with_cancellations', 'released'].includes(o.status?.toLowerCase() || '')).length :
                                        tab === "Cancelled" ? orders.filter(o => ['cancelled', 'refunded'].includes(o.status?.toLowerCase() || '')).length : 0;

                        return (
                            <button
                                key={tab}
                                ref={(el) => { if (el) tabRefs.current.set(tab, el); }}
                                onClick={() => handleTabClick(tab)}
                                className={`
                                    relative flex items-center gap-2 px-2 py-3 font-medium text-[15px] transition-all shrink-0
                                    ${activeTab === tab ? "text-red-500" : "text-slate-400 hover:text-slate-600"}
                                `}
                            >
                                <span className="relative pb-1">
                                    {tab}
                                    {count > 0 && (
                                        <span className="ml-1 text-[11px] opacity-70">
                                            ({count})
                                        </span>
                                    )}
                                    {activeTab === tab && (
                                        <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-red-500 rounded-full" />
                                    )}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 gap-8">
                        {[1, 2, 3, 4].map((i) => <OrderSkeleton key={i} />)}
                    </div>
                ) : (activeTab === "Pending Order" ? pendingOrders : filteredOrders).length === 0 ? (
                    <div className="bg-white rounded-lg p-16 flex flex-col items-center justify-center text-center  shadow-slate-200/50 border border-slate-100">
                        <img
                            src="/assets/images/cart.png"
                            alt="No orders"
                            className="w-30 h-30 object-contain animate-in zoom-in-95 duration-500"
                        />

                        <h3 className="text-sm text-slate-500 mb-2">
                            {searchQuery ? "No matching orders" : `No ${activeTab.toLowerCase()}s found`}
                        </h3>
                        {/* <p className="text-slate-500 max-w-xs mb-8 font-medium">
                            {searchQuery
                                ? "Try adjusting your search to find what you're looking for."
                                : activeTab === "Pending Order"
                                    ? "Items you started checking out but didn't finish will appear here."
                                    : `When you have orders in ${activeTab.toLowerCase()} state, they will appear here.`
                            }
                        </p> */}
                        {searchQuery && (
                            <button
                                onClick={() => { setSearchQuery(""); }}
                                className="px-8 py-3 bg-slate-900 text-white rounded-lg font-bold text-xs active:scale-95 transition"
                            >
                                Clear Search
                            </button>
                        )}
                    </div>
                ) : activeTab === "Pending Order" ? (
                    /* Render Pending Checkouts Grouped by Date */
                    <div className="space-y-10">
                        {(() => {
                            const groupedPending = pendingOrders.reduce((groups: Record<string, PendingCheckout[]>, p) => {
                                const group = getTimeGroup(p.created_at);
                                if (!groups[group]) groups[group] = [];
                                groups[group].push(p);
                                return groups;
                            }, {});

                            return groupOrder.map(groupName => {
                                const groupItems = groupedPending[groupName];
                                if (!groupItems || groupItems.length === 0) return null;

                                return (
                                    <div key={groupName} className="space-y-6">
                                        <div className="flex items-center gap-4 px-1">
                                            <span className="text-[10px] font-bold text-rose-500 tracking-[0.3em] whitespace-nowrap">{groupName}</span>
                                            <div className="h-px bg-rose-100 flex-1" />
                                        </div>

                                        <div className="space-y-6">
                                            {groupItems.map((pending) => (
                                                <div key={pending.reference} className="bg-white shadow-slate-200/50 border border-slate-100 overflow-hidden md:rounded-lg p-6">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                                            <span className="text-[10px] font-semibold text-slate-400">Checkout attempt</span>
                                                        </div>
                                                        <div className="text-[10px] font-bold text-slate-300 ml-auto">
                                                            {new Date(pending.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                    <div className="space-y-6">
                                                        {Object.entries(
                                                            pending.items.reduce((acc, item) => {
                                                                const bid = item.business_id || 0;
                                                                if (!acc[bid]) acc[bid] = [];
                                                                acc[bid].push(item);
                                                                return acc;
                                                            }, {} as Record<number, typeof pending.items>)
                                                        ).map(([bid, items], bIdx) => (
                                                            <div key={bid || bIdx} className="space-y-4">
                                                                <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center overflow-hidden">
                                                                            {items[0].business_logo ? (
                                                                                <img src={formatUrl(items[0].business_logo)} alt="" className="w-full h-full object-cover" />
                                                                            ) : (
                                                                                <div className="text-slate-200 font-bold text-lg">{items[0].business_name?.charAt(0)}</div>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex-1 overflow-hidden">
                                                                            <span className="text-[11px] font-semibold text-slate-600 block truncate max-w-[140px] md:max-w-none">{items[0].business_name}</span>
                                                                        </div>
                                                                    </div>
                                                                    {items[0].business_owner_id && (
                                                                        <button
                                                                            onClick={() => handleMessageVendor({
                                                                                business_owner_id: items[0].business_owner_id,
                                                                                sale_id: pending.reference as any,
                                                                                business_name: items[0].business_name
                                                                            } as any)}
                                                                            className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-lg text-[10px] transition hover:bg-rose-100 "
                                                                        >
                                                                            <MessageCircle size={14} />
                                                                            Chat Vendor
                                                                        </button>
                                                                    )}
                                                                </div>

                                                                <div className="space-y-5">
                                                                    {items.map((item, idx) => (
                                                                        <div key={item.title + idx} className="flex gap-4 items-center">
                                                                            <div className="w-16 h-16 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100 overflow-hidden ">
                                                                                {item.product_image ? (
                                                                                    <img src={formatUrl(item.product_image)} alt="" className="w-full h-full object-cover" />
                                                                                ) : (
                                                                                    <Package size={24} className="text-slate-200" />
                                                                                )}
                                                                            </div>
                                                                            <div className="flex-1">
                                                                                <h4 className="text-[12px]  text-slate-500 line-clamp-2 leading-snug">{item.title}</h4>
                                                                                {item.variant_info && (
                                                                                    <div className="flex items-center gap-1.5 mt-1.5">
                                                                                        <div className="w-1 h-1 rounded-full bg-rose-500/30" />
                                                                                        <p className="text-[10px] text-rose-500 font-bold tracking-wide ">{item.variant_info}</p>
                                                                                    </div>
                                                                                )}
                                                                                <p className="text-xs text-slate-400 mt-2 font-medium">Qty: <span className="text-slate-600 font-bold">{item.quantity}</span> • <span className="text-slate-800 font-bold">₦{Number(item.price || 0).toLocaleString()}</span></p>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
                                                        <div>
                                                            <p className="text-[9px] font-semibold text-slate-400">Total interested</p>
                                                            <p className="text-lg font-bold text-slate-900">₦{Number(pending.amount || 0).toLocaleString()}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => router.push('/checkout')}
                                                            className="px-6 py-2.5 bg-rose-500 text-white rounded-2xl font-bold text-[10px]   shadow-lg shadow-rose-500/20 active:scale-95 transition"
                                                        >
                                                            Continue to Pay
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                ) : (
                    <div className="space-y-10">
                        {groupOrder.map(groupName => {
                            const groupItems = groupedOrders[groupName];
                            if (!groupItems || groupItems.length === 0) return null;

                            return (
                                <div key={groupName} className="space-y-4">
                                    <div className="flex items-center gap-4 px-1">
                                        <span className="text-[10px] text-rose-500  tracking-[0.3em] whitespace-nowrap">{groupName}</span>
                                        <div className="h-px bg-rose-100 flex-1" />
                                    </div>

                                    <div className="space-y-6">
                                        {groupItems.map((master) => (
                                            <div key={`master-${master.order_id}`} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm shadow-slate-200/50">
                                                {/* Master Order Header */}
                                                <div
                                                    onClick={() => toggleMaster(master.order_id, master.vendors.length === 1 && master.vendors[0]?.shipments.length === 1, master.vendors[0]?.sale_id)}
                                                    className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-100/60 transition group"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className={`p-1.5 rounded-lg border border-slate-200 text-slate-400 group-hover:text-rose-500 transition-colors ${expandedMasters[master.order_id] ? 'rotate-180 bg-rose-50 border-rose-100 text-rose-500' : 'bg-white'}`}>
                                                            <ChevronDown size={16} />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2.5 mb-0.5">
                                                                <h3 className="font-bold text-slate-800 text-sm md:text-base">
                                                                    Order <span className="text-slate-400">#{master.order_id}</span>
                                                                </h3>
                                                                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${getStatusColor(master.status)}`}>
                                                                    {master.status === 'completed_with_cancellations' ? 'Completed (with cancellations)' : master.status?.replace(/_/g, ' ')}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                                                                <span>{formatOrderDate(master.created_at)}</span>
                                                                <span className="w-1 h-1 bg-slate-200 rounded-full" />
                                                                <span className="text-slate-500">{master.vendors.length} {master.vendors.length === 1 ? 'Vendor' : 'Vendors'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right md:text-right md:border-l md:border-slate-200 md:pl-6 ">
                                                        <p className="text-[9px] font-bold text-slate-400 tracking-widest mb-0.5">Order Total</p>
                                                        <p className="text-base md:text-lg font-black text-slate-900 leading-tight">₦{Number(master.total_amount).toLocaleString()}</p>
                                                    </div>
                                                </div>

                                                {/* Iterating Vendors within Master Order */}
                                                <div className={`divide-y divide-slate-100 transition-all duration-300 overflow-hidden ${expandedMasters[master.order_id] ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                                    {master.vendors.map((vendor) => (
                                                        <div key={`vendor-${vendor.sale_id || vendor.vendor_id}`} className="bg-white border-b border-slate-50 last:border-0">
                                                            {/* Vendor Header */}
                                                            <div
                                                                className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors"
                                                                onClick={(e) => toggleVendor(vendor.sale_id)}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`text-slate-300 transition-transform duration-300 ${expandedVendors[vendor.sale_id] ? 'rotate-180 text-slate-500' : ''}`}>
                                                                        <ChevronDown size={14} />
                                                                    </div>
                                                                    <div className="flex items-center gap-2.5 cursor-pointer hover:opacity-75 transition" onClick={(e) => { e.stopPropagation(); router.push(`/shop/${vendor.vendor_id}`); }}>
                                                                        <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                                                                            {vendor.vendor_logo ? (
                                                                                <img src={formatUrl(vendor.vendor_logo)} alt="" className="w-full h-full object-cover" />
                                                                            ) : (
                                                                                <div className="text-slate-300 font-bold text-xs">{vendor.vendor_name?.charAt(0)}</div>
                                                                            )}
                                                                        </div>
                                                                        <div>
                                                                            <h4 className="font-bold text-slate-700 text-xs md:text-sm truncate max-w-[150px] md:max-w-none">
                                                                                {vendor.vendor_name}
                                                                            </h4>
                                                                            <p className="text-[9px] font-bold text-slate-400">Ref: <span className="text-slate-500 uppercase">{vendor.reference_no}</span></p>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                                                                    <div className="text-right hidden sm:block">
                                                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Vendor Total</p>
                                                                        <p className="text-xs font-black text-slate-800">₦{Number(vendor.total).toLocaleString()}</p>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => handleMessageVendor(vendor)}
                                                                        disabled={messageLoading === vendor.sale_id}
                                                                        className="h-8 px-3 flex items-center justify-center gap-1.5 rounded-full bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition disabled:opacity-70 group/btn"
                                                                        title="Message Vendor"
                                                                    >
                                                                        {messageLoading === vendor.sale_id ? (
                                                                            <div className="w-3 h-3 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
                                                                        ) : (
                                                                            <>
                                                                                <MessageCircle size={14} className="text-slate-400 group-hover/btn:text-slate-600" />
                                                                                <span className="text-[10px] font-bold hidden md:inline">Contact</span>
                                                                            </>
                                                                        )}
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Vendor Shipments (Tightened Grouping) */}
                                                            <div className={`transition-all duration-300 overflow-hidden ${expandedVendors[vendor.sale_id] ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                                                <div className="pl-6 pr-4 pb-4 space-y-3 border-l-2 border-slate-100 ml-9 mt-1 mb-3">
                                                                    {/* Sort shipments by duration (lowest to highest) */}
                                                                    {[...vendor.shipments]
                                                                        .sort((a, b) => {
                                                                            const extractNum = (s: string | null | undefined) => {
                                                                                if (!s) return Infinity;
                                                                                const match = s.match(/\d+/);
                                                                                return match ? parseInt(match[0]) : Infinity;
                                                                            };
                                                                            return extractNum(a.shipping_promise) - extractNum(b.shipping_promise);
                                                                        })
                                                                        .map((ship, sIdx, sortedArr) => {
                                                                            const statuses = sortedArr.map(s => s.status?.toLowerCase());
                                                                            const isPartial = statuses.some(s => ['cancelled', 'refunded', 'canceled'].includes(s || '')) && statuses.some(s => !['cancelled', 'refunded', 'canceled'].includes(s || ''));
                                                                            const isAllCancelled = sortedArr.length > 0 && statuses.every(s => ['cancelled', 'refunded', 'canceled'].includes(s || ''));

                                                                            return (
                                                                                <div key={`shipment-${ship.shipment_id || sIdx}`} className="space-y-2">
                                                                                    {/* Shipment Divider (Sorted Index) */}
                                                                                    {sortedArr.length > 1 && (
                                                                                        <div className="flex items-center gap-3 px-1.5 py-1">
                                                                                            <div className="h-px flex-1 bg-slate-100"></div>
                                                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Shipment {sIdx + 1}</span>
                                                                                            <div className="h-px flex-1 bg-slate-100"></div>
                                                                                        </div>
                                                                                    )}
                                                                                    {/* Shipment Mini Header */}
                                                                                    <div className="px-4 py-1.5 flex items-center justify-between">
                                                                                        {/* Shipment status relocated to item row */}
                                                                                    </div>

                                                                                    {/* Shipment Items */}
                                                                                    <div className=" ">
                                                                                        {(ship.status === 'cancelled' || ship.status === 'refunded') && ship.ship_cancel_reason && (
                                                                                            <div className="px-3 py-2 bg-red-50 text-red-700 border border-red-100 rounded-[0.5rem">
                                                                                                <div className="flex items-center gap-1.5 font-bold text-[10px] uppercase">
                                                                                                    <AlertTriangle size={12} /> {ship.ship_cancel_reason.replace(/_/g, ' ')}
                                                                                                </div>
                                                                                            </div>
                                                                                        )}

                                                                                        <div className="divide-y divide-slate-50">
                                                                                            {ship.items.map((item, iIdx) => (
                                                                                                <div key={`item-${item.order_id || iIdx}`} className="flex gap-3 md:gap-4 items-start py-2.5 group/item first:pt-0 last:pb-0">
                                                                                                    <div className="w-12 h-12 md:w-14 md:h-14 bg-slate-50 rounded-lg overflow-hidden border border-slate-100 shrink-0 ">
                                                                                                        {item.product_image ? (
                                                                                                            <img src={formatUrl(item.product_image)} alt={item.product_name} className="w-full h-full object-cover" />
                                                                                                        ) : (
                                                                                                            <div className="w-full h-full flex items-center justify-center text-slate-300"><Package size={16} /></div>
                                                                                                        )}
                                                                                                    </div>
                                                                                                    <div className="flex-1 min-w-0">
                                                                                                        <div className="flex items-center justify-between gap-2">
                                                                                                            <h4 className="text-slate-700 text-[11px] md:text-xs font-bold leading-tight line-clamp-1 flex-1">{item.product_name}</h4>
                                                                                                            <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${getStatusColor(ship.status)}`}>
                                                                                                                {ship.status?.replace(/_/g, ' ')}
                                                                                                            </span>
                                                                                                        </div>
                                                                                                        <div className="flex items-center gap-2 mt-0.5">
                                                                                                            <p className="text-[11px] font-black text-slate-900">₦{(item.unit_price * item.quantity).toLocaleString()}</p>
                                                                                                            <span className="text-[9px] font-bold text-slate-400">Qty: {item.quantity}</span>
                                                                                                        </div>
                                                                                                        {item.variant_info && (
                                                                                                            <div className="mt-1 text-[8px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded w-fit border border-slate-100 leading-none">{item.variant_info}</div>
                                                                                                        )}
                                                                                                    </div>
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>

                                                                                    <div className=" mb-1 px-2 py-1 bg-slate-50 rounded-[0.5rem] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3  border border-slate-200/50">
                                                                                        <div className="flex flex-wrap items-center gap-2.5">
                                                                                            <span className="text-[9px] font-black text-slate-500 bg-white/50 px-1.5 py-0.5 rounded border border-slate-300 ">Delivery Info</span>
                                                                                            {(() => {
                                                                                                const calculateDate = (base: string | undefined, duration?: number | string | null, unit?: string | null) => {
                                                                                                    if (!base || duration === undefined || duration === null || duration === '') return null;
                                                                                                    const date = new Date(base as string);
                                                                                                    const dNum = typeof duration === 'string' ? (duration.match(/\d+/)?.[0] ? parseInt(duration.match(/\d+/)![0]) : 0) : duration;

                                                                                                    let unitLower = (unit || '').toLowerCase();
                                                                                                    // Fallback: detect unit from duration string if unit is missing
                                                                                                    if (!unit && typeof duration === 'string') {
                                                                                                        if (duration.toLowerCase().includes('week')) unitLower = 'weeks';
                                                                                                        else if (duration.toLowerCase().includes('hour')) unitLower = 'hours';
                                                                                                        else if (duration.toLowerCase().includes('minute')) unitLower = 'minutes';
                                                                                                    }

                                                                                                    if (unitLower.includes('week')) {
                                                                                                        date.setDate(date.getDate() + (dNum * 7));
                                                                                                    } else if (unitLower.includes('hour')) {
                                                                                                        date.setHours(date.getHours() + dNum);
                                                                                                    } else if (unitLower.includes('minute')) {
                                                                                                        date.setMinutes(date.getMinutes() + dNum);
                                                                                                    } else {
                                                                                                        // default to days
                                                                                                        date.setDate(date.getDate() + dNum);
                                                                                                    }

                                                                                                    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
                                                                                                };

                                                                                                const policy = ship.items[0]?.snapshot_data?.shippingPolicy;
                                                                                                const avgDate = calculateDate(master.created_at, policy?.avgDuration ?? ship.items[0]?.snapshot_data?.policies?.shipping?.avg, policy?.avgUnit);
                                                                                                const promiseDate = calculateDate(master.created_at, policy?.promiseDuration ?? ship.shipping_promise, policy?.promiseUnit);

                                                                                                return (
                                                                                                    <>
                                                                                                        {(avgDate || ship.items[0]?.snapshot_data?.policies?.shipping?.transit_time_hrs) && (
                                                                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                                                                {avgDate && (
                                                                                                                    <div className="text-[9px] font-bold text-slate-600 flex items-center gap-1.5">
                                                                                                                        <span>
                                                                                                                            Expected ship: {avgDate}
                                                                                                                            {ship.items[0]?.snapshot_data?.policies?.shipping?.distance_km && (
                                                                                                                                <> and transit in {Math.round(ship.items[0]?.snapshot_data?.policies?.shipping?.distance_km * 5)} mins</>
                                                                                                                            )}
                                                                                                                        </span>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                                {ship.items[0]?.snapshot_data?.policies?.shipping?.transit_time_hrs && (
                                                                                                                    <div className="text-[8px] font-bold text-blue-700 bg-blue-100/50 px-1.5 py-0.5 rounded border border-blue-200/50 flex items-center gap-1">
                                                                                                                        <Truck size={8} />
                                                                                                                        <span>Ride: {ship.items[0]?.snapshot_data?.policies?.shipping?.transit_time_hrs}</span>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                            </div>
                                                                                                        )}
                                                                                                        {promiseDate && ship.status !== 'delivered' && ship.status !== 'cancelled' && (
                                                                                                            <div className="flex flex-wrap items-center gap-2 border-l border-slate-300 pl-2.5 ml-0.5 mt-0.5 sm:mt-0">
                                                                                                                <div className="text-[8px] font-bold text-amber-700 bg-amber-100/50 px-1.5 py-0.5 rounded border border-amber-200/50 flex items-center gap-1">
                                                                                                                    <Clock size={8} />
                                                                                                                    <span>Promise by: {promiseDate}</span>
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        )}
                                                                                                    </>
                                                                                                );
                                                                                            })()}
                                                                                        </div>

                                                                                        <div className="flex items-center justify-end gap-2">
                                                                                            {ship.status === 'out_for_delivery' && (
                                                                                                <button
                                                                                                    onClick={() => router.push(`/profile/orders/track/${ship.items[0]?.order_id || vendor.sale_id}`)}
                                                                                                    className="h-7 px-3 bg-slate-900 text-white rounded-lg font-bold text-[9px] active:scale-95 transition whitespace-nowrap"
                                                                                                >
                                                                                                    Track
                                                                                                </button>
                                                                                            )}

                                                                                            {ship.shipment_id && ship.shipment_id !== 'standard' && ['order_placed', 'pending'].includes(ship.status?.toLowerCase()) && (
                                                                                                <button
                                                                                                    onClick={() => handleCancelOrder(master, vendor, ship)}
                                                                                                    disabled={isActionLoading === vendor.sale_id}
                                                                                                    className="h-7 px-3 bg-white border border-rose-200 text-rose-600 rounded-lg font-bold text-[9px] hover:bg-rose-50 transition whitespace-nowrap flex items-center justify-center min-w-[60px]"
                                                                                                >
                                                                                                    {isActionLoading === vendor.sale_id ? (
                                                                                                        <div className="w-3 h-3 border-2 border-slate-300 border-t-rose-600 rounded-full animate-spin" />
                                                                                                    ) : (
                                                                                                        'Cancel'
                                                                                                    )}
                                                                                                </button>
                                                                                            )}

                                                                                            {ship.status === 'delivered' && !vendor.customer_confirmed && ship.shipment_id !== 'standard' && (
                                                                                                <>
                                                                                                    {ship.escrow_status === 'disputed' ? (
                                                                                                        <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">Disputed</span>
                                                                                                    ) : (
                                                                                                        <div className="flex items-center gap-1.5">
                                                                                                            <button
                                                                                                                onClick={() => handleConfirmReceipt(ship.escrow_id!, vendor.sale_id)}
                                                                                                                className="h-7 px-3 bg-emerald-500 text-white rounded-lg font-bold text-[9px] hover:bg-emerald-600 transition whitespace-nowrap"
                                                                                                            >
                                                                                                                Confirm
                                                                                                            </button>
                                                                                                            <button
                                                                                                                onClick={() => handleReportProblem(ship.escrow_id!, vendor)}
                                                                                                                className="h-7 px-3 bg-white border border-slate-300 text-slate-700 rounded-lg font-bold text-[9px] hover:bg-slate-50 transition whitespace-nowrap"
                                                                                                            >
                                                                                                                Report
                                                                                                            </button>
                                                                                                        </div>
                                                                                                    )}
                                                                                                </>
                                                                                            )}

                                                                                            {vendor.customer_confirmed && (
                                                                                                <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-700 mr-1 whitespace-nowrap">
                                                                                                    <CheckCircle size={12} /> Confirmed
                                                                                                </div>
                                                                                            )}
                                                                                            {!vendor.reviewed && vendor.customer_confirmed && (
                                                                                                <button
                                                                                                    onClick={() => handleOpenReview(vendor)}
                                                                                                    className="h-7 px-3 bg-rose-100 text-rose-600 border border-rose-200 rounded-lg font-bold text-[9px] hover:bg-rose-200 transition whitespace-nowrap"
                                                                                                >
                                                                                                    Review
                                                                                                </button>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Review Modal */}
            {isReviewModalOpen && selectedOrderForReview && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-[0.5rem]  overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 leading-tight">Review Your Order</h3>
                                <p className="text-[10px] font-bold text-slate-400   mt-1">Order #{selectedOrderForReview!.sale_id}</p>
                            </div>
                            <button onClick={() => setIsReviewModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-full transition">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="flex flex-col items-center gap-4">
                                <p className="text-xs font-bold text-slate-500  ">Rate the vendor</p>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            onClick={() => setReviewRating(star)}
                                            className="hover:scale-125 transition"
                                        >
                                            <Star
                                                size={32}
                                                className={star <= reviewRating ? "text-amber-400 fill-amber-400" : "text-slate-200"}
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-slate-400   ml-1">Write a Review</label>
                                <textarea
                                    value={reviewComment}
                                    onChange={(e) => setReviewComment(e.target.value)}
                                    placeholder="Tell others about your experience..."
                                    className="w-full min-h-[120px] bg-slate-100 border border-slate-200 rounded-[0.5rem] p-5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition resize-none"
                                />
                            </div>

                            <button
                                onClick={submitReview}
                                disabled={isActionLoading === selectedOrderForReview!.sale_id}
                                className="w-full py-2 bg-red-500 text-white rounded-full hover:scale-[1.02] active:scale-95 transition disabled:opacity-50"
                            >
                                {isActionLoading === selectedOrderForReview!.sale_id ? 'Wait...' : 'Submit Review'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Report Problem Modal */}
            {isReportModalOpen && selectedOrderForReport && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-lg rounded-[0.5rem] overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-bold text-slate-900 leading-tight">Report a Problem</h3>
                                <p className="text-[10px] font-bold text-rose-500   mt-1">Dispute for Order #{selectedOrderForReport!.sale_id}</p>
                            </div>
                            <button onClick={() => setIsReportModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-full transition">
                                <X size={24} className="text-slate-400" />
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="bg-rose-50 border border-rose-100 p-6 rounded-lg space-y-3">
                                <div className="flex items-center gap-3 text-rose-600">
                                    <AlertTriangle size={20} />
                                    <h4 className="font-bold text-[10px]  ">Important Note</h4>
                                </div>
                                <p className="text-[11px] text-rose-700/80 font-medium leading-relaxed">
                                    Reporting a problem will put the payment on hold. Stoqle administrators will review the dispute and contact both you and the vendor.
                                </p>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-slate-400   ml-1">Describe the Issue</label>
                                <textarea
                                    value={reportReason}
                                    onChange={(e) => setReportReason(e.target.value)}
                                    placeholder="e.g. Item received is damaged, different from description, or parts are missing..."
                                    className="w-full min-h-[160px] bg-slate-100 border border-slate-200 rounded-[0.8rem] p-6 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition resize-none"
                                />
                            </div>

                            <button
                                onClick={submitReport}
                                disabled={isActionLoading === selectedOrderForReport!.sale_id}
                                className="w-full py-3 bg-red-500 text-white rounded-full hover:scale-[1.02] active:scale-95 transition disabled:opacity-50"
                            >
                                {isActionLoading === selectedOrderForReport!.sale_id ? 'Processing...' : 'Submit Report'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Review Comment Modal (Details) */}
            {activeCommentSaleId && selectedOrderForReview && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-sm rounded-[0.5rem]  overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 leading-tight">Your Review</h3>
                                <p className="text-[10px] font-bold text-slate-400   mt-1">Vendor: {selectedOrderForReview!.vendor_name}</p>
                            </div>
                            <button onClick={() => setActiveCommentSaleId(null)} className="p-2 hover:bg-slate-50 rounded-full transition">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="flex flex-col items-center gap-4">
                                <div className="flex gap-1">
                                    {[...Array(5)].map((_, i) => (
                                        <Star
                                            key={i}
                                            size={24}
                                            fill={i < (selectedOrderForReview!.review_rating || 0) ? "#F59E0B" : "none"}
                                            className={i < (selectedOrderForReview!.review_rating || 0) ? "text-amber-500" : "text-slate-200"}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                <p className="text-sm font-medium text-slate-600 leading-relaxed italic">
                                    "{selectedOrderForReview!.review_comment || "No comment provided."}"
                                </p>
                            </div>
                            <button
                                onClick={() => setActiveCommentSaleId(null)}
                                className="w-full py-2 bg-slate-500 text-white rounded-full font-bold text-xs   active:scale-95 transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Full Screen Modal */}
            {selectedImageUrl && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300"
                    onClick={() => setSelectedImageUrl(null)}
                >
                    <button
                        onClick={() => setSelectedImageUrl(null)}
                        className="absolute top-8 right-8 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-[210]"
                    >
                        <X size={24} />
                    </button>
                    <div className="relative w-full max-w-4xl max-h-[90vh] flex items-center justify-center animate-in zoom-in-95 duration-300">
                        <img
                            src={selectedImageUrl}
                            alt="Full screen product"
                            className="max-w-full max-h-full object-contain rounded-[0.5rem]"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}

            {/* Return & Refund Modal */}
            <ReturnRefundModal
                open={isReturnModalOpen}
                onClose={() => setIsReturnModalOpen(false)}
                saleId={selectedOrderForReturn?.sale_id}
                returnPolicy={(() => {
                    const snap = selectedOrderForReturn?.shipments[0]?.items[0]?.return_policy;
                    if (!snap) return null;
                    try { return typeof snap === 'string' ? JSON.parse(snap) : snap; } catch (e) { return null; }
                })()}
                onConfirm={handleReturnRequest}
                loading={isActionLoading === selectedOrderForReturn?.sale_id}
            />
        </div>
    );
}
