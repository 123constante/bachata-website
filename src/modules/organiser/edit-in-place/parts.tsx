// Edit in place: the small owner-only pieces the page renders through the
// bridge (pencils, tags, the "Complete your page" card, the link rows, the
// Create event links).
import { useState, type CSSProperties, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { Pencil, Check } from 'lucide-react';
import { FIELD_LABEL, displayValue, type FieldKey } from './fieldRules';
import type { CardModel, CardRow } from './draftModel';

export const GOLD = '#E7BE6E';
export const INK = '#0C0A0D';
export const CREAM = '#F6F1EA';

/** Global styles for the layer (dashed outline on drafted values, the tag). */
export const LAYER_CSS = `
.eip-drafted{outline:2px dashed ${GOLD};outline-offset:3px;border-radius:8px}
.eip-unsaved{display:inline-flex;align-items:center;height:18px;padding:0 6px;border-radius:999px;border:1px dashed ${GOLD};color:${GOLD};font-size:11px;font-weight:700;letter-spacing:.02em;text-transform:lowercase;white-space:nowrap}
.eip-pencil:focus-visible,.eip-btn:focus-visible,.eip-file:focus-within{outline:2px solid ${GOLD};outline-offset:2px}
`;

export type OpenSheet = (field: FieldKey, opener: HTMLElement | null) => void;

const pencilStyle: CSSProperties = {
  width: 44, height: 44, minWidth: 44, borderRadius: '50%', border: 'none', background: 'transparent',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0,
};
const pencilDot: CSSProperties = {
  width: 28, height: 28, borderRadius: '50%', background: GOLD, color: INK,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
};

// Compact: the hero's name and chips. A 24px dot (14px glyph) in a 32x44 tap area, so
// the hero is not dominated by pencils but a thumb still has 44px of height to hit.
const pencilCompact: CSSProperties = { width: 32, minWidth: 32, height: 44 };
const pencilDotCompact: CSSProperties = { width: 24, height: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.35)' };

/** A 44px tap target holding a small gold pencil (`compact`: 32 wide, still 44 high). */
export function PencilButton({ field, onOpen, style, compact }: { field: FieldKey; onOpen: OpenSheet; style?: CSSProperties; compact?: boolean }) {
  return (
    <button
      type="button"
      className="eip-pencil"
      aria-label={`Edit ${FIELD_LABEL[field].toLowerCase()}`}
      data-eip-pencil={field}
      onClick={(e: MouseEvent<HTMLButtonElement>) => onOpen(field, e.currentTarget)}
      style={{ ...pencilStyle, ...(compact ? pencilCompact : null), ...style }}
    >
      <span style={compact ? { ...pencilDot, ...pencilDotCompact } : pencilDot} aria-hidden="true"><Pencil width={14} height={14} strokeWidth={2.4} /></span>
    </button>
  );
}

export const UnsavedTag = ({ field }: { field: FieldKey }) => (
  <span className="eip-unsaved" data-eip-unsaved={field}>unsaved</span>
);

// ---- the card ----------------------------------------------------------------------------

function CardRowView({ row, onOpen }: { row: CardRow; onOpen: OpenSheet }) {
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '4px 0', borderTop: '1px solid rgba(12,10,13,0.12)' }} data-eip-card-row={row.key}>
      <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${INK}`, background: row.drafted ? INK : 'transparent', color: GOLD }}>
        {row.drafted && <Check width={12} height={12} strokeWidth={3} />}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {row.label}
          <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.7 }}>{row.importance}</span>
          {row.drafted && <span className="eip-unsaved" style={{ color: INK, borderColor: INK }} data-eip-unsaved={row.key}>unsaved</span>}
        </p>
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.35, opacity: 0.8 }}>{row.reason}</p>
      </div>
      {row.drafted ? (
        <button type="button" className="eip-btn" onClick={(e) => onOpen(row.key, e.currentTarget)} aria-label={`Change ${row.label.toLowerCase()}`} style={{ minHeight: 44, minWidth: 44, padding: '0 8px', background: 'none', border: 'none', color: INK, fontSize: 13, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>
          Change
        </button>
      ) : (
        <button type="button" className="eip-btn" onClick={(e) => onOpen(row.key, e.currentTarget)} aria-label={`Add ${row.label.toLowerCase()}`} style={{ minHeight: 44, padding: '0 14px', borderRadius: 999, background: INK, color: GOLD, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
          Add
        </button>
      )}
    </li>
  );
}

export function CompleteCard({ model, onOpen }: { model: CardModel; onOpen: OpenSheet }) {
  const [showMore, setShowMore] = useState(false);
  if (!model.show) return null;
  const pct = model.total ? Math.round((model.done / model.total) * 100) : 0;
  const rows = showMore ? [...model.rows, ...model.more] : model.rows;
  return (
    <section aria-labelledby="eip-card-title" data-testid="eip-complete-card" style={{ margin: '12px', padding: 12, borderRadius: 14, background: `linear-gradient(135deg,#FBEFC4,${GOLD})`, color: INK }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <h2 id="eip-card-title" style={{ margin: 0, fontSize: 16, fontWeight: 800, color: INK }}>Complete your page</h2>
        <span style={{ fontSize: 12.5, fontWeight: 700 }} data-testid="eip-card-progress">{model.done} of {model.total} done</span>
      </div>
      <div role="progressbar" aria-label="Page completion" aria-valuemin={0} aria-valuemax={model.total} aria-valuenow={model.done} style={{ height: 6, borderRadius: 999, background: 'rgba(12,10,13,0.15)', margin: '8px 0 6px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: INK, borderRadius: 999 }} />
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {rows.map((r) => <CardRowView key={r.key} row={r} onOpen={onOpen} />)}
      </ul>
      {model.more.length > 0 && !showMore && (
        <button type="button" className="eip-btn" onClick={() => setShowMore(true)} style={{ minHeight: 44, background: 'none', border: 'none', color: INK, fontWeight: 700, fontSize: 13, cursor: 'pointer', padding: 0 }}>
          Show more
        </button>
      )}
    </section>
  );
}

// ---- photo, name line, about ---------------------------------------------------------------

export function PhotoSlot({ drafted, onOpen }: { drafted: boolean; onOpen: OpenSheet }) {
  return (
    <>
      {drafted && <span aria-hidden="true" className="eip-drafted" style={{ position: 'absolute', inset: -2, borderRadius: '50%', pointerEvents: 'none' }} />}
      <PencilButton field="avatar_url" onOpen={onOpen} style={{ position: 'absolute', right: -10, bottom: -10 }} />
      {drafted && <span style={{ position: 'absolute', left: '50%', bottom: -24, transform: 'translateX(-50%)' }}><UnsavedTag field="avatar_url" /></span>}
    </>
  );
}

const chip: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 2, minHeight: 32, padding: '0 0 0 10px', borderRadius: 999,
  background: 'rgba(12,10,13,0.45)', border: '1px solid rgba(231,190,110,0.35)', color: CREAM, fontSize: 12.5, fontWeight: 600,
};

