"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "./authContext";
import { fetchCartApi } from "@/src/lib/api/cartApi";
import { isOffline } from "@/src/lib/api/handler";

interface CartContextType {
    cartCount: number;
    refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
    const auth = useAuth();
    const [cartCount, setCartCount] = useState(0);

    const refreshCart = useCallback(async () => {
        const token = auth?.token || (typeof window !== "undefined" ? localStorage.getItem("token") : null);
        if (!token) { setCartCount(0); return; }
        // Skip fetch when offline — keep existing count
        if (isOffline()) return;
        try {
            const res = await fetchCartApi(token);
            if (res.status === "success" && res.data?.items) {
                const items = res.data.items || [];
                // Deduplicate by cart_id to ensure accurate unique item source
                const uniqueItems = items.filter((item: any, index: number, self: any[]) =>
                    index === self.findIndex((t: any) => t.cart_id === item.cart_id)
                );
                // Calculate total unique items
                setCartCount(uniqueItems.length);
            } else {
                setCartCount(0); // Clear cart if API response is not successful or items are missing
            }
        } catch (e) {
            // Silently ignore offline errors — keep existing cart count
            if (!isOffline()) {
                console.warn("Failed to fetch cart count");
            }
        }
    }, [auth?.token]);

    useEffect(() => {
        refreshCart();
        
        // Local window event listener
        window.addEventListener("cart-updated", refreshCart);

        // BroadcastChannel for cross-tab sync
        const channel = typeof window !== 'undefined' ? new BroadcastChannel('stoqle_cart_sync') : null;
        if (channel) {
            channel.onmessage = (event) => {
                if (event.data === 'update') { // The original logic was to call refreshCart()
                    refreshCart(); // This ensures the cart is re-fetched and counted correctly
                }
            };
        }

        return () => {
            window.removeEventListener("cart-updated", refreshCart);
            if (channel) channel.close();
        };
    }, [refreshCart]);

    return (
        <CartContext.Provider value={{ cartCount, refreshCart }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error("useCart must be used within a CartProvider");
    }
    return context;
}
