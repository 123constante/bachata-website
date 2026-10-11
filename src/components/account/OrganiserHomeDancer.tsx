import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { UserRound, X } from "lucide-react";
import { useProfileCompletion } from "@/hooks/useProfileCompletion";
import { DANCER_HOME_PATH, ORGANISER_HOME_PATH, accountView, dismissDancerRow, isDancerRowDismissed } from "@/lib/accountRouting";
import { completenessFact, finishProfileHref } from "@/lib/profileCompletion";

/**
 * The dancer side of the organiser home, layout D (owner decision 2026-10-11).
 * Both pieces ask lib/accountRouting's accountView(), and state completeness
 * only through completenessFact() -- the same words as the dancer home, the
 * Finish screen and the rating card. Rendered inside .org-theme (OrganiserShell).
 */

type Counts = { organiserCount: number; openRequestCount: number };

/**
 * (a) An organiser whose dancer profile is UNFINISHED: one small, skippable row
 * naming the missing fields, linking to /finish-profile and back here. "Skip"
 * hides it for the rest of the browser session.
 */
export function DancerProfileRow({ organiserCount, openRequestCount }: Counts) {
  const completion = useProfileCompletion();
  const { pathname, search } = useLocation();
  const [dismissed, setDismissed] = useState(isDancerRowDismissed);
  const fact = completenessFact(completion);
  const view = accountView({ organiserCount, openRequestCount, dancer: fact.kind });
  if (!view.unfinishedRow || dismissed) return null;

  return (
    <div
      data-testid="org-dancer-row"
      className="flex items-center gap-[8px] rounded-[12px] border border-[var(--line)] bg-[var(--card)] py-[4px] pl-[12px] pr-[4px]"
    >
      <Link
        to={finishProfileHref(`${pathname}${search}`)}
        data-testid="org-dancer-row-finish"
        className="min-w-0 flex-1 py-[8px] text-[13px] text-[var(--mut)]"
      >
        <span className="block text-[14px] font-semibold text-[var(--gold)]">Finish your dancer profile</span>
        <span className="block" data-testid="org-dancer-row-fact">{fact.text}</span>
      </Link>
      <button
        type="button"
        aria-label="Skip for now"
        data-testid="org-dancer-row-skip"
        onClick={() => {
          dismissDancerRow();
          setDismissed(true);
        }}
        className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[12px] text-[var(--mut)]"
      >
        <X aria-hidden="true" className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}

/**
 * (b) The account menu: the account icon in the organiser top bar (the public
 * header's icon is under the organiser frame there). Shown only when it has
 * something to choose -- an organiser with a FINISHED dancer profile -- and then
 * lists the organiser home and the dancer profile side by side.
 */
export function AccountMenu({ organiserCount, openRequestCount }: Counts) {
  const completion = useProfileCompletion();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const view = accountView({ organiserCount, openRequestCount, dancer: completenessFact(completion).kind });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!view.menuDancerEntry) return null;

  const item = "flex min-h-[44px] items-center px-[16px] text-[15px] font-semibold";
  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-label="Your account"
        aria-expanded={open}
        aria-controls={menuId}
        data-testid="org-account-menu-button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-[44px] w-[44px] items-center justify-center rounded-[12px] text-[var(--gold)]"
      >
        <UserRound aria-hidden="true" className="h-[20px] w-[20px]" />
      </button>
      {open && (
        <nav
          id={menuId}
          aria-label="Your account"
          data-testid="org-account-menu"
          className="absolute right-0 top-[48px] z-10 w-[220px] overflow-hidden rounded-[12px] border border-[var(--line)] bg-[var(--sheet)] py-[4px] shadow-lg"
        >
          <Link to={ORGANISER_HOME_PATH} aria-current="page" className={`${item} text-[var(--gold)]`} data-testid="org-account-menu-organiser" onClick={() => setOpen(false)}>
            Organiser home
          </Link>
          <Link to={DANCER_HOME_PATH} className={`${item} text-[var(--fg)]`} data-testid="org-account-menu-dancer" onClick={() => setOpen(false)}>
            Your dancer profile
          </Link>
        </nav>
      )}
    </div>
  );
}
