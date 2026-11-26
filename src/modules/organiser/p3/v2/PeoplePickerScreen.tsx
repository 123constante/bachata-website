import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { PEOPLE_SEARCH_MIN } from '@/modules/organiser/shared/selfServeApi';
import type { PeopleRole } from '../../shared/programmeModel';
import { pickerQueryKey, searchPickerRows, type PickerRow } from '../../dates/peoplePicker';
import { fetchAllTeacherRows, groupTeachers, teacherListQueryKey } from '../../dates/teacherList';
import { flags } from '@/lib/featureFlags';

/** Copy for the people picker lives here (organiserPeoplePicker flag). */
export const PICKER_COPY = {
  back: '‹ Back',
  searchPh: 'Search by name',
  noResults: 'No one found for that name.',
  title: (word: string) => `Add a ${word}`,
  addRow: (word: string) => `+ Add a ${word}`,
  team: 'On your team',
  allTeachers: 'All teachers',
  inviteRow: (name: string) => `+ Invite \u201c${name}\u201d on WhatsApp`,
  inviteHint: 'Not on the site yet? They join from your link.',
};

/** The role word the group's rows use: teacher, DJ, MC, performer, dancer. */
export const ROLE_WORD: Record<string, string> = { teaching: 'teacher', djing: 'DJ', mc: 'MC', performing: 'performer' };
export const roleWord = (role: PeopleRole) => ROLE_WORD[role] ?? 'dancer';

const COLOURS = ['#C2410C', '#0F766E', '#4338CA', '#A21CAF', '#B45309', '#1D4ED8', '#BE123C', '#15803D'];
/** Same person, same colour: a stable hash of the id. */
export const avatarColour = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COLOURS[h % COLOURS.length];
};
export const initialsOf = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
};

/** Round avatar: the photo, else coloured initials. */
export function Avatar({ id, name, url, size }: { id: string; name: string; url: string | null; size: number }) {
  const box = { width: size, height: size, borderRadius: '50%', flex: 'none' as const };
  if (url) return <img src={url} alt="" loading="lazy" style={{ ...box, objectFit: 'cover' }} data-testid="avatar-photo" />;
  return (
    <span aria-hidden="true" data-testid="avatar-initials" style={{ ...box, background: avatarColour(id), color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.4), fontWeight: 600 }}>
      {initialsOf(name)}
    </span>
  );
}

export interface PeoplePickerScreenProps {
  role: PeopleRole;
  onIds: ReadonlySet<string>;
  onPick: (row: PickerRow) => void;
  onBack: () => void;
  /** Teachers already on this page's team (listed first when the search is empty). */
  teamIds?: ReadonlySet<string>;
  /** Set when the class can invite someone not on the site: a typed search ends with an invite row (flag organiserClassInvites). */
  onInvite?: (name: string) => void;
}

/** Full-screen search. Height follows the visual viewport so the keyboard never covers a row. */
export function PeoplePickerScreen({ role, onIds, onPick, onBack, teamIds, onInvite }: PeoplePickerScreenProps) {
  const [term, setTerm] = useState('');
  const [h, setH] = useState<number | null>(() => (typeof window !== 'undefined' ? window.visualViewport?.height ?? null : null));
  const input = useRef<HTMLInputElement>(null);
  const t = term.trim();
  const ready = t.length >= PEOPLE_SEARCH_MIN;
  const q = useQuery({ queryKey: pickerQueryKey(role, t), queryFn: () => searchPickerRows(t, role), enabled: ready, staleTime: 60_000 });
  const rows = ready ? (q.data ?? []).filter((r) => !onIds.has(r.id)) : [];
  const word = roleWord(role);
  const listMode = flags.organiserPickerList && role === 'teaching';
  const all = useQuery({ queryKey: teacherListQueryKey, queryFn: fetchAllTeacherRows, enabled: listMode && t.length === 0, staleTime: 5 * 60_000 });
  const groups = listMode && t.length === 0 ? groupTeachers(all.data ?? [], teamIds ?? new Set(), onIds) : null;
  const showRow = (r: PickerRow) => (
    <button type="button" role="option" aria-selected={false} key={r.id} onClick={() => onPick(r)}
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 52, padding: '8px 12px', border: 0, borderTop: '1px solid #E9E9E9', background: '#FFFFFF', textAlign: 'left' }}>
      <Avatar id={r.id} name={r.name} url={r.avatarUrl} size={36} />
      <b style={{ fontSize: 15, fontWeight: 600 }}>{r.name}</b>
    </button>
  );
  const head = (text: string) => <div role="presentation" style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, color: '#6B6B6B' }}>{text}</div>;

  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const on = () => setH(vv.height);
    vv.addEventListener('resize', on);
    return () => vv.removeEventListener('resize', on);
  }, []);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={PICKER_COPY.title(word)} data-testid="people-picker"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, height: h ? `${h}px` : '100dvh', zIndex: 1000, background: '#FFFFFF', color: '#1A1A1A', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', minHeight: 56, padding: '0 12px', borderBottom: '1px solid #E9E9E9' }}>
        <button type="button" onClick={onBack} style={{ minWidth: 64, minHeight: 44, border: 0, background: 'none', color: '#C2410C', fontSize: 16, textAlign: 'left' }}>{PICKER_COPY.back}</button>
        <b style={{ flex: 1, textAlign: 'center', fontSize: 16, marginRight: 64 }}>{PICKER_COPY.title(word)}</b>
      </div>
      <div style={{ padding: 12 }}>
        <input ref={input} type="text" className="fld" value={term} aria-label="Search by name" placeholder={PICKER_COPY.searchPh}
          onChange={(e) => setTerm(e.target.value)} style={{ width: '100%', minHeight: 46, fontSize: 16, padding: '0 12px', color: '#1A1A1A', background: '#FFFFFF' }} />
      </div>
      <div role="listbox" aria-label="Results" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {groups && (
          <>
            {groups.team.length > 0 && <>{head(PICKER_COPY.team)}{groups.team.map(showRow)}</>}
            {groups.all.length > 0 && <>{head(PICKER_COPY.allTeachers)}{groups.all.map(showRow)}</>}
          </>
        )}
        {ready && !q.isLoading && rows.length === 0 && <p style={{ padding: '0 12px', color: '#6B6B6B', fontSize: 15 }}>{PICKER_COPY.noResults}</p>}
        {listMode ? rows.map(showRow) : rows.map((r) => (
          <button type="button" role="option" aria-selected={false} key={r.id} onClick={() => onPick(r)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 52, padding: '8px 12px', border: 0, borderTop: '1px solid #E9E9E9', background: '#FFFFFF', textAlign: 'left' }}>
            <Avatar id={r.id} name={r.name} url={r.avatarUrl} size={36} />
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <b style={{ fontSize: 15, fontWeight: 600 }}>{r.name}</b>
              <span style={{ fontSize: 13, color: '#6B6B6B' }}>{r.sublabel}</span>
            </span>
          </button>
        ))}
        {onInvite && ready && !q.isLoading && (
          <button type="button" role="option" aria-selected={false} data-testid="picker-invite-row" onClick={() => onInvite(t)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', width: '100%', minHeight: 56, padding: '8px 12px', border: 0, borderTop: '1px solid #E9E9E9', background: '#FFFFFF', textAlign: 'left' }}>
            <b style={{ fontSize: 15, fontWeight: 600, color: '#C2410C' }}>{PICKER_COPY.inviteRow(t)}</b>
            <span style={{ fontSize: 13, color: '#6B6B6B' }}>{PICKER_COPY.inviteHint}</span>
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
