"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/src/lib/config";
import { useAuth } from "@/src/context/authContext";
import { copyToClipboard } from "@/src/lib/utils/utils";
import { useWallet } from "@/src/context/walletContext";
import { ChevronLeft, ChevronDown, ChevronUp, MessageCircle, Package, MapPin, Search, ChevronRight, CheckCircle, AlertTriangle, Clock, X, Star, Info, SlidersHorizontal, XCircle, Truck, Copy, Camera, CheckCircle2, Send } from "lucide-react";

const REPORT_REASONS = [
    "Damaged item",
    "Defective / not working",
    "Poor quality",
    "Used item sold as new",
    "Not as described",
    "Wrong color / size / model",
    "Missing features",
    "Fake or counterfeit product",
    "Incomplete delivery (missing items or accessories)",
    "Wrong item delivered",
    "Package tampered / opened before delivery",
    "Broken seal or suspicious packaging",
    "Late delivery (beyond agreed time)",
    "Suspected fraud / authenticity issue",
    "Service not completed as agreed (for service orders)",
    "Poor service quality",
    "Vendor did not follow agreed instructions",
    "Misleading information or false promise",
    "Hidden charges after delivery",
    "Other (custom reason)"
];

const RETURN_REASONS = [
    "Hidden defect discovered later",
    "Product stops working after short use",
    "Manufacturing fault (not visible at delivery)",
    "Wrong item (noticed late)",
    "Missing parts discovered after use",
    "Counterfeit / fake product confirmed later",
    "Authenticity issues (e.g., serial number fails verification)",
    "Health or safety issue from product",
    "Product causes damage or risk",
    "Warranty claim issue (vendor refuses to honor warranty)",
    "Service failure after completion (for service-based orders)",
    "Poor durability (breaks too quickly under normal use)",
    "Vendor misrepresentation discovered later",
    "Important feature missing (only discovered during use)",
    "Other (custom reason with evidence)"
];
import { toast } from "sonner";
import Swal from "sweetalert2";
import Header from "@/src/components/header";
import { confirmOrderReceipt, reportOrderProblem, confirmCustomerReceipt } from "@/src/lib/api/walletApi";
import { cancelOrder } from "@/src/lib/api/orderApi";
import ReturnRefundModal from "@/src/components/orders/ReturnRefundModal";
import SevenDayReturnModal from "@/src/components/business/policyModal/sevenDayReturnModal";
import ProductPreviewModal from "@/src/components/product/addProduct/modal/previewModal";
import { mapProductToPreviewPayload } from "@/src/lib/utils/product/mapping";
import { fetchProductById, logUserActivity } from "@/src/lib/api/productApi";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

interface OrderItem {
    order_id: number;
    product_id?: number | string;
    product_name: string;
    product_image: string | null;
    quantity: number;
    unit_price: number;
    variant_info: string | null;
    status: string;
    item_cancel_reason?: string;
    item_cancel_explanation?: string;
    snapshot_data?: any;
    product_snapshot?: any; // Add for debugging/future-proofing
}

interface Shipment {
    shipment_id: number | string;
    status: string;
    shipping_promise: string | null;
    escrow_id: number | null;
    escrow_status: string | null;
    auto_release_at: string | null;
    items: OrderItem[];
    cancelled_by?: string;
    ship_cancel_reason?: string;
    ship_cancel_explanation?: string;
    delivery_code?: string;
    delivered_at?: string;
    dispute_status?: string;
    dispute_reason?: string;
    dispute_explanation?: string;
    dispute_date?: string;
    reviewed?: boolean;
    review_rating?: number;
    review_comment?: string | null;
}

interface VendorOrder {
    sale_id: number;
    master_order_id?: number | string | null;
    vendor_id: number;
    vendor_name: string;
    vendor_logo: string | null;
    profile_pic?: string | null;
    reference_no: string;
    total: number;
    status: string;
    business_owner_id?: number;
    user_id?: string | number;
    reviewed?: boolean;
    review_rating?: number;
    review_comment?: string;
    customer_confirmed?: boolean;
    dispute_status?: 'none' | 'open' | 'closed';
    cancelled_by?: string;
    cancel_reason?: string;
    cancel_explanation?: string;
    shipments: Shipment[];
    shipment_id?: number | string | null;
}

interface MasterOrder {
    order_id: number;
    stoqle_order_id: string | number | null;
    total_amount: number;
    total_items: number;
    status: string;
    payment_status: string;
    payment_reference: string;
    created_at: string;
    vendors: VendorOrder[];
    customer_confirmed?: boolean; // For local UI state if needed
    dispute_status?: 'none' | 'open' | 'closed';
}

interface PendingCheckout {
    reference: string;
    amount: number;
    status: string;
    items: {
        title: string,
        quantity: number,
        price: number,
        variant_info?: string,
        business_name?: string,
        business_id?: number,
        business_owner_id: number | null,
        product_image?: string | null,
        business_logo?: string | null,
        business_profile_pic?: string | null
    }[];
    created_at: string;
    metadata: any;
}

import { useAudio } from "@/src/context/audioContext";

