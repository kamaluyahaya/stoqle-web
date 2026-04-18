// app/layout.tsx
import "./globals.css";
import { ReactNode } from "react";
import Shell from "../components/layout/shell";
import { AuthProvider } from "@/src/context/authContext";
import { CacheProvider } from "@/src/context/cacheContext";
import type { Metadata, Viewport } from "next";

// ─── SEO / PWA Metadata ───────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: "stoqle",
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
        {/* Warm up the API connection before any JS runs */}
        <link
          rel="preconnect"
          href={process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}
        />
        <link
          rel="dns-prefetch"
          href={process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}
        />
      </head>
      <body
        className="bg-white text-slate-900 antialiased"
        suppressHydrationWarning
      >
        <AuthProvider>
          <CacheProvider>
            <Shell>{children}</Shell>
          </CacheProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
