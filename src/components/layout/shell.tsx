// src/components/layout/shell.tsx
"use client";

import React from "react";
import dynamic from "next/dynamic";

// ── Layout chrome — static imports (visible on first paint) ──────────────────
import Navbar from "./navbar";
import Sidebar from "./sidebar";
import BottomNav from "./bottomNav";

// ── Hooks ─────────────────────────────────────────────────────────────────────
import { useAuth } from "@/src/context/authContext";
import { usePathname, useParams } from "next/navigation";
import { useWallet } from "@/src/context/walletContext";

// ── Providers (moved from root layout) ───────────────────────────────────────
//
//  These five providers bring in socket.io-client, sweetalert2, and API
//  fetch logic. By living here instead of in layout.tsx they are bundled
//  into Shell's client chunk — NOT the root layout's critical chunk —
//  so the browser can parse them after first paint.
//
//  Dependency order matters:
//    AudioProvider must wrap NotificationProvider (notifications play sounds).
//    AuthProvider (still in root) must wrap everything (auth state is universal).
//
import { AudioProvider } from "@/src/context/audioContext";
import { WalletProvider } from "@/src/context/walletContext";
import { NotificationProvider } from "@/src/context/notificationContext";
import { ChatProvider } from "@/src/context/chatContext";
import { CartProvider } from "@/src/context/cartContext";

// ── Modals — all lazy, none visible on first paint ───────────────────────────
//
//  Using next/dynamic with ssr:false means:
//   • Their JS ships in separate chunks (code-split)
//   • Chunks are not requested until the component is first rendered
//   • Zero cost on routes that never trigger them
//
const LoginModal = dynamic(
  () => import("@/src/components/modal/auth/loginModal"),
  { ssr: false }
);

const AccountVerificationModal = dynamic(
  () => import("@/src/components/modal/accountVerificationModal"),
  { ssr: false }
);

const GlobalPostComposer = dynamic(
  () => import("@/src/components/posts/GlobalPostComposer"),
  { ssr: false }
);

const ReleaseSelectionModal = dynamic(
  () => import("@/src/components/modal/social/ReleaseSelectionModal"),
  { ssr: false }
);

const BalanceModal = dynamic(
  () => import("@/src/components/business/balanceModal"),
  { ssr: false }
);

// Toaster is never visible on the first render — defer its entire bundle.
const DynamicToaster = dynamic(
  () => import("sonner").then((m) => ({ default: m.Toaster })),
  { ssr: false }
);

// ─────────────────────────────────────────────────────────────────────────────
const NAV_HEIGHT = 64;
const SIDEBAR_WIDTH = 300;

