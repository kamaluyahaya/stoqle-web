"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import {
    DevicePhoneMobileIcon,
    ComputerDesktopIcon,
    LifebuoyIcon,
    TrashIcon,
    MapPinIcon,
    ClockIcon,
    GlobeAltIcon,
    XMarkIcon,
    BackwardIcon,
    InformationCircleIcon,
    ExclamationCircleIcon,
    MagnifyingGlassIcon,
    EnvelopeIcon,
    CheckIcon
} from "@heroicons/react/24/outline";
import { useAuth } from "@/src/context/authContext";
import { API_BASE_URL } from "@/src/lib/config";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function AccountSecurityPage() {
    const router = useRouter();
    const { user, token, logout, openLogin } = useAuth() as any;
    const [showDeviceLogs, setShowDeviceLogs] = useState(false);
    const [showDeleteAccount, setShowDeleteAccount] = useState(false);
    const [showRecovery, setShowRecovery] = useState(false);
    const [deviceLogs, setDeviceLogs] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);

    // Fetch logs when device modal opens
    useEffect(() => {
        if (showDeviceLogs && token) {
            setLoadingLogs(true);
            fetch(`${API_BASE_URL}/api/auth/activity-logs`, {
                headers: { Authorization: `Bearer ${token}` }
            })
                .then(res => res.json())
                .then(json => {
                    // backend uses json.status === 'success' not json.ok
                    if (json.status === 'success') {
                        setDeviceLogs(json.data || []);
                    } else {
                        console.warn("Logs response error", json.message);
                        setDeviceLogs([]);
                    }
                })
                .catch(err => {
                    console.error("Logs fetch error", err);
                    setDeviceLogs([]);
                })
                .finally(() => setLoadingLogs(false));
        }
    }, [showDeviceLogs, token]);

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col">
            {/* Header */}
            <div className="sticky top-0 z-[100] bg-slate-100 flex items-center px-4 h-14 md:h-16 lg:px-6">
                <button onClick={() => router.back()} className="p-1 -ml-1 text-slate-800 lg:hidden">
                    <FaChevronLeft size={16} />
                </button>
                <div className="absolute left-1/2 -translate-x-1/2 text-sm font-bold text-slate-800 tracking-tight">
                    Account security
                </div>
            </div>

            <div className="flex-1 px-4 lg:px-6 py-6 space-y-4 w-full">

                {/* Card 1: Main Security Info */}
                <ProfileGroup>
                    <SettingsRow
                        label="Mobile"
                        icon={<DevicePhoneMobileIcon className="w-5 h-5 text-slate-400" />}
                        value={user?.phone_no || "Not linked"}
                        onClick={() => { }}
                    />
                    <SettingsRow
                        label="Device management"
                        icon={<ComputerDesktopIcon className="w-5 h-5 text-slate-400" />}
                        onClick={() => setShowDeviceLogs(true)}
                    />

                </ProfileGroup>
                <ProfileGroup><SettingsRow
                    label="Record account"
                    subtitle="Recover an account you cannot access"
                    icon={<LifebuoyIcon className="w-5 h-5 text-slate-400" />}
                    onClick={() => setShowRecovery(true)}
                /></ProfileGroup>

                {/* Card 2: Dangerous Actions */}
                <ProfileGroup>
                    <SettingsRow
                        label="Delete account"
                        icon={<TrashIcon className="w-5 h-5 text-red-400" />}
                        labelClassName="text-red-500"
                        onClick={() => setShowDeleteAccount(true)}
                    />
                </ProfileGroup>

            </div>

            {/* Device Management Modal */}
            <AnimatePresence>
                {showDeviceLogs && (
                    <DeviceManagementModal
                        open={showDeviceLogs}
                        onClose={() => setShowDeviceLogs(false)}
                        logs={deviceLogs}
                        loading={loadingLogs}
                    />
                )}
            </AnimatePresence>

            {/* Account Recovery Modal */}
            <AnimatePresence>
                {showRecovery && (
                    <AccountRecoveryModal
                        onClose={() => setShowRecovery(false)}
                        onLinked={() => {
                            setShowRecovery(false);
                            openLogin();
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Delete Account Modal Flow */}
            <AnimatePresence>
                {showDeleteAccount && (
                    <DeleteAccountModal
                        open={showDeleteAccount}
                        onClose={() => setShowDeleteAccount(false)}
                        onDeleted={() => {
                            logout();
                            router.push("/discover");
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Modals ──────────────────────────────────────────────────

function AccountRecoveryModal({ onClose, onLinked }: any) {
    const [showSearch, setShowSearch] = useState(false);
    const [searchId, setSearchId] = useState("");

    return (
        <div className="fixed inset-0 z-[200000] flex items-center justify-center sm:p-4 bg-black/60" onClick={onClose}>
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                className="w-full h-full sm:h-auto sm:max-w-md bg-white sm:rounded-[0.5rem] shadow-2xl overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800">Record recovery</h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full"><XMarkIcon className="w-5 h-5 text-slate-400" /></button>
                </div>

                {!showSearch ? (
                    <div className="p-6 space-y-4">
                        <button
                            onClick={onLinked}
                            className="w-full flex items-center gap-4 p-5 bg-slate-50 border border-slate-100 rounded-2xl hover:border-red-500 hover:bg-white transition-all group"
                        >
                            <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-red-500 group-hover:bg-red-50 transition-colors">
                                <EnvelopeIcon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 text-left">
                                <p className="text-sm font-bold text-slate-800">Link Method</p>
                                <p className="text-[11px] text-slate-500 font-medium">Continue with linked phone number/email</p>
                            </div>
                            <FaChevronRight size={10} className="text-slate-300 group-hover:text-red-400" />
                        </button>

                        <button
                            onClick={() => setShowSearch(true)}
                            className="w-full flex items-center gap-4 p-5 bg-slate-50 border border-slate-100 rounded-2xl hover:border-red-500 hover:bg-white transition-all group"
                        >
                            <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-red-500 group-hover:bg-red-50 transition-colors">
                                <MagnifyingGlassIcon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 text-left">
                                <p className="text-sm font-bold text-slate-800">Stoqle ID</p>
                                <p className="text-[11px] text-slate-500 font-medium">Recover by searching for your unique ID</p>
                            </div>
                            <FaChevronRight size={10} className="text-slate-300 group-hover:text-red-400" />
                        </button>
                    </div>
                ) : (
                    <div className="p-6 space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                            <button onClick={() => setShowSearch(false)} className="p-1 hover:bg-slate-50 rounded-full transition-colors"><FaChevronLeft size={12} className="text-slate-400" /></button>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Search Account</span>
                        </div>

                        <div className="relative">
                            <input
                                autoFocus
                                value={searchId}
                                onChange={e => setSearchId(e.target.value)}
                                placeholder="Enter Stoqle ID..."
                                className="w-full p-4 pl-12 rounded-xl bg-slate-50 border border-slate-100 text-sm font-medium focus:ring-2 focus:ring-red-500/20 outline-none transition-all"
                            />
                            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        </div>

                        <button
                            disabled={!searchId}
                            onClick={() => {
                                toast.success("Searching for " + searchId);
                                onClose();
                            }}
                            className="w-full bg-red-500 text-white py-3 rounded-full font-bold text-sm disabled:opacity-30 disabled:grayscale transition-all active:scale-[0.98] shadow-lg shadow-red-500/20"
                        >
                            Search Account
                        </button>
                    </div>
                )}
            </motion.div>
        </div>
    )
}

function DeviceManagementModal({ open, onClose, logs, loading }: any) {
    return (
        <div className="fixed inset-0 z-[200000] flex items-center justify-center sm:p-4 bg-black/50" onClick={onClose}>
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                className="w-full h-full sm:h-auto sm:max-w-lg bg-white sm:rounded-[0.5rem] shadow-2xl overflow-hidden flex flex-col sm:max-h-[85vh]"
                onClick={e => e.stopPropagation()}
            >


                <div className="p-8  items-center justify-between">
                    <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-colors absolute left-4"><FaChevronLeft size={14} className="text-slate-400" /></button>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full"><FaChevronLeft className="w-5 h-5 text-slate-400" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <h3 className="font-bold text-slate-800 text-center text-[18px]">Device management</h3>
                    {loading ? (
                        <div className="py-20 text-center text-slate-400 animate-pulse font-medium">Loading history...</div>
                    ) : logs.length === 0 ? (
                        <div className="py-20 text-center text-slate-400 font-medium">No login records found.</div>
                    ) : (
                        (() => {
                            const log = logs[0]; // Only show the last login
                            return (
                                <div className="space-y-4 p-2">
                                    <div className="flex justify-between items-center py-3 border-b border-slate-50">
                                        <span className="text-[13px] font-bold text-slate-400">Login Device</span>
                                        <span className="text-[13px] font-black text-slate-800">{log.device_info || log.user_agent?.split(')')[0].split('(')[1] || "Unknown Device"}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-3 border-b border-slate-50">
                                        <span className="text-[13px] font-bold text-slate-400">Login time</span>
                                        <span className="text-[13px] font-black text-slate-800">{new Date(log.created_at).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-3 border-b border-slate-50">
                                        <span className="text-[13px] font-bold text-slate-400">Login location</span>
                                        <span className="text-[13px] font-black text-slate-800">{log.ip_address}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-3">
                                        <span className="text-[13px] font-bold text-slate-400">Login Method</span>
                                        <span className="text-[13px] font-black text-slate-800 capitalize">{(log.action || '').split('.').pop().replace('login_', '').replace('_', ' ')}</span>
                                    </div>
                                </div>
                            );
                        })()
                    )}
                </div>
                <div className="p-4 border-slate-100">
                    <button onClick={onClose} className="w-full bg-red-500 text-white py-2.5 rounded-full font-bold text-sm hover:bg-red-600 transition-all active:scale-[0.98]">Confirm</button>
                </div>
            </motion.div>
        </div>
    );
}

function DeleteAccountModal({ open, onClose, onDeleted }: any) {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [accepted, setAccepted] = useState(false);
    const [reason, setReason] = useState("");
    const [photos, setPhotos] = useState<File[]>([]);
    const [isDeleting, setIsDeleting] = useState(false);
    const { token } = useAuth() as any;

    const handleFinalDelete = async () => {
        if (!reason) {
            toast.error("Please provide a reason for deletion");
            return;
        }

        setIsDeleting(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/delete-account`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ reason })
            });
            const json = await res.json();
            if (json.status === 'success') {
                toast.success("Account deleted successfully");
                onDeleted();
            } else {
                toast.error(json.message || "Deletion failed");
            }
        } catch (err: any) {
            toast.error("Network error");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200000] flex items-center justify-center sm:p-4 bg-black/60" onClick={onClose}>
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="w-full h-full sm:h-auto sm:max-w-lg bg-white sm:rounded-[0.5rem] shadow-2xl overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {step === 1 ? (
                    <>
                        <div className="p-6  flex items-center justify-between">

                            <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-colors absolute left-4"><FaChevronLeft size={14} className="text-slate-400" /></button>
                            <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full"><FaChevronLeft className="w-5 h-5 text-slate-400" /></button>
                        </div>

                        <div className="flex-1 p-6 space-y-6 overflow-y-auto overscroll-contain">
                            <div className="flex flex-col items-center text-center gap-3">
                                <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-200">
                                    <ExclamationCircleIcon className="w-10 h-10 text-white" />
                                </div>
                                <h3 className="font-black text-slate-800 text-xl tracking-tight">Important notice</h3>
                            </div>

                            <div className="space-y-6">
                                <p className="text-[14px] font-bold text-slate-800 px-2 leading-snug">Please read this notice in full before deleting your account. This account can no longer be used after deletion, including:</p>

                                <div className="space-y-4 px-2">
                                    {[
                                        "The Stoqle account can no longer be used, and all of the account's associated login methods will be removed.",
                                        "The profile picture will be reset to default, and the nickname will be reset to \"Deactivated user\".",
                                        "Account ID verification information will be removed.",
                                        "All data and history for this account will be lost forever.",
                                        "All verified statuses will be removed and cannot be recovered.",
                                        "All account assets and perks will be wiped.",
                                        "Transaction processes can no longer be accessed.",
                                        "In accordance with regulations, if a violating account is deleted, the associated registration information cannot be used to register or link a new account during the enforcement period."
                                    ].map((text, i) => (
                                        <div key={i} className="flex gap-4 group">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-2 shrink-0 group-hover:bg-red-500 transition-colors" />
                                            <p className="text-[13px] text-slate-600 font-bold leading-relaxed">{text}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="px-6 flex flex-col gap-5 py-3 border-slate-50">
                            <label className="flex items-start gap-4 cursor-pointer group">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setAccepted(!accepted);
                                    }}
                                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 mt-0.5 ${accepted ? "bg-red-500 border-red-500 shadow-lg shadow-red-200" : "bg-white border-slate-200"}`}
                                >
                                    {accepted && (
                                        <CheckIcon className="w-3 h-3 text-white stroke-[3] animate-in zoom-in duration-200" />
                                    )}
                                </button>
                                <div className="text-[12px] text-slate-500 font-bold leading-relaxed group-hover:text-slate-800 transition-colors flex flex-wrap items-center gap-x-1">
                                    <span>I have read and understood the <span onClick={(e) => { e.stopPropagation(); router.push('/help/account-deletion'); }} className=" text-blue-600 rounded-md hover:bg-blue-100 transition-all font-black cursor-pointer">Stoqle Account Deletion Guide</span></span>
                                </div>
                            </label>
                            <button
                                disabled={!accepted}
                                onClick={() => setStep(2)}
                                className="w-full bg-red-500 text-white py-2 rounded-full font-bold text-sm disabled:opacity-30 disabled:grayscale transition-all active:scale-[0.98] "
                            >
                                Continue
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="p-6 flex items-center relative">
                            <button onClick={() => setStep(1)} className="p-2 hover:bg-slate-50 rounded-full transition-colors absolute left-4"><FaChevronLeft size={14} className="text-slate-400" /></button>
                            <h3 className="font-bold text-slate-800 text-center w-full">Reason for Deletion</h3>
                        </div>
                        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                            <div className="space-y-3">
                                {[
                                    "Multiple accounts.",
                                    "To create a new account.",
                                    "Infrequent usage - I no longer need this account.",
                                    "Unwanted recommendations.",
                                    "Too many ads",
                                    "Account verification issue.",
                                    "Other reasons"
                                ].map((r) => (
                                    <div
                                        key={r}
                                        onClick={() => setReason(r)}
                                        className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer group ${reason === r ? 'bg-white border-red-200 shadow-sm' : 'bg-slate-50 border-slate-100'}`}
                                    >
                                        <span className={`text-[13px] font-bold ${reason === r ? 'text-slate-900' : 'text-slate-500'}`}>{r}</span>
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${reason === r ? "bg-red-500 border-red-500 shadow-lg shadow-red-200" : "bg-white border-slate-200"}`}>
                                            {reason === r && <CheckIcon className="w-3 h-3 text-white stroke-[3] animate-in zoom-in duration-200" />}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Upload supporting photos</label>
                                <div className="flex gap-3">
                                    {photos.map((p, i) => (
                                        <div key={i} className="w-20 h-20 rounded-xl bg-slate-100 flex items-center justify-center relative border border-slate-200 overflow-hidden group">
                                            <img src={URL.createObjectURL(p)} className="w-full h-full object-cover" />
                                            <button
                                                onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                                                className="absolute top-1 right-1 bg-black/60 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <XMarkIcon className="w-3 h-3 text-white" />
                                            </button>
                                        </div>
                                    ))}
                                    {photos.length < 3 && (
                                        <button
                                            onClick={() => document.getElementById('delete-photos')?.click()}
                                            className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-500 hover:bg-white transition-all group"
                                        >
                                            <span className="text-2xl group-hover:scale-110 transition-transform">+</span>
                                            <span className="text-[9px] font-black uppercase">Upload</span>
                                        </button>
                                    )}
                                </div>
                                <input
                                    id="delete-photos"
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={e => {
                                        const files = Array.from(e.target.files || []);
                                        setPhotos(prev => [...prev, ...files].slice(0, 3));
                                    }}
                                />
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-100 bg-slate-50">
                            <button
                                onClick={handleFinalDelete}
                                disabled={!reason || isDeleting}
                                className="w-full bg-red-500 text-white py-3 rounded-full font-bold text-sm disabled:opacity-30 disabled:grayscale transition-all active:scale-[0.98] shadow-lg shadow-red-500/20 flex items-center justify-center gap-3"
                            >
                                {isDeleting ? (
                                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : (
                                    "Confirm account deletion"
                                )}
                            </button>
                        </div>
                    </>
                )}
            </motion.div>
        </div>
    );
}

// ── Shared UI Components ──────────────────────────────────

function ProfileGroup({ children }: { children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-xl overflow-hidden border border-slate-200/60">
            <div className="divide-y divide-slate-100">{children}</div>
        </div>
    );
}

function SettingsRow({
    label,
    subtitle,
    value,
    icon,
    onClick,
    hideChevron = false,
    labelClassName = "",
}: {
    label: string;
    subtitle?: string;
    value?: string;
    icon: React.ReactNode;
    onClick: () => void;
    hideChevron?: boolean;
    labelClassName?: string;
}) {
    return (
        <div
            onClick={onClick}
            className="px-5 py-4 flex items-center gap-4 cursor-pointer active:bg-slate-50 transition-colors"
        >
            <div className="shrink-0">{icon}</div>
            <div className="flex-1 min-w-0">
                <span className={`text-[14px] font-bold text-slate-700 block truncate ${labelClassName}`}>
                    {label}
                </span>
                {subtitle && (
                    <span className="text-[11px] text-slate-400 font-bold block mt-0.5 line-clamp-1">
                        {subtitle}
                    </span>
                )}
            </div>
            {value && (
                <span className="text-[11px] font-black text-slate-400 px-3 py-1 bg-slate-50 rounded-lg border border-slate-100">
                    {value}
                </span>
            )}
            {!hideChevron && (
                <FaChevronRight className="text-slate-300 shrink-0" size={10} />
            )}
        </div>
    );
}
