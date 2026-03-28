// src/app/profile/edit/page.tsx
"use client";
import React from "react";
import UserActivePanel from "@/src/components/profile/userActivePanel";
import { useRouter } from "next/navigation";
import { FaChevronLeft } from "react-icons/fa";

export default function EditProfilePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Mobile Top Header */}
      <div className="sticky top-0 z-[100] flex items-center px-4 h-16 lg:hidden">
        <button
          onClick={() => router.back()}
          className="p-1 -ml-1 text-slate-800"
        >
          <FaChevronLeft size={18} />
        </button>
        <div className="absolute left-1/2 -translate-x-1/2 text-sm font-bold text-slate-700">
          Edit Profile
        </div>
      </div>

      <div className="flex-1 lg:pt-4">
        <UserActivePanel />
      </div>
    </div>
  );
}
