// src/components/profile/userActivePanel.tsx
"use client";
import React, { useState } from "react";
import { FaChevronRight, FaCamera, FaLock } from "react-icons/fa";
import { useAuth } from "@/src/context/authContext";
import { useEditUserProfile } from "@/src/hooks/useEditUserProfile";
import UserNameIdModal from "./modals/UserNameIdModal";
import UserBioModal from "./modals/UserBioModal";
import UserGenderModal from "./modals/UserGenderModal";
import UserDobModal from "./modals/UserDobModal";
import UserOccupationModal from "./modals/UserOccupationModal";
import UserSchoolModal from "./modals/UserSchoolModal";
import UserLocationModal from "./modals/UserLocationModal";
import ProfileCropperModal from "../modal/profileCropperModal";
import AccountVerificationModal from "../modal/accountVerificationModal";
import AddressListModal from "../modal/addressListModal";
import { fetchUserAddresses, UserAddress } from "@/src/lib/api/addressApi";
import { toast } from "sonner";
import { API_BASE_URL } from "@/src/lib/config";

const DEFAULT_AVATAR = "/assets/images/favio.png";

type ModalKey = "name_id" | "bio" | "gender" | "dob" | "job" | "school" | "location" | "delivery_address" | null;

export default function UserActivePanel() {
  const auth = (useAuth?.() ?? null) as any;
  const user = auth?.user ?? null;
  const token: string | null =
    auth?.token ?? (typeof window !== "undefined" ? localStorage.getItem("token") : null);

  const {
    fullName, bio, gender, dob, location, job, school, profilePic,
    isLoading, isSyncing, saveEditorValue, setProfilePic,
  } = useEditUserProfile({ userId: user?.user_id, token });

  const [activeModal, setActiveModal] = useState<ModalKey>(null);
  const [cropperImage, setCropperImage] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  const isVerified = !!(user?.phone_no && user?.email);

  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [defaultAddress, setDefaultAddress] = useState<UserAddress | null>(null);

  const loadAddresses = async () => {
    if (!token) return;
    try {
      const res = await fetchUserAddresses(token);
      const list = res.data || [];
      setAddresses(list);
      setDefaultAddress(list.find((a: UserAddress) => a.is_default) || list[0] || null);
    } catch (err) {
      console.error("Failed to load addresses:", err);
    }
  };

  React.useEffect(() => {
    if (token) loadAddresses();
  }, [token]);

  const openModal = (key: ModalKey) => {
    if (!isVerified) { setShowVerifyModal(true); return; }
    setActiveModal(key);
  };
  const closeModal = () => setActiveModal(null);

  const handleProfileClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { setCropperImage(reader.result as string); setShowCropper(true); };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!token) return;
    setUploadingProfile(true);
    const formData = new FormData();
    formData.append("profile_pic", croppedBlob, "profile.jpg");
    try {
      const res = await fetch(`${API_BASE_URL}/api/profile/profile-pic`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to update profile pic");
      const json = await res.json();
      const newPicUrl = json.data?.user?.profile_pic || json.data?.profile_pic;
      if (newPicUrl) setProfilePic(newPicUrl);
      if (auth?.onVerificationSuccess) auth.onVerificationSuccess({ ...user, profile_pic: newPicUrl });
      toast.success("Profile picture updated!");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingProfile(false);
      setShowCropper(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin h-8 w-8 border-4 border-rose-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  const currentPic = profilePic || user?.profile_pic || DEFAULT_AVATAR;

  const formatDob = (raw: string) => {
    if (!raw) return null;
    try { return new Date(raw).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" }); }
    catch { return raw; }
  };

  const capFirst = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";

  return (
    <div className="pb-10 bg-slate-100 p-4 min-h-screen">
      <div className="space-y-3 pt-4">

        {/* Profile Picture — no name/ID below */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative cursor-pointer active:scale-95 transition-transform" onClick={handleProfileClick}>
            <div className="w-32 h-32 rounded-full bg-white p-1 shadow-md overflow-hidden border-2 border-white">
              <img src={currentPic} alt="Profile" className="w-full h-full rounded-full object-cover" />
            </div>
            <div className="absolute inset-1 rounded-full bg-black/30 flex items-center justify-center text-white">
              <FaCamera size={24} className="opacity-80" />
            </div>
            <div className="absolute bottom-1 right-2 w-7 h-7 bg-rose-500 rounded-full flex items-center justify-center text-white border-2 border-white shadow-md">
              <span className="text-xl leading-none font-bold mt-[-2px]">+</span>
            </div>
          </div>
        </div>

        {/* Verification banner */}
        {!isVerified && (
          <div
            className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-start gap-3 cursor-pointer active:opacity-80"
            onClick={() => setShowVerifyModal(true)}
          >
            <FaLock className="text-amber-500 mt-0.5 shrink-0" size={16} />
            <div>
              <p className="text-sm font-bold text-amber-800">Verify your account to edit profile</p>
              <p className="text-xs text-amber-600 mt-0.5">
                {!user?.phone_no && !user?.email
                  ? "A phone number and email are required."
                  : !user?.phone_no
                    ? "A phone number is required before you can edit your profile."
                    : "An email address is required before you can edit your profile."}
                {" "}Tap to verify.
              </p>
            </div>
          </div>
        )}

        {/* Identity Group */}
        <ProfileGroup>
          <ProfileRow
            label="Full Name"
            value={fullName}
            isLocked={!isVerified}
            onClick={() => openModal("name_id")}
          />
          <ProfileRow
            label="Stoqle ID"
            value={`@${user?.user_id || "—"}`}
            isLocked={!isVerified}
            onClick={() => openModal("name_id")}
            muted
          />
        </ProfileGroup>

        {/* Bio Group */}
        <ProfileGroup>
          <ProfileRow
            label="Bio"
            value={bio}
            placeholder="Introduce your self"
            isLocked={!isVerified}
            onClick={() => openModal("bio")}
            multiline
          />
        </ProfileGroup>

        {/* Personal Details Group */}
        <ProfileGroup>
          <ProfileRow
            label="Gender"
            value={capFirst(gender)}
            isLocked={!isVerified}
            onClick={() => openModal("gender")}
          />
          <ProfileRow
            label="Date of Birth"
            value={formatDob(dob)}
            placeholder="Edit birthday"
            isLocked={!isVerified}
            onClick={() => openModal("dob")}
          />
          <ProfileRow
            label="Region"
            value={location}
            isLocked={!isVerified}
            onClick={() => openModal("location")}
          />
          <ProfileRow
            label="Occupation"
            value={job}
            placeholder="Edit occupation"
            isLocked={!isVerified}
            onClick={() => openModal("job")}
          />
          <ProfileRow
            label="School"
            value={school}
            placeholder="Add education"
            isLocked={!isVerified}
            onClick={() => openModal("school")}
          />
        </ProfileGroup>

        {/* Logistics Group */}
        <ProfileGroup>
          <ProfileRow
            label="Delivery Address"
            value={defaultAddress ? `${defaultAddress.address_line1}, ${defaultAddress.city}` : "Not set"}
            isLocked={!isVerified}
            onClick={() => openModal("delivery_address")}
            multiline
          />
        </ProfileGroup>

        {/* Sync indicator */}
        {isSyncing && (
          <div className="py-4 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-100 shadow-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Syncing...
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AccountVerificationModal
        open={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        onSuccess={(updatedUser) => {
          if (auth?._onLoginSuccess) auth._onLoginSuccess(updatedUser, token);
          else if (auth?.onPhoneVerified) auth.onPhoneVerified(updatedUser);
          setShowVerifyModal(false);
        }}
      />

      <UserNameIdModal
        open={activeModal === "name_id"}
        initialValue={JSON.stringify({ full_name: fullName, user_id: user?.user_id })}
        onClose={closeModal}
        onSave={(json) => saveEditorValue("name_id", json)}
      />
      <UserBioModal
        open={activeModal === "bio"}
        initialValue={bio}
        onClose={closeModal}
        onSave={(val) => saveEditorValue("bio", val)}
      />
      <UserGenderModal
        open={activeModal === "gender"}
        initialValue={gender}
        onClose={closeModal}
        onSave={(val) => saveEditorValue("gender", val)}
      />
      <UserDobModal
        open={activeModal === "dob"}
        initialValue={dob}
        onClose={closeModal}
        onSave={(val) => saveEditorValue("dob", val)}
      />
      <UserLocationModal
        open={activeModal === "location"}
        initialValue={location}
        onClose={closeModal}
        onSave={(val) => saveEditorValue("location", val)}
      />
      <UserOccupationModal
        open={activeModal === "job"}
        initialValue={job}
        onClose={closeModal}
        onSave={(val) => saveEditorValue("job", val)}
      />
      <UserSchoolModal
        open={activeModal === "school"}
        initialValue={school}
        onClose={closeModal}
        onSave={(val) => saveEditorValue("school", val)}
      />

      <AddressListModal
        open={activeModal === "delivery_address"}
        onClose={closeModal}
        onSelect={(addr) => {
          setDefaultAddress(addr);
          closeModal();
        }}
        onUpdate={loadAddresses}
      />

      {showCropper && cropperImage && (
        <ProfileCropperModal
          isOpen={showCropper}
          image={cropperImage}
          onCropComplete={handleCropComplete}
          onClose={() => setShowCropper(false)}
        />
      )}

      {uploadingProfile && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center">
            <div className="animate-spin h-8 w-8 border-4 border-rose-500 border-t-transparent rounded-full mb-3" />
            <p className="text-sm font-bold text-slate-700">Uploading Picture...</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ProfileGroup — a container for merged rows ───────────────────────────
function ProfileGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl overflow-hidden ">
      <div className="divide-y divide-slate-100">
        {children}
      </div>
    </div>
  );
}

// ── ProfileRow — each field is a row inside a group ─────────────────────────
function ProfileRow({
  label,
  value,
  placeholder = "Not set",
  onClick,
  isLocked,
  muted,
  multiline,
}: {
  label: string;
  value: string | null;
  placeholder?: string;
  onClick: () => void;
  isLocked: boolean;
  muted?: boolean;
  multiline?: boolean;
}) {
  const isEmpty = !value || value.trim() === "";

  return (
    <div
      onClick={onClick}
      className="px-5 py-4 flex items-center gap-3 cursor-pointer active:bg-slate-50 transition"
    >
      {/* Fixed-width label column */}
      <span className="text-sm text-slate-500 w-[110px] shrink-0">
        {label}
      </span>

      {/* Value */}
      <span
        className={`flex-1 text-sm min-w-0 ${isEmpty ? "text-slate-400" : muted ? "text-slate-500" : "text-slate-700"
          } ${multiline ? "line-clamp-2 whitespace-normal" : "truncate"}`}
      >
        {isEmpty ? placeholder : value}
      </span>

      {/* Icon — always right-aligned, same line as label */}
      <div className="shrink-0 ml-2">
        {isLocked
          ? <FaLock className="text-amber-400" size={12} />
          : <FaChevronRight className="text-slate-300" size={13} />
        }
      </div>
    </div>
  );
}
