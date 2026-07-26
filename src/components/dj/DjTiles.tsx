import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { optimizedImageUrl } from '@/lib/imageCdn';

// ============================================================
// DJ profile bento tiles
// Presentational components extracted from DJProfile.tsx. Every tile
// renders its own header INSIDE the card, matching the source bento
// design (DM Serif Display headings, gold/orange accents on dark
// translucent surfaces). Animations (spin/floatY/pulse/eqbar) are
// defined once in the page's <style> block.
// ============================================================

const TILE: CSSProperties = {
  borderRadius: 22,
  border: '1px solid var(--dj-tile-border)',
  background: 'var(--dj-tile)',
  boxShadow: 'var(--dj-tile-inset)',
  padding: 24,
};

const TILE_TITLE: CSSProperties = {
  fontFamily: 'var(--dj-display)',
  fontSize: 21,
  margin: 0,
  color: 'var(--dj-cream)',
};

function TileHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-between">
      <p style={TILE_TITLE}>{title}</p>
      {right ? (
        <span className="text-[11.5px] font-semibold" style={{ color: 'rgba(246,241,234,0.5)' }}>
          {right}
        </span>
      ) : null}
    </div>
  );
}

// --- date helpers -------------------------------------------
// Times are stored naive ("local-as-UTC"); display exactly as stored,
// never Intl-convert. So parse the Y-M-D directly from the string.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseDateParts(iso: string | null): { day: string; mon: string; monYear: string } | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const year = m[1];
  const monIdx = Math.max(0, Math.min(11, parseInt(m[2], 10) - 1));
  const day = m[3];
  return {
    day,
    mon: MONTHS[monIdx],
    monYear: `${MONTHS[monIdx].toUpperCase()} \u2019${year.slice(2)}`,
  };
}

// --- shared gig type ----------------------------------------
export type DjGig = {
  eventId: string;
  name: string;
  startTime: string | null;
  location: string | null;
};

// ============================================================
// Hero
// ============================================================
export type DjHeroProps = {
  name: string;
  photoUrl: string | null;
  cityName: string | null;
  nationality: string | null;
  bio: string | null;
  isLive: boolean;
  stats: { gigs: number | null; upcoming: number | null; genres: number | null };
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || 'DJ';
}

function Stat({ value, label, gold }: { value: string; label: string; gold?: boolean }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--dj-display)', fontSize: 30, lineHeight: 1, color: gold ? 'var(--dj-gold)' : 'var(--dj-cream)' }}>
        {value}
      </div>
      <div className="mt-1.5 text-[10.5px] uppercase" style={{ letterSpacing: '0.1em', color: 'rgba(246,241,234,0.5)' }}>
        {label}
      </div>
    </div>
  );
}

