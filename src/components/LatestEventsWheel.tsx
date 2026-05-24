import { useEffect, useRef, useState } from 'react';
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

const addedAgo = (iso: string): string => {
  const then = parseUtc(iso);
  const totalMins = Math.floor((Date.now() - then.getTime()) / 60000);
  if (totalMins < 1) return 'Added just now';

  const plural = (n: number, unit: string) => n + ' ' + unit + (n === 1 ? '' : 's');

  // under 1 hour: minutes only
  if (totalMins < 60) return 'Added ' + plural(totalMins, 'min') + ' ago';

  const totalHours = Math.floor(totalMins / 60);
  // under 1 day: hours + minutes (drop minutes when zero)
  if (totalHours < 24) {
    const mins = totalMins % 60;
    return 'Added ' + plural(totalHours, 'hour') + (mins ? ' ' + plural(mins, 'min') : '') + ' ago';
  }

  const totalDays = Math.floor(totalHours / 24);
  // under 1 week: days + hours (drop hours when zero)
  if (totalDays < 7) {
    const hours = totalHours % 24;
    return 'Added ' + plural(totalDays, 'day') + (hours ? ' ' + plural(hours, 'hour') : '') + ' ago';
  }

  // older: absolute date (include year only when not the current year)
  const opts: Intl.DateTimeFormatOptions =
    then.getFullYear() === new Date().getFullYear()
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric' };
  return 'Added on ' + then.toLocaleDateString(undefined, opts);
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
// Card face (shared by the 3D wheel and the reduced-motion strip)
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
          New
        </span>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
      </div>
      <div className="flex flex-1 flex-col justify-center gap-1 p-2.5">
        <h3 className="truncate text-[13px] font-extrabold leading-tight">{card.name}</h3>
        <p className="text-[0.62rem] text-muted-foreground">{addedAgo(card.createdAt)}</p>
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

  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const stageRef = useRef<HTMLDivElement>(null);
  const cardEls = useRef<Array<HTMLButtonElement | null>>([]);
  const rafRef = useRef<number>();
  const baseRef = useRef(0);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const lastXRef = useRef(0);
  const visibleRef = useRef(true);

  const count = cards?.length ?? 0;

  useEffect(() => {
    if (reducedMotion || count === 0) return;
    const step = 360 / count;
    const R = 230;
    const render = () => {
      for (let i = 0; i < count; i++) {
        const el = cardEls.current[i];
        if (!el) continue;
        const ang = baseRef.current + i * step;
        const facing = Math.cos((ang * Math.PI) / 180);
        el.style.transform = 'rotateY(' + ang + 'deg) translateZ(' + R + 'px)';
        el.style.opacity = String(facing > 0 ? 0.35 + 0.65 * facing : 0.12);
        el.style.zIndex = String(Math.round(facing * 100));
      }
    };
    render();
    const tick = () => {
      if (!draggingRef.current && visibleRef.current) baseRef.current -= 0.07;
      render();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    let io: IntersectionObserver | undefined;
    if (stageRef.current && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (entries) => {
          visibleRef.current = entries[0]?.isIntersecting ?? true;
        },
        { threshold: 0.05 },
      );
      io.observe(stageRef.current);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      io?.disconnect();
    };
  }, [reducedMotion, count]);

  const pick = (card: LatestEventCard) => {
    if (movedRef.current) return; // was a drag, not a tap
    navigate(card.occurrenceId ? '/event/' + card.id + '?occurrenceId=' + card.occurrenceId : '/event/' + card.id);
  };

  if (isLoading) {
    return (
      <section className="mb-2 mt-6 px-4">
        <div className="flex justify-center gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[200px] w-[150px] rounded-2xl" />
          ))}
        </div>
      </section>
    );
  }

  if (!cards || cards.length === 0) return null;

  // Reduced motion: static, horizontally scrollable strip (no spin / no rAF).
  if (reducedMotion) {
    return (
      <section className="mb-2 mt-6">
        <div className="flex gap-3 overflow-x-auto px-4 pb-3 scrollbar-hide">
          {cards.map((card, i) => (
            <button
              key={card.id}
              onClick={() => navigate(card.occurrenceId ? '/event/' + card.id + '?occurrenceId=' + card.occurrenceId : '/event/' + card.id)}
              className="flex w-[150px] shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card text-left transition-colors hover:border-primary/40"
            >
              <CardFace card={card} gradient={GRADIENTS[i % GRADIENTS.length]} />
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <ScrollReveal animation="fadeUp" duration={0.7} delay={0.1}>
      <section className="mb-2 mt-6">
        <p className="relative z-10 mb-8 text-center text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Recently added
        </p>
        <div
          ref={stageRef}
          className="relative mx-auto h-[238px] cursor-grab touch-pan-y select-none active:cursor-grabbing"
          style={{ perspective: '760px', maxWidth: 360 }}
          onPointerDown={(e) => {
            draggingRef.current = true;
            movedRef.current = false;
            lastXRef.current = e.clientX;
          }}
          onPointerMove={(e) => {
            if (!draggingRef.current) return;
            const dx = e.clientX - lastXRef.current;
            if (Math.abs(dx) > 3) movedRef.current = true;
            baseRef.current += dx * 0.5;
            lastXRef.current = e.clientX;
          }}
          onPointerUp={() => {
            draggingRef.current = false;
          }}
          onPointerLeave={() => {
            draggingRef.current = false;
          }}
        >
          <div
            className="absolute left-1/2 top-[18px] h-[200px] w-[150px]"
            style={{ marginLeft: -75, transformStyle: 'preserve-3d' }}
          >
            {cards.map((card, i) => (
              <button
                key={card.id}
                ref={(el) => (cardEls.current[i] = el)}
                onClick={() => pick(card)}
                className="absolute inset-0 flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-left shadow-lg"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <CardFace card={card} gradient={GRADIENTS[i % GRADIENTS.length]} />
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-center text-[0.7rem] text-muted-foreground">
          Swipe to browse &middot; tap to open
        </p>
      </section>
    </ScrollReveal>
  );
};

export default LatestEventsWheel;
