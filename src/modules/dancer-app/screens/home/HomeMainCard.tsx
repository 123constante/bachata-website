import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Card } from '@/modules/organiser/ui';
import { LINK_GHOST_SM, LINK_PRIMARY } from '../blocks';
import { DANCER_TABS } from '../../shell/routes';
import { editHref } from '../me/model';
import type { EditFocus } from '../../api/nextStep';
import { homeMain, previewLine, type HomeProfile } from './homeModel';

const NIGHTS_PATH = DANCER_TABS.find((t) => t.id === 'nights')?.path ?? '/app/nights';

/**
 * Home's ONE main card (admin #1534, Option A). Every word comes from homeMain();
 * this file only draws it. No stats on a new account, no duplicate calls to action.
 */
export const HomeMainCard = ({
  profile,
  nightsWent,
}: {
  profile: HomeProfile & { first_name: string | null; avatar_url: string | null; profile_id: string };
  nightsWent: number | null;
}) => {
  const main = homeMain(profile, nightsWent);
  return (
    <div style={{ display: 'grid', gap: 10 }} data-testid="home-main" data-shape={main.shape}>
      <Card variant="padded" testId="home-main-card">
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{main.title}</h2>
        {main.shape === 'unfinished' && (
          <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'grid', gap: 8 }} data-testid="home-checklist">
            {main.rows.map((r) => (
              <li key={r.step} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, minHeight: 28 }}>
                <span aria-hidden="true" style={{ width: 22, display: 'inline-flex' }}>{r.done ? <Check size={18} /> : null}</span>
                <span style={{ flex: 1, opacity: r.done ? 0.75 : 1, fontWeight: r.next ? 700 : 400 }}>
                  {r.label}
                  {r.done && <span className="sr-only"> (done)</span>}
                </span>
                {r.next && <b style={{ fontSize: 13 }}>next</b>}
              </li>
            ))}
          </ul>
        )}
        {main.shape !== 'complete' && (
          <>
            <div style={{ marginTop: 12 }}>
              <Link
                to={main.button.path === '/app/me/photo' ? main.button.path : editHref(main.button.focus as EditFocus | null)}
                className={LINK_PRIMARY}
                data-testid="home-next-step"
              >
                {main.button.label}
              </Link>
            </div>
            <p className="da-muted" style={{ margin: '10px 0 0', fontSize: 14 }} data-testid="home-numbers-line">{main.numbersLine}</p>
          </>
        )}
        {main.shape === 'complete' && main.attended !== null && (
          <p style={{ margin: '8px 0 0', fontSize: 15 }} data-testid="home-attended">
            <b style={{ fontSize: 28 }}>{main.attended}</b> nights you went to
          </p>
        )}
        {main.shape === 'complete' && main.empty && (
          <div data-testid="home-attended-empty" style={{ marginTop: 8 }}>
            <b>{main.empty.title}</b>
            <p style={{ margin: '4px 0 10px', fontSize: 14 }}>{main.empty.body}</p>
            <Link to={NIGHTS_PATH} className={LINK_PRIMARY}>{main.empty.cta}</Link>
          </div>
        )}
      </Card>
      <Link to={`/dancers/${profile.profile_id}`} className={LINK_GHOST_SM} data-testid="home-preview-row" style={{ justifyContent: 'space-between' }}>
        <span>Preview your page</span>
        <span style={{ fontSize: 13, fontWeight: 400 }} data-testid="home-preview-line">{previewLine(profile)}</span>
      </Link>
    </div>
  );
};