// The chip is 32px high; its pencil keeps a 44px hit area by overhanging 6px above and below.
const chipPencil: CSSProperties = { margin: '-6px 0' };

/** Beside the organiser's name in the hero. */
export function NameSlot({ drafted, onOpen }: { drafted: boolean; onOpen: OpenSheet }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }} data-testid="eip-name">
      {drafted && <UnsavedTag field="name" />}
      <PencilButton field="name" onOpen={onOpen} compact style={{ width: 44, minWidth: 44 }} />
    </span>
  );
}

export function MetaSlot({ year, category, city, drafted, onOpen }: {
  year: number | null | undefined; category: string | null | undefined; city: string | null | undefined;
  drafted: { year: boolean; category: boolean; city: boolean }; onOpen: OpenSheet;
}) {
  return (
    <span style={{ display: 'inline-flex', gap: '12px 6px', flexWrap: 'wrap', justifyContent: 'center' }} data-testid="eip-meta">
      <span style={chip} className={drafted.city ? 'eip-drafted' : undefined} data-testid="eip-city">
        {/* A drafted city whose name is still being looked up is a pick, not a missing city. */}
        {city ? city : drafted.city ? 'City picked' : 'Add city'}
        {drafted.city && <UnsavedTag field="city" />}
        <PencilButton field="city" onOpen={onOpen} compact style={chipPencil} />
      </span>
      <span style={chip} className={drafted.year ? 'eip-drafted' : undefined}>
        {year ? `Since ${year}` : 'Add year started'}
        {drafted.year && <UnsavedTag field="founded_year" />}
        <PencilButton field="founded_year" onOpen={onOpen} compact style={chipPencil} />
      </span>
      <span style={chip} className={drafted.category ? 'eip-drafted' : undefined}>
        {category ? category : 'Add category'}
        {drafted.category && <UnsavedTag field="organisation_category" />}
        <PencilButton field="organisation_category" onOpen={onOpen} compact style={chipPencil} />
      </span>
    </span>
  );
}

