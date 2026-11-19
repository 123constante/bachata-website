import { Suspense, useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ChevronRight, Plus, X } from 'lucide-react';
import { ACCOUNT_SETTINGS_PATH, APP_ACCOUNT_SETTINGS_PATH, ORGANISER_HOME_PATH, switcherItems, type SwitcherWhere } from '@/lib/accountRouting';
import { ACCOUNT_SETTINGS_LABEL } from '@/modules/dancer-app/copy/sharedCopy';
import { dancerMessageUsUrl } from '@/lib/contactLinks';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { SideAvatar, sideKind, sideTitle } from './SideAvatar';
import { PersonAvatar } from './PersonAvatar';
import { useProfileSides } from './useProfileSides';
import { SWITCH_TITLE, SWITCH_WORD } from './switchR4Model';

// The Coming soon card and Your areas load with the open sheet, never on the page's first load.
const SwitcherSoonR4 = lazyWithRetry(() => import('@/modules/areas/home/SwitcherSoonR4'));

const ADD_PROFILE_LABEL = 'Add a profile';
const ADD_ORGANISER_LABEL = 'Run events? Become an organiser';
const ADD_OTHER_LABEL = 'DJ or teach? Message us';
const ADD_OTHER_MESSAGE = 'Hi, I would like to add a DJ or teacher profile to my account.';
const SHOWING_LABEL = 'Showing';
const SIDE_GROUP_LABEL = { dancer: 'Dancer', organiser: 'Organiser' } as const;

/** Round-4 tokens (canvas Round 4 screen 5). Orange only for the active mark. */
const R4 = { sf: '#FFFFFF', fg: '#030303', mut: '#464646', line: '#E9E9E9', acc: '#C2410C', handle: '#D9D9D9' };
const DANCER = { sf: 'var(--da-surface)', fg: 'var(--da-text)', mut: 'var(--da-text-muted)', line: 'var(--da-border)', acc: 'var(--da-accent)', handle: 'var(--da-border)' };

/** The link card: + Add a profile, (Your areas, from the lazy chunk), Account settings. */
function LinkCard({ cardStyle, addRow, settingsRow }: { cardStyle: CSSProperties; addRow: ReactNode; settingsRow: ReactNode }) {
  return <div style={cardStyle} data-testid="profile-switcher-links">{addRow}{settingsRow}</div>;
}

/**
 * "Switch profile", Round-4 look (flag dashboardSwitchR4; the flag-off sheet is ProfileSwitcher,
 * unchanged). Same sides, same order, same links; the changes are the owner's 2026-11-19 picks:
 * the button reads Switch even with one profile, both areas get + Add a profile, Teacher / DJ are
 * a grey Coming soon card (picked at onboarding only), and Sign out lives at the foot of Account
 * settings instead. The dancer app keeps its dark surface; the organiser area is white + orange.
 */
