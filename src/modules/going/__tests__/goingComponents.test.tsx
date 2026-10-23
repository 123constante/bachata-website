// @vitest-environment jsdom
/**
 * GoingPeople (going 0 / 1 / 3 / 8 / 9 / 200; photo / no photo / null id) and
 * GoingButton (every state of the mapping: label, disabled + visible reason,
 * link, aria-pressed, 48px explicit tap target, never "Interested").
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({ emit: vi.fn() }));
vi.mock('@/lib/profileViewEmit', () => ({ emitProfileView: h.emit }));

import {
  GOING_COPY,
  GoingButton,
  GoingPeople,
  goingInitial,
  goingPeopleModel,
  goingStateFor,
  type GoingFacts,
  type GoingPerson,
} from '@/modules/going';

afterEach(cleanup);

const NAMES = ['Ana', 'Leo', 'Mia', 'Sam', 'Kai', 'Zoe', 'Raf', 'In\u00e9s', 'Tom', 'Bea'];
const person = (i: number, over: Partial<GoingPerson> = {}): GoingPerson => ({
  dancer_profile_id: `d${i}`,
  first_name: NAMES[i % NAMES.length],
  photo_url: null,
  ...over,
});
const people = (n: number) => Array.from({ length: Math.min(n, 8) }, (_, i) => person(i));

const renderPeople = (count: number, list: GoingPerson[], past = false) =>
  render(
    <MemoryRouter>
      <GoingPeople count={count} people={list} past={past} />
    </MemoryRouter>,
  );

describe('GoingPeople while a save is in flight (count bumped, people not re-read yet)', () => {
  it.each([
    // [count shown, people list was read at, list length, "+N more" expected]
    [4, 3, 3, null],
    [2, 1, 1, null],
    [10, 9, 8, '+1'],
    [2, 3, 3, null],
  ] as const)('count %i, people read at %i (%i listed): more=%s, never the viewer as "+1 more"', (count, peopleCount, n, more) => {
    render(
      <MemoryRouter>
        <GoingPeople count={count} peopleCount={peopleCount} people={people(n)} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('going-count').textContent).toBe(`${count} going`);
    const chip = screen.queryByTestId('going-more');
    if (more) expect(chip?.textContent).toContain(more);
    else expect(chip).toBeNull();
  });
});

describe('GoingPeople x going count', () => {
  it.each([
    [0, 'No one going yet', 0, null],
    [1, '1 going', 1, null],
    [3, '3 going', 3, null],
    [8, '8 going', 8, null],
    [9, '9 going', 8, '+1'],
    [200, '200 going', 8, '+192'],
  ] as const)('%i going: "%s", %i people shown, more=%s', (count, text, shown, more) => {
    renderPeople(count, people(count));
    expect(screen.getByTestId('going-count').textContent).toBe(text);
    expect(screen.queryAllByTestId('going-person-link')).toHaveLength(shown);
    const chip = screen.queryByTestId('going-more');
    if (more) {
      expect(chip?.textContent).toContain(more);
      expect(chip?.textContent).toContain(`and ${count - 8} more ${count - 8 === 1 ? 'person' : 'people'}`);
    } else expect(chip).toBeNull();
    // Every first name is on screen.
    for (const p of people(count)) expect(screen.getAllByText(p.first_name).length).toBeGreaterThan(0);
  });

  it('a past night says "went"', () => {
    renderPeople(5, people(5), true);
    expect(screen.getByTestId('going-count').textContent).toBe('5 went');
  });

  it('+N more is going_count minus the people the server sent (fewer than 8 sent)', () => {
    expect(goingPeopleModel(12, people(3)).extra).toBe(9);
    expect(goingPeopleModel(2, people(3)).extra).toBe(0); // a stale count never goes negative
  });
});

describe('GoingPeople x person shape', () => {
  it('photo: an image, no initial; no photo: an initials circle', () => {
    renderPeople(2, [person(0, { photo_url: 'https://cdn.example/ana.jpg' }), person(1)]);
    const img = screen.getByTestId('going-photo') as HTMLImageElement;
    expect(img.src).toBe('https://cdn.example/ana.jpg');
    expect(img.alt).toBe(''); // the first name is printed beside it
    expect(screen.getAllByTestId('going-initial').map((e) => e.textContent)).toEqual(['L']);
  });

  it('a non-null id links to the dancer page and logs the view; a null id is name only, no link', () => {
    renderPeople(2, [person(0, { dancer_profile_id: 'abc' }), person(1, { dancer_profile_id: null })]);
    const link = screen.getByTestId('going-person-link');
    expect(link.getAttribute('href')).toBe('/dancers/abc');
    expect(link.getAttribute('aria-label')).toBe('Ana, dancer page');
    expect(screen.getByTestId('going-person').closest('a')).toBeNull();
    expect(screen.getByTestId('going-person').textContent).toContain('Leo');
    fireEvent.click(link);
    expect(h.emit).toHaveBeenCalledWith(expect.objectContaining({ personId: 'abc', profileType: 'dancer' }));
  });

  it('tap targets are explicit px, at least 44', () => {
    renderPeople(1, people(1));
    expect(screen.getByTestId('going-person-link').className).toMatch(/min-h-\[48px\]/);
    expect(screen.getByTestId('going-person-link').className).toMatch(/w-\[52px\]/);
  });

  it.each([
    ['Ana', 'A'],
    ['\u00e9lodie', '\u00c9'],
    ['  sam', 'S'],
    ['', '?'],
  ])('initial of %j is %j', (name, letter) => expect(goingInitial(name)).toBe(letter));
});

const button = (facts: GoingFacts, handlers = { onTap: vi.fn(), onSignIn: vi.fn() }) => {
  render(
    <MemoryRouter>
      <GoingButton view={goingStateFor(facts)} {...handlers} />
    </MemoryRouter>,
  );
  return { btn: screen.getByTestId('going-button') as HTMLButtonElement, ...handlers };
};

describe('GoingButton', () => {
  it('can tap: "I\u2019m going", 48px, taps through, 0 going invites', () => {
    const { btn, onTap } = button({ viewer: { kind: 'finished' }, night: 'live', going: false, count: 0 });
    expect(btn.textContent).toBe(GOING_COPY.go);
    expect(btn.className).toMatch(/h-\[48px\]/);
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('going-button-message').textContent).toBe(GOING_COPY.beFirst);
    fireEvent.click(btn);
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('going: says how to undo, pressed', () => {
    const { btn } = button({ viewer: { kind: 'finished' }, night: 'live', going: true, count: 1 });
    expect(btn.textContent).toBe(GOING_COPY.going);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('going-button-message').textContent).toBe(GOING_COPY.goingUndoHint);
  });

  it('signed out: opens sign-in, never the tap', () => {
    const { btn, onTap, onSignIn } = button({ viewer: { kind: 'signed_out' }, night: 'live', going: null });
    expect(btn.textContent).toBe(GOING_COPY.signIn);
    fireEvent.click(btn);
    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(onTap).not.toHaveBeenCalled();
  });

  // Stage 5 (C4): the way on IS the big control, not a dead grey button over a small link.
  it('unfinished: the control is "Finish your profile", the line names the field', () => {
    const { btn, onTap } = button({ viewer: { kind: 'unfinished', missing: ['dance_role'] }, night: 'live', going: false, returnTo: '/event/e' });
    expect(btn.tagName).toBe('A');
    expect(btn.textContent).toBe(GOING_COPY.finishLink);
    expect(screen.getByTestId('going-button-message').textContent).toContain('Add your dance role to say you\u2019re going.');
    expect(btn.getAttribute('href')).toBe('/finish-profile?returnTo=%2Fevent%2Fe');
    expect(screen.queryByTestId('going-button-link')).toBeNull();
    expect(btn.getAttribute('aria-describedby')).toBe(screen.getByTestId('going-button-message').id);
    fireEvent.click(btn);
    expect(onTap).not.toHaveBeenCalled();
  });

  it.each([
    ['ended', GOING_COPY.nightEnded, GOING_COPY.ended],
    ['cancelled', GOING_COPY.nightCancelled, GOING_COPY.cancelled],
    ['not_live', GOING_COPY.go, GOING_COPY.notLive],
  ] as const)('night %s: disabled with the reason on screen', (night, label, reason) => {
    const { btn } = button({ viewer: { kind: 'finished' }, night, going: false });
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe(label);
    expect(screen.getByTestId('going-button-message').textContent).toBe(reason);
  });

  it('loading: disabled, says it is checking', () => {
    const { btn } = button({ viewer: { kind: 'finished' }, night: 'live', going: null });
    expect(btn.disabled).toBe(true);
    expect(screen.getByTestId('going-button-message').textContent).toBe(GOING_COPY.loading);
  });

  it('saving: disabled and busy', () => {
    const { btn } = button({ viewer: { kind: 'finished' }, night: 'live', going: true, pending: true });
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByTestId('going-button-message').textContent).toBe(GOING_COPY.saving);
  });

  it('no dancer profile: the message-us link opens outside', () => {
    button({ viewer: { kind: 'no_profile' }, night: 'live', going: false });
    const a = screen.getByTestId('going-button');
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.textContent).toBe(GOING_COPY.noProfileLink);
  });
});
