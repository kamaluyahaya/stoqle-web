"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FaChevronLeft,
    FaChevronRight,
    FaUserSlash
} from "react-icons/fa";
import {
    CheckIcon
} from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/src/lib/config";
import { toast } from "sonner";
import { useAuth } from "@/src/context/authContext";

// --- Shared UI Components ---

function ProfileGroup({ children }: { children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-xl overflow-hidden ">
            <div className="divide-y divide-slate-100">{children}</div>
        </div>
    );
}

function SettingsRow({ label, subLabel, onClick, rightElement, danger }: any) {
    return (
        <div
            onClick={onClick}
            className={`px-5 py-4 flex items-center justify-between transition-all active:bg-slate-50 ${onClick ? 'cursor-pointer' : ''}`}
        >
            <div className="flex-1 pr-4">
                <p className={`text-[15px]  ${danger ? 'text-rose-500' : 'text-slate-800'}`}>{label}</p>
                {subLabel && <p className="text-[11px] font-bold text-slate-400  tracking-wider mt-0.5">{subLabel}</p>}
            </div>
            {rightElement ? rightElement : (onClick && <FaChevronRight size={12} className="text-slate-300 ml-auto" />)}
        </div>
    );
}

function Toggle({ enabled, onChange }: { enabled: boolean, onChange: (val: boolean) => void }) {
    return (
        <button
            onClick={() => onChange(!enabled)}
            className={`w-10 h-6 flex items-center rounded-full p-1 transition-all duration-300 ${enabled ? 'bg-rose-500 shadow-md shadow-rose-100' : 'bg-slate-200'}`}
        >
            <motion.div
                animate={{ x: enabled ? 16 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="w-4 h-4 bg-white rounded-full shadow-sm"
            />
        </button>
    );
}

// --- Modals ---

function SimpleSelectionModal({ open, onClose, title, options, selected, onSelect }: any) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[200000] flex items-center justify-center sm:p-4 bg-black/60" onClick={onClose}>
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="w-full h-full sm:h-auto sm:max-w-md bg-white sm:rounded-[0.5rem]  overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 flex items-center relative border-b border-slate-50">
                    <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-colors absolute left-4"><FaChevronLeft size={14} className="text-slate-400" /></button>
                    <h3 className="font-bold text-slate-800 text-center w-full">{title}</h3>
                </div>
                <div className="flex-1 p-6 space-y-3 overflow-y-auto">
                    {options.map((opt: string) => (
                        <div
                            key={opt}
                            onClick={() => onSelect(opt)}
                            className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer group ${selected === opt ? 'bg-white border-rose-200 shadow-sm' : 'bg-slate-50 border-slate-100'}`}
                        >
                            <span className={`text-[14px] font-bold ${selected === opt ? 'text-slate-900' : 'text-slate-500'}`}>{opt}</span>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selected === opt ? "bg-rose-500 border-rose-500 shadow-lg shadow-rose-200" : "bg-white border-slate-200"}`}>
                                {selected === opt && <CheckIcon className="w-3 h-3 text-white stroke-[3] animate-in zoom-in duration-200" />}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-6">
                    <button onClick={onClose} className="w-full bg-rose-500 text-white py-3 rounded-full font-black text-sm active:scale-[0.98] transition-transform">Confirm</button>
                </div>
            </motion.div>
        </div>
    );
}

function ToggleModal({ open, onClose, title, items }: any) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[200000] flex items-center justify-center sm:p-4 bg-black/60" onClick={onClose}>
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="w-full h-full sm:h-auto sm:max-w-md bg-white sm:rounded-[0.5rem] shadow-2xl overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 flex items-center relative border-b border-slate-50">
                    <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-colors absolute left-4"><FaChevronLeft size={14} className="text-slate-400" /></button>
                    <h3 className="font-bold text-slate-800 text-center w-full">{title}</h3>
                </div>
                <div className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {items.map((item: any) => (
                        <div key={item.label} className="flex items-center justify-between p-4 bg-white rounded-xl">
                            <div className="flex-1 pr-4 text-left">
                                <p className="text-[13px] font-bold text-slate-800  tracking-tight leading-snug">{item.label}</p>
                            </div>
                            <Toggle enabled={item.enabled} onChange={item.onChange} />
                        </div>
                    ))}
                </div>
                <div className="p-6">
                    <button onClick={onClose} className="w-full bg-rose-500 text-white py-3 rounded-full font-black text-sm active:scale-[0.98] transition-transform">Done</button>
                </div>
            </motion.div>
        </div>
    );
}

