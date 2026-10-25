// @vitest-environment jsdom
/**
 * React #421 at BentoPage's lazy <Suspense> slots (RsvpSlot / LevelSlot).
 *
 * The server renders a slot in full; on the client its lazy chunk is still
 * downloading, so the boundary stays dehydrated. A plain (non-transition)
 * re-render of the PARENT hands that boundary new props, and React throws the
 * server HTML away and client-renders it (#421). Wrapping the slot in React.memo
 * with primitive / referentially stable props stops the parent re-render from
 * reaching the boundary. Same harness as hooks/__tests__/useAuthHydration.test.tsx.
 *
 * The first test is the control: it proves the harness reproduces #421 without
 * the memo, so the second one cannot pass vacuously.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Suspense, lazy, memo, useEffect, useState, type ComponentType } from 'react';
import { act } from 'react-dom/test-utils';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Content({ label }: { label: string }) {
  return <p data-testid="content">{label}</p>;
}

type SlotProps = { eventId: string; label: string };
type Factory = { Lazy: ComponentType<{ label: string }>; arrive: () => void };

const makeLazy = (): Factory => {
  let arrive: () => void = () => {};
  // eslint-disable-next-line local/no-bare-lazy-imports -- the test needs a hand-resolved factory
  const Lazy = lazy(
    () => new Promise<{ default: ComponentType<{ label: string }> }>((r) => { arrive = () => r({ default: Content }); }),
  );
  return { Lazy, arrive: () => arrive() };
};

// Mirrors BentoPage: the slot builds anything non-primitive INSIDE.
const makeSlots = (Lazy: Factory['Lazy']) => {
  const Plain = ({ eventId, label }: SlotProps) => (
    <Suspense fallback={<p>loading</p>}>
      <Lazy key={eventId} label={label} />
    </Suspense>
  );
  return { Plain, Memoised: memo(Plain) };
};

let bump: () => void = () => {};
function Parent({ Slot }: { Slot: ComponentType<SlotProps> }) {
  // A parent re-render that changes nothing the slot reads (query-cache tick, hook state ...).
  const [n, setN] = useState(0);
  useEffect(() => { bump = () => setN((v) => v + 1); }, []);
  return (
    <div data-n={n}>
      <Slot eventId="e1" label="rsvp" />
    </div>
  );
}

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = '';
});

async function run(pick: (s: ReturnType<typeof makeSlots>) => ComponentType<SlotProps>) {
  const { Lazy, arrive } = makeLazy();
  const slots = makeSlots(Lazy);
  const Slot = pick(slots);
  const container = document.createElement('div');
  document.body.appendChild(container);
  // Server side: the lazy has resolved in-process, so the full content is in the HTML.
  container.innerHTML = renderToString(<Parent Slot={(p) => <Suspense fallback={null}><Content label={p.label} /></Suspense>} />);
  const serverNode = container.querySelector('[data-testid="content"]');
  expect(serverNode).not.toBeNull();

  const onRecoverableError = vi.fn();
  await act(async () => {
    root = hydrateRoot(container, <Parent Slot={Slot} />, { onRecoverableError });
  });
  await act(async () => { bump(); }); // non-transition parent update while dehydrated
  await act(async () => { arrive(); });
  return { onRecoverableError, serverNode, container };
}

describe('lazy Suspense slot during hydration', () => {
  it('control: an unmemoised slot hit by a parent re-render is client-rendered (#421)', async () => {
    const { onRecoverableError } = await run((s) => s.Plain);
    expect(onRecoverableError.mock.calls.map((c) => String((c[0] as Error)?.message))).not.toEqual([]);
  });

  it('a memoised slot with stable props hydrates in place, no recoverable error', async () => {
    const { onRecoverableError, serverNode, container } = await run((s) => s.Memoised);
    expect(onRecoverableError.mock.calls.map((c) => String((c[0] as Error)?.message))).toEqual([]);
    expect(container.querySelector('[data-testid="content"]')).toBe(serverNode);
  });
});
