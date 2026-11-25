import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { APP_WELCOME_PATH } from '@/lib/accountRouting';
import type { MyDancerEdit } from '../../api/types';
import { HomeBodyForPeek } from './HomeScreen';
import './locked.css';

/** How long the "Finish your profile" toast stays up; a repeat tap restarts it. */
export const TOAST_MS = 2200;

/** Anything a finger could use to leave or act: links, buttons, tabs, role=button/link. */
const TAPPABLE = 'a, button, [role="button"], [role="link"], [role="tab"], [role="menuitem"], summary, [tabindex]:not([tabindex="-1"])';

export const LOCKED_TOAST_TEXT = '\u{1F512} Finish your profile to unlock this';
export const peekBarCopy = (name: string) => ({
  title: `Almost there, ${name}`,
  text: 'Add a photo, years dancing and styles to unlock everything.',
});

const nameOf = (p: MyDancerEdit) => (p.first_name ?? p.display_name ?? '').trim() || 'there';

/**
 * The real Home, visible (no blur), with every tappable item made inert: a tap shakes the item and
 * raises a toast. The children are unchanged; the lock lives in this wrapper (capture phase) + CSS.
 * `onFinish` goes to the Roles step of the /app/welcome flow.
 */
export const LockedHome = ({ profile, onFinish }: { profile: MyDancerEdit; onFinish?: () => void }) => {
  const navigate = useNavigate();
  const [toast, setToast] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const name = nameOf(profile);
  const bar = peekBarCopy(name);
  const finish = onFinish ?? (() => navigate(APP_WELCOME_PATH));

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const onLockedClick = (e: MouseEvent<HTMLDivElement>) => {
    const item = (e.target as HTMLElement).closest(TAPPABLE);
    if (!item || !e.currentTarget.contains(item)) return;
    e.preventDefault();
    e.stopPropagation();
    // Remove then add the class (after a reflow) so the shake replays on every tap.
    item.classList.remove('shake');
    void (item as HTMLElement).offsetWidth;
    item.classList.add('shake');
    setToast(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(false), TOAST_MS);
  };

  return (
    <div className="da-peek" data-testid="locked-home">
      <h1 className="da-peek-title" data-testid="peek-title">Hi {name} &#128075;</h1>
      <div className="da-locked" data-testid="locked-body" onClickCapture={onLockedClick}>
        <HomeBodyForPeek profile={profile} />
      </div>
      <div className="da-peek-toast" role="status" data-testid="peek-toast" data-shown={toast} style={{ opacity: toast ? 1 : 0, pointerEvents: toast ? 'auto' : 'none' }}>
        <span>{LOCKED_TOAST_TEXT}</span>
        <button type="button" data-testid="peek-toast-finish" onClick={finish}>Finish</button>
      </div>
      <div className="peekbar" data-testid="peekbar">
        <b>{bar.title}</b>
        <p>{bar.text}</p>
        <button type="button" data-testid="peek-finish" onClick={finish}>Finish my profile</button>
      </div>
    </div>
  );
};

export default LockedHome;
