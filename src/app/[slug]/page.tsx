import StorefrontClient from './storefront-client';

/**
 * generateStaticParams — required for `output: 'export'` (APK build).
 *
 * Pre-generates storefront pages for known sellers at build time.
 * For the web build (standalone mode), this is ignored.
 *
 * NOTE: We return a minimal set of slugs. The actual seller data is
 * fetched client-side by StorefrontClient. New sellers created after
 * a build won't have a pre-generated page in the APK until the next
 * build — they can still be accessed via /seller-profile?id=<uuid>.
 */
export function generateStaticParams() {
  // Known seller slugs at build time (from the database)
  // In production, this would be fetched from the API at build time
  return [
    { slug: 'fuhad' },
    { slug: 'lagos-fashion-house' },
    { slug: 'green-valley-farm' },
    { slug: 'home-essentials-ng' },
    { slug: 'glow-beauty-bar' },
    { slug: 'sports-gear-ng' },
    { slug: 'naija-reads' },
    { slug: 'naija-food-mart' },
    { slug: 'techhub-nigeria-updated' },
  ];
}

export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <StorefrontClient params={params} />;
}
