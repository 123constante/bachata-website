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
  const mins = Math.floor((Date.now() - parseUtc(iso).getTime()) / 60000);
  if (mins < 60) return 'Just added';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return days + ' days ago';
  return 'Recently';
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

const CLAMP2: React.CSSProperties = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

// ---------------------------------------------------------------------------
// Card face (shared by the 3D wheel and the reduced-motion strip)
//
// Trimmed to poster + title + "added X ago" (vertically centred). Venue, date
// and the category chip are intentionally not shown here.
// ---------------------------------------------------------------------------

const CardFace = ({ card, gradient }: { card: LatestEventCard; gradient: string }) => {
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
      <div className="flex flex-1 flex-col justify-center p-2.5">
        <h3 className="text-sm font-semibold leading-tight" style={CLAMP2}>
          {card.name}
        </h3>
        <p className="mt-1 text-[0.62rem] text-muted-foreground">{addedAgo(card.createdAt)}</p>
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
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <span className="w-[118%] text-center text-[2.5rem] font-extrabold uppercase leading-[0.92] tracking-[0.06em] text-white/[0.13]">
              Events just added
            </span>
          </div>
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
          Auto-spins &middot; drag to explore
        </p>
      </section>
    </ScrollReveal>
  );
};

export default LatestEventsWheel;
