import { describe, expect, it } from 'vitest';
import { DANCER_SHAPES } from '../../../api/fixtures';
import type { MyDancerEdit } from '../../../api/types';
import { PhotoFlowError, replacePhoto, type PhotoFlowDeps } from '../photoFlow';

const withPhoto = DANCER_SHAPES.fourFieldComplete.profile as MyDancerEdit;
const photoless = DANCER_SHAPES.nameCityOnly.profile as MyDancerEdit;
const NEW = 'https://img.example/new.jpg';
const blob = new Blob(['x'], { type: 'image/jpeg' });

const rig = (over: Partial<PhotoFlowDeps> = {}) => {
  const order: string[] = [];
  const saved: unknown[] = [];
  const deps: PhotoFlowDeps = {
    upload: async () => { order.push('upload'); return NEW; },
    save: async (url, current) => { order.push('save'); saved.push({ avatar_url: url }); return { ...current, avatar_url: url }; },
    deleteOld: async () => { order.push('delete'); },
    log: () => { order.push('log'); },
    ...over,
  };
  return { deps, order, saved };
};

describe('replacePhoto', () => {
  it('replacing: upload -> save -> delete the OLD object, in that order', async () => {
    const { deps, order, saved } = rig();
    const r = await replacePhoto({ blob, current: withPhoto }, deps);
    expect(order).toEqual(['upload', 'save', 'delete']);
    expect(saved).toEqual([{ avatar_url: NEW }]);
    expect(r.profile.avatar_url).toBe(NEW);
  });

  it('first photo: upload -> save, nothing to delete', async () => {
    const { deps, order } = rig();
    await replacePhoto({ blob, current: photoless }, deps);
    expect(order).toEqual(['upload', 'save']);
  });

  it('deletes the previous URL, never the new one', async () => {
    const deleted: string[] = [];
    const { deps } = rig({ deleteOld: async (u) => { deleted.push(u); } });
    await replacePhoto({ blob, current: withPhoto }, deps);
    expect(deleted).toEqual([withPhoto.avatar_url]);
  });

  it('never deletes when the save fails (the person keeps the photo they had)', async () => {
    const { deps, order } = rig({ save: async () => { throw new Error('boom'); } });
    await expect(replacePhoto({ blob, current: withPhoto }, deps)).rejects.toMatchObject({ stage: 'save', uploadedUrl: NEW });
    expect(order).toEqual(['upload']);
  });

  it('upload failure: nothing saved, nothing deleted, stage = upload', async () => {
    const { deps, order } = rig({ upload: async () => { throw new Error('net'); } });
    const err = await replacePhoto({ blob, current: withPhoto }, deps).catch((e) => e);
    expect(err).toBeInstanceOf(PhotoFlowError);
    expect(err.stage).toBe('upload');
    expect(order).toEqual([]);
  });

  it('retry after a failed save reuses the uploaded URL (no second upload)', async () => {
    const { deps, order } = rig();
    await replacePhoto({ blob, current: withPhoto, uploadedUrl: NEW }, deps);
    expect(order).toEqual(['save', 'delete']);
  });

  it('a failed delete is logged and swallowed; the result is still the saved profile', async () => {
    const { deps, order } = rig({ deleteOld: async () => { throw new Error('not_owner'); } });
    const r = await replacePhoto({ blob, current: withPhoto }, deps);
    expect(r.profile.avatar_url).toBe(NEW);
    expect(order).toEqual(['upload', 'save', 'log']);
  });

  it('does not delete when the new URL equals the old one', async () => {
    const { deps, order } = rig({ upload: async () => withPhoto.avatar_url as string });
    await replacePhoto({ blob, current: withPhoto }, deps);
    expect(order).toEqual(['save']);
  });
});

describe('realPhotoDeps.save sends the one replace-only key', () => {
  it('avatar_url = the new URL, never null, nothing else', async () => {
    const { createFakeBackend } = await import('../../../api/fakeBackend');
    const { setFakeBackend } = await import('../../../api/rpc');
    const { realPhotoDeps } = await import('../photoFlow');
    const backend = createFakeBackend({ shape: 'fourFieldComplete' });
    setFakeBackend(backend);
    try {
      await realPhotoDeps.save(NEW, withPhoto);
      const sent = backend.calls.find((c) => c.fn === 'saveMyDancerProfile');
      expect(sent?.args).toEqual({ avatar_url: NEW });
      expect(backend.current()?.avatar_url).toBe(NEW);
    } finally {
      setFakeBackend(null);
    }
  });
});
