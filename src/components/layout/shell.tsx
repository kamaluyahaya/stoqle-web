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
import { useWallet } from "@/src/context/walletContext";
import BalanceModal from "../business/balanceModal";

const NAV_HEIGHT = 64;
const SIDEBAR_WIDTH = 300;

export default function Shell({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const pathname = usePathname();

  const isOtherUserProfile = pathname?.startsWith('/user/profile/');
  const isShopPage = pathname?.startsWith('/shop/');
  const isEditProfile = pathname === '/profile/edit';
  const isMessages = pathname === '/messages';
  const isSettings = pathname === '/settings';
  const isAccountSecurity = pathname === '/settings/account-security';
  const isPrivacy = pathname === '/settings/privacy';
  const isBusinessStatus = pathname === '/profile/business/business-status';
  const isInventory = pathname?.startsWith('/profile/business/inventory');
  const isCustomerOrder = pathname?.startsWith('/profile/business/customer-order');
  const isOrders = pathname === '/profile/orders';

  const shouldHideTopNav = isOtherUserProfile || isShopPage || isEditProfile || isMessages || isSettings || isBusinessStatus || isAccountSecurity || isPrivacy || isInventory || isCustomerOrder || isOrders;
  const shouldHideBottomNav = isOtherUserProfile || isShopPage || isEditProfile || isSettings || isBusinessStatus || isAccountSecurity || isPrivacy || isInventory || isCustomerOrder || isOrders;

  return (
    <div className=" bg-white relative">
      {!shouldHideTopNav && <Navbar height={NAV_HEIGHT} />}
      
      {/* Top Navbar logic for Large screens only on some pages */}
      {(isEditProfile || isOtherUserProfile || isMessages || isSettings || isBusinessStatus || isAccountSecurity || isPrivacy || isInventory || isCustomerOrder || isOrders) && <div className="hidden lg:block"><Navbar height={NAV_HEIGHT} /></div>}

      <Sidebar navHeight={NAV_HEIGHT} width={SIDEBAR_WIDTH} />

      <main className={`${(isShopPage) ? 'pt-0' : (shouldHideTopNav ? 'pt-0 lg:pt-16' : 'pt-16')} lg:ml-[300px] transition-all duration-300`}>
        {children}
      </main>

      {!shouldHideBottomNav && (
        <React.Suspense fallback={null}>
          <BottomNav />
        </React.Suspense>
      )}

      {/* 🔥 MODAL LAYER (always on top) */}
      <div className="fixed inset-0 z-[1000000] pointer-events-none">
        <React.Suspense fallback={null}>
          <GlobalPostComposer />
        </React.Suspense>

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

        {/* Global Wallet Modal */}
        <WalletWrapper
          user={auth.user}
          onClose={useWallet().closeWallet}
          isOpen={useWallet().isWalletOpen}
        />
      </div>

      <ReleaseSelectionModal />
    </div>
  );
}

/**
 * Separate wrapper to avoid re-rendering entire Shell when wallet state changes
 */
function WalletWrapper({ user, isOpen, onClose }: { user: any, isOpen: boolean, onClose: () => void }) {
  const { wallet } = useWallet();

  if (!isOpen) return null;

  return (
    <div className="pointer-events-auto">
      <BalanceModal
        open={isOpen}
        onClose={onClose}
        balances={{
          available: wallet?.available_balance || 0,
          pending: wallet?.pending_balance || 0,
          currency: wallet?.currency || "₦"
        }}
        role={(user?.is_business_owner || user?.business_id) ? "vendor" : "user"}
      />
    </div>
  );
}
