import { createPortal } from 'react-dom';
import { Navigation, Phone } from 'lucide-react';
import { venueGoldInvertTheme } from './venuePageTheme';

interface VenueStickyBarProps {
  phone: string | null;
  onDirections: () => void;
}

// Floating action bar that sits above BottomNav on mobile.
// Hidden on md+ -- the in-card Get-directions CTA is enough on desktop.
// Portalled to document.body so an ancestor filter / transform on the page
// container does not break position:fixed.
export default function VenueStickyBar({
  phone,
  onDirections,
}: VenueStickyBarProps) {
  if (typeof document === 'undefined') return null;
  const node = (
    <div
      className="fixed inset-x-0 z-40 px-4 pb-3 pt-2.5 md:hidden"
      style={{
        ...(venueGoldInvertTheme as React.CSSProperties),
        bottom:
          'calc(var(--bottom-nav-h, 68px) + env(safe-area-inset-bottom, 0px))',
        background:
          'linear-gradient(to top, var(--va-bg) 55%, color-mix(in srgb, var(--va-bg) 50%, transparent) 80%, transparent)',
        fontFamily: 'var(--va-body)',
      }}
    >
      <div className="mx-auto flex max-w-md gap-2.5">
        {phone ? (
          <a
            href={`tel:${phone}`}
            aria-label="Call venue"
            className="flex h-[54px] w-[54px] flex-shrink-0 items-center justify-center rounded-[15px] border no-underline"
            style={{
              background: 'var(--va-surface)',
              borderColor: 'var(--va-line)',
              color: 'var(--va-text)',
            }}
          >
            <Phone className="h-[22px] w-[22px]" />
          </a>
        ) : null}
        <button
          type="button"
          onClick={onDirections}
          className="flex h-[54px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-[15px] border text-[16px] font-bold"
          style={{
            background: 'var(--va-btn-bg)',
            color: 'var(--va-btn-text)',
            borderColor: 'var(--va-btn-border)',
            fontFamily: 'var(--va-body)',
            boxShadow: '0 12px 26px -10px var(--va-btn-glow)',
          }}
        >
          <Navigation className="h-5 w-5" />
          Get directions
        </button>
      </div>
    </div>
  );
  return createPortal(node, document.body);
}