function BlockListModal({ onClose }: { onClose: () => void }) {
    const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const auth = useAuth() as any;
    const token = auth?.token || (typeof window !== "undefined" ? localStorage.getItem("token") : null);

    const fetchBlockList = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE_URL}/api/blocks/blocklist`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            const json = await res.json();
            if (json.status === 'success') {
                setBlockedUsers(json.data || []);
            }
        } catch (err) {
            console.error("Failed to fetch block list:", err);
            toast.error("Failed to load blocklist");
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        fetchBlockList();
    }, []);

    const handleUnblock = async (userId: number) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/blocks/${userId}/unblock`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            if (res.ok) {
                toast.success("User unblocked");
                setBlockedUsers(prev => prev.filter(u => u.user_id !== userId));
            } else {
                toast.error("Failed to unblock user");
            }
        } catch (err) {
            console.error(err);
            toast.error("An error occurred");
        }
    };

    return (
        <div className="fixed inset-0 z-[200000] flex items-center justify-center sm:p-4 bg-black/60" onClick={onClose}>
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="w-full h-full sm:h-auto sm:max-w-md bg-white sm:rounded-[0.5rem] shadow-2xl overflow-hidden flex flex-col sm:max-h-[70vh]"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 flex items-center relative border-b border-slate-50">
                    <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-colors absolute left-4"><FaChevronLeft size={14} className="text-slate-400" /></button>
                    <h3 className="font-bold text-slate-800 text-center w-full tracking-tight">Blocklist</h3>
                </div>
                <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : blockedUsers.length === 0 ? (
                        <div className="py-20 text-center">
                            <FaUserSlash size={40} className="mx-auto text-slate-200 mb-4" />
                            <p className="text-slate-400 font-bold  text-[11px] tracking-widest">No users blocked</p>
                        </div>
                    ) : (
                        blockedUsers.map(user => (
                            <div key={user.user_id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="flex items-center gap-3">
                                    <img
                                        src={user.profile_pic || "/assets/images/favio.png"}
                                        className="w-10 h-10 rounded-full object-cover"
                                        alt=""
                                    />
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{user.full_name}</p>
                                        <p className="text-[10px] font-bold text-slate-400  tracking-wider">ID: {user.user_id}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleUnblock(user.user_id)}
                                    className="text-xs font-black text-rose-500 px-4 py-2 border border-rose-100 rounded-full hover:bg-rose-50 transition-colors"
                                >
                                    Unblock
                                </button>
                            </div>
                        ))
                    )}
                </div>
                <div className="p-6">
                    <button onClick={onClose} className="w-full bg-slate-100 text-slate-500 py-3 rounded-full font-black text-sm active:scale-[0.98] transition-transform">Close</button>
                </div>
            </motion.div>
        </div>
    );
}

