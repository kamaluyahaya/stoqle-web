"use client";

import {
  ClipboardDocumentListIcon,
  EyeIcon,
  EyeSlashIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  MapPinIcon,
  UserIcon,
  ShoppingBagIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  InformationCircleIcon,
  EnvelopeIcon,
  PhoneIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  ShieldCheckIcon,
  ChatBubbleLeftRightIcon,
  CursorArrowRaysIcon,
  ShareIcon,
  PrinterIcon
} from "@heroicons/react/16/solid";
import React, { useEffect, useRef, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/src/lib/config";
import { fetchMyTransactions, fetchTransactionDetails, sendDeliveryReminder, confirmOrderReceipt, reportOrderProblem } from "@/src/lib/api/walletApi";
import { fetchMyPaymentAccount } from "@/src/lib/api/walletApi";
import { toast } from "sonner";
import WithdrawModal from "./withdrawModal";
import TransferModal from "./transferModal";
import PinSetupModal from "./pinSetupModal";
import PaymentInfoModal from "./policyModal/paymentInfoModal";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/src/context/walletContext";
import { copyToClipboard } from "@/src/lib/utils/utils";

type Role = "user" | "vendor";

type Balances = {
  available: number;
  pending?: number;
  virtualAccount?: string | null;
  currency?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  hintText?: string;
  balances: Balances;
  role?: Role;
  businessId?: number;
  onWithdraw?: (availableAmount: number) => Promise<void> | void;
  onBalanceUpdate?: (newBalance: number) => void;
};

export default function BalanceModal({
  open,
  onClose,
  title = "My Wallet",
  hintText = "View balances",
  balances,
  role = "user",
  businessId,
  onWithdraw,
  onBalanceUpdate
}: Props) {
  const router = useRouter();
  const isCopyingRef = useRef(false);
  const isWithdrawingRef = useRef(false);
  const copiedRef = useRef(false);

  const [showBalance, setShowBalance] = useState(true);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [currentView, setCurrentView] = useState<"overview" | "transactions" | "tx_detail">("overview");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState("All Categories");
  const [filterStatus, setFilterStatus] = useState("All Status");
  const [activeFilterDropdown, setActiveFilterDropdown] = useState<"category" | "status" | null>(null);

  const [selectedTxId, setSelectedTxId] = useState<string | number | null>(null);
  const [txDetails, setTxDetails] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const [txOffset, setTxOffset] = useState(0);
  const [txHasMore, setTxHasMore] = useState(true);
  const [isBatchLoading, setIsBatchLoading] = useState(false);

  // Lightbox State
  const [lightBoxOpen, setLightBoxOpen] = useState(false);
  const [lightBoxIndex, setLightBoxIndex] = useState(0);
  const [lightBoxSlides, setLightBoxSlides] = useState<{ src: string }[]>([]);

  // Modal States
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [shouldReopenWithdraw, setShouldReopenWithdraw] = useState(false);
  const [isPinSetupOpen, setIsPinSetupOpen] = useState(false);
  const [intendedActionAfterPin, setIntendedActionAfterPin] = useState<"withdraw" | "transfer" | null>(null);
  const [isPaymentInfoOpen, setIsPaymentInfoOpen] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<string>("");

  const { wallet, refreshWallet: fetchWallet } = useWallet();

  // Report Modal state (unified with orders page)
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && open) {
      const saved = localStorage.getItem("business_payment_info");
      if (saved) setPaymentInfo(saved);

      // Also fetch from API to ensure we have the latest/correct info
      fetchMyPaymentAccount().then(res => {
        if (res?.data?.account) {
          setPaymentInfo(JSON.stringify(res.data.account));
        }
      }).catch(err => {
        console.error("Failed to sync payment info in BalanceModal:", err);
      });
    }
  }, [open]);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      document.body.style.overscrollBehavior = "none";
      document.documentElement.style.overflow = "hidden";
      document.documentElement.style.overscrollBehavior = "none";
    } else {
      document.body.style.overflow = "";
      document.body.style.overscrollBehavior = "";
      document.documentElement.style.overflow = "";
      document.documentElement.style.overscrollBehavior = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.overscrollBehavior = "";
      document.documentElement.style.overflow = "";
      document.documentElement.style.overscrollBehavior = "";
    };
  }, [open]);

  // Load more on scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (currentView !== "transactions" || !txHasMore || isBatchLoading || txLoading) return;

    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 100) {
      fetchTransactions(true);
    }
  };

  const isSyncing = (() => {
    try {
      if (!paymentInfo) return false;
      const parsed = JSON.parse(paymentInfo);
      return (parsed.account_number || parsed.acct_no || parsed.accountNumber) && !parsed.paystack_recipient_code;
    } catch (e) {
      return false;
    }
  })();

  const fmt = (v: number) => {
    try {
      const currency = balances.currency ?? "₦";
      const isSymbol = currency === "₦" || currency === "$" || currency === "€" || currency === "£";

      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: isSymbol ? "NGN" : currency,
        maximumFractionDigits: 0
      }).format(v).replace("NGN", "₦");
    } catch (e) {
      return `₦${(Number(v) || 0).toLocaleString()}`;
    }
  };

  const parseAddress = (addr: any) => {
    if (!addr) return "No address provided";
    try {
      const p = typeof addr === 'string' ? JSON.parse(addr) : addr;
      if (p && typeof p === 'object') {
        const main = p.address || p.formatted_address || [p.recipientName, p.region].filter(Boolean).join(", ");
        const phone = p.contactNo || p.phone;
        return phone ? `${main} | Tel: ${phone}` : main;
      }
    } catch (e) { }
    return String(addr);
  };

  const fetchTransactions = async (loadMore = false) => {
    if (loadMore && (!txHasMore || isBatchLoading)) return;

    if (!loadMore) {
      setTxLoading(true);
      setTransactions([]);
      setTxOffset(0);
      setTxHasMore(true);
    } else {
      setIsBatchLoading(true);
    }

    try {
      const limit = 10;
      const currentOffset = loadMore ? txOffset : 0;
      const res = await fetchMyTransactions(limit, currentOffset);

      if (res?.data?.transactions) {
        const newTxs = res.data.transactions;
        if (loadMore) {
          setTransactions(prev => [...prev, ...newTxs]);
        } else {
          setTransactions(newTxs);
        }

        setTxOffset(currentOffset + limit);
        if (newTxs.length < limit) {
          setTxHasMore(false);
        }
      }
    } catch (err) {
      console.error("Failed to fetch transactions:", err);
    } finally {
      setTxLoading(false);
      setIsBatchLoading(false);
    }
  };

  const handleTxClick = async (txId: string | number) => {
    setSelectedTxId(txId);
    setTxDetails(null);
    setCurrentView("tx_detail");
    setDetailsLoading(true);
    try {
      const res = await fetchTransactionDetails(txId);
      if (res?.data?.details) {
        setTxDetails(res.data.details);
      }
    } catch (err) {
      console.error("Failed to fetch details:", err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleImagePreview = (items: any[], initialIdx: number) => {
    const slides = items
      .map(item => {
        let snapshot = null;
        try {
          snapshot = typeof item.product_snapshot === 'string'
            ? JSON.parse(item.product_snapshot)
            : item.product_snapshot;
        } catch (e) { }
        return item.product_image || snapshot?.image || null;
      })
      .filter(Boolean)
      .map(url => ({ src: url }));

    if (slides.length > 0) {
      setLightBoxSlides(slides);
      const targetItem = items[initialIdx];
      let snapshot = null;
      try {
        snapshot = typeof targetItem.product_snapshot === 'string'
          ? JSON.parse(targetItem.product_snapshot)
          : targetItem.product_snapshot;
      } catch (e) { }
      const clickedUrl = targetItem.product_image || snapshot?.image;
      const slideIdx = slides.findIndex(s => s.src === clickedUrl);
      setLightBoxIndex(slideIdx >= 0 ? slideIdx : 0);
      setLightBoxOpen(true);
    }
  };

  const handleShareReceipt = async () => {
    if (!txDetails || typeof window === "undefined") return;

    let targetUserId = null;
    let receiptContent = "";

    const dateStr = new Date(txDetails.created_at).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    if (txDetails.transaction_type === 'transfer' && txDetails.peer_info) {
      targetUserId = txDetails.peer_info.peer_user_id;
      receiptContent = `📄 *WALLET RECEIPT*\n\nRef: ${txDetails.reference || txDetails.transaction_id}\nType: Transfer\nAmount: ${fmt(Math.abs(txDetails.amount))}\nDate: ${dateStr}\nStatus: ${txDetails.status}\n\nShared via Stoqle Wallet`;
    } else if (txDetails.order_items?.[0]) {
      const item = txDetails.order_items[0];
      const stoqleOrderId = item.stoqle_order_id;
      const displayId = stoqleOrderId ? `ORD-${stoqleOrderId}` : (txDetails.reference || txDetails.transaction_id);
      targetUserId = role === 'vendor' ? item.customer_user_id : item.vendor_user_id;
      const products = txDetails.order_items.map((it: any) => `• ${it.product_name} (x${it.quantity})`).join('\n');
      receiptContent = `📄 *PAYMENT RECEIPT*\n\nOrder ID: #${displayId}\nTotal Paid: ${fmt(Math.abs(txDetails.amount))}\nDate: ${dateStr}\n\nItems:\n${products}\n\nShared via Stoqle Wallet`;
    }

    if (!targetUserId) {
      // If no target user in txDetails, maybe try to sharing externally
      handleExternalShare();
      return;
    }

    setSendingReminder(true);
    const token = localStorage.getItem("token");
    const headers = {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    };

    try {
      let convId = null;
      const tryEndpoints = [
        { url: `${API_BASE_URL}/api/chat/create`, body: { other_user_id: targetUserId } },
        { url: `${API_BASE_URL}/api/conversations/init`, body: { user_id: targetUserId } },
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
        } catch (err) { }
      }

      if (convId) {
        // Send the PDF Receipt via Backend
        const shareResp = await fetch(`${API_BASE_URL}/api/wallet/share-receipt`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            transaction_id: txDetails.transaction_id,
            chat_room_id: convId
          })
        });

        if (shareResp.ok) {
          onClose();
          router.push(`/messages?room=${convId}`);
          toast.success("PDF Receipt shared to party");
        } else {
          toast.error("Failed to generate PDF receipt");
        }
      } else {
        onClose();
        router.push(`/messages?user=${targetUserId}`);
      }
    } catch (err) {
      console.error("Share receipt err:", err);
      toast.error("Error sharing receipt");
    } finally {
      setSendingReminder(false);
    }
  };

  const handleExternalShare = () => {
    const stoqleOrderId = txDetails.order_items?.[0]?.stoqle_order_id;
    const displayId = stoqleOrderId ? `ORD-${stoqleOrderId}` : (txDetails.reference || txDetails.transaction_id);
    const text = `Stoqle Receipt: ${txDetails.transaction_type} of ${fmt(Math.abs(txDetails.amount))} on ${new Date(txDetails.created_at).toLocaleDateString()}. Ref: #${displayId}`;

    if (navigator.share) {
      navigator.share({
        title: 'Stoqle Transaction Receipt',
        text: text,
        url: window.location.href
      }).catch(() => { });
    } else {
      window.print();
    }
  };

  const handleMessageCustomer = async () => {
    if (!txDetails || !txDetails.order_items?.[0] || typeof window === "undefined") return;

    const customerId = txDetails.order_items[0].customer_user_id;
    if (!customerId) {
      toast.error("Customer contact ID not found");
      return;
    }

    setSendingReminder(true);
    const token = localStorage.getItem("token");
    const headers = {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    };

    try {
      let convId = null;
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
        } catch (err) { }
      }

      if (convId) {
        onClose();
        router.push(`/messages?room=${convId}`);
      } else {
        onClose();
        router.push(`/messages?user=${customerId}`);
      }
    } catch (err) {
      console.error("Message init err:", err);
      onClose();
      router.push(`/messages?user=${customerId}`);
    } finally {
      setSendingReminder(false);
    }
  };

  const handleDraftEmail = () => {
    const item = txDetails.order_items[0];
    const email = item.customer_email || item.email;
    const stoqleOrderId = item.stoqle_order_id;
    const displayId = stoqleOrderId ? `${stoqleOrderId}` : (txDetails.reference || txDetails.transaction_id);
    const subject = encodeURIComponent(`Regarding your Order #${displayId} on Stoqle`);
    const body = encodeURIComponent(`Hello ${item.full_name},\n\nI am contacting you regarding the problem report for your order...`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  const handleSendReminder = async () => {
    if (!selectedTxId) return;
    setSendingReminder(true);
    try {
      await sendDeliveryReminder(selectedTxId);
      toast.success("Reminder email sent to the customer!");
    } catch (err: any) {
      toast.error(err?.body?.message || "Failed to send reminder");
    } finally {
      setSendingReminder(false);
    }
  };

  const handleConfirmReceipt = async () => {
    if (!txDetails?.escrow_id) return;
    setProcessingAction(true);
    try {
      await confirmOrderReceipt(txDetails.escrow_id);
      toast.success("Delivery confirmed! Funds released.");
      handleTxClick(selectedTxId!); // refresh
    } catch (err: any) {
      toast.error(err?.body?.message || "Failed to confirm delivery");
    } finally {
      setProcessingAction(false);
    }
  };

  const handleReportProblem = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!txDetails?.escrow_id) {
      toast.error("This transaction does not have a linked escrow record for reporting.");
      return;
    }
    setReportReason("");
    setIsReportOpen(true);
  };

  const submitReport = async () => {
    if (!txDetails?.escrow_id || !reportReason.trim()) {
      if (!reportReason.trim()) toast.error("Please provide a reason for the report.");
      return;
    }

    setProcessingAction(true);
    try {
      await reportOrderProblem(txDetails.escrow_id, reportReason);
      toast.success("Problem reported. Support team will investigate.");
      setIsReportOpen(false);
      handleTxClick(selectedTxId!); // refresh
    } catch (err: any) {
      toast.error(err?.body?.message || "Failed to report problem");
    } finally {
      setProcessingAction(false);
    }
  };

  useEffect(() => {
    if (open && currentView === "transactions" && transactions.length === 0) {
      fetchTransactions();
    }
  }, [open, currentView]);


  useEffect(() => {
    if (!open) {
      setCurrentView("overview");
      setTxDetails(null);
      setSelectedTxId(null);
    }
  }, [open]);

  async function handleCopyVA() {
    if (!balances.virtualAccount) return;
    try {
      isCopyingRef.current = true;
      await copyToClipboard(balances.virtualAccount);
      copiedRef.current = true;
    } catch (e) {
      // ignore
    } finally {
      isCopyingRef.current = false;
    }
  }

  async function handleWithdraw() {
    if (!onWithdraw) return;
    if (balances.available <= 0) return;

    if (!wallet?.has_pin) {
      setIsPinSetupOpen(true);
      return;
    }

    try {
      isWithdrawingRef.current = true;
      await onWithdraw(balances.available);
      onClose();
    } catch (e) {
      // handle error
    } finally {
      isWithdrawingRef.current = false;
    }
  }

  const handleActionWithPinCheck = (action: "withdraw" | "transfer") => {
    if (!wallet?.has_pin) {
      setIntendedActionAfterPin(action);
      setIsPinSetupOpen(true);
      return;
    }

    if (action === "withdraw") {
      if (isSyncing) {
        toast.error("Your bank details are still under review. Please wait a few minutes.");
        return;
      }
      setIsWithdrawOpen(true);
    } else if (action === "transfer") {
      setIsTransferOpen(true);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'released':
      case 'delivered':
      case 'completed':
      case 'confirmed':
      case 'success':
        return 'bg-emerald-100 text-emerald-700';
      case 'shipped':
      case 'out_for_delivery':
      case 'pending':
      case 'processing':
        return 'bg-amber-100 text-amber-700';
      case 'held':
      case 'disputed':
        return 'bg-rose-100 text-rose-700 font-bold underline';
      case 'cancelled':
      case 'failed':
      case 'rejected':
      case 'refunded':
        return 'bg-rose-100 text-rose-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <div key="balance-modal-overlay" className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={onClose}
            />

            {/* Sheet */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={`relative w-full sm:w-[500px] ${currentView === 'tx_detail' ? 'h-[80vh] sm:h-auto sm:max-h-[85vh]' : 'max-h-[90vh] sm:max-h-[85vh]'} bg-white rounded-t-[0.5rem] sm:rounded-[0.5rem] overflow-hidden flex flex-col transition-all duration-300`}
            >
              {/* Header */}
              <div className="px-6 py-5 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="w-10">
                    {currentView !== "overview" && (
                      <button
                        onClick={() => setCurrentView(currentView === "tx_detail" ? "transactions" : "overview")}
                        className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        <ChevronLeftIcon className="w-6 h-6" />
                      </button>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {currentView === "overview" ? title : currentView === "transactions" ? "History" : "Details"}
                  </h2>
                  <button
                    onClick={onClose}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M6 6L18 18M6 18L18 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Scrollable Content */}
              <div
                onScroll={handleScroll}
                className={`flex-1 overflow-y-auto px-6 py-6 pb-12 text-slate-900 ${activeFilterDropdown ? 'overflow-hidden' : ''}`}
              >
                {currentView === "overview" ? (
                  <div className="space-y-6">
                    {/* Primary Balance Card */}
                    <div className="bg-rose-500 rounded-[0.5rem] p-7 text-white  shadow-rose-100 relative overflow-hidden">
                      <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full pointer-events-none" />

                      <div className="relative z-10 flex justify-between items-start">
                        <div>
                          <p className="text-white/70 text-sm font-medium">Available Balance</p>
                          <div className="mt-1 flex items-center gap-3">
                            <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">
                              {showBalance ? fmt(balances.available) : "••••••"}
                            </h3>
                            <button
                              onClick={() => setShowBalance(!showBalance)}
                              className="p-1.5 rounded-full hover:bg-white/10 transition"
                            >
                              {showBalance ? <EyeIcon className="w-5 h-5" /> : <EyeSlashIcon className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={() => setCurrentView("transactions")}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-all text-white/90 hover:text-white active:scale-95"
                        >
                          <span className="text-[10px] font-bold tracking-wider">Transaction</span>
                          <ClockIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="mt-4 flex gap-3">
                        {role === "vendor" ? (
                          <>
                            <button
                              onClick={() => handleActionWithPinCheck("withdraw")}
                              className="flex-1 h-8 rounded-full bg-white text-rose-500  text-xs shadow-sm active:scale-95 transition"
                            >
                              Request Payout
                            </button>
                            <button
                              onClick={() => handleActionWithPinCheck("transfer")}
                              className="flex-1 h-8 rounded-full bg-rose-600 text-white border border-slate-200 text-xs shadow-lg active:scale-95 transition"
                            >
                              Transfer
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleActionWithPinCheck("transfer")}
                              className="flex-1 h-8 rounded-full bg-white text-rose-500 text-xs shadow-sm active:scale-95 transition"
                            >
                              Transfer
                            </button>
                            <button
                              onClick={() => handleActionWithPinCheck("withdraw")}
                              className="flex-1 h-8 rounded-full text-white border border-slate-200 text-xs shadow-lg active:scale-95 transition"
                            >
                              Withdraw
                            </button>
                          </>
                        )}
                      </div>

                      {isSyncing && (
                        <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3">
                          <XCircleIcon className="w-4 h-4 text-amber-500 mt-0.5" />
                          <div className="space-y-0.5">
                            <p className="text-[10px] font-black text-amber-900 leading-tight ">Payout Settings Under Review</p>
                            <p className="text-[10px] text-amber-700/80 leading-tight">Your bank details are being verified by Paystack. Payouts will be enabled automatically within 15 minutes.</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Pending Balance Row */}
                    <div className="bg-slate-50 rounded-[0.5rem] p-5 border border-slate-100 flex justify-between items-center group cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold  tracking-wider">Pending Balance</p>
                        <p className="mt-1 text-xl font-bold text-slate-800">{fmt(balances.pending ?? 0)}</p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                        <ClockIcon className="w-5 h-5 text-amber-500" />
                      </div>
                    </div>

                    {/* Virtual Account Section */}
                    <div className="bg-white rounded-[0.5rem] p-6 border border-slate-100">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-[0.5rem] bg-rose-50 flex items-center justify-center">
                          <svg className="w-5 h-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">Virtual Bank Account</h4>
                          <p className="text-[10px] text-slate-400 font-medium  tracking-tight">Personal Top-up Account</p>
                        </div>
                      </div>

                      <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-500 font-bold">Bank Number</span>
                          <span className="font-bold text-slate-900">6173321783</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-500 font-bold">Bank Name</span>
                          <span className="font-bold text-slate-900">Palmpay</span>
                        </div>
                      </div>

                      <button
                        onClick={handleCopyVA}
                        className="mt-4 w-full h-11 rounded-full bg-slate-900 text-white text-xs  tracking-widest active:scale-[0.98] transition shadow-lg shadow-slate-200"
                      >
                        Copy Account Number
                      </button>
                    </div>
                  </div>
                ) : currentView === "transactions" ? (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-300 relative">
                    {/* Modern Selection Triggers */}
                    <div className="sticky -top-6 bg-white pb-6 z-20 space-y-3 mb-2 border-b border-slate-50">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">Category</label>
                          <button
                            onClick={() => setActiveFilterDropdown("category")}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs text-slate-900 flex justify-between items-center transition-all active:scale-[0.98]"
                          >
                            <span className="truncate">{filterCategory}</span>
                            <ChevronRightIcon className="w-4 h-4 rotate-90 text-slate-400" />
                          </button>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 tracking-widest pl-1">Status</label>
                          <button
                            onClick={() => setActiveFilterDropdown("status")}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-900 flex justify-between items-center transition-all active:scale-[0.98]"
                          >
                            <span className="truncate">{filterStatus}</span>
                            <ChevronRightIcon className="w-4 h-4 rotate-90 text-slate-400" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Minimal Inline Filter Overlay */}
                    {activeFilterDropdown && (
                      <div className="absolute top-[80px] inset-x-0 bottom-0 z-50 bg-white/95 backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="p-4 border-b border-slate-50 flex items-center justify-between sticky top-0 bg-white">
                          <h4 className="text-[10px] font-black text-slate-400 tracking-[0.2em]">
                            Select {activeFilterDropdown === "category" ? "Category" : "Status"}
                          </h4>
                          <button
                            onClick={() => setActiveFilterDropdown(null)}
                            className="text-[10px] font-black text-rose-500 underline tracking-widest"
                          >
                            Cancel
                          </button>
                        </div>
                        <div className="p-4 flex flex-wrap content-start gap-1.5 overflow-y-auto max-h-full pb-32">
                          {(activeFilterDropdown === "category"
                            ? ["All Categories", "Withdraw", "Transfer From", "Transfer To", "Escrow"]
                            : ["All Status", "Successful", "Pending", "Failed", "To be paid", "Reversed"]
                          ).map((opt) => (
                            <button
                              key={opt}
                              onClick={() => {
                                if (activeFilterDropdown === "category") setFilterCategory(opt);
                                else setFilterStatus(opt);
                                setActiveFilterDropdown(null);
                              }}
                              className={`px-3 py-2 rounded-xl border transition-all active:scale-[0.96] ${(activeFilterDropdown === "category" ? filterCategory : filterStatus) === opt
                                ? "bg-rose-500 border-rose-500 text-white shadow-md shadow-rose-100"
                                : "bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100"
                                }`}
                            >
                              <span className="text-[10px] font-black tracking-tight">
                                {opt}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {txLoading ? (
                      <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-12 h-12 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
                        <p className="mt-4 text-xs font-bold text-slate-400 tracking-widest">Loading Records...</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(() => {
                          const filteredTransactions = transactions.filter((tx: any) => {
                            if (filterCategory !== "All Categories") {
                              const type = tx.transaction_type;
                              const amount = Number(tx.amount);
                              if (filterCategory === "Withdraw" && type !== "withdrawal") return false;
                              if (filterCategory === "Transfer From" && !(type === "transfer" && amount > 0)) return false;
                              if (filterCategory === "Transfer To" && !(type === "transfer" && amount < 0)) return false;
                              if (filterCategory === "Escrow" && !["escrow_hold", "escrow_release"].includes(type)) return false;
                            }
                            if (filterStatus !== "All Status") {
                              const s = tx.status?.toLowerCase();
                              if (filterStatus === "Successful" && !["completed", "confirmed", "delivered"].includes(s)) return false;
                              if (filterStatus === "Pending" && !["pending", "processing"].includes(s)) return false;
                              if (filterStatus === "Failed" && !["failed", "rejected"].includes(s)) return false;
                              if (filterStatus === "To be paid" && s !== "held") return false;
                              if (filterStatus === "Reversed" && !["reversed", "refunded"].includes(s)) return false;
                            }
                            return true;
                          });

                          if (filteredTransactions.length === 0) {
                            return (
                              <div className="text-center py-20 bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
                                <p className="text-xs font-black text-slate-400 tracking-widest">No matching records found</p>
                                <button
                                  onClick={() => { setFilterCategory("All Categories"); setFilterStatus("All Status"); }}
                                  className="mt-4 text-[10px] font-black text-rose-500 underline"
                                >
                                  Reset Filters
                                </button>
                              </div>
                            );
                          }

                          return filteredTransactions.map((tx: any) => (
                            <button
                              key={tx.transaction_id}
                              onClick={() => handleTxClick(tx.transaction_id)}
                              className="w-full text-left p-2 lg:p-4 rounded-[0.5rem] bg-white border border-slate-100 hover:bg-slate-50 active:bg-slate-100 transition-all flex flex-col gap-3 group"
                            >
                              <div className="flex items-center gap-4 w-full">
                                <div className={`w-8 lg:w-11 h-8 lg:h-11  rounded-[0.5rem] flex items-center justify-center flex-shrink-0 ${tx.status === 'failed' || tx.status === 'rejected'
                                  ? 'bg-rose-50 text-rose-500'
                                  : tx.status === 'pending' || tx.status === 'processing'
                                    ? 'bg-amber-50 text-amber-500'
                                    : Number(tx.amount) > 0
                                      ? 'bg-emerald-50 text-emerald-500'
                                      : 'bg-slate-50 text-slate-500'
                                  }`}>
                                  {tx.transaction_type === 'escrow_hold' || tx.transaction_type === 'escrow_release' ? (
                                    <ShieldCheckIcon className="lg:w-6 w-4 lg:h-6 h-4" />
                                  ) : Number(tx.amount) > 0 ? (
                                    <ArrowDownIcon className="lg:w-6 w-4 lg:h-6 h-4" />
                                  ) : (
                                    <ArrowUpIcon className="lg:w-6 w-4 lg:h-6 h-4" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-start gap-2">
                                    <p className="text-[10px] md:text-[11px] lg:text-[12px] font-bold text-slate-900 leading-snug">
                                      {tx.stoqle_order_id
                                        ? `Order #${tx.stoqle_order_id}${tx.transaction_type.includes('release') ? ' (Released)' : tx.transaction_type.includes('hold') ? ' (Hold)' : tx.transaction_type.includes('refund') ? ' (Refunded)' : ''}`
                                        : (tx.description || tx.transaction_type.replace(/_/g, ' '))}
                                    </p>
                                  </div>
                                  <div className="mt-1">
                                    <span className="text-[10px] text-slate-400 ">
                                      {(() => {
                                        const d = new Date(tx.created_at);
                                        const day = d.getDate();
                                        const suffix = (day % 10 === 1 && day !== 11) ? 'st' : (day % 10 === 2 && day !== 12) ? 'nd' : (day % 10 === 3 && day !== 13) ? 'rd' : 'th';
                                        const month = d.toLocaleDateString(undefined, { month: 'short' });
                                        const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                                        return `${month} ${day}${suffix}, ${time.toLowerCase()}`;
                                      })()}
                                    </span>
                                  </div>
                                </div>

                                <div className="text-right">
                                  <p className={`text-[10px] lg:text-sm font-black whitespace-nowrap ${tx.status === 'failed' || tx.status === 'rejected'
                                    ? 'text-rose-600'
                                    : tx.status === 'pending' || tx.status === 'processing'
                                      ? 'text-amber-500'
                                      : Number(tx.amount) > 0
                                        ? 'text-emerald-600'
                                        : 'text-slate-900'
                                    }`}>
                                    {Number(tx.amount) < 0 ? '-' : '+'}{fmt(Math.abs(tx.amount))}
                                  </p>
                                  <span className={`text-[8px] px-1.5 py-0.5 rounded-md ${getStatusColor(tx.escrow_status || tx.status)} inline-block mt-0.5`}>
                                    {tx.escrow_status
                                      ? tx.escrow_status === 'held' || tx.escrow_status === 'disputed'
                                        ? 'Escrow: Funds Held'
                                        : tx.escrow_status === 'pending'
                                          ? 'Escrow: Awaiting Release'
                                          : `Escrow: ${tx.escrow_status}`
                                      : tx.status}
                                  </span>
                                </div>
                                <ChevronRightIcon className="w-5 h-5 text-slate-300 group-hover:text-slate-400" />
                              </div>
                            </button>
                          ));
                        })()}

                        {txHasMore && transactions.length > 0 && (
                          <div className="py-8 flex justify-center">
                            {isBatchLoading ? (
                              <div className="flex items-center gap-3">
                                <div className="w-5 h-5 border-2 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
                                <span className="text-[10px] font-black text-slate-400 tracking-widest ">LOADING MORE...</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => fetchTransactions(true)}
                                className="text-[10px] font-black text-slate-300 hover:text-slate-500 tracking-widest transition-colors "
                              >
                                Scroll to see more
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                    {detailsLoading ? (
                      <div className="animate-pulse space-y-8">
                        {/* Summary Shimmer */}
                        <div className="flex flex-col items-center space-y-4">
                          <div className="w-16 h-16 bg-slate-100 rounded-[1.5rem]" />
                          <div className="h-8 w-32 bg-slate-100 rounded-lg" />
                          <div className="h-4 w-48 bg-slate-100 rounded-md" />
                        </div>

                        {/* Action Buttons Shimmer */}
                        <div className="grid grid-cols-2 gap-4 pt-6">
                          <div className="h-12 bg-slate-50 rounded-2xl" />
                          <div className="h-12 bg-slate-50 rounded-2xl" />
                        </div>

                        {/* Content Shimmer */}
                        <div className="space-y-4">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex justify-between items-center">
                              <div className="h-3 w-24 bg-slate-50 rounded" />
                              <div className="h-3 w-40 bg-slate-100 rounded" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : !txDetails ? (
                      <div className="text-center py-10 text-slate-500">Failed to load details.</div>
                    ) : (
                      <>
                        {/* Summary Header */}
                        <div className="text-center pb-6 border-b border-slate-50">
                          <div className={`mx-auto w-16 h-16 rounded-3xl flex items-center justify-center mb-4 ${txDetails.status === 'failed' || txDetails.status === 'rejected'
                            ? 'bg-rose-50 text-rose-500'
                            : txDetails.status === 'pending' || txDetails.status === 'processing'
                              ? 'bg-amber-50 text-amber-500'
                              : Number(txDetails.amount) > 0
                                ? 'bg-emerald-50 text-emerald-500'
                                : 'bg-slate-50 text-slate-500'
                            }`}>
                            {txDetails.transaction_type === 'escrow_hold' || txDetails.transaction_type === 'escrow_release' ? (
                              <ShieldCheckIcon className="w-8 h-8" />
                            ) : Number(txDetails.amount) > 0 ? (
                              <ArrowDownIcon className="w-8 h-8" />
                            ) : (
                              <ArrowUpIcon className="w-8 h-8" />
                            )}
                          </div>
                          <h3 className="text-2xl font-black text-slate-900">
                            {Number(txDetails.amount) < 0 ? '-' : '+'}{fmt(Math.abs(txDetails.amount))}
                          </h3>
                          <p className="text-sm font-bold text-slate-500 mt-1 capitalize">
                            {txDetails.description || txDetails.transaction_type.replace(/_/g, ' ')}
                          </p>
                          <div className={`mt-3 inline-block px-3 py-1 rounded-full text-[10px] font-black tracking-widest ${getStatusColor(txDetails.escrow_status || txDetails.status)}`}>
                            {txDetails.escrow_status
                              ? txDetails.escrow_status === 'held' || txDetails.escrow_status === 'disputed'
                                ? 'Escrow: Funds Held'
                                : txDetails.escrow_status === 'pending'
                                  ? 'Escrow: Awaiting Release'
                                  : `Escrow: ${txDetails.escrow_status}`
                              : txDetails.status}
                          </div>
                        </div>

                        {/* ESCROW ACTIONS */}
                        {txDetails.status !== 'released' && txDetails.status !== 'refunded' && txDetails.transaction_type === 'escrow_hold' && (
                          <div className="space-y-3">
                            {/* VENDOR VIEW: Reminder & Dispute Handling */}
                            {role === 'vendor' && (txDetails.order_items?.[0]?.status === 'delivered' || txDetails.escrow_status === 'held' || txDetails.escrow_status === 'disputed') && (
                              <div className={`${txDetails.escrow_status === 'held' || txDetails.escrow_status === 'disputed' ? 'bg-rose-50 border-rose-200 animate-pulse' : 'bg-amber-50 border-amber-200'} border-2 rounded-[0.5rem] p-6 space-y-4 shadow-lg shadow-black/5`}>
                                <div className="flex gap-4">
                                  <div className={`w-12 h-12 rounded-[0.5rem] flex items-center justify-center shrink-0 ${txDetails.escrow_status === 'held' || txDetails.escrow_status === 'disputed' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                                    {txDetails.escrow_status === 'held' || txDetails.escrow_status === 'disputed' ? <XCircleIcon className="w-7 h-7" /> : <InformationCircleIcon className="w-7 h-7" />}
                                  </div>
                                  <div className="space-y-1">
                                    <h4 className={`text-sm   tracking-tighter ${txDetails.escrow_status === 'held' || txDetails.escrow_status === 'disputed' ? 'text-rose-700' : 'text-amber-700'}`}>
                                      {txDetails.escrow_status === 'held' || txDetails.escrow_status === 'disputed' ? 'Raise Dispute Open - Reviewing' : 'Waiting for Confirmation'}
                                    </h4>
                                    <p className="text-[11px] text-slate-600 font-bold leading-relaxed">
                                      {txDetails.escrow_status === 'held' || txDetails.escrow_status === 'disputed'
                                        ? `Attention: The customer has raised a dispute. Funds are currently locked. Please contact the customer below to iron out the issue.`
                                        : `Item marked as Delivered. Waiting for ${txDetails.order_items[0].full_name} to confirm receipt so funds can be released to your available balance.`}
                                    </p>
                                  </div>
                                </div>

                                {/* Problem Report Details */}
                                {txDetails.order_items[0]?.dispute_reason && (
                                  <div className="bg-white border border-rose-100 rounded-xl p-3 space-y-2">
                                    <p className="text-[9px] font-black text-rose-500  tracking-widest">Customer Reported Issue:</p>
                                    <p className="text-xs font-bold text-slate-800 italic bg-rose-50/50 p-2 rounded-lg border border-rose-50">
                                      "{txDetails.order_items[0].dispute_reason}"
                                    </p>
                                  </div>
                                )}

                                <div className="flex gap-3">
                                  <button
                                    onClick={handleDraftEmail}
                                    className="flex-1 flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 py-3 rounded-2xl text-[11px] font-black hover:bg-slate-50 transition shadow-sm active:scale-95"
                                  >
                                    <EnvelopeIcon className="w-4 h-4 text-rose-500" />
                                    Draft Email
                                  </button>
                                  <button
                                    onClick={handleMessageCustomer}
                                    disabled={sendingReminder}
                                    className="flex-1 flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-2xl text-[11px] font-black hover:bg-slate-800 transition disabled:opacity-50 shadow-lg shadow-slate-900/10 active:scale-95"
                                  >
                                    {sendingReminder ? (
                                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                      <ChatBubbleLeftRightIcon className="w-4 h-4" />
                                    )}
                                    Direct Message
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* CUSTOMER VIEW: Confirm or Dispute */}
                            {role === 'user' && txDetails.order_items?.[0]?.status === 'delivered' && !txDetails.order_items?.[0]?.customer_confirmed && (
                              <div className="bg-slate-900 rounded-2xl p-5 space-y-4 shadow-xl shadow-slate-200">
                                <div className="space-y-1">
                                  <h4 className="text-sm font-black text-white">Action Required</h4>
                                  <p className="text-[10px] text-slate-400 font-medium">Please confirm you've received your order or report any issues if you haven't.</p>
                                </div>

                                {txDetails.order_items[0].dispute_status === 'open' ? (
                                  <div className="bg-rose-500/20 border border-rose-500/30 rounded-xl p-3 flex items-center gap-3">
                                    <XCircleIcon className="w-5 h-5 text-rose-500" />
                                    <p className="text-[10px] font-bold text-rose-200  tracking-widest">Dispute Open - Payment Held</p>
                                  </div>
                                ) : (
                                  <div className="flex gap-3">
                                    <button
                                      onClick={handleConfirmReceipt}
                                      disabled={processingAction}
                                      className="flex-2 bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-xs font-black shadow-lg shadow-emerald-500/20 active:scale-95 transition flex items-center justify-center gap-2"
                                    >
                                      <CheckCircleIcon className="w-4 h-4" />
                                      Confirm Delivery
                                    </button>
                                    <button
                                      onClick={handleReportProblem}
                                      disabled={processingAction}
                                      className="flex-1 bg-white/10 text-white border border-white/10 px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-white/20 active:scale-95 transition"
                                    >
                                      Report Problem
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Product Items Involved */}
                        {txDetails.order_items && txDetails.order_items.length > 0 && (
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 text-xs  text-slate-400">
                              <span>Involved Items</span>
                            </div>

                            <div className="space-y-3">
                              {txDetails.order_items.map((item: any, idx: number) => {
                                let snapshot = null;
                                try {
                                  snapshot = typeof item.product_snapshot === 'string'
                                    ? JSON.parse(item.product_snapshot)
                                    : item.product_snapshot;
                                } catch (e) { }

                                return (
                                  <div key={idx} className="bg-white border border-slate-100 rounded-[0.5rem] p-4 flex gap-4 items-center">
                                    <div
                                      onClick={() => handleImagePreview(txDetails.order_items, idx)}
                                      className="w-16 h-16 rounded-[0.5rem] bg-slate-50 overflow-hidden flex-shrink-0 border border-slate-100 cursor-zoom-in"
                                    >
                                      {item.product_image ? (
                                        <img src={item.product_image} alt={item.product_name} className="w-full h-full object-cover" />
                                      ) : snapshot?.image ? (
                                        <img src={snapshot.image} alt={item.product_name} className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                                          <ShoppingBagIcon className="w-8 h-8" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-black text-slate-800 truncate">{item.product_name || snapshot?.name}</p>
                                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                                        <p className="text-[10px] font-bold text-slate-400 tracking-tighter">Qty: {item.quantity}</p>
                                        <p className="text-[10px] font-bold text-slate-400 tracking-tighter">Price: {fmt(item.unit_price)}</p>
                                      </div>
                                      {item.business_name && (
                                        <div className="flex items-center gap-1.5 mt-2">
                                          <div className="w-4 h-4 rounded-[0.5rem] bg-slate-100 overflow-hidden border border-slate-200">
                                            {item.business_logo && <img src={item.business_logo} className="w-full h-full object-cover" />}
                                          </div>
                                          <p className="text-[9px] text-slate-500 ">{item.business_name}</p>
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <span className={`text-[8px] font-black tracking-widest px-2 py-0.5 rounded-full ${getStatusColor(item.status)}`}>
                                        {item.status.replace(/_/g, ' ')}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Cancellation Reason if applicable */}
                            {txDetails.order_items.some((i: any) => i.cancel_reason || i.dispute_reason) && (
                              <div className="bg-rose-50 border border-rose-100 rounded-[0.5rem] p-4 space-y-2">
                                <div className="flex items-center gap-2 text-[10px] font-black text-rose-500 tracking-widest uppercase">
                                  <InformationCircleIcon className="w-4 h-4" />
                                  <span>Reason for cancellation/dispute</span>
                                </div>
                                <p className="text-xs font-bold text-rose-900 leading-relaxed italic">
                                  "{txDetails.order_items.find((i: any) => i.cancel_reason || i.dispute_reason)?.cancel_reason || txDetails.order_items.find((i: any) => i.cancel_reason || i.dispute_reason)?.dispute_reason}"
                                </p>
                                {txDetails.order_items.find((i: any) => i.cancel_explanation || i.delivery_review_explanation) && (
                                  <p className="text-[10px] text-rose-700/70 font-medium">
                                    {txDetails.order_items.find((i: any) => i.cancel_explanation || i.delivery_review_explanation)?.cancel_explanation || txDetails.order_items.find((i: any) => i.cancel_explanation || i.delivery_review_explanation)?.delivery_review_explanation}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Transaction History Data */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 text-xs text-slate-400 ">
                            <span>Transaction Data</span>
                          </div>

                          <div className="bg-slate-50 border border-slate-100 rounded-[0.5rem] p-6 space-y-6 relative">
                            {/* Base Info */}
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-slate-400  tracking-widest">Reference</p>
                                <p className="text-xs font-black text-slate-800 break-all">
                                  #{(() => {
                                    const sId = txDetails.order_items?.[0]?.stoqle_order_id;
                                    return sId ? `ORD-${sId}` : (txDetails.reference || txDetails.transaction_id);
                                  })()}
                                </p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-slate-400  tracking-widest">Date & Time</p>
                                <div className="flex flex-col gap-1">
                                  <p className="text-xs font-black text-slate-800">
                                    {(() => {
                                      const d = new Date(txDetails.created_at);
                                      const day = d.getDate();
                                      const month = d.toLocaleString('default', { month: 'short' });
                                      const year = d.getFullYear();
                                      const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                      return `${day} ${month} ${year}, ${time}`;
                                    })()}
                                  </p>
                                  <button
                                    onClick={handleExternalShare}
                                    className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 w-fit"
                                  >
                                    <PrinterIcon className="w-3.5 h-3.5" />
                                    Download Receipt
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Account Number / Peer Info for Wallet-to-Wallet */}
                            {txDetails.transaction_type === 'transfer' && txDetails.peer_info && (
                              <div className="pt-4 border-t border-slate-200/50 flex items-center justify-between">
                                <div className="space-y-1">
                                  <p className="text-[10px] font-bold text-slate-400  tracking-widest">{txDetails.amount < 0 ? 'Recipient Account' : 'Sender Account'}</p>
                                  <p className="text-xs font-black text-slate-800">{txDetails.peer_info.peer_name}</p>
                                  <p className="text-[9px] font-bold text-slate-400">{txDetails.peer_info.peer_email || `ID: ${txDetails.peer_info.owner_id}`}</p>
                                </div>
                                <button
                                  onClick={handleShareReceipt}
                                  disabled={sendingReminder}
                                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black  tracking-widest flex items-center gap-2 hover:bg-slate-800 transition active:scale-95 disabled:opacity-50"
                                >
                                  {sendingReminder ? (
                                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  ) : (
                                    <ShareIcon className="w-3.5 h-3.5" />
                                  )}
                                  Share
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Transfer Details (Specific for Transfers) */}
                        {txDetails.transaction_type === 'transfer' && (
                          <div className="pt-5 border-t border-slate-200/50 space-y-4">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-500  tracking-widest">
                              <UserIcon className="w-3.5 h-3.5" />
                              <span>Transfer Details</span>
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                              <div className="space-y-1">
                                <p className="text-[9px] font-bold text-slate-400  tracking-widest">Description</p>
                                <p className="text-xs font-black text-slate-800 leading-relaxed bg-white p-3 rounded-xl border border-slate-100 italic">
                                  "{txDetails.description}"
                                </p>
                              </div>
                              <div className="flex justify-between items-center py-2 px-1">
                                <p className="text-[10px] font-bold text-slate-400  tracking-widest">Party Involved</p>
                                <p className="text-[11px] font-black text-slate-900 border-b border-emerald-500 pb-0.5">
                                  {txDetails.description.includes('To ') || txDetails.description.includes('to ')
                                    ? txDetails.description.split(/To |to /)[1].split(' (')[0]
                                    : txDetails.description.split(/From |from /)[1].split(' (')[0]}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Linked Order/Customer Info (IF AVAILABLE) */}
                        {txDetails.order_items && txDetails.order_items.length > 0 ? (
                          <div className=" space-y-5">
                            {/* Products */}
                            <div className="space-y-3">
                              <p className="text-[10px] font-bold text-rose-500  flex items-center gap-1.5 ">
                                Linked Products
                              </p>
                              <div className="space-y-3">
                                {txDetails.order_items.map((item: any) => (
                                  <div key={item.id} className="flex items-center gap-3 bg-white p-2 rounded-[0.5rem] border border-slate-100">
                                    <div
                                      onClick={() => handleImagePreview(txDetails.order_items, txDetails.order_items.indexOf(item))}
                                      className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex-shrink-0 flex items-center justify-center overflow-hidden cursor-zoom-in"
                                    >
                                      {item.product_image ? (
                                        <img src={item.product_image} alt={item.product_name} className="w-full h-full object-cover" />
                                      ) : (
                                        <ShoppingBagIcon className="w-5 h-5 text-slate-200" />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[11px] font-bold text-slate-900 truncate">{item.product_name}</p>
                                      {item.variant_info && (
                                        <p className="text-[9px] font-black text-rose-500  tracking-tighter bg-rose-50 px-1.5 py-0.5 rounded w-fit mb-1">{item.variant_info}</p>
                                      )}
                                      <p className="text-[10px] text-slate-500 font-bold">Qty: {item.quantity} × {fmt(item.unit_price)}</p>
                                    </div>
                                    <div className={`px-2 py-0.5 rounded text-[9px] font-black  ${getStatusColor(item.status)}`}>
                                      {item.status?.replace(/_/g, ' ')}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Customer */}
                            <div className="flex gap-4">
                              <div className="flex-1 space-y-1">
                                <p className="text-[10px] font-bold text-slate-400  tracking-widest flex items-center gap-1.5 font-bold">
                                  Customer
                                </p>
                                <p className="text-xs font-black text-slate-800">{txDetails.order_items[0].full_name}</p>
                              </div>
                              <div className="flex-1 space-y-1 text-right">
                                <p className="text-[10px] font-bold text-slate-400  tracking-widest font-bold">Order Status</p>
                                <p className={`text-[10px] font-black  px-2 py-0.5 rounded-lg w-fit ml-auto ${getStatusColor(txDetails.order_items[0].status)}`}>
                                  {txDetails.order_items[0].status?.replace(/_/g, ' ')}
                                </p>
                              </div>
                            </div>

                            {/* Address */}
                            <div className="space-y-1.5 pt-2 pb-6">
                              <p className="text-[10px] text-slate-400 flex items-center gap-1.5 ">
                                Delivery Address
                              </p>
                              <p className="text-xs font-bold text-slate-700 leading-relaxed bg-white p-3 rounded-[0.5rem] border border-dashed border-slate-200 ">
                                {parseAddress(txDetails.order_items[0].delivery_address)}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="pt-4 border-t border-slate-200/50 flex items-center gap-2 text-slate-400 italic pb-6">
                            <p className="text-[10px]">No linked order details found for this system transaction.</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Financial Modals */}
      <WithdrawModal
        isOpen={isWithdrawOpen}
        onClose={() => setIsWithdrawOpen(false)}
        onEditAccount={() => {
          setIsWithdrawOpen(false);
          setShouldReopenWithdraw(true);
          setIsPaymentInfoOpen(true);
        }}
        availableBalance={balances.available}
        activePaymentJson={paymentInfo}
        onBalanceUpdate={(newBal) => {
          if (onBalanceUpdate) onBalanceUpdate(newBal);
          fetchTransactions();
        }}
        role={role as any}
      />

      <TransferModal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        availableBalance={balances.available}
        onBalanceUpdate={(newBal) => {
          if (onBalanceUpdate) onBalanceUpdate(newBal);
          fetchTransactions();
        }}
      />

      <PaymentInfoModal
        open={isPaymentInfoOpen}
        onClose={() => {
          setIsPaymentInfoOpen(false);
          if (shouldReopenWithdraw) {
            setIsWithdrawOpen(true);
            setShouldReopenWithdraw(false);
          }
        }}
        prefKey="business_payment_info"
        initialValue={paymentInfo}
        onSave={(json) => {
          setPaymentInfo(json);
          setShouldReopenWithdraw(false); // Do not reopen if we successfully saved
          fetchWallet(); // refresh UI status
        }}
        role={role as any}
        businessId={businessId}
      />

      <PinSetupModal
        isOpen={isPinSetupOpen}
        onClose={() => {
          setIsPinSetupOpen(false);
          setIntendedActionAfterPin(null);
        }}
        onSuccess={() => {
          fetchWallet();
          setIsPinSetupOpen(false);
          if (intendedActionAfterPin === "withdraw") {
            setIsWithdrawOpen(true);
          } else if (intendedActionAfterPin === "transfer") {
            setIsTransferOpen(true);
          }
          setIntendedActionAfterPin(null);
        }}
      />

      {/* Unified Report Modal for Balance Modal */}
      {isReportOpen && txDetails && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[0.5rem]  overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900 leading-tight">Report a Problem</h3>
                <p className="text-[10px] font-black text-rose-500  tracking-widest mt-1">Order Dispute</p>
              </div>
              <button onClick={() => setIsReportOpen(false)} className="p-2 hover:bg-slate-50 rounded-full transition">
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="bg-rose-50 border border-rose-100 p-6 rounded-3xl space-y-3">
                <div className="flex items-center gap-3 text-rose-600">
                  <ShieldCheckIcon className="w-5 h-5" />
                  <h4 className="font-black text-[10px]  tracking-widest">Escrow Protection</h4>
                </div>
                <p className="text-[11px] text-rose-700/80 font-medium leading-relaxed">
                  Reporting a problem will put the payment on hold. Stoqle administrators will review the dispute and contact both you and the vendor.
                </p>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 tracking-widest ml-1">Describe the Issue</label>
                <textarea
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Tell us what went wrong with your order..."
                  className="w-full min-h-[160px] bg-slate-100 border border-slate-200 rounded-[1.8rem] p-6 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition resize-none"
                />
              </div>

              <button
                onClick={submitReport}
                disabled={processingAction}
                className="w-full py-5 bg-black text-white rounded-[2rem] font-black shadow-xl shadow-black/10 hover:scale-[1.02] active:scale-95 transition disabled:opacity-50"
              >
                {processingAction ? 'Processing...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Lightbox for images */}
      <Lightbox
        open={lightBoxOpen}
        close={() => setLightBoxOpen(false)}
        index={lightBoxIndex}
        slides={lightBoxSlides}
        controller={{ closeOnBackdropClick: true }}
        styles={{
          root: { zIndex: 9999999 },
          container: { backgroundColor: "rgba(0,0,0,0.9)" }
        }}
      />
    </>
  );
}
