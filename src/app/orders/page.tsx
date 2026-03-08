"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/src/lib/config";
import { useAuth } from "@/src/context/authContext";
import { ChevronLeft, MessageCircle, Package, MapPin, Search, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import Header from "@/src/components/header";

interface Order {
    order_id: number;
    created_at: string;
    status: string;
    quantity: number;
    special_instruction: string | null;
    product_id: number;
    product_name: string;
    unit_price: number;
    business_id: number;
    business_name: string;
    business_logo: string | null;
    product_image: string | null;
    owner_id: number | null;
}

export default function MyOrdersPage() {
    const { user, token } = useAuth();
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const formatUrl = (url: string | null) => {
        if (!url) return "";
        if (url.startsWith("http")) return url;
        return url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
    };

    useEffect(() => {
        if (!token) {
            // Not strictly necessary since we want to show loading or empty state
            return;
        }

        const fetchOrders = async () => {
            try {
                setIsLoading(true);
                const res = await fetch(`${API_BASE_URL}/api/orders/customer`, {
                    headers: {
                        "Authorization": `Bearer ${token}`
                    }
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
                setIsLoading(false);
            }
        };

        fetchOrders();
    }, [token]);

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case "completed": return "bg-green-100 text-green-700";
            case "paid": return "bg-blue-100 text-blue-700";
            case "shipped": return "bg-indigo-100 text-indigo-700";
            case "cancelled": return "bg-red-100 text-red-700";
            default: return "bg-orange-100 text-orange-700"; // pending
        }
    };

    const handleMessageVendor = (order: Order) => {
        if (!order.owner_id) {
            toast.error("Vendor details unavailable");
            return;
        }
        router.push(`/messages?user=${order.owner_id}`);
    };

    if (!user) {
        return (
            <div className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center p-4">
                <div className="w-8 h-8 border-4 border-slate-300 border-t-black rounded-full animate-spin mb-4"></div>
                <p className="text-slate-500 font-medium">Please login to view your orders</p>
                <button onClick={() => router.push("/login")} className="mt-4 px-6 py-2 bg-black text-white rounded-full font-medium">Login</button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F5F5F7]">

            {/* Mobile spacing for header */}
            <div className="h-[60px] md:h-0"></div>

            <main className="max-w-7xl mx-auto p-2 md:p-6 pb-24">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight hidden md:block">My Orders</h1>
                        <p className="text-sm text-slate-500 hidden md:block">Track and manage your recent purchases</p>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="w-8 h-8 border-4 border-slate-300 border-t-black rounded-full animate-spin"></div>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="bg-white rounded-2xl p-10 flex flex-col items-center justify-center text-center shadow-sm border border-slate-100">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                            <Package size={32} className="text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">No orders yet</h3>
                        <p className="text-slate-500 max-w-sm">Looks like you haven't placed any orders. Start exploring products and make your first purchase!</p>
                        <button
                            onClick={() => router.push("/market")}
                            className="mt-6 bg-red-500 text-white font-medium px-6 py-3 rounded-full hover:bg-slate-800"
                        >
                            Start Shopping
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {orders.map((order) => (
                            <div key={order.order_id} className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-5 relative group overflow-hidden">

                                {/* Status Pill overlay - absolute on small screens or normal flow */}
                                <div className="absolute top-4 right-4 md:static md:hidden">
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${getStatusColor(order.status)}`}>
                                        {order.status || 'Pending'}
                                    </span>
                                </div>

                                {/* Thumbnail */}
                                <div className="w-24 h-24 md:w-32 md:h-32 shrink-0 bg-slate-50 rounded-xl overflow-hidden border border-slate-100 self-start md:self-center">
                                    {order.product_image ? (
                                        <img src={formatUrl(order.product_image)} alt={order.product_name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                                            <Package size={30} />
                                        </div>
                                    )}
                                </div>

                                {/* Details */}
                                <div className="flex-1 flex flex-col min-w-0">
                                    <div className="flex justify-between items-start mb-1 pr-6 md:pr-0">
                                        <span className={`hidden md:inline-block text-[10px] font-bold px-2 py-1.5 rounded-full uppercase tracking-wider ${getStatusColor(order.status)} shrink-0 leading-none mb-2`}>
                                            {order.status || 'Pending'}
                                        </span>
                                        <p className="text-xs font-semibold text-slate-400">#{order.order_id}</p>
                                    </div>

                                    <h3 className="text-base md:text-lg font-bold text-slate-900 leading-tight mb-1 truncate">
                                        {order.product_name || "Unknown Product"}
                                    </h3>

                                    <div className="flex items-center gap-2 mb-3 mt-1 cursor-pointer hover:opacity-80 transition" onClick={() => router.push(`/business/${order.business_id}`)}>
                                        {order.business_logo ? (
                                            <img src={formatUrl(order.business_logo)} alt="" className="w-5 h-5 rounded-full bg-slate-100 object-cover" />
                                        ) : (
                                            <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">{order.business_name?.charAt(0) || 'V'}</div>
                                        )}
                                        <p className="text-sm font-medium text-slate-600 truncate">{order.business_name}</p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3 md:gap-6 text-sm text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100 mt-auto">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-slate-400 font-medium">Qty:</span>
                                            <span className="font-bold">{order.quantity}</span>
                                        </div>
                                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-slate-400 font-medium">Total:</span>
                                            <span className="font-bold">₦{(order.unit_price * order.quantity).toLocaleString()}</span>
                                        </div>
                                        {order.special_instruction && (
                                            <>
                                                <span className="w-1 h-1 bg-slate-300 rounded-full hidden md:block"></span>
                                                <p className="text-xs text-slate-500 italic max-w-[200px] truncate hidden md:block">"{order.special_instruction}"</p>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Divider for mobile */}
                                <div className="w-full h-[1px] bg-slate-100 md:hidden mt-1 mb-1"></div>

                                {/* Actions */}
                                <div className="flex md:flex-col gap-2 shrink-0 md:justify-center mt-2 md:mt-0">
                                    <button
                                        onClick={() => router.push(`/order/${order.order_id}`)}
                                        className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 md:py-2 text-sm font-bold bg-white text-slate-800 border border-slate-200 rounded-xl hover:bg-slate-50 transition min-w-[140px]"
                                    >
                                        <MapPin size={16} className="text-slate-400" /> Track Order
                                    </button>
                                    <button
                                        onClick={() => handleMessageVendor(order)}
                                        className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 md:py-2 text-sm font-bold bg-black text-white rounded-xl hover:bg-slate-800 transition min-w-[140px]"
                                    >
                                        <MessageCircle size={16} /> Message Vendor
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
