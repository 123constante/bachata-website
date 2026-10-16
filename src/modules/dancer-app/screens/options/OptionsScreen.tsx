import { useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SIGN_OUT_FAILED, useSignOutToHome } from '@/components/account/profiles/signOutToHome';
import { useMyDancerEdit } from '../../api/useMyDancerEdit';
import { ACCOUNT_SETTINGS_LABEL } from '../../copy/sharedCopy';
import {
  ACCOUNT_SETTINGS_PATH,
  INSTALL_STEPS,
  SITE_HOME_PATH,
  detectPlatform,
  installOrder,
  optionsRows,
  shareOrCopy,
  shareUrlFor,
  type OptionsRow,
} from './optionsModel';

/** The one sign-out failure line (owned by signOutToHome, shared with the profile switcher). */
export const SIGN_OUT_FAILED_COPY = SIGN_OUT_FAILED;
const LOAD_FAILED_COPY = 'We could not load your options. Check your connection and try again.';

const ROW: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  minHeight: 48,
  padding: '0 12px',
  borderRadius: 10,
  border: '1px solid var(--da-border)',
  background: 'transparent',
  color: 'var(--da-text)',
  fontSize: 15,
  fontWeight: 600,
  textAlign: 'left',
  textDecoration: 'none',
  cursor: 'pointer',
};
const DISABLED: CSSProperties = { ...ROW, opacity: 0.6, cursor: 'not-allowed' };
const REASON: CSSProperties = { fontSize: 13, color: 'var(--da-text-muted)', margin: '2px 4px 0' };

const Sheet = ({ title, testId, onClose, children }: { title: string; testId: string; onClose: () => void; children: ReactNode }) => (
  <div
    role="dialog"
    aria-modal="true"
    aria-label={title}
    data-testid={testId}
    style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end', background: 'rgba(0,0,0,0.55)' }}
  >
    <div
      className="da-card"
      style={{ width: '100%', maxHeight: '85dvh', overflowY: 'auto', borderRadius: '16px 16px 0 0', padding: 16, background: 'var(--da-surface)' }}
    >
      <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 8px' }}>{title}</h2>
      {children}
      <button type="button" className="da-tap" style={{ ...ROW, marginTop: 12, justifyContent: 'center' }} onClick={onClose}>
        Close
      </button>
    </div>
  </div>
);

