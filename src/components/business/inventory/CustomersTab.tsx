import { X, Search, Mail, Filter, CheckCircle2, Package, Users, Star, Loader2, MessageCircle, Crown, Repeat } from "lucide-react";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL } from "@/src/lib/config";
import { useRouter } from "next/navigation";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import Swal from "sweetalert2";
import CategorySelectionModal from "../../input/default-select";

function LikeBurst() {
    const particles = Array.from({ length: 8 });
    const colors = ["#EF4444", "#F43F5E", "#FB7185", "#FDA4AF"];
    return (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-[101]">
            {particles.map((_, i) => (
                <motion.div
                    key={i}
                    initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
                    animate={{
                        x: Math.cos((i * 45) * Math.PI / 180) * 45,
                        y: Math.sin((i * 45) * Math.PI / 180) * 45,
                        scale: [0.2, 1.2, 0],
                        opacity: [1, 1, 0],
                        rotate: [0, 45, 90]
                    }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="absolute"
                >
                    <FaHeart size={8} style={{ color: colors[i % colors.length] }} />
                </motion.div>
            ))}
        </div>
    );
}

export default function CustomersTab() {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [selectedCustomers, setSelectedCustomers] = useState<Set<number>>(new Set());
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailTemplate, setEmailTemplate] = useState("greeting");

    const [customers, setCustomers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [reviewModalOpen, setReviewModalOpen] = useState(false);
    const [targetCustomer, setTargetCustomer] = useState<any>(null);
    const [customerReviews, setCustomerReviews] = useState<any[]>([]);
    const [loadingReviews, setLoadingReviews] = useState(false);
    const [burstingReviewId, setBurstingReviewId] = useState<number | null>(null);

    const [emailMessage, setEmailMessage] = useState("");
    const [sendingEmail, setSendingEmail] = useState(false);

    useEffect(() => {
        if (emailTemplate === 'discount') {
            setEmailMessage("Hi there,\n\nAs a valued customer, we wanted to offer you an exclusive 20% discount on your next purchase! Use code VIP20 at checkout.\n\nBest,\nThe Team");
        } else if (emailTemplate === 'holiday') {
            setEmailMessage("Warm holiday wishes to you!\n\nWe hope you're having a wonderful season. As a token of our appreciation, check out our latest festive arrivals.\n\nHappy Holidays!");
        } else if (emailTemplate === 'Happy Weekend') {
            setEmailMessage("Happy Weekend!\n\nWe hope you're having a restful break. Since it's the weekend, why not treat yourself to something special from our collection?\n\nEnjoy!");
        } else if (emailTemplate === 'Friday Special') {
            setEmailMessage("TGIF!\n\nIt's Friday, and we're kicking off the weekend with some special highlights. Check out what's new in store today!\n\nHappy Friday!");
        } else if (emailTemplate === 'New Month') {
            setEmailMessage("Happy New Month!\n\nIt's a brand new month, a perfect time for fresh starts and new favorites. Here's to a productive and stylish month ahead!\n\nBest Wishes!");
        } else {
            setEmailMessage("Just checking in to see how you are enjoying your recent purchases! We'd love to hear your feedback.");
        }
    }, [emailTemplate]);

    useEffect(() => {
        if (showEmailModal || reviewModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [showEmailModal, reviewModalOpen]);

    useEffect(() => {
        const fetchCustomers = async () => {
            try {
                const token = localStorage.getItem("token");
                const res = await fetch(`${API_BASE_URL}/api/customers`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (res.ok && Array.isArray(data)) {
                    setCustomers(data);
                }
            } catch (err) {
                console.error("Failed to load customers:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchCustomers();
    }, []);

    const openCustomerReviews = async (customer: any) => {
        setTargetCustomer(customer);
        setReviewModalOpen(true);
        setLoadingReviews(true);
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/reviews/customer/${customer.user_id || customer.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok && data.data && Array.isArray(data.data.reviews)) {
                setCustomerReviews(data.data.reviews);
            } else {
                setCustomerReviews([]);
            }
        } catch (err) {
            console.error(err);
            setCustomerReviews([]);
        } finally {
            setLoadingReviews(false);
        }
    };

    const handleToggleLike = async (reviewId: number) => {
        const review = customerReviews.find(r => r.review_id === reviewId);
        if (!review) return;

        if (!review.liked_by_user) {
            setBurstingReviewId(reviewId);
            setTimeout(() => setBurstingReviewId(null), 800);
        }

        setCustomerReviews(prev => prev.map(r =>
            r.review_id === reviewId
                ? {
                    ...r,
                    liked_by_user: !r.liked_by_user,
                    likes_count: (r.likes_count || 0) + (r.liked_by_user ? -1 : 1)
                }
                : r
        ));

        try {
            const token = localStorage.getItem("token");
            await fetch(`${API_BASE_URL}/api/reviews/${reviewId}/like`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });
        } catch (err) {
            console.error("Like toggle failed", err);
        }
    };

    const toggleSelect = (id: number) => {
        const next = new Set(selectedCustomers);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedCustomers(next);
    };

    const handleSendEmail = async () => {
        if (selectedCustomers.size === 0) return;

        // Internet connectivity check
        if (!navigator.onLine) {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'error',
                title: 'No internet connection',
                text: 'Please check your network and try again.',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true,
            });
            return;
        }

        setSendingEmail(true);
        try {
            const token = localStorage.getItem("token");

            let subjectStr = 'A quick hello';
            if (emailTemplate === 'discount') subjectStr = 'A special gift for you';
            else if (emailTemplate === 'holiday') subjectStr = 'Warm holiday wishes';
            else if (emailTemplate === 'Happy Weekend') subjectStr = 'Happy Weekend';
            else if (emailTemplate === 'Friday Special') subjectStr = 'Friday Special';
            else if (emailTemplate === 'New Month') subjectStr = 'Happy New Month';

            const res = await fetch(`${API_BASE_URL}/api/customers/send-bulk-email`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    customerIds: Array.from(selectedCustomers),
                    subject: subjectStr,
                    message: emailMessage
                })
            });

            if (res.ok) {
                const data = await res.json();

                Swal.fire({
                    title: 'Campaign Started!',
                    text: data.message || "Your emails are being sent in the background.",
                    icon: 'success',
                    confirmButtonColor: '#EF4444',
                    confirmButtonText: 'Great!',
                    timer: 2000
                });

                setShowEmailModal(false);
                setSelectedCustomers(new Set());
            } else {
                const err = await res.json();
                Swal.fire({
                    title: 'Send Failed',
                    text: err.message || "Failed to initiate campaign",
                    icon: 'error',
                    confirmButtonColor: '#EF4444'
                });
            }
        } catch (err) {
            console.error(err);
            Swal.fire({
                title: 'Error',
                text: "An error occurred while connecting to the server.",
                icon: 'error',
                confirmButtonColor: '#EF4444'
            });
        } finally {
            setSendingEmail(false);
        }
    };

    const toggleAll = () => {
        const ids = filteredCustomers.map(c => c.user_id || c.id);
        const allFilteredSelected = ids.every(id => selectedCustomers.has(id));

        if (allFilteredSelected && ids.length > 0) {
            const next = new Set(selectedCustomers);
            ids.forEach(id => next.delete(id));
            setSelectedCustomers(next);
        } else {
            const next = new Set(selectedCustomers);
            ids.forEach(id => next.add(id));
            setSelectedCustomers(next);
        }
    };

    const filteredCustomers = customers.filter(c =>
        (c.customer_name || "").toLowerCase().includes(search.toLowerCase()) ||
        (c.email || "").toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Top Bar */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-[0.5rem] border border-slate-200">
                <div className="relative w-full sm:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search customers by name or email..."
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-[0.5rem] text-sm focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                        onClick={toggleAll}
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 border rounded-full transition-all text-xs font-bold ${selectedCustomers.size === filteredCustomers.length && filteredCustomers.length > 0 ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                    >
                        {selectedCustomers.size === filteredCustomers.length && filteredCustomers.length > 0 ? 'Deselect All' : 'Select All'}
                    </button>
                    <button
                        onClick={() => setShowEmailModal(true)}
                        disabled={selectedCustomers.size === 0}
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-full transition-all text-xs font-bold ${selectedCustomers.size > 0 ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-md shadow-rose-200' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                    >
                        <Mail className="w-4 h-4" />
                        Email ({selectedCustomers.size})
                    </button>
                </div>
            </div>

            {/* Customers Grid */}
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
            ) : filteredCustomers.length === 0 ? (
                <div className="text-center py-20 text-slate-500 font-medium border-2 border-dashed border-slate-200 rounded-[0.5rem]">
                    No customers found.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredCustomers.map(customer => {
                        const cid = customer.user_id || customer.id;
                        let locationStr = 'No address saved';
                        let recipientStr = '';
                        let fullAddressStr = '';

                        if (customer.delivery_address) {
                            try {
                                const addrObj = typeof customer.delivery_address === 'string' ? JSON.parse(customer.delivery_address) : customer.delivery_address;

                                if (addrObj.recipientName || addrObj.contactNo) {
                                    recipientStr = `${addrObj.recipientName || ''} ${addrObj.contactNo ? `(${addrObj.contactNo})` : ''}`.trim();
                                }

                                if (addrObj.address) {
                                    fullAddressStr = addrObj.address;
                                }

                                if (addrObj.region) {
                                    locationStr = addrObj.region;
                                } else if (addrObj.address) {
                                    locationStr = addrObj.address;
                                } else if (addrObj.city) {
                                    locationStr = `${addrObj.city}, ${addrObj.state || addrObj.country || ''}`;
                                } else {
                                    locationStr = 'Address provided';
                                }
                            } catch {
                                locationStr = String(customer.delivery_address);
                            }
                        }

                        return (
                            <div
                                key={cid}
                                className={`relative bg-white rounded-[0.5rem] border p-5 transition-all duration-300 cursor-pointer ${selectedCustomers.has(cid) ? 'border-rose-500 ring-2 ring-rose-50 shadow-md' : 'border-slate-200 hover:border-rose-200 hover:shadow-sm'}`}
                                onClick={() => toggleSelect(cid)}
                            >
                                {/* Loyalty Badges */}
                                <div className="absolute -top-2 -left-2 flex flex-col gap-1 z-[5]">
                                    {Number(customer.purchases_count) >= 4 ? (
                                        <div className="bg-blue-500 text-white text-[9px] px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1 border border-blue-400 ">
                                            <Repeat className="w-2.5 h-2.5" />
                                            Regular
                                        </div>
                                    ) : Number(customer.total_spent) > 50000 ? (
                                        <div className="bg-amber-500 text-white text-[9px] px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1 border border-amber-400 ">
                                            <Crown className="w-2.5 h-2.5" />
                                            Top
                                        </div>
                                    ) : null}
                                </div>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3 flex-1 min-w-0 pr-3">
                                        <div className="w-12 h-12 rounded-full bg-slate-100 border-2 border-white shadow-sm flex shrink-0 items-center justify-center text-slate-400 font-bold text-md overflow-hidden">
                                            {customer.profile_pic ? (
                                                <img src={customer.profile_pic} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                (customer.customer_name || recipientStr || "U").charAt(0)
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 pr-2">
                                            <h4 className="font-bold text-slate-900 text-sm truncate">{customer.customer_name || recipientStr.split(' ')[0] || 'Guest User'}</h4>
                                            <p className="text-xs text-slate-500 truncate">{customer.email || customer.phone || 'No contact info'}</p>

                                            {(recipientStr || fullAddressStr) ? (
                                                <div className="mt-2 text-[10px] text-slate-500 bg-slate-50 p-2 rounded-[0.5rem] border border-slate-100 w-full">
                                                    {recipientStr && <div className="font-bold text-slate-700 truncate">{recipientStr}</div>}
                                                    {(fullAddressStr || locationStr) && <div className="line-clamp-2 mt-0.5">{fullAddressStr || locationStr}</div>}
                                                </div>
                                            ) : (
                                                <p className="text-[10px] text-slate-400 mt-0.5 truncate">{locationStr}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                router.push(`/messages?user=${cid}`);
                                            }}
                                            className=" hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-full transition-colors border border-slate-100 hover:border-rose-100 "
                                            title="Message Customer"
                                        >
                                            <MessageCircle className="w-4 h-4" />
                                        </button>
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${selectedCustomers.has(cid) ? 'bg-rose-500 border-rose-500 text-white' : 'border-slate-300'}`}>
                                            {selectedCustomers.has(cid) && <CheckCircle2 className="w-3.5 h-3.5" />}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div className="bg-slate-50 p-2.5 rounded-[0.5rem] border border-slate-100">
                                        <p className="text-[10px] text-slate-400 mb-1">Total Spent</p>
                                        <p className="font-black text-slate-900">₦{Number(customer.total_spent || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    </div>
                                    <div className="bg-slate-50 p-2.5 rounded-[0.5rem] border border-slate-100">
                                        <p className="text-[10px] font-bold text-slate-400 tracking-wider mb-1">Purchases</p>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <Package className="w-3.5 h-3.5 text-rose-500" />
                                                <p className="font-black text-slate-900">{customer.purchases_count || 0}</p>
                                            </div>
                                            {(customer.processing_count > 0 || customer.cancelled_count > 0) && (
                                                <div className="flex gap-1 items-center">
                                                    {customer.processing_count > 0 && <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-sm  tracking-wide">{customer.processing_count} Proc</span>}
                                                    {customer.cancelled_count > 0 && <span className="text-[9px] font-bold bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-sm  tracking-wide">{customer.cancelled_count} Canc</span>}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between ">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); openCustomerReviews(customer); }}
                                        className="flex items-center gap-2 px-2 py-1.5 -ml-2 rounded-lg hover:bg-slate-50 transition-colors"
                                    >
                                        <Star className={`w-4 h-4 ${(customer.reviews_count || 0) > 0 ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                                        <span className="text-xs font-semibold text-slate-600">{customer.reviews_count || 0} Reviews</span>
                                    </button>
                                    <span className="text-[10px] font-medium text-slate-400">Added: {new Date(customer.date_added).toLocaleDateString()}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Email Modal */}
            <AnimatePresence>
                {showEmailModal && (
                    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 md:p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                            onClick={() => setShowEmailModal(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: "100%" }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="relative bg-white rounded-t-[0.5rem] md:rounded-[0.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 sm:max-h-[90vh] max-h-[70vh] flex flex-col"
                        >
                            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 mb-1 sm:hidden" />
                            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900">Send Campaign</h3>
                                    <p className="text-xs text-slate-500 font-medium mt-1">To {selectedCustomers.size} selected customer{selectedCustomers.size > 1 ? 's' : ''}</p>
                                </div>
                                <button onClick={() => setShowEmailModal(false)} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors">
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>
                            <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
                                <div>
                                    <label className="block text-xs text-slate-700 mb-2">Select Campaign Template</label>
                                    <CategorySelectionModal
                                        triggerLabel="Template"
                                        title="Select Template"
                                        hintText="Choose a message style"
                                        options={[
                                            "General Greeting",
                                            "Special Discount",
                                            "Holiday Wishes",
                                            "Friday Special",
                                            "Happy Weekend",
                                            "New Month"
                                        ]}
                                        value={
                                            emailTemplate === 'greeting' ? "General Greeting" :
                                                emailTemplate === 'discount' ? "Special Discount" :
                                                    emailTemplate === 'holiday' ? "Holiday Wishes" :
                                                        emailTemplate
                                        }
                                        onSelected={(val) => {
                                            if (val === "General Greeting") setEmailTemplate("greeting");
                                            else if (val === "Special Discount") setEmailTemplate("discount");
                                            else if (val === "Holiday Wishes") setEmailTemplate("holiday");
                                            else setEmailTemplate(val);
                                        }}
                                    />
                                </div>
                                <div className="mt-4">
                                    <label className="block text-xs text-slate-700  mb-2">Message Content</label>
                                    <textarea
                                        rows={6}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-[0.5rem] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-rose-500 transition-all resize-none mt-2"
                                        value={emailMessage}
                                        onChange={e => setEmailMessage(e.target.value)}
                                        placeholder="Type your message here..."
                                    />
                                </div>
                            </div>
                            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0 pb-[env(safe-area-inset-bottom,16px)]">
                                <button
                                    onClick={() => setShowEmailModal(false)}
                                    className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-full transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSendEmail}
                                    disabled={sendingEmail}
                                    className={`px-6 py-2.5 text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 shadow-md shadow-rose-200 rounded-full transition-all flex items-center gap-2 ${sendingEmail ? 'opacity-70 cursor-wait' : ''}`}
                                >
                                    {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                                    {sendingEmail ? 'Sending...' : 'Send'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Reviews Modal */}
            <AnimatePresence>
                {reviewModalOpen && (
                    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 md:p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                            onClick={() => setReviewModalOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: "100%" }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="relative bg-white rounded-t-[0.5rem] md:rounded-[0.5rem]  w-full max-w-lg overflow-hidden border border-slate-100 sm:max-h-[85vh] h-[70vh] sm:h-auto flex flex-col"
                        >
                            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 mb-1 sm:hidden" />
                            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900">Customer Reviews</h3>
                                    <p className="text-xs text-slate-500 font-medium mt-1">From {targetCustomer?.customer_name || 'Customer'}</p>
                                </div>
                                <button onClick={() => setReviewModalOpen(false)} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors">
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>
                            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 bg-slate-50">
                                {loadingReviews ? (
                                    <div className="flex justify-center py-14"><Loader2 className="w-8 h-8 text-slate-300 animate-spin" /></div>
                                ) : customerReviews.length > 0 ? (
                                    customerReviews.map((review, idx) => (
                                        <div key={idx} className="bg-white p-4 rounded-[0.5rem] border border-slate-200 ">
                                            <div className="flex items-center gap-1 mb-2.5">
                                                {[1, 2, 3, 4, 5].map(star => (
                                                    <Star key={star} className={`w-4 h-4 ${star <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                                                ))}
                                                <span className="text-[10px] font-bold text-slate-400 ml-2">{new Date(review.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">{review.comment || 'No comment provided.'}</p>

                                            <div className="flex items-center h-5 mt-3 pt-3 border-t border-slate-100">
                                                <button
                                                    onClick={() => handleToggleLike(review.review_id)}
                                                    className={`ml-auto flex items-center gap-1.5 text-xs font-bold transition-colors relative ${review.liked_by_user ? "text-rose-500" : "text-slate-400 hover:text-slate-600"}`}
                                                >
                                                    <div className="relative flex items-center justify-center">
                                                        {burstingReviewId === review.review_id && <LikeBurst />}
                                                        <AnimatePresence mode="wait">
                                                            <motion.div
                                                                key={review.liked_by_user ? "liked" : "unliked"}
                                                                initial={{ scale: 0.7, opacity: 0 }}
                                                                animate={{ scale: 1, opacity: 1 }}
                                                                exit={{ scale: 0.7, opacity: 0 }}
                                                            >
                                                                {review.liked_by_user ? <FaHeart className="w-4 h-4" /> : <FaRegHeart className="w-4 h-4" />}
                                                            </motion.div>
                                                        </AnimatePresence>
                                                    </div>
                                                    <span>{review.likes_count || 0}</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-14">
                                        <Star className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                                        <p className="text-sm text-slate-400">No reviews found from {targetCustomer?.customer_name || 'Customer'}</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
