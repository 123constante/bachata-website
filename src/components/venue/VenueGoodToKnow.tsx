interface VenueGoodToKnowProps {
  barAvailable: boolean | null;
  cloakroomAvailable: boolean | null;
  idRequired: boolean | null;
  waterNote: string | null;
  foodNote: string | null;
  parkingNote: string | null;
  gettingHomeNote: string | null;
  accessibilityNote: string | null;
  lastEntryTime: string | null;
  rules?: string[] | null;
}

interface Fact {
  emoji: string;
  label: string;
  value: string;
}

interface InfoTile {
  emoji: string;
  label: string;
  text: string;
  fullWidth?: boolean;
}

function formatTime(raw: string): string {
  // raw is HH:MM:SS from Postgres time type
  const [h, m] = raw.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return raw;
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour}${suffix}` : `${hour}:${String(m).padStart(2, '0')}${suffix}`;
}

function buildFacts(p: VenueGoodToKnowProps): Fact[] {
  const out: Fact[] = [];
  if (p.barAvailable != null) {
    out.push({ emoji: '\u{1F378}', label: 'Bar', value: p.barAvailable ? 'Yes' : 'No' });
  }
  if (p.cloakroomAvailable != null) {
    out.push({ emoji: '\u{1F9E5}', label: 'Cloakroom', value: p.cloakroomAvailable ? 'Yes' : 'No' });
  }
  if (p.idRequired != null) {
    out.push({ emoji: '\u{1FAAA}', label: 'ID', value: p.idRequired ? 'Required' : 'Not needed' });
  }
  if (p.lastEntryTime) {
    out.push({ emoji: '\u{1F55B}', label: 'Last entry', value: formatTime(p.lastEntryTime) });
  }
  return out;
}

function buildInfoTiles(p: VenueGoodToKnowProps): InfoTile[] {
  const out: InfoTile[] = [];
  if (p.waterNote && p.waterNote.trim()) {
    out.push({ emoji: '\u{1F4A7}', label: 'Water & refills', text: p.waterNote.trim() });
  }
  if (p.foodNote && p.foodNote.trim()) {
    out.push({ emoji: '\u{1F32E}', label: 'Food nearby', text: p.foodNote.trim() });
  }
  if (p.parkingNote && p.parkingNote.trim()) {
    out.push({ emoji: '\u{1F17F}\u{FE0F}', label: 'Parking', text: p.parkingNote.trim() });
  }
  if (p.gettingHomeNote && p.gettingHomeNote.trim()) {
    out.push({ emoji: '\u{1F319}', label: 'Getting home', text: p.gettingHomeNote.trim() });
  }
  if (p.accessibilityNote && p.accessibilityNote.trim()) {
    out.push({ emoji: '\u{267F}', label: 'Accessibility', text: p.accessibilityNote.trim(), fullWidth: true });
  }
  return out;
}

function gridClassForCount(n: number): string {
  if (n <= 1) return 'mx-auto grid w-full max-w-sm grid-cols-1 gap-2.5';
  if (n === 2) return 'grid grid-cols-2 gap-2.5';
  if (n === 3) return 'grid grid-cols-2 gap-2.5 md:grid-cols-3';
  return 'grid grid-cols-2 gap-2.5 md:grid-cols-4';
}

export default function VenueGoodToKnow(props: VenueGoodToKnowProps) {
  const facts = buildFacts(props);
  const tiles = buildInfoTiles(props);
  const rules = props.rules?.filter((r) => r && r.trim()) ?? [];
  if (facts.length === 0 && tiles.length === 0 && rules.length === 0) return null;

  // Tiles excluding full-width ones; full-width rendered separately below grid
  const gridTiles = tiles.filter((t) => !t.fullWidth);
  const fullWidthTiles = tiles.filter((t) => t.fullWidth);

  return (
    <div
      className="overflow-hidden rounded-[18px] border p-4"
      style={{
        background: 'var(--va-surface)',
        borderColor: 'var(--va-accent-line)',
        boxShadow:
          '0 0 0 1px color-mix(in srgb, var(--va-halo) 10%, transparent), 0 18px 44px -22px color-mix(in srgb, var(--va-halo) 32%, transparent)',
      }}
    >
      {facts.length > 0 ? (
        <div className="mb-3.5 flex gap-2">
          {facts.map((f) => (
            <div
              key={f.label}
              className="flex flex-1 flex-col items-center gap-1 rounded-xl border px-1.5 py-2.5"
              style={{ background: 'var(--va-surface2)', borderColor: 'var(--va-line)' }}
            >
              <span className="text-[20px]">{f.emoji}</span>
              <span
                className="text-[14px] font-bold leading-tight"
                style={{
                  fontFamily: 'var(--va-display)',
                  color: 'var(--va-text)',
                  letterSpacing: '-0.005em',
                }}
              >
                {f.label}
              </span>
              <span
                className="text-[9px] font-bold uppercase tracking-[0.12em]"
                style={{ color: 'var(--va-text2)' }}
              >
                {f.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {gridTiles.length > 0 ? (
        <div className={gridClassForCount(gridTiles.length)}>
          {gridTiles.map((i) => (
            <div
              key={i.label}
              className="overflow-hidden rounded-[14px] border"
              style={{ background: 'var(--va-surface2)', borderColor: 'var(--va-line)' }}
            >
              <div
                className="flex items-center gap-1.5 border-b px-3 py-2"
                style={{
                  background: 'var(--va-accent-soft)',
                  borderColor: 'var(--va-accent-line)',
                }}
              >
                <span className="text-[15px]">{i.emoji}</span>
                <span className="text-[12.5px] font-bold" style={{ color: 'var(--va-accent)' }}>
                  {i.label}
                </span>
              </div>
              <div
                className="p-3 text-[12.5px] leading-[1.45]"
                style={{ color: 'var(--va-text2)' }}
              >
                {i.text}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {fullWidthTiles.map((i) => (
        <div
          key={i.label}
          className="mt-2.5 overflow-hidden rounded-[14px] border"
          style={{ background: 'var(--va-surface2)', borderColor: 'var(--va-line)' }}
        >
          <div
            className="flex items-center gap-1.5 border-b px-3 py-2"
            style={{
              background: 'var(--va-accent-soft)',
              borderColor: 'var(--va-accent-line)',
            }}
          >
            <span className="text-[15px]">{i.emoji}</span>
            <span className="text-[12.5px] font-bold" style={{ color: 'var(--va-accent)' }}>
              {i.label}
            </span>
          </div>
          <div
            className="p-3 text-[12.5px] leading-[1.45]"
            style={{ color: 'var(--va-text2)' }}
          >
            {i.text}
          </div>
        </div>
      ))}
      {rules.length > 0 ? (
        <div className="mt-2.5">
          <div
            className="mb-1.5 text-[9.5px] font-bold uppercase tracking-[0.12em]"
            style={{ color: 'var(--va-text3)' }}
          >
            House rules
          </div>
          <div className="flex flex-wrap gap-1.5">
            {rules.map((rule, i) => (
              <span
                key={i}
                className="inline-flex rounded-full border px-2.5 py-1 text-[11.5px] font-medium"
                style={{
                  background: 'var(--va-surface2)',
                  borderColor: 'var(--va-line)',
                  color: 'var(--va-text2)',
                }}
              >
                {rule}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
