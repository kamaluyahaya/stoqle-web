// src/hooks/useEditUserProfile.ts
"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { API_BASE_URL } from "@/src/lib/config";

export function useEditUserProfile({ userId, token }: { userId?: number | null; token?: string | null }) {
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [location, setLocation] = useState("");
  const [job, setJob] = useState("");
  const [school, setSchool] = useState("");
  const [profilePic, setProfilePic] = useState("");
  const [email, setEmail] = useState("");
  const [phone_no, setPhoneNo] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalProps, setModalProps] = useState<{ key: string; value: string } | null>(null);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Fetch full profile from API on mount/userId change
  useEffect(() => {
    if (!userId || !token) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    fetch(`${API_BASE_URL}/api/profile/view/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((json) => {
        if (!isMounted.current) return;
        const u = json?.data?.user;
        if (u) {
          setFullName(u.full_name ?? "");
          setBio(u.bio ?? "");
          setGender(u.gender ?? "");
          setDob(u.dob ?? "");
          setLocation(u.location ?? "");
          setJob(u.job ?? "");
          setSchool(u.school ?? "");
          setProfilePic(u.profile_pic ?? "");
          setEmail(u.email ?? "");
          setPhoneNo(u.phone_no ?? "");
        }
      })
      .catch((err) => console.error("useEditUserProfile fetch error:", err))
      .finally(() => { if (isMounted.current) setIsLoading(false); });
  }, [userId, token]);

  function openEditor(key: string, value: string) {
    setModalProps({ key, value });
    setModalOpen(true);
  }

  async function saveEditorValue(key: string, val: string) {
    if (!token) { toast.error("Not authenticated"); return; }

    // Optimistic update
    switch (key) {
      case "name_id":
        try { const p = JSON.parse(val); setFullName(p.full_name ?? ""); } catch { }
        break;
      case "bio": setBio(val); break;
      case "gender": setGender(val); break;
      case "dob": setDob(val); break;
      case "location": setLocation(val); break;
      case "job": setJob(val); break;
      case "school": setSchool(val); break;
      case "details":
        try {
          const p = JSON.parse(val);
          setGender(p.gender ?? "");
          setDob(p.dob ?? "");
          setLocation(p.location ?? "");
          setJob(p.job ?? "");
          setSchool(p.school ?? "");
        } catch { }
        break;
    }

    // Build payload
    const payload: Record<string, any> = {};
    switch (key) {
      case "name_id":
        try { const p = JSON.parse(val); payload.full_name = p.full_name ?? ""; } catch { }
        break;
      case "bio": payload.bio = val; break;
      case "gender": payload.gender = val || null; break;
      case "dob": payload.dob = val || null; break;
      case "location": payload.location = val || null; break;
      case "job": payload.job = val || null; break;
      case "school": payload.school = val || null; break;
      case "details":
        try {
          const p = JSON.parse(val);
          payload.gender = p.gender || null;
          payload.dob = p.dob || null;
          payload.location = p.location || null;
          payload.job = p.job || null;
          payload.school = p.school || null;
        } catch { }
        break;
    }

    setIsSyncing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/profile/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error((json as any)?.message || `Server error ${res.status}`);
      }

      toast.success("Saved!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
      console.error("[saveEditorValue] error:", err);
    } finally {
      if (isMounted.current) setIsSyncing(false);
    }
  }

  return {
    fullName, bio, gender, dob, location, job, school, profilePic, email, phone_no,
    isLoading, isSyncing, modalOpen, modalProps,
    openEditor, setModalOpen, saveEditorValue,
    setProfilePic,
  } as const;
}
