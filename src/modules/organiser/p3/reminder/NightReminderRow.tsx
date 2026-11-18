import { useEffect, useState } from 'react';
import { readReminder, setReminder } from './reminderApi';
import { reminderView, type ReminderRead } from './reminderModel';

/** Option A "One row on the night": a switch, the send time, the buyer count, "sent once". */
export function NightReminderRow({ occurrenceId }: { occurrenceId: string }) {
  const [read, setRead] = useState<ReminderRead | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    let live = true;
    setFailed(false);
    readReminder(occurrenceId).then(
      (p) => { if (live && p.ok) setRead(p.read); else if (live) setFailed(true); },
      () => { if (live) setFailed(true); },
    );
    return () => { live = false; };
  }, [occurrenceId, tries]);

  if (failed) {
    return (
      <div className="p3-card p3-tight" data-testid="p3-reminder-failed">
        <p className="p3-note">The reminder setting didn&rsquo;t load.</p>
        <button type="button" className="p3-link min-h-[44px]" onClick={() => setTries((n) => n + 1)}>Try again</button>
      </div>
    );
  }
  if (!read) return null;

  const view = reminderView(read);
  const flip = async () => {
    if (view.disabledWhy || busy) return;
    const next = !read.enabled;
    const before = read;
    setBusy(true);
    setError(null);
    setRead({ ...read, enabled: next }); // optimistic
    try {
      const p = await setReminder(occurrenceId, next);
      if (p.ok) setRead(p.read); else { setRead(before); setError('That didn’t save. Try again.'); }
    } catch {
      setRead(before);
      setError('That didn’t save. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p3-card p3-tight" data-testid="p3-reminder">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="p3-row-t">Reminder to buyers</p>
          <p className="p3-note" data-testid="p3-reminder-line">{view.line}</p>
        </div>
        <button type="button" role="switch" aria-checked={view.on} aria-label="Reminder to buyers"
          disabled={!!view.disabledWhy || busy} onClick={() => void flip()} data-testid="p3-reminder-switch"
          className="shrink-0 min-h-[44px] min-w-[52px] px-2 flex items-center justify-center disabled:opacity-50">
          <span className="block h-[26px] w-[44px] rounded-full relative" style={{ background: view.on ? 'var(--p3-accent, #7c3aed)' : '#6b7280' }}>
            <span className="absolute top-[3px] h-[20px] w-[20px] rounded-full bg-white" style={{ left: view.on ? 21 : 3 }} />
          </span>
        </button>
      </div>
      {view.disabledWhy && <p className="p3-note" data-testid="p3-reminder-why">{view.disabledWhy}.</p>}
      {error && <p className="p3-warn" role="alert" data-testid="p3-reminder-error">{error}</p>}
    </div>
  );
}
