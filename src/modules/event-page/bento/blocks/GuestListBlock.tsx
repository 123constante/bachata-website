import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { triggerMicroConfetti } from '@/lib/confetti';
import { BentoTile } from '@/modules/event-page/bento/BentoTile';
import { BLOCK_COLORS, BLOCK_TITLES } from '@/modules/event-page/bento/BentoGrid';
import {
  useEventGuestList,
  type GuestListConfig,
  type GuestListEntry,
} from '@/modules/event-page/hooks/useEventGuestList';
import { useSubmitGuestListEntry } from '@/modules/event-page/hooks/useSubmitGuestListEntry';
import { CollisionCard } from '@/modules/event-page/components/CollisionCard';
import {
  formatSavingsRange,
  type GuestListPricing,
} from '@/modules/event-page/utils/guestListSavings';
import {
  resolveCutoffAt,
  formatCountdown,
  type CountdownTone,
} from '@/modules/event-page/utils/guestListCountdown';

type GuestListBlockProps = {
  eventId: string | null;
  // Event start ISO + event timezone are required to resolve the
  // stored cutoff_time ("HH:MM" in the event's tz) into a UTC instant
  // for the live countdown. Either may be null on a freshly-loaded
  // page, in which case the countdown row hides.
  eventStartIso: string | null;
  eventTimezone: string | null;
};

// Gold palette for the Add-My-Name confetti burst — matches ConfettiButton.
const CONFETTI_COLORS = ['#ff9500', '#ff6b00', '#ffb800', '#ff4500', '#ffd700'];
const CONFETTI_PARTICLE_COUNT = 35;
const COLLISION_CARD_EXIT_MS = 220;
const COUNTDOWN_TICK_MS = 60_000;
const POST_SUBMIT_REMINDER_MS = 5_000;

const MUTED_PRIMARY = 'rgba(240, 230, 233, 0.55)';
const MUTED_SECONDARY = 'rgba(240, 230, 233, 0.4)';
const STRIKE = 'rgba(240, 230, 233, 0.3)';
const WARNING_ORANGE = '#ff9500';

const COUNTDOWN_TONE_COLOR: Record<CountdownTone, string> = {
  muted: 'rgba(245, 213, 99, 0.55)',
  normal: '#f5d563',
  warning: WARNING_ORANGE,
  urgent: WARNING_ORANGE,
};

const normalize = (name: string) => name.trim().toLowerCase();

// React key for a pill. Normalized first name is stable across the
// pending → confirmed upgrade (optimistic insert or realtime echo), so
// React keeps the same DOM node and the spring-in animation doesn't
// re-fire.
const entryKey = (entry: GuestListEntry): string => normalize(entry.first_name);

const shouldRenderPrices = (config: GuestListConfig) =>
  config.regular_party_price != null || config.regular_class_party_price != null;

type PriceTierProps = {
  label: string;
  regular: number | null;
  guestList: number | null;
};

/** Compact inline price tier — wraps to next line on narrow viewports. */
const PriceTier = ({ label, regular, guestList }: PriceTierProps) => {
  if (regular == null) return null;
  const hasSave = typeof guestList === 'number' && regular > guestList;
  const displayPrice = typeof guestList === 'number' ? guestList : regular;
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[11px]" style={{ color: MUTED_PRIMARY }}>
        {label}
      </span>
      <span className="gl-shimmer-text text-[15px] font-bold leading-none">
        £{displayPrice}
      </span>
      {hasSave && (
        <>
          <span className="text-[10px] line-through" style={{ color: STRIKE }}>
            £{regular}
          </span>
          <span className="gl-save-badge rounded-full px-1.5 py-[1px] text-[9px] font-semibold leading-none">
            Save £{regular - (guestList as number)}
          </span>
        </>
      )}
    </div>
  );
};

