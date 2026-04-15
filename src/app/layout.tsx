// app/layout.tsx
import "./globals.css";
import { ReactNode } from "react";
import Shell from "../components/layout/shell";
import { Toaster } from "sonner";
import { AuthProvider } from "@/src/context/authContext";
import { ChatProvider } from "@/src/context/chatContext";
import { WalletProvider } from "@/src/context/walletContext";
import { NotificationProvider } from "@/src/context/notificationContext";
import { CartProvider } from "@/src/context/cartContext";
import { AudioProvider } from "@/src/context/audioContext";
import { CacheProvider } from "@/src/context/cacheContext";

import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "stoqle - Shop smarter. Sell better.",
  description: "Experience the next generation of social commerce on Stoqle.",
  manifest: "/manifest.json",
  icons: {
    icon: "/assets/images/logos.png",
    apple: "/assets/images/logos.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "stoqle",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"} />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"} />
      </head>
      <body className="bg-white text-slate-900 antialiased" suppressHydrationWarning>
        <AuthProvider>
          <CacheProvider>
            <AudioProvider>
              <WalletProvider>
                <NotificationProvider>
                  <ChatProvider>
                    <CartProvider>
                      <Toaster
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
                            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
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

                      <Shell>{children}</Shell>
                    </CartProvider>
                  </ChatProvider>
                </NotificationProvider>
              </WalletProvider>
            </AudioProvider>
          </CacheProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
