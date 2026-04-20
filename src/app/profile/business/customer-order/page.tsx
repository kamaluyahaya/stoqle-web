"use client";

import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import DescriptionTextarea from "@/src/components/input/defaultDescTextarea";
import { API_BASE_URL } from "@/src/lib/config";
import { useAuth } from "@/src/context/authContext";
import { cancelOrder, refundOrder } from "@/src/lib/api/orderApi";
import { CheckCircle2, Truck, Package, Search, SearchX, Filter, MoreVertical, XCircle, ChevronRight, ChevronLeft, MapPin, Phone, User, Info, Calendar, Hash, ExternalLink, ShieldCheck, Clock, SlidersHorizontal, RefreshCcw, X, ShieldAlert, FileText, Camera, Send, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import OrderSnapshotModal from "@/src/components/orders/OrderSnapshotModal";
import CancelOrderModal from "@/src/components/orders/CancelOrderModal";
import { useRouter, useSearchParams } from "next/navigation";
import OrderSummaryFlyer from "@/src/components/orders/OrderSummaryFlyer";
import { Download } from "lucide-react";
import Swal from "sweetalert2";

interface OrderTracking {
    history_id: number;
    status: string;
    message: string;
    created_at: string;
}

interface OrderItem {
    order_id: number;
    product_id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_item_price: number;
    status: string;
    created_at: string;
    variant_info: string | null;
    product_image: string | null;
    return_policy?: string | any | null;
    shipping_promise?: string | null;
    shipping_avg?: string | null;
    original_unit_price: number;
    discount_amount: number;
    promotions_snapshot?: string | any | null;
    discounts_snapshot?: string | any | null;
    item_cancel_reason?: string | null;
    item_cancel_explanation?: string | null;
    delivered_at?: string | null;
    customer_confirmed?: boolean | number;
    completed_at?: string | null;
}

interface Shipment {
    id: number | string;
    shipment_id: number | string;
    status: string;
    shipping_promise: string | null;
    items: (OrderItem & { rider_name?: string | null; rider_phone?: string | null })[];
    ship_cancel_reason?: string | null;
    ship_cancel_explanation?: string | null;
    delivered_at?: string | null;
    delivery_code?: string;
    is_pending_admin_review?: boolean;
    escrow_status?: string;
    dispute_status?: string;
    dispute_reason?: string;
    dispute_explanation?: string;
}

interface MasterOrder {
    sale_id: number | null;
    master_order_id?: number | string | null;
    stoqle_order_id?: string | number | null;
    order_ref?: string;
    reference_no?: string;
    customer_name?: string;
    payment_ref: string | null;
    full_name: string;
    display_id?: string;
    email: string;
    phone: string;
    delivery_address: string;
    status: string;
    created_at: string;
    customer_profile_pic?: string | null;
    combined_total: number;
    dispute_reason?: string | null;
    cancel_reason?: string | null;
    cancel_explanation?: string | null;
    business?: any;
    policies?: any;
    items?: OrderItem[];
    customer_id?: number | string | null;
    shipments: Shipment[];
}

import { useAudio } from "@/src/context/audioContext";

export default function VendorOrdersPage() {
    const { token, user } = useAuth();
    const { playSound } = useAudio();
    const router = useRouter();
    const searchParams = useSearchParams();
    const requestedOrderId = searchParams.get("orderId");
    const requestedOrderRef = searchParams.get("orderRef");
    const [orders, setOrders] = useState<MasterOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<MasterOrder | null>(null);
    const [tracking, setTracking] = useState<OrderTracking[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [statusFilter, setStatusFilter] = useState("all");
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [activeShipmentIdx, setActiveShipmentIdx] = useState(0);
    const [snapshotOpen, setSnapshotOpen] = useState(false);
    const [snapshotItem, setSnapshotItem] = useState<any>(null);
    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [confirmingShipmentId, setConfirmingShipmentId] = useState<any | null>(null);
    const flyerRef = React.useRef<HTMLDivElement>(null);
    const [messageLoading, setMessageLoading] = useState(false);

    const statuses = ["all", "order_placed", "confirmed", "ready_for_shipping", "out_for_delivery", "delivered", "cancelled"];

    // Status progression map (Vendors stop at 'shipped' which is 'Ship Order')
    const nextStatusMap: Record<string, { label: string; value: string; color: string; icon: any }> = {
        'order_placed': { label: 'Confirm Order', value: 'confirmed', color: 'bg-emerald-600', icon: CheckCircle2 },
        'pending': { label: 'Confirm Order', value: 'confirmed', color: 'bg-emerald-600', icon: CheckCircle2 },
        'confirmed': { label: 'Ready for Shipping', value: 'ready_for_shipping', color: 'bg-indigo-600', icon: Truck },
        'ready_for_pickup': { label: 'Confirm Order', value: 'confirmed', color: 'bg-emerald-600', icon: CheckCircle2 },
        'processing': { label: 'Ready for Shipping', value: 'ready_for_shipping', color: 'bg-indigo-600', icon: Truck },
        'ready_for_shipping': { label: 'Mark Out for Delivery', value: 'out_for_delivery', color: 'bg-purple-600', icon: Truck },
        'out_for_delivery': { label: 'Mark as Delivered', value: 'delivered', color: 'bg-rose-500', icon: CheckCircle2 },
        'pending_admin_review': { label: 'Check Status', value: 'delivered', color: 'bg-emerald-600', icon: ShieldCheck },
    };

    const getStatusDisplay = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'order_placed':
            case 'pending':
                return { label: "New Order", color: "bg-orange-100 text-orange-700", icon: Clock };
            case 'confirmed':
                return { label: "Confirmed", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 };
            case 'ready_for_shipping':
                return { label: "Ready for Delivery", color: "bg-indigo-100 text-indigo-700", icon: Package };
            case "picked_up": return { label: "Picked Up", color: "bg-purple-100 text-purple-700", icon: Package };
            case 'processing':
                return { label: "Processing", color: "bg-blue-50 text-blue-600 border border-blue-100", icon: Clock };
            case 'partially_cancelled':
                return { label: "Partially Cancelled", color: "bg-amber-50 text-amber-600 border border-amber-100", icon: Info };
            case 'partially_completed':
                return { label: "Partially Completed", color: "bg-emerald-50 text-emerald-600 border border-emerald-100", icon: CheckCircle2 };
            case "delivered":
            case "completed":
                return { label: "Completed", color: "bg-rose-50 text-rose-500 border border-rose-100", icon: CheckCircle2 };
            case "pending_admin_review":
                return { label: "Under Review", color: "bg-blue-50 text-blue-600 border border-blue-100 animate-pulse", icon: Clock };
            case "cancelled":
            case "refunded":
                return { label: "Cancelled", color: "bg-slate-100 text-slate-500", icon: XCircle };
            default: return { label: (status || "Processing").replace(/_/g, ' '), color: "bg-slate-50 text-slate-500", icon: Clock };
        }
    };

    const fetchOrders = async () => {
        if (!token) return;
        try {
            setRefreshing(true);
            const res = await fetch(`${API_BASE_URL}/api/orders/orders`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setOrders(data.data);
                // If we have a selected order, update it in the list too
                if (selectedOrder) {
                    const updated = data.data.find((o: any) => o.payment_ref === selectedOrder.payment_ref || o.sale_id === selectedOrder.sale_id);
                    if (updated) setSelectedOrder(updated);
                }
            }
        } catch (err) {
            toast.error("Failed to load orders");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchOrders();

        // Real-time listener for updates
        if (user && token) {
            const userId = user.user_id || user.id;
            if (userId) {
                const socket = io(API_BASE_URL, { query: { userId } });

                socket.on("order-status-update", (data: any) => {
                    console.log("Real-time vendor order status updated:", data);
                    fetchOrders(); // Refresh status instantly
                });

                socket.on("new-order", (data: any) => {
                    console.log("Real-time new vendor order received:", data);
                    fetchOrders(); // Refresh order list instantly
                });

                return () => {
                    socket.disconnect();
                };
            }
        }
    }, [token, user]);

    useEffect(() => {
        if (!loading && (requestedOrderId || requestedOrderRef) && orders.length > 0 && !selectedOrder) {
            const match = orders.find(o =>
                (requestedOrderId && String(o.master_order_id) === String(requestedOrderId)) ||
                (requestedOrderRef && (o.order_ref === requestedOrderRef || o.display_id === requestedOrderRef || o.payment_ref === requestedOrderRef))
            );
            if (match) setSelectedOrder(match);
        }
    }, [loading, requestedOrderId, requestedOrderRef, orders, selectedOrder]);

    const handleMessageClick = async (customerId?: number | string | null) => {
        if (!token) {
            toast.error("Please login to message the customer");
            return;
        }
        if (!customerId) {
            toast.error("Customer context not found for messaging");
            return;
        }

        setMessageLoading(true);
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        };

        try {
            let convId: string | number | null = null;
            const tryEndpoints = [
                { url: `${API_BASE_URL}/api/chat/create`, body: { other_user_id: customerId } },
                { url: `${API_BASE_URL}/api/conversations/init`, body: { user_id: customerId } },
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
                router.push(`/messages?room=${convId}&user_id=${customerId}`);
            } else {
                router.push(`/messages?user_id=${customerId}`);
            }
        } catch (err) {
            console.error("Failed to init conversation:", err);
            router.push(`/messages?user=${customerId}`);
        } finally {
            setMessageLoading(false);
        }
    };

    const handleCancelOrder = async (cancelData: { type: string; reason: string; explanation?: string }) => {
        if (!selectedOrder) return;

        // ✅ Granular Cancellation Guard: Only block if the TARGET items are already processing
        const alreadyProcessingStates = ['confirmed', 'ready_for_shipping', 'out_for_delivery', 'shipped', 'delivered', 'released', 'completed', 'pending_admin_review'];

        let targetShipments = selectedOrder.shipments || [];
        if (cancelData.type === 'shipment') {
            targetShipments = [selectedOrder.shipments[activeShipmentIdx]];
        }

        const hasProcessingInTarget = targetShipments.some(s =>
            alreadyProcessingStates.includes(s.status?.toLowerCase() || '')
        );

        if (hasProcessingInTarget) {
            Swal.fire({
                title: "Cancellation Blocked",
                text: "The entire order cannot be cancelled as processing has already begun.",
                icon: "warning",
                confirmButtonColor: "#f43f5e", // rose-500
                confirmButtonText: "Understand"
            });
            return;
        }

        let idToCancel: string | number = selectedOrder.sale_id || '';
        if (cancelData.type === 'shipment') {
            idToCancel = selectedOrder.shipments[activeShipmentIdx]?.shipment_id || idToCancel;
        }

        try {
            setIsCancelling(true);
            const data = await cancelOrder(idToCancel, {
                type: cancelData.type as any,
                reason: cancelData.reason,
                explanation: cancelData.explanation,
                cancelledBy: 'vendor',
                shipment_id: cancelData.type === 'shipment' ? selectedOrder.shipments[activeShipmentIdx]?.shipment_id : undefined
            });

            if (data.success) {
                toast.success(data.message);
                setCancelModalOpen(false);
                await fetchOrders();
            } else {
                toast.error(data.message || "Failed to cancel order");
            }
        } catch (err: any) {
            toast.error("Network error. Please try again.");
        } finally {
            setIsCancelling(false);
        }
    };

    const updateStatus = async (orderId: number, status: string) => {
        if (!orderId) {
            toast.error("Critical Error: No Order ID provided for update");
            return;
        }
        try {
            setRefreshing(true);
            const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}/status`, {
                method: 'POST',
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ status })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(`Order ${status.replace(/_/g, ' ')} successfully`);

                // Play specific sound for status update
                if (status === 'confirmed') {
                    playSound("delivery_confirmed");
                } else if (status === 'ready_for_shipping' || status === 'shipping') {
                    playSound("shipping");
                } else if (status === 'out_for_delivery') {
                    playSound("out_for_delivery");
                } else if (status === 'delivered') {
                    playSound("delivery_confirmed");
                }

                await fetchOrders();
                if (selectedOrder) {
                    await fetchTracking(orderId);
                }
            } else {
                toast.error(data.message || "Failed to update status");
            }
        } catch (err) {
            toast.error("Network error. Please try again.");
        } finally {
            setRefreshing(false);
        }
    };

    const isRefundable = (item: OrderItem) => {
        const referenceDate = item.delivered_at || item.completed_at || (item as any).updated_at;
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

    const handleRefund = async (orderId: number) => {
        if (!window.confirm("Are you sure you want to refund this order? This will transfer funds back to the customer.")) return;
        setRefreshing(true);
        try {
            await refundOrder(orderId);
            toast.success("Order refunded successfully");
            fetchOrders();
        } catch (err: any) {
            toast.error(err.body?.message || "Failed to refund order");
        } finally {
            setRefreshing(false);
        }
    };

    const fetchTracking = async (orderId: number) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}/tracking`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) setTracking(data.data);
        } catch (e) { }
    }

    useEffect(() => {
        if (selectedOrder && selectedOrder.shipments?.[activeShipmentIdx]) {
            const ship = selectedOrder.shipments[activeShipmentIdx];
            const firstItem = ship.items?.[0];
            if (firstItem) {
                // Clear old tracking data immediately so user knows it's reloading
                setTracking([]);
                fetchTracking(firstItem.order_id);
            }
        }
    }, [activeShipmentIdx, selectedOrder?.sale_id, selectedOrder?.payment_ref]);

    const handleSelectOrder = (order: MasterOrder) => {
        setSelectedOrder(order);
        setActiveShipmentIdx(0);
        // The useEffect above will handle fetchTracking automatically
    };

    const handleDownloadFlyer = () => {
        if (!selectedOrder) return;
        const originalTitle = document.title;
        const businessName = selectedOrder.business?.business_name || selectedOrder.business?.name || "Stoqle Merchant";
        document.title = `${businessName} - Order #${selectedOrder.sale_id || selectedOrder.payment_ref}`;
        window.print();
        setTimeout(() => { document.title = originalTitle; }, 100);
    };

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

    const filteredOrders = orders.filter(order => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = !searchQuery ||
            (order.customer_name || order.full_name || "").toLowerCase().includes(q) ||
            (order.sale_id?.toString() || "").includes(q) ||
            (order.reference_no || order.display_id || "").toLowerCase().includes(q) ||
            order.shipments?.some((s: any) => s.items?.some((item: any) => item.product_name?.toLowerCase().includes(q)));

        const os = (order.status || 'pending').toLowerCase();
        const sf = statusFilter.toLowerCase();

        let matchesStatus = statusFilter === "all";
        if (sf === 'order_placed') {
            matchesStatus = os === 'order_placed' || os === 'pending';
        } else if (sf === 'delivered') {
            matchesStatus = os === 'delivered' || os === 'completed';
        } else if (sf === 'cancelled') {
            matchesStatus = os === 'cancelled' || os === 'refunded';
        } else if (sf === 'ready_for_shipping') {
            matchesStatus = os === 'ready_for_shipping' || os === 'ready_for_delivery' || os === 'confirmed' || os === 'processing';
        } else {
            matchesStatus = matchesStatus || os === sf;
        }

        return matchesSearch && matchesStatus;
    });

    const groupedOrders = filteredOrders.reduce((groups: Record<string, MasterOrder[]>, order) => {
        const group = getTimeGroup(order.created_at);
        if (!groups[group]) groups[group] = [];
        groups[group].push(order);
        return groups;
    }, {});

    const groupOrder = ['Today', 'Yesterday', '2 Days Ago', 'Last 7 Days', 'Last Month', 'Older'];

    if (loading) return (
        <div className="min-h-screen md:h-[100dvh] lg:h-[calc(100vh-64px)] md:overflow-hidden bg-slate-50 flex flex-col">
            <div className="px-1 pb-4 pt-0 md:py-4 md:px-8 grid grid-cols-1 md:grid-cols-12 gap-6 flex-1 overflow-hidden">
                <div className="col-span-1 md:col-span-4 space-y-4 h-full overflow-y-auto scrollbar-hide px-1">
                    <div className="flex items-center justify-between mb-2 px-1 sticky top-0 z-30 bg-slate-50/95 backdrop-blur-md pt-[max(env(safe-area-inset-top),16px)] pb-3 md:pt-0 md:relative md:bg-transparent">
                        <div className="h-6 w-24 bg-slate-200 rounded animate-pulse" />
                        <div className="flex gap-2">
                            <div className="w-8 h-8 rounded-lg bg-slate-200 animate-pulse" />
                            <div className="w-8 h-8 rounded-lg bg-slate-200 animate-pulse" />
                        </div>
                    </div>
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="bg-white p-4 rounded-lg border border-slate-100 space-y-3 shadow-sm">
                            <div className="flex justify-between items-center">
                                <div className="h-4 w-1/3 bg-slate-100 rounded animate-pulse" />
                                <div className="h-4 w-16 bg-slate-100 rounded animate-pulse" />
                            </div>
                            <div className="h-3 w-1/2 bg-slate-50 rounded animate-pulse" />
                            <div className="h-10 w-full bg-slate-50 rounded animate-pulse mt-2" />
                        </div>
                    ))}
                </div>
                <div className="hidden md:block col-span-1 md:col-span-8 bg-white/50 rounded-[0.5rem] border border-slate-100 h-full p-8 animate-pulse">
                    <div className="w-full h-full bg-slate-100/50 rounded-lg" />
                </div>
            </div>
        </div>
    );

    return (
        <div className="h-[100dvh] overflow-hidden bg-slate-50 flex flex-col lg:h-[calc(100vh-64px)]">
            <OrderSnapshotModal
                open={snapshotOpen}
                onClose={() => setSnapshotOpen(false)}
                item={snapshotItem}
            />
            <CancelOrderModal
                open={cancelModalOpen}
                onClose={() => setCancelModalOpen(false)}
                onConfirm={handleCancelOrder}
                loading={isCancelling}
                items={selectedOrder?.shipments || []}
                shipmentIndex={activeShipmentIdx}
                saleId={selectedOrder?.sale_id || ''}
            />
            <div className="px-1 pb-4 pt-0 md:py-4 md:px-8 grid grid-cols-1 md:grid-cols-12 gap-6 flex-1 overflow-hidden">

                {/* Orders List */}
                <div className={`col-span-1 md:col-span-4 h-full overflow-y-auto scrollbar-hide pb-24 space-y-3 ${selectedOrder ? 'hidden md:block' : 'block'}`}>
                    <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-md pt-[max(env(safe-area-inset-top),16px)] pb-3 md:pb-4 -mx-1 px-2 md:-mx-0 md:px-0 md:pt-0 border-b border-slate-200/50 md:border-b-0 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => router.back()}
                                    className="p-1 hover:bg-slate-200 rounded-lg transition-colors text-slate-600 md:hidden"
                                >
                                    <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
                                </button>
                                <h2 className="text-sm text-slate-500 font-bold">Orders</h2>
                                <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-lg">{filteredOrders.length}</span>
                            </div>

                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setIsSearchOpen(!isSearchOpen)}
                                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${isSearchOpen ? 'bg-rose-500 text-white' : 'hover:bg-slate-200 text-slate-500'}`}
                                >
                                    <Search size={16} />
                                </button>
                                <div className="relative">
                                    <button
                                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                                        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${statusFilter !== 'all' ? 'bg-slate-900 text-white' : 'hover:bg-slate-200 text-slate-500'}`}
                                    >
                                        <SlidersHorizontal size={16} />
                                    </button>

                                    {isFilterOpen && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setIsFilterOpen(false)} />
                                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                                                {statuses.map(s => (
                                                    <button
                                                        key={s}
                                                        onClick={() => {
                                                            setStatusFilter(s);
                                                            setIsFilterOpen(false);
                                                        }}
                                                        className={`w-full text-left px-4 py-2 text-xs font-bold hover:bg-slate-50 transition-colors ${statusFilter === s ? 'text-rose-500 bg-rose-50/50' : 'text-slate-600'}`}
                                                    >
                                                        {s.replace(/_/g, ' ')}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {isSearchOpen && (
                            <div className="animate-in slide-in-from-top-2 duration-200 pb-1">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Search name, ID or product..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-white border border-slate-200 rounded-lg py-2 pl-9 pr-4 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all shadow-sm"
                                        autoFocus
                                    />
                                    {searchQuery && (
                                        <button
                                            onClick={() => setSearchQuery("")}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            <SearchX size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {filteredOrders.length === 0 ? (
                        <div className="bg-white rounded-2xl p-8 border border-dashed border-slate-300 text-center">
                            <Package className="mx-auto text-slate-300 mb-2" size={32} />
                            <p className="text-sm text-slate-500 font-medium">No orders found</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {groupOrder.map(groupName => {
                                const groupItems = groupedOrders[groupName];
                                if (!groupItems || groupItems.length === 0) return null;

                                return (
                                    <div key={groupName} className="space-y-3">
                                        <div className="flex items-center gap-3 px-1">
                                            <span className="text-[10px] font-bold text-rose-500  tracking-[0.2em]">{groupName}</span>
                                            <div className="h-px bg-rose-100 flex-1" />
                                        </div>
                                        {groupItems.map(order => (
                                            <div
                                                key={order.sale_id || order.payment_ref}
                                                onClick={() => handleSelectOrder(order)}
                                                className={`cursor-pointer transition p-4 rounded-lg border ${selectedOrder?.sale_id === order.sale_id ? 'bg-white border-rose-500  ring-1 ring-rose-500/10' : 'bg-white border-slate-100 hover:border-slate-300'}`}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                                        {order.shipments.length > 1 && (
                                                            <>
                                                                <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-slate-900 text-white flex items-center gap-1">
                                                                    <Truck size={10} />
                                                                    {order.shipments.length} Parts
                                                                </span>
                                                                <div className="w-px h-3 bg-slate-200" />
                                                            </>
                                                        )}
                                                        {(() => {
                                                            const statuses = new Set(order.shipments.map(s => s.status));
                                                            const mainStatus = order.shipments.length > 1 && statuses.size > 1 ? 'mixed' : (order.shipments[0]?.status || order.status);

                                                            const isMixed = mainStatus === 'mixed';
                                                            const display = getStatusDisplay(isMixed ? 'pending' : mainStatus);

                                                            return (
                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg truncate ${isMixed ? 'bg-rose-50 text-rose-500 border border-rose-100' : display.color}`}>
                                                                    {isMixed ? 'Multi-Status' : display.label}
                                                                </span>
                                                            );
                                                        })()}
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 font-bold flex-shrink-0">#{order.sale_id || 'REF'}</span>
                                                </div>
                                                <h3 className="font-extrabold text-slate-900 line-clamp-1 text-sm tracking-tight">{order.display_id || order.sale_id}</h3>
                                                <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400 font-bold mb-3  tracking-tighter">
                                                    <User size={10} />
                                                    <span className="truncate">{order.full_name}</span>
                                                    <span className="text-slate-200">|</span>
                                                    <Package size={10} />
                                                    <span className="truncate">
                                                        {order.shipments.reduce((acc, s) => acc + s.items.length, 0)} items
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                                                    <div className="text-xs font-black text-rose-500">
                                                        ₦{Number(order.combined_total || 0).toLocaleString()}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 font-medium">
                                                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Order Details / Tracking View */}
                <div className={`col-span-1 md:col-span-8 h-full overflow-y-auto scrollbar-hide pb-24 ${selectedOrder ? 'block' : 'hidden md:block'}`}>
                    {selectedOrder ? (
                        <div className="bg-white rounded-lg border border-slate-100 overflow-hidden">
                            {/* Detail Header */}
                            <div className="p-6 md:p-8 bg-slate-900 text-white">
                                {/* Mobile Back Button */}
                                <div className="flex justify-between">
                                    <button
                                        onClick={() => {
                                            setSelectedOrder(null);
                                            // Always clear the URL if returning to the list
                                            router.replace('/profile/business/customer-order');
                                        }}
                                        className="md:hidden flex items-center bg-rose-500 rounded-lg p-2 text-slate-200 mb-2 hover:text-white transition shadow-lg active:scale-95"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                    <div className="flex gap-2 items-center">
                                        <button
                                            onClick={handleDownloadFlyer}
                                            title="Download Order Flyer"
                                            className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors text-white"
                                        >
                                            <Download size={18} />
                                        </button>
                                        <span className={`text-[10px] px-4 font-bold py-1 rounded-full bg-rose-500   ${getStatusDisplay(selectedOrder.status).color.replace('bg-', ' text-').replace('text-', 'bg-')}`}>
                                            {getStatusDisplay(selectedOrder.status).label}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            {/* <span className={`text-[10px] lg:hidden font-bold px-2 py-1 rounded-full   ${getStatusDisplay(selectedOrder.status).color.replace('bg-', 'bg-opacity-20 text-').replace('text-', 'text-white bg-')}`}>
                                                {getStatusDisplay(selectedOrder.status).label}
                                            </span> */}
                                            <div className="flex items-center gap-1 text-slate-400 text-xs">
                                                <Calendar size={12} />
                                                {new Date(selectedOrder.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                        <h2 className="text-xl md:text-2xl font-black leading-tight tracking-tight">{selectedOrder.display_id || `ORD-${selectedOrder.sale_id}`}</h2>
                                        <p className="text-slate-400 text-xs mt-1 flex items-center flex-wrap gap-2 font-bold  tracking-tighter">
                                            <span className="flex items-center gap-1"><User size={12} className="text-rose-500" /> {selectedOrder.full_name}</span>
                                            <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                                            <span className="flex items-center gap-1"><Package size={12} className="text-rose-500" /> {selectedOrder.shipments.reduce((acc, s) => acc + s.items.length, 0)} products</span>
                                            {selectedOrder.order_ref && (
                                                <>
                                                    <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                                                </>
                                            )}
                                        </p>
                                    </div>

                                    <div className="flex flex-col items-end">
                                        <div className="text-xl font-bold text-rose-500">₦{Number(selectedOrder.combined_total || 0).toLocaleString()}</div>
                                        <div className="text-slate-400 text-xs tracking-wider">Combined Total</div>
                                    </div>
                                </div>
                            </div>
                            {/* Shipment Tabs */}
                            {selectedOrder.shipments.length > 1 && (
                                <div className="flex border-b border-slate-100 bg-slate-50/30 overflow-x-auto scrollbar-hide">
                                    {selectedOrder.shipments.map((ship, idx) => (
                                        <button
                                            key={ship.shipment_id || idx}
                                            onClick={(e) => {
                                                setActiveShipmentIdx(idx);
                                                (e.target as HTMLElement).closest('button')?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                                            }}
                                            className={`flex-shrink-0 px-6 py-4 flex flex-col items-center transition-all relative ${activeShipmentIdx === idx ? 'text-rose-500 bg-white border-x border-slate-100 first:border-l-0 last:border-r-0' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            <span className="text-[10px] font-black tracking-widest">Shipment {idx + 1}</span>
                                            {activeShipmentIdx === idx && (
                                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-rose-500 rounded-t-full" />
                                            )}
                                            <div className=" block scale-75 whitespace-nowrap">
                                                <span className={`px-2 py-0.5 rounded-lg ${getStatusDisplay(ship.status).color}`}>
                                                    {getStatusDisplay(ship.status).label}
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Status Action Bar (Per Shipment) */}
                            {(() => {
                                if (!selectedOrder) return null;
                                const currentShipment = selectedOrder.shipments[activeShipmentIdx];
                                if (!currentShipment) return null;
                                const shipStatus = currentShipment.status.toLowerCase();
                                const refundable = (shipStatus === 'delivered' || shipStatus === 'released' || shipStatus === 'completed') && isRefundable(currentShipment.items[0]);

                                if (nextStatusMap[shipStatus] || shipStatus === 'refunded' || shipStatus === 'cancelled' || refundable) {
                                    return (
                                        <div
                                            className={`px-4 py-4 ${shipStatus === 'refunded' || shipStatus === 'cancelled' ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-100'} border-b flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 transition group`}
                                        >
                                            <div className="flex flex-col flex-1 gap-3">
                                                <div className="flex items-center gap-3">
                                                    {refreshing && (
                                                        <div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin shrink-0" />
                                                    )}
                                                    <span className="text-[11px] font-bold text-slate-900 leading-tight">
                                                        {shipStatus === 'refunded' || shipStatus === 'cancelled'
                                                            ? "Order Cancelled. Money Refunded to Customer."
                                                            : (shipStatus === 'delivered' || shipStatus === 'released' || shipStatus === 'completed')
                                                                ? (refundable ? "Refund Window Active. You can refund if customer requested." : "Delivered. Return Policy Expired.")
                                                                : shipStatus === 'pending_admin_review'
                                                                    ? "Claim Pending Admin Review. You can still use the customer code for instant approval."
                                                                    : refreshing
                                                                        ? "Processing updates..."
                                                                        : (shipStatus === 'order_placed' || shipStatus === 'pending')
                                                                            ? (selectedOrder.shipments.length > 1 ? "Confirming will accept ALL parts of this order." : "Confirm this order to begin fulfillment.")
                                                                            : (selectedOrder.shipments.length > 1 ? `Ready to ship Shipment ${activeShipmentIdx + 1}?` : "Ready to ship this order?")
                                                        }
                                                    </span>
                                                    {(shipStatus === 'cancelled' || shipStatus === 'refunded') && (selectedOrder.dispute_reason || currentShipment.ship_cancel_reason || currentShipment.items[0]?.status === 'cancelled') && (
                                                        <span className="text-[10px] text-rose-500 font-bold mt-1 bg-rose-50 px-2 py-0.5 rounded-lg w-fit">
                                                            Reason: {selectedOrder.dispute_reason || currentShipment.ship_cancel_reason || currentShipment.items[0]?.item_cancel_reason || 'Vendor cancelled'}
                                                            {(currentShipment.ship_cancel_explanation || currentShipment.items[0]?.item_cancel_explanation) && (
                                                                <span className="block mt-0.5 text-[9px] text-rose-400 normal-case italic font-medium">
                                                                    "{currentShipment.ship_cancel_explanation || currentShipment.items[0]?.item_cancel_explanation}"
                                                                </span>
                                                            )}
                                                        </span>
                                                    )}

                                                    {/* Mobile Actions */}
                                                    {(nextStatusMap[shipStatus] || refundable) && (
                                                        <div className="flex md:hidden items-center gap-2 w-full">
                                                            {!refundable && !['confirmed', 'ready_for_shipping', 'out_for_delivery', 'shipped', 'delivered', 'released', 'completed', 'pending_admin_review'].includes(shipStatus) && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setCancelModalOpen(true);
                                                                    }}
                                                                    className="flex-1 px-5 py-2.5 rounded-lg bg-slate-100 text-slate-600 text-[10px] hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                                                                >
                                                                    <XCircle size={12} />
                                                                    Cancel
                                                                </button>
                                                            )}
                                                            <button
                                                                disabled={refreshing}
                                                                onClick={() => {
                                                                    const items = currentShipment.items || [];
                                                                    if (items.length === 0) {
                                                                        toast.error("No items found in this shipment");
                                                                        return;
                                                                    }
                                                                    const orderIdToUpdate = items[0]?.order_id;
                                                                    if (!orderIdToUpdate) {
                                                                        toast.error("Order ID is missing");
                                                                        return;
                                                                    }
                                                                    if (refundable) handleRefund(orderIdToUpdate);
                                                                    else {
                                                                        const mapped = nextStatusMap[shipStatus];
                                                                        if (!mapped) {
                                                                            toast.error(`No transition available for status: ${shipStatus}`);
                                                                            return;
                                                                        }
                                                                        if (mapped.value === 'delivered') {
                                                                            // Dispute Guard Check
                                                                            if (['held', 'disputed'].includes(currentShipment.escrow_status?.toLowerCase() || '') || (currentShipment.dispute_status === 'open')) {
                                                                                Swal.fire({
                                                                                    title: '<span style="font-weight:900;">Order Under Review ⚠️</span>',
                                                                                    html: `
                                                                                        <div style="text-align: left; padding: 20px;">
                                                                                            <p style="font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 12px;">This order is currently under dispute and is being reviewed by the administration.</p>
                                                                                            
                                                                                            <div style="background: #fff1f2; border: 1px solid #fda4af; padding: 15px; border-radius: 12px; margin-bottom: 20px;">
                                                                                                <p style="font-size: 10px; font-weight: 900; color: #e11d48; text-transform: ; margin-bottom: 4px;">Customer's Reason</p>
                                                                                                <p style="font-size: 13px; font-weight: 600; color: #9f1239;">${currentShipment.dispute_explanation || currentShipment.dispute_reason || 'Customer reported a problem with this shipment.'}</p>
                                                                                            </div>

                                                                                            <p style="font-size: 13px; color: #475569; line-height: 1.6;">
                                                                                                All delivery actions for this shipment have been <b>temporarily disabled</b> while our platform team investigates the claim. We will contact you via email or phone shortly to discuss the resolution.
                                                                                            </p>

                                                                                            <p style="font-size: 12px; color: #94a3b8; font-weight: 600; margin-top: 24px; text-align: center;">
                                                                                                Thank you for your patience and for using our platform.
                                                                                            </p>
                                                                                        </div>
                                                                                    `,
                                                                                    icon: 'info',
                                                                                    confirmButtonText: 'Got it, Thank you',
                                                                                    confirmButtonColor: '#0f172a',
                                                                                    customClass: {
                                                                                        popup: 'rounded-[1.5rem]',
                                                                                        confirmButton: 'rounded-full px-8 py-3 font-bold text-xs '
                                                                                    }
                                                                                });
                                                                                return;
                                                                            }

                                                                            setConfirmingShipmentId(currentShipment); // Pass entire object
                                                                            setConfirmModalOpen(true);
                                                                        } else {
                                                                            updateStatus(orderIdToUpdate, mapped.value);
                                                                        }
                                                                    }
                                                                }}
                                                                className={`flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-white text-[10px]  shadow-lg transition-all ${refundable ? 'bg-rose-500 hover:bg-rose-700' : nextStatusMap[shipStatus]?.color} ${refreshing ? 'opacity-50' : 'active:scale-95'}`}
                                                            >
                                                                {refundable ? <ChevronLeft size={12} /> : (!refreshing && nextStatusMap[shipStatus] && React.createElement(nextStatusMap[shipStatus].icon, { size: 12 }))}
                                                                {refreshing ? "Loading..." : (refundable ? "Refund Customer" : nextStatusMap[shipStatus]?.label)}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Desktop Actions */}
                                            {(nextStatusMap[shipStatus] || refundable) && (
                                                <div className="hidden md:flex items-center gap-2">
                                                    {!refundable && !['confirmed', 'ready_for_shipping', 'out_for_delivery', 'shipped', 'delivered', 'released', 'completed', 'pending_admin_review'].includes(shipStatus) && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setCancelModalOpen(true);
                                                            }}
                                                            className="px-5 py-2.5 rounded-lg bg-slate-100 text-slate-600 text-[10px] hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                                                        >
                                                            <XCircle size={12} />
                                                            Cancel Order
                                                        </button>
                                                    )}
                                                    <button
                                                        disabled={refreshing}
                                                        onClick={() => {
                                                            const orderIdToUpdate = currentShipment.items[0]?.order_id;
                                                            if (!orderIdToUpdate) return;
                                                            if (refundable) handleRefund(orderIdToUpdate);
                                                            if (nextStatusMap[shipStatus].value === 'delivered') {
                                                                // Dispute Guard Check (Desktop)
                                                                if (['held', 'disputed'].includes(currentShipment.escrow_status?.toLowerCase() || '') || (currentShipment.dispute_status === 'open')) {
                                                                    Swal.fire({
                                                                        title: '<span style="font-weight:900;">Order Under Review ⚠️</span>',
                                                                        html: `
                                                                                        <div style="text-align: left; padding: 20px;">
                                                                                            <p style="font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 12px;">This order is currently under dispute and is being reviewed by the administration.</p>
                                                                                            
                                                                                            <div style="background: #fff1f2; border: 1px solid #fda4af; padding: 15px; border-radius: 12px; margin-bottom: 20px;">
                                                                                                <p style="font-size: 10px; font-weight: 900; color: #e11d48; text-transform: ; margin-bottom: 4px;">Customer's Reason</p>
                                                                                                <p style="font-size: 13px; font-weight: 600; color: #9f1239;">${currentShipment.dispute_explanation || currentShipment.dispute_reason || 'Customer reported a problem with this shipment.'}</p>
                                                                                            </div>

                                                                                            <p style="font-size: 13px; color: #475569; line-height: 1.6;">
                                                                                                All delivery actions for this shipment have been <b>temporarily disabled</b> while our platform team investigates the claim. We will contact you via email or phone shortly to discuss the resolution.
                                                                                            </p>

                                                                                            <p style="font-size: 12px; color: #94a3b8; font-weight: 600; margin-top: 24px; text-align: center;">
                                                                                                Thank you for your patience and for using our platform.
                                                                                            </p>
                                                                                        </div>
                                                                                    `,
                                                                        icon: 'info',
                                                                        confirmButtonText: 'Got it, Thank you',
                                                                        confirmButtonColor: '#0f172a',
                                                                        customClass: {
                                                                            popup: 'rounded-[1.5rem]',
                                                                            confirmButton: 'rounded-full px-8 py-3 font-bold text-xs '
                                                                        }
                                                                    });
                                                                    return;
                                                                }

                                                                setConfirmingShipmentId(currentShipment); // Pass entire object
                                                                setConfirmModalOpen(true);
                                                            } else {
                                                                updateStatus(orderIdToUpdate, nextStatusMap[shipStatus].value);
                                                            }
                                                        }}
                                                        className={`flex items-center justify-center gap-2 px-8 py-2.5 rounded-lg text-white text-[10px] font-bold shadow-lg transition-all ${refundable ? 'bg-rose-500 hover:bg-rose-700' : nextStatusMap[shipStatus]?.color} ${refreshing ? 'opacity-50' : 'hover:scale-[1.02] active:scale-95'}`}
                                                    >
                                                        {refundable ? <ChevronLeft size={12} /> : (!refreshing && nextStatusMap[shipStatus] && React.createElement(nextStatusMap[shipStatus].icon, { size: 12 }))}
                                                        {refreshing ? "Loading..." : (refundable ? "Refund Customer" : nextStatusMap[shipStatus]?.label)}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            <div className="p-2 md:p-4 grid md:grid-cols-2 gap-8">
                                {/* Left: Items & Delivery */}
                                <div className="space-y-8">
                                    <section>
                                        <h4 className="text-[10px] font-bold text-slate-400   mb-4 ">
                                            {selectedOrder.shipments.length > 1 ? `Products in Shipment ${activeShipmentIdx + 1}` : 'Order Products'}
                                        </h4>
                                        <div className="space-y-4">
                                            {(() => {
                                                const ship = selectedOrder.shipments[activeShipmentIdx];
                                                if (!ship) return null;
                                                return (
                                                    <div className="bg-slate-50/50 rounded-lg p-4 border border-slate-100">
                                                        <div className="flex items-center justify-between mb-4 px-1">
                                                            <div className="flex items-center gap-2">
                                                                {selectedOrder.shipments.length > 1 && (
                                                                    <div className="w-7 h-7 bg-rose-500 rounded-lg flex items-center justify-center text-white text-[10px] font-black">
                                                                        {activeShipmentIdx + 1}
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <h6 className="text-xs font-bold text-slate-900">
                                                                        {selectedOrder.shipments.length > 1 ? `Shipment ${activeShipmentIdx + 1}` : 'Standard Shipping'}
                                                                    </h6>
                                                                    <p className="text-[9px] text-slate-400 font-bold  tracking-tighter">Promise: {ship.shipping_promise || 'Standard'}</p>
                                                                </div>
                                                            </div>
                                                            <span className={`text-[10px] font-bold px-3 py-1 rounded-lg ${getStatusDisplay(ship.status).color}`}>
                                                                {getStatusDisplay(ship.status).label}
                                                            </span>
                                                        </div>

                                                        <div className="space-y-3">
                                                            {ship.items.map((item, idx) => (
                                                                <div key={`${item.order_id}-${idx}`} className="flex gap-4 p-3 bg-white rounded-lg border border-slate-50 group hover:shadow-md transition-all duration-300">
                                                                    <div className="w-14 h-14 bg-slate-50 rounded-lg overflow-hidden flex-shrink-0 border border-slate-100">
                                                                        {item.product_image ? (
                                                                            <img src={item.product_image} alt={item.product_name} className="w-full h-full object-cover" />
                                                                        ) : (
                                                                            <div className="w-full h-full flex items-center justify-center"><Package className="text-slate-300" size={18} /></div>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="grid grid-cols-[1fr,auto] items-start gap-2 min-w-0 w-full overflow-hidden">
                                                                            <h5 className="font-bold text-slate-900 text-xs truncate block min-w-0">
                                                                                {item.product_name}
                                                                            </h5>
                                                                            <p className="text-xs font-bold text-slate-900 flex-shrink-0 whitespace-nowrap">
                                                                                ₦{Number(item.total_item_price || 0).toLocaleString()}
                                                                            </p>
                                                                        </div>
                                                                        {item.variant_info && (
                                                                            <p className="text-[9px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded w-fit mt-1">{item.variant_info}</p>
                                                                        )}
                                                                        <div className="flex items-center justify-between mt-1">
                                                                            <p className="text-[10px] text-slate-400 font-bold">Quantity: {item.quantity}</p>
                                                                            <button
                                                                                onClick={() => {
                                                                                    setSnapshotItem(item);
                                                                                    setSnapshotOpen(true);
                                                                                }}
                                                                                className="text-[10px] font-black text-rose-500 hover:text-rose-500 flex items-center gap-1 transition-colors"
                                                                            >
                                                                                <ShieldCheck size={10} />
                                                                                View Snapshot
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </section>

                                    <section>
                                        <h4 className="text-[10px] font-bold text-slate-400   mb-4">Customer Delivery</h4>
                                        <div className="bg-slate-50 p-5 rounded-lg border border-slate-100">
                                            {(() => {
                                                try {
                                                    const addr = JSON.parse(selectedOrder.delivery_address);
                                                    return (
                                                        <>
                                                            <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-200/50">
                                                                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-sm font-bold text-slate-900 border overflow-hidden">
                                                                    {selectedOrder.customer_profile_pic ? (
                                                                        <img src={selectedOrder.customer_profile_pic} alt={addr.recipientName} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        (addr.recipientName || selectedOrder.full_name).charAt(0)
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="font-bold text-slate-900 text-sm truncate">{(addr.recipientName && addr.recipientName !== 'null') ? addr.recipientName : selectedOrder.full_name}</div>
                                                                    <div className="text-xs text-slate-500">{(addr.contactNo && addr.contactNo !== 'null') ? addr.contactNo : (selectedOrder.phone !== 'null' ? selectedOrder.phone : '')}</div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        onClick={() => handleMessageClick(selectedOrder.customer_id)}
                                                                        disabled={messageLoading}
                                                                        className="w-8 h-8 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100 transition-colors active:scale-90 disabled:opacity-50"
                                                                        title="Message Customer"
                                                                    >
                                                                        {messageLoading ? (
                                                                            <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                                                                        ) : (
                                                                            <MessageSquare size={16} />
                                                                        )}
                                                                    </button>
                                                                    <a
                                                                        href={`tel:${(addr.contactNo && addr.contactNo !== 'null') ? addr.contactNo : selectedOrder.phone}`}
                                                                        className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition-colors active:scale-90"
                                                                        title="Call Customer"
                                                                    >
                                                                        <Phone size={16} />
                                                                    </a>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-3">
                                                                <MapPin className="text-rose-500 mt-1 shrink-0" size={16} />
                                                                <div className="text-xs text-slate-600 font-medium leading-relaxed">
                                                                    <p className="text-slate-900 font-bold mb-0.5">{addr.address}</p>
                                                                    <p>{addr.region}</p>
                                                                </div>
                                                            </div>
                                                        </>
                                                    );
                                                } catch (e) {
                                                    return (
                                                        <>
                                                            <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-200/50">
                                                                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-sm font-bold text-slate-900 border overflow-hidden">
                                                                    {selectedOrder.customer_profile_pic ? (
                                                                        <img src={selectedOrder.customer_profile_pic} alt={selectedOrder.full_name} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        selectedOrder.full_name.charAt(0)
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="font-bold text-slate-900 text-sm truncate">{selectedOrder.full_name}</div>
                                                                    <div className="text-xs text-slate-500">{selectedOrder.phone !== 'null' ? selectedOrder.phone : ''}</div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        onClick={() => handleMessageClick(selectedOrder.customer_id)}
                                                                        disabled={messageLoading}
                                                                        className="w-8 h-8 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100 transition-colors active:scale-90 disabled:opacity-50"
                                                                        title="Message Customer"
                                                                    >
                                                                        {messageLoading ? (
                                                                            <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                                                                        ) : (
                                                                            <MessageSquare size={16} />
                                                                        )}
                                                                    </button>
                                                                    <a
                                                                        href={`tel:${selectedOrder.phone}`}
                                                                        className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition-colors active:scale-90"
                                                                        title="Call Customer"
                                                                    >
                                                                        <Phone size={16} />
                                                                    </a>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-3">
                                                                <MapPin className="text-slate-400 mt-1" size={16} />
                                                                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                                                                    {selectedOrder.delivery_address}
                                                                </p>
                                                            </div>
                                                        </>
                                                    );
                                                }
                                            })()}
                                        </div>
                                    </section>

                                    {/* Rider Info Section */}
                                    <section>
                                        <h4 className="text-[10px] font-bold text-slate-400   mb-4">Delivery Partner</h4>
                                        <div className="bg-slate-50 p-5 rounded-lg border border-slate-100">
                                            {(() => {
                                                const ship = selectedOrder.shipments[activeShipmentIdx];
                                                const rider = ship?.items.find(i => i.rider_name);
                                                if (rider) {
                                                    return (
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 bg-rose-50 rounded-lg flex items-center justify-center text-rose-500 border border-rose-100">
                                                                <Truck size={20} />
                                                            </div>
                                                            <div>
                                                                <div className="text-[9px] text-slate-400 ">
                                                                    {selectedOrder.shipments.length > 1 ? `Shipment ${activeShipmentIdx + 1} Rider` : 'Delivery Rider'}
                                                                </div>
                                                                <div className="font-bold text-slate-900 text-sm">{rider.rider_name}</div>
                                                                <div className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                                                                    <Phone size={10} />
                                                                    {rider.rider_phone || "N/A"}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return (
                                                    <div className="flex items-center gap-3 text-slate-400 py-2">
                                                        <Clock size={16} />
                                                        <span className="text-xs font-bold   italic">Awaiting Rider Pickup</span>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </section>
                                </div>

                                {/* Right: Tracking Timeline */}
                                <div className="bg-slate-50 rounded-lg p-6 md:p-8 border border-slate-100 h-fit">
                                    <h4 className="text-[10px] font-bold text-slate-400   mb-6 flex items-center gap-2">
                                        <Truck size={14} />
                                        Tracking History
                                    </h4>

                                    <div className="space-y-8 relative">
                                        <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-200"></div>

                                        {tracking.map((t, idx) => (
                                            <div key={t.history_id} className="relative pl-10">
                                                <div className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center scale-75 border-4 bg-white ${idx === tracking.length - 1 ? 'border-rose-500' : 'border-slate-300'}`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${idx === tracking.length - 1 ? 'bg-rose-500 animate-pulse' : 'bg-slate-300'}`}></div>
                                                </div>
                                                <div>
                                                    <p className={`text-[10px] font-bold  tracking-wider mb-0.5 ${idx === tracking.length - 1 ? 'text-rose-500' : 'text-slate-400'}`}>
                                                        {t.status.replace(/_/g, ' ')}
                                                    </p>
                                                    <p className="text-sm font-bold text-slate-900 mb-1 leading-tight">{t.message}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold">
                                                        {new Date(t.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}

                                        {tracking.length === 0 && (
                                            <div className="text-center py-10 opacity-30">
                                                <Clock size={32} className="mx-auto mb-2" />
                                                <p className="text-xs font-bold  ">Awaiting Logs</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-[600px] bg-white rounded-lg border border-dashed border-slate-300 flex flex-col items-center justify-center text-center p-12">
                            <div className="flex items-center justify-center mb-6 ">
                                <img
                                    src="/assets/images/cart.png"
                                    alt="No orders"
                                    className="w-30 h-30 object-contain animate-in zoom-in-95 duration-500"
                                />
                            </div>
                            <p className="text-slate-500 max-w-sm text-sm">Pick a grouped order from the left to manage multiple items, see customer info, and track the delivery flow.</p>
                        </div>
                    )}
                </div>
            </div>
            <div id="printable-flyer" className="hidden">
                {selectedOrder && (
                    <OrderSummaryFlyer
                        order={{
                            ...selectedOrder,
                            items: selectedOrder.shipments.flatMap(s => s.items),
                            vendor_info: {
                                name: user?.business?.business_name || user?.name || "Merchant",
                                logo: user?.business?.business_logo || user?.business?.logo || "/assets/images/logo.png",
                                phone: user?.business?.phone_no || user?.phone_no || "",
                                address: user?.business?.business_address || ""
                            }
                        } as any}
                    />
                )}
            </div>

            <style jsx global>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 0;
                    }
                    body {
                        visibility: hidden;
                        margin: 0;
                        padding: 0;
                    }
                    #printable-flyer, #printable-flyer * {
                        visibility: visible;
                    }
                    #printable-flyer {
                        display: block !important;
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        width: 100%;
                        height: 100%;
                        background: white;
                        z-index: 999999;
                    }
                }
            `}</style>

            {/* Confirm Delivery Modal */}
            {confirmModalOpen && confirmingShipmentId && (
                <ConfirmDeliveryModal
                    shipment={confirmingShipmentId}
                    onClose={() => {
                        setConfirmModalOpen(false);
                        setConfirmingShipmentId(null);
                    }}
                    onSuccess={() => {
                        setConfirmModalOpen(false);
                        setConfirmingShipmentId(null);
                        fetchOrders();
                    }}
                    token={token || ''}
                    API_BASE_URL={API_BASE_URL}
                />
            )}
        </div>

    );
}
// --- Confirm Delivery Modal (Primary + Fallback) ---
function ConfirmDeliveryModal({ shipment, onClose, onSuccess, token, API_BASE_URL }: any) {
    const { playSound } = useAudio();
    const shipmentId = shipment?.shipment_id || shipment?.id;
    const isPendingReview = shipment?.status === 'pending_admin_review';
    const [step, setStep] = useState<'method' | 'code' | 'fallback' | 'review'>(isPendingReview ? 'review' : 'method');
    const [digits, setDigits] = useState(['', '', '', '']);
    const [reason, setReason] = useState('');
    const [explanation, setExplanation] = useState('');
    const [images, setImages] = useState<{ file: File, preview: string }[]>([]);
    const inputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);

    const handleDigitChange = (idx: number, val: string) => {
        const char = val.slice(-1).replace(/\D/g, '');
        if (!char && val !== '') return;

        const newDigits = [...digits];
        newDigits[idx] = char;
        setDigits(newDigits);

        if (char && idx < 3) {
            inputRefs[idx + 1].current?.focus();
        }

        if (newDigits.every(d => d !== '')) {
            handleCodeSubmit(newDigits.join(''));
        }
    };

    const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
            inputRefs[idx - 1].current?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
        if (pasteData.length > 0) {
            const newDigits = [...digits];
            pasteData.split('').forEach((char, i) => {
                if (i < 4) newDigits[i] = char;
            });
            setDigits(newDigits);

            // Focus the last filled input or the next one
            const nextIdx = Math.min(pasteData.length, 3);
            inputRefs[nextIdx].current?.focus();

            if (newDigits.every(d => d !== '')) {
                handleCodeSubmit(newDigits.join(''));
            }
        }
    };

    const handleCodeSubmit = async (finalCode: string) => {
        setIsSubmitting(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/orders/${shipmentId}/confirm-delivery`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ code: finalCode })
            });
            const data = await res.json();
            if (data.status === 'success' || data.success) {
                // Play credited sound as vendor wallet has been credited
                playSound("credited");
                onSuccess(); // Close and refresh list
                Swal.fire({
                    title: 'Delivery Confirmed!',
                    text: 'The 4-digit code was verified successfully. Funds have been released to your wallet.',
                    icon: 'success',
                    confirmButtonColor: '#10b981'
                });
            } else {
                toast.error(data.message || "Failed to confirm delivery");
                // Clear code on error to retry
                setDigits(['', '', '', '']);
                inputRefs[0].current?.focus();
            }
        } catch (err) {
            toast.error("An error occurred. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFallbackSubmit = async () => {
        const isOther = reason === "Other (See explanation)";
        if (isOther && !explanation) {
            toast.error("Please provide an explanation.");
            return;
        }
        if (!reason) {
            toast.error("Please select a reason.");
            return;
        }
        if (images.length === 0) {
            toast.error("Please upload at least one proof image.");
            return;
        }

        setIsSubmitting(true);
        try {
            setUploading(true);
            const formData = new FormData();
            images.forEach(img => formData.append('files', img.file));

            const uploadRes = await fetch(`${API_BASE_URL}/api/meta/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const uploadData = await uploadRes.json();
            setUploading(false);

            if (uploadData.status !== 'success') {
                toast.error("Proof upload failed");
                setIsSubmitting(false);
                return;
            }

            const urls = uploadData.data.filenames.map((u: string) =>
                u.startsWith('http') ? u : `${API_BASE_URL}/public/${u}`
            );

            const res = await fetch(`${API_BASE_URL}/api/orders/${shipmentId}/confirm-delivery`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    reason,
                    explanation: isOther ? explanation : reason,
                    proof_images: urls
                })
            });
            const data = await res.json();
            if (data.status === 'success' || data.success) {
                // Not credited yet, but delivery info submitted
                playSound("delivery_confirmed");
                onSuccess();
                Swal.fire({
                    title: 'Review Submitted',
                    text: 'Delivery details have been sent for admin review. This usually takes 24-48 hours.',
                    icon: 'info',
                    confirmButtonColor: '#f43f5e'
                });
            } else {
                toast.error(data.message || "Failed to submit delivery");
            }
        } catch (err) {
            toast.error("An error occurred. Please try again.");
        } finally {
            setIsSubmitting(false);
            setUploading(false);
        }
    };

    const handleImageSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const newImages = Array.from(files).map(file => ({
            file,
            preview: URL.createObjectURL(file)
        }));

        setImages(prev => [...prev, ...newImages].slice(0, 5));
    };

    const removeImage = (idx: number) => {
        setImages(prev => {
            const updated = [...prev];
            URL.revokeObjectURL(updated[idx].preview);
            updated.splice(idx, 1);
            return updated;
        });
    };

    const reasons = [
        "Customer misplaced phone",
        "No internet access / Poor signal",
        "Code not received / SMS delay",
        "Delivery at reception / security post",
        "Customer request (Special case)",
        "Other (See explanation)"
    ];

    return (
        <div className="fixed inset-0 z-[200000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-[0.5rem] w-full max-w-md shadow-2xl relative overflow-hidden flex flex-col max-h-[95vh]">

                {/* Header */}
                <div className="p-6 flex items-center justify-between bg-white relative">
                    {step !== 'method' && step !== 'review' && (
                        <button onClick={() => setStep(isPendingReview ? 'review' : 'method')} className="p-2 hover:bg-slate-100 rounded-full transition-colors absolute left-4">
                            <ChevronLeft size={18} className="text-slate-400" />
                        </button>
                    )}
                    <h3 className="text-base font-black text-slate-900 w-full text-center">
                        {step === 'method' ? "Confirm Delivery" : step === 'review' ? "Review Status" : "Delivery Review"}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors absolute right-4">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar bg-slate-50/30">
                    {step === 'method' && (
                        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-300">
                            <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 mb-6 font-bold">
                                <div className="flex gap-3">
                                    <ShieldAlert className="text-orange-600 flex-shrink-0" size={20} />
                                    <p className="text-xs text-orange-900 leading-relaxed">
                                        Secure verification prevents fraud. Primary method requires customer code. Only use fallback method if absolutely necessary.
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => setStep('code')}
                                className="w-full p-6 text-left rounded-2xl border border-slate-100 bg-white hover:border-emerald-200 hover:bg-emerald-50/50 transition-all group flex items-start gap-4 shadow-sm"
                            >
                                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                                    <ShieldCheck size={24} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <h4 className="text-sm font-black text-slate-900">Use Delivery Code</h4>
                                        <span className="text-[10px] font-black text-white bg-emerald-500 px-2 py-0.5 rounded-full  tracking-widest">Recommended</span>
                                    </div>
                                    <p className="text-xs text-slate-400 font-medium leading-relaxed">Enter the 4-digit code provided by the customer. Payment released instantly.</p>
                                </div>
                            </button>

                            <button
                                onClick={() => setStep('fallback')}
                                disabled={isPendingReview}
                                className={`w-full p-6 text-left rounded-2xl border border-slate-100 bg-white transition-all group flex items-start gap-4 shadow-sm ${isPendingReview ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:border-rose-200 hover:bg-rose-50/50'}`}
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${isPendingReview ? 'bg-slate-100 text-slate-400' : 'bg-rose-100 text-rose-500'}`}>
                                    <FileText size={24} />
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-sm font-black text-slate-900 mb-1">No Code (Fallback)</h4>
                                    <p className="text-xs text-slate-400 font-medium leading-relaxed">
                                        {isPendingReview ? "Delivery proof already submitted for review." : "Provide proof of delivery and explanation. Subject to 48h admin review."}
                                    </p>
                                </div>
                            </button>
                        </div>
                    )}

                    {step === 'review' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100 mb-6 shadow-sm">
                                <div className="flex gap-4">
                                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shrink-0">
                                        <Clock size={20} />
                                    </div>
                                    <div>
                                        <h5 className="text-[12px] font-black text-blue-900  tracking-widest mb-1">Claim Under Review</h5>
                                        <p className="text-[11px] text-blue-700/80 font-bold leading-relaxed">
                                            Fulfillment proof was submitted on {new Date(shipment.updated_at || shipment.created_at).toLocaleDateString()}. Admin will verify this within 48h.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <section className="p-5 bg-white rounded-2xl border border-slate-100 space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400  tracking-widest block mb-2">Claim Reason</label>
                                        <p className="text-[13px] font-black text-slate-900 leading-snug">{shipment.delivery_review_reason || "Standard Delivery Claim"}</p>
                                    </div>

                                    {shipment.delivery_review_explanation && (
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400  tracking-widest block mb-2">Explanation</label>
                                            <p className="text-[12px] font-bold text-slate-500 leading-relaxed bg-slate-50/50 p-3 rounded-lg border border-slate-100/50 italic">
                                                "{shipment.delivery_review_explanation}"
                                            </p>
                                        </div>
                                    )}

                                    {shipment.delivery_review_images && (() => {
                                        try {
                                            const imgs = JSON.parse(shipment.delivery_review_images);
                                            if (imgs.length > 0) {
                                                return (
                                                    <div>
                                                        <label className="text-[10px] font-black text-slate-400  tracking-widest block mb-2">Evidence Provided</label>
                                                        <div className="flex gap-3 mt-1 overflow-x-auto pb-2 scrollbar-hide">
                                                            {imgs.map((url: string, i: number) => (
                                                                <img key={i} src={url} className="w-20 h-20 rounded-xl object-cover border-2 border-white shadow-sm ring-1 ring-slate-100 flex-shrink-0" />
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            }
                                        } catch (e) { } return null;
                                    })()}
                                </section>

                                <div className="pt-2">
                                    <button
                                        onClick={() => setStep('code')}
                                        className="w-full p-4 rounded-2xl bg-emerald-50 border-2 border-dashed border-emerald-200 hover:border-emerald-500 hover:bg-emerald-100/50 transition-all group"
                                    >
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="flex items-center gap-2 text-emerald-700">
                                                <ShieldCheck size={18} className="animate-bounce" />
                                                <span className="text-sm font-black tracking-tight">Have the Delivery Code?</span>
                                            </div>
                                            <p className="text-[11px] font-black text-emerald-600  tracking-widest group-hover:scale-105 transition-transform underline underline-offset-4 decoration-2">Verify the Delivery NOW</p>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'code' && (
                        <div className="animate-in slide-in-from-right-4 duration-300">
                            <div className="flex flex-col items-center text-center mt-4">
                                <div className="w-16 h-16 bg-emerald-50 rounded-3xl flex items-center justify-center mb-4">
                                    <ShieldCheck size={32} className="text-emerald-500" />
                                </div>
                                <h4 className="text-xl font-black text-slate-900 mb-2">Enter 4-Digit Code</h4>
                                <p className="text-xs text-slate-400 font-bold mb-8 max-w-[240px]">Ask the customer for the code sent to their email or WhatsApp.</p>
                            </div>

                            <div className="flex justify-center gap-3 mb-10 mt-6 px-10">
                                {digits.map((d, i) => (
                                    <input
                                        key={i}
                                        ref={inputRefs[i]}
                                        type="text"
                                        maxLength={1}
                                        value={d}
                                        onChange={(e) => handleDigitChange(i, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(i, e)}
                                        onPaste={handlePaste}
                                        disabled={isSubmitting}
                                        className="w-14 h-16 text-2xl text-center font-black border-2 border-slate-100 focus:border-emerald-500 rounded-2xl outline-none transition-all shadow-inner bg-slate-50 focus:bg-white"
                                        autoFocus={i === 0}
                                    />
                                ))}
                            </div>

                            <div className="flex flex-col items-center gap-4">
                                {isSubmitting ? (
                                    <div className="flex items-center gap-2 text-emerald-600 font-black text-xs  tracking-widest animate-pulse">
                                        <div className="w-4 h-4 border-2 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
                                        Verifying Secure Code...
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-slate-400 font-black  tracking-widest">Awaiting customer code</p>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 'fallback' && (
                        <div className="animate-in slide-in-from-right-4 duration-300 space-y-6 pb-4">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400  tracking-widest">Select Reason</label>
                                    <div className="space-y-2 mt-5">
                                        {reasons.map((r) => (
                                            <div
                                                key={r}
                                                onClick={() => setReason(r)}
                                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer group ${reason === r ? 'bg-white border-rose-200 shadow-sm' : 'bg-white/50 border-slate-100 hover:border-slate-200'}`}
                                            >
                                                <span className={`text-[13px] font-bold ${reason === r ? 'text-slate-900' : 'text-slate-400'}`}>{r}</span>
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${reason === r ? "bg-rose-500 border-rose-500 shadow-lg shadow-rose-200" : "bg-white border-slate-200"}`}>
                                                    {reason === r && <CheckCircle2 size={10} className="text-white stroke-[3] animate-in zoom-in duration-200" />}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {reason === "Other (See explanation)" && (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <label className="text-[10px] font-black text-slate-400  tracking-widest">Explanation</label>
                                        <DescriptionTextarea
                                            value={explanation}
                                            onChange={setExplanation}
                                            placeholder="Briefly explain the situation..."
                                            maxLength={500}
                                            required
                                        />
                                    </div>
                                )}

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400  tracking-widest block">Media Proof (Min 1 Image)</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {images.map((img, idx) => (
                                            <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 shadow-sm animate-in zoom-in-90">
                                                <img src={img.preview} className="w-full h-full object-cover" />
                                                <button
                                                    onClick={() => removeImage(idx)}
                                                    className="absolute top-1 right-1 bg-white/90 p-1 rounded-full shadow-lg hover:bg-rose-500 hover:text-white transition-all"
                                                >
                                                    <X size={10} />
                                                </button>
                                            </div>
                                        ))}
                                        {images.length < 5 && (
                                            <div className="relative aspect-square group">
                                                <input
                                                    type="file"
                                                    multiple
                                                    accept="image/*"
                                                    onChange={handleImageSelection}
                                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                                />
                                                <div className={`w-full h-full border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-1 group-hover:bg-white group-hover:border-rose-300 transition-all ${uploading ? 'animate-pulse' : 'bg-white/50'}`}>
                                                    {uploading ? <Clock size={16} className="text-rose-400" /> : <Camera size={16} className="text-slate-300" />}
                                                    <span className="text-[8px] font-black text-slate-400  tracking-tighter">Add Photo</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[9px] text-slate-400 font-medium italic">Photos of package at customer location are best.</p>
                                </div>
                            </div>

                            <button
                                disabled={isSubmitting || !reason || (reason === "Other (See explanation)" && !explanation) || images.length === 0}
                                onClick={handleFallbackSubmit}
                                className="w-full py-2.5 bg-rose-500 text-white rounded-full text-sm shadow-xl shadow-rose-200 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all flex items-center justify-center gap-2 mt-4"
                            >
                                {isSubmitting ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                        {uploading ? "Uploading Proof..." : "Submitting..."}
                                    </div>
                                ) : (
                                    <>
                                        <Send size={18} />
                                        Request Delivery Confirmation
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

