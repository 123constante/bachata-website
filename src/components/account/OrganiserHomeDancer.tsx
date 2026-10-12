import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { UserRound } from "lucide-react";
import { useProfileCompletion } from "@/hooks/useProfileCompletion";
import { DANCER_HOME_PATH, ORGANISER_HOME_PATH, accountView } from "@/lib/accountRouting";
import { completenessFact } from "@/lib/profileCompletion";

/**
 * The dancer side of the organiser home, layout D (owner decision 2026-10-11).
 * The account menu asks lib/accountRouting's accountView() and reads completeness
 * only through completenessFact(). An UNFINISHED dancer profile never reaches
 * this page (DancerProfileGate), so nothing here asks anyone to finish it.
 * Rendered inside .org-theme (OrganiserShell).
 */

type Counts = { organiserCount: number; openRequestCount: number };

/**
 * The account menu: the account icon in the organiser top bar (the public
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
