import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowLeft, Copy, Share2 } from 'lucide-react';
import { NationalityFlag } from '@/components/people/NationalityFlag';
import { optimizedImageUrl, srcWidthFor } from '@/lib/imageCdn';
import { PersonAvatar } from '@/components/account/profiles/PersonAvatar';
import { useAuth } from '@/hooks/useAuth';
import { SHARE_MESSAGES, joinHref, shareDancerPage, type ContactLink, type PublicDancerPageModel, type ShareOutcome } from './model';

/**
 * /dancers/:id, v2 (portrait first). Shown only when the loader said the flag is
 * open; app/routes/dancers.tsx owns the head, so nothing here touches it.
 * Every section today's page has is here (inventory: docs/handover/dancer-rebuild-b1b-s2-public.md);
 * the owner's "Your plans" block is passed in by src/pages/DancerProfile.tsx, unchanged.
 * Records no view: the page never did, and the brief adds no recorder.
 */
export type PublicDancerPageV2Props = {
  model: PublicDancerPageModel;
  /** false = the extras read failed: no contact claims (WhatsApp may exist). */
  extrasOk?: boolean;
  /** dancer_profiles.id (kept for the caller; the F13 page lists no appearances). */
  profileId: string;
  /** The path to share and to come back to after Join, e.g. "/dancers/ana-lopez". */
  pathname: string;
  /** Owner-only block (today's "Your plans"), or null. */
  ownerPlans?: ReactNode;
  /**
   * The Dancing tab of /people/:id. Drops ONLY the DANCER label, photo and name (the person
   * page shows them once) and the Back link (the person page has its own). Stats, languages,
   * contacts, share, achievements and the rest stay.
   */
  embedded?: boolean;
};

/**
 * DESIGN DEPARTURE (named, owner-approved 2026-10-18): the public dancer page keeps
 * the TEAL "dancer ID world" (mockup F13) instead of the site's Bachata palette.
 * Website DESIGN.md allows named departures; the reason is recorded in
 * docs/handover/dancer-page-f13-design.md. Only the date line uses the site's Bachata Amber.
 * Font: the site's own stack (inherited), not the mockup's drawing fonts.
 */
const TEAL = {
  page: '#06191F', card: '#0D3340', border: '#1F5566', text: '#EAF7FA', muted: '#8FBAC7',
  accent: '#5EE0E6', gold: '#F2C14E', amber: '#FF9900',
  hero: 'linear-gradient(160deg,#1C7D93 0%,#0F5468 55%,#0A3A4A 100%)',
} as const;

const TAP = { minHeight: 44 } as const;
const PORTRAIT_PX = 116;
/** NationalityFlag sizes the sticker from the photo: 91px photo -> 42px flag (brief: 42px). */
const FLAG_BASIS_PX = 91;

const SectionTitle = ({ children }: { children: ReactNode }) => (
  <h2 className="mt-6 mb-2 text-[13px] font-extrabold uppercase tracking-[1.5px]" style={{ color: TEAL.accent }}>{children}</h2>
);

const Fact = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0 px-1 py-3 text-center">
    <div className="text-[11px] tracking-[2px] uppercase" style={{ color: '#BFE9EE' }}>{label}</div>
    <div className="mt-1 text-[15px] font-extrabold leading-tight break-words">{value}</div>
  </div>
);

const ShareButton = ({ title, pathname }: { title: string; pathname: string }) => {
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);
  const url = typeof window === 'undefined' ? pathname : `${window.location.origin}${pathname}`;
  const onShare = async () => {
    const nav = typeof navigator === 'undefined' ? undefined : navigator;
    const result = await shareDancerPage(
      {
        share: nav?.share ? (d) => nav.share(d) : undefined,
        writeText: nav?.clipboard?.writeText ? (t) => nav.clipboard.writeText(t) : undefined,
      },
      title,
      url,
    );
    setOutcome(result);
  };
  const message = outcome ? SHARE_MESSAGES[outcome] : null;
  return (
    <div>
      <button
        type="button"
        onClick={() => void onShare()}
        className="inline-flex items-center gap-2 px-2 text-[15px] font-bold"
        style={{ ...TAP, color: TEAL.text }}
        data-testid="dancer-share"
      >
        <Share2 className="w-4 h-4" aria-hidden /> Share
      </button>
      <p role="status" aria-live="polite" className="text-[13px] text-right" style={{ color: TEAL.muted }} data-testid="dancer-share-status">
        {message}
      </p>
      {outcome === 'manual' && (
        <input
          readOnly
          value={url}
          aria-label="Link to this page"
          onFocus={(e) => e.currentTarget.select()}
          className="w-full rounded-[10px] px-2 text-[14px]"
          style={{ ...TAP, background: TEAL.card, color: TEAL.text }}
          data-testid="dancer-share-link"
        />
      )}
    </div>
  );
};

