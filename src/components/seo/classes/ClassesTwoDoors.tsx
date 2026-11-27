/**
 * /classes "Two doors" (SEO arc, owner pick C 2026-11-27). Spec: the approved
 * mockup docs/design/classes-rebuild/C.html + PLAN.md (C column), with the
 * owner's keeps (hero + intro stay on the page above this block).
 *
 * A sticky switch flips between "This week" (Next class card + one drawer per
 * day, today and tomorrow open) and "First class" (4 steps + the week's
 * beginners-slot nights with their run of the night). BOTH panels are in the
 * server HTML; the hidden one carries the `hidden` attribute.
 *
 * Rows: every class night (has_class), class-only AND class + social (owner
 * click s1b=all), soonest occurrence per event, in start order. Cancelled
 * nights are already dropped at the shared fetch (seoLandingEvents).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { eventHref } from '@/lib/seo/eventHref';
import { useListImpressions } from '@/lib/listImpressions';
import type { CalendarEventRow } from '@/integrations/supabase/eventRpcs';
import { formatWallClockTime, wallClockDateKey, wallClockTimeKey } from '@/lib/time/wallClock';
import { addDaysToKey, formatKeyDayLabel } from '@/lib/londonDate';
import { SEO_LANDING_WINDOWS, useSeoLandingEvents } from '@/lib/seoLandingEvents';
import { useLondonToday } from '@/hooks/useLondonToday';
import { serialiseJsonLd } from '@/lib/serialiseJsonLd';
import { isBeginnerSlot, programOf } from '@/lib/classes/classNight';

export const CLASS_FAQS: { q: string; a: string }[] = [
  { q: 'Do I need a partner?', a: 'No. Most classes rotate partners every few minutes, so most people come on their own.' },
  {
    q: 'Which class should a complete beginner pick?',
    a: 'Pick one marked \u201cBeginners slot\u201d. Those nights list a beginners class in their programme, so you start from the basic step.',
  },
  {
    q: 'What is a class + social night?',
    a: 'The class comes first, then the floor opens for social dancing. You can stay and practise what you just learnt, or leave after the class.',
  },
  {
    q: 'What should I wear?',
    a: 'Comfortable clothes and shoes that turn easily on the floor. You do not need dance shoes for a first class.',
  },
];

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const dayKeyOf = (e: CalendarEventRow): string => wallClockDateKey(e.occurrence_starts_at) ?? e.instance_date ?? '';
const startKeyOf = (e: CalendarEventRow): string =>
  (e.occurrence_starts_at as unknown as string | null) ?? e.instance_date ?? '';

/** Class start "HH:MM" (class_start, else the occurrence start); "TBC" when the organiser set no time. */
export const classTime = (e: CalendarEventRow): string =>
  e.has_timed_session === false
    ? 'TBC'
    : (wallClockTimeKey(e.class_start) ?? formatWallClockTime(e.occurrence_starts_at, { hour12: false }) ?? '');

/** London wall clock now, "YYYY-MM-DDTHH:MM" (client only, after mount). */
const londonNowKey = (): string => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date()).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};

const Thumb = ({ src, size, alt = '' }: { src: string | null; size: 'sm' | 'md' | 'lg'; alt?: string }) => {
  const cls = size === 'sm' ? 'w-[44px] h-[44px] rounded-[8px]' : size === 'md' ? 'w-[72px] h-[72px] rounded-[10px]' : 'w-[96px] h-[128px] rounded-[10px]';
  return src ? (
    <img src={src} alt={alt} loading="lazy" decoding="async" className={`${cls} object-cover bg-[#2a1d00] block`} />
  ) : (
    <div className={`${cls} bg-[#2a1d00]`} aria-hidden="true" />
  );
};

const Run = ({ e, className = '' }: { e: CalendarEventRow; className?: string }) => {
  const slots = programOf(e).slice(0, 4);
  if (slots.length === 0) return null;
  return (
    <div className={`border-l-2 border-[#6b4600] pl-[8px] ${className}`}>
      {slots.map((s, i) => (
        <div key={i} className="text-[12px] leading-[1.5] text-[#e4e4e4]">
          {s.start ? <b className="tabular-nums text-[#FFA600] mr-[6px]">{s.start}</b> : null}
          {s.title}
        </div>
      ))}
    </div>
  );
};

const Chevron = () => (
  <span aria-hidden="true" className="justify-self-center text-[20px] text-[#FFA600] rotate-90 group-open:-rotate-90 transition-transform">
    &rsaquo;
  </span>
);

const flipCls = 'mx-[16px] mt-[14px] min-h-[48px] w-[calc(100%-32px)] rounded-[12px] border border-[#333] grid place-items-center text-[14px] font-bold';