export default function PrivacySettingsPage() {
    const router = useRouter();

    // State
    const [allowCommentsFollowing, setAllowCommentsFollowing] = useState(true);
    const [dmPreference, setDmPreference] = useState("Default");
    const [recommendMe, setRecommendMe] = useState(true);
    const [showInContacts, setShowInContacts] = useState(true);
    const [hideNearbyNotes, setHideNearbyNotes] = useState(false);
    const [hideFollowing, setHideFollowing] = useState(false);
    const [hideFollowers, setHideFollowers] = useState(false);
    const [recommendPeople, setRecommendPeople] = useState(true);
    const [loading, setLoading] = useState(true);

    const auth = useAuth() as any;
    const token = auth?.token || (typeof window !== "undefined" ? localStorage.getItem("token") : null);

    // Fetch current settings
    React.useEffect(() => {
        const fetchSettings = async () => {
            if (!token) {
                setLoading(false);
                return;
            }
            try {
                const res = await fetch(`${API_BASE_URL}/api/auth/profile/me`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const json = await res.json();
                if (json.status === 'success' || (json.user_id && !json.status)) {
                    const data = json.data?.user || json.data || json;
                    setAllowCommentsFollowing(Boolean(data.allow_comments_following ?? true));
                    setDmPreference(data.dm_preference || "Default");
                    setRecommendMe(Boolean(data.recommend_me ?? true));
                    setShowInContacts(Boolean(data.show_in_contacts ?? true));
                    setHideNearbyNotes(Boolean(data.hide_nearby_notes ?? false));
                    setHideFollowing(Boolean(data.hide_following ?? false));
                    setHideFollowers(Boolean(data.hide_followers ?? false));
                    setRecommendPeople(Boolean(data.recommend_people_i_know ?? true));
                }
            } catch (err) {
                console.error("Failed to fetch privacy settings:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, [token]);

    const updatePrivacySetting = async (field: string, value: any) => {
        if (!token) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/profile/update`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ [field]: value })
            });
            if (!res.ok) {
                const json = await res.json();
                toast.error(json.message || "Failed to update setting");
            }
        } catch (err) {
            console.error(err);
            toast.error("An error occurred while saving");
        }
    };

    const handleToggle = (setter: any, field: string, value: boolean) => {
        setter(value);
        updatePrivacySetting(field, value);
    };

    // Modals
    const [activeModal, setActiveModal] = useState<string | null>(null);

    return (
        <div className="min-h-screen bg-slate-100 pb-20 lg:pt-0 p-4">
            {/* Mobile Header */}
            <div className=" px-4 py-4 sticky top-0 z-10 flex items-center justify-between">
                <button onClick={() => router.back()} className="lg:hidden p-2 hover:bg-slate-50 rounded-full transition-colors">
                    <FaChevronLeft size={16} className="text-slate-800" />
                </button>
                <h1 className="text-[17px] font-black text-slate-800 tracking-tight">Privacy</h1>
            </div>

            <div className=" px-4 py-6 space-y-8">
                {/* Section 1 */}
                <div className="space-y-4">
                    <ProfileGroup>
                        <SettingsRow
                            label="Allow comments from following"
                            rightElement={<Toggle enabled={allowCommentsFollowing} onChange={(val) => handleToggle(setAllowCommentsFollowing, 'allow_comments_following', val)} />}
                        />
                        <SettingsRow
                            label="Direct messages"
                            subLabel={dmPreference}
                            onClick={() => setActiveModal('dm')}
                        />
                    </ProfileGroup>
                </div>

                {/* Section 2 */}
                <div className="space-y-4">
                    <ProfileGroup>
                        <SettingsRow
                            label="Ways to find me"
                            onClick={() => setActiveModal('findMe')}
                        />
                        <SettingsRow
                            label="Following and followers"
                            onClick={() => setActiveModal('follow')}
                        />
                        <SettingsRow
                            label="Recommend people i may know"
                            rightElement={<Toggle enabled={recommendPeople} onChange={(val) => handleToggle(setRecommendPeople, 'recommend_people_i_know', val)} />}
                        />
                        <SettingsRow
                            label="Blocklist"
                            onClick={() => setActiveModal('blockList')}
                        />
                    </ProfileGroup>
                </div>
            </div>

            {/* Modals */}
            <AnimatePresence>
                {activeModal === 'dm' && (
                    <SimpleSelectionModal
                        open={true}
                        onClose={() => setActiveModal(null)}
                        title="Direct messages"
                        options={["Default", "People i know", "Friends", "No one"]}
                        selected={dmPreference}
                        onSelect={(val: string) => {
                            setDmPreference(val);
                            updatePrivacySetting('dm_preference', val);
                        }}
                    />
                )}

                {activeModal === 'findMe' && (
                    <ToggleModal
                        open={true}
                        onClose={() => setActiveModal(null)}
                        title="Ways to find me"
                        items={[
                            { label: "Recommend me to people i may know", enabled: recommendMe, onChange: (val: boolean) => handleToggle(setRecommendMe, 'recommend_me', val) },
                            { label: "Show in other's contact list", enabled: showInContacts, onChange: (val: boolean) => handleToggle(setShowInContacts, 'show_in_contacts', val) },
                            { label: "Hide my notes from Nearby page", enabled: hideNearbyNotes, onChange: (val: boolean) => handleToggle(setHideNearbyNotes, 'hide_nearby_notes', val) }
                        ]}
                    />
                )}

                {activeModal === 'follow' && (
                    <ToggleModal
                        open={true}
                        onClose={() => setActiveModal(null)}
                        title="Following and followers"
                        items={[
                            { label: "Hide my following list", enabled: hideFollowing, onChange: (val: boolean) => handleToggle(setHideFollowing, 'hide_following', val) },
                            { label: "Hide my followers list", enabled: hideFollowers, onChange: (val: boolean) => handleToggle(setHideFollowers, 'hide_followers', val) }
                        ]}
                    />
                )}

                {activeModal === 'blockList' && (
                    <BlockListModal onClose={() => setActiveModal(null)} />
                )}
            </AnimatePresence>
        </div>
    );
}
