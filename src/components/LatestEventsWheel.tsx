import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScrollReveal } from '@/components/ScrollReveal';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useLatestEvents, type LatestEventCard } from '@/hooks/useLatestEvents';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// events.created_at is `timestamp` (no tz) -> serialised without a Z. Force UTC
// so "added X ago" is correct regardless of the viewer's timezone.
const parseUtc = (s: string): Date =>
  new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(' ', 'T') + 'Z');

const addedAgo = (iso: string, kind: 'added' | 'updated' = 'added'): string => {
  const then = parseUtc(iso);
  const verb = kind === 'updated' ? 'Updated' : 'Added';
  const totalMins = Math.floor((Date.now() - then.getTime()) / 60000);
  if (totalMins < 1) return verb + ' just now';

  const plural = (n: number, unit: string) => n + ' ' + unit + (n === 1 ? '' : 's');

  // under 1 hour: minutes only
  if (totalMins < 60) return verb + ' ' + plural(totalMins, 'min') + ' ago';

  const totalHours = Math.floor(totalMins / 60);
  // under 1 day: hours + minutes (drop minutes when zero)
  if (totalHours < 24) {
    const mins = totalMins % 60;
    return verb + ' ' + plural(totalHours, 'hour') + (mins ? ' ' + plural(mins, 'min') : '') + ' ago';
  }

  const totalDays = Math.floor(totalHours / 24);
  // under 1 week: days + hours (drop hours when zero)
  if (totalDays < 7) {
    const hours = totalHours % 24;
    return verb + ' ' + plural(totalDays, 'day') + (hours ? ' ' + plural(hours, 'hour') : '') + ' ago';
  }

  // older: absolute date (include year only when not the current year)
  const opts: Intl.DateTimeFormatOptions =
    then.getFullYear() === new Date().getFullYear()
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric' };
  return verb + ' on ' + then.toLocaleDateString(undefined, opts);
};

const GRADIENTS = [
  'from-festival-pink to-primary',
  'from-primary to-accent',
  'from-festival-teal to-festival-blue',
  'from-festival-purple to-festival-pink',
  'from-festival-blue to-festival-teal',
  'from-festival-rose to-primary',
];

const glyphFor = (c: LatestEventCard): string => {
  if (c.type === 'festival') return '\u{1F525}'; // fire
  if (c.hasClass && !c.hasParty) return '\u{1F393}'; // graduation cap
  if (c.hasParty && !c.hasClass) return '\u{1F389}'; // party popper
  return '\u{1F483}'; // dancer
};

// Type chip (emoji + short label) derived from the same fields as glyphFor.
const typeBadge = (c: LatestEventCard): { emoji: string; label: string } => {
  if (c.type === 'festival') return { emoji: '\u{1F525}', label: 'Festival' }; // fire
  if (c.hasClass && c.hasParty) return { emoji: '\u{1F483}', label: 'Class & Party' }; // dancer
  if (c.hasClass) return { emoji: '\u{1F393}', label: 'Class' }; // graduation cap
  if (c.hasParty) return { emoji: '\u{1F389}', label: 'Party' }; // party popper
  return { emoji: '\u{1F483}', label: 'Event' }; // dancer
};

// ---------------------------------------------------------------------------
// Card face (shared by the Recently Added strip)
//
// Poster + single-line title + gold type chip + "added X ago" (vertically
// centred). Long names truncate with an ellipsis; full name is on the event page.
// ---------------------------------------------------------------------------

