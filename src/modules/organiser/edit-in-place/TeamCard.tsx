// Edit in place: the owner's Team card on the live page (mockup screen 1's Team
// card). One line saying who is on the team now, and ONE "Add a person" button
// that opens the team picker (TeamSheet). Rendered only when teamPickerAccess()
// says owner or admin; a manager or contributor gets no card and no picker.
import type { MouseEvent } from 'react';
import { UserPlus } from 'lucide-react';
import { CREAM, GOLD } from './parts';
import { PICKER_COPY } from './teamPickerModel';

const MUTED = 'rgba(246,241,234,0.7)';

export function TeamCard({ countLine, onAdd }: { countLine: string; onAdd: (opener: HTMLElement) => void }) {
  return (
    <section aria-labelledby="eip-team-title" className="px-5 md:px-12 py-3" style={{ borderBottom: '1px solid rgba(246,241,234,0.08)' }} data-testid="eip-team">
      <h2 id="eip-team-title" style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: GOLD }}>Team</h2>
      <div style={{ maxWidth: 480 }}>
        <p style={{ margin: '2px 0 4px', fontSize: 14, color: MUTED }} data-testid="eip-team-count">{countLine}</p>
        <button
          type="button"
          className="eip-btn"
          data-eip-pencil="team"
          onClick={(e: MouseEvent<HTMLButtonElement>) => onAdd(e.currentTarget)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', minHeight: 44, padding: 0, background: 'none', border: 'none', borderTop: '1px solid rgba(246,241,234,0.08)', color: GOLD, fontSize: 14, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}
        >
          {PICKER_COPY.title}
          <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: '50%', border: `1.5px dashed ${GOLD}`, color: CREAM, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <UserPlus width={14} height={14} strokeWidth={2.4} />
          </span>
        </button>
      </div>
    </section>
  );
}