export const GuestListBlock = ({
  eventId,
  eventStartIso,
  eventTimezone,
}: GuestListBlockProps) => {
  const { data } = useEventGuestList(eventId);
  const submit = useSubmitGuestListEntry(eventId);

  const [name, setName] = useState('');
  const [collidingName, setCollidingName] = useState<string | null>(null);
  const [collisionClosing, setCollisionClosing] = useState(false);
  const [postSubmitReminderVisible, setPostSubmitReminderVisible] = useState(false);
  const [explainerExpanded, setExplainerExpanded] = useState(false);

  // Stable DOM id for aria-controls pairing between the accordion
  // trigger and its region panel. Safe across multiple instances of
  // the block (none today, but defensive).
  const explainerPanelId = useId();

  // Tick state for the live countdown. One setState per minute is cheap
  // and lets useMemo(computeCountdown) respond to wall-clock changes.
  const [now, setNow] = useState(() => new Date());

  const inputRef = useRef<HTMLInputElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  // Tracks whether the user has already seen the post-submit reminder
  // in this session. Persists across re-renders without triggering them.
  const hasShownReminderOnceRef = useRef(false);

  // Fresh-key tracking: only pills new since the previous render get the
  // spring-in animation.
  const seenKeysRef = useRef<Set<string>>(new Set());
  const initialisedRef = useRef(false);

  const entries = useMemo(() => data?.entries ?? [], [data?.entries]);

  useEffect(() => {
    entries.forEach((e) => seenKeysRef.current.add(entryKey(e)));
    initialisedRef.current = true;
  }, [entries]);

  const freshKeys = useMemo(() => {
    if (!initialisedRef.current) return new Set<string>();
    const fresh = new Set<string>();
    entries.forEach((e) => {
      const k = entryKey(e);
      if (!seenKeysRef.current.has(k)) fresh.add(k);
    });
    return fresh;
  }, [entries]);

  // 60-second tick for the countdown. Using setInterval (not
  // requestAnimationFrame or setTimeout-per-second) because we only
  // need minute-resolution updates. Cleanup on unmount.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), COUNTDOWN_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  // Resolved cutoff instant (UTC). Recomputed only when the inputs
  // change — the minute tick doesn't touch this, it touches `now`.
  const cutoffAt = useMemo(
    () => resolveCutoffAt(data?.config.cutoff_time, eventStartIso, eventTimezone),
    [data?.config.cutoff_time, eventStartIso, eventTimezone],
  );

  // Countdown display string + tone. Recomputed every tick via `now`.
  const countdown = useMemo(() => {
    if (!cutoffAt) return null;
    return formatCountdown(cutoffAt, now);
  }, [cutoffAt, now]);

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
        // older Safari throws on some input types; harmless
      }
    }, 0);
  };

  if (!data || !data.enabled) return null;

  const { count, config, cutoff_passed: cutoffPassed } = data;
  const hasPrices = shouldRenderPrices(config);
  const hasArriveBefore = Boolean(config.discount_until && config.discount_until.trim());
  const hasDescription = Boolean(config.description && config.description.trim());
  const isEmpty = entries.length === 0;

  // B1 headline — savings range derived from pricing tiers.
  const savingsLabel = hasPrices
    ? formatSavingsRange(config as unknown as GuestListPricing)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || submit.isPending) return;

    // Client-side case-insensitive collision check.
    const lower = normalize(trimmed);
    const match = entries.find(
      (entry) => !entry.pending && normalize(entry.first_name) === lower,
    );
    if (match) {
      openCollisionCard(match.first_name);
      return;
    }

    fireConfetti();

    try {
      const result = await submit.mutateAsync(trimmed);
      if (result.ok) {
        setName('');
        if (collidingName) startClosingCollisionCard();
        // Post-submit reminder (B4) — fires ONCE per session on first
        // own-submit success. Friend-adds that follow don't re-trigger.
        if (!hasShownReminderOnceRef.current) {
          hasShownReminderOnceRef.current = true;
          setPostSubmitReminderVisible(true);
          window.setTimeout(
            () => setPostSubmitReminderVisible(false),
            POST_SUBMIT_REMINDER_MS,
          );
        }
      } else if (result.reason === 'duplicate_name') {
        openCollisionCard(trimmed);
      }
    } catch {
      // error toast surfaced in the mutation hook
    }
  };

  return (
    <BentoTile title={BLOCK_TITLES.guest} color={BLOCK_COLORS.guest} mode="multi-target">
      <div className="flex min-h-0 flex-1 flex-col gap-2 pt-1">
        {/* Count line — the number is the dominant social-proof signal
            and sits on the same baseline as the muted qualifier. */}
        <div className="flex items-baseline gap-2">
          <span
            className="text-3xl font-black leading-none tabular-nums tracking-[-0.02em]"
            style={{ color: 'hsl(var(--bento-fg))' }}
          >
            {count}
          </span>
          <span className="text-sm" style={{ color: 'hsl(var(--bento-fg-muted))' }}>
            {count === 1 ? 'dancer on the list' : 'dancers on the list'}
          </span>
        </div>

        {/* B1 — savings headline. Subordinate to the count: text-xs,
            stays gold, still readable but no longer competes. */}
        {savingsLabel && (
          <p
            className="text-center text-xs font-semibold leading-tight"
            style={{ color: '#f5d563' }}
          >
            🎫 Save {savingsLabel} when you&rsquo;re on the list
          </p>
        )}

        {/* Compact pricing row. */}
        {hasPrices && (
          <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1">
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

        {/* Sub-hint line removed — superseded by the expandable
            "How to claim your discount" accordion below the input. */}

        {/* Optional arrive-before hint (event-configured). */}
        {hasArriveBefore && (
          <p className="text-center text-[10px]" style={{ color: MUTED_SECONDARY }}>
            Arrive before {config.discount_until}
          </p>
        )}

        {/* Optional description (event-configured). */}
        {hasDescription && (
          <p
            className="text-center text-[11px]"
            style={{ color: 'rgba(240, 230, 233, 0.55)', lineHeight: 1.5 }}
          >
            {config.description.split('\n').map((line, i, arr) => (
              <span key={i}>
                {line}
                {i < arr.length - 1 && <br />}
              </span>
            ))}
          </p>
        )}

        {/* Vertical pill list OR empty-state placeholder. Pills are
            content-width and centred horizontally via items-center on
            the flex column. */}
        {isEmpty ? (
          <div
            className="flex flex-1 items-center justify-center py-2 text-center text-[13px] italic"
            style={{ color: 'hsl(var(--bento-fg-muted))' }}
          >
            Be the first on the list 👋
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            {entries.map((entry) => {
              const k = entryKey(entry);
              const isFresh = freshKeys.has(k);
              return (
                <span
                  key={k}
                  className={cn(
                    'gl-pill gl-pill--stacked rounded-full',
                    isFresh && 'gl-pill--entering',
                  )}
                  title={entry.first_name}
                >
                  <span className="relative z-10">{entry.first_name}</span>
                </span>
              );
            })}
          </div>
        )}

        {/* Collision card — slides in between pill list and input. */}
        {collidingName && (
          <CollisionCard
            existingName={collidingName}
            onClose={startClosingCollisionCard}
            closing={collisionClosing}
          />
        )}

        {/* B3 — live countdown. Hidden if cutoff already passed (the
            closed-state message below takes over) or if the cutoff
            can't be resolved (missing event start/tz/config). */}
        {countdown && !cutoffPassed && (
          <p
            className={cn(
              'text-center text-xs leading-tight',
              countdown.tone === 'urgent' && 'gl-countdown--urgent',
            )}
            style={{ color: COUNTDOWN_TONE_COLOR[countdown.tone] }}
          >
            {countdown.text}
          </p>
        )}

        {/* Input row OR closed-state message. */}
        {cutoffPassed ? (
          <div
            className="mt-1 text-center text-[11px]"
            style={{ color: 'hsl(var(--bento-fg-muted))' }}
          >
            Guest list is now closed
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-1 flex flex-row items-center gap-2"
          >
            <Input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your first name"
              maxLength={80}
              className="gl-input h-9 flex-1 py-2 text-sm"
            />
            <Button
              type="submit"
              ref={submitButtonRef}
              disabled={!name.trim()}
              className="gl-button h-9 shrink-0 px-3 py-2 text-sm font-semibold"
            >
              Add My Name
            </Button>
          </form>
        )}

        {/* B4 — post-submit reminder. Shown once per session on first
            own-submit success. Reuses gl-collision-card slide-in
            keyframe for consistency. */}
        {postSubmitReminderVisible && (
          <div
            className="gl-collision-card mt-1 rounded-xl px-3 py-2 text-center text-xs font-medium"
            style={{
              background: 'rgba(245, 213, 99, 0.08)',
              border: '0.5px solid rgba(245, 213, 99, 0.3)',
              color: '#f5d563',
            }}
            role="status"
          >
            💃 See you at the event! Show your name at the door.
          </div>
        )}

        {/* "How to claim your discount" accordion — collapsed by
            default. Hidden after the cutoff passes since the join
            flow is terminal at that point. */}
        {!cutoffPassed && (
          <div className="mt-1">
            <button
              type="button"
              onClick={() => setExplainerExpanded((v) => !v)}
              aria-expanded={explainerExpanded}
              aria-controls={explainerPanelId}
              className="mx-auto flex items-center justify-center gap-1 py-1 text-xs hover:underline"
              style={{ color: 'rgba(245, 213, 99, 0.7)' }}
            >
              How to claim your discount
              <ChevronDown
                className={cn(
                  'h-3 w-3 transition-transform duration-200',
                  explainerExpanded && 'rotate-180',
                )}
                aria-hidden
              />
            </button>

            {/* grid-template-rows 0fr → 1fr transition gives a smooth
                open/close without needing JS to measure content
                height. Older browsers (Safari <17.4) fall back to an
                instant show/hide, which is acceptable. */}
            <div
              id={explainerPanelId}
              role="region"
              aria-label="How to claim your discount"
              className={cn(
                'gl-explainer-grid',
                explainerExpanded && 'is-expanded',
              )}
            >
              <div className="min-h-0 overflow-hidden">
                <ol
                  className="mt-1 flex list-none flex-col gap-1.5 rounded-lg p-3 text-xs leading-snug"
                  style={{
                    background: 'rgba(0, 0, 0, 0.2)',
                    color: 'rgba(240, 230, 233, 0.75)',
                  }}
                >
                  {[
                    "Add your name to the list above (and your friends' names too).",
                    'Arrive at the venue on the night of the event.',
                    'Show the staff your name on this list to claim your discount.',
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span
                        className="mt-[1px] inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                        style={{
                          background: 'rgba(245, 213, 99, 0.15)',
                          color: '#f5d563',
                        }}
                        aria-hidden
                      >
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>
    </BentoTile>
  );
};