// ── ShellInner ────────────────────────────────────────────────────────────────
//
//  Separated from the provider tree so that all context hooks (useWallet,
//  useAuth, etc.) are safely called *inside* their respective providers.
//  This also fixes the previous rules-of-hooks violation where useWallet()
//  was called inline as a JSX prop value.
//
function ShellInner({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const { closeWallet, isWalletOpen } = useWallet(); // ← hoisted correctly
  const pathname = usePathname();
  const params = useParams();

  // ── Route-based layout flags ───────────────────────────────────────────────
  const isUsernamePage      = !!params.username;
  const isOtherUserProfile  = pathname?.startsWith("/user/profile/");
  const isMyProfile         = pathname === "/profile";
  const isShopPage          = pathname?.startsWith("/shop/");
  const isEditProfile       = pathname === "/profile/edit";
  const isMessages          = pathname === "/messages";
  const isSettings          = pathname === "/settings";
  const isAccountSecurity   = pathname === "/settings/account-security";
  const isPrivacy           = pathname === "/settings/privacy";
  const isBusinessStatus    = pathname === "/profile/business/business-status";
  const isInventory         = pathname?.startsWith("/profile/business/inventory");
  const isCustomerOrder     = pathname?.startsWith("/profile/business/customer-order");
  const isOrders            = pathname === "/profile/orders";
  const isCommunityGuidelines = pathname === "/community-guidelines";
  const isVendorOnboarding  = pathname === "/profile/business/onboarding";
  const isCartPage           = pathname === "/cart";

  const shouldHideTopNav =
    isMyProfile || isOtherUserProfile || isShopPage || isEditProfile ||
    isMessages || isSettings || isBusinessStatus || isAccountSecurity ||
    isPrivacy || isInventory || isCustomerOrder || isOrders ||
    isCommunityGuidelines || isVendorOnboarding || isUsernamePage;

  const shouldHideBottomNav =
    isOtherUserProfile || isShopPage || isEditProfile || isSettings ||
    isBusinessStatus || isAccountSecurity || isPrivacy || isInventory ||
    isCustomerOrder || isOrders || isCommunityGuidelines ||
    isVendorOnboarding || isUsernamePage;

  return (
    <div className="bg-white relative">
      {/* ── Layout chrome ─────────────────────────────────────────────────── */}
      <Navbar height={NAV_HEIGHT} hideHeaderOnMobile={shouldHideTopNav} />
      <Sidebar navHeight={NAV_HEIGHT} width={SIDEBAR_WIDTH} />

      <main
        className={`${
          isShopPage || isMessages
            ? "pt-0"
            : shouldHideTopNav
            ? "pt-0 lg:pt-16"
            : "pt-16"
        } lg:ml-[300px] transition-[margin-left] duration-300`}
      >
        {children}
      </main>

      {/* BottomNav is conditionally rendered — keep behind Suspense ────────── */}
      {!shouldHideBottomNav && (
        <React.Suspense fallback={null}>
          <BottomNav />
        </React.Suspense>
      )}

      {/* ── Modal layer (all lazy, all on top) ───────────────────────────── */}
      <div className="fixed inset-0 z-[1000000] pointer-events-none">
        {/* Post composer — rendered offscreen/hidden by its own internal state */}
        <GlobalPostComposer />

        {/* Login modal — chunk only loaded when first opened */}
        {auth.loginOpen && (
          <div className="pointer-events-auto">
            <LoginModal
              isOpen={auth.loginOpen}
              onClose={auth.closeLogin}
            />
          </div>
        )}

        {/* Account verification — chunk only loaded when first triggered */}
        {auth.verificationOpen && (
          <div className="pointer-events-auto">
            <AccountVerificationModal
              open={auth.verificationOpen}
              onClose={auth.closeVerification}
              onSuccess={auth.onVerificationSuccess}
            />
          </div>
        )}

        {/* Wallet modal — isolated in WalletWrapper to prevent Shell re-renders */}
        <WalletWrapper
          user={auth.user}
          isOpen={isWalletOpen}
          onClose={closeWallet}
        />
      </div>

      {/* ReleaseSelectionModal manages its own open/close state internally */}
      <ReleaseSelectionModal />

      {/* Toaster — deferred entirely; toast() calls queue until it mounts ─── */}
      <DynamicToaster
        position="top-center"
        theme="dark"
        icons={{
          success: null,
          info: null,
          warning: null,
          error: null,
          loading: null,
        }}
        toastOptions={{
          style: {
            borderRadius: "99px",
            padding: "0.6rem 1.25rem",
            fontSize: "0.750rem",
            fontWeight: "500",
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            color: "#fff",
            backdropFilter: "blur(4px)",
            border: "none",
            boxShadow:
              "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            width: "max-content",
            maxWidth: "90vw",
            margin: "0 auto",
          },
        }}
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          position: "fixed",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

// ── WalletWrapper ─────────────────────────────────────────────────────────────
//
//  Isolated so that wallet state changes only re-render this subtree,
//  not the entire ShellInner. BalanceModal is lazy — its chunk is never
//  fetched unless the wallet is actually opened for the first time.
//
function WalletWrapper({
  user,
  isOpen,
  onClose,
}: {
  user: any;
  isOpen: boolean;
  onClose: () => void;
}) {
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
          currency: wallet?.currency || "₦",
        }}
        role={
          user?.is_business_owner || user?.business_id ? "vendor" : "user"
        }
      />
    </div>
  );
}

// ── Shell (public export) ────────────────────────────────────────────────────
//
//  Provider nesting is intentional:
//   AudioProvider   — must be outermost so NotificationProvider can call
//                     playSound() via useAudio().
//   WalletProvider  — wraps everything that needs wallet balance / socket.
//   NotificationProvider — depends on useAudio + useAuth (from root).
//   ChatProvider    — depends on useAuth (from root).
//   CartProvider    — depends on useAuth (from root).
//   ShellInner      — consumes all of the above safely.
//
export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AudioProvider>
      <WalletProvider>
        <NotificationProvider>
          <ChatProvider>
            <CartProvider>
              <ShellInner>{children}</ShellInner>
            </CartProvider>
          </ChatProvider>
        </NotificationProvider>
      </WalletProvider>
    </AudioProvider>
  );
}
