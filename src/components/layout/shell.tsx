// src/components/layout/shell.tsx
"use client";

import Navbar from "./navbar";
import Sidebar from "./sidebar";
import LoginModal from "@/src/components/modal/auth/loginModal";
import BottomNav from "./bottomNav"; // <-- add this
import { useAuth } from "@/src/context/authContext";
import { usePathname } from "next/navigation";

const NAV_HEIGHT = 64;
const SIDEBAR_WIDTH = 300;

export default function Shell({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const pathname = usePathname();

  return (
    <div className=" bg-white relative">
      <Navbar height={NAV_HEIGHT} />
      <Sidebar navHeight={NAV_HEIGHT} width={SIDEBAR_WIDTH} />

      <main className={`${(pathname === '/messages' || pathname?.startsWith('/shop')) ? 'pt-0 sm:pt-16' : 'pt-16'} lg:ml-[300px] transition-all duration-300`}>
        {children}
      </main>

      <BottomNav />

      {/* 🔥 MODAL LAYER (always on top) */}
      <div className="fixed inset-0 z-[9999] pointer-events-none">
        {auth.loginOpen && (
          <div className="pointer-events-auto">
            <LoginModal
              isOpen={auth.loginOpen}
              onClose={() => auth.closeLogin()}
            />
          </div>
        )}
      </div>
    </div>
  );
}