export function ProfileSwitcherR4({ where }: { where: SwitcherWhere }) {
  const { state } = useProfileSides();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const titleId = useId();
  const dancer = where.area === 'dancer';
  const t = dancer ? DANCER : R4;

  const close = () => {
    setOpen(false);
    setAdding(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const items = state.status === 'ready' ? switcherItems(state.sides, where) : [];
  const current = items.find((i) => i.current);

  const row = 'flex min-h-[52px] w-full items-center gap-[12px] px-[16px] text-left text-[13px]';
  const heading = 'mb-[8px] font-mono text-[12px] font-medium uppercase tracking-[0.05em]';
  const card: CSSProperties = { background: t.sf, border: `1px solid ${t.line}`, borderRadius: 11, overflow: 'hidden' };
  const chevron = <ChevronRight aria-hidden="true" className="shrink-0" style={{ width: 16, height: 16, color: t.mut }} />;
  const sheetSurface: CSSProperties = dancer
    ? { background: t.sf, color: t.fg, minHeight: 'auto', borderTop: `1px solid ${t.line}` }
    : { background: t.sf, color: t.fg };

  const addRow = (
    <button type="button" onClick={() => setAdding(true)} className={row} data-testid="profile-switcher-add">
      <Plus aria-hidden="true" className="shrink-0" style={{ width: 18, height: 18 }} />
      <span className="min-w-0 flex-1 font-medium">{ADD_PROFILE_LABEL}</span>
      {chevron}
    </button>
  );
  const settingsRow = (
    // Inside the dancer app, settings keeps "Back to Options" (review #789 S1).
    <Link
      to={dancer ? APP_ACCOUNT_SETTINGS_PATH : ACCOUNT_SETTINGS_PATH}
      onClick={close}
      className={row}
      style={{ borderTop: `1px solid ${t.line}` }}
      data-testid="profile-switcher-settings"
    >
      <span className="min-w-0 flex-1 font-medium">{ACCOUNT_SETTINGS_LABEL}</span>
      {chevron}
    </Link>
  );

  return (
    <>
      <button
        type="button"
        aria-label={SWITCH_TITLE}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="profile-switcher-button"
        onClick={() => setOpen(true)}
        className={
          dancer
            ? 'flex h-[44px] shrink-0 items-center gap-[8px] rounded-full pl-[6px] pr-[12px] text-[14px] font-semibold'
            : 'flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full'
        }
        style={dancer ? { border: '1px solid var(--da-border)', background: 'var(--da-surface)', color: 'var(--da-text)' } : undefined}
      >
        {current ? <SideAvatar side={current} size={32} /> : <PersonAvatar photoUrl={null} name={null} size={32} />}
        {dancer && <span data-testid="profile-switcher-label">{SWITCH_WORD}</span>}
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50" data-testid="profile-switcher-backdrop" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-testid="profile-switcher-sheet"
            data-look="r4"
            data-profile={dancer ? 'dancer' : undefined}
            onClick={(e) => e.stopPropagation()}
            style={sheetSurface}
            className="max-h-[calc(100dvh-16px)] w-full max-w-[480px] overflow-y-auto rounded-t-[16px] pb-[calc(16px+env(safe-area-inset-bottom))] pt-[8px] shadow-xl"
          >
            <div aria-hidden="true" className="mx-auto mb-[4px] h-[5px] w-[40px] rounded-full" style={{ background: t.handle }} />
            <div className="flex items-center justify-between pl-[16px] pr-[4px]">
              <h2 id={titleId} className="text-[15px] font-semibold">
                {adding ? ADD_PROFILE_LABEL : SWITCH_TITLE}
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center"
                data-testid="profile-switcher-close"
              >
                <X aria-hidden="true" style={{ width: 20, height: 20 }} />
              </button>
            </div>
            <div className="flex flex-col gap-[16px] px-[16px] pt-[8px]">
              {state.status === 'loading' && (
                <p className="text-[13px]" style={{ color: t.mut }} aria-busy="true">
                  Loading your profiles&hellip;
                </p>
              )}
              {state.status === 'failed' && (
                <p className="text-[13px]" style={{ color: t.mut }} data-testid="profile-switcher-failed">
                  We could not load your profiles. Close this and try again in a moment.
                </p>
              )}
              {adding && (
                <div style={card} data-testid="profile-switcher-add-sheet">
                  <Link to={ORGANISER_HOME_PATH} onClick={close} className={row} data-testid="profile-switcher-add-organiser">
                    <span className="min-w-0 flex-1 font-medium">{ADD_ORGANISER_LABEL}</span>
                    {chevron}
                  </Link>
                  <a
                    href={dancerMessageUsUrl(ADD_OTHER_MESSAGE)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={row}
                    style={{ borderTop: `1px solid ${t.line}` }}
                    data-testid="profile-switcher-add-other"
                  >
                    <span className="min-w-0 flex-1 font-medium">{ADD_OTHER_LABEL}</span>
                    {chevron}
                  </a>
                  <button
                    type="button"
                    onClick={() => setAdding(false)}
                    className={row}
                    style={{ borderTop: `1px solid ${t.line}` }}
                    data-testid="profile-switcher-add-back"
                  >
                    <span className="min-w-0 flex-1 font-medium">Back</span>
                  </button>
                </div>
              )}
              {!adding && (
                <div className="flex flex-col gap-[16px]" data-testid="profile-switcher-sides">
                  {(['dancer', 'organiser'] as const).map((kind) => {
                    const group = items.filter((i) => i.kind === kind);
                    if (group.length === 0) return null;
                    return (
                      <section key={kind} aria-label={SIDE_GROUP_LABEL[kind]} data-testid={`profile-switcher-group-${kind}`}>
                        <h3 className={heading} style={{ color: t.mut }}>{SIDE_GROUP_LABEL[kind]}</h3>
                        <ul style={card}>
                          {group.map((item, i) => (
                            <li key={item.key} style={i ? { borderTop: `1px solid ${t.line}` } : undefined}>
                              <Link
                                to={item.to}
                                aria-current={item.current ? 'true' : undefined}
                                data-testid={`profile-switcher-side-${item.key}`}
                                onClick={close}
                                className={row}
                              >
                                <SideAvatar side={item} size={32} />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-medium">{sideTitle(item)}</span>
                                  <span className="block text-[12px]" style={{ color: t.mut }}>{sideKind(item)}</span>
                                </span>
                                {item.current ? (
                                  <span
                                    className="shrink-0 rounded-full px-[7px] py-[3px] text-[11px] font-semibold uppercase leading-none tracking-[0.07em]"
                                    style={{ border: `1px solid ${t.acc}`, color: t.acc }}
                                    data-testid="profile-switcher-showing"
                                  >
                                    {SHOWING_LABEL}
                                  </span>
                                ) : chevron}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </section>
                    );
                  })}
                  {state.status === 'ready' && (
                    <Suspense fallback={<LinkCard cardStyle={card} addRow={addRow} settingsRow={settingsRow} />}>
                      <SwitcherSoonR4
                        rowClass={row}
                        headingClass={heading}
                        cardStyle={card}
                        lineColor={t.line}
                        mutedColor={t.mut}
                        chevron={chevron}
                        addRow={addRow}
                        settingsRow={settingsRow}
                        onPick={close}
                      />
                    </Suspense>
                  )}
                  {state.status !== 'ready' && <LinkCard cardStyle={card} addRow={null} settingsRow={settingsRow} />}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export default ProfileSwitcherR4;
