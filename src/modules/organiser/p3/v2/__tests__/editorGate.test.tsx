// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const w = vi.hoisted(() => ({ series: { id: 's1', format: 'recurring', festival_id: null as string | null } }));
vi.mock('../../screens/EventPage', () => ({ WorkspaceGate: ({ children }: { children: (ws: unknown) => unknown }) => <>{children({ series: w.series })}</> }));
vi.mock('../EditorV2', () => ({ EditorV2: () => <p data-testid="editor-v2" /> }));
import { R4EditorGate } from '../EditorGate';

afterEach(() => { cleanup(); });
const gate = () => render(<R4EditorGate fallback={<p data-testid="fallback" />} />);

describe('R4EditorGate', () => {
  it('weekly and one-off events mount EditorV2', () => {
    for (const format of ['recurring', 'one_off']) {
      w.series = { id: 's1', format, festival_id: null };
      gate();
      expect(screen.queryByTestId('editor-v2'), format).toBeTruthy();
      expect(screen.queryByTestId('fallback'), format).toBeNull();
      cleanup();
    }
  });
  it('festival, course and a festival series get the fallback', () => {
    for (const [format, festival_id] of [['festival', null], ['course', null], ['recurring', 'f1']] as const) {
      w.series = { id: 's1', format, festival_id };
      gate();
      expect(screen.queryByTestId('fallback'), format).toBeTruthy();
      expect(screen.queryByTestId('editor-v2'), format).toBeNull();
      cleanup();
    }
  });
});
