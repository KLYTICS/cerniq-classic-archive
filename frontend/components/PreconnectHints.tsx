/**
 * Preconnect hints for critical third-party origins.
 * Reduces connection latency for API calls and font loading.
 * Include in the <head> via Next.js layout or metadata.
 */
export default function PreconnectHints() {
  return (
    <>
      <link rel="preconnect" href="https://api.cerniq.io" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://api.cerniq.io" />
      <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://cdn.segment.com" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://cdn.segment.com" />
    </>
  );
}
