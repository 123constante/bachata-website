import { Link } from 'react-router-dom';
import { optimizedImageUrl } from '@/lib/imageCdn';
import { fallbackInitials, yearChips } from './nightsCardModel';

const SERIF = "'Cormorant Garamond', Georgia, serif";
const GOLD = '#E7BE6E';
const GRADS = [
  'linear-gradient(160deg,#311f2a,#100b13)',
  'linear-gradient(160deg,#2a2233,#100b13)',
  'linear-gradient(160deg,#33202b,#100b13)',
  'linear-gradient(160deg,#2b2132,#100b13)',
];

export interface PastHighlightNight {
  key: string;
  href: string;
  name: string;
  posterUrl: string | null;
  /** Short date for the tile caption, e.g. "6 Jun". */
  caption: string;
}

export interface PastHighlightsProps {
  total: number;
  thisYear: number;
  /** Newest first; the component shows at most the first six. */
  latest: PastHighlightNight[];
  showSeeAll: boolean;
  listOpen: boolean;
  onToggleList: () => void;
  years: { year: string; count: number }[];
  onYear: (year: string) => void;
  organiserName: string;
}

/** Past nights highlights strip: counts, six latest flyers, year shortcuts, "See all". */
export default function PastHighlights(p: PastHighlightsProps) {
  if (p.total === 0) return null;
  const chips = yearChips(p.years);
  return (
    <div data-testid="past-highlights-strip" className="mb-3">
      <div className="flex flex-wrap items-baseline" style={{ gap: '4px 14px', marginBottom: 10 }}>
        <span style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: '#F6F1EA' }}>{p.total} {p.total === 1 ? 'night' : 'nights'} hosted</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>{p.thisYear} this year</span>
      </div>
      <div className="flex overflow-x-auto" style={{ gap: 8, paddingBottom: 4 }}>
        {p.latest.slice(0, 6).map((n, i) => (
          <Link key={n.key} to={n.href} aria-label={`${n.name}, ${n.caption}`} className="flex-shrink-0 no-underline" style={{ width: 84, minHeight: 44 }}>
            <span
              className="relative block overflow-hidden"
              style={{ width: 84, height: 84, borderRadius: 12, background: n.posterUrl ? '#0E0F13' : GRADS[i % GRADS.length] }}
            >
              {n.posterUrl ? (
                <img src={optimizedImageUrl(n.posterUrl, 200)} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
              ) : (
                <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center" style={{ fontFamily: SERIF, fontSize: 24, color: 'rgba(251,239,196,0.85)' }}>
                  {fallbackInitials(n.name, p.organiserName)}
                </span>
              )}
            </span>
            <span className="block truncate" style={{ fontSize: 12, marginTop: 4, color: 'rgba(246,241,234,0.75)' }}>{n.caption}</span>
          </Link>
        ))}
      </div>
      {chips.length > 0 && (
        <div data-testid="past-year-shortcuts" className="flex flex-wrap" style={{ gap: 8, marginTop: 8 }}>
          {chips.map((c) => (
            <button
              key={c.year}
              type="button"
              onClick={() => p.onYear(c.year)}
              style={{ minHeight: 44, padding: '0 14px', borderRadius: 100, background: 'rgba(246,241,234,0.08)', border: '1px solid rgba(246,241,234,0.2)', color: '#F6F1EA', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      {p.showSeeAll && (
        <button
          type="button"
          onClick={p.onToggleList}
          aria-expanded={p.listOpen}
          style={{ display: 'block', width: '100%', minHeight: 44, marginTop: 8, padding: 10, background: 'none', border: '1px solid rgba(231,190,110,0.4)', borderRadius: 12, color: GOLD, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          {p.listOpen ? 'Hide the full list' : `See all ${p.total} nights`}
        </button>
      )}
    </div>
  );
}