export function DjHero({ name, photoUrl, cityName, nationality, bio, isLive, stats }: DjHeroProps) {
  const locLine = [cityName, nationality].filter(Boolean).join(' \u00B7 ');
  return (
    <div
      style={{
        borderRadius: 22,
        overflow: 'hidden',
        position: 'relative',
        background:
          'radial-gradient(circle at 82% 12%,rgba(255,106,44,0.32),transparent 46%),radial-gradient(circle at 6% 92%,rgba(231,190,110,0.16),transparent 46%),linear-gradient(155deg,#2a1622,#0b090c 72%)',
        boxShadow: 'inset 0 1px 0 rgba(246,241,234,0.08)',
      }}
      className="flex flex-col items-center gap-6 p-7 text-center md:flex-row md:items-center md:gap-9 md:p-10 md:text-left"
    >
      {/* turntable: vinyl grooves spin; the portrait stays still and prominent */}
      <div className="relative shrink-0" style={{ width: 188, height: 188, animation: 'dj-float 6s ease-in-out infinite' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'repeating-radial-gradient(circle,#17121a 0 2px,#0c0a0f 2px 5px)',
            boxShadow: '0 26px 60px rgba(0,0,0,0.75), 0 0 0 1px rgba(246,241,234,0.08), inset 0 0 40px rgba(0,0,0,0.6)',
            animation: 'dj-spin 9s linear infinite',
          }}
        >
          {!photoUrl ? (
            <div
              style={{
                position: 'absolute',
                inset: '32%',
                borderRadius: '50%',
                overflow: 'hidden',
                background: 'conic-gradient(from 200deg,#FBEFC4,#E7BE6E 40%,#D2A350 70%,#FBEFC4)',
                boxShadow: 'inset 0 0 12px rgba(0,0,0,0.25)',
              }}
              className="flex items-center justify-center"
            >
              <span style={{ color: '#0C0A0D', fontWeight: 800, fontSize: 17, letterSpacing: '0.12em' }}>
                {initials(name)}
              </span>
            </div>
          ) : null}
          {!photoUrl ? (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: 9,
                height: 9,
                margin: -4.5,
                borderRadius: '50%',
                background: '#0A080B',
                boxShadow: '0 0 0 1px rgba(231,190,110,0.4)',
              }}
            />
          ) : null}
        </div>
        {photoUrl ? (
          <div
            style={{
              position: 'absolute',
              inset: '15%',
              borderRadius: '50%',
              overflow: 'hidden',
              boxShadow: '0 0 0 3px rgba(231,190,110,0.55), 0 0 0 6px rgba(10,8,11,0.92), inset 0 0 24px rgba(0,0,0,0.5)',
            }}
          >
            <img src={optimizedImageUrl(photoUrl, 480)} alt={name} className="h-full w-full object-cover" loading="eager" />
          </div>
        ) : null}
      </div>

      {/* identity */}
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex flex-wrap items-center justify-center gap-2 md:justify-start">
          {locLine ? (
            <span className="text-[11.5px] font-bold uppercase" style={{ letterSpacing: '0.16em', color: 'var(--dj-gold)' }}>
              {locLine}
            </span>
          ) : null}
          {isLive ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{ background: 'rgba(255,106,44,0.16)', border: '1px solid rgba(255,106,44,0.4)', color: 'var(--dj-orange-soft)' }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--dj-orange)', animation: 'dj-pulse 1.8s infinite' }} />
              On the decks tonight
            </span>
          ) : null}
        </div>
        <h1
          style={{ fontFamily: 'var(--dj-display)', letterSpacing: '-0.01em' }}
          className="m-0 mb-3 text-5xl leading-[0.92] md:text-[76px]"
        >
          {name}
        </h1>
        {bio ? (
          <p className="m-0 mb-5 max-w-[440px] text-[15px] leading-relaxed md:text-base" style={{ color: 'rgba(246,241,234,0.72)' }}>
            {bio}
          </p>
        ) : null}
        <div className="flex justify-center gap-6 md:justify-start">
          {stats.gigs != null ? <Stat value={String(stats.gigs)} label="Gigs" /> : null}
          {stats.gigs != null && stats.upcoming != null ? <div style={{ width: 1, background: 'rgba(246,241,234,0.12)' }} /> : null}
          {stats.upcoming != null ? <Stat value={String(stats.upcoming)} label="Upcoming" /> : null}
          {stats.upcoming != null && stats.genres != null ? <div style={{ width: 1, background: 'rgba(246,241,234,0.12)' }} /> : null}
          {stats.genres != null ? <Stat value={String(stats.genres)} label="Genres" gold /> : null}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Contact / Book
// ============================================================
export type DjContactProps = {
  name: string;
  instagram: string | null;
  website: string | null;
  soundcloud: string | null;
  mixcloud: string | null;
  facebook: string | null;
  phone?: string | null;
};

const normalizeUrl = (raw: string | null | undefined) => {
  if (!raw?.trim()) return null;
  return raw.trim().startsWith('http') ? raw.trim() : `https://${raw.trim()}`;
};

const phoneDigits = (raw: string) => raw.replace(/[^\d]/g, '');

const ROW: CSSProperties = {
  borderRadius: 14,
  fontSize: 13.5,
  fontWeight: 600,
  background: 'rgba(246,241,234,0.05)',
  border: '1px solid rgba(246,241,234,0.08)',
  color: 'var(--dj-cream)',
};

