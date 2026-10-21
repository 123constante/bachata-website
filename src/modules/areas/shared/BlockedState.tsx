import { Link } from 'react-router-dom';
import { ROLE_ERROR_COPY, roleErrorCode } from './errorCopy';

export interface BlockedPaths {
  /** Where a person with no dancer profile finishes it. */
  dancerProfile: string;
  /** Where a signed-out person signs in. */
  signIn: string;
}

/** The refusals a retry can never fix: each has ONE action that can. */
const BLOCKED = {
  no_profile: { title: 'Your dancer profile comes first', body: ROLE_ERROR_COPY.no_profile, action: 'Finish your dancer profile', to: (p: BlockedPaths) => p.dancerProfile },
  not_signed_in: { title: 'You are signed out', body: 'Sign in again to see and change your details.', action: 'Sign in', to: (p: BlockedPaths) => p.signIn },
} as const;

/** The blocking refusal among these errors, if any (no_profile wins: signing in again would not fix it). */
export function blockedCode(...errors: unknown[]): keyof typeof BLOCKED | null {
  const codes = errors.map(roleErrorCode);
  if (codes.includes('no_profile')) return 'no_profile';
  if (codes.includes('not_signed_in')) return 'not_signed_in';
  return null;
}

/** One state, one action; it replaces the whole page body (no retry, no line-up card beside it). */
export function BlockedState({ code, paths }: { code: keyof typeof BLOCKED; paths: BlockedPaths }) {
  const b = BLOCKED[code];
  return (
    <div data-testid="blocked-state" className="flex flex-col items-center gap-[8px] rounded-[16px] border border-[var(--line)] bg-[var(--card)] px-[16px] py-[24px] text-center">
      <p className="text-[16px] font-semibold text-[var(--fg)]">{b.title}</p>
      <p className="text-[14px] text-[var(--mut)]">{b.body}</p>
      <Link
        to={b.to(paths)}
        data-testid="blocked-action"
        className="mt-[8px] inline-flex h-[52px] w-full items-center justify-center rounded-[12px] bg-[var(--btn)] px-[20px] text-[16px] font-bold text-[var(--btnfg)]"
      >
        {b.action}
      </Link>
    </div>
  );
}
