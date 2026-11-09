import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Plus } from 'lucide-react';
import { fetchMyRoles, myRolesQueryKey } from '@/modules/areas/home/rolesApi';
import { useProfileProgress } from '@/modules/organiser/shared/profileProgress';
import { fetchMyAccessRequests, myAccessRequestsQueryKey } from '@/modules/organiser/shared/selfServeApi';
import {
  ADD_BENEFIT, ADD_LABEL, ADD_PROFILE_HEADING, HIDDEN_TOAST, HIDDEN_TOAST_SESSION, NOT_NOW_LABEL, UNDO_LABEL,
  addProfileTarget, heldRolesOf, missingRoles, readAddProfileHidden, writeAddProfileHidden,
} from './addProfileModel';

const TOAST_MS = 8000;

/**
 * Slice 1c, look B: a dashed outline card listing ONLY the roles the person lacks (addProfileModel), each opening
 * that role's existing flow; "Not now" hides it per person, per browser, with an Undo toast. No card while the
 * answers are loading, and none for a person who holds every role.
 */
export function AddProfileCard({ userId, organiserPages, addPage }: { userId: string | undefined; organiserPages: number; addPage: string }) {
  const roles = useQuery({ queryKey: myRolesQueryKey, queryFn: fetchMyRoles });
  const progress = useProfileProgress(null);
  const requests = useQuery({ queryKey: myAccessRequestsQueryKey(userId), queryFn: fetchMyAccessRequests, enabled: !!userId });
  const [hidden, setHidden] = useState(() => readAddProfileHidden(userId));
  const [toast, setToast] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (!toast) return;
    undoRef.current?.focus({ preventScroll: true });
    const t = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!hidden && restoreFocus.current) {
      restoreFocus.current = false;
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [hidden]);

  // A failed my_roles_v1 read offers nothing (it could offer a role the person holds); a failed progress or
  // claims read falls back to the rows alone.
  if (!userId || roles.status !== 'success' || progress.status === 'pending' || (requests.status === 'pending' && requests.fetchStatus !== 'idle')) return null;
  const missing = missingRoles(heldRolesOf({
    rows: roles.data,
    progress: progress.data,
    organiserPages,
    pendingOrganiserClaim: !!requests.data?.some((r) => r.status === 'open'),
  }));
  if (missing.length === 0) return null;

  const notNow = () => {
    const stored = writeAddProfileHidden(userId, true);
    setHidden(true);
    setToast(stored ? HIDDEN_TOAST : HIDDEN_TOAST_SESSION);
  };
  const undo = () => {
    writeAddProfileHidden(userId, false);
    restoreFocus.current = true;
    setHidden(false);
    setToast(null);
  };

  return (
    <>
      {!hidden && (
        <section className="mt-[16px]" aria-labelledby="add-profile-heading" data-testid="add-profile-card">
          <div className="rounded-[14px] border-[1.5px] border-dashed border-[var(--line-strong)] px-[12px] py-[8px]">
            <h2 id="add-profile-heading" ref={headingRef} tabIndex={-1} className="py-[6px] text-[15px] font-semibold text-[var(--fg)] outline-none">
              {ADD_PROFILE_HEADING}
            </h2>
            {missing.map((role) => (
              <Link
                key={role}
                to={addProfileTarget(role, addPage)}
                data-testid={`add-profile-row-${role}`}
                className="flex min-h-[56px] w-full items-center gap-[12px] border-t border-[var(--line)] py-[8px] text-left"
              >
                <span aria-hidden="true" className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[10px] border-[1.5px] border-dashed border-[var(--line-strong)] text-[var(--fg)]">
                  <Plus className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold text-[var(--fg)]">{ADD_LABEL[role]}</span>
                  <span className="block text-[14px] text-[var(--mut)]">{ADD_BENEFIT[role]}</span>
                </span>
                <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
              </Link>
            ))}
          </div>
          <button
            type="button"
            onClick={notNow}
            data-testid="add-profile-not-now"
            className="mt-[4px] flex min-h-[44px] w-full items-center justify-center text-[14px] font-semibold text-[var(--mut)]"
          >
            {NOT_NOW_LABEL}
          </button>
        </section>
      )}
      {toast && typeof document !== 'undefined' && createPortal(
        <div
          role="status"
          data-testid="add-profile-undo"
          // Portalled out of the P3 frame, so it carries the P3 colour tokens itself (light and dark sets).
          className="p3-theme fixed inset-x-[16px] bottom-[16px] z-50 mx-auto flex max-w-[420px] items-center gap-[12px] rounded-[12px] bg-[var(--fg)] px-[16px] py-[6px] text-[14px] text-[var(--bg)] shadow-lg"
          style={{ bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}
        >
          <span className="min-w-0 flex-1">{toast}</span>
          <button ref={undoRef} type="button" onClick={undo} data-testid="add-profile-undo-button" className="min-h-[44px] min-w-[44px] px-[8px] font-bold underline">
            {UNDO_LABEL}
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}
