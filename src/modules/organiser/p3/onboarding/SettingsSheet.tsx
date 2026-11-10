import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SIGN_OUT_FAILED, useSignOutToHome } from '@/components/account/profiles/signOutToHome';
import { ACCOUNT_SETTINGS_LABEL, ACCOUNT_SETTINGS_PATH } from '@/lib/accountRouting';
import { accountContactHref } from '@/lib/accountDeletionCopy';
import { selfServeErrorCopy } from '../../shared/selfServeErrors';
import { ObSheet } from './ObShell';
import { REAL_PAGE_WRITES } from './pageApi';
import { NAME_MAX } from './pageModel';
import './page.css';

/** X1: the area's one Account / Help / Sign out block. Help is the support mailbox (the one contact address). */
export const X1_COPY = { heading: 'Account', help: 'Help', helpSubject: 'Help with my organiser page' } as const;

export interface SettingsBodyProps {
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  organiserId: string | null;
  pageName: string;
  rename: (organiserId: string, name: string) => Promise<void>;
  onRenamed: (name: string) => void;
}

/**
 * The Settings sheet (prototype "(sheet) settings", MAY SCROLL): dark mode (the onboarding screens'
 * own switch, localStorage p3-ob-theme), the page name (rename moved here from Category, prototype
 * assumption 10; organiser_profile_update_p5_v1 {name}, diff-first) and sign-out (useSignOutToHome).
 */
export function SettingsBody({ theme, setTheme, organiserId, pageName, rename, onRenamed }: SettingsBodyProps) {
  const [name, setName] = useState(pageName);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { signOutToHome, busy: leaving } = useSignOutToHome();
  const [outErr, setOutErr] = useState<string | null>(null);
  const trimmed = name.trim();
  const why = !trimmed ? 'Type a name to save.' : Array.from(trimmed).length > NAME_MAX ? `Keep the name under ${NAME_MAX} characters.` : trimmed === pageName.trim() ? 'Change the name to save it.' : null;
  const save = async () => {
    if (why || busy || !organiserId) {
      if (why) setMsg({ ok: false, text: why });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await rename(organiserId, trimmed);
      onRenamed(trimmed);
      setMsg({ ok: true, text: 'Saved.' });
    } catch (e) {
      setMsg({ ok: false, text: selfServeErrorCopy(e).message });
    } finally {
      setBusy(false);
    }
  };
  const dark = theme === 'dark';
  return (
    <div className="p3-ob-settings" data-testid="p3-ob-settings">
      <button type="button" className="p3-ob-row" role="switch" aria-checked={dark} onClick={() => setTheme(dark ? 'light' : 'dark')} data-testid="p3-ob-dark">
        <span className="p3-ob-row-txt"><strong>Dark mode</strong><span>{dark ? 'On' : 'Off'}</span></span>
        <span className="p3-ob-switch" data-on={dark ? 'true' : undefined} aria-hidden="true" />
      </button>
      {organiserId && (
        <div className="p3-ob-set-block">
          <label className="p3-ob-sect" htmlFor="p3-ob-set-name">Page name</label>
          <input id="p3-ob-set-name" className="p3-ob-inp" type="text" autoComplete="off" value={name} maxLength={NAME_MAX + 20} onChange={(e) => { setName(e.target.value); setMsg(null); }} data-testid="p3-ob-set-name" />
          {msg && <p className={msg.ok ? 'p3-ob-m' : 'p3-ob-err'} role={msg.ok ? 'status' : 'alert'} data-testid="p3-ob-set-msg">{msg.text}</p>}
          <button type="button" className="p3-ob-btn p3-ob-btn-sm" aria-disabled={why || busy ? 'true' : undefined} title={why ?? undefined} onClick={() => void save()} data-testid="p3-ob-set-save">
            {busy ? 'Saving\u2026' : 'Save name'}
          </button>
        </div>
      )}
      {/* X1 (slice 1b): Account, Help and Sign out in ONE place for the area. */}
      <div className="p3-ob-set-block" data-testid="p3-ob-account-block">
        <p className="p3-ob-sect">{X1_COPY.heading}</p>
        <Link to={ACCOUNT_SETTINGS_PATH} className="p3-ob-btn p3-ob-btn-line p3-ob-btn-sm" style={{ minHeight: 44 }} data-testid="p3-ob-account">
          {ACCOUNT_SETTINGS_LABEL}
        </Link>
        <a href={accountContactHref(X1_COPY.helpSubject)} className="p3-ob-btn p3-ob-btn-line p3-ob-btn-sm" style={{ minHeight: 44 }} data-testid="p3-ob-help">
          {X1_COPY.help}
        </a>
        {outErr && <p className="p3-ob-err" role="alert">{outErr}</p>}
        <button type="button" className="p3-ob-btn p3-ob-btn-line p3-ob-btn-sm" aria-disabled={leaving ? 'true' : undefined}
          onClick={async () => { setOutErr(null); if ((await signOutToHome()) === 'failed') setOutErr(SIGN_OUT_FAILED); }} data-testid="p3-ob-signout">
          Sign out
        </button>
      </div>
    </div>
  );
}

/** The sheet itself, for P3 Home (lazy-loaded there, so its bytes stay out of Home's chunk until opened). */
export default function SettingsSheet({ rename = REAL_PAGE_WRITES.rename, ...props }: Omit<SettingsBodyProps, 'rename'> & { rename?: SettingsBodyProps['rename']; onClose: () => void }) {
  return (
    <ObSheet title="Settings" onClose={props.onClose} theme={props.theme} testId="p3-ob-sheet-settings">
      <SettingsBody {...props} rename={rename} />
    </ObSheet>
  );
}
