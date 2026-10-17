import { useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Globe, Instagram, Mail, MapPin, MessageCircle, Share2 } from 'lucide-react';
import ProfileEventTimeline from '@/components/profile/ProfileEventTimeline';
import { NationalityFlag, TILE_FLAG_SIZE } from '@/components/people/NationalityFlag';
import { optimizedImageUrl, srcWidthFor } from '@/lib/imageCdn';
import { PersonAvatar } from '@/components/account/profiles/PersonAvatar';
import { useAuth } from '@/hooks/useAuth';
import { DANCER_TOKENS } from '../theme/tokens';
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
  /** false = the extras read failed: no "no public contacts" claim (WhatsApp may exist). */
  extrasOk?: boolean;
  /** dancer_profiles.id, for the event appearances list. */
  profileId: string;
  /** The path to share and to come back to after Join, e.g. "/dancers/ana-lopez". */
  pathname: string;
  /** Owner-only block (today's "Your plans"), or null. */
  ownerPlans?: ReactNode;
};

const TAP = { minHeight: 44 } as const;

// The dancer theme as CSS variables on this page's root. theme/dancer.css stays the
// shell's alone (tests/client/dancerAppTheme.test.ts: one importer); the values are
// the same object that sheet is pinned to, so the two cannot drift.
const THEME_VARS = { ...DANCER_TOKENS, background: 'var(--da-bg)', color: 'var(--da-text)' } as CSSProperties;

/** The portrait is the page width (max-w-xl = 576 css px). */
const PORTRAIT_CSS_PX = 576;

const ICONS: Record<ContactLink['kind'], typeof Instagram> = {
  whatsapp: MessageCircle,
  instagram: Instagram,
  facebook: Facebook,
  website: Globe,
  email: Mail,
};

const Section = ({ title, children, testId }: { title: string; children: ReactNode; testId: string }) => (
  <section className="rounded-[14px] p-3 space-y-2" style={{ background: 'var(--da-surface)' }} data-testid={testId} aria-label={title}>
    <h2 className="text-[13px] font-bold uppercase tracking-wider" style={{ color: 'var(--da-text-muted)' }}>{title}</h2>
    {children}
  </section>
);

const Chips = ({ items }: { items: string[] }) => (
  <ul className="flex flex-wrap gap-2">
    {items.map((x, i) => (
      <li key={`${x}-${i}`} className="rounded-full px-3 py-1 text-[14px] break-words" style={{ background: 'var(--da-surface-2)' }}>{x}</li>
    ))}
  </ul>
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
    <div className="flex-1 min-w-[140px]">
      <button
        type="button"
        onClick={() => void onShare()}
        className="w-full inline-flex items-center justify-center gap-2 rounded-[14px] px-3 text-[15px] font-semibold"
        style={{ ...TAP, background: 'var(--da-accent)', color: 'var(--da-on-accent)' }}
        data-testid="dancer-share"
      >
        <Share2 className="w-4 h-4" aria-hidden /> Share
      </button>
      <p role="status" aria-live="polite" className="mt-1 text-[13px]" style={{ color: 'var(--da-text-muted)' }} data-testid="dancer-share-status">
        {message}
      </p>
      {outcome === 'manual' && (
        <input
          readOnly
          value={url}
          aria-label="Link to this page"
          onFocus={(e) => e.currentTarget.select()}
          className="mt-1 w-full rounded-[10px] px-2 text-[14px]"
          style={{ ...TAP, background: 'var(--da-surface-2)', color: 'var(--da-text)' }}
          data-testid="dancer-share-link"
        />
      )}
    </div>
  );
};