export default function MyOrdersPage() {
    const { user, token, isHydrated } = useAuth();
    const { refreshWallet } = useWallet();
    const { playSound } = useAudio();
    const router = useRouter();
    const [dynamicNavHeight, setDynamicNavHeight] = useState(0);

    useEffect(() => {
        const updateHeight = () => {
            if (window.innerWidth >= 1024) { // matching 'lg' breakpoint
                setDynamicNavHeight(64);
            } else {
                setDynamicNavHeight(0);
            }
        };
        updateHeight();
        window.addEventListener('resize', updateHeight);
        return () => window.removeEventListener('resize', updateHeight);
    }, []);
    const [orders, setOrders] = useState<MasterOrder[]>([]);
    const [pendingOrders, setPendingOrders] = useState<PendingCheckout[]>([]);
    const [activeTab, setActiveTab] = useState("All Orders");
    const [isLoading, setIsLoading] = useState(true);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxSlides, setLightboxSlides] = useState<{ src: string }[]>([]);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [isActionLoading, setIsActionLoading] = useState<number | null>(null);
    const [messageLoading, setMessageLoading] = useState<number | null>(null);

    // Review Modal State
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [selectedOrderForReview, setSelectedOrderForReview] = useState<VendorOrder | null>(null);
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewComment, setReviewComment] = useState("");

    // Report Modal State
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [selectedOrderForReport, setSelectedOrderForReport] = useState<any>(null);
    const [reportReason, setReportReason] = useState("");
    const [reportExplanation, setReportExplanation] = useState("");
    const [reportImages, setReportImages] = useState<{ file: File; preview: string }[]>([]);
    const [isUploadingProof, setIsUploadingProof] = useState(false);

    // Comment Popover State
    const [activeCommentSaleId, setActiveCommentSaleId] = useState<number | null>(null);

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [selectedOrderForReturn, setSelectedOrderForReturn] = useState<any>(null);

    // Expansion State
    const [expandedMasters, setExpandedMasters] = useState<Record<number, boolean>>({});
    const [expandedVendors, setExpandedVendors] = useState<Record<number, boolean>>({});

    // Tracking History Modal State
    const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
    const [trackingHistory, setTrackingHistory] = useState<any[]>([]);
    const [trackingLoading, setTrackingLoading] = useState(false);
    const [trackingOrderId, setTrackingOrderId] = useState<number | null>(null);

    // Delivery Code Modal State
    const [isDeliveryCodeModalOpen, setIsDeliveryCodeModalOpen] = useState(false);
    const [selectedDeliveryCode, setSelectedDeliveryCode] = useState<string | null>(null);
    const [selectedDeliveryOrderRef, setSelectedDeliveryOrderRef] = useState<string | null>(null);

    // Product Preview State
    const [previewProductModalOpen, setPreviewProductModalOpen] = useState(false);
    const [selectedProductPayload, setSelectedProductPayload] = useState<any>(null);
    const [isPreviewFetching, setIsPreviewFetching] = useState(false);

    // Prevent background scrolling when any modal is open
    useEffect(() => {
        if (isTrackingModalOpen || isReviewModalOpen || isReportModalOpen || isReturnModalOpen || selectedImageUrl || isDeliveryCodeModalOpen || previewProductModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isTrackingModalOpen, isReviewModalOpen, isReportModalOpen, isReturnModalOpen, selectedImageUrl, isDeliveryCodeModalOpen]);

    const toggleMaster = (masterId: number, autoExpand?: boolean, firstVendorId?: number) => {
        setExpandedMasters(prev => {
            const isExpanding = !prev[masterId];
            if (isExpanding && autoExpand && firstVendorId) {
                setExpandedVendors(vPrev => ({ ...vPrev, [firstVendorId]: true }));
            }
            return { ...prev, [masterId]: isExpanding };
        });
    };

    const toggleVendor = (saleId: number) => {
        setExpandedVendors(prev => ({ ...prev, [saleId]: !prev[saleId] }));
    };

    const searchRef = useRef<HTMLInputElement>(null);
    const tabRefs = useRef(new Map<string, HTMLButtonElement>());

    const mainTabs = ["All Orders", "Processing", "Completed", "Cancelled"];

    const formatUrl = (url: string | null | undefined) => {
        if (!url) return "";
        if (url.startsWith("http")) return url;
        return url.startsWith("/public") ? `${API_BASE_URL}${url}` : `${API_BASE_URL}/public/${url}`;
    };

    const formatOrderDate = (dateString: string) => {
        if (!dateString) return "";
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return dateString;

        const day = d.toLocaleDateString('en-GB', { day: '2-digit' });
        const month = d.toLocaleDateString('en-GB', { month: 'long' });
        const year = d.toLocaleDateString('en-GB', { year: 'numeric' });
        const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase().replace(/\s+/g, '');

        return `${day} ${month}, ${year} - ${time}`;
    };

    const handleTabClick = (tab: string) => {
        setActiveTab(tab);
        const element = tabRefs.current.get(tab);
        if (element) {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center'
            });
        }
    };

    const [isReturnPolicyModalOpen, setIsReturnPolicyModalOpen] = useState(false);
    const [agreedToPolicy, setAgreedToPolicy] = useState(false);

    useEffect(() => {
        // Register global function for the dispute modal link
        (window as any).closeSwalAndShowPolicy = () => {
            Swal.close();
            setIsReturnPolicyModalOpen(true);
        };

        return () => {
            delete (window as any).closeSwalAndShowPolicy;
        };
    }, []);

    const fetchOrders = async (showLoading = true) => {
        if (!token) return;
        try {
            if (showLoading) setIsLoading(true);

            // Fetch both completed and pending concurrently
            const [ordersRes, pendingRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/orders/customer`, {
                    headers: { "Authorization": `Bearer ${token}` },
                    cache: 'no-store'
                }),
                fetch(`${API_BASE_URL}/api/payment/my-pending`, {
                    headers: { "Authorization": `Bearer ${token}` },
                    cache: 'no-store'
                })
            ]);

            const ordersData = await ordersRes.json();
            const pendingData = await pendingRes.json();

            if (ordersData.status === "success" || ordersData.success) {
                // Backend now deeply resolves structure!
                setOrders(ordersData.data || []);
            }
            if (pendingData.status === "success" || pendingData.success) {
                setPendingOrders(pendingData.data || []);
            }
        } catch (err) {
            console.error("Fetch orders err:", err);
            toast.error("Internal Server Error");
        } finally {
            if (showLoading) setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isHydrated && token) {
            fetchOrders();
            // Polling for real-time updates
            const interval = setInterval(() => {
                fetchOrders(false);
            }, 15000);
            return () => clearInterval(interval);
        }
    }, [token, isHydrated]);

    const getFilteredOrders = () => {
        let result = orders;

        // Apply Tab Filter First
        if (activeTab === "Processing") {
            // Include anything not fully final (Processing, Ships, Paid, Partially Cancelled but still running)
            result = orders.filter(o => {
                const s = o.status?.toLowerCase();
                return ['processing', 'partially_processing', 'order_placed', 'paid', 'confirmed', 'ready_for_shipping', 'picked_up', 'out_for_delivery', 'pending'].includes(s);
            });
        } else if (activeTab === "Completed") {
            // Fully delivered or delivered + some cancelled
            result = orders.filter(o => {
                const s = o.status?.toLowerCase();
                return ['delivered', 'completed', 'completed_with_cancellations', 'released'].includes(s);
            });
        } else if (activeTab === "Cancelled") {
            // Fully cancelled or refunded
            result = orders.filter(o => {
                const s = o.status?.toLowerCase();
                return ['cancelled', 'refunded'].includes(s);
            });
        } else if (activeTab === "All Orders") {
            result = orders;
        }

        // Apply Search Filter
        if (searchQuery) {
            result = result.filter(order =>
                order.order_id.toString().includes(searchQuery) ||
                (order.stoqle_order_id?.toString() || "").includes(searchQuery) ||
                order.vendors.some(v =>
                    v.vendor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    v.shipments.some(s => s.items.some(item => item.product_name.toLowerCase().includes(searchQuery.toLowerCase())))
                )
            );
        }

        return result;
    };

    const filteredOrders = getFilteredOrders();

    const getTimeGroup = (dateString: string) => {
        const now = new Date();
        const date = new Date(dateString);

        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Helper to check boundaries
        const checkBoundary = (days: number) => {
            const boundary = new Date(startOfToday);
            boundary.setDate(boundary.getDate() - days);
            return date >= boundary;
        };

        if (date >= startOfToday) return 'Today';
        if (checkBoundary(1)) return 'Yesterday';
        if (checkBoundary(2)) return '2days ago';
        if (checkBoundary(3)) return '3days ago';
        if (checkBoundary(7)) return 'Last 7 days';
        if (checkBoundary(14)) return '2Weeks ago';
        if (checkBoundary(21)) return '3weeks ago';

        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        if (date >= lastMonth) return 'Last Month';

        const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());
        if (date >= twoMonthsAgo) return '2month ago';

        return 'Continuesly';
    };

    const groupOrder = [
        'Today', 'Yesterday', '2days ago', '3days ago',
        'Last 7 days', '2Weeks ago', '3weeks ago',
        'Last Month', '2month ago', 'Continuesly'
    ];

    const isRefundable = (item: any, shipDeliveredAt?: any) => {
        // Use any date field available for completion
        const referenceDate = shipDeliveredAt || item.delivered_at || item.completed_at || item.updated_at;
        if (!item || !referenceDate) return { canRefund: false };

        let policy = {
            seven_day_no_reason_return: false,
            return_window_days: 0
        };

        try {
            // Priority: item.snapshot_data (parsed backend) -> item.product_snapshot (raw string) -> item.return_policy (computed backend)
            const snapData = item.snapshot_data || (item.product_snapshot ? (typeof item.product_snapshot === 'string' ? JSON.parse(item.product_snapshot) : item.product_snapshot) : null);

            if (snapData && snapData.return_policy) {
                const p = snapData.return_policy;
                policy.seven_day_no_reason_return = p.seven_day_no_reason_return === true || p.seven_day_no_reason_return === 1;
                policy.return_window_days = Number(p.return_window_days || 0);
            } else if (item.return_policy) {
                // Fallback to top-level object if snapshot missing or empty
                policy.seven_day_no_reason_return = item.return_policy.seven_day_no_reason === true || item.return_policy.seven_day_no_reason === 1;
                policy.return_window_days = Number(item.return_policy.return_window || 0);
            }
        } catch (e) {
            console.error("isRefundable policy parse error:", e);
        }

        // Rules:
        // 1. seven_day_no_reason_return -> 7 days
        // 2. return_window_days -> that value
        // 3. Fallback -> 1 day
        const duration = policy.seven_day_no_reason_return ? 7 : (policy.return_window_days || 1);

        let deliveredDate: Date;
        if (typeof referenceDate === 'string') {
            deliveredDate = new Date(referenceDate.replace(' ', 'T'));
        } else {
            deliveredDate = new Date(referenceDate as any);
        }

        if (!deliveredDate || isNaN(deliveredDate.getTime())) return { canRefund: false };

        const deadline = new Date(deliveredDate.getTime() + duration * 24 * 60 * 60 * 1000);
        const canRefund = new Date() <= deadline;
        const daysLeft = Math.ceil((deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

        return { canRefund, daysLeft };
    };

    const groupedOrders = filteredOrders.reduce((groups: Record<string, MasterOrder[]>, order) => {
        const group = getTimeGroup(order.created_at);
        if (!groups[group]) groups[group] = [];
        groups[group].push(order);
        return groups;
    }, {});

    const getStatusColor = (status: string) => {
        const s = status?.toLowerCase();
        switch (s) {
            case "completed":
            case "released":
            case "delivered":
            case "completed_with_cancellations":
            case "partially_completed":
                return "bg-green-100 text-green-700";

            case "processing":
            case "partially_processing":
            case "confirmed":
            case "paid":
                return "bg-indigo-100 text-indigo-700";

            case "ready_for_shipping":
            case "out_for_delivery":
            case "partially_delivered":
                return "bg-blue-100 text-blue-700";

            case "order_placed":
            case "pending":
                return "bg-orange-100 text-orange-700";

            case "cancelled":
            case "refunded":
            case "disputed":
            case "partially_cancelled":
                return "bg-rose-100 text-rose-700";

            default: return "bg-slate-100 text-slate-700";
        }
    };

    const handleConfirmReceipt = async (escrowId: number, saleId: number, shipmentId?: number | string) => {
        const { isConfirmed } = await Swal.fire({
            title: 'Confirm Delivery',
            text: 'Did you receive this order? Confirming will release payment to the vendor.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#10B981',
            cancelButtonColor: '#94A3B8',
            confirmButtonText: 'Yes, Received',
            cancelButtonText: 'Not Yet',
            customClass: {
                popup: 'rounded-[1.5rem] p-6',
                confirmButton: 'rounded-xl px-6 py-3 font-bold text-xs',
                cancelButton: 'rounded-xl px-6 py-3 font-bold text-xs'
            }
        });

        if (!isConfirmed) return;

        setIsActionLoading(saleId);
        try {
            await confirmCustomerReceipt(saleId, shipmentId);
            toast.success("Delivery confirmed! Money released to vendor.");
            playSound("delivery_confirmed");
            fetchOrders(false);
            refreshWallet();
        } catch (err: any) {
            toast.error(err?.body?.message || "Failed to confirm receipt");
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleReportProblem = (escrowId: number, vendor: any, shipment: any) => {
        setSelectedOrderForReport({ ...vendor, shipment_id: shipment.shipment_id, status: shipment.status, escrow_id: escrowId });
        setReportReason("");
        setReportExplanation("");
        setReportImages([]);
        setIsReportModalOpen(true);
    };

    const handleImageSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const newImages = Array.from(files).map(file => ({
            file,
            preview: URL.createObjectURL(file)
        }));

        setReportImages(prev => [...prev, ...newImages].slice(0, 5));
    };

    const removeImage = (idx: number) => {
        setReportImages(prev => {
            const updated = [...prev];
            URL.revokeObjectURL(updated[idx].preview);
            updated.splice(idx, 1);
            return updated;
        });
    };

    const handleCancelOrder = async (order: MasterOrder, vendor: VendorOrder, shipment?: Shipment) => {
        const isShipment = !!shipment;
        const targetId = isShipment ? shipment.shipment_id : vendor.sale_id;

        const { value: reason } = await Swal.fire({
            title: isShipment ? 'Cancel Shipment?' : 'Cancel Order?',
            html: `
                <div class="flex flex-col gap-2 mt-4 text-left" id="cancellation-reasons">
                    <p class="text-xs text-slate-500 mb-2 px-2">Please tell us why you're cancelling this ${isShipment ? 'shipment' : 'order'}:</p>
                    <div class="space-y-2">
                        <button type="button" class="reason-btn w-full p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 hover:border-rose-100 transition-all flex items-center justify-between group active:scale-[0.98]" data-reason="Ordered by mistake">
                            <span class="text-sm font-semibold text-slate-700">Ordered by mistake</span>
                            <div class="w-4 h-4 rounded-full border-2 border-slate-100 group-hover:border-rose-500 flex items-center justify-center transition-colors">
                                <div class="w-2 h-2 rounded-full bg-rose-500 scale-0 group-hover:scale-100 transition-transform"></div>
                            </div>
                        </button>
                        <button type="button" class="reason-btn w-full p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 hover:border-rose-100 transition-all flex items-center justify-between group active:scale-[0.98]" data-reason="Found cheaper elsewhere">
                            <span class="text-sm font-semibold text-slate-700">Found cheaper elsewhere</span>
                            <div class="w-4 h-4 rounded-full border-2 border-slate-100 group-hover:border-rose-500 flex items-center justify-center transition-colors">
                                <div class="w-2 h-2 rounded-full bg-rose-500 scale-0 group-hover:scale-100 transition-transform"></div>
                            </div>
                        </button>
                        <button type="button" class="reason-btn w-full p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 hover:border-rose-100 transition-all flex items-center justify-between group active:scale-[0.98]" data-reason="Delivery too slow">
                            <span class="text-sm font-semibold text-slate-700">Delivery too slow</span>
                            <div class="w-4 h-4 rounded-full border-2 border-slate-100 group-hover:border-rose-500 flex items-center justify-center transition-colors">
                                <div class="w-2 h-2 rounded-full bg-rose-500 scale-0 group-hover:scale-100 transition-transform"></div>
                            </div>
                        </button>
                        <button type="button" class="reason-btn w-full p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 hover:border-rose-100 transition-all flex items-center justify-between group active:scale-[0.98]" data-reason="Changed mind">
                            <span class="text-sm font-semibold text-slate-700">Changed mind</span>
                            <div class="w-4 h-4 rounded-full border-2 border-slate-100 group-hover:border-rose-500 flex items-center justify-center transition-colors">
                                <div class="w-2 h-2 rounded-full bg-rose-500 scale-0 group-hover:scale-100 transition-transform"></div>
                            </div>
                        </button>
                        <button type="button" class="reason-btn w-full p-4 border border-slate-200 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all flex items-center justify-between group active:scale-[0.98]" data-reason="Other">
                            <span class="text-sm font-semibold text-slate-700">Other (optional)</span>
                            <div class="w-4 h-4 rounded-full border-2 border-slate-200 group-hover:border-slate-400 flex items-center justify-center transition-colors text-[10px] font-bold text-slate-400">+</div>
                        </button>
                    </div>
                </div>
            `,
            showConfirmButton: false,
            showCancelButton: true,
            cancelButtonText: 'Keep Order',
            customClass: {
                popup: 'rounded-[2rem] p-6',
                cancelButton: 'rounded-xl px-10 py-3 font-bold text-xs mt-2 w-full border-0 text-slate-500 bg-slate-50 hover:bg-slate-100'
            },
            didOpen: () => {
                const container = document.getElementById('cancellation-reasons');
                const btns = container?.querySelectorAll('.reason-btn');
                btns?.forEach(btn => {
                    btn.addEventListener('click', () => {
                        const r = btn.getAttribute('data-reason');
                        (Swal as any)._stqReason = r;
                        Swal.clickConfirm();
                    });
                });
            },
            preConfirm: () => {
                return (Swal as any)._stqReason;
            }
        });

        if (reason) {
            let finalReason = reason;
            if (reason === 'Other') {
                const { value: otherText } = await Swal.fire({
                    title: 'Cancellation Reason',
                    input: 'textarea',
                    inputPlaceholder: 'Please type your reason here (optional)...',
                    showCancelButton: true,
                    confirmButtonColor: '#F43F5E',
                    confirmButtonText: 'Next',
                    cancelButtonColor: '#94A3B8',
                    customClass: {
                        container: 'stq-swal-top',
                        popup: 'rounded-[2rem] p-8',
                        input: 'rounded-2xl border-slate-100 text-sm focus:ring-rose-500 h-32',
                        confirmButton: 'rounded-xl px-8 py-3 font-bold text-xs',
                        cancelButton: 'rounded-xl px-8 py-3 font-bold text-xs'
                    }
                });
                if (otherText === undefined) return;
                finalReason = otherText || 'Other';
            }

            // --- Second Confirmation: Wallet Credit Info ---
            const { isConfirmed: finalConfirm } = await Swal.fire({
                title: 'Cancel & Refund?',
                html: `
                    <div class="text-center space-y-4 py-2">
                        <div class="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg class="w-8 h-8 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <p class="text-sm text-slate-600 leading-relaxed font-medium">
                            Once cancelled, the total amount for this ${isShipment ? 'shipment' : 'order'} will be <span class="text-rose-500 font-bold">instantly credited to your Stoqle Wallet</span>.
                        </p>
                        <p class="text-[10px] text-slate-400">Funds in your wallet can be used for future purchases or withdrawn.</p>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonColor: '#F43F5E',
                confirmButtonText: 'Yes, Cancel Order',
                cancelButtonText: 'No, Keep it',
                customClass: {
                    container: 'stq-swal-top',
                    popup: 'rounded-[2.5rem] p-8',
                    confirmButton: 'rounded-xl px-8 py-4 font-bold text-xs shadow-lg shadow-rose-100',
                    cancelButton: 'rounded-xl px-8 py-4 font-bold text-xs'
                }
            });

            if (!finalConfirm) return;

            setIsActionLoading(vendor.sale_id);
            try {
                // Use the new UNIFIED cancelOrder API
                await cancelOrder(vendor.sale_id, {
                    type: isShipment ? 'shipment' : 'entire',
                    shipment_id: isShipment ? shipment.shipment_id as number : undefined,
                    reason: finalReason,
                    cancelledBy: 'customer'
                });

                Swal.fire({
                    title: 'Cancelled!',
                    text: `Your ${isShipment ? 'shipment' : 'order'} has been cancelled and funds have been returned to your wallet.`,
                    icon: 'success',
                    confirmButtonColor: '#10B981',
                    customClass: {
                        container: 'stq-swal-top',
                        popup: 'rounded-[2rem]',
                        confirmButton: 'rounded-xl px-6 py-3 font-bold   text-xs'
                    }
                });
                fetchOrders(false);
                refreshWallet();
            } catch (err: any) {
                toast.error(err?.body?.message || "Failed to cancel order");
            } finally {
                setIsActionLoading(null);
            }
        }
    };

    // Inject Z-Index Fix for SweetAlert to be above everything in the app
    useEffect(() => {
        const styleId = 'stq-swal-z-index-fix';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.innerHTML = `
                .stq-swal-top {
                    z-index: 999999999 !important;
                }
                .swal2-container {
                    z-index: 999999999 !important;
                }
            `;
            document.head.appendChild(style);
        }
    }, []);

    const submitReport = async () => {
        if (!selectedOrderForReport) return;
        if (!selectedOrderForReport.escrow_id) {
            toast.error("Order escrow details missing. Please contact support.");
            return;
        }
        if (!reportReason) {
            toast.error("Please select a reason.");
            return;
        }

        const isOther = reportReason.includes("Other");
        if (isOther && !reportExplanation.trim()) {
            toast.error("Please provide an explanation.");
            return;
        }

        const isReturn = selectedOrderForReport.status === 'delivered';
        const confirmResult = await Swal.fire({
            title: isReturn ? 'Confirm Return request?' : 'Confirm dispute report?',
            text: isReturn
                ? "Are you sure you want to request a return and refund for this item? The payment will be held until the admin reviews your case."
                : "Are you sure you want to report a problem with this shipment? The vendor's payment will be put on hold immediately.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#e11d48',
            cancelButtonColor: '#64748b',
            confirmButtonText: isReturn ? 'Yes, Submit Return' : 'Yes, Report Problem',
            cancelButtonText: 'No, Cancel',
            background: '#ffffff',
            customClass: {
                popup: 'rounded-[1.5rem] border-0 box-shadow-none',
                confirmButton: 'rounded-full px-6 py-2.5 font-bold  tracking-wide text-xs active:scale-95 transition-all',
                cancelButton: 'rounded-full px-6 py-2.5 font-bold  tracking-wide text-xs active:scale-95 transition-all'
            }
        });

        if (!confirmResult.isConfirmed) return;

        setIsActionLoading(selectedOrderForReport.sale_id);
        try {
            let proofUrls: string[] = [];

            if (reportImages.length > 0) {
                setIsUploadingProof(true);
                const formData = new FormData();
                reportImages.forEach(img => formData.append('files', img.file));

                const uploadRes = await fetch(`${API_BASE_URL}/api/meta/upload`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });

                const uploadData = await uploadRes.json();
                setIsUploadingProof(false);

                if (uploadData.status === 'success') {
                    proofUrls = uploadData.data.filenames.map((u: string) =>
                        u.startsWith('http') ? u : `${API_BASE_URL}/public/${u}`
                    );
                } else {
                    toast.error("Proof upload failed. Submitting without images.");
                }
            }

            const payload = {
                escrowId: selectedOrderForReport.escrow_id,
                reason: reportReason,
                explanation: reportExplanation || reportReason,
                proof_images: proofUrls
            };

            const res = await fetch(`${API_BASE_URL}/api/wallet/escrow/report-problem`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.status === 'success' || data.success) {
                toast.success("Problem reported. Payment has been held.");
                setIsReportModalOpen(false);
                fetchOrders(false);
            } else {
                toast.error(data.message || "Failed to report issue");
            }
        } catch (err: any) {
            toast.error("An error occurred. Please try again.");
        } finally {
            setIsActionLoading(null);
            setIsUploadingProof(false);
        }
    };

    const handleViewDispute = (ship: Shipment) => {
        const isReleased = ship.escrow_status === 'released' || ['delivered', 'completed'].includes(ship.status?.toLowerCase() || '');

        Swal.fire({
            title: '<span style="font-weight:900;">Dispute Details ⚠️</span>',
            html: `
                <div style="text-align: left; padding: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <div style="flex: 1;">
                            <p style="font-size: 10px; font-weight: 900; color: #94a3b8; text-transform: ; margin-bottom: 4px;">Status</p>
                            <p style="font-size: 14px; font-weight: 700; color: #e11d48;">Under Review</p>
                        </div>
                        <div style="flex: 1; text-align: right;">
                            <p style="font-size: 10px; font-weight: 900; color: #94a3b8; text-transform: ; margin-bottom: 4px;">Date Filed</p>
                            <p style="font-size: 13px; font-weight: 600; color: #1e293b;">${ship.dispute_date ? new Date(ship.dispute_date).toLocaleDateString() : 'N/A'}</p>
                        </div>
                    </div>
                    
                    <div style="background: #fff1f2; border: 1px solid #fda4af; padding: 15px; border-radius: 12px; margin-bottom: 20px;">
                        <p style="font-size: 10px; font-weight: 900; color: #e11d48; text-transform: ; margin-bottom: 4px;">Your Reason</p>
                        <p style="font-size: 13px; font-weight: 600; color: #9f1239;">${ship.dispute_explanation || ship.dispute_reason || 'No specific reason found.'}</p>
                    </div>

                    <p style="font-size: 13px; color: #475569; line-height: 1.6;">
                        Our administration team is currently investigating your claim. We may contact you or the vendor for further evidence if required. 
                        ${isReleased
                    ? "Since this order was already marked as delivered, the payment has been released to the vendor. We are currently coordinating with them to facilitate a resolution or refund where applicable."
                    : "<b>Funds are held in escrow</b> and will not be released until a resolution is reached."
                }
                    </p>

                    <p style="font-size: 13px; color: #1e293b; font-weight: 700; margin-top: 12px; line-height: 1.6;">
                        💡 If the conditions of our returning and vendor returning policies are met, you will receive an instant refund.
                    </p>

                    <div style="margin-top: 16px; text-align: left;">
                        <button 
                            onclick="window.closeSwalAndShowPolicy();" 
                            style="background: none; border: none; color: #3b82f6; font-size: 11px; font-weight: 700; cursor: pointer; padding: 0; text-decoration: underline;"
                        >
                            View Returning Policy
                        </button>
                    </div>

                    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; text-align: center;">
                         <p style="font-size: 11px; color: #94a3b8; font-weight: 600;">
                            Thank you for your patience while we work to resolve this.
                        </p>
                    </div>
                </div>
            `,
            confirmButtonText: 'Close',
            confirmButtonColor: '#0f172a',
            customClass: {
                popup: 'rounded-[1.5rem]',
                confirmButton: 'rounded-full px-8 py-3 font-bold text-xs '
            }
        });
    };



    const handleOpenReview = (vendor: VendorOrder, ship?: Shipment) => {
        setSelectedOrderForReview({ ...vendor, shipment_id: ship?.shipment_id });
        setReviewRating(5);
        setReviewComment("");
        setIsReviewModalOpen(true);
    };

    const submitReview = async () => {
        if (!selectedOrderForReview || !token) return;

        setIsActionLoading(selectedOrderForReview.sale_id);
        try {
            const res = await fetch(`${API_BASE_URL}/api/reviews`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    business_id: selectedOrderForReview.vendor_id,
                    order_id: selectedOrderForReview.sale_id,
                    shipment_id: (selectedOrderForReview as any).shipment_id,
                    rating: reviewRating,
                    comment: reviewComment
                })
            });
            const data = await res.json();
            if (data.status === 'success' || data.success) {
                toast.success("Review submitted! Thank you.");
                setIsReviewModalOpen(false);
                setSelectedOrderForReview(null);
                await fetchOrders(false);
            } else {
                toast.error(data.message || "Failed to submit review");
            }
        } catch (err) {
            toast.error("Error submitting review");
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleMessageVendor = async (vendor: VendorOrder) => {
        if (!token) {
            router.push("/login");
            return;
        }

        const profileUserId = vendor.business_owner_id;
        if (!profileUserId) {
            toast.error("Could not find vendor contact info");
            return;
        }

        setMessageLoading(vendor.sale_id);

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        };

        try {
            let convId: string | number | null = null;
            const tryEndpoints = [
                { url: `${API_BASE_URL}/api/chat/create`, body: { other_user_id: profileUserId } },
                { url: `${API_BASE_URL}/api/conversations/init`, body: { user_id: profileUserId } },
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
                router.push(`/messages?room=${convId}&order_ref=${vendor.reference_no}&order_id=${vendor.master_order_id || ""}`);
                return;
            }

            router.push(`/messages?user=${profileUserId}&order_ref=${vendor.reference_no}&order_id=${vendor.master_order_id || ""}`);
        } catch (err) {
            console.error("Failed to init conversation:", err);
            router.push(`/messages?user=${profileUserId}&order_ref=${vendor.reference_no}`);
        } finally {
            setMessageLoading(null);
        }
    };

    const handleBuyAgain = async (item: OrderItem) => {
        const productId = item.product_id || item.snapshot_data?.product_id;

        if (!productId || productId === 'undefined') {
            toast.error("Product ID is missing on this order item");
            return;
        }

        setIsPreviewFetching(true);
        setPreviewProductModalOpen(true);

        try {
            const data = await fetchProductById(productId, token);

            if (data && data.status === 'success' && data.data?.product) {
                const mapped = mapProductToPreviewPayload(data.data.product, formatUrl);
                setSelectedProductPayload(mapped);

                // Log interaction
                logUserActivity({
                    product_id: data.data.product.product_id,
                    action_type: 'view',
                    category: data.data.product.category
                }, token);
            } else {
                toast.error("Failed to load product details");
                setPreviewProductModalOpen(false);
            }
        } catch (error) {
            toast.error("Something went wrong while loading product");
            setPreviewProductModalOpen(false);
        } finally {
            setIsPreviewFetching(false);
        }
    };

    const handleProductClick = async (productId: number | string) => {
        if (!productId) return;
        setIsPreviewFetching(true);
        setPreviewProductModalOpen(true);
        try {
            const data = await fetchProductById(productId, token);
            if (data && data.status === 'success' && data.data?.product) {
                const mapped = mapProductToPreviewPayload(data.data.product, formatUrl);
                setSelectedProductPayload(mapped);
            } else {
                toast.error("Failed to load product details");
            }
        } catch (error) {
            toast.error("Something went wrong while loading product");
        } finally {
            setIsPreviewFetching(false);
        }
    };

    const handleTrackOrder = async (orderId: number) => {
        if (!orderId) return;
        setTrackingOrderId(orderId);
        setIsTrackingModalOpen(true);
        setTrackingLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}/tracking`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setTrackingHistory(data.data || []);
            } else {
                toast.error("Failed to load tracking history");
            }
        } catch (err) {
            toast.error("Error loading tracking history");
        } finally {
            setTrackingLoading(false);
        }
    };

    const CountdownTimer = ({ targetDate }: { targetDate: string }) => {
        const [timeLeft, setTimeLeft] = useState<string>("");

        useEffect(() => {
            const calculateTimeLeft = () => {
                const now = new Date().getTime();
                const target = new Date(targetDate).getTime();
                const difference = target - now;

                if (difference <= 0) {
                    setTimeLeft("Processing...");
                    return;
                }

                const days = Math.floor(difference / (1000 * 60 * 60 * 24));
                const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));

                let result = "";
                if (days > 0) result += `${days}d `;
                if (hours > 0 || days > 0) result += `${hours}h `;
                result += `${minutes}m`;

                setTimeLeft(result);
            };

            calculateTimeLeft();
            const timer = setInterval(calculateTimeLeft, 60000); // Update every minute

            return () => clearInterval(timer);
        }, [targetDate]);

        return (
            <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100 animate-in fade-in duration-500">
                <Clock size={12} className="animate-pulse" />
                <span className="text-[10px] font-bold  tracking-wider">Auto-confirms in {timeLeft}</span>
            </div>
        );
    };


    const OrderSkeleton = () => (
        <div className="bg-white p-4 animate-pulse">
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-50">
                <div className="flex gap-4 items-center">
                    <div className="w-14 h-14 bg-slate-100 rounded-2xl" />
                    <div className="space-y-2">
                        <div className="w-32 h-4 bg-slate-100 rounded-lg" />
                        <div className="w-20 h-3 bg-slate-50 rounded-lg" />
                    </div>
                </div>
                <div className="w-24 h-8 bg-slate-100 rounded-full" />
            </div>
            <div className="space-y-6">
                {[1, 2].map((i) => (
                    <div key={i} className="flex gap-4">
                        <div className="w-16 h-16 bg-slate-50 rounded-xl" />
                        <div className="flex-1 space-y-2 py-1">
                            <div className="w-2/3 h-4 bg-slate-100 rounded-lg" />
                            <div className="w-1/4 h-3 bg-slate-50 rounded-lg" />
                        </div>
                    </div>
                ))}
            </div>
            <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between gap-4">
                <div className="w-24 h-10 bg-slate-50 rounded-xl" />
                <div className="flex gap-3">
                    <div className="w-32 h-10 bg-slate-100 rounded-2xl" />
                    <div className="w-10 h-10 bg-slate-900/10 rounded-full" />
                </div>
            </div>
        </div>
    );

    if (!isHydrated) {
        return (
            <div className="min-h-screen bg-[#F8FAFC]">
                <div className="h-[60px] md:h-0"></div>
                <main className="md:p-10 pb-20 p-3">
                    <div className="mb-5">
                        <div className="w-48 h-8 bg-slate-200 animate-pulse rounded-xl mb-2" />
                    </div>
                    <div className="grid grid-cols-1 gap-8">
                        {[1, 2, 3, 4].map((i) => <OrderSkeleton key={i} />)}
                    </div>
                </main>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 text-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center  mb-6">
                    <Package className="text-slate-300" size={32} />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Login Required</h2>
                <p className="text-slate-500 max-w-xs mb-8">Please login to access your order history and track deliveries.</p>
                <button
                    onClick={() => router.push("/login")}
                    className="px-8 py-3 bg-black text-white rounded-2xl font-bold  shadow-black/10 active:scale-95 transition"
                >
                    Return to Login
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100">

            <main className=" md:p-10 pb-10 p-3">
                <div
                    className="sticky z-[50] bg-[#F8FAFC]/80 backdrop-blur-md -mx-3 px-4 py-4 md:bg-transparent md:backdrop-none md:p-0 md:border-0 md:mx-0 border-b border-slate-100 md:border-b-0"
                    style={{ top: `${dynamicNavHeight}px` }}
                >
                    <div className="flex items-center justify-between gap-4 min-h-[44px]">
                        {!isSearchOpen ? (
                            <div className="flex items-center gap-2 overflow-hidden">
                                <button
                                    onClick={() => router.back()}
                                    className="md:hidden p-2 -ml-2 rounded-full hover:bg-white transition-colors"
                                    title="Back"
                                >
                                    <ChevronLeft className="h-6 w-6 text-slate-600" />
                                </button>
                                <div className="space-y-0">
                                    <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight whitespace-nowrap">Purchase History</h1>
                                </div>
                                {orders.length > 0 && (
                                    <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-100 flex items-center gap-1.5 w-fit shrink-0">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-[9px] font-bold text-slate-600  ">{orders.length}</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 animate-in slide-in-from-right-4 fade-in duration-300 flex items-center gap-2">
                                <button
                                    onClick={() => router.back()}
                                    className="md:hidden p-2 -ml-2 rounded-full hover:bg-white transition-colors shrink-0"
                                    title="Back"
                                >
                                    <ChevronLeft className="h-6 w-6 text-slate-600" />
                                </button>
                                <div className="relative flex-1">
                                    <input
                                        ref={searchRef}
                                        type="search"
                                        placeholder="Search products, orders..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="
                                            w-full
                                            rounded-lg
                                            bg-white
                                            border border-slate-200
                                            pl-4
                                            pr-10
                                            py-2
                                            text-sm
                                            text-black
                                            caret-rose-500
                                            outline-none
                                            transition
                                            focus:ring-rose-500/10
                                        "
                                        autoFocus
                                        aria-label="Search"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300">
                                        <Search size={16} />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-2 shrink-0 ml-auto">
                            <button
                                onClick={() => {
                                    setIsSearchOpen(!isSearchOpen);
                                    if (isSearchOpen) setSearchQuery("");
                                }}
                                className={`h-8 w-8 flex items-center justify-center rounded-lg border transition-all ${isSearchOpen ? 'bg-rose-500 border-rose-500 text-white  shadow-rose-500/20' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 '}`}
                                title={isSearchOpen ? "Close Search" : "Search Orders"}
                            >
                                {isSearchOpen ? <X size={20} /> : <Search size={20} />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Tabs Navigation */}
                <div
                    className="flex items-center gap-1 overflow-x-auto no-scrollbar py-2 mb-6 -mx-3 px-2 sticky z-[90] bg-[#F8FAFC]/95 backdrop-blur-sm border-b border-slate-100 md:static md:bg-transparent md:backdrop-none md:border-b-0 md:mx-0 md:py-1"
                    style={{ top: `${dynamicNavHeight + (typeof window !== "undefined" && window.innerWidth < 768 ? 76 : 0)}px` }}
                >
                    {mainTabs.map((tab) => {
                        const isOrderDisputed = (o: MasterOrder) =>
                            o.dispute_status === 'open' ||
                            o.status?.toLowerCase() === 'cancelled' ||
                            o.status?.toLowerCase() === 'canceled' ||
                            o.status?.toLowerCase() === 'disputed' ||
                            o.status?.toLowerCase() === 'refunded';

                        const count =
                            tab === "All Orders" ? orders.length :
                                tab === "Processing" ? orders.filter(o => ['processing', 'partially_processing', 'order_placed', 'paid', 'confirmed', 'shipped', 'picked_up', 'out_for_delivery', 'pending'].includes(o.status?.toLowerCase() || '')).length :
                                    tab === "Completed" ? orders.filter(o => ['delivered', 'completed', 'completed_with_cancellations', 'released'].includes(o.status?.toLowerCase() || '')).length :
                                        tab === "Cancelled" ? orders.filter(o => ['cancelled', 'refunded'].includes(o.status?.toLowerCase() || '')).length : 0;

                        return (
                            <button
                                key={tab}
                                ref={(el) => { if (el) tabRefs.current.set(tab, el); }}
                                onClick={() => handleTabClick(tab)}
                                className={`
                                    relative flex items-center gap-2 px-2 py-3 font-medium text-[15px] transition-all shrink-0
                                    ${activeTab === tab ? "text-rose-500" : "text-slate-400 hover:text-slate-600"}
                                `}
                            >
                                <span className="relative pb-1">
                                    {tab}
                                    {count > 0 && (
                                        <span className="ml-1 text-[11px] opacity-70">
                                            ({count})
                                        </span>
                                    )}
                                    {activeTab === tab && (
                                        <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-rose-500 rounded-full" />
                                    )}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 gap-8">
                        {[1, 2, 3, 4].map((i) => <OrderSkeleton key={i} />)}
                    </div>
                ) : (activeTab === "Pending Order" ? pendingOrders : filteredOrders).length === 0 ? (
                    <div className="bg-white rounded-lg p-16 flex flex-col items-center justify-center text-center  shadow-slate-200/50 border border-slate-100">
                        <img
                            src="/assets/images/cart.png"
                            alt="No orders"
                            className="w-30 h-30 object-contain animate-in zoom-in-95 duration-500"
                        />

                        <h3 className="text-sm text-slate-500 mb-2">
                            {searchQuery ? "No matching orders" : `No ${activeTab.toLowerCase()}s found`}
                        </h3>
                        {/* <p className="text-slate-500 max-w-xs mb-8 font-medium">
                            {searchQuery
                                ? "Try adjusting your search to find what you're looking for."
                                : activeTab === "Pending Order"
                                    ? "Items you started checking out but didn't finish will appear here."
                                    : `When you have orders in ${activeTab.toLowerCase()} state, they will appear here.`
                            }
                        </p> */}
                        {searchQuery && (
                            <button
                                onClick={() => { setSearchQuery(""); }}
                                className="px-8 py-3 bg-slate-900 text-white rounded-lg font-bold text-xs active:scale-95 transition"
                            >
                                Clear Search
                            </button>
                        )}
                    </div>
                ) : activeTab === "Pending Order" ? (
                    /* Render Pending Checkouts Grouped by Date */
                    <div className="space-y-10">
                        {(() => {
                            const groupedPending = pendingOrders.reduce((groups: Record<string, PendingCheckout[]>, p) => {
                                const group = getTimeGroup(p.created_at);
                                if (!groups[group]) groups[group] = [];
                                groups[group].push(p);
                                return groups;
                            }, {});

                            return groupOrder.map(groupName => {
                                const groupItems = groupedPending[groupName];
                                if (!groupItems || groupItems.length === 0) return null;

                                return (
                                    <div key={groupName} className="space-y-6">
                                        <div className="flex items-center gap-4 px-1">
                                            <span className="text-[10px] font-bold text-rose-500 tracking-[0.3em] whitespace-nowrap">{groupName}</span>
                                            <div className="h-px bg-rose-100 flex-1" />
                                        </div>

                                        <div className="space-y-6">
                                            {groupItems.map((pending) => (
                                                <div key={pending.reference} className="bg-white shadow-slate-200/50 border border-slate-100 overflow-hidden md:rounded-lg p-6">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                                            <span className="text-[10px] font-semibold text-slate-400">Checkout attempt</span>
                                                        </div>
                                                        <div className="text-[10px] font-bold text-slate-300 ml-auto">
                                                            {new Date(pending.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                    <div className="space-y-6">
                                                        {Object.entries(
                                                            pending.items.reduce((acc, item) => {
                                                                const bid = item.business_id || 0;
                                                                if (!acc[bid]) acc[bid] = [];
                                                                acc[bid].push(item);
                                                                return acc;
                                                            }, {} as Record<number, typeof pending.items>)
                                                        ).map(([bid, items], bIdx) => (
                                                            <div key={bid || bIdx} className="space-y-4">
                                                                <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center overflow-hidden">
                                                                            {items[0].business_logo || items[0].business_profile_pic ? (
                                                                                <img src={formatUrl(items[0].business_logo || items[0].business_profile_pic)} alt="" className="w-full h-full object-cover" />
                                                                            ) : (
                                                                                <div className="text-slate-200 font-bold text-lg">{items[0].business_name?.charAt(0)}</div>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex-1 overflow-hidden">
                                                                            <span className="text-[11px] font-semibold text-slate-600 block truncate max-w-[140px] md:max-w-none">{items[0].business_name}</span>
                                                                        </div>
                                                                    </div>
                                                                    {items[0].business_owner_id && (
                                                                        <button
                                                                            onClick={() => handleMessageVendor({
                                                                                business_owner_id: items[0].business_owner_id,
                                                                                sale_id: pending.reference as any,
                                                                                business_name: items[0].business_name
                                                                            } as any)}
                                                                            className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-lg text-[10px] transition hover:bg-rose-100 "
                                                                        >
                                                                            <MessageCircle size={14} />
                                                                            Chat Vendor
                                                                        </button>
                                                                    )}
                                                                </div>

                                                                <div className="space-y-5">
                                                                    {items.map((item, idx) => (
                                                                        <div key={item.title + idx} className="flex gap-4 items-center">
                                                                            <div className="w-16 h-16 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100 overflow-hidden ">
                                                                                {item.product_image ? (
                                                                                    <img src={formatUrl(item.product_image)} alt="" className="w-full h-full object-cover" />
                                                                                ) : (
                                                                                    <Package size={24} className="text-slate-200" />
                                                                                )}
                                                                            </div>
                                                                            <div className="flex-1">
                                                                                <h4 className="text-[12px]  text-slate-500 line-clamp-2 leading-snug">{item.title}</h4>
                                                                                {item.variant_info && (
                                                                                    <div className="flex items-center gap-1.5 mt-1.5">
                                                                                        <div className="w-1 h-1 rounded-full bg-rose-500/30" />
                                                                                        <p className="text-[10px] text-rose-500 font-bold tracking-wide ">{item.variant_info}</p>
                                                                                    </div>
                                                                                )}
                                                                                <p className="text-xs text-slate-400 mt-2 font-medium">Qty: <span className="text-slate-600 font-bold">{item.quantity}</span> • <span className="text-slate-800 font-bold">₦{Number(item.price || 0).toLocaleString()}</span></p>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
                                                        <div>
                                                            <p className="text-[9px] font-semibold text-slate-400">Total interested</p>
                                                            <p className="text-lg font-bold text-slate-900">₦{Number(pending.amount || 0).toLocaleString()}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => router.push('/checkout')}
                                                            className="px-6 py-2.5 bg-rose-500 text-white rounded-2xl font-bold text-[10px]   shadow-lg shadow-rose-500/20 active:scale-95 transition"
                                                        >
                                                            Continue to Pay
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                ) : (
                    <div className="space-y-10">
                        {groupOrder.map(groupName => {
                            const groupItems = groupedOrders[groupName];
                            if (!groupItems || groupItems.length === 0) return null;

                            return (
                                <div key={groupName} className="space-y-4">
                                    <div className="flex items-center gap-4 px-1">
                                        <span className="text-[10px] text-rose-500  tracking-[0.3em] whitespace-nowrap">{groupName}</span>
                                        <div className="h-px bg-rose-100 flex-1" />
                                    </div>

                                    <div className="space-y-6">
                                        {groupItems.map((master) => (
                                            <div key={`master-${master.order_id}`} className="bg-white border border-slate-200 rounded-[0.5rem] overflow-hidden ">
                                                {/* Master Order Header */}
                                                <div
                                                    onClick={() => toggleMaster(master.order_id, master.vendors.length === 1 && master.vendors[0]?.shipments.length === 1, master.vendors[0]?.sale_id)}
                                                    className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-100/60 transition group"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className={`p-1.5 rounded-lg border border-slate-200 text-slate-400 group-hover:text-rose-500 transition-colors ${expandedMasters[master.order_id] ? 'rotate-180 bg-rose-50 border-rose-100 text-rose-500' : 'bg-white'}`}>
                                                            <ChevronDown size={16} />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2.5 mb-0.5">
                                                                <h3 className="font-bold text-slate-800 text-sm md:text-base">
                                                                    Order <span className="text-slate-400">#{master.stoqle_order_id || master.order_id}</span>
                                                                </h3>
                                                                <span className={`text-[9px] px-2 py-0.5 rounded-full tracking-wider ${getStatusColor(master.status)}`}>
                                                                    {master.status === 'completed_with_cancellations' ? 'Completed (with cancellations)' : master.status?.replace(/_/g, ' ')}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                                                                <span>{formatOrderDate(master.created_at)}</span>
                                                                <span className="w-1 h-1 bg-slate-200 rounded-full" />
                                                                <span className="text-slate-500">{master.vendors.length} {master.vendors.length === 1 ? 'Vendor' : 'Vendors'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right md:text-right md:border-l md:border-slate-200 md:pl-6 ">
                                                        <p className="text-[9px] font-bold text-slate-400 tracking-widest mb-0.5">Order Total</p>
                                                        <p className="text-base md:text-lg font-black text-slate-900 leading-tight">₦{Number(master.total_amount).toLocaleString()}</p>
                                                    </div>
                                                </div>

                                                {/* Iterating Vendors within Master Order */}
                                                <div className={`divide-y divide-slate-100 transition-all duration-300 overflow-hidden ${expandedMasters[master.order_id] ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                                    {master.vendors.map((vendor) => (
                                                        <div key={`vendor-${vendor.sale_id || vendor.vendor_id}`} className="bg-white border-b border-slate-50 last:border-0">
                                                            {/* Vendor Header */}
                                                            <div
                                                                className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors"
                                                                onClick={(e) => toggleVendor(vendor.sale_id)}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`text-slate-300 transition-transform duration-300 ${expandedVendors[vendor.sale_id] ? 'rotate-180 text-slate-500' : ''}`}>
                                                                        <ChevronDown size={14} />
                                                                    </div>
                                                                    <div className="flex items-center gap-2.5">
                                                                        <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                                                                            {vendor.vendor_logo || vendor.profile_pic ? (
                                                                                <img src={formatUrl(vendor.vendor_logo || vendor.profile_pic)} alt="" className="w-full h-full object-cover" />
                                                                            ) : (
                                                                                <div className="text-slate-300 font-bold text-xs">{vendor.vendor_name?.charAt(0)}</div>
                                                                            )}
                                                                        </div>
                                                                        <div>
                                                                            <h4 className="font-bold text-slate-700 text-xs md:text-sm truncate max-w-[150px] md:max-w-none">
                                                                                {vendor.vendor_name}
                                                                            </h4>
                                                                            <p className="text-[9px] font-bold text-slate-400">Ref: <span className="text-slate-500 ">{vendor.reference_no}</span></p>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                                                                    <div className="text-right hidden sm:block">
                                                                        <p className="text-[8px] font-bold text-slate-400 tracking-tighter">Vendor Total</p>
                                                                        <p className="text-xs font-black text-slate-800">₦{Number(vendor.total).toLocaleString()}</p>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => handleMessageVendor(vendor)}
                                                                        disabled={messageLoading === vendor.sale_id}
                                                                        className="h-8 px-3 flex items-center justify-center gap-1.5 rounded-full bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition disabled:opacity-70 group/btn"
                                                                        title="Message Vendor"
                                                                    >
                                                                        {messageLoading === vendor.sale_id ? (
                                                                            <div className="w-3 h-3 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
                                                                        ) : (
                                                                            <>
                                                                                <MessageCircle size={14} className="text-slate-400 group-hover/btn:text-slate-600" />
                                                                                <span className="text-[10px] font-bold hidden md:inline">Chat</span>
                                                                            </>
                                                                        )}
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Vendor Shipments (Tightened Grouping) */}
                                                            <div className={`transition-all duration-300 overflow-hidden ${expandedVendors[vendor.sale_id] ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                                                <div className="pl-6 pr-4 pb-4 space-y-3 border-l-2 border-slate-100 ml-9 mt-1 mb-3">
                                                                    {/* Sort shipments by duration (lowest to highest) */}
                                                                    {[...vendor.shipments]
                                                                        .sort((a, b) => {
                                                                            const extractNum = (s: string | null | undefined) => {
                                                                                if (!s) return Infinity;
                                                                                const match = s.match(/\d+/);
                                                                                return match ? parseInt(match[0]) : Infinity;
                                                                            };
                                                                            return extractNum(a.shipping_promise) - extractNum(b.shipping_promise);
                                                                        })
                                                                        .map((ship, sIdx, sortedArr) => {
                                                                            const statuses = sortedArr.map(s => s.status?.toLowerCase());
                                                                            const isPartial = statuses.some(s => ['cancelled', 'refunded', 'canceled'].includes(s || '')) && statuses.some(s => !['cancelled', 'refunded', 'canceled'].includes(s || ''));
                                                                            const isAllCancelled = sortedArr.length > 0 && statuses.every(s => ['cancelled', 'refunded', 'canceled'].includes(s || ''));

                                                                            return (
                                                                                <div key={`shipment-${ship.shipment_id || sIdx}`} className="space-y-2">
                                                                                    {/* Shipment Divider (Sorted Index) */}
                                                                                    {sortedArr.length > 1 && (
                                                                                        <div className="flex items-center gap-3 px-1.5 py-1">
                                                                                            <div className="h-px flex-1 bg-slate-100"></div>
                                                                                            <span className="text-[9px] font-black text-slate-400 tracking-[0.2em] whitespace-nowrap">Shipment {sIdx + 1}</span>
                                                                                            <div className="h-px flex-1 bg-slate-100"></div>
                                                                                        </div>
                                                                                    )}
                                                                                    {/* Shipment Mini Header */}
                                                                                    <div className="px-4 py-1.5 flex items-center justify-between">
                                                                                        {/* Shipment status relocated to item row */}
                                                                                    </div>

                                                                                    {/* Shipment Items */}
                                                                                    <div className=" ">
                                                                                        {(ship.status === 'cancelled' || ship.status === 'refunded') && ship.ship_cancel_reason && (
                                                                                            <div className="px-3 py-2 bg-rose-50 text-rose-700 border border-rose-100 rounded-[0.5rem">
                                                                                                <div className="flex items-center gap-1.5 font-bold text-[10px]">
                                                                                                    <AlertTriangle size={12} /> {ship.ship_cancel_reason.replace(/_/g, ' ')}
                                                                                                </div>
                                                                                            </div>
                                                                                        )}

                                                                                        <div className="divide-y divide-slate-50">
                                                                                            {ship.items.map((item, iIdx) => (
                                                                                                <div key={`item-${item.order_id || iIdx}`} className="flex gap-3 md:gap-4 items-start py-2.5 group/item first:pt-0 last:pb-0">
                                                                                                    <div
                                                                                                        className="w-12 h-12 md:w-14 md:h-14 bg-slate-50 rounded-lg overflow-hidden border border-slate-100 shrink-0 cursor-zoom-in active:opacity-75 transition-opacity"
                                                                                                        onClick={() => {
                                                                                                            if (item.product_image) {
                                                                                                                setLightboxSlides([{ src: formatUrl(item.product_image) }]);
                                                                                                                setLightboxIndex(0);
                                                                                                                setLightboxOpen(true);
                                                                                                            }
                                                                                                        }}
                                                                                                    >
                                                                                                        {item.product_image ? (
                                                                                                            <img src={formatUrl(item.product_image)} alt={item.product_name} className="w-full h-full object-cover" />
                                                                                                        ) : (
                                                                                                            <div className="w-full h-full flex items-center justify-center text-slate-300"><Package size={16} /></div>
                                                                                                        )}
                                                                                                    </div>
                                                                                                    <div className="flex-1 min-w-0">
                                                                                                        <div className="flex items-center justify-between gap-2">
                                                                                                            <h4 className="text-slate-700 text-[11px] md:text-xs font-bold leading-tight line-clamp-1 flex-1">{item.product_name}</h4>
                                                                                                            {(ship.status === 'delivered' || ship.status === 'cancelled') && (
                                                                                                                <button
                                                                                                                    onClick={() => handleBuyAgain(item)}
                                                                                                                    className="text-[9px] font-bold text-blue-600 hover:text-blue-700 transition shrink-0"
                                                                                                                >
                                                                                                                    Buy again
                                                                                                                </button>
                                                                                                            )}
                                                                                                        </div>
                                                                                                        <div className="flex items-center gap-2 mt-0.5">
                                                                                                            <p className="text-[11px] font-black text-slate-900">₦{(item.unit_price * item.quantity).toLocaleString()}</p>
                                                                                                            <span className="text-[9px] font-bold text-slate-400">Qty: {item.quantity}</span>
                                                                                                        </div>
                                                                                                        {item.variant_info && (
                                                                                                            <div className="mt-1 text-[8px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded w-fit border border-slate-100 leading-none">{item.variant_info}</div>
                                                                                                        )}
                                                                                                    </div>
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>

                                                                                    <div className=" mb-1 px-2 py-1 bg-slate-50 rounded-[0.5rem] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3  border border-slate-200/50">
                                                                                        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2.5">

                                                                                            {(() => {
                                                                                                const calculateDate = (base: string | undefined, duration?: number | string | null, unit?: string | null) => {
                                                                                                    if (!base || duration === undefined || duration === null || duration === '') return null;
                                                                                                    const date = new Date(base as string);
                                                                                                    const dNum = typeof duration === 'string' ? (duration.match(/\d+/)?.[0] ? parseInt(duration.match(/\d+/)![0]) : 0) : duration;

                                                                                                    let unitLower = (unit || '').toLowerCase();
                                                                                                    // Fallback: detect unit from duration string if unit is missing
                                                                                                    if (!unit && typeof duration === 'string') {
                                                                                                        if (duration.toLowerCase().includes('week')) unitLower = 'weeks';
                                                                                                        else if (duration.toLowerCase().includes('hour')) unitLower = 'hours';
                                                                                                        else if (duration.toLowerCase().includes('minute')) unitLower = 'minutes';
                                                                                                    }

                                                                                                    if (unitLower.includes('week')) {
                                                                                                        date.setDate(date.getDate() + (dNum * 7));
                                                                                                    } else if (unitLower.includes('hour')) {
                                                                                                        date.setHours(date.getHours() + dNum);
                                                                                                    } else if (unitLower.includes('minute')) {
                                                                                                        date.setMinutes(date.getMinutes() + dNum);
                                                                                                    } else {
                                                                                                        // default to days
                                                                                                        date.setDate(date.getDate() + dNum);
                                                                                                    }

                                                                                                    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
                                                                                                };

                                                                                                const policy = ship.items[0]?.snapshot_data?.shippingPolicy;
                                                                                                const avgDate = calculateDate(master.created_at, policy?.avgDuration ?? ship.items[0]?.snapshot_data?.policies?.shipping?.avg, policy?.avgUnit);
                                                                                                const promiseDate = calculateDate(master.created_at, policy?.promiseDuration ?? ship.shipping_promise, policy?.promiseUnit);

                                                                                                return (
                                                                                                    <>

                                                                                                        {ship.status !== 'delivered' && ship.status !== 'cancelled' && (avgDate || ship.items[0]?.snapshot_data?.policies?.shipping?.transit_time_hrs || promiseDate) && (

                                                                                                            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar whitespace-nowrap">

                                                                                                                <span className="text-[9px] font-black text-slate-500 bg-white/50 px-1.5 py-0.5 rounded border border-slate-300 whitespace-nowrap">
                                                                                                                    Delivery Info
                                                                                                                </span>

                                                                                                                {avgDate && (
                                                                                                                    <div className="text-[9px] font-bold text-slate-600  items-center gap-1.5">
                                                                                                                        <span>
                                                                                                                            Expected ship: {avgDate}
                                                                                                                            {ship.items[0]?.snapshot_data?.policies?.shipping?.distance_km && (
                                                                                                                                <> and transit in {Math.round(ship.items[0]?.snapshot_data?.policies?.shipping?.distance_km * 5)} mins</>
                                                                                                                            )}
                                                                                                                        </span>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                                {ship.items[0]?.snapshot_data?.policies?.shipping?.transit_time_hrs && (
                                                                                                                    <div className="text-[8px] font-bold text-blue-700 bg-blue-100/50 px-1.5 py-0.5 rounded border border-blue-200/50 flex items-center gap-1">
                                                                                                                        <Truck size={8} />
                                                                                                                        <span>Ride: {ship.items[0]?.snapshot_data?.policies?.shipping?.transit_time_hrs}</span>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                                {promiseDate && (
                                                                                                                    <div className="flex items-center gap-2 border-l border-slate-300 pl-2 ml-0.5">
                                                                                                                        <div className="text-[8px] font-bold text-amber-700 bg-amber-100/50 px-1.5 py-0.5 rounded border border-amber-200/50 flex items-center gap-1 whitespace-nowrap">
                                                                                                                            <Clock size={8} />
                                                                                                                            <span>Promise by: {promiseDate}</span>
                                                                                                                        </div>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                            </div>
                                                                                                        )}
                                                                                                    </>
                                                                                                );
                                                                                            })()}
                                                                                        </div>

                                                                                        <div className="flex items-center justify-end gap-2 w-full flex-wrap">
                                                                                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold  tracking-wider ${getStatusColor(ship.status)}`}>
                                                                                                {ship.status?.replace(/_/g, ' ')}
                                                                                            </span>
                                                                                            {['out_for_delivery', 'pending_admin_review'].includes(ship.status?.toLowerCase() || '') && !['disputed', 'held'].includes(ship.escrow_status || '') && (
                                                                                                <button
                                                                                                    onClick={() => {
                                                                                                        setSelectedDeliveryCode(ship.delivery_code || null);
                                                                                                        setSelectedDeliveryOrderRef(vendor.reference_no);
                                                                                                        setIsDeliveryCodeModalOpen(true);
                                                                                                    }}
                                                                                                    className="h-7 px-3 bg-amber-100 border border-amber-200 text-amber-700 rounded-lg font-bold text-[9px] hover:bg-amber-200 transition whitespace-nowrap flex items-center justify-center"
                                                                                                >
                                                                                                    My Delivery Code
                                                                                                </button>
                                                                                            )}
                                                                                            {['order_placed', 'pending', 'processing', 'confirmed', 'ready_for_shipping', 'out_for_delivery', 'delivered', 'pending_admin_review'].includes(ship.status?.toLowerCase() || '') && (
                                                                                                <button
                                                                                                    onClick={() => handleTrackOrder(ship.items[0]?.order_id)}
                                                                                                    className="h-7 px-3 bg-slate-900 text-white rounded-lg font-bold text-[9px] active:scale-95 transition whitespace-nowrap flex-shrink-0"
                                                                                                >
                                                                                                    Track
                                                                                                </button>
                                                                                            )}

                                                                                            {ship.status?.toLowerCase() === 'out_for_delivery' && !['disputed', 'held'].includes(ship.escrow_status || '') && ship.escrow_status !== 'released' && (
                                                                                                <button
                                                                                                    onClick={() => handleConfirmReceipt(Number(ship.escrow_id), vendor.sale_id, ship.shipment_id)}
                                                                                                    className="h-7 px-3 bg-green-100 text-green-700 border border-green-200 rounded-lg font-bold text-[9px] hover:bg-green-200 transition whitespace-nowrap flex-shrink-0"
                                                                                                >
                                                                                                    Confirm Received
                                                                                                </button>
                                                                                            )}

                                                                                            {ship.shipment_id && ship.shipment_id !== 'standard' && ['order_placed', 'pending'].includes(ship.status?.toLowerCase()) && (
                                                                                                <button
                                                                                                    onClick={() => handleCancelOrder(master, vendor, ship)}
                                                                                                    disabled={isActionLoading === vendor.sale_id}
                                                                                                    className="h-7 px-3 bg-white border border-rose-200 text-rose-600 rounded-lg font-bold text-[9px] hover:bg-rose-50 transition whitespace-nowrap flex items-center justify-center min-w-[60px]"
                                                                                                >
                                                                                                    {isActionLoading === vendor.sale_id ? (
                                                                                                        <div className="w-3 h-3 border-2 border-slate-300 border-t-rose-600 rounded-full animate-spin" />
                                                                                                    ) : (
                                                                                                        'Cancel'
                                                                                                    )}
                                                                                                </button>
                                                                                            )}

                                                                                            {ship.status?.toLowerCase() === 'out_for_delivery' && (
                                                                                                ['disputed', 'held'].includes(ship.escrow_status || '') ? (
                                                                                                    <button
                                                                                                        onClick={() => handleViewDispute(ship)}
                                                                                                        className="h-7 px-3 bg-rose-50 text-rose-600 border border-rose-100 rounded-lg font-bold text-[9px] flex items-center gap-1.5 self-center hover:bg-rose-100 transition active:scale-95"
                                                                                                    >
                                                                                                        <AlertTriangle size={10} />
                                                                                                        <span>Disputed</span>
                                                                                                    </button>
                                                                                                ) : (
                                                                                                    <button
                                                                                                        onClick={() => handleReportProblem(Number(ship.escrow_id), vendor, ship)}
                                                                                                        className="h-7 px-3 bg-white border border-rose-200 text-rose-600 rounded-lg font-bold text-[9px] hover:bg-rose-50 transition whitespace-nowrap flex-shrink-0 flex items-center gap-1.5 shadow-sm"
                                                                                                    >
                                                                                                        <span>Report</span>
                                                                                                        <Info size={10} />
                                                                                                    </button>
                                                                                                )
                                                                                            )}

                                                                                            {ship.status === 'delivered' && ship.shipment_id !== 'standard' && (
                                                                                                <>
                                                                                                    {!ship.reviewed && (
                                                                                                        <button
                                                                                                            onClick={() => handleOpenReview(vendor, ship)}
                                                                                                            className="h-7 px-3 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg font-bold text-[9px] hover:bg-amber-100 transition whitespace-nowrap flex items-center gap-1"
                                                                                                        >
                                                                                                            <span>Review</span>
                                                                                                            <Star size={10} />
                                                                                                        </button>
                                                                                                    )}

                                                                                                    {['disputed', 'held'].includes(ship.escrow_status || '') ? (
                                                                                                        <button
                                                                                                            onClick={() => handleViewDispute(ship)}
                                                                                                            className="text-[9px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 flex items-center gap-1.5 self-center hover:bg-rose-100 transition active:scale-95"
                                                                                                        >
                                                                                                            <AlertTriangle size={10} />
                                                                                                            <span>Disputed</span>
                                                                                                        </button>
                                                                                                    ) : (
                                                                                                        (() => {
                                                                                                            const refundInfo = isRefundable(ship.items[0], ship.delivered_at);
                                                                                                            if (refundInfo.canRefund) {
                                                                                                                return (
                                                                                                                    <button
                                                                                                                        onClick={() => handleReportProblem(Number(ship.escrow_id), vendor, ship)}
                                                                                                                        className="h-7 px-3 bg-white border border-rose-200 text-rose-600 rounded-lg font-bold text-[9px] hover:bg-rose-50 transition whitespace-nowrap flex-shrink-0 flex items-center gap-1.5 shadow-sm"
                                                                                                                        title={`Refund window: ${refundInfo.daysLeft} days left`}
                                                                                                                    >
                                                                                                                        <span>Return/Refund</span>
                                                                                                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                                                                                                    </button>
                                                                                                                );
                                                                                                            }
                                                                                                            return null;
                                                                                                        })()
                                                                                                    )}
                                                                                                </>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Review Modal */}
            {isReviewModalOpen && selectedOrderForReview && (
                <div className="fixed inset-0 z-[99999999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-[0.5rem]  overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 leading-tight">Review Your Order</h3>
                                <p className="text-[10px] font-bold text-slate-400   mt-1">Order #{selectedOrderForReview!.sale_id}</p>
                            </div>
                            <button onClick={() => setIsReviewModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-full transition">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="flex flex-col items-center gap-4">
                                <p className="text-xs font-bold text-slate-500  ">Rate the vendor</p>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            onClick={() => setReviewRating(star)}
                                            className="hover:scale-125 transition"
                                        >
                                            <Star
                                                size={32}
                                                className={star <= reviewRating ? "text-amber-400 fill-amber-400" : "text-slate-200"}
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-slate-400   ml-1">Write a Review</label>
                                <textarea
                                    value={reviewComment}
                                    onChange={(e) => setReviewComment(e.target.value)}
                                    placeholder="Tell others about your experience..."
                                    className="w-full min-h-[120px] bg-slate-100 border border-slate-200 rounded-[0.5rem] p-5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition resize-none"
                                />
                            </div>

                            <button
                                onClick={submitReview}
                                disabled={isActionLoading === selectedOrderForReview!.sale_id}
                                className="w-full py-2 bg-rose-500 text-white rounded-full hover:scale-[1.02] active:scale-95 transition disabled:opacity-50"
                            >
                                {isActionLoading === selectedOrderForReview!.sale_id ? 'Wait...' : 'Submit Review'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Report / Dispute / Return Modal */}
            {isReportModalOpen && selectedOrderForReport && (
                <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full sm:max-w-lg rounded-t-[0.5rem] sm:rounded-[0.5rem] overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 flex flex-col max-h-[95vh]">
                        <div className="p-4 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="text-md font-black text-slate-900  text-center">
                                    {selectedOrderForReport.status === 'delivered' ? 'Return & Refund Request' : 'Report Delivery Problem'}
                                </h3>
                                <p className="text-[10px] font-bold text-rose-500 tracking-widest  mt-1">Dispute for Order #{selectedOrderForReport!.sale_id}</p>
                            </div>
                            <button onClick={() => { setIsReportModalOpen(false); setAgreedToPolicy(false); }} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-all hover:bg-rose-500 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                            <div className="bg-rose-50/50 border border-rose-100/50 p-6 rounded-[0.5rem] space-y-3">
                                <div className="flex items-center gap-3 text-rose-600">
                                    <AlertTriangle size={20} className="shrink-0" />
                                    <h4 className="font-black text-[10px]  tracking-widest ">Important Note</h4>
                                </div>
                                <p className="text-[11px] text-rose-800/70 font-bold leading-relaxed">
                                    This request will be reviewed by administrators. Payment will remain on hold until resolved.
                                </p>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-400 ml-1">Select Reason</label>
                                    <div className="space-y-2">
                                        {(selectedOrderForReport.status === 'delivered' ? RETURN_REASONS : REPORT_REASONS).map((r) => (
                                            <div
                                                key={r}
                                                onClick={() => setReportReason(r)}
                                                className={`flex items-center justify-between p-4 rounded-[0.5rem] border transition-all cursor-pointer group ${reportReason === r ? 'bg-white border-rose-200 shadow-sm' : 'bg-white/50 border-slate-100 hover:border-slate-200'}`}
                                            >
                                                <span className={`text-[13px] font-bold ${reportReason === r ? 'text-slate-900 font-black' : 'text-slate-400'}`}>{r}</span>
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${reportReason === r ? "bg-rose-500 border-rose-500 shadow-lg shadow-rose-200" : "bg-white border-slate-200"}`}>
                                                    {reportReason === r && <CheckCircle2 size={10} className="text-white stroke-[3] animate-in zoom-in duration-200" />}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {reportReason.includes("Other") && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <label className="text-[10px] font-black text-slate-400  tracking-widest ml-1">Additional Explanation</label>
                                        <textarea
                                            value={reportExplanation}
                                            onChange={(e) => setReportExplanation(e.target.value)}
                                            placeholder="Provide more details for management review..."
                                            className="w-full min-h-[140px] bg-slate-50 border border-slate-100 rounded-2xl p-5 text-sm font-bold text-slate-600 focus:outline-none focus:ring-4 focus:ring-rose-500/5 focus:border-rose-400/50 transition-all resize-none"
                                        />
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-400  tracking-widest ml-1">Media Proof (Min 1 Image)</label>
                                    <div className="grid grid-cols-4 gap-3">
                                        {reportImages.map((img, idx) => (
                                            <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200 shadow-sm animate-in zoom-in-90">
                                                <img src={img.preview} className="w-full h-full object-cover" />
                                                <button
                                                    onClick={() => removeImage(idx)}
                                                    className="absolute top-1.5 right-1.5 bg-white/90 p-1.5 rounded-full shadow-lg hover:bg-rose-500 hover:text-white transition-all text-slate-500"
                                                >
                                                    <X size={10} />
                                                </button>
                                            </div>
                                        ))}
                                        {reportImages.length < 5 && (
                                            <div className="relative aspect-square group">
                                                <input
                                                    type="file"
                                                    multiple
                                                    accept="image/*"
                                                    onChange={handleImageSelection}
                                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                                />
                                                <div className={`w-full h-full border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-1 group-hover:bg-slate-50 group-hover:border-rose-300 transition-all ${isUploadingProof ? 'animate-pulse' : 'bg-slate-50/50'}`}>
                                                    <Camera size={20} className="text-slate-300 group-hover:text-rose-400 transition-colors" />
                                                    <span className="text-[10px] font-black text-slate-400 tracking-tighter">Add Photo</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-bold italic ml-1">Evidence images help speed up reviews.</p>
                                </div>

                                {/* Policy Agreement */}
                                <div className="flex items-start gap-4 p-5 bg-rose-50 border border-rose-100 rounded-3xl mx-1 animate-in fade-in slide-in-from-bottom duration-500">
                                    <div
                                        onClick={() => setAgreedToPolicy(!agreedToPolicy)}
                                        className={`w-6 h-6 rounded-lg border-2 shrink-0 flex items-center justify-center cursor-pointer transition-all duration-300 ${agreedToPolicy ? 'bg-rose-600 border-rose-600 shadow-lg shadow-rose-200' : 'bg-white border-slate-200'}`}
                                    >
                                        {agreedToPolicy && <CheckCircle2 size={12} className="text-white stroke-[3] animate-in zoom-in duration-200" />}
                                    </div>
                                    <p className="text-[12px] text-slate-600 font-bold leading-relaxed">
                                        I have read and agree to the <button onClick={(e) => { e.stopPropagation(); setIsReturnPolicyModalOpen(true); }} className="text-rose-600 underline hover:text-rose-700 decoration-rose-300 decoration-2 underline-offset-4">Returning & Dispute Policy</button> of Stoqle and the Vendor.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 border-t border-slate-50 bg-white shrink-0">
                            <button
                                disabled={isActionLoading === selectedOrderForReport!.sale_id || !reportReason || (reportReason.includes("Other") && !reportExplanation) || reportImages.length === 0 || !agreedToPolicy}
                                onClick={submitReport}
                                className="w-full py-4 bg-rose-600 text-white rounded-full text-xs font-black  tracking-widest shadow-2xl shadow-rose-200 active:scale-[0.98] disabled:opacity-30 disabled:active:scale-100 transition-all flex items-center justify-center gap-2"
                            >
                                {isActionLoading === selectedOrderForReport!.sale_id ? (
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                        <span>{isUploadingProof ? "Uploading Proof..." : "Submitting..."}</span>
                                    </div>
                                ) : (
                                    <>
                                        <Send size={16} />
                                        <span>Submit Request</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Review Comment Modal (Details) */}
            {activeCommentSaleId && selectedOrderForReview && (
                <div className="fixed inset-0 z-[99999999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-sm rounded-[0.5rem]  overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 leading-tight">Your Review</h3>
                                <p className="text-[10px] font-bold text-slate-400   mt-1">Vendor: {selectedOrderForReview!.vendor_name}</p>
                            </div>
                            <button onClick={() => setActiveCommentSaleId(null)} className="p-2 hover:bg-slate-50 rounded-full transition">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="flex flex-col items-center gap-4">
                                <div className="flex gap-1">
                                    {[...Array(5)].map((_, i) => (
                                        <Star
                                            key={i}
                                            size={24}
                                            fill={i < (selectedOrderForReview!.review_rating || 0) ? "#F59E0B" : "none"}
                                            className={i < (selectedOrderForReview!.review_rating || 0) ? "text-amber-500" : "text-slate-200"}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                <p className="text-sm font-medium text-slate-600 leading-relaxed italic">
                                    "{selectedOrderForReview!.review_comment || "No comment provided."}"
                                </p>
                            </div>
                            <button
                                onClick={() => setActiveCommentSaleId(null)}
                                className="w-full py-2 bg-slate-500 text-white rounded-full font-bold text-xs   active:scale-95 transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Full Screen Modal */}
            {selectedImageUrl && (
                <div
                    className="fixed inset-0 z-[99999999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300"
                    onClick={() => setSelectedImageUrl(null)}
                >
                    <button
                        onClick={() => setSelectedImageUrl(null)}
                        className="absolute top-8 right-8 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-[210]"
                    >
                        <X size={24} />
                    </button>
                    <div className="relative w-full max-w-4xl max-h-[90vh] flex items-center justify-center animate-in zoom-in-95 duration-300">
                        <img
                            src={selectedImageUrl}
                            alt="Full screen product"
                            className="max-w-full max-h-full object-contain rounded-[0.5rem]"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}

            {/* Tracking History Modal */}
            {isTrackingModalOpen && trackingOrderId && (
                <div className="fixed inset-0 z-[99999999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-[0.5rem] overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh]">
                        <div className="p-6 border-b border-slate-50 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 leading-tight">Tracking History</h3>
                                <p className="text-[10px] font-bold text-slate-400 mt-1">Order #{trackingOrderId}</p>
                            </div>
                            <button onClick={() => setIsTrackingModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-full transition">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
                            {trackingLoading ? (
                                <div className="flex flex-col items-center justify-center py-10 gap-3">
                                    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div>
                                    <p className="text-xs font-bold text-slate-500">Loading history...</p>
                                </div>
                            ) : trackingHistory.length > 0 ? (
                                (() => {
                                    const steps: any[] = [];
                                    trackingHistory.forEach((item, index) => {
                                        const isCurrent = index === trackingHistory.length - 1;
                                        steps.push({
                                            id: `hist-${index}`,
                                            isCompleted: !isCurrent || ['delivered', 'cancelled', 'refunded'].includes(item.status),
                                            isCurrent: isCurrent && !['delivered', 'cancelled', 'refunded'].includes(item.status),
                                            isPending: false,
                                            status: item.status,
                                            label: item.status?.replace(/_/g, ' '),
                                            message: item.message || `Shipment status updated to ${item.status?.replace(/_/g, ' ')}`,
                                            date: item.created_at
                                        });
                                    });

                                    const lastEvent = trackingHistory[trackingHistory.length - 1];
                                    const sequence = ['order_placed', 'confirmed', 'ready_for_shipping', 'out_for_delivery', 'delivered'];
                                    const isCancelled = ['cancelled', 'refunded', 'disputed'].includes(lastEvent.status);

                                    if (!isCancelled && lastEvent.status !== 'delivered') {
                                        let lastSeqIdx = -1;
                                        for (let i = sequence.length - 1; i >= 0; i--) {
                                            if (trackingHistory.some(h => h.status === sequence[i])) {
                                                lastSeqIdx = i;
                                                break;
                                            }
                                        }
                                        if (lastSeqIdx !== -1) {
                                            for (let i = lastSeqIdx + 1; i < sequence.length; i++) {
                                                steps.push({
                                                    id: `seq-${sequence[i]}`,
                                                    isCompleted: false,
                                                    isCurrent: false,
                                                    isPending: true,
                                                    status: sequence[i],
                                                    label: sequence[i].replace(/_/g, ' '),
                                                    message: sequence[i] === 'delivered' ? 'Waiting for delivery confirmation.' : 'Pending update...',
                                                    date: null
                                                });
                                            }
                                        }
                                    }

                                    return (
                                        <div className="mt-2">
                                            {steps.map((step, index) => {
                                                const isLast = index === steps.length - 1;
                                                return (
                                                    <div key={step.id} className="relative flex gap-4 pb-8 last:pb-2">
                                                        {/* Timeline Line */}
                                                        {!isLast && (
                                                            <div className={`absolute left-[11px] top-6 bottom-[-24px] w-[2px] ${step.isCompleted || step.isCurrent ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>
                                                        )}

                                                        {/* Status Indicator Icon */}
                                                        <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 mt-0.5 ${step.isCompleted ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' :
                                                            step.isCurrent ? 'bg-white border-emerald-500 text-emerald-500 shadow-sm' :
                                                                'bg-slate-50 border-slate-200 text-transparent'
                                                            }`}>
                                                            {step.isCompleted && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                                            {step.isCurrent && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                                                        </div>

                                                        <div className="flex-1 -mt-1">
                                                            <h4 className={`text-[13px] font-bold  tracking-widest ${step.isCompleted || step.isCurrent ? 'text-slate-900' : 'text-slate-400'
                                                                }`}>
                                                                {step.label}
                                                            </h4>
                                                            <p className={`text-[11px] font-medium mt-1.5 leading-relaxed bg-white p-3 rounded-xl border ${step.isCompleted || step.isCurrent ? 'text-slate-600 border-slate-100 shadow-sm' : 'text-slate-400 border-slate-50/50 opacity-60'
                                                                }`}>
                                                                {step.message}
                                                            </p>
                                                            {step.date && (
                                                                <p className="text-[10px] font-bold text-slate-400 mt-2 flex items-center gap-1.5">
                                                                    <Clock size={12} />
                                                                    {formatOrderDate(step.date)}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()
                            ) : (
                                <div className="text-center py-10">
                                    <Package size={40} className="mx-auto text-slate-300 mb-3" />
                                    <p className="text-sm font-bold text-slate-500">No tracking history available yet.</p>
                                </div>
                            )}
                        </div>
                        <div className="p-6 border-t border-slate-50 bg-white shrink-0">
                            {trackingHistory.length > 0 && trackingHistory[trackingHistory.length - 1]?.status === 'out_for_delivery' && (
                                <button
                                    onClick={() => {
                                        setIsTrackingModalOpen(false);
                                        router.push(`/profile/orders/track/${trackingOrderId}`);
                                    }}
                                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-[11px] mb-3 active:scale-95 transition"
                                >
                                    Track Live Map
                                </button>
                            )}
                            <button
                                onClick={() => setIsTrackingModalOpen(false)}
                                className="w-full py-4 bg-slate-100 text-slate-700 rounded-2xl font-bold text-[11px] active:scale-95 transition hover:bg-slate-200"
                            >
                                Close History
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Secure Delivery Code Modal */}
            {isDeliveryCodeModalOpen && (
                <div className="fixed inset-0 z-[99999999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-sm rounded-[0.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 relative">
                        <button onClick={() => setIsDeliveryCodeModalOpen(false)} className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-50 rounded-full transition-colors z-10">
                            <X size={20} />
                        </button>

                        <div className="p-8 text-center flex flex-col items-center">
                            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-6">
                                <AlertTriangle size={28} className="text-amber-500" strokeWidth={2.5} />
                            </div>

                            <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">Secure Delivery Code</h3>
                            <p className="text-xs font-medium text-slate-500 leading-relaxed mb-6">
                                Reference: <strong className="text-slate-800 ">{selectedDeliveryOrderRef}</strong>
                            </p>

                            <div className="bg-slate-50 border-2 border-slate-100 rounded-xl p-6 w-full mb-6 cursor-pointer"
                                onClick={() => {
                                    copyToClipboard(selectedDeliveryCode || 'N/A');
                                    toast.success('Code copied to clipboard!');
                                }}
                            >
                                <span className="text-4xl font-black text-slate-800 tracking-[0.4em]">{selectedDeliveryCode || 'N/A'}</span>
                                <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-400">
                                    <Copy size={12} /> Tap to copy
                                </div>
                            </div>

                            <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl text-left flex gap-3 text-rose-700 w-full mb-2">
                                <XCircle size={16} className="shrink-0 mt-0.5" />
                                <div className="text-[10px] font-bold leading-relaxed">
                                    <span className=" tracking-widest text-rose-800 font-black text-[9px] mb-1 block">Critical Warning</span>
                                    Do <strong>NOT</strong> disclose this 4-digit code to the vendor or rider until you have successfully received AND inspected your complete order in good condition. Handing over this code confirms delivery and authorizes payment!
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <SevenDayReturnModal
                open={isReturnPolicyModalOpen}
                onClose={() => setIsReturnPolicyModalOpen(false)}
            />

            {previewProductModalOpen && (
                <ProductPreviewModal
                    open={previewProductModalOpen}
                    payload={selectedProductPayload}
                    onClose={() => {
                        setPreviewProductModalOpen(false);
                        setSelectedProductPayload(null);
                    }}
                    onShopClick={() => {
                        const slug = selectedProductPayload?.business_slug || selectedProductPayload?.vendor?.id;
                        if (slug) {
                            setPreviewProductModalOpen(false);
                            router.push(`/shop/${slug}`);
                        }
                    }}
                    onProductClick={handleProductClick}
                    isFetching={isPreviewFetching}
                />
            )}

            <Lightbox
                open={lightboxOpen}
                close={() => setLightboxOpen(false)}
                index={lightboxIndex}
                slides={lightboxSlides}
                controller={{ closeOnBackdropClick: true, closeOnPullDown: true }}
                styles={{
                    root: { zIndex: 999999 },
                    container: { backgroundColor: "rgba(0,0,0,0.9)" }
                }}
            />
        </div>
    );
};
