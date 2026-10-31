// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { SHAPES } from './wsFixtures';
import { parseEventWorkspace } from '../../../events/eventModel';
import { DateFieldSheet, type FieldStep } from '../DateFieldSheets';

/* F-24: a half-typed per-date field is not dropped silently by the tab bar, phone Back or Escape. */

vi.mock('@/hooks/useIsAdmin', () => ({ useIsAdmin: () => ({ isAdmin: false, isPending: false }) }));
afterEach(cleanup);

/** The control that makes each sheet dirty, and the value it ends up holding. */
const DIRTY: Record<FieldStep, { id: string; value: string }> = {
  'edit-name': { id: 'p3-own-name-text', value: 'Half typed' },
  'edit-photos': { id: 'p3-photo-remove', value: '' },
  'edit-price': { id: 'p3-price-name', value: 'Half typed' },
};
const raw = SHAPES.weekly as { series: { series: Record<string, unknown> } };
const ws = parseEventWorkspace({ ...raw, series: { ...raw.series, series: { ...raw.series.series, gallery: ['https://img.example.test/1.jpg'] } } });

function mount(step: FieldStep) {
  const onClose = vi.fn();
  const router = createMemoryRouter([
    { path: '/a', element: <p>a</p> },
    { path: '/b', element: <DateFieldSheet step={step} ws={ws} detail={null} busy={false} error={null} onSave={vi.fn()} onBack={vi.fn()} onClose={onClose} /> },
    { path: '/c', element: <p data-testid="landed">c</p> },
  ], { initialEntries: ['/a', '/b'], initialIndex: 1 });
  render(<RouterProvider router={router} />);
  return { router, onClose };
}

async function makeDirty(step: FieldStep) {
  if (step === 'edit-price') fireEvent.click(await screen.findByTestId('p3-price-add'));
  const { id, value } = DIRTY[step];
  if (step === 'edit-photos') { fireEvent.click(await screen.findByTestId(id)); return; }
  fireEvent.change(await screen.findByTestId(id), { target: { value } });
}

describe.each(['edit-name', 'edit-photos', 'edit-price'] as FieldStep[])('F-24 %s', (step) => {
  it('clean: navigating away never blocks', async () => {
    const { router } = mount(step);
    await act(async () => { await router.navigate('/c'); });
    expect(router.state.location.pathname).toBe('/c');
  });
  it('dirty: the tab bar asks; Stay keeps the typed value; Leave lands', async () => {
    const { router } = mount(step);
    await makeDirty(step);
    await act(async () => { await router.navigate('/c'); });
    expect(router.state.location.pathname).toBe('/b');
    expect(screen.getByTestId('p3-field-ask')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByTestId('p3-field-ask-stay')); });
    await waitFor(() => expect(screen.queryByTestId('p3-field-ask')).toBeNull());
    if (step === 'edit-photos') expect(screen.queryAllByTestId('p3-photo')).toHaveLength(0);
    else expect((screen.getByTestId(DIRTY[step].id) as HTMLInputElement).value).toBe(DIRTY[step].value);
    await act(async () => { await router.navigate('/c'); });
    fireEvent.click(screen.getByTestId('p3-field-ask-go'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/c'));
  });
  it('dirty: phone Back asks and stays', async () => {
    const { router } = mount(step);
    await makeDirty(step);
    await act(async () => { await router.navigate(-1); });
    expect(router.state.location.pathname).toBe('/b');
    expect(screen.getByTestId('p3-field-ask')).toBeTruthy();
  });
  it('dirty: Escape asks and does not close', async () => {
    const { onClose } = mount(step);
    await makeDirty(step);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('p3-field-ask')).toBeTruthy();
  });
});
