// Server-renders SignupRuleBlock: each rule shows its exact fixed copy, unset shows nothing.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SignupRuleBlock } from '@/modules/event-page/bento/blocks/SignupRuleBlock';

const text = (html: string) => html.replace(/<[^>]+>/g, '|').replace(/&#x27;|&#39;/g, "'");

describe('SignupRuleBlock', () => {
  it('sign_up_first renders its headline and sentence, nothing else', () => {
    const html = renderToStaticMarkup(<SignupRuleBlock rule="sign_up_first" />);
    const parts = text(html).split('|').filter(Boolean);
    expect(parts).toEqual(['Sign up before you come', 'You can\u2019t just turn up. Book your place first.']);
    expect(html.includes(String.fromCharCode(0xe2, 0x20ac))).toBe(false);
  });

  it('drop_in renders its headline and sentence, nothing else', () => {
    const html = renderToStaticMarkup(<SignupRuleBlock rule="drop_in" />);
    const parts = text(html).split('|').filter(Boolean);
    expect(parts).toEqual(['Drop in welcome', 'Just turn up. No booking needed.']);
    expect(html.includes(String.fromCharCode(0xe2, 0x20ac))).toBe(false);
  });

  it.each([null, undefined, 'something_else' as never])('unset rule (%s) renders nothing', (rule) => {
    expect(renderToStaticMarkup(<SignupRuleBlock rule={rule} />)).toBe('');
  });

  it('no mojibake in the rendered copy', () => {
    const html = renderToStaticMarkup(<SignupRuleBlock rule="sign_up_first" />);
    expect(html.includes(String.fromCharCode(0xe2, 0x20ac))).toBe(false);
  });
});
