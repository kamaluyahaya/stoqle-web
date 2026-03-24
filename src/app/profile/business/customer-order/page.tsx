"use client";

import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "@/src/lib/config";
import { useAuth } from "@/src/context/authContext";
import { cancelOrder, refundOrder } from "@/src/lib/api/orderApi";
import { ArrowLeft, CheckCircle2, Truck, Package, Search, SearchX, Filter, MoreVertical, XCircle, ChevronRight, MapPin, Phone, User, Info, Calendar, Hash, ExternalLink, ShieldCheck, Clock, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import OrderSnapshotModal from "@/src/components/orders/OrderSnapshotModal";
import CancelOrderModal from "@/src/components/orders/CancelOrderModal";
import { useRouter, useSearchParams } from "next/navigation";
import OrderSummaryFlyer from "@/src/components/orders/OrderSummaryFlyer";
import { Download } from "lucide-react";

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
    shipment_id: number | string;
    status: string;
    shipping_promise: string | null;
    items: (OrderItem & { rider_name?: string | null; rider_phone?: string | null })[];
    ship_cancel_reason?: string | null;
    ship_cancel_explanation?: string | null;
    delivered_at?: string | null;
}

interface MasterOrder {
    sale_id: number | null;
    master_order_id?: number | string | null;
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
    shipments: Shipment[];
}

