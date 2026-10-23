import { useId } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import type { GoingView } from './goingState';
import { BENTO_GOING_THEME, type GoingTheme } from './goingTheme';

type Props = {
  view: GoingView;
  /** go / ungo: the hook's tap. */
  onTap: () => void;
  /** sign_in: open the site's sign-in prompt. */
  onSignIn: () => void;
  theme?: GoingTheme;
  /** Drop the line under the button (a surface that prints view.words itself). */
  hideMessage?: boolean;
  testId?: string;
};

// The link sits on its OWN 44px line under the message (explicit px: html is ~13.5px on
// phones). Inline with 14px padding it stretched the wrapped message's last line box to
// ~44px and left a gap mid-paragraph (Going P2 stage 4, unfinished-all-four at 390).
const LINK_CLASS = 'flex min-h-[44px] w-fit items-center font-semibold underline';

/**
 * The ONE "I'm going" button (never "Interested"). Its label, enabled state,
 * reason and link all come from the view (goingStateFor); this only paints.
 * A disabled button always has its reason on screen, right under it. 48px tall
 * in explicit px (html is ~13.5px on phones, so rem sizes render small).
 */
export const GoingButton = ({ view, onTap, onSignIn, theme = BENTO_GOING_THEME, hideMessage = false, testId = 'going-button' }: Props) => {
  const { control, link } = view;
  const msgId = useId();
  // In flight: "Saving..." is the line. Disabled: the reason is the line if the state has no words.
  const message = control.busy ? control.reason : (view.words ?? (control.enabled ? null : control.reason));
  const style = !control.enabled && !control.busy
    ? theme.ghost
    : control.pressed
      ? theme.on
      : theme.primary;
  const onClick = () => {
    if (!control.enabled) return;
    if (control.action === 'sign_in') onSignIn();
    else onTap();
  };
  return (
    <div data-testid={`${testId}-wrap`} data-state={view.state}>
      <button
        type="button"
        onClick={onClick}
        disabled={!control.enabled}
        aria-pressed={control.action === 'sign_in' ? undefined : control.pressed}
        aria-busy={control.busy || undefined}
        aria-describedby={message && !hideMessage ? msgId : undefined}
        className="flex h-[48px] min-h-[48px] w-full items-center justify-center gap-1.5 rounded-full px-3 text-[14px] font-bold disabled:cursor-not-allowed"
        style={style}
        data-testid={testId}
      >
        {control.pressed && <Check className="h-4 w-4" strokeWidth={2.4} aria-hidden />}
        {control.label}
      </button>
      {!hideMessage && (message || link) && (
        <p id={msgId} className="mt-1.5 text-[12px] leading-snug" style={{ color: theme.muted }} data-testid={`${testId}-message`}>
          {message}
          {link && (
            <>
              {message ? ' ' : null}
              {link.external ? (
                <a
                  href={link.to}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={LINK_CLASS}
                  style={{ color: theme.fg }}
                  data-testid={`${testId}-link`}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  to={link.to}
                  className={LINK_CLASS}
                  style={{ color: theme.fg }}
                  data-testid={`${testId}-link`}
                >
                  {link.label}
                </Link>
              )}
            </>
          )}
        </p>
      )}
    </div>
  );
};
