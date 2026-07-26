import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Sora } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/components/auth-provider";
import { OTABootstrap } from "@/components/ota-bootstrap";
import { OptimisticUIProvider } from "@/components/optimistic-ui";
import { GlobalSpotlight } from "@/components/global-spotlight";
import { AppChrome } from "@/components/app-chrome";
import { NativeBackGesture } from "@/components/native-back-gesture";

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
        {/* Content Viewport */}
        <div className="relative z-10 w-full min-h-screen">
          <NativeBackGesture>
            <AuthProvider>
              <OTABootstrap />
              <OptimisticUIProvider>
                <AppChrome>
                  {children}
                </AppChrome>
                <GlobalSpotlight />
                <Toaster />
              </OptimisticUIProvider>
            </AuthProvider>
          </NativeBackGesture>
        </div>
      </body>
    </html>
  );
}
