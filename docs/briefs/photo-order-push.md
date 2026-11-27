# Brief: push photo order and cover (organiserPhotoOrder flag)

Lane: normal. Website only, no DB, no migration. Branch: `claude/organiser-photo-order` (off main).
Owner picked option B and said "Build this" (2026-11-12). Built and tested locally; the owner PC cannot push because its pre-push unit gate fails under load (JoinGetPaidNext, reviewScope, ogWholeFlyerCard: each passes alone). Your job: apply the patch below on a clean branch off current main, push from this unloaded host (never --no-verify), open the bot PR, and finish the checks.

## Steps
1. New branch `claude/organiser-photo-order` off origin/main. Save the patch below to a file and `git am` it (or `git apply` if am fails; fix conflicts by hand, small).
2. `npm run test:unit` for src/modules/organiser (photoOrder.matrix.test.tsx and pseries.parity.test.tsx must pass), `npx tsc --noEmit`, `npm run lint`.
3. Push, open the PR. Body: what it does (tap a photo, Move left/right, Make cover where the old cover becomes photo 2, Remove; Done saves ONE series.upsert with default_cover_image_url and/or default_gallery; untouched sheet sends nothing; flag off = old sheet), a "Verified on real data" block (read-only prod shapes of series with 0/1/many photos, cover present or absent, lists near MAX_GALLERY; no personal data), and a Verified / Not verified block.
4. Preview deploy with VITE_ENABLE_ORGANISER_PHOTO_ORDER=true and a 390x844 walk of the Gallery sheet; screenshots on the PR.
5. Do NOT merge. Flaky tests are a separate queue item; do not fix them here.

