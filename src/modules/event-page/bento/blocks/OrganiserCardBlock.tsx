import { useState } from 'react';
import { Globe, Instagram, Facebook, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BentoTile } from '@/modules/event-page/bento/BentoTile';
import { BLOCK_COLORS, BLOCK_TITLES } from '@/modules/event-page/bento/BentoGrid';
import type { EventPagePerson, EventPageSnapshot } from '@/modules/event-page/types';
import { supabase } from '@/integrations/supabase/client';
import { getViewerSession } from '@/lib/viewerSession';

// Phase 2 organiser card block (2026-04-28).
//
// Renders one row per organiser with up to three click zones — avatar+name,
// slot 1 pill, slot 2 pill — every one of which Links internally to the
// organiser's profile page (`/organisers/:id`). Zones whose configured
// contact field is empty for the given organiser collapse cleanly so the
// row never shows a half-empty pill.
//
// Layout follows Variant C from the design spec: vertical stack of
// avatar-then-name in column 1, icon-stacked pills (icon over value) in
// columns 2 and 3. Mobile-first; desktop deferred.

type OrganiserCardBlockProps = {
  // eventId is needed by the click-tracking RPC. Nullable because BentoPage
  // can mount briefly with eventId === null during the loading window.
  eventId: string | null;
  organisers: EventPagePerson[];
  card: EventPageSnapshot['organiserCard'];
};

// Phase 3 click tracking. Each cell tap fires record_organiser_card_click_v1
// in the background before React Router navigates. Internal navigation does
// not unload the page, so the in-flight RPC promise still resolves after the
// route change.
const recordCardClick = (eventId: string, organiserId: string, zone: string) => {
  const sessionId = getViewerSession();
  if (!sessionId) return;
  void supabase
    .rpc('record_organiser_card_click_v1' as any, {
      p_event_id:     eventId,
      p_organiser_id: organiserId,
      p_zone:         zone,
      p_session_id:   sessionId,
      p_source:       'organiser_card',
      p_user_agent:   typeof navigator !== 'undefined' ? navigator.userAgent : '',
    })
    .then(() => undefined, () => undefined);
};

const SLOT_ICON: Record<string, typeof Globe> = {
  website: Globe,
  instagram: Instagram,
  facebook: Facebook,
  contact_phone: Phone,
};

const SLOT_LABEL: Record<string, string> = {
  website: 'Website',
  instagram: 'Instagram',
  facebook: 'Facebook',
  contact_phone: 'Phone',
};

// Mirrors ContactsBlock's url-strip helper. Kept inline here rather than
// promoted to a shared util because the contract is the same single-line
// "make this readable on a small chip" formatting.
const stripProtocol = (url: string) =>
  url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');