export function PublicDancerPageV2({ model, extrasOk = true, profileId, pathname, ownerPlans }: PublicDancerPageV2Props) {
  const { user, authStatus } = useAuth();
  // Signed-out only, and only once auth has settled: the server (and the first
  // client paint) never knows who is looking, so Join appears after hydration
  // for a visitor and never flashes for a signed-in dancer.
  const showJoin = authStatus !== 'resolving' && (!user || user.is_anonymous === true);
  const otherContacts = model.contacts.filter((c) => c.kind !== 'whatsapp');

  return (
    <div data-profile="dancer" data-testid="dancer-page-v2" className="relative z-10 rounded-[14px] overflow-hidden" style={{ ...THEME_VARS, isolation: 'isolate' }}>
      {/* The photo fills the header; the name block is IN FLOW at the bottom, so a long
          name at 200% text grows the header instead of being clipped off its top. */}
      <header className="relative w-full flex flex-col justify-end overflow-hidden min-h-[min(125vw,62vh)]" data-testid="dancer-portrait">
        {model.avatarUrl ? (
          <img src={optimizedImageUrl(model.avatarUrl, srcWidthFor(PORTRAIT_CSS_PX))} alt={model.name} className="absolute inset-0 w-full h-full object-cover" loading="eager" />
        ) : (
          // No photo: the site's ONE avatar (its no-photo face), centred on the dancer gradient.
          <div
            className="absolute inset-0 flex items-center justify-center pb-24"
            style={{ background: 'linear-gradient(160deg, var(--da-gradient-from), var(--da-gradient-to))' }}
            data-testid="dancer-portrait-placeholder"
          >
            <PersonAvatar photoUrl={null} name={model.name} size={128} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" aria-hidden />
        <NationalityFlag code={model.nationalityCode} size={TILE_FLAG_SIZE} placement="inset" inset={8} />
        <div className="relative p-3 pt-16 space-y-1">
          <h1 className="text-[28px] leading-tight font-black text-white break-words" data-testid="dancer-name">{model.name}</h1>
          {model.place && (
            <p className="flex items-center gap-1 text-[15px] text-white/85"><MapPin className="w-4 h-4 shrink-0" aria-hidden />{model.place}</p>
          )}
          {(model.role || model.experience) && (
            <p className="text-[15px] text-white/85" data-testid="dancer-role-line">
              {[model.role, model.experience ? `${model.experience.years} ${model.experience.years === 1 ? 'year' : 'years'} dancing` : null].filter(Boolean).join(' \u00b7 ')}
            </p>
          )}
        </div>
      </header>

      <div className="p-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          <ShareButton title={model.shareTitle} pathname={pathname} />
          {model.whatsappHref && (
            <a
              href={model.whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 rounded-[14px] px-3 text-[15px] font-semibold"
              style={{ ...TAP, background: 'var(--da-surface-2)', color: 'var(--da-text)' }}
              data-testid="dancer-whatsapp"
            >
              <MessageCircle className="w-4 h-4" aria-hidden /> Message on WhatsApp
            </a>
          )}
        </div>

        {showJoin && (
          <div className="rounded-[14px] p-3 space-y-2" style={{ background: 'var(--da-surface)' }} data-testid="dancer-join">
            <p className="text-[15px]">Dance bachata too? Make your own page and save the nights you go to.</p>
            <Link
              to={joinHref(pathname)}
              className="inline-flex items-center justify-center rounded-[14px] px-4 text-[15px] font-semibold"
              style={{ ...TAP, background: 'linear-gradient(90deg, var(--da-gradient-from), var(--da-gradient-to))', color: 'var(--da-on-gradient)' }}
            >
              Join Bachata Calendar
            </Link>
          </div>
        )}

        {model.bio && (
          <Section title="About" testId="dancer-bio">
            <p className="text-[15px] whitespace-pre-line break-words">{model.bio}</p>
          </Section>
        )}

        {model.languages.length > 0 && (
          <Section title="Speaks" testId="dancer-languages"><Chips items={model.languages} /></Section>
        )}

        {model.experience && (
          <Section title="Experience" testId="dancer-experience">
            <p className="text-[15px]"><span className="text-[22px] font-black" style={{ color: 'var(--da-accent)' }}>{model.experience.years}</span> {model.experience.years === 1 ? 'year' : 'years'} &middot; {model.experience.level}</p>
          </Section>
        )}

        {model.practice && (
          <Section title="Practice buddy" testId="dancer-practice">
            <p className="text-[15px] font-semibold">{model.practice.status}</p>
            {model.practice.lookingFor && <p className="text-[14px]">Looking for: {model.practice.lookingFor}</p>}
            {model.practice.levels.length > 0 && (<><p className="text-[13px]" style={{ color: 'var(--da-text-muted)' }}>Happy to practise with</p><Chips items={model.practice.levels} /></>)}
            {model.practice.goals.length > 0 && (<><p className="text-[13px]" style={{ color: 'var(--da-text-muted)' }}>Goals</p><Chips items={model.practice.goals} /></>)}
            {model.practice.details && <p className="text-[14px] italic break-words">{model.practice.details}</p>}
          </Section>
        )}

        {model.styles.length > 0 && <Section title="Styles" testId="dancer-styles"><Chips items={model.styles} /></Section>}

        {model.songs.length > 0 && (
          <Section title="My sound" testId="dancer-songs">
            <ul className="space-y-1">{model.songs.map((s, i) => <li key={i} className="text-[14px] break-words">{s}</li>)}</ul>
          </Section>
        )}

        {model.highlights.length > 0 && (
          <Section title="Highlights" testId="dancer-highlights">
            <ul className="space-y-1 list-disc pl-5">{model.highlights.map((a, i) => <li key={i} className="text-[14px] break-words">{a}</li>)}</ul>
          </Section>
        )}

        {(otherContacts.length > 0 || (!model.whatsappHref && extrasOk)) && (
        <Section title="Connect" testId="dancer-connect">
          {otherContacts.length > 0 ? (
            <ul className="grid grid-cols-1 gap-2">
              {otherContacts.map((c) => {
                const Icon = ICONS[c.kind];
                return (
                  <li key={c.kind}>
                    <a
                      href={c.href}
                      {...(c.kind === 'email' ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
                      className="flex items-center gap-2 rounded-[10px] px-3 text-[15px] break-all"
                      style={{ ...TAP, background: 'var(--da-surface-2)' }}
                    >
                      <Icon className="w-4 h-4 shrink-0" aria-hidden /> {c.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[14px]" style={{ color: 'var(--da-text-muted)' }}>No public contacts yet. Use Share to send this page to a friend.</p>
          )}
        </Section>
        )}

        <div className="rounded-[14px] p-3" style={{ background: 'var(--da-surface)' }}>
          <ProfileEventTimeline personType="dancer" personId={profileId} title="Event appearances" emptyText="No event appearances yet." />
        </div>

        {model.gallery.length > 0 && (
          <Section title="Gallery" testId="dancer-gallery">
            <div className="grid grid-cols-3 gap-2">
              {model.gallery.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt={`${model.name} photo ${i + 1}`} className="w-full aspect-square object-cover rounded-[10px]" loading="lazy" />
                </a>
              ))}
            </div>
          </Section>
        )}

        {ownerPlans}
      </div>
    </div>
  );
}

export default PublicDancerPageV2;
