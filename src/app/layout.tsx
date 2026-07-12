import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Sora } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/components/auth-provider";
import { OTABootstrap } from "@/components/ota-bootstrap";
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

// -----------------------------------------------------------------------------
// Viewport configuration — fixes the "page appears zoomed in on first paint"
// bug inside the Capacitor WebView.
//
//   width=device-width               -> match the device's CSS pixel width
//   initial-scale=1, maximum-scale=1 -> never auto-zoom on first paint
//   user-scalable=no                 -> disable pinch-zoom (native app feel)
//   viewport-fit=cover               -> render into the notch / punch-hole area
// -----------------------------------------------------------------------------
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#ffffff",
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
          <OTABootstrap />
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