const copyLabelFor = (kind: ContactLink['kind']) =>
  ({ instagram: 'Instagram handle', facebook: 'Facebook link', website: 'website link', email: 'email address', whatsapp: 'WhatsApp number' })[kind];

/** C8 Copy: thin divider, icon + "Copy", no box; "Copied" in green for ~2s. Copies the FULL text. */
const CopyButton = ({ kind, text }: { kind: ContactLink['kind']; text: string }) => {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      aria-label={`Copy ${copyLabelFor(kind)}`}
      className="inline-flex items-center justify-center gap-1.5 px-4 h-[50px] text-[13px] font-extrabold shrink-0"
      style={{ borderLeft: `1px solid ${TEAL.border}`, color: copied ? '#4ADE80' : TEAL.accent, background: 'transparent' }}
      data-testid="dancer-copy"
    >
      <Copy className="w-[18px] h-[18px]" aria-hidden />{copied ? 'Copied' : 'Copy'}
    </button>
  );
};

export function PublicDancerPageV2({ model, extrasOk = true, pathname, ownerPlans, embedded = false }: PublicDancerPageV2Props) {
  const { user, authStatus } = useAuth();
  // Signed-out only, and only once auth has settled (no flash for a signed-in dancer).
  const showJoin = authStatus !== 'resolving' && (!user || user.is_anonymous === true);
  const { facts } = model;
  const factItems = [
    facts.dancing && { label: 'Dancing', value: facts.dancing },
    facts.level && { label: 'Level', value: facts.level },
    facts.style && { label: 'Style', value: facts.style },
  ].filter((x): x is { label: string; value: string } => Boolean(x));
  // Embedded: the person page shows the city once in its own header, so only the role stays here.
  const roleCity = [model.role, embedded ? null : model.city].filter(Boolean).join(' \u00b7 ');
  const going = model.goingNext;

  return (
    <div data-profile="dancer" data-testid="dancer-page-v2" className="relative z-10 rounded-[14px] overflow-hidden px-4 pb-6 pt-3" style={{ background: TEAL.page, color: TEAL.text, isolation: 'isolate' }}>
      <div className={`flex items-center ${embedded ? 'justify-end' : 'justify-between'}`} style={TAP}>
        {/* Embedded: the person page owns Back, so a second one here would be a duplicate control. */}
        {!embedded && (
          <Link to="/dancers" className="inline-flex items-center gap-2 text-[15px] font-bold" style={{ ...TAP, color: TEAL.text }} data-testid="dancer-back">
            <ArrowLeft className="w-4 h-4" aria-hidden /> Back
          </Link>
        )}
        <ShareButton title={model.shareTitle} pathname={pathname} />
      </div>

      <header className="mt-2 rounded-[24px] px-4 pt-[22px] pb-2 text-center" style={{ background: TEAL.hero, border: '1px solid #2A7C90', boxShadow: '0 10px 30px rgba(0,0,0,.4)' }} data-testid="dancer-portrait">
        {/* Embedded: label, photo and name come from the person page (shown once). */}
        {!embedded && (
          <>
        <div className="text-[11px] tracking-[2px]" style={{ color: '#CFF3F6' }}>DANCER</div>
        <div className="relative mx-auto mt-3.5" style={{ width: PORTRAIT_PX, height: PORTRAIT_PX }}>
          <div className="w-full h-full rounded-full box-border flex items-center justify-center overflow-hidden" style={{ border: `4px solid ${TEAL.accent}`, background: '#06303B' }} data-testid={model.avatarUrl ? undefined : 'dancer-portrait-placeholder'}>
            <PersonAvatar photoUrl={model.avatarUrl ? optimizedImageUrl(model.avatarUrl, srcWidthFor(PORTRAIT_PX * 2)) : null} name={model.name} size={PORTRAIT_PX - 8} loading="eager" alt={model.name} />
          </div>
          <NationalityFlag code={model.nationalityCode} size={FLAG_BASIS_PX} placement="corner" />
        </div>
        <h1 className="mt-3 text-[26px] font-extrabold leading-tight break-words line-clamp-3" data-testid="dancer-name">{model.name}</h1>
          </>
        )}
        {roleCity && <p className="mt-0.5 text-[14px]" style={{ color: '#DDF6F8' }} data-testid="dancer-role-line">{roleCity}</p>}
        {factItems.length > 0 && (
          <div className="mt-4 grid" style={{ gridTemplateColumns: `repeat(${factItems.length}, minmax(0, 1fr))`, borderTop: '1px solid rgba(255,255,255,.28)' }} data-testid="dancer-facts">
            {factItems.map((f) => <Fact key={f.label} label={f.label} value={f.value} />)}
          </div>
        )}
        {model.languages.length > 0 && (
          <div className="px-1 py-3" style={{ borderTop: '1px solid rgba(255,255,255,.28)', marginTop: factItems.length ? 0 : 16 }} data-testid="dancer-languages">
            <div className="text-[11px] tracking-[2px]" style={{ color: '#BFE9EE' }}>SPEAKS</div>
            <div className="mt-1 text-[15px] font-extrabold break-words">{model.languages.join(', ')}</div>
          </div>
        )}
      </header>

      {model.stamp && (
        <div className="mt-4 flex justify-center" data-testid="dancer-practice">
          <div className="text-center rounded-[10px] px-4 py-2" style={{ transform: 'rotate(-2deg)', border: `2px solid ${TEAL.gold}` }}>
            <div className="text-[14px] font-black uppercase tracking-[1px] leading-tight" style={{ color: TEAL.gold }}>Practice partner wanted</div>
            {model.stamp.goal && <div className="mt-0.5 text-[12px]">Goal: {model.stamp.goal}</div>}
          </div>
        </div>
      )}

      {going && (
        <section aria-label="Going next" data-testid="dancer-going">
          <SectionTitle>Going next</SectionTitle>
          <div className="flex gap-2.5">
            {going.shown.map((e) => (
              <div key={e.id} className="flex-1 min-w-0 rounded-2xl p-3.5" style={{ background: TEAL.card, border: `1px solid ${TEAL.border}` }}>
                <div className="text-[12px] font-extrabold uppercase tracking-[.5px]" style={{ color: TEAL.amber }}>{e.date}</div>
                <div className="mt-1 text-[15px] font-bold leading-tight break-words">{e.name}</div>
                {e.venue && <div className="mt-1 text-[12px] break-words" style={{ color: TEAL.muted }}>{e.venue}</div>}
              </div>
            ))}
          </div>
          {going.seeAll && (
            <Link to={pathname} className="mt-2 inline-flex items-center text-[14px] font-bold underline" style={{ ...TAP, color: TEAL.accent }}>See all {going.total} events</Link>
          )}
        </section>
      )}

      {model.contacts.length > 0 && (
        <section aria-label="Contact" data-testid="dancer-connect">
          <SectionTitle>Contact</SectionTitle>
          <ul className="flex flex-col gap-2">
            {model.contacts.map((c) => (
              <li key={c.kind} className="flex items-center rounded-xl" style={{ background: TEAL.card, border: `1px solid ${TEAL.border}` }}>
                <a
                  href={c.href}
                  {...(c.kind === 'email' ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
                  className="flex-1 min-w-0 min-h-[50px] flex items-center gap-2 pl-3.5 text-[15px] font-bold underline underline-offset-4 decoration-[1.5px]"
                  style={{ color: TEAL.accent }}
                  data-testid={c.kind === 'whatsapp' ? 'dancer-whatsapp' : undefined}
                >
                  <span className="truncate">{c.label}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 shrink-0" aria-hidden />
                </a>
                <CopyButton kind={c.kind} text={c.copyText} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {model.contacts.length === 0 && extrasOk && (
        <p className="mt-6 text-[14px]" style={{ color: TEAL.muted }} data-testid="dancer-connect-empty">No public contacts yet. Use Share to send this page to a friend.</p>
      )}

      {model.highlights.length > 0 && (
        <section aria-label="Achievements" data-testid="dancer-highlights">
          <SectionTitle>Achievements</SectionTitle>
          <ul className="rounded-[14px] p-3.5 space-y-1" style={{ background: TEAL.card, border: `1px solid ${TEAL.border}` }}>
            {model.highlights.map((a, i) => <li key={i} className="text-[14px] leading-normal break-words">{a}</li>)}
          </ul>
        </section>
      )}

      {ownerPlans && <div className="mt-6">{ownerPlans}</div>}

      {showJoin && (
        <p className="pt-6 text-center text-[13px]" style={{ color: TEAL.muted }} data-testid="dancer-join">
          Dance bachata too?{' '}
          <Link to={joinHref(pathname)} className="font-extrabold underline" style={{ color: TEAL.accent }}>Get your own card</Link>
        </p>
      )}
    </div>
  );
}

export default PublicDancerPageV2;
