"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./authContext";
import { API_BASE_URL } from "@/src/lib/config";
import Swal from "sweetalert2";
import { useRouter } from "next/navigation";

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
    const [unreadNotifications, setUnreadNotifications] = useState<Notification[]>([]);
    const router = useRouter();

    const fetchUnread = async () => {
        if (!token) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/notifications/unread`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success) {
                setUnreadNotifications(data.data.notifications || []);
            }
        } catch (err) {
            console.error("fetchUnread failed", err);
        }
    };

    const markAsRead = async (id: number) => {
        if (!token) return;
        try {
            await fetch(`${API_BASE_URL}/api/notifications/${id}/read`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}` },
            });
            setUnreadNotifications(prev => prev.filter(n => n.id !== id));
        } catch (err) {
            console.error("markAsRead failed", err);
        }
    };

    useEffect(() => {
        if (user && token) {
            fetchUnread();

            const userId = user.user_id || user.id;
            if (userId) {
                const socket = io(API_BASE_URL, { query: { userId } });

                socket.on("connect", () => {
                    console.log("Socket connected for user", userId);
                });

                socket.on("connect_error", (err) => {
                    console.error("Socket connection error:", err.message);
                });

                socket.on("new-order", (data: any) => {
                    console.log("Received new-order event:", data);
                    // Show SweetAlert
                    Swal.fire({
                        title: "<strong>New Order Received</strong>",
                        icon: "success",
                        html:
                            `Order ID: <b>${data.order_id}</b><br/>` +
                            `Customer: <b>${data.customer_name}</b>`,
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
                    Swal.fire({
                        title: `<strong>${data.title}</strong>`,
                        icon: data.status === 'delivered' ? "success" : "info",
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

    useEffect(() => {
        if (notifications.length > 0) {
            notifications.forEach(notif => {
                if (!displayedIds.has(notif.id)) {
                    // We only want to show popups for 'new_order' types or all?
                    // Let's show all stored as alerts as requested
                    if (notif.type === 'escrow_release' || notif.type === 'order_confirmed' || notif.type === 'order_delivered' || notif.type === 'order_shipped') {
                        const isOrderUpdate = notif.type === 'order_confirmed' || notif.type === 'order_delivered' || notif.type === 'order_shipped';
                        Swal.fire({
                            title: `<strong>${notif.title}</strong>`,
                            icon: (notif.type === 'order_delivered' || notif.type === 'escrow_release') ? "success" : "info",
                            html: notif.message,
                            showCloseButton: true,
                            focusConfirm: false,
                            confirmButtonText: notif.type === 'order_delivered' ? "Confirmed & Delivered" : (isOrderUpdate ? "View Orders" : "Great!"),
                            confirmButtonColor: "#f43f5e",
                        }).then((result) => {
                            if (result.isConfirmed && isOrderUpdate) {
                                router.push("/profile/orders");
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
    }, [notifications, markAsRead, displayedIds, router]);

    return null;
}

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error("useNotifications must be used within a NotificationProvider");
    }
    return context;
}
