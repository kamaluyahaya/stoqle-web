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

                // transform: "translate(-50%, -30%)",
                position: "fixed",
              }}
            />

            <Shell>{children}</Shell>
          </ChatProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
