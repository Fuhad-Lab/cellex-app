'use client';

/**
 * Template — wraps every page with a fade-in + slide-up animation on navigation.
 * In Next.js App Router, template.tsx re-mounts on every route change
 * (unlike layout.tsx which persists), making it perfect for page transitions.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-page-enter">
      {children}
    </div>
  );
}
