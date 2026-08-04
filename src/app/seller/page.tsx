'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * /seller — redirects to /seller-dashboard.
 *
 * This page previously duplicated the seller dashboard. We now keep a single
 * canonical dashboard at /seller-dashboard (which has the full feature set:
 * real product/order/video data, avatar modal, quick actions). This redirect
 * ensures old links and bookmarks don't break.
 */
export default function SellerRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/seller-dashboard');
  }, [router]);
  return null;
}
