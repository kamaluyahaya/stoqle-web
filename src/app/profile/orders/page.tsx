"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/src/lib/config";
import { useAuth } from "@/src/context/authContext";
import { ChevronLeft, MessageCircle, Package, MapPin, Search, ChevronRight, CheckCircle, AlertTriangle, Clock, X, Star, Info, SlidersHorizontal, XCircle } from "lucide-react";
import { toast } from "sonner";
import Swal from "sweetalert2";
import Header from "@/src/components/header";
import { confirmOrderReceipt, reportOrderProblem, cancelEscrowOrder } from "@/src/lib/api/walletApi";

interface OrderItem {
    order_id: number;
    product_name: string;
    product_image: string | null;
    quantity: number;
    unit_price: number;
    variant_info: string | null;
    status: string;
}

interface GroupedOrder {
    sale_id: number;
    business_id: number;
    business_name: string;
    business_logo: string | null;
    status: string;
    customer_confirmed: boolean;
    dispute_status: 'none' | 'open' | 'closed';
    delivered_at: string | null;
    created_at: string;
    escrow_id: number | null;
    escrow_status: string | null;
    business_owner_id: number | null;
    reviewed?: boolean;
    review_rating?: number;
    review_comment?: string;
    items: OrderItem[];
    total_amount: number;
}

