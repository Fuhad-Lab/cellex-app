import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Sora } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { MobileNav } from "@/components/mobile-nav";
import { AuthProvider } from "@/components/auth-provider";
import { LayoutShell } from "@/components/layout-shell";
import { SwipeBack } from "@/components/swipe-back";
import { OptimisticUIProvider } from "@/components/optimistic-ui";
import { GlobalSpotlight } from "@/components/global-spotlight";
import { usePathname } from "next/navigation";

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

function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideMobileNav = pathname === '/login' || pathname.startsWith('/product');
  
  return (
    <>
      <SwipeBack>
        <main className={`flex-1 ${hideMobileNav ? '' : 'pb-20 md:pb-0'}`}>
          {children}
        </main>
      </SwipeBack>
      {!hideMobileNav && <MobileNav />}
    </>
  );
}

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
