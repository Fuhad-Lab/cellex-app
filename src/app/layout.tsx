import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Sora } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/components/auth-provider";
import { OTABootstrap } from "@/components/ota-bootstrap";
import { OptimisticUIProvider } from "@/components/optimistic-ui";
import { GlobalSpotlight } from "@/components/global-spotlight";
import { NavShell } from "@/components/nav-shell";
import { DesktopSidebar } from "@/components/desktop-sidebar";
import { NativeBackGesture } from "@/components/native-back-gesture";
import { AnimationProvider, PageLoader } from "@/components/animation-provider";
import { GlobalStateProvider } from "@/components/global-state-provider";

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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#050508",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="m-0 p-0 overflow-x-hidden">
      <body className={`${jakarta.variable} ${sora.variable} antialiased min-h-screen relative text-black bg-white`}>
        {/* Page Loader — masks initial asset loading */}
        <PageLoader />
        {/* Content Viewport */}
        <div className="relative z-10 w-full min-h-screen">
          {/* Global State Provider — lifts page state (active tab, liked sets,
              feed cache, scroll position, etc.) into the Root Layout so it
              survives ANY number of navigation hops (not just the 2-3 that
              cacheComponents keeps alive). Memory-only, XSS-safe. */}
          <GlobalStateProvider>
            <NativeBackGesture>
              <AuthProvider>
                <OTABootstrap />
                <OptimisticUIProvider>
                  {/* Animation Provider — smooth scroll, text splitting, scroll reveals */}
                  <AnimationProvider>
                    {/* Desktop sidebar (lg+ only). Fixed on the left, content offset via lg:pl-64. */}
                    <DesktopSidebar />
                    {/* Content area: padded left on desktop to make room for the sidebar. */}
                    <div className="md:pl-60 lg:pl-64 xl:pl-72">
                      <NavShell>
                        {children}
                      </NavShell>
                    </div>
                    <GlobalSpotlight />
                    <Toaster />
                  </AnimationProvider>
                </OptimisticUIProvider>
              </AuthProvider>
            </NativeBackGesture>
          </GlobalStateProvider>
        </div>
      </body>
    </html>
  );
}