const handleFromSocial = (url: string): string | null => {
  const withoutQuery = url.split(/[?#]/)[0] ?? '';
  const cleaned = withoutQuery
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');
  const parts = cleaned.split('/').filter(Boolean);
  const first = parts[1];
  if (!first) return null;
  return first.replace(/^@+/, '');
};

// Format a raw contact value for display in a pill. Website → bare domain;
// instagram/facebook → @handle when we can extract one, else the bare
// domain; phone → as-stored. Empty input collapses to the empty string so
// the caller can hide the pill.
const formatSlotValue = (slotKey: string, raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  switch (slotKey) {
    case 'website':
      return stripProtocol(trimmed);
    case 'instagram':
    case 'facebook': {
      if (/^https?:\/\//i.test(trimmed) || /\.[a-z]{2,}/i.test(trimmed)) {
        const h = handleFromSocial(trimmed);
        return h ? `@${h}` : stripProtocol(trimmed);
      }
      return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
    }
    case 'contact_phone':
      return trimmed;
    default:
      return trimmed;
  }
};

const getSlotValue = (organiser: EventPagePerson, slotKey: string | null): string | null => {
  if (!slotKey) return null;
  switch (slotKey) {
    case 'website':       return organiser.website ?? null;
    case 'instagram':     return organiser.instagram ?? null;
    case 'facebook':      return organiser.facebook ?? null;
    case 'contact_phone': return organiser.contactPhone ?? null;
    default: return null;
  }
};

const initialsFromName = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return ((parts[0][0] ?? '') + (parts[1][0] ?? '')).toUpperCase();
};

const cellShellClass =
  'flex flex-col items-center justify-center gap-[6px] rounded-[12px] py-[10px] px-[6px] ' +
  'min-h-[88px] min-w-0 ' +
  'transition-[transform,filter] duration-150 ' +
  'hover:brightness-110 ' +
  'active:scale-[0.97] active:brightness-95 ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40';

const cellShellStyle = {
  background: 'hsl(var(--bento-surface))',
  border: '1px solid var(--bento-hairline)',
  color: 'hsl(var(--bento-fg))',
} as const;

type CellSpec =
  | { kind: 'profile'; organiser: EventPagePerson }
  | { kind: 'pill'; slotKey: string; value: string };

const buildCells = (organiser: EventPagePerson, card: EventPageSnapshot['organiserCard']): CellSpec[] => {
  const cells: CellSpec[] = [{ kind: 'profile', organiser }];
  const slot1Value = getSlotValue(organiser, card.slot1);
  if (card.slot1 && slot1Value) {
    cells.push({ kind: 'pill', slotKey: card.slot1, value: slot1Value });
  }
  const slot2Value = getSlotValue(organiser, card.slot2);
  if (card.slot2 && slot2Value) {
    cells.push({ kind: 'pill', slotKey: card.slot2, value: slot2Value });
  }
  return cells;
};

// Phase 4 polish (2026-04-28): avatar with onError fallback to initials.
// Broken or expired storage URLs would otherwise render the browser's
// missing-image glyph, which looks worse than the initials fallback.
const OrganiserAvatar = ({ url, name }: { url: string | null; name: string }) => {
  const [errored, setErrored] = useState(false);
  const showFallback = !url || errored;
  if (showFallback) {
    return (
      <div
        className="flex h-[52px] w-[52px] items-center justify-center rounded-full text-[14px] font-semibold"
        style={{
          background: 'hsl(var(--bento-surface-raised))',
          border: '2px solid hsl(var(--bento-accent))',
          color: 'hsl(var(--bento-fg))',
        }}
      >
        {initialsFromName(name)}
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={name}
      onError={() => setErrored(true)}
      className="h-[52px] w-[52px] rounded-full object-cover"
      style={{ border: '2px solid hsl(var(--bento-accent))' }}
    />
  );
};

const renderCellContent = (cell: CellSpec) => {
  if (cell.kind === 'profile') {
    const { organiser } = cell;
    const name = organiser.displayName ?? '(unnamed)';
    return (
      <>
        <OrganiserAvatar url={organiser.avatarUrl ?? null} name={name} />
        <span
          className="line-clamp-2 max-w-full text-center text-[11px] font-semibold leading-tight"
          style={{ color: 'hsl(var(--bento-fg))' }}
        >
          {name}
        </span>
      </>
    );
  }
  // Pill cell: icon stacked above value. Icon-on-top defaults the layout
  // away from horizontal-pill cramming so long domains don't truncate at
  // narrow viewport widths (per the 375 px / 110-per-column sanity check).
  const Icon = SLOT_ICON[cell.slotKey] ?? Globe;
  const formatted = formatSlotValue(cell.slotKey, cell.value);
  // Per Ricky 2026-04-28: drop the uppercase WEBSITE / INSTAGRAM label —
  // the icon already conveys the kind of contact, and removing the label
  // gives the value more room and a cleaner look.
  return (
    <>
      <Icon className="h-[18px] w-[18px]" style={{ color: 'hsl(var(--bento-accent))' }} />
      <span
        className="max-w-full truncate text-[12px] font-medium"
        style={{ color: 'hsl(var(--bento-fg))' }}
        title={formatted}
      >
        {formatted}
      </span>
    </>
  );
};

// Tailwind purger can't see dynamic class names — keep the column-count
// classes as full strings so they survive the build.
const MULTI_ORG_GRID_COLS_CLASS: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
};

export const OrganiserCardBlock = ({ eventId, organisers, card }: OrganiserCardBlockProps) => {
  if (organisers.length === 0) return null;

  // Multi-organiser mode (Ricky 2026-04-28): when an event has 2+ organisers,
  // strip the contact pills and render a single horizontal grid of
  // profile-only cells. Keeps the layout compact and avoids confusion when
  // each organiser would otherwise advertise a different website/handle.
  if (organisers.length > 1) {
    const colCount = Math.min(organisers.length, 4) as 2 | 3 | 4;
    const gridCols = MULTI_ORG_GRID_COLS_CLASS[colCount] ?? 'grid-cols-2';
    return (
      <BentoTile
        title={BLOCK_TITLES['organiser-card']}
        color={BLOCK_COLORS['organiser-card']}
        mode="multi-target"
      >
        <div className={`grid ${gridCols} gap-[6px]`}>
          {organisers.map((org) => {
            const profileCell: CellSpec = { kind: 'profile', organiser: org };
            const href = org.href ?? null;
            const ariaLabel = `Open organiser profile: ${org.displayName ?? 'organiser'}`;
            if (!href) {
              return (
                <div key={org.id} className={cellShellClass} style={cellShellStyle}>
                  {renderCellContent(profileCell)}
                </div>
              );
            }
            return (
              <Link
                key={org.id}
                to={href}
                className={cellShellClass}
                style={cellShellStyle}
                aria-label={ariaLabel}
                onClick={() => {
                  if (eventId) recordCardClick(eventId, org.id, 'profile');
                }}
              >
                {renderCellContent(profileCell)}
              </Link>
            );
          })}
        </div>
      </BentoTile>
    );
  }

  // Single-organiser mode: full Variant C with up to 3 click zones per row.
  return (
    <BentoTile
      title={BLOCK_TITLES['organiser-card']}
      color={BLOCK_COLORS['organiser-card']}
      mode="multi-target"
    >
      <div className="flex flex-col gap-[6px]">
        {organisers.map((org) => {
          const cells = buildCells(org, card);
          const gridCols =
            cells.length === 3 ? 'grid-cols-3' : cells.length === 2 ? 'grid-cols-2' : 'grid-cols-1';
          const href = org.href ?? null;
          return (
            <div key={org.id} className={`grid ${gridCols} gap-[6px]`}>
              {cells.map((cell, index) => {
                const ariaLabel =
                  cell.kind === 'profile'
                    ? `Open organiser profile: ${org.displayName ?? 'organiser'}`
                    : `Open organiser profile (${SLOT_LABEL[cell.slotKey] ?? cell.slotKey} link)`;
                if (!href) {
                  return (
                    <div
                      key={`${org.id}-${index}`}
                      className={cellShellClass}
                      style={cellShellStyle}
                    >
                      {renderCellContent(cell)}
                    </div>
                  );
                }
                const zone = cell.kind === 'profile' ? 'profile' : cell.slotKey;
                return (
                  <Link
                    key={`${org.id}-${index}`}
                    to={href}
                    className={cellShellClass}
                    style={cellShellStyle}
                    aria-label={ariaLabel}
                    onClick={() => {
                      if (eventId) recordCardClick(eventId, org.id, zone);
                    }}
                  >
                    {renderCellContent(cell)}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
    </BentoTile>
  );
};
