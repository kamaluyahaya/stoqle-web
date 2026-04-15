// src/components/profile/userActivePanel.tsx
"use client";
import React, { useState } from "react";
import { FaChevronRight, FaCamera, FaLock, FaCheckCircle, FaEye, FaEyeSlash } from "react-icons/fa";
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
const DEFAULT_BANNER = "/assets/images/background.png";

type ModalKey = "name_id" | "bio" | "gender" | "dob" | "job" | "school" | "location" | "delivery_address" | null;

export default function UserActivePanel() {
  const auth = (useAuth?.() ?? null) as any;
  const user = auth?.user ?? null;
  const token: string | null =
    auth?.token ?? (typeof window !== "undefined" ? localStorage.getItem("token") : null);

  const {
    fullName, bio, gender, dob, location, job, school, profilePic, bgPhotoUrl, email, phone_no,
    isLoading, isSyncing, saveEditorValue, setProfilePic, setBgPhotoUrl,
  } = useEditUserProfile({ userId: user?.user_id || user?.id, token });

  // Keep auth context in sync with the most recent profile data
  React.useEffect(() => {
    const hasChanges = (email && email !== user?.email) || (phone_no && phone_no !== user?.phone_no);
    if (hasChanges) {
      if (auth?.onVerificationSuccess) {
        auth.onVerificationSuccess({
          ...user,
          email: email || user?.email,
          phone_no: phone_no || user?.phone_no
        });
      }
    }
  }, [email, phone_no, user, auth]);

  const [activeModal, setActiveModal] = useState<ModalKey>(null);
  const [cropperImage, setCropperImage] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [croppingType, setCroppingType] = useState<"profile" | "background">("profile");
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showFullEmail, setShowFullEmail] = useState(false);
  const [showFullPhone, setShowFullPhone] = useState(false);

  const realEmail = email || user?.email;
  const realPhone = phone_no || user?.phone_no;
  const isVerified = !!(realEmail && realPhone); // Strict check: both must be present to allow editing

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
      setCroppingType("profile");
      const reader = new FileReader();
      reader.onload = () => { setCropperImage(reader.result as string); setShowCropper(true); };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleBgClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setCroppingType("background");
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
    const isProfile = croppingType === "profile";
    const endpoint = isProfile ? "profile-pic" : "bg-photo";
    const fieldName = isProfile ? "profile_pic" : "bg_photo";

    formData.append(fieldName, croppedBlob, `${fieldName}.jpg`);

    try {
      const res = await fetch(`${API_BASE_URL}/api/profile/${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error(`Failed to update ${isProfile ? "profile pic" : "background photo"}`);
      const json = await res.json();
      const newUrl = isProfile
        ? (json.data?.user?.profile_pic || json.data?.profile_pic)
        : (json.data?.user?.bg_photo_url || json.data?.bg_photo_url);

      if (newUrl) {
        if (isProfile) {
          setProfilePic(newUrl);
          if (auth?.onVerificationSuccess) auth.onVerificationSuccess({ ...user, profile_pic: newUrl });
        } else {
          setBgPhotoUrl(newUrl);
          if (auth?.onVerificationSuccess) auth.onVerificationSuccess({ ...user, bg_photo_url: newUrl });
        }
      }
      toast.success(`${capFirst(isProfile ? "profile" : "background")} photo updated!`);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingProfile(false);
      setShowCropper(false);
    }
  };

  if (isLoading) {
    return (
      <div className="pb-10 bg-slate-100 p-4 min-h-screen space-y-4 pt-4 animate-pulse">
        {/* Profile Pic Shimmer */}
        <div className="flex flex-col items-center mb-8 mt-4">
          <div className="w-32 h-32 rounded-full bg-slate-200 shadow-sm" />
        </div>

        {/* Groups Shimmer */}
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-xl overflow-hidden divide-y divide-slate-100 border border-slate-50">
            {[1, 2].map(j => (
              <div key={j} className="px-5 py-[1.15rem] flex items-center gap-3">
                <div className="h-3.5 bg-slate-100 rounded w-[90px] shrink-0" />
                <div className="flex-1 h-3.5 bg-slate-50 rounded w-1/2" />
                <div className="h-3.5 bg-slate-100 rounded-full w-3.5 shrink-0" />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  const currentPic = profilePic || user?.profile_pic || DEFAULT_AVATAR;

  const resolveBanner = (url: string) => {
    if (!url) return DEFAULT_BANNER;
    if (url.startsWith("http") || url.startsWith("/")) return url;
    return `${API_BASE_URL}/public/${url}`;
  };

  const currentBg = resolveBanner(bgPhotoUrl || user?.bg_photo_url || "");

  const formatDob = (raw: string) => {
    if (!raw) return null;
    try { return new Date(raw).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" }); }
    catch { return raw; }
  };

  const capFirst = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";

  const maskEmail = (email?: string) => {
    if (!email) return "";
    const [user, domain] = email.split("@");
    if (!domain) return email;
    if (user.length <= 1) return `*@${domain}`;
    return `${"*".repeat(user.length - 1)}${user.slice(-1)}@${domain}`;
  };

  const maskPhone = (phone?: string) => {
    if (!phone) return "";
    if (phone.length <= 4) return phone;
    return `${"*".repeat(phone.length - 4)}${phone.slice(-4)}`;
  };

  return (
    <div className="pb-10 bg-slate-100 p-4 min-h-screen">
      <div className="space-y-3 pt-4">

        {/* Profile Pictures Section */}
        <div className="flex flex-col gap-6 pt-2">
          {/* Profile Picture */}
          <div className="flex flex-col items-center">
            <div className="relative cursor-pointer active:scale-95 transition-transform" onClick={handleProfileClick}>
              <div className="w-28 h-28 rounded-full bg-white p-1 shadow-md overflow-hidden border-2 border-white">
                <img src={currentPic} alt="Profile" className="w-full h-full rounded-full object-cover" />
              </div>
              <div className="absolute inset-1 rounded-full bg-black/20 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <FaCamera size={20} className="opacity-80" />
              </div>
              <div className="absolute bottom-1 right-1 w-7 h-7 bg-rose-500 rounded-full flex items-center justify-center text-white border-2 border-white shadow-md">
                <FaCamera size={12} />
              </div>
            </div>
          </div>

          {/* Background Photo Card */}
          <div
            className="px-5 py-2 bg-white rounded-xl border border-slate-100   flex items-center justify-between cursor-pointer active:bg-slate-50 transition-all"
            onClick={handleBgClick}
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-[12px] text-slate-600 ">Background Photo</span>
            </div>
            <div className="relative w-16 h-10 rounded-lg overflow-hidden bg-slate-50 border border-slate-100 shadow-sm shrink-0">
              <img src={currentBg} alt="Background" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                <FaCamera size={10} className="text-white/90" />
              </div>
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
              <p className="text-xs text-amber-600 mt-0.5">
                {!realPhone && !realEmail
                  ? "A phone number and email are required to edit your profile."
                  : !realPhone
                    ? "A verified phone number is required to edit your profile."
                    : "A verified email address is required to edit your profile."}
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

        {/* Contact Group */}
        <ProfileGroup>
          <ProfileRow
            label="Phone"
            value={showFullPhone ? realPhone : maskPhone(realPhone)}
            placeholder="Add phone number"
            isLocked={false}
            isVerified={!!realPhone}
            isVisible={showFullPhone}
            onToggleVisibility={() => setShowFullPhone(!showFullPhone)}
            onClick={() => {
              if (realPhone) {
                toast.success("Success! Your phone number is already verified.");
                return;
              }
              setShowVerifyModal(true);
            }}
          />
          <ProfileRow
            label="Email"
            value={showFullEmail ? realEmail : maskEmail(realEmail)}
            placeholder="Add email address"
            isLocked={false}
            isVerified={!!realEmail}
            isVisible={showFullEmail}
            onToggleVisibility={() => setShowFullEmail(!showFullEmail)}
            onClick={() => {
              if (realEmail) {
                toast.success("Success! Your email address is already verified.");
                return;
              }
              setShowVerifyModal(true);
            }}
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
          aspect={croppingType === "profile" ? 1 : 16 / 9}
          cropShape={croppingType === "profile" ? "round" : "rect"}
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
  isVerified,
  onToggleVisibility,
  isVisible,
}: {
  label: string;
  value: string | null;
  placeholder?: string;
  onClick: () => void;
  isLocked: boolean;
  muted?: boolean;
  multiline?: boolean;
  isVerified?: boolean;
  onToggleVisibility?: () => void;
  isVisible?: boolean;
}) {
  const isEmpty = !value || value.trim() === "";

  return (
    <div
      onClick={onToggleVisibility ? undefined : onClick}
      className={`px-5 py-4 flex items-center gap-3 cursor-pointer active:bg-slate-50 transition ${onToggleVisibility ? "cursor-default" : ""}`}
    >
      {/* Fixed-width label column */}
      <span
        onClick={onToggleVisibility ? onClick : undefined}
        className={`text-sm text-slate-500 w-[110px] shrink-0 ${onToggleVisibility ? "cursor-pointer" : ""}`}
      >
        {label}
      </span>

      {/* Value */}
      <span
        onClick={onToggleVisibility ? onClick : undefined}
        className={`flex-1 text-sm min-w-0 ${onToggleVisibility ? "cursor-pointer" : ""} ${isEmpty ? "text-slate-400" : muted ? "text-slate-500" : "text-slate-700"
          } ${multiline ? "line-clamp-2 whitespace-normal" : "truncate"}`}
      >
        {isEmpty ? placeholder : value}
      </span>

      {/* Visibility Toggle */}
      {onToggleVisibility && !isEmpty && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleVisibility(); }}
          className="p-1.5 text-slate-400 hover:text-slate-600 active:scale-90 transition rounded-full hover:bg-slate-100"
        >
          {isVisible ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
        </button>
      )}

      {/* Icon — always right-aligned, same line as label */}
      <div
        onClick={onToggleVisibility ? onClick : undefined}
        className={`shrink-0 ml-2 ${onToggleVisibility ? "cursor-pointer" : ""}`}
      >
        {isVerified ? (
          <FaCheckCircle className="text-emerald-500" size={14} />
        ) : isLocked ? (
          <FaLock className="text-amber-400" size={12} />
        ) : (
          <FaChevronRight className="text-slate-300" size={13} />
        )}
      </div>
    </div>
  );
}
