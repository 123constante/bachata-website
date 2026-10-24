import { GOING_COPY } from '@/modules/going/goingCopy';

/**
 * Going P2: "Show my photo when I'm going" on Edit. Its words are the going module's,
 * so EditScreen lazy-loads this file only while the going switch is on (the
 * CalendarGoingFeed pattern): switch off, /app/* loads none of the going module.
 * Saved with Save changes (buildDelta sends show_going_photo only when it changed).
 */
const GoingPhotoSwitch = ({ checked, onToggle }: { checked: boolean; onToggle: () => void }) => (
  <div data-testid="edit-going-photo" className="grid gap-[6px]">
    <div className="flex min-h-[44px] items-center justify-between gap-[12px]">
      <label htmlFor="show_going_photo" className="text-[15px] font-semibold">{GOING_COPY.photoSwitchLabel}</label>
      <button
        id="show_going_photo"
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby="going-photo-line"
        onClick={onToggle}
        className={`h-[44px] min-h-[44px] w-[56px] min-w-[56px] flex-none cursor-pointer rounded-full border border-[var(--line-strong)] text-[15px] font-bold ${
          checked ? 'bg-[var(--btn)] text-[var(--btnfg)]' : 'bg-[var(--card2)] text-[var(--fg)]'
        }`}
      >
        {checked ? 'On' : 'Off'}
      </button>
    </div>
    <p id="going-photo-line" className="m-0 text-[13px] text-[var(--mut)]">
      {GOING_COPY.photoSwitchLine}
    </p>
  </div>
);

export default GoingPhotoSwitch;