export function DjContactPanel(p: DjContactProps) {
  const ig = normalizeUrl(p.instagram);
  const web = normalizeUrl(p.website);
  const sc = normalizeUrl(p.soundcloud);
  const mc = normalizeUrl(p.mixcloud);
  const fb = normalizeUrl(p.facebook);
  const hasAny = ig || web || sc || mc || fb || p.phone;
  if (!hasAny) return null;

  return (
    <div style={{ ...TILE, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
      <p className="m-0 mb-1 text-[11px] font-bold uppercase" style={{ letterSpacing: '0.16em', color: 'var(--dj-gold)' }}>
        Book {p.name}
      </p>

      {p.phone ? (
        <a
          href={`https://wa.me/${phoneDigits(p.phone)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 py-3.5 text-[14.5px] font-bold text-white"
          style={{ borderRadius: 14, background: 'linear-gradient(135deg,#2BE06E,#1FB457)', boxShadow: '0 12px 28px -10px rgba(37,211,102,0.55)' }}
        >
          Message on WhatsApp
        </a>
      ) : null}
      {p.phone ? (
        <a href={`tel:${p.phone}`} className="flex items-center gap-2.5 px-4 py-3" style={ROW}>
          {p.phone}
        </a>
      ) : null}

      {(sc || mc) ? (
        <div className="flex gap-2.5">
          {sc ? (
            <a href={sc} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center gap-1.5 py-3 text-[13px] font-bold text-white" style={{ borderRadius: 14, background: '#FF5500' }}>
              SoundCloud
            </a>
          ) : null}
          {mc ? (
            <a href={mc} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center gap-1.5 py-3 text-[13px] font-bold text-white" style={{ borderRadius: 14, background: '#5000FF' }}>
              Mixcloud
            </a>
          ) : null}
        </div>
      ) : null}

      {ig ? <a href={ig} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 px-4 py-3" style={ROW}>Instagram</a> : null}
      {web ? <a href={web} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 px-4 py-3" style={ROW}>{web.replace(/^https?:\/\//, '').split('/')[0]}</a> : null}
      {fb ? <a href={fb} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 px-4 py-3" style={ROW}>Facebook</a> : null}
    </div>
  );
}

// ============================================================
// Listen (real SoundCloud / Mixcloud links -- no fabricated stats)
// ============================================================
export function DjListen({ soundcloud, mixcloud }: { soundcloud: string | null; mixcloud: string | null }) {
  const sc = normalizeUrl(soundcloud);
  const mc = normalizeUrl(mixcloud);
  if (!sc && !mc) return null;

  const OpenArrow = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(246,241,234,0.45)" strokeWidth="2" className="shrink-0">
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );

  return (
    <div style={TILE}>
      <TileHeader title="Latest mixes" right="SoundCloud &amp; Mixcloud" />
      <div className="flex flex-col gap-3">
        {sc ? (
          <a href={sc} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 px-4 py-4" style={{ borderRadius: 16, border: '1px solid rgba(255,85,0,0.35)', background: 'linear-gradient(120deg,rgba(255,85,0,0.12),rgba(10,8,11,0))' }}>
            <span className="flex shrink-0 items-center justify-center" style={{ width: 42, height: 42, borderRadius: '50%', background: '#FF5500', boxShadow: '0 8px 18px -6px rgba(255,85,0,0.7)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="#FFF"><path d="M8 5v14l11-7z" /></svg>
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[14.5px] font-bold">SoundCloud</div>
              <div className="mt-0.5 text-[11.5px]" style={{ color: 'rgba(246,241,234,0.55)' }}>Open player</div>
            </div>
            {OpenArrow}
          </a>
        ) : null}
        {mc ? (
          <a href={mc} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 px-4 py-4" style={{ borderRadius: 16, border: '1px solid rgba(120,80,255,0.35)', background: 'linear-gradient(120deg,rgba(80,0,255,0.14),rgba(10,8,11,0))' }}>
            <span className="flex shrink-0 items-center justify-center" style={{ width: 42, height: 42, borderRadius: '50%', background: '#5000FF', boxShadow: '0 8px 18px -6px rgba(80,0,255,0.7)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="#FFF"><path d="M8 5v14l11-7z" /></svg>
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[14.5px] font-bold">Mixcloud</div>
              <div className="mt-0.5 text-[11.5px]" style={{ color: 'rgba(246,241,234,0.55)' }}>Open player</div>
            </div>
            {OpenArrow}
          </a>
        ) : null}
      </div>
    </div>
  );
}

// ============================================================
// Genres -- EQ bar chart
// Interim (no genre_weights yet): bar heights descend by list order,
// NO numeric percentages. When weights arrive, pass `weights` to show
// real proportions + % labels.
// ============================================================
export function DjGenresEq({ genres, weights }: { genres: string[]; weights?: number[] | null }) {
  if (!genres.length) return null;
  const shown = genres.slice(0, 6);
  const hasWeights = Array.isArray(weights) && weights.length === genres.length;
  const maxW = hasWeights ? Math.max(...weights!.slice(0, shown.length), 1) : 1;

  const heightPct = (i: number) => {
    if (hasWeights) return Math.max(12, Math.round((weights![i] / maxW) * 92));
    if (shown.length <= 1) return 70;
    const maxH = 92, minH = 34;
    return Math.round(maxH - (maxH - minH) * (i / (shown.length - 1)));
  };
  const barBg = (i: number) =>
    i === 0
      ? 'linear-gradient(180deg,#FBEFC4,#E7BE6E 55%,#D2A350)'
      : i === 1
        ? 'linear-gradient(180deg,#FF9A6C,#FF6A2C)'
        : 'rgba(246,241,234,0.42)';
  const labelColor = (i: number) => (i === 0 ? 'var(--dj-gold)' : i === 1 ? 'var(--dj-orange-soft)' : 'rgba(246,241,234,0.7)');

  return (
    <div style={{ ...TILE, display: 'flex', flexDirection: 'column' }}>
      <TileHeader title="Favorite Music" />
      <div className="flex flex-1 items-end gap-4" style={{ minHeight: 150, padding: '0 6px' }}>
        {shown.map((g, i) => (
          <div key={g} className="flex h-full flex-1 flex-col justify-end gap-2.5 text-center">
            <div
              style={{
                height: `${heightPct(i)}%`,
                borderRadius: '8px 8px 3px 3px',
                background: barBg(i),
                boxShadow: i < 2 ? '0 0 22px rgba(231,190,110,0.3)' : 'none',
                transformOrigin: 'bottom',
                animation: `dj-eqbar 2.4s ease-in-out infinite`,
                animationDelay: `${i * 0.35}s`,
              }}
            />
            <div className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: '0.04em' }}>
              {g}
              {hasWeights ? (
                <div style={{ color: labelColor(i), fontSize: 15, marginTop: 2 }}>{weights![i]}%</div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Upcoming gigs (future timeline events)
// ============================================================
export function DjUpcoming({ gigs }: { gigs: DjGig[] }) {
  if (!gigs.length) return null;
  return (
    <div style={TILE}>
      <TileHeader title="Upcoming" />
      <div className="flex flex-col gap-2.5">
        {gigs.map((g, i) => {
          const d = parseDateParts(g.startTime);
          const next = i === 0;
          return (
            <Link
              key={g.eventId}
              to={`/event/${g.eventId}`}
              className="flex items-center gap-4 px-4 py-3.5"
              style={{
                borderRadius: 14,
                background: next
                  ? 'radial-gradient(circle at 96% 30%,rgba(255,106,44,0.14),transparent 55%),rgba(231,190,110,0.06)'
                  : 'rgba(246,241,234,0.03)',
                border: next ? '1px solid rgba(231,190,110,0.28)' : '1px solid transparent',
              }}
            >
              <div className="shrink-0 text-center" style={{ width: 48 }}>
                <div style={{ fontFamily: 'var(--dj-display)', fontSize: 26, lineHeight: 1 }}>{d?.day ?? '-'}</div>
                <div className="text-[10px] font-extrabold uppercase" style={{ letterSpacing: '0.08em', color: 'var(--dj-gold)' }}>{d?.mon ?? ''}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-bold">{g.name}</div>
                {g.location ? <div className="truncate text-[11.5px]" style={{ color: 'rgba(246,241,234,0.55)' }}>{g.location}</div> : null}
              </div>
              <span
                className="shrink-0 rounded-full px-3.5 py-2 text-[11.5px] font-semibold"
                style={next
                  ? { color: '#0C0A0D', fontWeight: 700, background: 'linear-gradient(135deg,#FBEFC4,#E7BE6E,#FF6A2C)' }
                  : { color: 'rgba(246,241,234,0.7)', border: '1px solid rgba(246,241,234,0.16)' }}
              >
                Details
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Played at -- past gig history as passport stamps
// ============================================================
export function DjPlayedAt({ gigs, totalCount }: { gigs: DjGig[]; totalCount: number }) {
  if (!gigs.length) return null;
  const shown = gigs.slice(0, 4);
  const remaining = totalCount - shown.length;
  const rot = [-6, 4, -3, 6];
  const col = ['var(--dj-gold)', 'var(--dj-orange-soft)', 'rgba(246,241,234,0.8)', 'var(--dj-gold)'];
  const bord = ['rgba(231,190,110,0.6)', 'rgba(255,106,44,0.55)', 'rgba(246,241,234,0.4)', 'rgba(231,190,110,0.6)'];

  return (
    <div style={{ ...TILE, background: 'radial-gradient(circle at 20% 15%,rgba(231,190,110,0.08),transparent 50%),var(--dj-tile)' }}>
      <TileHeader title="Played at" right={`${totalCount} event${totalCount === 1 ? '' : 's'} played`} />
      <div className="flex flex-wrap items-center gap-3.5">
        {shown.map((g, i) => {
          const d = parseDateParts(g.startTime);
          return (
            <Link
              key={g.eventId}
              to={`/event/${g.eventId}`}
              className="flex flex-col items-center justify-center text-center"
              style={{ width: 104, height: 104, borderRadius: '50%', border: `2px dashed ${bord[i]}`, transform: `rotate(${rot[i]}deg)`, color: col[i], padding: 10 }}
            >
              {d ? <div className="text-[8px] font-extrabold" style={{ letterSpacing: '0.1em' }}>{d.monYear}</div> : null}
              <div style={{ fontFamily: 'var(--dj-display)', fontSize: 14, lineHeight: 1.05, margin: '3px 0' }} className="line-clamp-3">
                {g.name}
              </div>
            </Link>
          );
        })}
        {remaining > 0 ? (
          <div style={{ flex: 1, minWidth: 80, textAlign: 'center', fontSize: 18, fontWeight: 600, color: '#FFFEFC' }}>
            + {remaining} more
            <br />gigs
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ============================================================
// Gallery
// ============================================================
export function DjGallery({ urls, name }: { urls: string[]; name: string }) {
  if (!urls.length) return null;
  return (
    <div style={TILE}>
      <TileHeader title="Gallery" />
      <div className="grid grid-cols-3 gap-2">
        {urls.slice(0, 9).map((url, i) => (
          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
            <img src={optimizedImageUrl(url, 320)} alt={`${name} photo ${i + 1}`} loading="lazy" className="aspect-square w-full rounded-[10px] object-cover transition-opacity hover:opacity-80" />
          </a>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Text card (Bio / FAQ / Pricing)
// ============================================================
export function DjTextCard({ title, body }: { title: string; body: string }) {
  return (
    <div style={TILE}>
      <TileHeader title={title} />
      <p className="m-0 whitespace-pre-wrap text-[13.5px] leading-relaxed" style={{ color: 'rgba(246,241,234,0.72)' }}>
        {body}
      </p>
    </div>
  );
}

// ============================================================
// Guestbook -- coming-soon stub (real reviews are a follow-up feature)
// ============================================================
export function DjGuestbookStub() {
  return (
    <div style={{ ...TILE, padding: '32px 34px' }}>
      <TileHeader title="The guestbook" right={<span style={{ color: 'var(--dj-gold)', fontWeight: 800 }}>Coming soon</span>} />
      <div
        className="flex flex-col items-center justify-center gap-2.5 text-center"
        style={{ padding: '26px 0', border: '1px dashed rgba(246,241,234,0.14)', borderRadius: 16 }}
      >
        <div style={{ fontSize: 22 }}>{'\u2B50'}</div>
        <div style={{ fontFamily: 'var(--dj-display)', fontSize: 22, color: 'var(--dj-cream)' }}>Be the first to review this DJ</div>
        <div className="max-w-[420px] text-[13px]" style={{ color: 'rgba(246,241,234,0.55)' }}>
          Dancer reviews &amp; ratings are coming soon &mdash; you&rsquo;ll be able to rate a DJ after a night on their floor.
        </div>
      </div>
    </div>
  );
}
