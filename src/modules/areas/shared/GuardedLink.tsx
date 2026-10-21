import { forwardRef, type ComponentProps, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isLeaveDirty, requestLeave } from './leaveGuard';

/** A Link that goes through the "Discard changes?" sheet when a form has unsaved edits. */
export const GuardedLink = forwardRef<HTMLAnchorElement, ComponentProps<typeof Link>>(function GuardedLink({ to, onClick, ...rest }, ref) {
  const navigate = useNavigate();
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || !isLeaveDirty() || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    requestLeave(() => navigate(to));
  };
  return <Link ref={ref} to={to} onClick={handle} {...rest} />;
});
