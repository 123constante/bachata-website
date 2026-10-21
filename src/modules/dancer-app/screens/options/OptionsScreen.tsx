import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useMyDancerEdit } from '../../api/useMyDancerEdit';
import { ACCOUNT_SETTINGS_LABEL } from '../../copy/sharedCopy';
import { toDancerError } from '../../api/errors';
import { NO_PROFILE_MESSAGE, PROFILE_HELP_MESSAGE } from '../../api/messageUs';
import { MessageUsLink } from '../me/ui';
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
import { ROW, Sheet } from './optionsUi';
import FeedbackSheet from './FeedbackSheet';
import SignOutControl from './SignOutControl';
import { CoupleArt } from '../art';
import NoProfileWayOut from './NoProfileWayOut';

const LOAD_FAILED_COPY = 'We could not load your options. Check your connection and try again.';

const DISABLED: CSSProperties = { ...ROW, opacity: 0.6, cursor: 'not-allowed' };
const REASON: CSSProperties = { fontSize: 13, color: 'var(--da-text-muted)', margin: '2px 4px 0' };

const OptionsScreen = () => {
  const profile = useMyDancerEdit();
  const [sheet, setSheet] = useState<'install' | 'feedback' | null>(null);
  const [copied, setCopied] = useState<'idle' | 'copied' | 'manual'>('idle');

  if (profile.isError) {
    // No profile / wrong profile: Retry cannot help, so say so and offer the one way out (journey matrix, check b).
    const err = toDancerError(profile.error);
    if (err.code === 'no_profile' || err.code === 'profile_mismatch') {
      return (
        <section className="da-card" data-testid="dancer-screen-options">
          <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Options</h1>
          <CoupleArt />
          <p role="alert" style={{ fontSize: 14, margin: '8px 0' }}>{err.message}</p>
          <MessageUsLink message={err.code === 'no_profile' ? NO_PROFILE_MESSAGE : PROFILE_HELP_MESSAGE} style={ROW} />
          {/* Walk bug 1: never trapped here -- Account settings, Sign out, and the organiser area for an organiser. */}
          <NoProfileWayOut />
        </section>
      );
    }
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
    if (row.id === 'sign-out') return <SignOutControl key={row.id} testId={`opt-${row.id}`} />;
    if (row.href) {
      const external = /^https?:/.test(row.href);
      return external ? (
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
      else if (row.id === 'feedback') setSheet('feedback');
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

      {sheet === 'feedback' && <FeedbackSheet onClose={() => setSheet(null)} />}

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

    </section>
  );
};

export default OptionsScreen;
