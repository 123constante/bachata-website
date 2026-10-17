import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { fetchOwnOrganiserEntity, organiserEntityQueryKey, ownOrganiserEntityQueryKey } from '@/modules/profile/organiserPublicProfile';
import { ORGANISER_HOME_KEY } from '@/modules/organiser/shared/selfServeApi';
import { organiserContactSettingsQueryKey } from '@/modules/organiser/shared/ownershipApi';
import type { EipBridge } from '../edit-in-place/bridge';
import { FIELD_KEYS } from '../edit-in-place/fieldRules';
import { goDone } from '../flows/doneState';
import { useOrganiserChoice } from '../switch/useOrganiserChoice';
import type { ProfileEntity } from './profileForm';

// The owner's edit layer (its own chunk, as on the public page). It brings the
// sheets, the photo upload and the ONE Save; this screen only places its slots.
const EditInPlaceLayer = lazyWithRetry(() => import('../edit-in-place/EditInPlaceLayer'));

/** The organiser shell is z-60; the Save dock sits on it (later in the DOM wins the tie), the sheets (61) above both. */
const DOCK_Z = 60;

const json = (v: unknown) => JSON.stringify(v ?? null);

/** Any draft at all, the contact ones included (the overlay leaves those out). */
const hasDrafts = (b: EipBridge | null) => !!b && FIELD_KEYS.some((f) => b.mark(f) !== undefined);

/**
 * The layer saves by writing the stored row (and the private contact read) into
 * the query cache. A write that CHANGES what is cached is a save: go to Done
 * (D29). A refetch that returns the same data (a window refocus after the photo
 * picker) changes nothing and is ignored. `seeded` keys start from what is
 * already cached: the contact read is fresh for 60 s, so a quick return makes
 * no load event and the save's own write would otherwise pass for the load.
 * (A stale entry's mount refetch may differ from it; that write holds no drafts,
 * so useOwnPage does not take it for a save.)
 */
function useSavedSignal(keys: ReadonlyArray<readonly unknown[]>, seeded: ReadonlyArray<readonly unknown[]>, onSaved: () => void) {
  const queryClient = useQueryClient();
  const onSavedRef = useRef(onSaved);
  useEffect(() => { onSavedRef.current = onSaved; });
  const seen = useRef(new Map<string, string>());
  const signature = JSON.stringify([keys, seeded]);
  useEffect(() => {
    const [all, seed] = JSON.parse(signature) as [unknown[][], unknown[][]];
    const watched = new Set(all.map((k) => JSON.stringify(k)));
    for (const k of seed) {
      const cached = queryClient.getQueryData(k);
      if (cached !== undefined && !seen.current.has(JSON.stringify(k))) seen.current.set(JSON.stringify(k), json(cached));
    }
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'success') return;
      const key = JSON.stringify(event.query.queryKey);
      if (!watched.has(key)) return;
      const now = json(event.query.state.data);
      const before = seen.current.get(key);
      seen.current.set(key, now);
      // The first value of a key is a load, not a save.
      if (before !== undefined && before !== now) onSavedRef.current();
    });
  }, [queryClient, signature]);
}

/**
 * What /page and /more share: which page is shown, its own row (draft or not,
 * RLS decides), and the edit layer mounted for it. `bridge.slot(where)` is the
 * existing tap-to-edit control for one place; the layer's Save bar and sheets
 * come with it. A save lands on Done "Saved".
 */
export function useOwnPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, home, organisers, selected, choose } = useOrganiserChoice();
  const [bridge, setBridge] = useState<EipBridge | null>(null);
  const onBridge = useCallback((b: EipBridge | null) => setBridge(b), []);
  const id = selected?.id;
  // One save writes two watched keys (the row, then the contact read): one trip to Done.
  // `pending` holds the bridge seen at the save; the decision waits for the next one.
  const pending = useRef<{ bridge: EipBridge | null } | null>(null);
  const bridgeRef = useRef(bridge);
  useEffect(() => { bridgeRef.current = bridge; });

  const entity = useQuery({
    queryKey: ownOrganiserEntityQueryKey(id),
    queryFn: () => fetchOwnOrganiserEntity(id!),
    enabled: !!id,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // The layer writes its saved row into the public entity key; that entry must exist for it to.
  useEffect(() => {
    if (id && entity.data) queryClient.setQueryData(organiserEntityQueryKey(id), entity.data);
  }, [queryClient, id, entity.data]);

  const contactKey = organiserContactSettingsQueryKey(id, user?.id);
  useSavedSignal(
    id ? [organiserEntityQueryKey(id), contactKey] : [],
    id ? [contactKey] : [],
    () => {
      void queryClient.invalidateQueries({ queryKey: ownOrganiserEntityQueryKey(id) });
      void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
      // A save always holds drafts when it writes; a write with none is a refetch, not a save.
      if (!pending.current && hasDrafts(bridgeRef.current)) pending.current = { bridge: bridgeRef.current };
    },
  );

  // The layer clears its drafts right after writing the cache, and hands a new bridge.
  // Drafts left over mean "came back different": stay, so its warning stays on screen.
  useEffect(() => {
    if (!pending.current || bridge === pending.current.bridge) return;
    pending.current = null;
    if (!bridge || hasDrafts(bridge)) return;
    // A tick later, or the layer's leave guard would still see the old drafts.
    window.setTimeout(() => goDone(navigate, { title: 'Saved', message: 'Saved', seriesId: null }), 0);
  }, [bridge, navigate]);

  const layer: ReactNode = id && entity.data ? (
    <Suspense fallback={null}>
      <EditInPlaceLayer key={id} organiserId={id} entity={entity.data as ProfileEntity} userId={user?.id} onBridge={onBridge} dockZ={DOCK_Z} />
    </Suspense>
  ) : null;

  return { user, home, organisers, selected, choose, entity, bridge, layer };
}
