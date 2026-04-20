"use client";
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "./authContext";
import { fetchMyWallet } from "@/src/lib/api/walletApi";
import { API_BASE_URL } from "@/src/lib/config";
import { isOffline } from "@/src/lib/api/handler";
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
    isWalletOpen: boolean;
    openWallet: () => void;
    closeWallet: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
    const [wallet, setWallet] = useState<Wallet | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const auth = useAuth() as any;
    const { user, token } = auth;
    const [socket, setSocket] = useState<Socket | null>(null);

    const refreshWallet = useCallback(async () => {
        if (!token || isOffline()) return; // Skip when offline — keep cached wallet
        try {
            setIsLoading(true);
            const res = await fetchMyWallet();
            if (res?.data?.wallet) {
                const w = res.data.wallet;
                setWallet({
                    ...w,
                    available_balance: Number(w.available_balance || 0) || 0,
                    pending_balance: Number(w.pending_balance || 0) || 0
                });
            }
        } catch (err) {
            // Silent when offline — wallet data is preserved
            if (!isOffline()) {
                console.warn("Failed to fetch wallet:", err);
            }
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

        const newSocket = io(API_BASE_URL, {
            query: { userId: String(userId) },
            // Resilient reconnection config
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 30000,
            timeout: 10000,
        });

        newSocket.on("connect", () => {
            setSocket(newSocket);
            // Refresh wallet on reconnect to catch missed updates
            refreshWallet();
        });

        newSocket.on("connect_error", (err) => {
            // Silent when offline — socket.io auto-reconnects
            if (!isOffline()) {
                console.warn("[Wallet Socket] Connect error:", err.message);
            }
        });

        newSocket.on("STOQLE_PAY_RECEIVED", (payload: any) => {
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
                confirmButtonColor: "#f43f5e",
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

    const [isWalletOpen, setIsWalletOpen] = useState(false);
    const openWallet = useCallback(() => setIsWalletOpen(true), []);
    const closeWallet = useCallback(() => setIsWalletOpen(false), []);

    return (
        <WalletContext.Provider value={{ wallet, isLoading, refreshWallet, updateBalance, isWalletOpen, openWallet, closeWallet }}>
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
