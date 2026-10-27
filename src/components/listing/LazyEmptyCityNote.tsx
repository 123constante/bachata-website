/**
 * EmptyCityNote for the home feed, loaded only when a city has nothing listed.
 * The home route statically importing the note cost it one more first-load
 * chunk (38 vs its chunk ratchet of 37): the note is shared with the listing
 * pages, so rollup emits it as a chunk of its own. London never renders it.
 */
import { Suspense, type ComponentProps } from 'react';
import { lazyWithRetry } from '@/lib/lazyWithRetry';

const EmptyCityNote = lazyWithRetry(() => import('./EmptyCityNote'));

export default function LazyEmptyCityNote(props: ComponentProps<typeof EmptyCityNote>) {
  return (
    <Suspense fallback={null}>
      <EmptyCityNote {...props} />
    </Suspense>
  );
}