export default function VendorOrdersPage() {
    const { token, user } = useAuth();
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
    const [isCancelling, setIsCancelling] = useState(false);
    const flyerRef = React.useRef<HTMLDivElement>(null);

    const statuses = ["all", "order_placed", "confirmed", "ready_for_shipping", "out_for_delivery", "delivered", "cancelled"];

    // Status progression map (Vendors stop at 'shipped' which is 'Ship Order')
    const nextStatusMap: Record<string, { label: string; value: string; color: string; icon: any }> = {
        'order_placed': { label: 'Confirm Order', value: 'confirmed', color: 'bg-emerald-600', icon: CheckCircle2 },
        'pending': { label: 'Confirm Order', value: 'confirmed', color: 'bg-emerald-600', icon: CheckCircle2 },
        'confirmed': { label: 'Ready for Shipping', value: 'ready_for_shipping', color: 'bg-indigo-600', icon: Truck },
        'ready_for_pickup': { label: 'Confirm Order', value: 'confirmed', color: 'bg-emerald-600', icon: CheckCircle2 },
        'processing': { label: 'Ready for Shipping', value: 'ready_for_shipping', color: 'bg-indigo-600', icon: Truck },
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
                return { label: "Completed", color: "bg-rose-50 text-rose-600 border border-rose-100", icon: CheckCircle2 };
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

    useEffect(() => { fetchOrders(); }, [token]);
 
    useEffect(() => {
        if (!loading && (requestedOrderId || requestedOrderRef) && orders.length > 0 && !selectedOrder) {
            const match = orders.find(o => 
                (requestedOrderId && String(o.master_order_id) === String(requestedOrderId)) ||
                (requestedOrderRef && (o.order_ref === requestedOrderRef || o.display_id === requestedOrderRef || o.payment_ref === requestedOrderRef))
            );
            if (match) setSelectedOrder(match);
        }
    }, [loading, requestedOrderId, requestedOrderRef, orders, selectedOrder]);

    const handleCancelOrder = async (cancelData: { type: string; reason: string; explanation?: string }) => {
        if (!selectedOrder) return;

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
        <div className="flex h-screen items-center justify-center bg-slate-50">
            <div className="animate-spin h-8 w-8 border-4 border-rose-500 border-t-transparent rounded-full" />
        </div>
    );

    return (
        <div className="md:h-screen md:overflow-hidden bg-slate-50">
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
            <div className="px-1 py-4 md:px-8 grid grid-cols-1 md:grid-cols-12 gap-6 md:h-full">

                {/* Orders List */}
                <div className={`col-span-1 md:col-span-4 space-y-3 ${selectedOrder ? 'hidden md:block' : 'block'} md:h-full md:overflow-y-auto scrollbar-hide md:pb-24`}>
                    <div className="flex items-center justify-between mb-4 px-1">
                        <div className="flex items-center gap-2">
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
                                                    className={`w-full text-left px-4 py-2 text-xs font-bold   hover:bg-slate-50 transition-colors ${statusFilter === s ? 'text-rose-500 bg-rose-50/50' : 'text-slate-600'}`}
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
                        <div className="px-1 mb-4 animate-in slide-in-from-top-2 duration-200">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <input
                                    type="text"
                                    placeholder="Search name, ID or product..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-lg py-2 pl-9 pr-4 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
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
                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg truncate ${isMixed ? 'bg-rose-50 text-rose-600 border border-rose-100' : display.color}`}>
                                                                    {isMixed ? 'Multi-Status' : display.label}
                                                                </span>
                                                            );
                                                        })()}
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 font-bold flex-shrink-0">#{order.sale_id || 'REF'}</span>
                                                </div>
                                                <h3 className="font-extrabold text-slate-900 line-clamp-1 text-sm tracking-tight">{order.display_id || order.sale_id}</h3>
                                                <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400 font-bold mb-3 uppercase tracking-tighter">
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
                <div className={`col-span-1 md:col-span-8 ${selectedOrder ? 'block' : 'hidden md:block'} md:h-full md:overflow-y-auto scrollbar-hide md:pb-24`}>
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
                                        className="md:hidden flex items-center bg-red-500 rounded-lg p-2 text-slate-200 mb-2 hover:text-white transition shadow-lg active:scale-95"
                                    >
                                        <ArrowLeft size={20} />
                                    </button>
                                    <div className="flex gap-2 items-center">
                                        <button
                                            onClick={handleDownloadFlyer}
                                            title="Download Order Flyer"
                                            className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors text-white"
                                        >
                                            <Download size={18} />
                                        </button>
                                        <span className={`text-[10px] font-bold px-2 py-2 rounded-lg   ${getStatusDisplay(selectedOrder.status).color.replace('bg-', 'bg-opacity-20 text-').replace('text-', 'text-white bg-')}`}>
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
                                        <p className="text-slate-400 text-xs mt-1 flex items-center flex-wrap gap-2 font-bold uppercase tracking-tighter">
                                            <span className="flex items-center gap-1"><User size={12} className="text-rose-500" /> {selectedOrder.full_name}</span>
                                            <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                                            <span className="flex items-center gap-1"><Package size={12} className="text-rose-500" /> {selectedOrder.shipments.reduce((acc, s) => acc + s.items.length, 0)} products</span>
                                            {selectedOrder.order_ref && (
                                                <>
                                                    <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                                                    <span className="text-white bg-slate-800 px-2 py-0.5 rounded">Ref: {selectedOrder.order_ref}</span>
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
                                                                : refreshing 
                                                                    ? "Processing updates..." 
                                                                    : (shipStatus === 'order_placed' || shipStatus === 'pending')
                                                                        ? (selectedOrder.shipments.length > 1 ? "Confirming will accept ALL parts of this order." : "Confirm this order to begin fulfillment.")
                                                                        : (selectedOrder.shipments.length > 1 ? `Ready to ship Shipment ${activeShipmentIdx + 1}?` : "Ready to ship this order?")
                                                        }
                                                    </span>
                                                    {(shipStatus === 'cancelled' || shipStatus === 'refunded') && (selectedOrder.dispute_reason || currentShipment.ship_cancel_reason || currentShipment.items[0]?.status === 'cancelled') && (
                                                        <span className="text-[10px] text-rose-600 font-bold mt-1 bg-rose-50 px-2 py-0.5 rounded-lg w-fit">
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
                                                            {!refundable && !['confirmed', 'shipped', 'delivered', 'released', 'completed'].includes(shipStatus) && (
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
                                                                        updateStatus(orderIdToUpdate, mapped.value);
                                                                    }
                                                                }}
                                                                className={`flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-white text-[10px]  shadow-lg transition-all ${refundable ? 'bg-rose-600 hover:bg-rose-700' : nextStatusMap[shipStatus]?.color} ${refreshing ? 'opacity-50' : 'active:scale-95'}`}
                                                            >
                                                                {refundable ? <ArrowLeft size={12} /> : (!refreshing && nextStatusMap[shipStatus] && React.createElement(nextStatusMap[shipStatus].icon, { size: 12 }))}
                                                                {refreshing ? "Loading..." : (refundable ? "Refund Customer" : nextStatusMap[shipStatus]?.label)}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Desktop Actions */}
                                            {(nextStatusMap[shipStatus] || refundable) && (
                                                <div className="hidden md:flex items-center gap-2">
                                                    {!refundable && !['confirmed', 'shipped', 'delivered', 'released', 'completed'].includes(shipStatus) && (
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
                                                            else updateStatus(orderIdToUpdate, nextStatusMap[shipStatus].value);
                                                        }}
                                                        className={`flex items-center justify-center gap-2 px-8 py-2.5 rounded-lg text-white text-[10px] font-bold shadow-lg transition-all ${refundable ? 'bg-rose-600 hover:bg-rose-700' : nextStatusMap[shipStatus]?.color} ${refreshing ? 'opacity-50' : 'hover:scale-[1.02] active:scale-95'}`}
                                                    >
                                                        {refundable ? <ArrowLeft size={12} /> : (!refreshing && nextStatusMap[shipStatus] && React.createElement(nextStatusMap[shipStatus].icon, { size: 12 }))}
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
                                                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Promise: {ship.shipping_promise || 'Standard'}</p>
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
                                                                                className="text-[10px] font-black text-rose-500 hover:text-rose-600 flex items-center gap-1 transition-colors"
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
                                                                <div>
                                                                    <div className="font-bold text-slate-900 text-sm">{(addr.recipientName && addr.recipientName !== 'null') ? addr.recipientName : selectedOrder.full_name}</div>
                                                                    <div className="text-xs text-slate-500">{(addr.contactNo && addr.contactNo !== 'null') ? addr.contactNo : (selectedOrder.phone !== 'null' ? selectedOrder.phone : '')}</div>
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
                                                                <div>
                                                                    <div className="font-bold text-slate-900 text-sm">{selectedOrder.full_name}</div>
                                                                    <div className="text-xs text-slate-500">{selectedOrder.phone !== 'null' ? selectedOrder.phone : ''}</div>
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
                                                    <p className={`text-[10px] font-bold  tracking-wider mb-0.5 ${idx === tracking.length - 1 ? 'text-rose-600' : 'text-slate-400'}`}>
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
            
        </div>
    );
}
