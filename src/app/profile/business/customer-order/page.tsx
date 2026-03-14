"use client";

import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "@/src/lib/config";
import { useAuth } from "@/src/context/authContext";
import {
    Package,
    ChevronRight,
    MapPin,
    Phone,
    User,
    Truck,
    CheckCircle2,
    Clock,
    Info,
    Calendar,
    MoreVertical,
    XCircle,
    Hash,
    ArrowLeft,
    Search,
    SlidersHorizontal,
    SearchX
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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
}

interface MasterOrder {
    sale_id: number | null;
    payment_ref: string | null;
    full_name: string;
    email: string;
    phone: string;
    delivery_address: string;
    status: string;
    created_at: string;
    customer_profile_pic?: string | null;
    combined_total: number;
    items: OrderItem[];
}

export default function VendorOrdersPage() {
    const { token, user } = useAuth();
    const router = useRouter();
    const [orders, setOrders] = useState<MasterOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<MasterOrder | null>(null);
    const [tracking, setTracking] = useState<OrderTracking[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [statusFilter, setStatusFilter] = useState("all");
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const statuses = ["all", "order_placed", "confirmed", "shipped", "out_for_delivery", "delivered", "cancelled"];

    // Status progression map
    const nextStatusMap: Record<string, { label: string; value: string; color: string; icon: any }> = {
        'order_placed': { label: 'Confirm Order', value: 'confirmed', color: 'bg-emerald-600', icon: CheckCircle2 },
        'confirmed': { label: 'Mark as Shipped', value: 'shipped', color: 'bg-indigo-600', icon: Truck },
        'shipped': { label: 'Out for Delivery', value: 'out_for_delivery', color: 'bg-blue-600', icon: Truck },
        'out_for_delivery': { label: 'Mark as Delivered', value: 'delivered', color: 'bg-rose-600', icon: CheckCircle2 },
    };

    const getStatusDisplay = (status: string) => {
        switch (status?.toLowerCase()) {
            case "order_placed": return { label: "New Order", color: "bg-orange-100 text-orange-700", icon: Clock };
            case "confirmed": return { label: "Confirmed", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 };
            case "shipped": return { label: "Shipped", color: "bg-indigo-100 text-indigo-700", icon: Truck };
            case "out_for_delivery": return { label: "Out for Delivery", color: "bg-blue-100 text-blue-700", icon: Truck };
            case "delivered": return { label: "Delivered", color: "bg-green-400 text-rose-700", icon: CheckCircle2 };
            case "cancelled": return { label: "Cancelled", color: "bg-red-100 text-red-700", icon: XCircle };
            case "refunded": return { label: "Refunded", color: "bg-rose-100 text-rose-700", icon: XCircle };
            default: return { label: status || "Pending", color: "bg-slate-100 text-slate-700", icon: Clock };
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

    const updateStatus = async (orderId: number, status: string) => {
        if (!orderId) return;
        try {
            setRefreshing(true);
            const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}/status`, {
                method: 'PUT',
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

    const fetchTracking = async (orderId: number) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}/tracking`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) setTracking(data.data);
        } catch (e) { }
    }

    const handleSelectOrder = (order: MasterOrder) => {
        setSelectedOrder(order);
        if (order.items.length > 0) {
            fetchTracking(order.items[0].order_id);
        }
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
        const matchesSearch =
            order.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (order.sale_id?.toString() || "").includes(searchQuery) ||
            order.items.some(item => item.product_name.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesStatus = statusFilter === "all" || order.status.toLowerCase() === statusFilter.toLowerCase();

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
            <div className="px-4 py-6 md:px-8 grid grid-cols-1 md:grid-cols-12 gap-6 md:h-full">

                {/* Orders List */}
                <div className={`col-span-1 md:col-span-4 space-y-3 ${selectedOrder ? 'hidden md:block' : 'block'} md:h-full md:overflow-y-auto scrollbar-hide md:pb-24`}>
                    <div className="flex items-center justify-between mb-4 px-1">
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm text-slate-500 font-bold">Orders</h2>
                            <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{filteredOrders.length}</span>
                        </div>

                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setIsSearchOpen(!isSearchOpen)}
                                className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isSearchOpen ? 'bg-rose-500 text-white' : 'hover:bg-slate-200 text-slate-500'}`}
                            >
                                <Search size={16} />
                            </button>
                            <div className="relative">
                                <button
                                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                                    className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${statusFilter !== 'all' ? 'bg-slate-900 text-white' : 'hover:bg-slate-200 text-slate-500'}`}
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
                                                    className={`w-full text-left px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-slate-50 transition-colors ${statusFilter === s ? 'text-rose-500 bg-rose-50/50' : 'text-slate-600'}`}
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
                                    className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
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
                                            <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em]">{groupName}</span>
                                            <div className="h-px bg-rose-100 flex-1" />
                                        </div>
                                        {groupItems.map(order => (
                                            <div
                                                key={order.sale_id || order.payment_ref}
                                                onClick={() => handleSelectOrder(order)}
                                                className={`cursor-pointer transition p-4 rounded-2xl border ${selectedOrder?.sale_id === order.sale_id ? 'bg-white border-rose-500  ring-1 ring-rose-500/10' : 'bg-white border-slate-100 hover:border-slate-300'}`}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${getStatusDisplay(order.status).color}`}>
                                                        {getStatusDisplay(order.status).label}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-bold">#{order.sale_id || 'REF'}</span>
                                                </div>
                                                <h3 className="font-bold text-slate-900 line-clamp-1">{order.full_name}</h3>
                                                <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500 mb-3">
                                                    <Package size={12} />
                                                    <span className="truncate">{order.items.length} item(s)</span>
                                                </div>
                                                <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                                                    <div className="text-xs font-bold text-slate-900">
                                                        ₦{order.combined_total.toLocaleString()}
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
                        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
                            {/* Detail Header */}
                            <div className="p-6 md:p-8 bg-slate-900 text-white">
                                {/* Mobile Back Button */}
                                <div className="flex justify-between">
                                    <button
                                        onClick={() => setSelectedOrder(null)}
                                        className="md:hidden flex items-center bg-red-500 rounded-full p-2 text-slate-200 mb-2 hover:text-white transition"
                                    >
                                        <ArrowLeft size={20} />

                                    </button>
                                    <span className={`text-[10px] font-black px-2 py-2 rounded-full uppercase tracking-widest ${getStatusDisplay(selectedOrder.status).color.replace('bg-', 'bg-opacity-20 text-').replace('text-', 'text-white bg-')}`}>
                                        {getStatusDisplay(selectedOrder.status).label}
                                    </span>
                                </div>

                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            {/* <span className={`text-[10px] lg:hidden font-black px-2 py-1 rounded-full uppercase tracking-widest ${getStatusDisplay(selectedOrder.status).color.replace('bg-', 'bg-opacity-20 text-').replace('text-', 'text-white bg-')}`}>
                                                {getStatusDisplay(selectedOrder.status).label}
                                            </span> */}
                                            <div className="flex items-center gap-1 text-slate-400 text-xs">
                                                <Calendar size={12} />
                                                {new Date(selectedOrder.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                        <h2 className="text-xl md:text-xl sm:text-base font-bold leading-tight">{selectedOrder.full_name}</h2>
                                        <p className="text-slate-400 text-sm mt-1 flex items-center gap-2">
                                            <span>Transaction: <span className="text-white font-mono">#{selectedOrder.sale_id || selectedOrder.payment_ref}</span></span>
                                            <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                                            <span>{selectedOrder.items.length} products</span>
                                        </p>
                                    </div>

                                    <div className="flex flex-col items-end">
                                        <div className="text-xl font-black text-rose-500">₦{selectedOrder.combined_total.toLocaleString()}</div>
                                        <div className="text-slate-400 text-xs tracking-wider">Combined Total</div>
                                    </div>
                                </div>
                            </div>

                            {/* Status Action Bar */}
                            {(nextStatusMap[selectedOrder.status.toLowerCase()] || selectedOrder.status.toLowerCase() === 'refunded' || selectedOrder.status.toLowerCase() === 'cancelled') && (
                                <div
                                    onClick={() => !refreshing && nextStatusMap[selectedOrder.status.toLowerCase()] && updateStatus(selectedOrder.items[0]?.order_id, nextStatusMap[selectedOrder.status.toLowerCase()].value)}
                                    className={`px-4 py-4 ${selectedOrder.status.toLowerCase() === 'refunded' || selectedOrder.status.toLowerCase() === 'cancelled' ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'} border-b flex items-center justify-between transition group ${refreshing ? 'opacity-70 cursor-wait' : (nextStatusMap[selectedOrder.status.toLowerCase()] ? 'cursor-pointer hover:opacity-90' : 'cursor-default')}`}
                                >
                                    <div className="flex items-center gap-2 text-slate-700">
                                        {refreshing ? (
                                            <div className="w-4 h-4 border-2 border-slate-700 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <Info size={16} />
                                        )}
                                        <span className="text-[12px] font-bold">
                                            {selectedOrder.status.toLowerCase() === 'refunded' || selectedOrder.status.toLowerCase() === 'cancelled'
                                                ? "Order Cancelled. Money Refunded to Customer."
                                                : (refreshing ? "Processing update..." : "Ready for next step?")}
                                        </span>
                                    </div>
                                    {nextStatusMap[selectedOrder.status.toLowerCase()] && (
                                        <button
                                            disabled={refreshing}
                                            className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-white font-bold text-sm shadow-lg transition-all ${nextStatusMap[selectedOrder.status.toLowerCase()].color} ${refreshing ? 'opacity-50' : 'active:scale-95'}`}
                                        >
                                            {!refreshing && React.createElement(nextStatusMap[selectedOrder.status.toLowerCase()].icon, { size: 12 })}
                                            {refreshing ? "Loading..." : nextStatusMap[selectedOrder.status.toLowerCase()].label}
                                        </button>
                                    )}
                                </div>
                            )}

                            <div className="p-2 md:p-4 grid md:grid-cols-2 gap-8">
                                {/* Left: Items & Delivery */}
                                <div className="space-y-8">
                                    <section>
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Ordered Items</h4>
                                        <div className="space-y-3">
                                            {selectedOrder.items.map(item => (
                                                <div key={item.order_id} className="flex gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100 group hover:bg-white transition hover:shadow-md">
                                                    <div className="w-16 h-16 bg-slate-200 rounded-xl overflow-hidden flex-shrink-0">
                                                        {item.product_image ? (
                                                            <img src={item.product_image} alt={item.product_name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center"><Package className="text-slate-400" size={20} /></div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h5 className="font-bold text-slate-900 text-sm truncate">{item.product_name}</h5>
                                                        {item.variant_info && (
                                                            <p className="text-[10px] font-bold text-rose-500 uppercase mt-0.5">{item.variant_info}</p>
                                                        )}
                                                        <div className="flex items-center justify-between mt-1">
                                                            <p className="text-xs text-slate-500 font-bold">Qty: {item.quantity}</p>
                                                            <p className="text-xs font-black text-slate-900">₦{item.total_item_price.toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>

                                    <section>
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Customer Delivery</h4>
                                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                            {(() => {
                                                try {
                                                    const addr = JSON.parse(selectedOrder.delivery_address);
                                                    return (
                                                        <>
                                                            <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-200/50">
                                                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-sm font-bold text-slate-900 border overflow-hidden">
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
                                                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-sm font-bold text-slate-900 border overflow-hidden">
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
                                </div>

                                {/* Right: Tracking Timeline */}
                                <div className="bg-slate-50 rounded-3xl p-6 md:p-8 border border-slate-100 h-fit">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
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
                                                    <p className={`text-[10px] font-black uppercase tracking-wider mb-0.5 ${idx === tracking.length - 1 ? 'text-rose-600' : 'text-slate-400'}`}>
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
                                                <p className="text-xs font-bold uppercase tracking-widest">Awaiting Logs</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-[600px] bg-white rounded-3xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-center p-12">
                            <div className="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center mb-6 border border-rose-100">
                                <Package className="text-rose-500 opacity-40" size={40} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 mb-2">Select a transaction</h2>
                            <p className="text-slate-500 max-w-sm text-sm">Pick a grouped order from the left to manage multiple items, see customer info, and track the delivery flow.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
