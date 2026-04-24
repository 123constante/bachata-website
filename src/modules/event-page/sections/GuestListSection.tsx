import { useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { triggerMicroConfetti } from '@/lib/confetti';
import {
  useEventGuestList,
  type GuestListConfig,
  type GuestListEntry,
} from '@/modules/event-page/hooks/useEventGuestList';
import { useSubmitGuestListEntry } from '@/modules/event-page/hooks/useSubmitGuestListEntry';
import { CollisionCard } from '@/modules/event-page/components/CollisionCard';

type GuestListSectionProps = {
  eventId: string | null;
};

// Section-scoped visual styles only. The shared pill base + sweep +
// entry/halo/collision keyframes live in src/index.css so GuestListBlock
// on the main bento grid can reuse them without duplicating CSS.
const sectionStyles = `
  @keyframes gl-shimmer {
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  .gl-shimmer-text {
    background: linear-gradient(90deg, #c8940a, #f5d563, #ffe08a, #f5d563, #c8940a);
    background-size: 200% auto;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    animation: gl-shimmer 4s linear infinite;
  }
  .gl-button {
    position: relative;
    overflow: hidden;
    background: linear-gradient(135deg, #b8860b, #d4a017, #c8940a);
    color: #fff;
    border: 0;
  }
  .gl-button:hover:not(:disabled) {
    background: linear-gradient(135deg, #c8940a, #e6b52c, #d4a017);
  }
  .gl-button::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.22), transparent);
    transform: translateX(-100%);
    animation: gl-sweep 2.8s linear infinite;
    pointer-events: none;
  }
  .gl-card {
    background: transparent;
    border: 0.5px solid rgba(197, 148, 10, 0.18);
    border-radius: 16px;
  }
  .gl-save-badge {
    background: rgba(29, 158, 117, 0.15);
    border: 0.5px solid rgba(29, 158, 117, 0.4);
    color: #5ee6b8;
  }
  .gl-input {
    background: rgba(0, 0, 0, 0.25) !important;
    border: 0.5px solid rgba(197, 148, 10, 0.3) !important;
    color: #fff !important;
    text-align: center;
  }
  .gl-input::placeholder {
    color: rgba(240, 230, 233, 0.35) !important;
    text-align: center;
  }
  .gl-input:focus-visible {
    border-color: rgba(245, 213, 99, 0.55) !important;
    outline: none;
    box-shadow: 0 0 0 1px rgba(245, 213, 99, 0.25) !important;
  }
`;

const MUTED_PRIMARY = 'rgba(240, 230, 233, 0.45)';
const MUTED_SECONDARY = 'rgba(240, 230, 233, 0.35)';
const STRIKE = 'rgba(240, 230, 233, 0.3)';

// Gold palette shared with ConfettiButton — stays on-brand when confetti
// fires over the dark-brown guest-list surface.
const CONFETTI_COLORS = ['#ff9500', '#ff6b00', '#ffb800', '#ff4500', '#ffd700'];
const CONFETTI_PARTICLE_COUNT = 35;
const COLLISION_CARD_EXIT_MS = 220;

type PriceTierProps = {
  label: string;
  regular: number | null;
  guestList: number | null;
};

const PriceTier = ({ label, regular, guestList }: PriceTierProps) => {
  if (regular == null) return null;
  const hasSave = typeof guestList === 'number' && regular > guestList;
  const displayPrice = typeof guestList === 'number' ? guestList : regular;
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 py-1">
      <span className="text-xs" style={{ color: MUTED_PRIMARY }}>{label}</span>
      <span className="gl-shimmer-text text-[17px] font-bold">£{displayPrice}</span>
      {hasSave && (
        <>
          <span className="text-[11px] line-through" style={{ color: STRIKE }}>
            £{regular}
          </span>
          <span className="gl-save-badge rounded-full px-2 py-0.5 text-[10px] font-semibold">
            Save £{regular - (guestList as number)}
          </span>
        </>
      )}
    </div>
  );
};

const shouldRenderPrices = (config: GuestListConfig) =>
  config.regular_party_price != null || config.regular_class_party_price != null;