export function AboutSlot({ drafted, onOpen }: { drafted: boolean; onOpen: OpenSheet }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 4, verticalAlign: 'middle' }}>
      {drafted && <UnsavedTag field="bio" />}
      <PencilButton field="bio" onOpen={onOpen} />
    </span>
  );
}

export const AboutEmpty = () => (
  <p style={{ margin: 0, fontSize: 14, color: 'rgba(246,241,234,0.6)' }} data-testid="eip-about-empty">
    Not added yet. Optional: tell dancers who you are and what your nights are like.
  </p>
);

// ---- link rows -----------------------------------------------------------------------------

const LINK_FIELDS: FieldKey[] = ['instagram', 'facebook', 'website'];

export function LinkRows({ values, drafted, onOpen }: {
  values: Record<'instagram' | 'facebook' | 'website', string | null | undefined>;
  drafted: Partial<Record<FieldKey, boolean>>;
  onOpen: OpenSheet;
}) {
  return (
    <section aria-labelledby="eip-links-title" className="px-5 md:px-12 py-3" style={{ borderBottom: '1px solid rgba(246,241,234,0.08)' }} data-testid="eip-links">
      <h2 id="eip-links-title" style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: GOLD }}>Your links</h2>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxWidth: 480 }}>
        {LINK_FIELDS.map((f) => {
          const v = values[f as 'instagram'];
          return (
            <li key={f} data-eip-link={f} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44 }}>
              <span style={{ width: 76, flexShrink: 0, fontSize: 12, fontWeight: 600, color: 'rgba(246,241,234,0.6)' }}>{FIELD_LABEL[f]}</span>
              {/* minWidth 0 + ellipsis: a long value never runs under the pencil, which keeps its own 44px. */}
              <span className={drafted[f] ? 'eip-drafted' : undefined} title={v ?? undefined} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14, color: v ? CREAM : 'rgba(246,241,234,0.45)' }}>
                {displayValue(f, v)}
              </span>
              {drafted[f] && <UnsavedTag field={f} />}
              <PencilButton field={f} onOpen={onOpen} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---- create event ------------------------------------------------------------------------

/**
 * The organiser area's create flow. The legacy path redirects to the
 * one-question flow (new/what), which creates a DRAFT first; this organiser is
 * preselected through `?o=`, the id useOrganiserChoice reads. Nothing is
 * published from here.
 */
const newEventHref = (organiserId: string) => `${ORG_PATHS.newWhat}?o=${encodeURIComponent(organiserId)}`;

export function CreateEventLink({ organiserId, label }: { organiserId: string; label: string }) {
  return (
    <Link
      to={newEventHref(organiserId)}
      className="eip-btn"
      data-testid="eip-create-event"
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, padding: '0 16px', borderRadius: 100, background: GOLD, color: INK, fontSize: 13, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}
    >
      {label}
    </Link>
  );
}