## Patch
```diff
From 2b63dd5d71ce358152af64448c4f4f2f83275ef7 Mon Sep 17 00:00:00 2001
From: t <t@example.com>
Date: Thu, 12 Nov 2026 16:00:07 +0000
Subject: [PATCH] feat(organiser): photo order and cover in the event Gallery
 sheet, behind organiserPhotoOrder

Tap a photo, then Move left, Move right, Make cover (old cover becomes photo 2) or Remove.
Done saves ONE series.upsert carrying default_cover_image_url and/or default_gallery;
an untouched sheet sends nothing. Flag off (default) leaves the old sheet unchanged.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WoGkiAai4m9i84Yix77tGf
---
 src/lib/featureFlags.ts                       |  3 +
 src/modules/organiser/events/Details.tsx      |  6 +-
 src/modules/organiser/events/EditorSheet.tsx  |  6 ++
 .../organiser/events/PhotoOrderBody.tsx       | 78 +++++++++++++++
 .../__tests__/photoOrder.matrix.test.tsx      | 94 +++++++++++++++++++
 src/modules/organiser/events/photoOrder.ts    | 43 +++++++++
 src/modules/organiser/events/seriesExtras.ts  | 10 ++
 7 files changed, 238 insertions(+), 2 deletions(-)
 create mode 100644 src/modules/organiser/events/PhotoOrderBody.tsx
 create mode 100644 src/modules/organiser/events/__tests__/photoOrder.matrix.test.tsx
 create mode 100644 src/modules/organiser/events/photoOrder.ts

diff --git a/src/lib/featureFlags.ts b/src/lib/featureFlags.ts
index d39f14080..7e408a6e0 100644
--- a/src/lib/featureFlags.ts
+++ b/src/lib/featureFlags.ts
@@ -79,6 +79,9 @@ export const flags = {
   // Turn on with VITE_ENABLE_ORGANISER_DASH=true (Vercel env) -- no code change.
   organiserDash:       import.meta.env.VITE_ENABLE_ORGANISER_DASH === 'true',
   organiserTicketing:  import.meta.env.VITE_ENABLE_ORGANISER_TICKETING === 'true',
+  // Gallery sheet: choose photo order and the cover (tap a photo, then Move left/right, Make cover).
+  // OFF = the sheet is exactly as before. Turn on with VITE_ENABLE_ORGANISER_PHOTO_ORDER=true (Vercel env).
+  organiserPhotoOrder: import.meta.env.VITE_ENABLE_ORGANISER_PHOTO_ORDER === 'true',
   // Buyer ticket checkout (S4, docs/ticketing-buyer-journey.md): the Tickets block on
   // /event/:id and the /tickets/thanks return page. OFF = no block, no route. Turn on with
   // VITE_ENABLE_PUBLIC_TICKETING=true (Vercel env) -- no code change.
diff --git a/src/modules/organiser/events/Details.tsx b/src/modules/organiser/events/Details.tsx
index 700a4ad78..3a7d375cd 100644
--- a/src/modules/organiser/events/Details.tsx
+++ b/src/modules/organiser/events/Details.tsx
@@ -25,7 +25,8 @@ import { isAccessRefusal } from '@/modules/organiser/shared/selfServeErrors';
 import { NoAccess } from '@/modules/organiser/shared/components/NoAccess';
 import { ClosedLines } from './ClosedLines';
 import { uploadEventPicture } from './media';
-import { countLabel, mediaCommand } from './seriesExtras';
+import { countLabel, mediaCommand, photosCommand } from './seriesExtras';
+import { flags } from '@/lib/featureFlags';
 import { FLYER_LABEL } from '../shared/flyerLabel';
 import { MusicEdit } from './MusicEdit';
 import { PaymentEdit } from './PaymentEdit';
@@ -131,7 +132,8 @@ function DetailRows({ ws, today }: { ws: EventWorkspace; today: string }) {
     if (next !== null || busy) return;
     if (closing === 'gallery' || closing === 'video') {
       const now = latest.current;
-      const command = closing === 'gallery' ? mediaCommand(ws, 'default_gallery', now.gallery) : mediaCommand(ws, 'default_video_urls', now.videos);
+      const galleryCommand = flags.organiserPhotoOrder ? photosCommand(ws, now.coverUrl, now.gallery) : mediaCommand(ws, 'default_gallery', now.gallery);
+      const command = closing === 'gallery' ? galleryCommand : mediaCommand(ws, 'default_video_urls', now.videos);
       if (command) void sendThenDone(ws.series.version, command, { title: 'Saved', message: 'Saved' });
       return;
     }
diff --git a/src/modules/organiser/events/EditorSheet.tsx b/src/modules/organiser/events/EditorSheet.tsx
index e2f54b9c8..3be0a4ff2 100644
--- a/src/modules/organiser/events/EditorSheet.tsx
+++ b/src/modules/organiser/events/EditorSheet.tsx
@@ -9,6 +9,8 @@ import { Card, Collapse, ErrorState, FIELD_CLASS, GhostButton, PrimaryButton, Se
 import { CAP_NOTE, allowedEndChoices, type CapInput } from './dateCap';
 import { MAX_GALLERY, MAX_VIDEOS, SHAPE_LABEL, shortDate, weekdayName, type EventDraft, type Shape } from './eventModel';
 import { dancerMessageUsUrl } from '@/lib/contactLinks';
+import { flags } from '@/lib/featureFlags';
+import { PhotoOrderBody } from './PhotoOrderBody';
 
 /** The WhatsApp message "Ask the team to add this venue" opens; the searched text and the event follow it. */
 export const VENUE_ADD_MESSAGE = 'Hi! Please add a venue to Bachata Calendar. I searched for: ';
@@ -107,6 +109,10 @@ export function EditorSheet({ sheet, onSheet, draft, patch, today, cap, venues,
   let body = null;
   switch (sheet) {
     case 'gallery':
+      if (flags.organiserPhotoOrder) {
+        body = <PhotoOrderBody draft={draft} patch={patch} fileRef={fileRef} onPick={pick} uploading={uploading} uploadError={uploadError} />;
+        break;
+      }
       body = (
         <div className="space-y-[12px]" data-testid="org-sheet-gallery">
           {photos.length === 0 && <p className="text-[14px] text-[var(--mut)]">No photos yet. Add a few from past nights.</p>}
diff --git a/src/modules/organiser/events/PhotoOrderBody.tsx b/src/modules/organiser/events/PhotoOrderBody.tsx
new file mode 100644
index 000000000..98c57854e
--- /dev/null
+++ b/src/modules/organiser/events/PhotoOrderBody.tsx
@@ -0,0 +1,78 @@
+import { useState, type ChangeEvent, type RefObject } from 'react';
+import { ArrowLeft, ArrowRight, ImagePlus } from 'lucide-react';
+import { cn } from '@/lib/utils';
+import { FLYER_ACCEPT } from '@/modules/organiser/shared/flyerModel';
+import { GhostButton } from '../ui';
+import { MAX_GALLERY, type EventDraft } from './eventModel';
+import { makeCover, moveBlock, movePhoto, photoList } from './photoOrder';
+
+interface Props {
+  draft: EventDraft;
+  patch: (p: Partial<EventDraft>) => void;
+  fileRef: RefObject<HTMLInputElement>;
+  onPick: (e: ChangeEvent<HTMLInputElement>) => void;
+  uploading: boolean;
+  uploadError: string | null;
+}
+
+const ACTION = 'flex min-h-[44px] flex-1 items-center justify-center gap-[6px] rounded-[12px] border border-[var(--line)] bg-[var(--card2)] px-[12px] text-[14px] font-semibold text-[var(--fg)] disabled:opacity-50';
+
+/** The Gallery sheet with order and cover: tap a photo, then one action bar (Move left, Move right, Make cover, Remove). */
+export function PhotoOrderBody({ draft, patch, fileRef, onPick, uploading, uploadError }: Props) {
+  const [selected, setSelected] = useState<string | null>(null);
+  const set = { coverUrl: draft.coverUrl, gallery: draft.gallery };
+  const list = photoList(set);
+  const cover = draft.coverUrl.trim();
+  const at = selected ? list.indexOf(selected) : -1;
+  const pickedUrl = at >= 0 ? list[at] : null;
+  const isCover = !!pickedUrl && pickedUrl === cover;
+  const apply = (next: { coverUrl: string; gallery: string[] }) => patch({ coverUrl: next.coverUrl, gallery: next.gallery });
+  const left = pickedUrl ? moveBlock(set, pickedUrl, -1) : null;
+  const right = pickedUrl ? moveBlock(set, pickedUrl, 1) : null;
+
+  return (
+    <div className="space-y-[12px]" data-testid="org-sheet-gallery">
+      {list.length === 0 && <p className="text-[14px] text-[var(--mut)]">No photos yet. Add a few from past nights.</p>}
+      <div role="list" className="grid grid-cols-3 gap-[8px]">
+        {list.map((url, i) => (
+          <button key={url} type="button" role="listitem" data-testid="org-gallery-tile" aria-pressed={url === selected}
+            aria-label={url === cover ? 'Cover photo' : `Photo ${i + 1}`}
+            onClick={() => setSelected(url === selected ? null : url)}
+            className={cn('relative aspect-square overflow-hidden rounded-[12px] bg-[var(--card2)]', url === selected && 'outline outline-[3px] -outline-offset-[3px] outline-[var(--fg)]')}>
+            <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
+            {url === cover && (
+              <span className="absolute left-[6px] top-[6px] rounded-full bg-[var(--danger)] px-[7px] py-[2px] text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--danger-fg)]" data-testid="org-gallery-cover-badge">Cover</span>
+            )}
+          </button>
+        ))}
+      </div>
+      {list.length > 1 && !pickedUrl && <p className="text-[13px] text-[var(--mut)]">Tap a photo to move it, make it the cover or remove it.</p>}
+      {pickedUrl && (
+        <div className="space-y-[8px]" data-testid="org-gallery-bar">
+          <p className="text-[13px] text-[var(--mut)]">{isCover ? 'Cover photo selected' : `Photo ${at + 1} selected`}</p>
+          <div className="flex gap-[8px]">
+            <button type="button" className={ACTION} disabled={!!left} title={left ?? undefined} data-testid="org-gallery-left"
+              onClick={() => apply(movePhoto(set, pickedUrl, -1))}><ArrowLeft aria-hidden="true" className="h-[16px] w-[16px]" /> Move left</button>
+            <button type="button" className={ACTION} disabled={!!right} title={right ?? undefined} data-testid="org-gallery-right"
+              onClick={() => apply(movePhoto(set, pickedUrl, 1))}>Move right <ArrowRight aria-hidden="true" className="h-[16px] w-[16px]" /></button>
+          </div>
+          <div className="flex gap-[8px]">
+            <button type="button" className={cn(ACTION, !isCover && 'bg-[var(--fg)] text-[var(--bg)]')} disabled={isCover} data-testid="org-gallery-cover"
+              onClick={() => apply(makeCover(set, pickedUrl))}>{isCover ? 'This is the cover' : 'Make cover'}</button>
+            {!isCover && (
+              <button type="button" className={cn(ACTION, 'text-[var(--danger)]')} data-testid="org-gallery-remove"
+                onClick={() => { patch({ gallery: draft.gallery.filter((g) => g !== pickedUrl) }); setSelected(null); }}>Remove</button>
+            )}
+          </div>
+        </div>
+      )}
+      <input ref={fileRef} type="file" accept={FLYER_ACCEPT} multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onPick} data-testid="org-gallery-file" />
+      {draft.gallery.length < MAX_GALLERY && (
+        <GhostButton loading={uploading} loadingLabel="Uploading" onClick={() => fileRef.current?.click()} testId="org-gallery-add">
+          <ImagePlus aria-hidden="true" className="h-[20px] w-[20px]" /> Add photos
+        </GhostButton>
+      )}
+      {uploadError && <p role="alert" className="text-[14px] text-[var(--danger)]">{uploadError}</p>}
+    </div>
+  );
+}
diff --git a/src/modules/organiser/events/__tests__/photoOrder.matrix.test.tsx b/src/modules/organiser/events/__tests__/photoOrder.matrix.test.tsx
new file mode 100644
index 000000000..2c3a7fde5
--- /dev/null
+++ b/src/modules/organiser/events/__tests__/photoOrder.matrix.test.tsx
@@ -0,0 +1,94 @@
+// @vitest-environment jsdom
+import { useState } from 'react';
+import { afterEach, describe, expect, it } from 'vitest';
+import { cleanup, fireEvent, render, screen } from '@testing-library/react';
+import { makeCover, moveBlock, movePhoto, photoList } from '../photoOrder';
+import { photosCommand } from '../seriesExtras';
+import { PhotoOrderBody } from '../PhotoOrderBody';
+import type { EventDraft } from '../eventModel';
+
+const C = 'c.jpg', A = 'a.jpg', B = 'b.jpg';
+
+describe('photoOrder (table)', () => {
+  it.each([
+    ['cover first, then gallery', { coverUrl: C, gallery: [A, B] }, [C, A, B]],
+    ['gallery copy of the cover is not listed twice', { coverUrl: C, gallery: [A, C] }, [C, A]],
+    ['no cover: gallery as is', { coverUrl: '', gallery: [A, B] }, [A, B]],
+    ['empty', { coverUrl: '', gallery: [] }, []],
+  ])('photoList: %s', (_n, s, want) => expect(photoList(s)).toEqual(want));
+
+  it.each([
+    ['move photo 2 left makes it the cover', { coverUrl: C, gallery: [A, B] }, A, -1, { coverUrl: A, gallery: [C, B] }],
+    ['move cover right: photo 2 becomes cover', { coverUrl: C, gallery: [A, B] }, C, 1, { coverUrl: A, gallery: [C, B] }],
+    ['move last right is a no-op', { coverUrl: C, gallery: [A, B] }, B, 1, { coverUrl: C, gallery: [A, B] }],
+    ['no cover: swap inside the gallery', { coverUrl: '', gallery: [A, B] }, B, -1, { coverUrl: '', gallery: [B, A] }],
+  ])('movePhoto: %s', (_n, s, url, dir, want) => expect(movePhoto(s, url, dir as -1 | 1)).toEqual(want));
+
+  it('makeCover: old cover becomes photo 2; with no cover the photo leaves the gallery', () => {
+    expect(makeCover({ coverUrl: C, gallery: [A, B] }, B)).toEqual({ coverUrl: B, gallery: [C, A] });
+    expect(makeCover({ coverUrl: '', gallery: [A, B] }, B)).toEqual({ coverUrl: B, gallery: [A] });
+    expect(makeCover({ coverUrl: C, gallery: [A] }, 'zz')).toEqual({ coverUrl: C, gallery: [A] });
+  });
+
+  it('moveBlock says why', () => {
+    const s = { coverUrl: C, gallery: [A] };
+    expect(moveBlock(s, C, -1)).toBe('Already first');
+    expect(moveBlock(s, A, 1)).toBe('Already last');
+    expect(moveBlock(s, A, -1)).toBeNull();
+  });
+});
+
+describe('photosCommand', () => {
+  const ws = { series: { name: 'Fri', default_cover_image_url: C }, gallery: [A, B] } as never;
+  it('untouched sends nothing', () => expect(photosCommand(ws, C, [A, B])).toBeNull());
+  it('reorder only sends the gallery', () => expect(photosCommand(ws, C, [B, A])?.payload).toEqual({ name: 'Fri', default_gallery: [B, A] }));
+  it('new cover sends both in ONE upsert', () =>
+    expect(photosCommand(ws, A, [C, B])?.payload).toEqual({ name: 'Fri', default_cover_image_url: A, default_gallery: [C, B] }));
+});
+
+function Harness({ start }: { start: Partial<EventDraft> }) {
+  const [d, setD] = useState({ coverUrl: C, gallery: [A, B], ...start } as EventDraft);
+  return (
+    <>
+      <PhotoOrderBody draft={d} patch={(p) => setD((x) => ({ ...x, ...p }))} fileRef={{ current: null }} onPick={() => {}} uploading={false} uploadError={null} />
+      <output data-testid="out">{JSON.stringify([d.coverUrl, d.gallery])}</output>
+    </>
+  );
+}
+afterEach(cleanup);
+const out = () => screen.getByTestId('out').textContent;
+
+describe('PhotoOrderBody', () => {
+  it('shows one Cover badge and no bar until a photo is tapped', () => {
+    render(<Harness start={{}} />);
+    expect(screen.getAllByTestId('org-gallery-cover-badge')).toHaveLength(1);
+    expect(screen.queryByTestId('org-gallery-bar')).toBeNull();
+  });
+  it('Make cover on photo 3: old cover becomes photo 2', () => {
+    render(<Harness start={{}} />);
+    fireEvent.click(screen.getAllByTestId('org-gallery-tile')[2]);
+    fireEvent.click(screen.getByTestId('org-gallery-cover'));
+    expect(out()).toBe(JSON.stringify([B, [C, A]]));
+  });
+  it('Move left / right reorder; first cannot move left and says why', () => {
+    render(<Harness start={{}} />);
+    fireEvent.click(screen.getAllByTestId('org-gallery-tile')[0]);
+    const left = screen.getByTestId('org-gallery-left') as HTMLButtonElement;
+    expect(left.disabled).toBe(true);
+    expect(left.title).toBe('Already first');
+    fireEvent.click(screen.getByTestId('org-gallery-right'));
+    expect(out()).toBe(JSON.stringify([A, [C, B]]));
+  });
+  it('Remove drops a gallery photo; the cover has no Remove', () => {
+    render(<Harness start={{}} />);
+    fireEvent.click(screen.getAllByTestId('org-gallery-tile')[0]);
+    expect(screen.queryByTestId('org-gallery-remove')).toBeNull();
+    fireEvent.click(screen.getAllByTestId('org-gallery-tile')[1]);
+    fireEvent.click(screen.getByTestId('org-gallery-remove'));
+    expect(out()).toBe(JSON.stringify([C, [B]]));
+  });
+  it('empty state says what to do', () => {
+    render(<Harness start={{ coverUrl: '', gallery: [] }} />);
+    expect(screen.getByText(/No photos yet/)).toBeTruthy();
+  });
+});
diff --git a/src/modules/organiser/events/photoOrder.ts b/src/modules/organiser/events/photoOrder.ts
new file mode 100644
index 000000000..357a82add
--- /dev/null
+++ b/src/modules/organiser/events/photoOrder.ts
@@ -0,0 +1,43 @@
+// Photo order and cover for the Gallery sheet. Pure.
+// The cover (default_cover_image_url) and the gallery (default_gallery) are stored apart,
+// but the organiser sees ONE row of photos: the cover first, then the gallery.
+
+export interface PhotoSet { coverUrl: string; gallery: string[] }
+
+/** The cover first, then the gallery (a gallery copy of the cover is not listed twice). */
+export function photoList(s: PhotoSet): string[] {
+  const cover = s.coverUrl.trim();
+  return cover ? [cover, ...s.gallery.filter((g) => g !== cover)] : [...s.gallery];
+}
+
+/** A list back into the two stored fields. With no cover, the whole list stays the gallery. */
+function fromList(list: string[], hadCover: boolean): PhotoSet {
+  return hadCover ? { coverUrl: list[0] ?? '', gallery: list.slice(1) } : { coverUrl: '', gallery: list };
+}
+
+/** Swap a photo with its neighbour. Moving the first photo right makes photo 2 the cover. */
+export function movePhoto(s: PhotoSet, url: string, dir: -1 | 1): PhotoSet {
+  const list = photoList(s);
+  const i = list.indexOf(url);
+  const j = i + dir;
+  if (i < 0 || j < 0 || j >= list.length) return { coverUrl: s.coverUrl, gallery: s.gallery };
+  [list[i], list[j]] = [list[j], list[i]];
+  return fromList(list, !!s.coverUrl.trim());
+}
+
+/** The photo becomes the cover; the old cover becomes photo 2 (first in the gallery). */
+export function makeCover(s: PhotoSet, url: string): PhotoSet {
+  const list = photoList(s);
+  if (!list.includes(url)) return { coverUrl: s.coverUrl, gallery: s.gallery };
+  return { coverUrl: url, gallery: list.filter((u) => u !== url) };
+}
+
+/** Why a move is not possible; null when it is. Used to disable the button and say why. */
+export function moveBlock(s: PhotoSet, url: string, dir: -1 | 1): string | null {
+  const list = photoList(s);
+  const i = list.indexOf(url);
+  if (i < 0) return 'Photo not found';
+  if (dir === -1 && i === 0) return 'Already first';
+  if (dir === 1 && i === list.length - 1) return 'Already last';
+  return null;
+}
diff --git a/src/modules/organiser/events/seriesExtras.ts b/src/modules/organiser/events/seriesExtras.ts
index fa0b8f04b..8d92f44e9 100644
--- a/src/modules/organiser/events/seriesExtras.ts
+++ b/src/modules/organiser/events/seriesExtras.ts
@@ -17,6 +17,16 @@ export function mediaCommand(ws: EventWorkspace, key: 'default_gallery' | 'defau
   return same(before, clean) ? null : upsertCommand({ name: ws.series.name, [key]: clean });
 }
 
+/** Photo order and cover: ONE upsert carrying whichever of cover and gallery changed; null when neither did. */
+export function photosCommand(ws: EventWorkspace, cover: string, next: string[]): OwnerCommand | null {
+  const clean = next.map((v) => v.trim()).filter(Boolean);
+  const nextCover = cover.trim();
+  const payload: Record<string, unknown> = { name: ws.series.name };
+  if (nextCover !== (ws.series.default_cover_image_url ?? '')) payload.default_cover_image_url = nextCover;
+  if (!same(ws.gallery, clean)) payload.default_gallery = clean;
+  return Object.keys(payload).length === 1 ? null : upsertCommand(payload);
+}
+
 export const countLabel = (n: number, one: string, many: string) => (n ? `${n} ${n === 1 ? one : many}` : 'Add');
 
 // ---- C14 the usual end --------------------------------------------------------------
-- 
2.53.0.windows.1

```