const CardFace = ({ card, gradient }: { card: LatestEventCard; gradient: string }) => {
  const tb = typeBadge(card);
  return (
    <>
      <div className="relative h-[112px] w-full shrink-0 overflow-hidden">
        {card.coverImage ? (
          <img
            src={card.coverImage}
            alt={card.name}
            width={150}
            height={112}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className={cn('flex h-full w-full items-center justify-center bg-gradient-to-br text-3xl', gradient)}
            aria-hidden
          >
            {glyphFor(card)}
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-gradient-to-br from-primary to-accent px-2 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-wider text-black">
          {card.kind === 'updated' ? 'Updated' : 'New'}
        </span>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
      </div>
      <div className="flex flex-1 flex-col justify-center gap-1 p-2.5">
        <h3 className="truncate text-[13px] font-extrabold leading-tight">{card.name}</h3>
        <p className="text-[0.62rem] text-muted-foreground">{addedAgo(card.createdAt, card.kind)}</p>
        <span className="inline-flex w-fit items-center gap-0.5 rounded-full border border-primary/40 bg-primary/15 px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wide text-accent">
          {tb.emoji} {tb.label}
        </span>
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

export const LatestEventsWheel = () => {
  const navigate = useNavigate();
  const { data: cards, isLoading } = useLatestEvents();
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Gentle auto-scroll (ping-pong) that yields to the user: pauses on
  // touch / hover / wheel and resumes ~2.5s later. Off for reduced-motion;
  // paused while offscreen. Drives scrollLeft directly so a manual swipe
  // takes over instantly.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    let dir = 1;
    let paused = false;
    let visible = true;
    let resumeId = 0;
    const SPEED = 0.35;

    const tick = () => {
      const max = el.scrollWidth - el.clientWidth;
      if (!paused && visible && max > 4) {
        let next = el.scrollLeft + SPEED * dir;
        if (next >= max) { next = max; dir = -1; }
        else if (next <= 0) { next = 0; dir = 1; }
        el.scrollLeft = next;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const pause = () => { paused = true; window.clearTimeout(resumeId); };
    const resumeSoon = () => {
      window.clearTimeout(resumeId);
      resumeId = window.setTimeout(() => { paused = false; }, 2500);
    };
    const bump = () => { pause(); resumeSoon(); };

    el.addEventListener('pointerdown', pause);
    el.addEventListener('pointerup', resumeSoon);
    el.addEventListener('pointercancel', resumeSoon);
    el.addEventListener('touchstart', pause, { passive: true });
    el.addEventListener('touchend', resumeSoon, { passive: true });
    el.addEventListener('mouseenter', pause);
    el.addEventListener('mouseleave', resumeSoon);
    el.addEventListener('wheel', bump, { passive: true });

    let io: IntersectionObserver | undefined;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((es) => { visible = es[0]?.isIntersecting ?? true; }, { threshold: 0.05 });
      io.observe(el);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(resumeId);
      el.removeEventListener('pointerdown', pause);
      el.removeEventListener('pointerup', resumeSoon);
      el.removeEventListener('pointercancel', resumeSoon);
      el.removeEventListener('touchstart', pause);
      el.removeEventListener('touchend', resumeSoon);
      el.removeEventListener('mouseenter', pause);
      el.removeEventListener('mouseleave', resumeSoon);
      el.removeEventListener('wheel', bump);
      io?.disconnect();
    };
  }, [cards]);

  if (isLoading) {
    return (
      <section className="mb-2 mt-6">
        <div className="flex gap-3 overflow-x-auto px-4 pb-3 scrollbar-hide">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[200px] w-[150px] shrink-0 rounded-2xl" />
          ))}
        </div>
      </section>
    );
  }

  if (!cards || cards.length === 0) return null;

  return (
    <ScrollReveal animation="fadeUp" duration={0.7} delay={0.1}>
      <section className="mb-2 mt-6">
        <p className="mb-3 px-4 text-left text-sm font-bold uppercase tracking-[0.18em] text-white">
          Recently added
        </p>
        <div ref={scrollerRef} className="flex gap-3 overflow-x-auto px-4 pb-3 scrollbar-hide">
          {cards.map((card, i) => (
            <button
              key={card.id}
              onClick={() => navigate(card.occurrenceId ? '/event/' + card.id + '?occurrenceId=' + card.occurrenceId : '/event/' + card.id)}
              className="flex w-[150px] shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-[#1c1c1c] text-left shadow-md transition-colors hover:border-primary/40"
            >
              <CardFace card={card} gradient={GRADIENTS[i % GRADIENTS.length]} />
            </button>
          ))}
        </div>
        <p className="mt-2 px-4 text-left text-[0.7rem] text-white">
          Swipe to browse &middot; tap to open
        </p>
      </section>
    </ScrollReveal>
  );
};

export default LatestEventsWheel;
