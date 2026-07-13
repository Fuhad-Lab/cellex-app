/**
 * Template — passthrough.
 *
 * All page transitions are handled by <IOSStack> + <Screen> in the layout.
 * This file exists only because Next.js App Router supports template.tsx;
 * we don't want any double-animation.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
