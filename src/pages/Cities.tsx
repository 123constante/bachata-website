// World map uses inline SVG rather than react-simple-maps + world-atlas.
// Audit (gzipped):
//   • react-simple-maps 3.x + d3-geo + topojson-client + world-atlas/110m =
//     ~70 KB on the /cities chunk.
//   • This hand-simplified inline SVG (~5 KB of path data, no new deps) =
//     ~3 KB after gzip.
// For a single static map with one pin the inline approach wins on bundle
// size by an order of magnitude, and introduces zero runtime JS for map
// rendering. See Phase 8c-2 report for the full rationale.

const GOLD = 'hsl(33 100% 50%)';

// Equirectangular projection, viewBox 1000 × 500:
//   x = (lng + 180) / 360 * 1000
//   y = (90 - lat) / 180 * 500
// London (51.5074, -0.1278) → (499.6, 106.9).
const LONDON = { x: 499.6, y: 106.9 };

// Hardcoded upcoming cities. Admin-editable management is explicitly out of
// scope for Phase 8c — a separate ticket will make this server-backed.
const UPCOMING_CITIES = ['Madrid', 'Lisbon', 'Paris', 'Berlin'];

// Rough hand-simplified continent outlines. Not cartographically accurate —
// just recognisable blobs positioned via equirectangular coords. Kept as a
// single `<g>` with shared styling so the SVG stays small.
const CONTINENT_PATHS = [
  // North America (Alaska + Canada + contiguous US)
  'M140,110 L170,85 L215,72 L270,78 L305,92 L320,115 L330,150 L326,185 L310,215 L288,238 L258,252 L230,252 L200,238 L178,215 L162,185 L150,150 Z',
  // Greenland
  'M345,55 L378,48 L398,60 L402,85 L388,100 L368,102 L348,88 L342,70 Z',
  // Central America / Mexico
  'M250,248 L275,258 L292,275 L298,292 L282,290 L262,278 L248,262 Z',
  // South America
  'M295,290 L322,288 L340,305 L350,330 L350,365 L340,400 L320,435 L300,455 L285,450 L272,425 L268,390 L268,355 L273,325 L282,302 Z',
  // British Isles (separated from continental Europe for readability)
  'M460,100 L475,95 L483,108 L480,125 L470,130 L460,125 L455,115 Z',
  // Europe
  'M485,115 L515,102 L548,105 L578,115 L592,135 L585,160 L562,175 L530,178 L502,172 L485,158 L478,138 Z',
  // Africa
  'M495,182 L530,180 L562,185 L585,205 L595,235 L593,270 L582,305 L568,335 L552,355 L535,368 L518,362 L502,345 L490,315 L482,280 L478,245 L482,215 L489,195 Z',
  // Asia (Russia / China / Middle East as one blob)
  'M585,85 L625,65 L685,60 L755,65 L815,75 L860,92 L885,112 L895,140 L882,165 L858,182 L822,195 L782,202 L745,208 L712,220 L685,232 L662,225 L640,205 L618,185 L598,162 L588,135 L583,108 Z',
  // India
  'M662,232 L688,232 L698,252 L692,278 L680,288 L668,278 L662,258 Z',
  // SE Asia / Indonesia
  'M762,215 L795,225 L818,238 L828,252 L820,262 L798,262 L775,255 L762,240 Z',
  // Japan
  'M858,148 L870,142 L880,155 L878,172 L866,178 L858,168 Z',
  // Australia
  'M815,308 L852,302 L885,308 L905,325 L908,348 L892,368 L865,376 L838,375 L820,362 L812,342 L810,322 Z',
  // New Zealand
  'M928,362 L942,358 L952,372 L948,388 L935,392 L925,380 Z',
  // Antarctica strip
  'M55,448 Q285,438 500,438 Q715,438 945,448 L945,490 L55,490 Z',
];

const WorldMap = () => (
  <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-2">
    <svg viewBox="0 0 1000 500" className="block h-auto w-full" role="img" aria-label="World map with London pinned">
      <g fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" strokeWidth={0.75} strokeLinejoin="round">
        {CONTINENT_PATHS.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>

      {/* Soft orange glow around the pin */}
      <circle cx={LONDON.x} cy={LONDON.y} r={22} fill={GOLD} opacity={0.12} />
      <circle cx={LONDON.x} cy={LONDON.y} r={14} fill={GOLD} opacity={0.25} />
      {/* Solid pin */}
      <circle cx={LONDON.x} cy={LONDON.y} r={7} fill={GOLD} />
      <circle cx={LONDON.x} cy={LONDON.y} r={2.5} fill="white" />
    </svg>

    {/* Label rendered as HTML so its size is stable across viewport widths. */}
    <div
      className="pointer-events-none absolute text-[11px] font-extrabold tracking-[-0.01em] text-white"
      style={{
        // Shift into percent of the SVG so the label tracks the pin when the
        // container resizes. Small nudge via translate keeps it clear of the
        // outer glow ring.
        left: `${(LONDON.x / 1000) * 100}%`,
        top: `${(LONDON.y / 500) * 100}%`,
        transform: 'translate(14px, -50%)',
        textShadow: '0 1px 2px rgba(0,0,0,0.6)',
      }}
      aria-hidden="true"
    >
      London
    </div>
  </div>
);

const CitiesPage = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-[720px] px-4 pb-16 pt-8">
        <header className="pb-6 text-center">
          <h1
            className="text-[36px] font-bold leading-[0.95] tracking-[-0.03em]"
            style={{ fontFamily: '"Fraunces", Georgia, serif' }}
          >
            <span style={{ color: GOLD }}>Cities</span>
          </h1>
        </header>

        <WorldMap />

        <section className="pt-8">
          <h2 className="pb-3 text-[16px] font-bold uppercase tracking-[0.06em] text-white/90">
            More cities coming soon
          </h2>
          <ul className="flex flex-col gap-2">
            {UPCOMING_CITIES.map((city) => (
              <li
                key={city}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[14px] text-white/85"
              >
                {city}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};

export default CitiesPage;
