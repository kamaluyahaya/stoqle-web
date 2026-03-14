"use client";
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "./authContext";
import { fetchMyWallet } from "@/src/lib/api/walletApi";
import { API_BASE_URL } from "@/src/lib/config";
import { toast } from "sonner";
import { io, Socket } from "socket.io-client";
import Swal from "sweetalert2";

interface Wallet {
    wallet_id: number;
    owner_type: string;
    owner_id: number;
    available_balance: number;
    pending_balance: number;
    currency: string;
    has_pin: boolean;
    [key: string]: any;
}

interface WalletContextType {
    wallet: Wallet | null;
    isLoading: boolean;
    refreshWallet: () => Promise<void>;
    updateBalance: (newBalance: number) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
    const [wallet, setWallet] = useState<Wallet | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const auth = useAuth() as any;
    const { user, token } = auth;
    const [socket, setSocket] = useState<Socket | null>(null);

    const refreshWallet = useCallback(async () => {
        if (!token) return;
        try {
            setIsLoading(true);
            const res = await fetchMyWallet();
            if (res?.data?.wallet) {
                setWallet(res.data.wallet);
            }
        } catch (err) {
            console.error("Failed to fetch wallet:", err);
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    const updateBalance = useCallback((newBalance: number) => {
        setWallet(prev => prev ? { ...prev, available_balance: newBalance } : null);
    }, []);

    // Fetch initial wallet on login
    useEffect(() => {
        if (token) {
            refreshWallet();
        } else {
            setWallet(null);
        }
    }, [token, refreshWallet]);

    // Manage Socket Connection
    useEffect(() => {
        if (!token || !user) {
            if (socket) {
                socket.disconnect();
                setSocket(null);
            }
            return;
        }

        const userId = user.user_id || user.id;
        if (!userId) return;

        console.log(`[Connecting Socket] UserID: ${userId}`);
        const newSocket = io(API_BASE_URL, {
            query: { userId: String(userId) }
        });

        newSocket.on("connect", () => {
            console.log("[Socket Connected]");
            setSocket(newSocket);
        });

        newSocket.on("connect_error", (err) => {
            console.error("[Socket Connect Error]", err);
        });

        newSocket.on("STOQLE_PAY_RECEIVED", (payload: any) => {
            console.log("[STOQLE_PAY_RECEIVED Event]", payload);
            const data = payload.data || payload;
            const message = payload.message || `You received ₦${Number(data.amount).toLocaleString()}! 💰`;
            const title = payload.title || "Funds Released! 🔓";

            Swal.fire({
                title: `<strong>${title}</strong>`,
                icon: "success",
                html: `${message}`,
                showCloseButton: true,
                focusConfirm: false,
                confirmButtonText: "Great!",
                confirmButtonColor: "#f43f5e", // rose-500
            });

            if (data.new_balance !== undefined) {
                setWallet(prev => prev ? { ...prev, available_balance: data.new_balance } : null);
            }

            // Always background refresh to be safe
            refreshWallet();
        });

        return () => {
            newSocket.disconnect();
            setSocket(null);
        };
    }, [token, user?.user_id, user?.id, refreshWallet]);

    return (
        <WalletContext.Provider value={{ wallet, isLoading, refreshWallet, updateBalance }}>
            {children}
        </WalletContext.Provider>
    );
}

export function useWallet() {
    const context = useContext(WalletContext);
    if (context === undefined) {
        throw new Error("useWallet must be used within a WalletProvider");
    }
    return context;
}
