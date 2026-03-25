// src/components/layout/shell.tsx
"use client";

import React from "react";
import Navbar from "./navbar";
import Sidebar from "./sidebar";
import LoginModal from "@/src/components/modal/auth/loginModal";
import BottomNav from "./bottomNav"; // <-- add this
import { useAuth } from "@/src/context/authContext";
import { usePathname } from "next/navigation";
import AccountVerificationModal from "../modal/accountVerificationModal";

const NAV_HEIGHT = 64;
const SIDEBAR_WIDTH = 300;

export default function Shell({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const pathname = usePathname();

  return (
    <div className=" bg-white relative">
      <Navbar height={NAV_HEIGHT} />
      <Sidebar navHeight={NAV_HEIGHT} width={SIDEBAR_WIDTH} />

      <main className={`${(pathname === '/messages' || pathname?.startsWith('/shop') || pathname === '/profile/business/customer-order' || pathname?.startsWith('/profile/business/inventory')) ? 'pt-0 sm:pt-16' : 'pt-16'} lg:ml-[300px] transition-all duration-300`}>
        {children}
      </main>

      <React.Suspense fallback={null}>
        <BottomNav />
      </React.Suspense>

      {/* 🔥 MODAL LAYER (always on top) */}
      <div className="fixed inset-0 z-[99999] pointer-events-none">
        {auth.loginOpen && (
          <div className="pointer-events-auto">
            <LoginModal
              isOpen={auth.loginOpen}
              onClose={() => auth.closeLogin()}
            />
          </div>
        )}
        {auth.verificationOpen && (
          <div className="pointer-events-auto">
            <AccountVerificationModal
              open={auth.verificationOpen}
              onClose={auth.closeVerification}
              onSuccess={auth.onVerificationSuccess}
            />
          </div>
        )}
      </div>
    </div>
  );
}