const OptionsScreen = () => {
  const { signOutToHome, busy: signingOut } = useSignOutToHome();
  const profile = useMyDancerEdit();
  const [sheet, setSheet] = useState<'install' | 'sign-out' | null>(null);
  const [copied, setCopied] = useState<'idle' | 'copied' | 'manual'>('idle');
  const [signOutFailed, setSignOutFailed] = useState(false);

  if (profile.isError) {
    return (
      <section className="da-card" data-testid="dancer-screen-options">
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Options</h1>
        <p role="alert" style={{ fontSize: 14, margin: '8px 0' }}>{LOAD_FAILED_COPY}</p>
        <button type="button" className="da-tap" style={ROW} onClick={() => void profile.refetch()}>Retry</button>
      </section>
    );
  }
  if (!profile.data) {
    return (
      <section className="da-card" data-testid="dancer-screen-options">
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Options</h1>
        <p className="da-muted" style={{ fontSize: 14 }}>Loading&hellip;</p>
      </section>
    );
  }

  const me = profile.data;
  const rows = optionsRows(me);
  const shareUrl = shareUrlFor(me.profile_id);
  const platform = detectPlatform(typeof navigator === 'undefined' ? '' : navigator.userAgent, typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints);

  // Audit H10: leave for the site home FIRST, then sign out (useSignOutToHome). On
  // 'ok' this screen has already unmounted. On 'failed' the hook comes back here
  // and toasts the same line; if this sheet is still mounted it shows it too.
  const doSignOut = async () => {
    setSignOutFailed(false);
    if ((await signOutToHome()) === 'failed') setSignOutFailed(true);
  };

  const renderRow = (row: OptionsRow) => {
    if (row.disabledReason) {
      return (
        <div key={row.id}>
          <button type="button" disabled aria-disabled="true" aria-describedby={`opt-why-${row.id}`} style={DISABLED} data-testid={`opt-${row.id}`}>
            {row.label}
          </button>
          <p id={`opt-why-${row.id}`} style={REASON} data-testid={`opt-why-${row.id}`}>{row.disabledReason}</p>
        </div>
      );
    }
    if (row.href) {
      const external = /^https?:/.test(row.href);
      return external ? (
        // TODO(release 1b): when the feedback inbox exists, fire trackDancerEvent('feedback_sent', ...) here. 1a fires nothing.
        <a key={row.id} href={row.href} target="_blank" rel="noreferrer" style={ROW} data-testid={`opt-${row.id}`}>{row.label}</a>
      ) : (
        <Link key={row.id} to={row.href} style={ROW} data-testid={`opt-${row.id}`}>{row.label}</Link>
      );
    }
    const onClick = async () => {
      if (row.id === 'share') {
        const outcome = await shareOrCopy(shareUrl, 'My dancer page');
        setCopied(outcome === 'copied' || outcome === 'manual' ? outcome : 'idle');
      }
      else if (row.id === 'install') setSheet('install');
      else if (row.id === 'sign-out') { setSignOutFailed(false); setSheet('sign-out'); }
    };
    return (
      <button key={row.id} type="button" style={ROW} onClick={() => void onClick()} data-testid={`opt-${row.id}`}>{row.label}</button>
    );
  };

  return (
    <section data-testid="dancer-screen-options" style={{ display: 'grid', gap: 12 }}>
      <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Options</h1>

      <div className="da-card" style={{ display: 'grid', gap: 8 }}>
        {rows.map(renderRow)}
        {copied === 'copied' && <p role="status" style={REASON}>Link copied</p>}
        {copied === 'manual' && (
          <div>
            <p role="status" style={REASON}>Copying is not available here. Select the link and copy it:</p>
            <input
              readOnly
              value={shareUrl}
              aria-label="Link to my page"
              data-testid="opt-share-field"
              onFocus={(e) => e.currentTarget.select()}
              style={{ width: '100%', minHeight: 44, borderRadius: 10, border: '1px solid var(--da-border)', background: 'var(--da-bg)', color: 'var(--da-text)', padding: '0 10px', fontSize: 14 }}
            />
          </div>
        )}
        <p style={REASON} data-testid="opt-account-settings-line">
          Hide your profile, download your data or delete your account:{' '}
          <Link to={ACCOUNT_SETTINGS_PATH} style={{ color: 'var(--da-accent)', display: 'inline-flex', alignItems: 'center', minHeight: 44 }}>{ACCOUNT_SETTINGS_LABEL}</Link>
        </p>
      </div>

      <div className="da-card" style={{ display: 'grid', gap: 8 }}>
        <Link to={SITE_HOME_PATH} style={ROW} data-testid="opt-back-to-site">&larr; Back to the Bachata Calendar website</Link>
      </div>

      {sheet === 'install' && (
        <Sheet title="Add to my phone's home screen" testId="opt-install-sheet" onClose={() => setSheet(null)}>
          {installOrder(platform).map((k) => (
            <div key={k} data-testid={`opt-install-${k}`} style={{ marginBottom: 10 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>{INSTALL_STEPS[k].title}</h3>
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
                {INSTALL_STEPS[k].steps.map((s) => <li key={s}>{s}</li>)}
              </ol>
            </div>
          ))}
        </Sheet>
      )}

      {sheet === 'sign-out' && (
        <Sheet title="Sign out?" testId="opt-signout-sheet" onClose={() => setSheet(null)}>
          <p style={{ fontSize: 14, margin: '0 0 8px' }}>You can sign back in any time with your email.</p>
          {signOutFailed && <p role="alert" style={{ fontSize: 14, color: 'var(--da-danger)', margin: '0 0 8px' }}>{SIGN_OUT_FAILED_COPY}</p>}
          <button type="button" className="da-tap" style={{ ...ROW, justifyContent: 'center' }} onClick={() => void doSignOut()} disabled={signingOut} data-testid="opt-signout-confirm">
            {signingOut ? <>Signing out&hellip;</> : signOutFailed ? 'Retry' : 'Yes, sign out'}
          </button>
        </Sheet>
      )}
    </section>
  );
};

export default OptionsScreen;
