import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Sora } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/components/auth-provider";
import { OptimisticUIProvider } from "@/components/optimistic-ui";
import { GlobalSpotlight } from "@/components/global-spotlight";
import { NavShell } from "@/components/nav-shell";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const sora = Sora({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Cellex — Nigeria's #1 Marketplace",
  description: "Shop electronics, fashion, home goods and more. Social ecommerce with live shopping, group buys, and AI-powered discovery.",
  keywords: ["Cellex", "Nigeria", "marketplace", "ecommerce", "online shopping"],
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${jakarta.variable} ${sora.variable} antialiased bg-background text-foreground min-h-screen flex flex-col`}
      >
        <AuthProvider>
          <OptimisticUIProvider>
            <NavShell>
              {children}
            </NavShell>
            <GlobalSpotlight />
            <Toaster />
          </OptimisticUIProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
