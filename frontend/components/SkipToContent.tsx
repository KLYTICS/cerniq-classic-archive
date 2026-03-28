'use client';

/**
 * Enhanced skip-to-main-content link with visible focus state.
 * Place at the top of the layout, before the header.
 * Improves keyboard navigation for screen reader users.
 */
export default function SkipToContent({ targetId = 'main-content', label = 'Skip to content' }: {
  targetId?: string;
  label?: string;
}) {
  return (
    <a
      href={`#${targetId}`}
      className="
        sr-only
        focus:not-sr-only
        focus:fixed focus:top-3 focus:left-3 focus:z-[9999]
        focus:rounded-lg focus:bg-cyan-700 focus:px-5 focus:py-2.5
        focus:text-sm focus:font-semibold focus:text-white
        focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2
        transition-all
      "
    >
      {label}
    </a>
  );
}
