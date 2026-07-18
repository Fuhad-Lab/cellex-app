import Link from 'next/link';
import { Store } from 'lucide-react';

/**
 * Custom 404 for storefront URLs.
 * Shown when someone visits /<non-existent-slug>.
 */
export default function StoreNotFound() {
  return (
    <div className="ig-container bg-white min-h-screen flex flex-col items-center justify-center text-center px-6">
      <div className="w-20 h-20 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
        <Store className="w-10 h-10 text-neutral-400" />
      </div>
      <h1 className="text-xl font-bold mb-2">Storefront Not Found</h1>
      <p className="text-sm text-neutral-500 max-w-xs mb-6">
        The store you&apos;re looking for doesn&apos;t exist, or the seller may have changed their name.
      </p>
      <Link
        href="/"
        className="bg-black text-white text-sm font-semibold px-6 py-3 rounded-md hover:bg-neutral-800 transition-colors"
      >
        Go to homepage
      </Link>
    </div>
  );
}
