"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./authContext";
import { API_BASE_URL } from "@/src/lib/config";
import { isOffline, safeFetch } from "@/src/lib/api/handler";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation";

import { useAudio } from "./audioContext";

type Notification = {
    id: number;
    type: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
};

type NotificationContextType = {
    unreadNotifications: Notification[];
    fetchUnread: () => Promise<void>;
    markAsRead: (id: number) => Promise<void>;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const { user, token } = useAuth();
    const { playSound } = useAudio();
    const [unreadNotifications, setUnreadNotifications] = useState<Notification[]>([]);
    const router = useRouter();

    const fetchUnread = async () => {
        if (!token || isOffline()) return;
        try {
            const data = await safeFetch("/api/notifications/unread", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (data.success) {
                setUnreadNotifications(data.data.notifications || []);
            }
        } catch (err) {
            // Silent — keep existing notifications
        }
    };

    const markAsRead = async (id: number) => {
        if (!token || isOffline()) return;
        try {
            await safeFetch(`/api/notifications/${id}/read`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}` },
            });
            setUnreadNotifications(prev => prev.filter(n => n.id !== id));
        } catch (err) {
            // Silent — will retry on next fetch
        }
    };

    useEffect(() => {
        if (user && token) {
            fetchUnread();

            const userId = user.user_id || user.id;
            if (userId) {
                const socket = io(API_BASE_URL, {
                    query: { userId },
                    // Resilient socket config: auto-reconnect with backoff
                    reconnection: true,
                    reconnectionAttempts: Infinity,
                    reconnectionDelay: 2000,
                    reconnectionDelayMax: 30000,
                    timeout: 10000,
                });

                socket.on("connect", () => {
                    console.log("Socket connected for user", userId);
                    // Refresh notifications on reconnect to catch anything missed
                    fetchUnread();
                });

                socket.on("connect_error", (err) => {
                    // Completely silent when offline — socket.io will auto-reconnect
                    if (!isOffline()) {
                        console.warn("Socket connection error:", err.message);
                    }
                });

                socket.on("new-order", (data: any) => {
                    console.log("Received new-order event:", data);
                    
                    // Play sound for Vendor
                    playSound("order_placed");

                    // Show SweetAlert
                    Swal.fire({
                        title: "<strong>New Order Received</strong>",
                        icon: "success",
                        html:
                            `Order ID: <b>${data.order_id || data.sale_id}</b><br/>` +
                            `Customer: <b>${data.customer_name || 'A customer'}</b>`,
                        showCloseButton: true,
                        focusConfirm: false,
                        confirmButtonText: "View Order",
                        confirmButtonColor: "#f43f5e", // rose-500
                    }).then((result) => {
                        // Mark as read in DB if we have an ID
                        if (data.id) {
                            markAsRead(data.id);
                        }

                        if (result.isConfirmed) {
                            router.push("/profile/business/customer-order");
                        }
                    });

                    // Refresh unread count
                    fetchUnread();
                });

                socket.on("order-status-update", (data: any) => {
                    console.log("Received order-status-update:", data);
                    
                    // Map status to sound
                    const status = data.status?.toLowerCase();
                    if (status === 'confirmed' || status === 'order_confirmed') {
                        playSound("delivery_confirmed");
                    } else if (status === 'out_for_delivery') {
                        playSound("out_for_delivery");
                    } else if (status === 'shipped' || status === 'ready_for_shipping' || status === 'shipping') {
                        playSound("shipping");
                    } else if (status === 'delivered' || status === 'completed') {
                        playSound("delivery_confirmed");
                    } else if (data.type === 'escrow_release' || data.type === 'credited') {
                        playSound("credited");
                    }

                    Swal.fire({
                        title: `<strong>${data.title}</strong>`,
                        icon: (data.status === 'delivered' || data.status === 'cancelled') ? "success" : "info",
                        text: data.message,
                        showCloseButton: true,
                        focusConfirm: false,
                        confirmButtonText: "View My Orders",
                        confirmButtonColor: "#f43f5e",
                    }).then((result) => {
                        if (data.id) {
                            markAsRead(data.id);
                        }
                        if (result.isConfirmed) {
                            router.push("/profile/orders");
                        }
                    });
                    fetchUnread();
                });

                return () => {
                    socket.disconnect();
                };
            }
        }
    }, [user, token, router]);

    return (
        <NotificationContext.Provider value={{ unreadNotifications, fetchUnread, markAsRead }}>
            {children}
            {/* Display stored notifications as popups on login (requirement #6) */}
            <StoredNotificationAlarmer notifications={unreadNotifications} markAsRead={markAsRead} />
        </NotificationContext.Provider>
    );
}

// Internal component to handle displaying stored notifications as popups once
function StoredNotificationAlarmer({ notifications, markAsRead }: { notifications: Notification[], markAsRead: (id: number) => void }) {
    const [displayedIds, setDisplayedIds] = useState<Set<number>>(new Set());
    const router = useRouter();
    const { playSound } = useAudio();

    useEffect(() => {
        if (notifications.length > 0) {
            notifications.forEach(notif => {
                if (!displayedIds.has(notif.id)) {
                    // Map type to sound
                    if (notif.type === 'new_order' || notif.type === 'order_placed') {
                        playSound("order_placed");
                    } else if (notif.type === 'order_confirmed' || notif.type === 'confirmed') {
                        playSound("delivery_confirmed");
                    } else if (notif.type === 'order_shipped' || notif.type === 'shipped' || notif.type === 'ready_for_shipping') {
                        playSound("shipping");
                    } else if (notif.type === 'out_for_delivery') {
                        playSound("out_for_delivery");
                    } else if (notif.type === 'order_delivered' || notif.type === 'delivered' || notif.type === 'escrow_release' || notif.type === 'credited') {
                        if (notif.type === 'escrow_release' || notif.type === 'credited') {
                            playSound("credited");
                        } else {
                            playSound("delivery_confirmed");
                        }
                    }

                    // We only want to show popups for 'new_order' types or all?
                    if (notif.type === 'escrow_release' || notif.type === 'order_confirmed' || notif.type === 'order_delivered' || notif.type === 'order_shipped' || notif.type === 'order_refunded' || notif.type === 'new_order') {
                        const isOrderUpdate = notif.type !== 'escrow_release';
                        Swal.fire({
                            title: `<strong>${notif.title}</strong>`,
                            icon: (notif.type === 'order_delivered' || notif.type === 'escrow_release' || notif.type === 'order_refunded') ? "success" : "info",
                            html: notif.message,
                            showCloseButton: true,
                            focusConfirm: false,
                            confirmButtonText: notif.type === 'new_order' ? "View New Order" : (notif.type === 'order_delivered' ? "Confirmed & Delivered" : (isOrderUpdate ? "View Orders" : "Great!")),
                            confirmButtonColor: "#f43f5e",
                        }).then((result) => {
                            if (result.isConfirmed) {
                                if (notif.type === 'new_order') {
                                    router.push("/profile/business/customer-order");
                                } else if (isOrderUpdate) {
                                    router.push("/profile/orders");
                                }
                            }
                        });
                    } else {
                        Swal.fire({
                            title: notif.title,
                            text: notif.message,
                            icon: "info",
                            toast: true,
                            position: 'top-end',
                            showConfirmButton: false,
                            timer: 5000,
                            timerProgressBar: true,
                        });
                    }
                    setDisplayedIds(prev => new Set(prev).add(notif.id));
                    // Mark as read in DB after showing
                    markAsRead(notif.id);
                }
            });
        }
    }, [notifications, markAsRead, displayedIds, router, playSound]);

    return null;
}

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error("useNotifications must be used within a NotificationProvider");
    }
    return context;
}
