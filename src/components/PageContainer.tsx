'use client';

/**
 * PageContainer — standardized page layout wrapper.
 *
 * Constrains content to a clean, centered viewport width with structured
 * spacing across all app views. Every page should wrap its content in this
 * so the liquid-glass sections sit consistently above the fluid smoke bg.
 */
interface PageContainerProps {
  children: React.ReactNode;
  /** Optional max-width override. Default 1280px. */
  maxWidth?: number;
}

export default function PageContainer({ children, maxWidth = 1280 }: PageContainerProps) {
  return (
    <div
      className="w-full mx-auto px-4 py-6 flex flex-col gap-6"
      style={{ maxWidth: `${maxWidth}px` }}
    >
      {children}
    </div>
  );
}
