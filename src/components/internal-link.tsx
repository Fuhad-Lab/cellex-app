'use client';

import Link from 'next/link';
import type { LinkProps } from 'next/link';

/**
 * InternalLink — wraps next/link with scroll={false}.
 *
 * CRITICAL: By default, Next.js scrolls to the top of the page on every
 * client-side navigation. This fights our useScrollPreservation hook which
 * tries to restore the saved scroll position.
 *
 * By passing scroll={false}, we prevent Next.js from auto-scrolling, giving
 * our useScrollPreservation hook full control over scroll position.
 *
 * Usage: Replace all `import Link from 'next/link'` with
 *        `import InternalLink from '@/components/internal-link'`
 *        and use <InternalLink href="..."> instead of <Link href="...">.
 */

interface InternalLinkProps extends LinkProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  'aria-label'?: string;
}

export function InternalLink({
  children,
  className,
  style,
  onClick,
  ...linkProps
}: InternalLinkProps) {
  return (
    <Link {...linkProps} scroll={false} className={className} style={style} onClick={onClick}>
      {children}
    </Link>
  );
}

export default InternalLink;
