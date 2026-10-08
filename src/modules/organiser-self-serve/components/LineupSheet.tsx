import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Lock, Plus, X } from 'lucide-react';
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
} from '@/modules/organiser/shared/programmeModel';
import type { PersonResult } from '@/modules/organiser/shared/selfServeApi';
import { PersonAvatar, PersonPicker } from './PersonPicker';
import { usePrefersReducedMotion } from '@/modules/organiser/shared/usePrefersReducedMotion';

/** Every line-up motion: 0.3s ease-in-out (none at all with reduced motion). */
export const LINEUP_MOTION_MS = 300;

const ADD_LABEL: Record<PeopleRole, string> = { teaching: 'Add teacher', djing: 'Add DJ' };

/**
 * The line-up of ONE session, in a small bottom sheet over the date sheet. It
 * edits the programme's local draft only: nothing is sent until "Save the
 * programme". A stored teacher or DJ taken off stays, greyed, with Undo until
 * then; someone added here fades out. MCs and performers are the team's and
 * are shown read-only.
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
  const [picker, setPicker] = useState<PeopleRole | null>(null);
  const [announce, setAnnounce] = useState('');
  /** Profile ids of added people fading out before they leave the draft. */
  const [leaving, setLeaving] = useState<string[]>([]);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const addRefs = useRef<Record<PeopleRole, HTMLButtonElement | null>>({ teaching: null, djing: null });
  const personRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const focusAfter = useRef<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const people = useMemo(() => row.people ?? [], [row.people]);
  /** The row as last rendered, for a fade that ends after the list moved. */
  const latest = useRef(row);
  useEffect(() => { latest.current = row; });

  // Unmounting: timers already started still commit their removal, just without the fade.
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);
  const changeOpen = (next: boolean) => {
    if (!next) { setPicker(null); setLeaving([]); }
    onOpenChange(next);
  };
  // After a remove or an Undo swaps the person's button, put the focus on its replacement.
  useEffect(() => {
    const want = focusAfter.current;
    if (!want) return;
    focusAfter.current = null;
    (personRefs.current[want] ?? titleRef.current)?.focus();
  });

  const addReason = addLimitReason(row);
  const removeReason = removeLimitReason(row);
  const isOnSession = useCallback((id: string) => people.some((p) => p.id === id), [people]);
  const openerRef = useRef<HTMLElement | null>(null);
  useEffect(() => { openerRef.current = picker ? addRefs.current[picker] : null; }, [picker]);
  /** Escape or a pick: close and hand the focus back to the button that opened it. */
  const closePicker = useCallback(() => {
    if (picker) addRefs.current[picker]?.focus();
    setPicker(null);
  }, [picker]);
  /** A tap outside: close, and leave the focus where the tap put it. */
  const dismissPicker = useCallback(() => setPicker(null), []);

  const pick = (person: PersonResult) => {
    if (!picker) return;
    const next = addPerson(row, { id: person.id, name: person.name, role: picker });
    if (next === row) return;
    onChange(next.people ?? []);
    setAnnounce(`${person.name} added as ${picker === 'djing' ? 'DJ' : 'teacher'}. Not saved yet.`);
    closePicker();
  };

  const remove = (index: number) => {
    const p = people[index];
    if (!p || !isEditableRole(p.role)) return;
    setAnnounce(`${p.name} removed. Not saved yet.`);
    if (p.origin === 'added' && !reduced) {
      // Fade and fold, then leave the draft.
      setLeaving((l) => [...l, p.id]);
      focusAfter.current = '__title';
      timers.current.push(setTimeout(() => {
        setLeaving((l) => l.filter((id) => id !== p.id));
        commitRemove(p.id);
      }, LINEUP_MOTION_MS));
      return;
    }
    focusAfter.current = p.origin === 'added' ? '__title' : `undo:${p.id}`;
    commitRemove(p.id);
  };
  // By id, not index: a fade can end after the list moved.
  const commitRemove = (id: string) => {
    const current = latest.current;
    const index = (current.people ?? []).findIndex((q) => q.id === id);
    onChange(removePerson(current, index).people ?? []);
  };
  const undo = (index: number) => {
    const p = people[index];
    if (!p) return;
    focusAfter.current = `remove:${p.id}`;
    setAnnounce(`${p.name} put back.`);
    onChange(undoRemovePerson(row, index).people ?? []);
  };

  return (
    <Sheet open={open} onOpenChange={changeOpen}>
      <SheetContent
        side="bottom"
        overlayClassName="z-[100] motion-reduce:!animate-none"
        className={cn(
          'tap-44 z-[100] max-h-[85vh] overflow-y-auto rounded-t-xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:left-0 sm:right-0 sm:mx-auto sm:max-w-lg',
          'ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-300 motion-reduce:!animate-none',
          '[&>button:last-child]:right-2 [&>button:last-child]:top-2 [&>button:last-child]:flex [&>button:last-child]:min-h-[44px] [&>button:last-child]:min-w-[44px] [&>button:last-child]:items-center [&>button:last-child]:justify-center',
        )}
        onOpenAutoFocus={(e) => { e.preventDefault(); titleRef.current?.focus(); }}
        onCloseAutoFocus={(e) => { e.preventDefault(); returnFocusRef.current?.focus(); }}
        // Escape closes the search first; a second Escape closes the sheet.
        onEscapeKeyDown={(e) => { if (picker) { e.preventDefault(); closePicker(); } }}
        data-testid="lineup-sheet"
        data-reduced-motion={reduced ? 'true' : undefined}
      >
        <div className="space-y-1 pr-10">
          <SheetTitle ref={titleRef} tabIndex={-1} className="text-base outline-none">Line-up</SheetTitle>
          <SheetDescription className="text-xs">
            {sessionName}. Nothing changes until you press Save the programme.{live ? ` ${LIVE_SAVE_NOTE}` : ''}
          </SheetDescription>
        </div>

        <p className="sr-only" aria-live="polite" data-testid="lineup-announce">{announce}</p>

        <div className="mt-3 space-y-3">
          {people.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="lineup-empty">No teachers or DJs on this session yet.</p>
          ) : (
            <ul className="space-y-1" aria-label={`Line-up of ${sessionName}`}>
              {people.map((p, i) => {
                const editable = isEditableRole(p.role);
                const fading = leaving.includes(p.id);
                return (
                  <li
                    key={`${p.id}:${p.role ?? ''}:${i}`}
                    className={cn(
                      'grid transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none',
                      fading ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
                    )}
                    data-testid={p.removed ? 'lineup-person-removed' : 'lineup-person'}
                    data-leaving={fading ? 'true' : undefined}
                  >
                    <div className="flex min-h-[48px] items-center gap-3 overflow-hidden">
                      <span className={cn('flex min-w-0 flex-1 items-center gap-3 transition-opacity duration-300 ease-in-out motion-reduce:transition-none', p.removed && 'opacity-50')}>
                        <PersonAvatar name={p.name} />
                        <span className="min-w-0 flex-1">
                          <span className={cn('block truncate text-sm font-medium', p.removed && 'line-through')}>{p.name}</span>
                          {p.removed && <span className="block text-xs text-muted-foreground">Removed. Not saved yet.</span>}
                          {p.origin === 'added' && <span className="block text-xs text-muted-foreground">Added. Not saved yet.</span>}
                        </span>
                        <span
                          className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', editable ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}
                          data-testid="lineup-role"
                        >
                          {PEOPLE_ROLE_LABEL[p.role ?? ''] ?? 'Guest'}
                        </span>
                      </span>
                      {!editable ? (
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground" title="Set by the Bachata Calendar team" data-testid="lineup-readonly">
                          <Lock className="h-4 w-4" aria-hidden="true" />
                          <span className="sr-only">{p.name} is set by the Bachata Calendar team and cannot be changed here</span>
                        </span>
                      ) : p.removed ? (
                        <button
                          ref={(el) => { personRefs.current[`undo:${p.id}`] = el; }}
                          type="button"
                          onClick={() => undo(i)}
                          className="min-h-[44px] shrink-0 px-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          data-testid="lineup-undo"
                        >
                          Undo<span className="sr-only"> removing {p.name}</span>
                        </button>
                      ) : (
                        <button
                          ref={(el) => { personRefs.current[`remove:${p.id}`] = el; }}
                          type="button"
                          aria-label={`Remove ${p.name}`}
                          disabled={fading || (p.origin === 'stored' && !!removeReason)}
                          onClick={() => remove(i)}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-300 ease-in-out hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
                          data-testid="lineup-remove"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {removeReason && <p className="text-xs text-muted-foreground" data-testid="lineup-remove-reason">{removeReason}</p>}

          <div className="relative space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {PEOPLE_ROLES.map((role) => (
                <Button
                  key={role}
                  ref={(el) => { addRefs.current[role] = el; }}
                  type="button"
                  size="sm"
                  variant={picker === role ? 'secondary' : 'outline'}
                  className="min-h-[44px]"
                  disabled={!!addReason}
                  aria-expanded={picker === role}
                  aria-describedby={addReason ? 'lineup-add-reason' : undefined}
                  onClick={() => (picker === role ? closePicker() : setPicker(role))}
                  data-testid={`lineup-add-${role}`}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" /> {ADD_LABEL[role]}
                </Button>
              ))}
            </div>
            {addReason && <p id="lineup-add-reason" className="text-xs text-muted-foreground" data-testid="lineup-add-reason">{addReason}</p>}
            {picker && !addReason && (
              <PersonPicker
                key={picker}
                role={picker}
                isOnSession={isOnSession}
                onPick={pick}
                onClose={dismissPicker}
                openerRef={openerRef}
              />
            )}
          </div>

          <div className="flex justify-end pt-1">
            <Button type="button" size="sm" className="min-h-[44px]" onClick={() => changeOpen(false)} data-testid="lineup-done">Done</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
