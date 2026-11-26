// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn(async () => ({ data: [], error: null })), from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

import { emptyForm, type SessForm } from '../../data/sessions';
import { PEOPLE_PER_SESSION_MAX } from '../model';
import { prefillTeachers, teachersOfWorkspace, type TeachPerson } from '../lastTeachers';
import { SessionsSheetLook } from '../SessionsSheetLook';

afterEach(cleanup);

const P = (id: string): TeachPerson => ({ profileId: id, name: `T ${id}`, role: 'teaching' });
const cls = (): SessForm => emptyForm('class');

describe('prefillTeachers', () => {
  it('gives both class forms the one source session', () => {
    const r = prefillTeachers([cls(), cls()], [[P('a')]]);
    expect(r.filled).toBe(true);
    expect(r.forms.map((f) => f.people?.[0]?.profileId)).toEqual(['a', 'a']);
  });
  it('fills only the class, not the party', () => {
    const r = prefillTeachers([emptyForm('party'), cls()], [[P('a')]]);
    expect(r.forms[0].people).toBeUndefined();
    expect(r.forms[1].people).toHaveLength(1);
  });
  it('counts teaching forms only: the i-th teaching form takes source[i]', () => {
    const r = prefillTeachers([emptyForm('party'), cls(), cls()], [[P('a')], [P('b')]]);
    expect([r.forms[1].people?.[0].profileId, r.forms[2].people?.[0].profileId]).toEqual(['a', 'b']);
  });
  it('leaves a form that already has people', () => {
    const own = { ...cls(), people: [{ profileId: 'x', name: 'X', role: 'teaching' }] };
    const r = prefillTeachers([own], [[P('a')]]);
    expect(r.forms[0]).toBe(own);
    expect(r.filled).toBe(false);
  });
  it('caps at the per-session maximum', () => {
    const many = Array.from({ length: PEOPLE_PER_SESSION_MAX + 4 }, (_, i) => P(`p${i}`));
    expect(prefillTeachers([cls()], [many]).forms[0].people).toHaveLength(PEOPLE_PER_SESSION_MAX);
  });
  it('empty source: nothing filled', () => {
    const f = [cls()];
    expect(prefillTeachers(f, [])).toEqual({ forms: f, filled: false });
  });
});

describe('teachersOfWorkspace', () => {
  const item = (type: string, people: Array<{ id: string; role: string }>) => ({
    item: { id: `i-${type}-${people.length}`, type, title: type },
    people: people.map((p) => ({ profile_id: p.id, display_name: `N ${p.id}`, role: p.role })),
  });
  it('keeps teaching items with teaching people, in order; skips the rest', () => {
    const program = [{ day: { id: 'd1' }, sections: [{ section: { id: 's1', kind: 'classes' }, items: [
      item('class', [{ id: 'a', role: 'teaching' }, { id: 'dj', role: 'djing' }]),
      item('party', [{ id: 'p', role: 'djing' }]),
      item('class', []),
      item('masterclass', [{ id: 'b', role: 'teaching' }]),
    ] }] }];
    const out = teachersOfWorkspace({ program });
    expect(out.map((s) => s.map((p) => p.profileId))).toEqual([['a'], ['b']]);
    expect(out[0][0]).toEqual({ profileId: 'a', name: 'N a', role: 'teaching' });
  });
  it('no programme: none', () => expect(teachersOfWorkspace({ program: null })).toEqual([]));
});

describe('SessionsSheetLook prefill', () => {
  const view = (prefill: { from: string; people: TeachPerson[][] } | null | undefined) => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SessionsSheetLook forms={[cls()]} venueId={null} teachers prefill={prefill} onDone={() => {}} onClose={() => {}} />
    </QueryClientProvider>,
  );
  it('shows the note and the teacher chip', () => {
    view({ from: 'Latin Nights', people: [[P('a')]] });
    expect(screen.getByTestId('p3-new-sess-prefill').textContent).toContain('Teachers from Latin Nights.');
    expect(screen.getByText('T a')).toBeTruthy();
  });
  it('no prefill prop: no note, no chip', () => {
    view(undefined);
    expect(screen.queryByTestId('p3-new-sess-prefill')).toBeNull();
    expect(screen.queryByText('T a')).toBeNull();
  });
  it('null prefill: no note', () => {
    view(null);
    expect(screen.queryByTestId('p3-new-sess-prefill')).toBeNull();
  });
});
