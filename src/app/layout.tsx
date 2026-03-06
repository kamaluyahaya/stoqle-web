// app/layout.tsx
import "./globals.css";
import { ReactNode } from "react";
import Shell from "../components/layout/shell";
import { Toaster } from "sonner";
import { AuthProvider } from "@/src/context/authContext";
import { ChatProvider } from "@/src/context/chatContext";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-slate-900 antialiased">
        <AuthProvider>
          <ChatProvider>
            <Toaster
              position="top-center"
              theme="dark"
              richColors
              toastOptions={{
                style: {
                  borderRadius: "9999px",       // rounded-full
                  padding: "0.5rem 1rem",       // px-4 py-2
                  fontSize: "0.875rem",         // text-sm
                  textAlign: "center",
                  justifyItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(0,0,0,0.7)", // bg-black/70
                  color: "#fff",                // text-white
                  backdropFilter: "blur(6px)",  // backdrop-blur-md
                  boxShadow: "0 4px 12px rgba(0,0,0,0.2)", // shadow-lg
                },
              }}
              style={{
                top: "40%",
                left: "54%",
                transform: "translate(-50%, -50%)",
              }}
            />

            <Shell>{children}</Shell>
          </ChatProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