const normalize = (name: string) => name.trim().toLowerCase();

// React key for a pill. We key by normalized first name rather than id
// because id changes when an optimistic "pending" row is upgraded to the
// confirmed row (either via mutation success or realtime echo), and we
// want React to keep the same DOM node across that transition so the
// spring-in animation doesn't re-fire.
const entryKey = (entry: GuestListEntry): string => normalize(entry.first_name);

export const GuestListSection = ({ eventId }: GuestListSectionProps) => {
  const { data } = useEventGuestList(eventId);
  const submit = useSubmitGuestListEntry(eventId);
  // Realtime subscription is mounted once at the page level (BentoPage)
  // so it keeps updating the shared React Query cache even when this
  // section is unmounted (the JoinGuestListDialog tears it down on close).
  const [name, setName] = useState('');
  const [collidingName, setCollidingName] = useState<string | null>(null);
  const [collisionClosing, setCollisionClosing] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  // Tracks which entry keys have already been rendered, so a pill only
  // gets the spring-in animation the first time React mounts its DOM
  // node (not on every re-render, and not for entries already present
  // on initial page load).
  const seenKeysRef = useRef<Set<string>>(new Set());
  const initialisedRef = useRef(false);

  useEffect(() => {
    if (!data) return;
    data.entries.forEach((e) => seenKeysRef.current.add(entryKey(e)));
    initialisedRef.current = true;
  }, [data]);

  // Memoized fallback so the empty array keeps a stable reference when
  // data is still loading — otherwise the useMemo below churns.
  const entries = useMemo(() => data?.entries ?? [], [data?.entries]);
  const cutoffPassed = data?.cutoff_passed ?? false;
  const enabled = data?.enabled ?? false;

  // Precompute which keys should animate on this render (i.e. new since
  // last mount). Mutating seenKeysRef is done in the useEffect above.
  const freshKeys = useMemo(() => {
    if (!initialisedRef.current) return new Set<string>();
    const fresh = new Set<string>();
    entries.forEach((e) => {
      const k = entryKey(e);
      if (!seenKeysRef.current.has(k)) fresh.add(k);
    });
    return fresh;
    // entries reference changes on every data update — that's what we want
  }, [entries]);

  const fireConfetti = () => {
    const rect = submitButtonRef.current?.getBoundingClientRect();
    if (!rect) return;
    triggerMicroConfetti(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      { particleCount: CONFETTI_PARTICLE_COUNT, colors: CONFETTI_COLORS, ticks: 120 },
    );
  };

  const startClosingCollisionCard = () => {
    setCollisionClosing(true);
    window.setTimeout(() => {
      setCollidingName(null);
      setCollisionClosing(false);
    }, COLLISION_CARD_EXIT_MS);
  };

  const openCollisionCard = (existingName: string) => {
    setCollisionClosing(false);
    setCollidingName(existingName);

    // Append a space (if not already) and put the caret at the end so
    // the user can immediately type a disambiguating letter.
    const typed = name;
    const next = typed.endsWith(' ') ? typed : `${typed} `;
    setName(next);
    window.setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      try {
        el.setSelectionRange(next.length, next.length);
      } catch {
        // some browsers (older Safari) throw on number/email inputs; harmless
      }
    }, 0);
  };

  if (!data || !enabled) return null;

  const { count, config } = data;
  const hasPrices = shouldRenderPrices(config);
  const hasDescription = Boolean(config.description && config.description.trim());
  const hasArriveBefore = Boolean(config.discount_until && config.discount_until.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || submit.isPending) return;

    // Client-side case-insensitive collision check against the cache.
    // The server performs the authoritative check via its unique
    // constraint; the client-side check lets us skip the round-trip for
    // the common case and gate the confetti so we don't celebrate a
    // duplicate submission.
    const lower = normalize(trimmed);
    const match = entries.find(
      (entry) => !entry.pending && normalize(entry.first_name) === lower,
    );
    if (match) {
      openCollisionCard(match.first_name);
      return;
    }

    // Fire confetti at the moment of click for perceived-instant celebration.
    // If the server ultimately rejects (race condition), we roll back the
    // optimistic pill but don't retract the confetti — per spec.
    fireConfetti();

    try {
      const result = await submit.mutateAsync(trimmed);
      if (result.ok) {
        setName('');
        if (collidingName) startClosingCollisionCard();
      } else if (result.reason === 'duplicate_name') {
        // Server caught a collision our client missed (stale cache / race).
        // The optimistic row has already been rolled back in the hook.
        openCollisionCard(trimmed);
      }
      // Other reasons are toasted inside the mutation hook.
    } catch {
      // error toast surfaced in the mutation hook
    }
  };

  return (
    <section className="gl-card p-3 text-center">
      <style>{sectionStyles}</style>

      {/* Header */}
      <div className="mb-4 flex items-center justify-center gap-2">
        <ClipboardList className="h-3.5 w-3.5" style={{ color: MUTED_PRIMARY }} />
        <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: MUTED_PRIMARY }}>
          Guest List
        </p>
      </div>

      {/* Price tiers */}
      {hasPrices && (
        <div className="mb-4 space-y-1">
          <PriceTier
            label="Party only"
            regular={config.regular_party_price}
            guestList={config.guest_list_party_price}
          />
          <PriceTier
            label="Class + party"
            regular={config.regular_class_party_price}
            guestList={config.guest_list_class_party_price}
          />
        </div>
      )}

      {/* Arrive before */}
      {hasArriveBefore && (
        <p className="mt-2 mb-3 text-center text-[10px]" style={{ color: MUTED_SECONDARY }}>
          Arrive before {config.discount_until}
        </p>
      )}

      {/* Description */}
      {hasDescription && (
        <p
          className="mx-auto mb-4 max-w-md text-center"
          style={{ color: 'rgba(240, 230, 233, 0.5)', fontSize: '13px', lineHeight: 1.8 }}
        >
          {config.description.split('\n').map((line, i, arr) => (
            <span key={i}>
              {line}
              {i < arr.length - 1 && <br />}
            </span>
          ))}
        </p>
      )}

      {/* Collision card (Variant B) — mounts above the input when a
          duplicate name is submitted, dismisses on × click or next
          successful submission. */}
      {collidingName && (
        <CollisionCard
          existingName={collidingName}
          onClose={startClosingCollisionCard}
          closing={collisionClosing}
        />
      )}

      {/* Input form OR closed message */}
      {cutoffPassed ? (
        <p className="mt-2 mb-4 text-center text-[10px]" style={{ color: MUTED_PRIMARY }}>
          Guest list is now closed
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mx-auto mb-4 flex max-w-[400px] flex-row items-center gap-2"
        >
          <Input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your first name"
            maxLength={80}
            className="gl-input h-9 flex-1 py-2"
          />
          <Button
            type="submit"
            ref={submitButtonRef}
            disabled={!name.trim()}
            className="gl-button h-9 shrink-0 py-2 font-semibold"
          >
            Add My Name
          </Button>
        </form>
      )}

      {/* Name pills — reserved min-height keeps layout stable when the
          first pill lands on a previously-empty row. */}
      {entries.length > 0 ? (
        <div
          className="mb-2 flex flex-wrap items-center justify-center gap-1.5"
          style={{ minHeight: 22 }}
        >
          {entries.map((entry) => {
            const k = entryKey(entry);
            const isFresh = freshKeys.has(k);
            return (
              <span
                key={k}
                className={cn(
                  'gl-pill rounded-full px-2.5 py-0.5 text-xs font-medium',
                  isFresh && 'gl-pill--entering',
                )}
              >
                <span className="relative z-10">{entry.first_name}</span>
              </span>
            );
          })}
        </div>
      ) : (
        !cutoffPassed && (
          <p className="mb-2 text-xs italic" style={{ color: MUTED_SECONDARY }}>
            Be the first on the list
          </p>
        )
      )}

      {/* Count */}
      {count > 0 && (
        <p className="text-[10px]" style={{ color: 'rgba(240, 230, 233, 0.3)' }}>
          {count} {count === 1 ? 'name' : 'names'} on the guest list
        </p>
      )}
    </section>
  );
};
