import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  LIVE_SAVE_NOTE,
  PEOPLE_ROLES,
  PEOPLE_ROLE_LABEL,
  addLimitReason,
  addPerson,
  isEditableRole,
  removeLimitReason,
  removePerson,
  undoRemovePerson,
  type DraftPerson,
  type DraftSession,
  type PeopleRole,
} from '../programmeModel';
import type { PersonResult } from '../selfServeApi';
import { PersonAvatar, PersonSearchView, type OnSession } from './PersonPicker';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import { useKeyboardViewport } from './useKeyboardViewport';

/** Every line-up motion: 0.3s ease-in-out (none at all with reduced motion). */
export const LINEUP_MOTION_MS = 300;

const ADD_LABEL: Record<PeopleRole, string> = { teaching: 'Add teacher', djing: 'Add DJ' };
const ROLE_WORD: Record<PeopleRole, string> = { teaching: 'teacher', djing: 'DJ' };

/** A role chip: neutral, so the accent stays on the one primary action. */
export function RoleChip({ role, team = false }: { role: string | null; team?: boolean }) {
  return (
    <span
      className={cn('shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium', team ? 'text-muted-foreground' : 'text-foreground')}
      data-testid="lineup-role"
    >
      {PEOPLE_ROLE_LABEL[role ?? ''] ?? 'Guest'}
    </span>
  );
}

/**
 * The line-up of ONE session, in a small bottom sheet over the date sheet. Two
 * views in the same sheet: the LIST (people, remove / Undo, "Add teacher" and
 * "Add DJ") and, after an Add button, the SEARCH (full height, input on top).
 * It edits the programme's local draft only: nothing is sent until "Save the
 * programme". A stored teacher or DJ taken off stays, greyed, with Undo until
 * then; someone added here fades and folds away. MCs and performers are the
 * team's and are shown read-only.
 */
