// Edit in place: the owner's Team card on the live page (mockup screen 1's Team
// card). One line saying who is on the team now, and ONE "Add a person" button
// that opens the team picker (TeamSheet), shown only when teamPickerAccess() says
// owner or admin. "Who shows on your page" opens TeamVisibilitySheet (Hide / Show)
// for owner, admin, manager and the self arm (visibilityAccess). The card renders
// when either applies; otherwise the layer draws no card.
import type { MouseEvent } from 'react';
import { Eye, UserPlus } from 'lucide-react';
import { CREAM, GOLD } from './parts';
import { PICKER_COPY } from './teamPickerModel';
import { VISIBILITY_COPY } from './teamVisibilityModel';

const MUTED = 'rgba(246,241,234,0.7)';

const ROW_STYLE = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', minHeight: 44, padding: 0, background: 'none', border: 'none', borderTop: '1px solid rgba(246,241,234,0.08)', color: GOLD, fontSize: 14, fontWeight: 700, cursor: 'pointer', textAlign: 'left' } as const;

export function TeamCard({ countLine, onAdd, onVisibility }: { countLine: string; onAdd?: (opener: HTMLElement) => void; onVisibility?: (opener: HTMLElement) => void }) {
  return (
    <section aria-labelledby="eip-team-title" className="px-5 md:px-12 py-3" style={{ borderBottom: '1px solid rgba(246,241,234,0.08)' }} data-testid="eip-team">
      <h2 id="eip-team-title" style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: GOLD }}>Team</h2>
      <div style={{ maxWidth: 480 }}>
        <p style={{ margin: '2px 0 4px', fontSize: 14, color: MUTED }} data-testid="eip-team-count">{countLine}</p>
        {onAdd && (
          <button
            type="button"
            className="eip-btn"
            data-eip-pencil="team"
            onClick={(e: MouseEvent<HTMLButtonElement>) => onAdd(e.currentTarget)}
            style={ROW_STYLE}
          >
            {PICKER_COPY.title}
            <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: '50%', border: `1.5px dashed ${GOLD}`, color: CREAM, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <UserPlus width={14} height={14} strokeWidth={2.4} />
            </span>
          </button>
        )}
        {onVisibility && (
          <button
            type="button"
            className="eip-btn"
            data-testid="eip-team-visibility"
            onClick={(e: MouseEvent<HTMLButtonElement>) => onVisibility(e.currentTarget)}
            style={ROW_STYLE}
          >
            {VISIBILITY_COPY.open}
            <span aria-hidden="true" style={{ width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: CREAM }}>
              <Eye width={14} height={14} strokeWidth={2.4} />
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
