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
import ReleaseSelectionModal from "../modal/social/ReleaseSelectionModal";
import GlobalPostComposer from "../posts/GlobalPostComposer";

const NAV_HEIGHT = 64;
const SIDEBAR_WIDTH = 300;

export default function Shell({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const pathname = usePathname();

  const isOtherUserProfile = pathname?.startsWith('/user/profile/');
  const isShopPage = pathname?.startsWith('/shop/');
  const isEditProfile = pathname === '/profile/edit';
  const shouldHideGlobalNav = isOtherUserProfile || isShopPage || isEditProfile;

  return (
    <div className=" bg-white relative">
      {!shouldHideGlobalNav && <Navbar height={NAV_HEIGHT} />}
      
      {/* If it's the edit profile or other user profile page, show navbar on large screens only */}
      {(isEditProfile || isOtherUserProfile) && <div className="hidden lg:block"><Navbar height={NAV_HEIGHT} /></div>}

      <Sidebar navHeight={NAV_HEIGHT} width={SIDEBAR_WIDTH} />

      <main className={`${(shouldHideGlobalNav) ? 'pt-0 lg:pt-16' : 'pt-16'} lg:ml-[300px] transition-all duration-300`}>
        {children}
      </main>

      {!shouldHideGlobalNav && (
        <React.Suspense fallback={null}>
          <BottomNav />
        </React.Suspense>
      )}

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
        <React.Suspense fallback={null}>
          <GlobalPostComposer />
        </React.Suspense>
      </div>

      <ReleaseSelectionModal />
    </div>
  );
}
