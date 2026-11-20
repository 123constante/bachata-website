// Course rule card (docs/briefs/course-rule-card.md): tells a dancer whether they can drop in
// or must book first. Headline + one fixed sentence, no button. Unset rule = nothing.
// Sizes are explicit px: the public site's html font-size is ~13.5px on phones, so rem shrinks.
import type { ReactNode } from 'react';
import type { EventPageSnapshot } from '@/modules/event-page/types';

export type SignupRule = NonNullable<EventPageSnapshot['event']['signupRule']>;

const COPY: Record<SignupRule, { headline: string; sentence: ReactNode; bg: string; border: string; fg: string }> = {
  sign_up_first: {
    headline: 'Sign up before you come',
    sentence: <>You can&rsquo;t just turn up. Book your place first.</>,
    bg: 'rgba(242,176,74,0.13)',
    border: 'rgba(242,176,74,0.5)',
    fg: '#ffe3b3',
  },
  drop_in: {
    headline: 'Drop in welcome',
    sentence: <>Just turn up. No booking needed.</>,
    bg: 'rgba(95,191,127,0.11)',
    border: 'rgba(95,191,127,0.42)',
    fg: '#c9efd6',
  },
};

export const SignupRuleBlock = ({ rule }: { rule: SignupRule | null | undefined }) => {
  if (rule !== 'drop_in' && rule !== 'sign_up_first') return null;
  const c = COPY[rule];
  return (
    <div
      data-testid="signup-rule-card"
      data-rule={rule}
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.fg,
        borderRadius: 14,
        padding: '12px 14px',
      }}
    >
      <p style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.1, margin: '0 0 4px' }}>{c.headline}</p>
      <p style={{ fontSize: 13, lineHeight: 1.35, margin: 0 }}>{c.sentence}</p>
    </div>
  );
};