export default function MyOrdersPage() {
    const { user, token, isHydrated } = useAuth();
    const router = useRouter();
    const [orders, setOrders] = useState<GroupedOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState<number | null>(null);
    const [messageLoading, setMessageLoading] = useState<number | null>(null);

    // Review Modal State
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [selectedOrderForReview, setSelectedOrderForReview] = useState<GroupedOrder | null>(null);
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewComment, setReviewComment] = useState("");

    // Report Modal State
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [selectedOrderForReport, setSelectedOrderForReport] = useState<GroupedOrder | null>(null);
    const [reportReason, setReportReason] = useState("");

    // Comment Popover State
    const [activeCommentSaleId, setActiveCommentSaleId] = useState<number | null>(null);

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState("");
    const [currentFilter, setCurrentFilter] = useState("All");
    const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    const filters = [
        "All",
        "New Order",
        "Shipping",
        "Out for Delivery",
        "To Confirm",
        "Delivered",
        "Released",
        "Rated"
    ];

    const formatUrl = (url: string | null) => {
        if (!url) return "";
        if (url.startsWith("http")) return url;
        return url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
    };

    const fetchOrders = async (showLoading = true) => {
        if (!token) return;
        try {
            if (showLoading) setIsLoading(true);
            const res = await fetch(`${API_BASE_URL}/api/orders/customer`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                },
                cache: 'no-store'
            });
            const data = await res.json();
            if (data.success && data.data) {
                setOrders(data.data);
            } else {
                toast.error(data.message || "Failed to fetch orders");
            }
        } catch (err) {
            console.error("Orders fetch err:", err);
            toast.error("Internal Server Error");
        } finally {
            if (showLoading) setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isHydrated && token) {
            fetchOrders();
        }
    }, [token, isHydrated]);

    const filteredOrders = orders.filter(order => {
        // Search filter
        const matchesSearch =
            order.sale_id.toString().includes(searchQuery) ||
            order.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            order.items.some(item => item.product_name.toLowerCase().includes(searchQuery.toLowerCase()));

        if (!matchesSearch) return false;

        // Status filter
        if (currentFilter === "All") return true;
        if (currentFilter === "New Order") return ["order_placed", "paid", "pending"].includes(order.status?.toLowerCase());
        if (currentFilter === "Shipping") return order.status?.toLowerCase() === "shipped";
        if (currentFilter === "Out for Delivery") return order.status?.toLowerCase() === "out_for_delivery";
        if (currentFilter === "To Confirm") return order.status?.toLowerCase() === "delivered" && !order.customer_confirmed;
        if (currentFilter === "Delivered") return ["delivered", "completed"].includes(order.status?.toLowerCase());
        if (currentFilter === "Released") return order.escrow_status?.toLowerCase() === "released";
        if (currentFilter === "Rated") return !!order.reviewed;

        return true;
    });

    const getTimeGroup = (dateString: string) => {
        const now = new Date();
        const date = new Date(dateString);

        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfYesterday = new Date(startOfToday);
        startOfYesterday.setDate(startOfYesterday.getDate() - 1);
        const startOf2DaysAgo = new Date(startOfToday);
        startOf2DaysAgo.setDate(startOf2DaysAgo.getDate() - 2);
        const startOfAWeekAgo = new Date(startOfToday);
        startOfAWeekAgo.setDate(startOfAWeekAgo.getDate() - 7);
        const startOfAMonthAgo = new Date(startOfToday);
        startOfAMonthAgo.setMonth(startOfAMonthAgo.getMonth() - 1);

        if (date >= startOfToday) return 'Today';
        if (date >= startOfYesterday) return 'Yesterday';
        if (date >= startOf2DaysAgo) return '2 Days Ago';
        if (date >= startOfAWeekAgo) return 'Last 7 Days';
        if (date >= startOfAMonthAgo) return 'Last Month';
        return 'Older';
    };

    const groupOrder = ['Today', 'Yesterday', '2 Days Ago', 'Last 7 Days', 'Last Month', 'Older'];

    const groupedOrders = filteredOrders.reduce((groups: Record<string, GroupedOrder[]>, order) => {
        const group = getTimeGroup(order.created_at);
        if (!groups[group]) groups[group] = [];
        groups[group].push(order);
        return groups;
    }, {});

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case "completed":
            case "delivered": return "bg-green-100 text-green-700";
            case "paid":
            case "confirmed": return "bg-emerald-100 text-emerald-700";
            case "shipped": return "bg-indigo-100 text-indigo-700";
            case "out_for_delivery": return "bg-blue-100 text-blue-700";
            case "cancelled": return "bg-red-100 text-red-700";
            case "order_placed": return "bg-orange-100 text-orange-700";
            default: return "bg-slate-100 text-slate-700";
        }
    };

    const handleConfirmReceipt = async (order: GroupedOrder) => {
        if (!order.escrow_id) return;
        setIsActionLoading(order.sale_id);
        try {
            await confirmOrderReceipt(order.escrow_id);
            toast.success("Delivery confirmed! Money released to vendor.");
            fetchOrders(false);
        } catch (err: any) {
            toast.error(err?.body?.message || "Failed to confirm receipt");
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleReportProblem = (order: GroupedOrder) => {
        console.log("Reporting problem for order:", order.sale_id);
        setSelectedOrderForReport(order);
        setReportReason("");
        setIsReportModalOpen(true);
    };

    const handleCancelOrder = async (order: GroupedOrder) => {
        if (!order.escrow_id) {
            toast.error("Escrow details not found for this order. Please contact support.");
            return;
        }

        const result = await Swal.fire({
            title: 'Cancel Order?',
            text: "Are you sure you want to cancel this order? The funds will be returned to your wallet available balance.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#F43F5E',
            cancelButtonColor: '#94A3B8',
            confirmButtonText: 'Yes, cancel it!',
            cancelButtonText: 'No, keep it',
            customClass: {
                popup: 'rounded-[2rem]',
                confirmButton: 'rounded-xl px-6 py-3 font-black uppercase tracking-widest text-xs mx-1',
                cancelButton: 'rounded-xl px-6 py-3 font-black uppercase tracking-widest text-xs mx-1'
            }
        });

        if (result.isConfirmed) {
            setIsActionLoading(order.sale_id);
            try {
                await cancelEscrowOrder(order.escrow_id);
                Swal.fire({
                    title: 'Cancelled!',
                    text: 'Your order has been cancelled and funds have been returned to your wallet.',
                    icon: 'success',
                    confirmButtonColor: '#10B981',
                    customClass: {
                        popup: 'rounded-[2rem]',
                        confirmButton: 'rounded-xl px-6 py-3 font-black uppercase tracking-widest text-xs'
                    }
                });
                fetchOrders(false);
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

    const handleOpenReview = (order: GroupedOrder) => {
        setSelectedOrderForReview(order);
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
                    business_id: selectedOrderForReview.business_id,
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

    const handleMessageVendor = async (group: GroupedOrder) => {
        if (!token) {
            router.push("/login");
            return;
        }

        const profileUserId = group.business_owner_id;
        if (!profileUserId) {
            toast.error("Could not find vendor contact info");
            return;
        }

        setMessageLoading(group.sale_id);

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
                router.push(`/messages?room=${convId}`);
                return;
            }

            router.push(`/messages?user=${profileUserId}`);
        } catch (err) {
            console.error("Failed to init conversation:", err);
            router.push(`/messages?user=${profileUserId}`);
        } finally {
            setMessageLoading(null);
        }
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
            <div className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center p-4 text-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg mb-6">
                    <Package className="text-slate-300" size={32} />
                </div>
                <h2 className="text-xl font-black text-slate-900 mb-2">Login Required</h2>
                <p className="text-slate-500 max-w-xs mb-8">Please login to access your order history and track deliveries.</p>
                <button
                    onClick={() => router.push("/login")}
                    className="px-8 py-3 bg-black text-white rounded-2xl font-black shadow-lg shadow-black/10 active:scale-95 transition"
                >
                    Return to Login
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC]">
            {/* Header placeholder for mobile */}
            <div className="h-[60px] md:h-0"></div>

            <main className=" md:p-10 pb-10 p-3">
                <div className="mb-8">
                    <div className="flex items-center justify-between gap-4 min-h-[44px]">
                        {!isSearchOpen ? (
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="space-y-0">
                                    <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight whitespace-nowrap">Purchase History</h1>
                                    <p className="text-[10px] md:text-sm font-medium text-slate-500 hidden md:block">Track and manage your orders</p>
                                </div>
                                {orders.length > 0 && (
                                    <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm flex items-center gap-1.5 w-fit shrink-0">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-[9px] font-black text-slate-600 tracking-widest uppercase">{orders.length}</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 animate-in slide-in-from-right-4 fade-in duration-300">
                                <div className="relative">
                                    <input
                                        ref={searchRef}
                                        type="search"
                                        placeholder="Search products, orders..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="
                                            w-full
                                            rounded-2xl
                                            bg-white
                                            border border-slate-200
                                            pl-4
                                            pr-10
                                            py-2.5
                                            text-sm
                                            text-black
                                            caret-rose-500
                                            outline-none
                                            transition
                                            focus:ring-2
                                            focus:ring-rose-500/10
                                            focus:border-rose-500
                                            shadow-sm
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
                                className={`h-11 w-11 flex items-center justify-center rounded-2xl border transition-all ${isSearchOpen ? 'bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 shadow-sm'}`}
                                title={isSearchOpen ? "Close Search" : "Search Orders"}
                            >
                                {isSearchOpen ? <X size={20} /> : <Search size={20} />}
                            </button>

                            <div className="relative">
                                <button
                                    onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                                    className={`h-11 w-11 flex items-center justify-center rounded-2xl border transition-all ${isFilterDropdownOpen
                                        ? "bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-900/20"
                                        : (currentFilter !== 'All' ? "bg-slate-900 border-slate-900 text-white shadow-lg" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 shadow-sm")
                                        }`}
                                    title="Filter Orders"
                                >
                                    <SlidersHorizontal size={20} />
                                </button>

                                {isFilterDropdownOpen && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-40"
                                            onClick={() => setIsFilterDropdownOpen(false)}
                                        />
                                        <div className="absolute right-0 mt-3 w-64 bg-white rounded-[2rem] shadow-2xl border border-slate-100 py-4 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <div className="px-6 py-2 mb-2 border-b border-slate-50">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filter by Status</p>
                                            </div>
                                            <div className="max-h-[300px] overflow-y-auto scrollbar-hide">
                                                {filters.map((filter) => (
                                                    <button
                                                        key={filter}
                                                        onClick={() => {
                                                            setCurrentFilter(filter);
                                                            setIsFilterDropdownOpen(false);
                                                        }}
                                                        className={`w-full text-left px-6 py-3 text-xs font-black uppercase tracking-widest transition-all flex items-center justify-between group ${currentFilter === filter
                                                            ? "text-rose-500 bg-rose-50/50"
                                                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                                            }`}
                                                    >
                                                        {filter}
                                                        {currentFilter === filter && (
                                                            <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 gap-8">
                        {[1, 2, 3, 4].map((i) => <OrderSkeleton key={i} />)}
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="bg-white rounded-[2.5rem] p-16 flex flex-col items-center justify-center text-center shadow-xl shadow-slate-200/50 border border-slate-100">
                        <div className="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center mb-6 border border-rose-100 shadow-inner">
                            <Package size={40} className="text-rose-500" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 mb-2">
                            {searchQuery || currentFilter !== "All" ? "No matching orders" : "No orders found"}
                        </h3>
                        <p className="text-slate-500 max-w-xs mb-8 font-medium">
                            {searchQuery || currentFilter !== "All"
                                ? "Try adjusting your search or filters to find what you're looking for."
                                : "When you buy items, your complete purchase history will appear here."
                            }
                        </p>
                        {(searchQuery || currentFilter !== "All") && (
                            <button
                                onClick={() => { setSearchQuery(""); setCurrentFilter("All"); }}
                                className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition"
                            >
                                Clear All Filters
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-10">
                        {groupOrder.map(groupName => {
                            const groupItems = groupedOrders[groupName];
                            if (!groupItems || groupItems.length === 0) return null;

                            return (
                                <div key={groupName} className="space-y-4">
                                    <div className="flex items-center gap-4 px-1">
                                        <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.3em] whitespace-nowrap">{groupName}</span>
                                        <div className="h-px bg-rose-100 flex-1" />
                                    </div>

                                    <div className="space-y-4">
                                        {groupItems.map((group) => (
                                            <div key={group.sale_id} className="bg-white shadow-slate-200/50 border border-slate-100 overflow-hidden md:rounded-3xl">

                                                {/* Vendor Header */}
                                                <div className="px-6 py-4 flex items-center justify-between border-b border-slate-50">
                                                    <div className="flex items-center gap-3 cursor-pointer hover:opacity-70 transition" onClick={() => router.push(`/shop/${group.business_id}`)}>
                                                        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center overflow-hidden">
                                                            {group.business_logo ? (
                                                                <img src={formatUrl(group.business_logo)} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="text-slate-200 font-medium ">{group.business_name?.charAt(0)}</div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <h3 className="font-semibold text-slate-900 text-xs sm:text-sm md:text-base lg:text-lg">
                                                                {group.business_name}
                                                            </h3>
                                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">ID: #{group.sale_id}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest ${getStatusColor(group.status)}`}>
                                                            {group.status?.replace(/_/g, ' ')}
                                                        </span>
                                                        <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-tight">
                                                            {groupName === 'Today' ? new Date(group.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(group.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Items List */}
                                                <div className="p-6 space-y-6">
                                                    {group.items.map((item) => (
                                                        <div key={item.order_id} className="flex gap-5 md:gap-7 items-center group/item">
                                                            <div
                                                                onClick={() => item.product_image && setSelectedImageUrl(formatUrl(item.product_image))}
                                                                className={`w-16 h-16 md:w-20 md:h-20 bg-slate-50 rounded-2xl overflow-hidden border border-slate-100 shadow-sm shrink-0 group-hover/item:scale-105 transition ${item.product_image ? 'cursor-zoom-in' : ''}`}
                                                            >
                                                                {item.product_image ? (
                                                                    <img src={formatUrl(item.product_image)} alt={item.product_name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-slate-200 bg-slate-50"><Package size={24} /></div>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0 space-y-1">
                                                                <h4 className=" text-slate-800 text-sm md:text-base font-bold leading-snug line-clamp-1">{item.product_name}</h4>
                                                                {item.variant_info && (
                                                                    <span className="inline-block text-[9px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded tracking-widest">{item.variant_info}</span>
                                                                )}
                                                                <div className="flex items-center gap-3 pt-1">
                                                                    <p className="text-xs font-black text-slate-900">₦{item.unit_price.toLocaleString()}</p>
                                                                    <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                                                    <p className="text-xs font-bold text-slate-400">Qty: {item.quantity}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Footer Summary & Actions */}
                                                <div className="px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                                    <div className="space-y-1">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Order Total</p>
                                                        <p className="text-xl font-black text-slate-900">₦{group.total_amount.toLocaleString()}</p>
                                                    </div>

                                                    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-2 px-2 pb-1">
                                                        {/* ESCROW ACTIONS FOR CUSTOMER */}
                                                        {group.status === 'delivered' && !group.customer_confirmed && (
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                {group.dispute_status === 'open' ? (
                                                                    <div className="flex items-center gap-2 px-3 md:px-4 py-2 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 shrink-0">
                                                                        <AlertTriangle size={16} className="md:w-[18px]" />
                                                                        <span className="text-[9px] md:text-[10px] font-bold tracking-tight">Dispute Open</span>
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        <button
                                                                            onClick={() => handleConfirmReceipt(group)}
                                                                            disabled={isActionLoading === group.sale_id}
                                                                            className="flex items-center justify-center gap-2 px-3 md:px-6 py-2 md:py-3 bg-emerald-500 text-white rounded-2xl font-bold text-[9px] md:text-[10px] shadow-lg shadow-emerald-500/20 active:scale-95 transition disabled:opacity-50 shrink-0"
                                                                        >
                                                                            {isActionLoading === group.sale_id ? 'Wait...' : (
                                                                                <>
                                                                                    <CheckCircle size={16} className="md:w-[18px]" /> Confirm Delivery</>
                                                                            )}
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); handleReportProblem(group); }}
                                                                            disabled={isActionLoading === group.sale_id}
                                                                            className="flex items-center justify-center gap-2 px-3 md:px-6 py-2 md:py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold text-[9px] md:text-[10px] hover:bg-slate-50 transition active:scale-95 disabled:opacity-50 shrink-0"
                                                                        >
                                                                            Report Problem
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}

                                                        {group.customer_confirmed && (
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <div className="flex items-center gap-2 px-3 md:px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-600 shrink-0">
                                                                    <CheckCircle size={14} className="md:w-[16px]" />
                                                                    <span className="text-[9px] md:text-[10px] font-bold tracking-tight">Confirmed</span>
                                                                </div>
                                                                {!group.reviewed && (
                                                                    <button
                                                                        onClick={() => handleOpenReview(group)}
                                                                        className="flex items-center gap-2 px-3 md:px-6 py-2 md:py-3 bg-rose-500 text-white rounded-2xl font-bold text-[9px] md:text-[10px] shadow-lg shadow-rose-500/20 active:scale-95 transition shrink-0"
                                                                    >
                                                                        <Star size={14} fill="white" className="md:w-[16px]" /> Leave Review
                                                                    </button>
                                                                )}
                                                                {group.reviewed && (
                                                                    <div className="flex items-center gap-3 px-4 md:px-5 py-2 md:py-3 bg-slate-50 border border-slate-200 rounded-2xl shrink-0">
                                                                        <div className="flex items-center gap-0.5">
                                                                            {[...Array(5)].map((_, i) => (
                                                                                <Star
                                                                                    key={i}
                                                                                    size={12}
                                                                                    className={`md:w-[14px] ${i < (group.review_rating || 0) ? "text-amber-500" : "text-slate-300"}`}
                                                                                    fill={i < (group.review_rating || 0) ? "#F59E0B" : "none"}
                                                                                />
                                                                            ))}
                                                                        </div>
                                                                        <div className="w-px h-3 bg-slate-200" />
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setSelectedOrderForReview(group);
                                                                                setActiveCommentSaleId(group.sale_id);
                                                                            }}
                                                                            className="p-1 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
                                                                        >
                                                                            <Info size={14} />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {group.status?.toLowerCase() === 'refunded' || group.status?.toLowerCase() === 'cancelled' ? (
                                                            <div className="flex items-center gap-2 px-3 md:px-4 py-2 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 shrink-0">
                                                                <XCircle size={14} className="md:w-[16px]" />
                                                                <span className="text-[9px] md:text-[10px] font-bold tracking-tight uppercase">Order Cancelled</span>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                {group.status !== 'delivered' && !group.customer_confirmed && (
                                                                    <div className="flex items-center gap-2 shrink-0">
                                                                        <div className="flex items-center gap-2 px-3 md:px-4 py-2 bg-blue-50 border border-blue-100 rounded-2xl text-blue-600 shrink-0">
                                                                            <Clock size={14} className="md:w-[16px]" />
                                                                            <span className="text-[9px] md:text-[10px] font-bold tracking-tight">
                                                                                {group.status === 'shipped' ? 'En Route' : (group.status === 'out_for_delivery' ? 'Out for Delivery' : 'Processing')}
                                                                            </span>
                                                                        </div>
                                                                        {['order_placed', 'paid', 'pending'].includes(group.status?.toLowerCase()) && (
                                                                            <button
                                                                                onClick={() => handleCancelOrder(group)}
                                                                                disabled={isActionLoading === group.sale_id}
                                                                                className="flex items-center justify-center gap-2 px-3 md:px-6 py-2 md:py-3 bg-white border border-rose-200 text-rose-600 rounded-2xl font-bold text-[9px] md:text-[10px] hover:bg-rose-50 transition active:scale-95 disabled:opacity-50 shrink-0"
                                                                            >
                                                                                {isActionLoading === group.sale_id ? 'Wait...' : (
                                                                                    <>
                                                                                        <XCircle size={16} className="md:w-[18px]" /> Cancel Order
                                                                                    </>
                                                                                )}
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}

                                                        <button
                                                            onClick={() => handleMessageVendor(group)}
                                                            disabled={messageLoading === group.sale_id}
                                                            className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full bg-slate-900 text-white shadow-xl shadow-slate-900/20 hover:scale-105 transition active:scale-90 disabled:opacity-70 shrink-0"
                                                            title="Message Vendor"
                                                        >
                                                            {messageLoading === group.sale_id ? (
                                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                            ) : (
                                                                <MessageCircle size={22} />
                                                            )}
                                                        </button>
                                                    </div>
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
            {
                isReviewModalOpen && selectedOrderForReview && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 leading-tight">Review Your Order</h3>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Order #{selectedOrderForReview.sale_id}</p>
                                </div>
                                <button onClick={() => setIsReviewModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-full transition">
                                    <X size={20} className="text-slate-400" />
                                </button>
                            </div>

                            <div className="p-8 space-y-6">
                                <div className="flex flex-col items-center gap-4">
                                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Rate the vendor</p>
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
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Write a Review</label>
                                    <textarea
                                        value={reviewComment}
                                        onChange={(e) => setReviewComment(e.target.value)}
                                        placeholder="Tell others about your experience..."
                                        className="w-full min-h-[120px] bg-slate-100 border border-slate-200 rounded-[1.8rem] p-5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition resize-none"
                                    />
                                </div>

                                <button
                                    onClick={submitReview}
                                    disabled={isActionLoading === selectedOrderForReview.sale_id}
                                    className="w-full py-4 bg-red-500 text-white rounded-[1.8rem] font-black shadow-xl hover:scale-[1.02] active:scale-95 transition disabled:opacity-50"
                                >
                                    {isActionLoading === selectedOrderForReview.sale_id ? 'Wait...' : 'Submit Review'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Report Problem Modal */}
            {
                isReportModalOpen && selectedOrderForReport && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 leading-tight">Report a Problem</h3>
                                    <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mt-1">Dispute for Order #{selectedOrderForReport.sale_id}</p>
                                </div>
                                <button onClick={() => setIsReportModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-full transition">
                                    <X size={24} className="text-slate-400" />
                                </button>
                            </div>

                            <div className="p-8 space-y-6">
                                <div className="bg-rose-50 border border-rose-100 p-6 rounded-3xl space-y-3">
                                    <div className="flex items-center gap-3 text-rose-600">
                                        <AlertTriangle size={20} />
                                        <h4 className="font-black text-[10px] uppercase tracking-widest">Important Note</h4>
                                    </div>
                                    <p className="text-[11px] text-rose-700/80 font-medium leading-relaxed">
                                        Reporting a problem will put the payment on hold. Stoqle administrators will review the dispute and contact both you and the vendor.
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Describe the Issue</label>
                                    <textarea
                                        value={reportReason}
                                        onChange={(e) => setReportReason(e.target.value)}
                                        placeholder="e.g. Item received is damaged, different from description, or parts are missing..."
                                        className="w-full min-h-[160px] bg-slate-100 border border-slate-200 rounded-[1.8rem] p-6 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition resize-none"
                                    />
                                </div>

                                <button
                                    onClick={submitReport}
                                    disabled={isActionLoading === selectedOrderForReport.sale_id}
                                    className="w-full py-5 bg-black text-white rounded-[2rem] font-black shadow-xl shadow-black/10 hover:scale-[1.02] active:scale-95 transition disabled:opacity-50"
                                >
                                    {isActionLoading === selectedOrderForReport.sale_id ? 'Processing...' : 'Submit Report'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Review Comment Modal (Details) */}
            {
                activeCommentSaleId && selectedOrderForReview && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 leading-tight">Your Review</h3>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Vendor: {selectedOrderForReview.business_name}</p>
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
                                                fill={i < (selectedOrderForReview.review_rating || 0) ? "#F59E0B" : "none"}
                                                className={i < (selectedOrderForReview.review_rating || 0) ? "text-amber-500" : "text-slate-200"}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                    <p className="text-sm font-medium text-slate-600 leading-relaxed italic">
                                        "{selectedOrderForReview.review_comment || "No comment provided."}"
                                    </p>
                                </div>
                                <button
                                    onClick={() => setActiveCommentSaleId(null)}
                                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-xs uppercase tracking-widest active:scale-95 transition"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

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
                            className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