export function LineupSheet({ open, onOpenChange, row, sessionName, live, onChange, returnFocusRef }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: DraftSession;
  sessionName: string;
  live: boolean;
  onChange: (people: DraftPerson[]) => void;
  /** Where the focus goes when the sheet closes (the session's Line-up row). */
  returnFocusRef: React.RefObject<HTMLElement>;
}) {
  const reduced = usePrefersReducedMotion();
  const [searching, setSearching] = useState<PeopleRole | null>(null);
  const [announce, setAnnounce] = useState('');
  /** Profile ids of people added here that are fading and folding out before they leave the draft. */
  const [leaving, setLeaving] = useState<string[]>([]);
  /** The person who just arrived (a short pop). */
  const [popped, setPopped] = useState<string | null>(null);
  const keyboard = useKeyboardViewport(open && !!searching);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const addRefs = useRef<Record<PeopleRole, HTMLButtonElement | null>>({ teaching: null, djing: null });
  const personRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const focusAfter = useRef<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const people = row.people ?? [];
  /** The row as last rendered, for a fold that ends after the list moved. */
  const latest = useRef(row);
  useEffect(() => { latest.current = row; });

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  // After a view swap, a remove or an Undo replaces the control that had the focus: move it on.
  useEffect(() => {
    const want = focusAfter.current;
    if (!want) return;
    focusAfter.current = null;
    const el = want.startsWith('add:') ? addRefs.current[want.slice(4) as PeopleRole] : personRefs.current[want];
    (el && !el.disabled ? el : titleRef.current)?.focus();
  });

  const addReason = addLimitReason(row);
  const removeReason = removeLimitReason(row);

  const changeOpen = (next: boolean) => {
    if (!next) {
      // Anything still folding away goes now; the sheet is closing anyway.
      timers.current.forEach(clearTimeout);
      timers.current = [];
      if (leaving.length) {
        let current = latest.current;
        for (const id of leaving) current = removePerson(current, (current.people ?? []).findIndex((q) => q.id === id));
        onChange(current.people ?? []);
      }
      setSearching(null);
      setLeaving([]);
      setPopped(null);
    }
    onOpenChange(next);
  };

  const openSearch = (role: PeopleRole) => {
    if (addReason) return;
    setSearching(role);
  };
  const backToList = useCallback(() => {
    setSearching((role) => {
      if (role) focusAfter.current = `add:${role}`;
      return null;
    });
  }, []);

  const statusOf = useCallback((id: string): OnSession => {
    const p = (latest.current.people ?? []).find((q) => q.id === id);
    if (!p) return null;
    return p.removed ? 'removed' : 'on';
  }, []);

  const pick = (person: PersonResult) => {
    if (!searching || addReason) return;
    const next = addPerson(row, { id: person.id, name: person.name, role: searching });
    if (next !== row) {
      onChange(next.people ?? []);
      setPopped(person.id);
      setAnnounce(`${person.name} added as ${ROLE_WORD[searching]}. Not saved yet.`);
    }
    backToList();
  };

  const restore = (id: string) => {
    const index = people.findIndex((q) => q.id === id);
    const p = people[index];
    if (!p?.removed) return;
    onChange(undoRemovePerson(row, index).people ?? []);
    setAnnounce(`${p.name} put back.`);
    backToList();
  };

  const remove = (index: number) => {
    const p = people[index];
    if (!p || !isEditableRole(p.role)) return;
    setAnnounce(`${p.name} removed. Not saved yet.`);
    if (p.origin === 'added') {
      // Never saved, so they just go: the next control (or Add) takes the focus.
      const nextLive = people.slice(index + 1).find((q) => isEditableRole(q.role) && !q.removed && !leaving.includes(q.id));
      focusAfter.current = nextLive ? `remove:${nextLive.id}` : `add:${p.role}`;
      if (reduced) {
        commitRemove(p.id);
        return;
      }
      setLeaving((l) => [...l, p.id]);
      timers.current.push(setTimeout(() => {
        setLeaving((l) => l.filter((id) => id !== p.id));
        commitRemove(p.id);
      }, LINEUP_MOTION_MS));
      return;
    }
    focusAfter.current = `undo:${p.id}`;
    commitRemove(p.id);
  };
  // By id, not index: a fold can end after the list moved.
  const commitRemove = (id: string) => {
    const current = latest.current;
    const index = (current.people ?? []).findIndex((q) => q.id === id);
    if (index >= 0) onChange(removePerson(current, index).people ?? []);
  };
  const undo = (index: number) => {
    const p = people[index];
    if (!p) return;
    focusAfter.current = `remove:${p.id}`;
    setAnnounce(`${p.name} put back.`);
    onChange(undoRemovePerson(row, index).people ?? []);
  };

  const motion = 'duration-300 ease-in-out motion-reduce:transition-none motion-reduce:animate-none';

  return (
    <Sheet open={open} onOpenChange={changeOpen}>
      <SheetContent
        side="bottom"
        overlayClassName="z-[100] motion-reduce:!animate-none"
        className={cn(
          'tap-44 z-[100] flex flex-col gap-0 overflow-hidden rounded-t-2xl p-0 sm:left-0 sm:right-0 sm:mx-auto sm:max-w-lg',
          // One timing for the slide too; with reduced motion the sheet just appears.
          'ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-300 motion-reduce:!animate-none',
          // dvh, not vh: the browser bars never push the sheet off screen.
          searching ? 'h-[85dvh]' : 'max-h-[85dvh]',
          '[&>button:last-child]:right-2 [&>button:last-child]:top-2 [&>button:last-child]:flex [&>button:last-child]:min-h-[44px] [&>button:last-child]:min-w-[44px] [&>button:last-child]:items-center [&>button:last-child]:justify-center',
        )}
        // The keyboard is up in the search: sit on top of it and fit what is left above it.
        style={searching && keyboard ? { bottom: keyboard.inset, height: `min(85dvh, ${keyboard.height - 8}px)` } : undefined}
        onOpenAutoFocus={(e) => { e.preventDefault(); titleRef.current?.focus(); }}
        onCloseAutoFocus={(e) => { e.preventDefault(); returnFocusRef.current?.focus(); }}
        // Escape or a tap outside leaves the search first; only from the list do they close the sheet.
        onEscapeKeyDown={(e) => { if (searching) { e.preventDefault(); backToList(); } }}
        onPointerDownOutside={(e) => { if (searching) { e.preventDefault(); backToList(); } }}
        data-testid="lineup-sheet"
        data-view={searching ? 'search' : 'list'}
        data-reduced-motion={reduced ? 'true' : undefined}
      >
        <p className="sr-only" aria-live="polite" data-testid="lineup-announce">{announce}</p>

        {searching ? (
          <PersonSearchView
            key={searching}
            role={searching}
            sessionName={sessionName}
            statusOf={statusOf}
            onPick={pick}
            onRestore={restore}
            onBack={backToList}
          />
        ) : (
          <>
            <div className="shrink-0 space-y-1 px-4 pr-14 pt-4">
              <SheetTitle ref={titleRef} tabIndex={-1} className="text-base outline-none">Line-up</SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{sessionName}</span>. Nothing changes until you press Save the programme.{live ? ` ${LIVE_SAVE_NOTE}` : ''}
              </SheetDescription>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3" data-testid="lineup-list">
              {people.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-muted-foreground/60 p-3 text-sm text-muted-foreground" data-testid="lineup-empty">
                  No teachers or DJs on this session yet.
                </p>
              ) : (
                <ul className="overflow-hidden rounded-2xl border border-muted-foreground/60 bg-card" aria-label={`Line-up of ${sessionName}`}>
                  {people.map((p, i) => {
                    const editable = isEditableRole(p.role);
                    const fading = leaving.includes(p.id);
                    const removeOff = p.origin === 'stored' && !!removeReason;
                    return (
                      <li
                        key={`${p.id}:${p.role ?? ''}`}
                        className={cn(
                          // Fold: the track goes to 0fr and the inner box has min-h-0, so the row reaches 0px (no gap, no jump).
                          'grid transition-[grid-template-rows,opacity]',
                          motion,
                          fading ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
                        )}
                        data-testid={p.removed ? 'lineup-person-removed' : 'lineup-person'}
                        data-leaving={fading ? 'true' : undefined}
                      >
                        <div className="min-h-0 overflow-hidden">
                          <div
                            className={cn(
                              'flex min-h-[56px] items-center gap-3 py-1.5 pl-3 pr-1.5',
                              i > 0 && 'border-t border-border',
                              popped === p.id && 'animate-in fade-in-0 zoom-in-95',
                              popped === p.id && motion,
                            )}
                            onAnimationEnd={() => { if (popped === p.id) setPopped(null); }}
                          >
                            <PersonAvatar name={p.name} muted={p.removed || !editable} />
                            <span className="min-w-0 flex-1">
                              <span className={cn('block truncate text-sm font-medium', p.removed ? 'text-muted-foreground line-through' : 'text-foreground')} data-testid="lineup-name">
                                {p.name}
                              </span>
                              {p.removed ? (
                                <span className="block text-xs text-muted-foreground">Removed. Not saved yet.</span>
                              ) : p.origin === 'added' ? (
                                <span className="block text-xs text-muted-foreground">Added. Not saved yet.</span>
                              ) : !editable ? (
                                <span className="block text-xs text-muted-foreground" data-testid="lineup-readonly">Added by the team</span>
                              ) : null}
                            </span>
                            <RoleChip role={p.role} team={!editable || p.removed} />
                            {!editable ? (
                              // Holds the column so every chip lines up; there is nothing to press.
                              <span className="h-11 w-11 shrink-0" aria-hidden="true" />
                            ) : p.removed ? (
                              <button
                                ref={(el) => { personRefs.current[`undo:${p.id}`] = el; }}
                                type="button"
                                onClick={() => undo(i)}
                                className="min-h-[44px] min-w-[44px] shrink-0 rounded-lg px-2 text-sm font-medium text-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                data-testid="lineup-undo"
                              >
                                Undo<span className="sr-only"> removing {p.name}</span>
                              </button>
                            ) : (
                              <button
                                ref={(el) => { personRefs.current[`remove:${p.id}`] = el; }}
                                type="button"
                                aria-label={`Remove ${p.name}`}
                                aria-describedby={removeOff ? 'lineup-remove-reason' : undefined}
                                disabled={fading || removeOff}
                                onClick={() => remove(i)}
                                className={cn(
                                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                  motion,
                                  removeOff ? 'cursor-not-allowed text-muted-foreground' : 'text-foreground hover:bg-muted active:bg-muted',
                                )}
                                data-testid="lineup-remove"
                              >
                                <span className={cn('flex h-7 w-7 items-center justify-center rounded-full border', removeOff ? 'border-dashed border-muted-foreground' : 'border-muted-foreground bg-muted')}>
                                  <X className="h-4 w-4" aria-hidden="true" />
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="shrink-0 space-y-2 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
              {removeReason && <p id="lineup-remove-reason" className="text-xs text-muted-foreground" data-testid="lineup-remove-reason">{removeReason}</p>}
              <div className="grid grid-cols-2 gap-2">
                {PEOPLE_ROLES.map((role) => (
                  <Button
                    key={role}
                    ref={(el) => { addRefs.current[role] = el; }}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-[44px] rounded-lg px-2"
                    disabled={!!addReason}
                    aria-describedby={addReason ? 'lineup-add-reason' : undefined}
                    onClick={() => openSearch(role)}
                    data-testid={`lineup-add-${role}`}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" /> {ADD_LABEL[role]}
                  </Button>
                ))}
              </div>
              {addReason && <p id="lineup-add-reason" className="text-xs text-muted-foreground" data-testid="lineup-add-reason">{addReason}</p>}
              <Button type="button" size="sm" className="min-h-[44px] w-full rounded-lg" onClick={() => changeOpen(false)} data-testid="lineup-done">Done</Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
