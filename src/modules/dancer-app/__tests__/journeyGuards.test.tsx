// @vitest-environment jsdom
/**
 * 1. Source table: the dancer journey renders avatars ONLY through PersonAvatar
 *    (no shadcn Avatar, no hand-rolled <img> of the dancer photo, no own initials disc).
 * 2. Self-test of journeyChecks: each check flags the defect it exists to catch
 *    (so a green matrix cell means something) and passes the fixed shape.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { avatars, disabled, emptyStates, pointers } from './journeyChecks';

const ROOT = path.resolve(__dirname, '../../../..');
const walk = (dir: string): string[] =>
  readdirSync(path.join(ROOT, dir)).flatMap((f) => {
    const rel = `${dir}/${f}`;
    if (statSync(path.join(ROOT, rel)).isDirectory()) return f === '__tests__' ? [] : walk(rel);
    return /\.tsx$/.test(f) ? [rel] : [];
  });

/** Every file that draws a dancer-journey screen (organiser screens are out of scope). */
const JOURNEY = [
  ...walk('src/modules/dancer-app').filter((f) => !/renderInShell|testAuth/.test(f)),
  'src/pages/FinishProfile.tsx',
  'src/pages/Account.tsx',
  'src/pages/AccountSettings.tsx',
  'src/pages/AccountDeleted.tsx',
  'src/pages/AccountRestore.tsx',
  'src/components/account/DancerHome.tsx',
  'src/components/account/DancerProfileGate.tsx',
  'src/components/account/HideSurnameCard.tsx',
  'src/components/account/profiles/ContinueAsPage.tsx',
  'src/components/account/profiles/ProfileSwitcher.tsx',
  'src/components/account/profiles/SideAvatar.tsx',
  'src/components/profile/AvatarUpload.tsx',
];
/** <img> allowed: PersonAvatar itself, and the Photo screen's crop / preview of the NEW photo (not an avatar). */
const IMG_ALLOWED = new Set(['src/components/account/profiles/PersonAvatar.tsx', 'src/modules/dancer-app/screens/photo/PhotoScreen.tsx']);

describe('the journey draws avatars only through PersonAvatar', () => {
  it('the table covers the screens (sanity)', () => {
    expect(JOURNEY.length).toBeGreaterThan(20);
    expect(JOURNEY).toContain('src/modules/dancer-app/screens/home/HomeScreen.tsx');
  });

  it.each(JOURNEY)('%s', (f) => {
    const src = readFileSync(path.join(ROOT, f), 'utf8');
    expect(src, 'shadcn Avatar').not.toMatch(/@\/components\/ui\/avatar/);
    if (!IMG_ALLOWED.has(f)) expect(src, 'a hand-drawn <img>').not.toMatch(/<img\b/);
    // An own initials disc: the first letter of a name, upper-cased, in JSX.
    expect(src, 'an own initials disc').not.toMatch(/\[0\]\??\.toUpperCase\(\)|charAt\(0\)\.toUpperCase\(\)/);
    // A file that draws a face uses the ONE avatar (directly, or via SideAvatar / me/ui Avatar, which wrap it).
    if (/avatar_url|avatarUrl|photoUrl/.test(src) && /<(?:Avatar|SideAvatar|PersonAvatar)\b/.test(src)) {
      expect(src).toMatch(/import \{[^}]*\b(?:PersonAvatar|SideAvatar|Avatar)\b[^}]*\} from '(?:\.\/|\.\.\/me\/ui|@\/components\/account\/profiles\/PersonAvatar|\.\/profiles\/PersonAvatar|\.\/PersonAvatar|\.\/SideAvatar|\.\/ui)'|from "\.\/profiles\/PersonAvatar"/);
    }
  });
});

afterEach(cleanup);
const box = (html: string) => {
  render(<div data-testid="cell" dangerouslySetInnerHTML={{ __html: html }} />);
  return document.body;
};

describe('journeyChecks catch what they exist to catch', () => {
  it.each([
    ['a: Message us copy, no Message-us control', pointers, '<p>We could not find you. Message us and we will sort it out.</p><button>Try again</button>', '<p>Message us and we will sort it out.</p><a href="https://wa.me/1">Message us on WhatsApp</a>'],
    ['a: "tap X" with no X', pointers, '<p>Press Try again above.</p>', '<p>Press Try again above.</p><button>Try again</button>'],
    ['a: "tap X in Y" with no way to Y', pointers, '<p>To share it, tap Show my profile again in Account settings.</p>', '<p>To share it, tap Show my profile again in Account settings.</p><a href="/account/settings">Account settings</a>'],
    ['a: the header picture, not on screen', pointers, '<p>Switch with the picture at the top right.</p>', '<p>Switch with the picture at the top right.</p><button data-testid="profile-switcher-button">x</button>'],
    ['b: an empty state with nothing to do', emptyStates, '<section><p>No nights saved yet.</p></section>', '<section><p>No nights saved yet.</p><a href="/x">Browse events</a></section>'],
    ['c: a disabled control with no reason', disabled, '<div><button disabled>Save</button></div>', '<div><button disabled aria-describedby="r">Save</button><p id="r">Nothing has changed yet.</p></div>'],
    ['c: a falsely disabled Terms row', disabled, '<div><button disabled aria-disabled="true">Terms</button></div>', '<div><a href="/terms">Terms</a></div>'],
    ['d: a black no-photo disc', (r: ParentNode) => avatars(r, []), '<span data-face="initial" style="background: black">A</span>', '<span data-face="initial" style="background: var(--da-avatar, hsl(var(--muted-foreground)))">A</span>'],
    ['d: the photo outside PersonAvatar', (r: ParentNode) => avatars(r, ['https://img.example/a.jpg']), '<img src="https://img.example/a.jpg" alt="">', '<img data-face="photo" src="https://img.example/a.jpg" alt="">'],
  ] as const)('%s', (_n, check, bad, good) => {
    expect(check(box(bad)).length).toBeGreaterThan(0);
    cleanup();
    expect(check(box(good))).toEqual([]);
  });
});
