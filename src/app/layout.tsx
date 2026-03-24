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

import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "stoqle - Shop smarter. Sell better.",
  description: "Experience the next generation of social commerce on Stoqle.",
  manifest: "/manifest.json",
  icons: {
    icon: "/assets/images/favio.png",
    apple: "/assets/images/favio.png",
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
          <WalletProvider>
            <NotificationProvider>
              <ChatProvider>
                <CartProvider>
                  <Toaster
                    position="top-center"
                    theme="dark"
                    toastOptions={{
                      className: "toast-blink",
                      style: {
                        borderRadius: "9999px",
                        padding: "0.5rem 1.4rem",
                        fontSize: "0.875rem",
                        textAlign: "center",
                        justifyContent: "center",
                        backgroundColor: "rgba(0,0,0,0.85)", // centered dark bg
                        color: "#fff",
                        backdropFilter: "blur(8px)",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                        border: "none",
                        width: "max-content",
                        pointerEvents: "none", // don't block center clicks
                      },
                    }}
                    style={{
                      textAlign: "center",
                      top: "50%",
                      left: "var(--toaster-left, 80%)",
                      transform: "translate(-50%, -30%)",
                      position: "fixed",
                    }}
                  />

                  <Shell>{children}</Shell>
                </CartProvider>
              </ChatProvider>
            </NotificationProvider>
          </WalletProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
