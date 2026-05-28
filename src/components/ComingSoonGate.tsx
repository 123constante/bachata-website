import { useEffect, type ReactNode } from 'react';
import GlobalLayout from '@/components/layout/GlobalLayout';
import ListingRequestForm from '@/components/ListingRequestForm';
import type { ListingSection } from '@/lib/featureFlags';

interface ComingSoonGateProps {
  /** When true, render the real page (children). When false, render the placeholder. */
  enabled: boolean;
  /** Human-readable label shown in the placeholder header (e.g. "Teachers", "Venue"). */
  title: string;
  /** Section value submitted with the listing request &mdash; must match the listing_request_section enum. */
  section: ListingSection;
  children: ReactNode;
}

// While we're gated, set <meta name="robots" content="noindex,nofollow"> so
// search engines don't index the placeholder. Restore the prior content
// (or remove the meta entirely if we added it) on unmount.
function useNoindexMeta(active: boolean) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;

    const head = document.head;
    let meta = head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previousContent = meta?.getAttribute('content') ?? null;
    const createdHere = !meta;

    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      head.appendChild(meta);
    }
    meta.setAttribute('content', 'noindex,nofollow');

    return () => {
      if (!meta) return;
      if (createdHere) {
        meta.parentNode?.removeChild(meta);
      } else if (previousContent !== null) {
        meta.setAttribute('content', previousContent);
      }
    };
  }, [active]);
}

export default function ComingSoonGate({
  enabled,
  title,
  section,
  children,
}: ComingSoonGateProps) {
  useNoindexMeta(!enabled);

  if (enabled) {
    return <>{children}</>;
  }

  return (
    <GlobalLayout showSubheader={false}>
      <div className="max-w-prose mx-auto px-3 py-8">
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-900 space-y-4">
          <h1 className="text-lg font-semibold text-slate-900">Coming soon &mdash; {title}</h1>
          <p className="text-sm text-slate-700">
            This section is under construction. If you have an event you&rsquo;d like
            on the calendar, drop your details below &mdash; Ricky will call you to add it.
          </p>
          <ListingRequestForm section={section} />
        </div>
      </div>
    </GlobalLayout>
  );
}
