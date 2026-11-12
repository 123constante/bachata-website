// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { makeCover, moveBlock, movePhoto, photoList } from '../photoOrder';
import { photosCommand } from '../seriesExtras';
import { PhotoOrderBody } from '../PhotoOrderBody';
import type { EventDraft } from '../eventModel';

const C = 'c.jpg', A = 'a.jpg', B = 'b.jpg';

describe('photoOrder (table)', () => {
  it.each([
    ['cover first, then gallery', { coverUrl: C, gallery: [A, B] }, [C, A, B]],
    ['gallery copy of the cover is not listed twice', { coverUrl: C, gallery: [A, C] }, [C, A]],
    ['no cover: gallery as is', { coverUrl: '', gallery: [A, B] }, [A, B]],
    ['empty', { coverUrl: '', gallery: [] }, []],
  ])('photoList: %s', (_n, s, want) => expect(photoList(s)).toEqual(want));

  it.each([
    ['move photo 2 left makes it the cover', { coverUrl: C, gallery: [A, B] }, A, -1, { coverUrl: A, gallery: [C, B] }],
    ['move cover right: photo 2 becomes cover', { coverUrl: C, gallery: [A, B] }, C, 1, { coverUrl: A, gallery: [C, B] }],
    ['move last right is a no-op', { coverUrl: C, gallery: [A, B] }, B, 1, { coverUrl: C, gallery: [A, B] }],
    ['no cover: swap inside the gallery', { coverUrl: '', gallery: [A, B] }, B, -1, { coverUrl: '', gallery: [B, A] }],
  ])('movePhoto: %s', (_n, s, url, dir, want) => expect(movePhoto(s, url, dir as -1 | 1)).toEqual(want));

  it('makeCover: old cover becomes photo 2; with no cover the photo leaves the gallery', () => {
    expect(makeCover({ coverUrl: C, gallery: [A, B] }, B)).toEqual({ coverUrl: B, gallery: [C, A] });
    expect(makeCover({ coverUrl: '', gallery: [A, B] }, B)).toEqual({ coverUrl: B, gallery: [A] });
    expect(makeCover({ coverUrl: C, gallery: [A] }, 'zz')).toEqual({ coverUrl: C, gallery: [A] });
  });

  it('moveBlock says why', () => {
    const s = { coverUrl: C, gallery: [A] };
    expect(moveBlock(s, C, -1)).toBe('Already first');
    expect(moveBlock(s, A, 1)).toBe('Already last');
    expect(moveBlock(s, A, -1)).toBeNull();
  });
});

describe('photosCommand', () => {
  const ws = { series: { name: 'Fri', default_cover_image_url: C }, gallery: [A, B] } as never;
  it('untouched sends nothing', () => expect(photosCommand(ws, C, [A, B])).toBeNull());
  it('reorder only sends the gallery', () => expect(photosCommand(ws, C, [B, A])?.payload).toEqual({ name: 'Fri', default_gallery: [B, A] }));
  it('new cover sends both in ONE upsert', () =>
    expect(photosCommand(ws, A, [C, B])?.payload).toEqual({ name: 'Fri', default_cover_image_url: A, default_gallery: [C, B] }));
});

function Harness({ start }: { start: Partial<EventDraft> }) {
  const [d, setD] = useState({ coverUrl: C, gallery: [A, B], ...start } as EventDraft);
  return (
    <>
      <PhotoOrderBody draft={d} patch={(p) => setD((x) => ({ ...x, ...p }))} fileRef={{ current: null }} onPick={() => {}} uploading={false} uploadError={null} />
      <output data-testid="out">{JSON.stringify([d.coverUrl, d.gallery])}</output>
    </>
  );
}
afterEach(cleanup);
const out = () => screen.getByTestId('out').textContent;

describe('PhotoOrderBody', () => {
  it('shows one Cover badge and no bar until a photo is tapped', () => {
    render(<Harness start={{}} />);
    expect(screen.getAllByTestId('org-gallery-cover-badge')).toHaveLength(1);
    expect(screen.queryByTestId('org-gallery-bar')).toBeNull();
  });
  it('Make cover on photo 3: old cover becomes photo 2', () => {
    render(<Harness start={{}} />);
    fireEvent.click(screen.getAllByTestId('org-gallery-tile')[2]);
    fireEvent.click(screen.getByTestId('org-gallery-cover'));
    expect(out()).toBe(JSON.stringify([B, [C, A]]));
  });
  it('Move left / right reorder; first cannot move left and says why', () => {
    render(<Harness start={{}} />);
    fireEvent.click(screen.getAllByTestId('org-gallery-tile')[0]);
    const left = screen.getByTestId('org-gallery-left') as HTMLButtonElement;
    expect(left.disabled).toBe(true);
    expect(left.title).toBe('Already first');
    fireEvent.click(screen.getByTestId('org-gallery-right'));
    expect(out()).toBe(JSON.stringify([A, [C, B]]));
  });
  it('Remove drops a gallery photo; the cover has no Remove', () => {
    render(<Harness start={{}} />);
    fireEvent.click(screen.getAllByTestId('org-gallery-tile')[0]);
    expect(screen.queryByTestId('org-gallery-remove')).toBeNull();
    fireEvent.click(screen.getAllByTestId('org-gallery-tile')[1]);
    fireEvent.click(screen.getByTestId('org-gallery-remove'));
    expect(out()).toBe(JSON.stringify([C, [B]]));
  });
  it('empty state says what to do', () => {
    render(<Harness start={{ coverUrl: '', gallery: [] }} />);
    expect(screen.getByText(/No photos yet/)).toBeTruthy();
  });
});
