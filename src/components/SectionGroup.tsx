'use client';

/**
 * SectionGroup — modular section container with liquid-glass styling.
 *
 * Aggregates specific content blocks (like a grid of shorts, a profile feed
 * item, or a product details panel) inside an isolated, structurally padded
 * liquid glass container. Sits above the fluid smoke background.
 *
 * Optional header row with title + action button (e.g. "See all").
 */
interface SectionGroupProps {
  title?: string;
  actionText?: string;
  onActionClick?: () => void;
  /** Optional icon element to show next to the title */
  icon?: React.ReactNode;
  /** Remove default padding (use when children provide their own) */
  flush?: boolean;
  children: React.ReactNode;
}

export default function SectionGroup({
  title,
  actionText,
  onActionClick,
  icon,
  flush = false,
  children,
}: SectionGroupProps) {
  return (
    <section
      className={`liquid-glass w-full rounded-2xl flex flex-col gap-4 transition-all duration-300 ${flush ? '' : 'p-6'}`}
    >
      {/* Header row if titles or action buttons are needed */}
      {(title || actionText) && (
        <div className="flex items-center justify-between w-full mb-1">
          {title && (
            <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--cellex-text)' }}>
              {icon}
              {title}
            </h2>
          )}
          {actionText && (
            <button
              onClick={onActionClick}
              className="text-sm font-medium transition-colors"
              style={{ color: 'var(--cellex-coral)' }}
            >
              {actionText}
            </button>
          )}
        </div>
      )}

      {/* Container Content Body */}
      <div className="w-full">
        {children}
      </div>
    </section>
  );
}
