"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL } from "@/src/lib/config";
import { useAuth } from "@/src/context/authContext";
import { XMarkIcon, MagnifyingGlassIcon, CheckIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";

type SocialUser = {
  user_id: string | number;
  full_name: string;
  name?: string;
  username?: string;
  profile_pic?: string;
  avatar?: string;
  is_following_viewer?: boolean;
};

type SocialTab = "friends" | "followers" | "following";

interface ShareToFriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | number;
  shareUrl: string;
}

const ShareToFriendsModal: React.FC<ShareToFriendsModalProps> = ({ isOpen, onClose, userId, shareUrl }) => {
  const [activeTab, setActiveTab] = useState<SocialTab>("friends");
  const [users, setUsers] = useState<SocialUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<SocialUser[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const cacheRef = useRef<Record<string, { users: SocialUser[]; timestamp: number }>>({});
  const CACHE_TTL = 5 * 60 * 1000;

  const auth = useAuth() as any;
  const token = auth?.token ?? (typeof window !== "undefined" ? localStorage.getItem("token") : null);
  const currentUser = auth?.user ?? null;

  const tabs: { id: SocialTab; label: string }[] = [
    { id: "friends", label: "Friends" },
    { id: "followers", label: "Followers" },
    { id: "following", label: "Following" }
  ];

  useEffect(() => {
    if (isOpen) {
      setActiveTab("friends");
      setSearchQuery("");
      setSelectedUsers([]);
      setMessage("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && userId) {
      fetchData();
    }
  }, [isOpen, activeTab, userId]);

  const fetchData = async () => {
    if (!userId) return;
    const cacheKey = `${activeTab}-${userId}`;
    const cachedData = cacheRef.current[cacheKey];
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
      setUsers(cachedData.users);
      return;
    }

    setLoading(true);
    try {
      let url = "";
      if (activeTab === "followers") {
        url = `${API_BASE_URL}/api/users/${userId}/followers`;
      } else if (activeTab === "following" || activeTab === "friends") {
        url = `${API_BASE_URL}/api/users/${userId}/following`;
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(url, { headers });
      const data = await res.json();
      const rawList = data?.data?.items ?? data?.items ?? [];

      const list: SocialUser[] = (Array.isArray(rawList) ? rawList : []).map((u: any, idx: number) => ({
        ...u,
        user_id: String(u.user_id || u.id || `temp-${idx}`),
        full_name: u.business_name || u.full_name || u.name || "Stoqle User",
        profile_pic: u.business_logo || u.profile_pic || u.avatar || `https://i.pravatar.cc/150?u=${u.user_id || u.id || idx}`
      }));

      let filteroseList = list;
      if (activeTab === "friends") {
        filteroseList = list.filter((u: SocialUser) => u.is_following_viewer);
      }

      setUsers(filteroseList);
      cacheRef.current[cacheKey] = { users: filteroseList, timestamp: Date.now() };
    } catch (err) {
      console.error("Failed to fetch users:", err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const filteroseUsers = users.filter(u =>
    (u.full_name || u.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.username || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleUser = (user: SocialUser) => {
    const isSelected = selectedUsers.some(su => String(su.user_id) === String(user.user_id));
    if (isSelected) {
      setSelectedUsers(prev => prev.filter(su => String(su.user_id) !== String(user.user_id)));
    } else {
      if (selectedUsers.length >= 10) {
        toast.error("You can select up to 10 users max.");
        return;
      }
      setSelectedUsers(prev => [...prev, user]);
    }
  };

  const handleSend = async () => {
    if (selectedUsers.length === 0) return;
    // if (!message.trim()) {
    //   toast.error("Message cannot be empty.");
    //   return;
    // }

    setSending(true);
    let successCount = 0;

    for (const user of selectedUsers) {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        };

        const createRes = await fetch(`${API_BASE_URL}/api/chat/create`, {
          method: "POST",
          headers,
          body: JSON.stringify({ other_user_id: user.user_id })
        });
        const createData = await createRes.json();
        const room = createData?.chatRoom || createData?.data || createData;
        const roomId = room?.chat_room_id;

        if (roomId) {
          const sendRes = await fetch(`${API_BASE_URL}/api/chat/message`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              chat_room_id: roomId,
              message_content: (message.trim() + "\n\nChecked out this profile: " + shareUrl).trim(),
              message_type: "text"
            })
          });
          if (sendRes.ok) successCount++;
        }
      } catch (err) {
        console.error("Failed to send to user:", user.user_id, err);
      }
    }

    setSending(false);
    if (successCount > 0) {
      toast.success(`Message sent successfully to ${successCount} user(s).`);
      onClose();
    } else {
      toast.error("Failed to send messages. Please try again.");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div key="share-friends-overlay-root" className="fixed inset-0 z-[1200] flex items-center justify-center sm:p-6" style={{ isolation: "isolate" }}>
          <motion.div
            key="share-friends-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            key="share-friends-content"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full bg-white flex flex-col h-[100dvh] sm:h-[85vh] sm:max-w-md sm:rounded-[0.75rem] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 shrink-0">
              <h3 className="text-md font-bold text-slate-900">Share to </h3>
              <button onClick={onClose} className="p-2 -mr-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                <XMarkIcon className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>

            {/* Tabs */}
            <div className="px-6 flex items-center gap-6 overflow-x-auto no-scrollbar border-b border-slate-100 shrink-0">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); setSearchQuery(""); }}
                    className={`relative py-3 flex-1 text-sm font-bold whitespace-nowrap transition-all ${isActive ? "text-rose-500" : "text-slate-400 hover:text-slate-600"
                      }`}
                  >
                    {tab.label}
                    {isActive && (
                      <motion.div
                        layoutId="activeTabShareSocial"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500 rounded-t-full"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div className="px-6 py-3 shrink-0 flex flex-col gap-3 border-b border-slate-50">
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 group-focus-within:text-rose-500 transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-rose-100 placeholder:text-slate-400 focus:bg-white transition-all outline-none"
                />
              </div>
              {users.length > 0 && (
                <div className="text-[10px] font-bold text-slate-400 pl-1">
                  {activeTab} ({users.length})
                </div>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar relative">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteroseUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-10">
                  <p className="text-sm font-bold text-slate-900">
                    {searchQuery ? "No users match your search" : "No users found"}
                  </p>
                </div>
              ) : (
                <div className="space-y-1 pb-10">
                  {filteroseUsers.map((user, idx) => {
                    const isSelected = selectedUsers.some(su => String(su.user_id) === String(user.user_id));
                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx * 0.02, 0.2) }}
                        key={`share-user-${user.user_id}-${idx}`}
                        className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer group"
                        onClick={() => handleToggleUser(user)}
                      >
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${isSelected ? "bg-rose-500 border-rose-500 shadow-md shadow-rose-200" : "bg-white border-slate-200"}`}
                        >
                          {isSelected && (
                            <CheckIcon className="w-2.5 h-2.5 text-white stroke-[3] animate-in zoom-in duration-200" />
                          )}
                        </div>

                        <div className="relative flex-shrink-0">
                          <img
                            src={user.profile_pic || user.avatar || `https://i.pravatar.cc/150?u=${user.user_id}`}
                            alt={user.full_name || user.name}
                            className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-slate-900 truncate">
                            {user.full_name || user.name}
                          </h4>
                          <span className="text-[11px] text-slate-400 truncate block">
                            @{user.username || 'stoqleID' + user.user_id}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom Send Area */}
            {selectedUsers.length > 0 && (
              <div className="bg-white border-t border-slate-100 p-4 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] z-10 flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500">
                    Send to ({selectedUsers.length}/10):
                  </span>
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                    <AnimatePresence>
                      {selectedUsers.map((su, sIdx) => (
                        <motion.div
                          key={`sel-${su.user_id}-${sIdx}`}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          className="relative shrink-0"
                        >
                          <img
                            src={su.profile_pic || su.avatar || `https://i.pravatar.cc/150?u=${su.user_id}`}
                            className="w-8 h-8 rounded-full object-cover ring-2 ring-white shadow-sm"
                            alt="selected"
                          />
                          <button
                            onClick={() => handleToggleUser(su)}
                            className="absolute -top-1 -right-1 bg-white rounded-full text-slate-400 hover:text-rose-500 shadow-sm border border-slate-100"
                          >
                            <XMarkIcon className="w-3 h-3" />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <textarea
                    className="flex-1 bg-transparent border-none text-sm text-slate-800 placeholder:text-slate-400 resize-none outline-none min-h-[40px] max-h-[100px]"
                    placeholder="Write a message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={2}
                  />
                  {currentUser && (
                    <img
                      src={currentUser.profile_pic || currentUser.avatar || "/assets/images/favio.png"}
                      alt="You"
                      className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm shrink-0"
                    />
                  )}
                </div>

                <button
                  onClick={handleSend}
                  disabled={selectedUsers.length === 0 || sending}
                  className="w-full py-3 bg-rose-500 disabled:bg-rose-400 text-white rounded-full  shadow-lg shadow-rose-500/30 active:scale-[0.98] transition-all flex items-center justify-center"
                >
                  {sending ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    `Send individually`
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #f1f5f9; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #e2e8f0; }
      `}</style>
    </AnimatePresence>
  );
};

export default ShareToFriendsModal;
