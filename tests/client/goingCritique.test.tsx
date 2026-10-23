// @vitest-environment jsdom
/**
 * Going P2 stage 5 (independent critique, docs/design/going-p2-critique.md):
 * one table per fix. Each row was run against the unfixed code first (red).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/lib/profileViewEmit', () => ({ emitProfileView: vi.fn() }));
vi.mock('@/lib/goingCheckin', () => ({ GOING_CHECKIN_ENABLED: true }));

import { GOING_COPY, GoingButton, GoingPeople, goingCountText, goingStateFor, type GoingFacts, type GoingPerson } from '@/modules/going';
import { RsvpBlockPlaceholder } from '@/modules/event-page/bento/blocks/RsvpBlockPlaceholder';

afterEach(cleanup);

const people = (n: number): GoingPerson[] =>
  Array.from({ length: Math.min(n, 8) }, (_, i) => ({ dancer_profile_id: `d${i}`, first_name: `P${i}`, photo_url: null }));

describe('C1 a cancelled night never says "No one going yet" (nor "N going")', () => {
  it.each([
    [0, null],
    [1, '1 had said they were going'],
    [3, '3 had said they were going'],
    [200, '200 had said they were going'],
  ] as const)('cancelled, %i going -> %s', (count, text) => {
    render(
      <MemoryRouter>
        <GoingPeople count={count} people={people(count)} cancelled />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('going-count')?.textContent ?? null).toBe(text);
    expect(document.body.textContent).not.toMatch(/going yet/);
  });
});

describe('C2 the count line says what is known', () => {
  it.each([
    [0, false, false, 'No one going yet'],
    [4, false, false, '4 going'],
    [0, true, false, 'No one said they were going'],
    [5, true, false, '5 went'],
    [0, false, true, ''],
    [2, false, true, '2 had said they were going'],
  ] as const)('%i, past %s, cancelled %s -> "%s"', (n, past, cancelled, text) => {
    expect(goingCountText(n, past, cancelled)).toBe(text);
  });
});

describe('C3 an ended night is never "You’re going"', () => {
  it.each([true, false])('ended night, going %s: the label is past tense', (going) => {
    const v = goingStateFor({ viewer: { kind: 'finished' }, night: 'ended', going, count: 1 });
    expect(v.control.label).not.toBe(GOING_COPY.going);
    expect(v.control.label).toBe(going ? 'You went · Undo' : GOING_COPY.nightEnded);
  });
});

const finishFacts: GoingFacts = {
  viewer: { kind: 'unfinished', missing: ['dance_role'] },
  night: 'live',
  going: false,
  count: 0,
  returnTo: '/event/x',
};
const noProfileFacts: GoingFacts = { viewer: { kind: 'no_profile' }, night: 'live', going: false, count: 0 };

describe('C4 a refusal with a way on makes the way on the big control', () => {
  it.each([
    ['unfinished profile', finishFacts, GOING_COPY.finishLink, 'Add your dance role'],
    ['no dancer profile', noProfileFacts, GOING_COPY.noProfileLink, GOING_COPY.noProfile],
  ] as const)('%s', (_n, facts, label, line) => {
    render(
      <MemoryRouter>
        <GoingButton view={goingStateFor(facts)} onTap={() => {}} onSignIn={() => {}} />
      </MemoryRouter>,
    );
    const big = screen.getByTestId('going-button');
    expect(big.tagName).toBe('A');
    expect(big.textContent).toBe(label);
    expect(big.className).toContain('h-[48px]');
    expect(screen.getByTestId('going-button-message').textContent).toContain(line);
    // One way on, not two: no second small link under it.
    expect(screen.queryByTestId('going-button-link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('C5 copy', () => {
  it.each([
    ['beFirst', GOING_COPY.beFirst, /friends/],
    ['myUpcomingEmptyHow', GOING_COPY.myUpcomingEmptyHow, /^Open a night/],
  ] as const)('%s does not promise or point at what is not there', (_k, text, bad) => {
    expect(text).not.toMatch(bad);
  });
  // "its page" stays: journeyChecks.pointers knows it as the night's page, reached from the calendar link.
  it('myUpcomingEmptyHow says where nights are', () => expect(GOING_COPY.myUpcomingEmptyHow).toMatch(/on the calendar/));
});

describe('C6 no layout shift in the commonest states: the placeholder holds the two-line message', () => {
  it('placeholder reserves two message lines', () => {
    render(<RsvpBlockPlaceholder />);
    const line = screen.getByTestId('rsvp-placeholder-message');
    expect(line.className).toContain('min-h-[33px]');
    expect(line.className).toContain('mt-1.5');
  });
  it('a state with no words adds no empty line (no dead space under the button)', () => {
    render(
      <MemoryRouter>
        <GoingButton view={goingStateFor({ viewer: { kind: 'finished' }, night: 'live', going: false, count: 3 })} onTap={() => {}} onSignIn={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('going-button-message')).toBeNull();
  });
});