export default function ClassesTwoDoors({ serverTodayKey, calendar }: { serverTodayKey: string; calendar: ReactNode }) {
  const trackImpression = useListImpressions('city');
  const todayKey = useLondonToday(serverTodayKey);
  const { data: events = [] } = useSeoLandingEvents(todayKey, SEO_LANDING_WINDOWS.guide);
  const [mode, setMode] = useState<'week' | 'new'>('week');
  const [nowKey, setNowKey] = useState<string | null>(null);
  const switchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNowKey(londonNowKey());
    if (typeof window !== 'undefined' && ['#first-class', '#beginners'].includes(window.location.hash)) setMode('new');
  }, []);

  const rows = useMemo(() => {
    const sorted = (events as CalendarEventRow[])
      .filter((e) => e.has_class)
      .sort((a, b) => startKeyOf(a).localeCompare(startKeyOf(b)));
    const seen = new Set<string>();
    return sorted.filter((e) => (seen.has(e.event_id) ? false : (seen.add(e.event_id), true)));
  }, [events]);

  const days = useMemo(() => {
    const out: { key: string; rows: CalendarEventRow[] }[] = [];
    for (const e of rows) {
      const key = dayKeyOf(e);
      const last = out[out.length - 1];
      if (last && last.key === key) last.rows.push(e);
      else out.push({ key, rows: [e] });
    }
    return out;
  }, [rows]);

  const beginners = useMemo(() => rows.filter(isBeginnerSlot), [rows]);
  // Server + first client render: the first row. After mount: the first row not yet started.
  const next = (nowKey ? rows.find((e) => `${dayKeyOf(e)}T${classTime(e)}` >= nowKey) : undefined) ?? rows[0];
  const tomorrowKey = addDaysToKey(todayKey, 1);
  const whenWord = (key: string) =>
    key === todayKey ? 'tonight' : key === tomorrowKey ? 'tomorrow' : (formatKeyDayLabel(key) ?? '').split(' ')[0];
  const n = rows.length;
  const nClasses = `${n} ${n === 1 ? 'class' : 'classes'}`;
  const updated = formatKeyDayLabel(todayKey);

  const go = (m: 'week' | 'new') => {
    setMode(m);
    switchRef.current?.scrollIntoView?.({ block: 'start' });
  };

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: CLASS_FAQS.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };

  const tab = (m: 'week' | 'new', label: string, sub: string) => (
    <button
      type="button"
      role="tab"
      id={`tab-${m}`}
      aria-selected={mode === m}
      aria-controls={`panel-${m}`}
      onClick={() => setMode(m)}
      className={`min-h-[48px] rounded-[10px] flex flex-col items-center justify-center text-[15px] font-extrabold leading-[1.15] ${mode === m ? 'bg-[#FFA600] text-black' : 'text-[#ababab]'}`}
    >
      {label}
      <small className="text-[11px] font-medium">{sub}</small>
    </button>
  );

  return (
    <div className="text-white text-[14px] leading-[1.4]" data-testid="classes-two-doors">
      <p className="px-[16px] text-[13px] text-[#ababab]" data-testid="updated-line">
        {nClasses} this week{updated ? <> &middot; updated {updated}</> : null}
      </p>

      <div ref={switchRef} className="sticky top-[60px] z-[5] bg-black px-[16px] py-[10px] border-b border-[#262626] mt-[10px] scroll-mt-[60px]">
        <div role="tablist" aria-label="Classes" className="grid grid-cols-2 bg-[#161616] border border-[#2b2b2b] rounded-[14px] p-[4px]">
          {tab('week', 'This week', `${nClasses} by day`)}
          {tab('new', 'First class', 'New to bachata')}
        </div>
      </div>

      <div role="tabpanel" id="panel-week" aria-labelledby="tab-week" hidden={mode !== 'week'}>
        <section id="this-week">
          <h2 className="px-[16px] pt-[20px] text-[19px] font-extrabold leading-[1.2]">This week&rsquo;s bachata classes</h2>
          {n === 0 ? (
            <div className="px-[16px] mt-[10px]">
              <p className="text-[13px] text-[#ababab]">No classes listed for the next seven days.</p>
              <a href="#calendar" className={`${flipCls} !mx-0 !w-full`}>See the full calendar</a>
            </div>
          ) : (
            <>
              {next ? (
                <Link
                  to={eventHref(next)}
                  data-testid="next-class"
                  className="mx-[16px] mt-[14px] grid grid-cols-[96px_1fr] gap-[12px] rounded-[14px] border border-[#6b4600] p-[12px] bg-[linear-gradient(160deg,#2b1c00,#121212_60%)]"
                >
                  <Thumb src={next.cover_image_url} size="lg" alt={`${next.name} flyer`} />
                  <div className="min-w-0">
                    <div className="text-[12px] font-extrabold text-[#FFA600] uppercase tracking-[.05em]">
                      Next class &middot; {whenWord(dayKeyOf(next))} {classTime(next)}
                    </div>
                    <div className="text-[18px] font-black leading-[1.1] mt-[3px]">{next.name}</div>
                    <div className="text-[12px] text-[#ababab] mt-[3px]">
                      {next.location}
                      {next.primary_organiser_name ? <> &middot; {next.primary_organiser_name}</> : null}
                    </div>
                    <Run e={next} className="mt-[8px]" />
                  </div>
                  <span className="col-span-2 min-h-[46px] rounded-[10px] bg-[#FFA600] text-black font-extrabold text-[15px] grid place-items-center">
                    See this class
                  </span>
                </Link>
              ) : null}
              {days.map((d, i) => (
                <details
                  key={d.key}
                  id={`d-${d.key}`}
                  open={i < 2 && (d.key === todayKey || d.key === tomorrowKey) ? true : undefined}
                  className="group mx-[16px] mt-[10px] bg-[#0d0d0d] border border-[#262626] rounded-[12px] overflow-hidden"
                >
                  <summary className="min-h-[52px] px-[12px] grid grid-cols-[1fr_auto_16px] gap-[8px] items-center list-none cursor-pointer [&::-webkit-details-marker]:hidden group-open:border-b group-open:border-[#262626]">
                    <h3 className="text-[15px] font-extrabold">
                      {formatKeyDayLabel(d.key) ?? d.key}
                      {d.key === todayKey ? <small className="block text-[11px] font-medium text-[#8c8c8c]">Today</small> : null}
                      {d.key === tomorrowKey ? <small className="block text-[11px] font-medium text-[#8c8c8c]">Tomorrow</small> : null}
                    </h3>
                    <b className="text-[12px] bg-[#212121] rounded-full px-[9px] py-[2px]">{d.rows.length}</b>
                    <Chevron />
                  </summary>
                  <ul>
                    {d.rows.map((e) => (
                      <li key={`${e.event_id}-${e.instance_date}`} className="border-b border-[#1c1c1c] last:border-b-0">
                        <Link
                          ref={trackImpression(e.event_id)}
                          to={eventHref(e)}
                          className="grid grid-cols-[44px_1fr_auto] gap-[10px] items-center px-[12px] py-[8px] min-h-[60px]"
                        >
                          <Thumb src={e.cover_image_url} size="sm" />
                          <div className="min-w-0">
                            <div className="text-[14px] font-bold leading-[1.2] line-clamp-2">{e.name}</div>
                            <div className="text-[12px] text-[#ababab] mt-[1px]">
                              {e.location} &middot;{' '}
                              {e.has_party ? (
                                <span className="text-[#FFCC33]">
                                  + social {wallClockTimeKey(e.party_start) ?? ''}
                                </span>
                              ) : (
                                'class only'
                              )}
                            </div>
                          </div>
                          <div className="text-right tabular-nums text-[16px] font-extrabold leading-[1.1]">
                            {classTime(e)}
                            {isBeginnerSlot(e) ? (
                              <small className="block text-[10px] font-bold text-black bg-[#FFA600] rounded-[4px] px-[4px] py-[1px] mt-[3px]">
                                BEGINNERS
                              </small>
                            ) : null}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </>
          )}
        </section>
        <button type="button" onClick={() => go('new')} className={flipCls}>
          New to bachata? See the first-class guide
        </button>
      </div>

      <div role="tabpanel" id="panel-new" aria-labelledby="tab-new" hidden={mode !== 'new'}>
        <section id="first-class">
          <h2 className="px-[16px] pt-[20px] text-[19px] font-extrabold leading-[1.2]">Your first bachata class in London</h2>
          <ol className="mx-[16px] mt-[14px]">
            {[
              [
                'Pick a beginners class',
                beginners.length === 0
                  ? 'None is listed this week. The guide below helps you choose.'
                  : beginners.length === 1
                    ? '1 night this week runs one. It is listed below.'
                    : `${beginners.length} nights this week run one. They are listed below.`,
              ],
              ['Come on your own', 'The class rotates partners every few minutes.'],
              ['Wear what you can move in', 'Comfortable clothes, shoes that turn easily. No dance shoes needed.'],
              ['Stay for the social', 'After the class the floor opens. Practise, or just watch.'],
            ].map(([t, p], i) => (
              <li key={t} className="grid grid-cols-[36px_1fr] gap-[10px] py-[10px] border-b border-[#1f1f1f]">
                <span aria-hidden="true" className="w-[36px] h-[36px] rounded-full bg-[#FFA600] text-black font-black text-[17px] grid place-items-center">
                  {i + 1}
                </span>
                <div>
                  <strong className="block text-[15px]">{t}</strong>
                  <p className="text-[13px] text-[#ababab]">{p}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section id="beginners">
          <h2 className="px-[16px] pt-[20px] text-[19px] font-extrabold leading-[1.2]">Beginner bachata classes this week</h2>
          {beginners.length === 0 ? (
            <p className="px-[16px] mt-[10px] text-[13px] text-[#ababab]">
              No beginners slot listed this week.{' '}
              <Link to="/learn-bachata-london" className="text-[#FFA600] underline">Read the beginner&rsquo;s guide</Link>
            </p>
          ) : (
            beginners.map((e) => (
              <Link
                key={e.event_id}
                to={eventHref(e)}
                className="block mx-[16px] mt-[10px] bg-[#121212] border border-[#2b2b2b] rounded-[14px] overflow-hidden"
              >
                <div className="grid grid-cols-[72px_1fr] gap-[10px] p-[10px]">
                  <Thumb src={e.cover_image_url} size="md" alt={`${e.name} flyer`} />
                  <div className="min-w-0">
                    <div className="text-[12px] font-extrabold text-[#FFA600]">{formatKeyDayLabel(dayKeyOf(e))}</div>
                    <div className="text-[15px] font-extrabold leading-[1.2] mt-[2px]">{e.name}</div>
                    <div className="text-[12px] text-[#ababab] mt-[2px]">
                      {e.location}
                      {e.primary_organiser_name ? <> &middot; {e.primary_organiser_name}</> : null}
                    </div>
                  </div>
                </div>
                <Run e={e} className="mx-[10px] mb-[10px]" />
                <div className="min-h-[44px] border-t border-[#2b2b2b] grid place-items-center text-[14px] font-bold text-[#FFA600]">
                  See this class &rsaquo;
                </div>
              </Link>
            ))
          )}
        </section>
        <Link to="/learn-bachata-london" className={`${flipCls} border-[#FFA600] text-[#FFA600]`}>
          Read the full beginner&rsquo;s guide &rsaquo;
        </Link>
        <button type="button" onClick={() => go('week')} className={flipCls}>
          See all {nClasses} this week
        </button>
      </div>

      <section id="questions" className="px-[16px] pt-[20px]">
        <h2 className="text-[19px] font-extrabold leading-[1.2]">Bachata class questions</h2>
        {CLASS_FAQS.map(({ q, a }) => (
          <details key={q} className="group border-b border-[#222]">
            <summary className="min-h-[48px] flex items-center justify-between text-[14px] font-semibold list-none cursor-pointer [&::-webkit-details-marker]:hidden">
              {q}
              <span aria-hidden="true" className="text-[20px] font-normal text-[#FFA600] group-open:hidden">+</span>
              <span aria-hidden="true" className="text-[20px] font-normal text-[#FFA600] hidden group-open:inline">&minus;</span>
            </summary>
            <p className="text-[13px] text-[#c9c9c9] pb-[12px]">{a}</p>
          </details>
        ))}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialiseJsonLd(faqLd) }} />
      </section>

      <section id="by-day" className="px-[16px] pt-[20px]">
        <h2 className="text-[19px] font-extrabold leading-[1.2]">Bachata classes by day</h2>
        <div className="grid grid-cols-4 gap-[8px] mt-[10px]">
          {WEEKDAYS.map((w) => (
            <Link
              key={w}
              to={`/bachata-london-${w.toLowerCase()}`}
              className="min-h-[44px] grid place-items-center bg-[#121212] border border-[#2b2b2b] rounded-[10px] text-[13px] font-semibold"
            >
              {w}
            </Link>
          ))}
        </div>
      </section>

      <section id="calendar" className="px-[16px] pt-[20px]">
        <h2 className="text-[19px] font-extrabold leading-[1.2]">Full class calendar</h2>
        <p className="text-[13px] text-[#ababab] mt-[4px] mb-[10px]">Every date beyond this week.</p>
        {calendar}
      </section>

      <section className="px-[16px] pt-[20px] pb-[24px]">
        <h2 className="text-[19px] font-extrabold leading-[1.2]">More in London</h2>
        <div className="grid grid-cols-3 gap-[8px] mt-[10px]">
          {[['/tonight', 'Tonight'], ['/parties', 'Parties'], ['/teachers', 'Teachers']].map(([to, label]) => (
            <Link key={to} to={to} className="min-h-[44px] grid place-items-center border border-[#2b2b2b] rounded-[10px] text-[13px] font-semibold text-[#FFA600]">
              {label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
