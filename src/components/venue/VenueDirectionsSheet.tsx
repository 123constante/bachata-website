import { createPortal } from 'react-dom';
import {
  Copy as CopyIcon,
  ExternalLink as ExternalLinkIcon,
  X as XIcon,
  Navigation as NavIcon,
  MapPin as PinIcon,
  Train as TrainIcon,
  Car as CarIcon,
} from 'lucide-react';
import { venueGoldInvertTheme } from './venuePageTheme';

interface VenueDirectionsSheetProps {
  open: boolean;
  venueName: string;
  shortAddress: string;
  fullAddress: string;
  onClose: () => void;
  onCopy: () => void;
}

interface DirAppRow {
  key: string;
  name: string;
  sub: string;
  url: string;
  icon: React.ReactNode;
}

function buildApps(address: string, name: string): DirAppRow[] {
  const enc = encodeURIComponent(address);
  const encName = encodeURIComponent(name);
  return [
    {
      key: 'google',
      name: 'Google Maps',
      sub: 'Fastest driving & walking',
      url: `https://www.google.com/maps/dir/?api=1&destination=${enc}`,
      icon: <NavIcon className="h-5 w-5" />,
    },
    {
      key: 'apple',
      name: 'Apple Maps',
      sub: 'iPhone default',
      url: `https://maps.apple.com/?daddr=${enc}`,
      icon: <PinIcon className="h-5 w-5" />,
    },
    {
      key: 'citymapper',
      name: 'Citymapper',
      sub: 'Best by tube, bus & overground',
      url: `https://citymapper.com/directions?endname=${encName}&endaddress=${enc}`,
      icon: <TrainIcon className="h-5 w-5" />,
    },
    {
      key: 'uber',
      name: 'Uber',
      sub: 'Door to door',
      url: `https://m.uber.com/ul/?action=setPickup&dropoff[nickname]=${encName}&dropoff[formatted_address]=${enc}`,
      icon: <CarIcon className="h-5 w-5" />,
    },
  ];
}

export default function VenueDirectionsSheet({
  open,
  venueName,
  shortAddress,
  fullAddress,
  onClose,
  onCopy,
}: VenueDirectionsSheetProps) {
  if (typeof document === 'undefined') return null;
  const apps = buildApps(fullAddress, venueName);

  const node = (
    <div style={venueGoldInvertTheme as React.CSSProperties}>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[80] backdrop-blur-sm transition-opacity duration-200"
        style={{
          background: 'rgba(0,0,0,0.55)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        aria-hidden="true"
      />
      <div
        className="fixed inset-x-0 bottom-0 z-[81] px-4 pb-7 pt-2.5 transition-transform duration-300"
        style={{
          background: 'var(--va-surface)',
          borderTopLeftRadius: 26,
          borderTopRightRadius: 26,
          borderTop: '1px solid var(--va-line)',
          borderLeft: '1px solid var(--va-line)',
          borderRight: '1px solid var(--va-line)',
          transform: open ? 'translateY(0)' : 'translateY(102%)',
          boxShadow: '0 -20px 50px rgba(0,0,0,0.4)',
          fontFamily: 'var(--va-body)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Get directions"
      >
        <div
          className="mx-auto mb-3.5 h-[5px] w-[38px] rounded-full"
          style={{ background: 'var(--va-line)' }}
        />
        <div className="mb-1 flex items-center justify-between">
          <div>
            <div
              className="text-[19px] font-semibold"
              style={{ fontFamily: 'var(--va-display)', color: 'var(--va-text)' }}
            >
              Get directions
            </div>
            <div className="text-[12.5px]" style={{ color: 'var(--va-text2)' }}>
              to {venueName} &middot; {shortAddress}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border"
            style={{
              background: 'var(--va-surface2)',
              borderColor: 'var(--va-line)',
              color: 'var(--va-text2)',
            }}
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex flex-col gap-2.5 md:mx-auto md:max-w-md">
          {apps.map((app) => (
            <a
              key={app.key}
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="flex items-center gap-3 rounded-[15px] border px-3.5 py-3 no-underline"
              style={{
                background: 'var(--va-surface2)',
                borderColor: 'var(--va-line)',
              }}
            >
              <span
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[11px]"
                style={{
                  background:
                    'color-mix(in srgb, var(--va-accent) 16%, transparent)',
                  color: 'var(--va-accent)',
                }}
              >
                {app.icon}
              </span>
              <span className="flex-1">
                <span
                  className="block text-[15px] font-bold"
                  style={{ color: 'var(--va-text)' }}
                >
                  {app.name}
                </span>
                <span
                  className="block text-[12.5px]"
                  style={{ color: 'var(--va-text3)' }}
                >
                  {app.sub}
                </span>
              </span>
              <ExternalLinkIcon
                className="h-[17px] w-[17px]"
                style={{ color: 'var(--va-text3)' }}
              />
            </a>
          ))}
          <button
            type="button"
            onClick={() => {
              onCopy();
              onClose();
            }}
            className="flex w-full cursor-pointer items-center gap-3 rounded-[15px] border border-dashed px-3.5 py-3 text-left"
            style={{ background: 'transparent', borderColor: 'var(--va-line)' }}
          >
            <span
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[11px]"
              style={{
                background: 'var(--va-surface2)',
                color: 'var(--va-text2)',
              }}
            >
              <CopyIcon className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span
                className="block text-[15px] font-bold"
                style={{ color: 'var(--va-text)' }}
              >
                Copy address
              </span>
              <span
                className="block truncate text-[12.5px]"
                style={{ color: 'var(--va-text3)' }}
              >
                {fullAddress}
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
