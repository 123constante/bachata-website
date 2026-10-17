import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { APP_ACCOUNT_SETTINGS_PATH } from '@/lib/accountRouting';
import { toDancerError } from '../../api/errors';
import { fmt, NUMBERS_LOAD_FAILED, viewsDetail, VIEWS_WEEK_LABEL } from '../../api/numbersModel';
import { useMyDancerEdit } from '../../api/useMyDancerEdit';
import { useMyNumbers } from '../../api/useMyNumbers';
import { ACCOUNT_SETTINGS_LABEL } from '../../copy/sharedCopy';
import { buttonStyle, linkStyle } from '../nights/nightsStyles';
import { shareOrCopy } from '../options/optionsModel';
import NoProfileWayOut from '../options/NoProfileWayOut';
import { NO_PROFILE_MESSAGE, PROFILE_HELP_MESSAGE } from '../../api/messageUs';
import { MessageUsLink } from '../me/ui';
import { ROW } from '../options/optionsUi';
import { pageModel } from './pageModel';

const ghost: CSSProperties = { ...buttonStyle, background: 'transparent', color: 'var(--da-text)', border: '1px solid var(--da-border)' };
const off: CSSProperties = { opacity: 0.5, cursor: 'not-allowed' };

const PageScreen = () => {
  const profile = useMyDancerEdit({ staleTime: 60_000 });
  const numbers = useMyNumbers();
  const [copied, setCopied] = useState<'idle' | 'copied' | 'manual'>('idle');

  if (profile.isLoading) return <div className="da-card" role="status" data-testid="dancer-screen-page">Loading your page&hellip;</div>;
  if (profile.isError || !profile.data) {
    const err = toDancerError(profile.error);
    return (
      <section className="da-card" data-testid="dancer-screen-page">
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>My page</h1>
        <p role="alert" style={{ fontSize: 14, margin: '8px 0' }}>{err.message}</p>
        {err.code === 'no_profile' || err.code === 'profile_mismatch' ? (
          <>
            <MessageUsLink message={err.code === 'no_profile' ? NO_PROFILE_MESSAGE : PROFILE_HELP_MESSAGE} style={ROW} />
            <NoProfileWayOut />
          </>
        ) : (
          <button type="button" className="da-tap" style={{ ...linkStyle, background: 'none', border: 0 }} onClick={() => void profile.refetch()}>Try again</button>
        )}
      </section>
    );
  }

  const m = pageModel(profile.data);
  const disabled = m.url === null;
  const hasPhoto = Boolean(profile.data.avatar_url);

  return (
    <section data-testid="dancer-screen-page" style={{ display: 'grid', gap: 12 }}>
      <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>My page</h1>

      <div className="da-card" style={{ display: 'grid', gap: 6 }}>
        <b style={{ fontSize: 14 }}>How your page looks</b>
        <ul data-testid="page-look" style={{ margin: 0, paddingLeft: 18, fontSize: 14, display: 'grid', gap: 2 }}>
          {m.lookLines.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </div>

      <div className="da-card" data-testid="page-views" style={{ display: 'grid', gap: 2 }}>
        <b style={{ fontSize: 14 }}>{VIEWS_WEEK_LABEL}</b>
        {numbers.isLoading ? (
          <span className="da-muted" style={{ fontSize: 14 }}>Loading&hellip;</span>
        ) : numbers.data ? (
          <>
            <span style={{ fontSize: 28, fontWeight: 800 }} data-testid="page-views-count">{fmt(numbers.data.viewsWeek)}</span>
            <span className="da-muted" style={{ fontSize: 13 }} data-testid="page-views-detail">{viewsDetail(numbers.data, hasPhoto)}</span>
          </>
        ) : (
          <span role="status" data-testid="page-views-error" style={{ fontSize: 14 }}>{NUMBERS_LOAD_FAILED}</span>
        )}
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {disabled ? (
          <button type="button" disabled aria-disabled="true" aria-describedby="page-why" className="da-tap" style={{ ...buttonStyle, ...off }} data-testid="page-view">View my page</button>
        ) : (
          <a href={m.url ?? undefined} className="da-tap" style={buttonStyle} data-testid="page-view">View my page</a>
        )}
        {disabled ? (
          <button type="button" disabled aria-disabled="true" aria-describedby="page-why" className="da-tap" style={{ ...ghost, ...off }} data-testid="page-share">Share my page</button>
        ) : (
          <button
            type="button"
            className="da-tap"
            style={ghost}
            data-testid="page-share"
            onClick={async () => {
              const out = await shareOrCopy(m.url as string, 'My dancer page');
              setCopied(out === 'copied' || out === 'manual' ? out : 'idle');
            }}
          >
            Share my page
          </button>
        )}
        {m.disabledReason && (
          <p id="page-why" data-testid="page-why" className="da-muted" style={{ fontSize: 13, margin: 0 }}>
            {m.disabledReason}{' '}
            {m.fixHint === 'edit' && <Link to="/app/me/edit" style={linkStyle}>Edit my profile</Link>}
            {m.fixHint === 'account-settings' && <Link to={APP_ACCOUNT_SETTINGS_PATH} style={linkStyle}>{ACCOUNT_SETTINGS_LABEL}</Link>}
          </p>
        )}
        {copied === 'copied' && <p role="status" className="da-muted" style={{ fontSize: 13, margin: 0 }}>Link copied</p>}
        {copied === 'manual' && m.url && (
          <input readOnly value={m.url} aria-label="Link to my page" data-testid="page-share-field" onFocus={(e) => e.currentTarget.select()} style={{ width: '100%', minHeight: 44, borderRadius: 10, border: '1px solid var(--da-border)', background: 'var(--da-bg)', color: 'var(--da-text)', padding: '0 10px', fontSize: 14 }} />
        )}
      </div>
    </section>
  );
};

export default PageScreen;
