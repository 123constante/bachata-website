import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { fetchOwnOrganiserEntity, organiserEntityQueryKey, ownOrganiserEntityQueryKey } from '@/modules/profile/organiserPublicProfile';
import { ORGANISER_HOME_KEY } from '@/modules/organiser/shared/selfServeApi';
import { organiserContactSettingsQueryKey } from '@/modules/organiser/shared/ownershipApi';
import type { EipBridge } from '../edit-in-place/bridge';
import { goDone } from '../flows/doneState';
import { useOrganiserChoice } from '../switch/useOrganiserChoice';
import type { ProfileEntity } from './profileForm';

// The owner's edit layer (its own chunk, as on the public page). It brings the
// sheets, the photo upload and the ONE Save; this screen only places its slots.
const EditInPlaceLayer = lazyWithRetry(() => import('../edit-in-place/EditInPlaceLayer'));

const DOCK_ABOVE_SHELL = '[data-testid="eip-dock"]{z-index:60 !important}';

const json = (v: unknown) => JSON.stringify(v ?? null);

/**
 * The layer saves by writing the stored row (and the private contact read) into
 * the query cache. A write that CHANGES what is cached is a save: go to Done
 * (D29). A refetch that returns the same data (a window refocus after the photo
 * picker) changes nothing and is ignored.
 */
function useSavedSignal(keys: ReadonlyArray<readonly unknown[]>, onSaved: () => void) {
  const queryClient = useQueryClient();
  const onSavedRef = useRef(onSaved);
  useEffect(() => { onSavedRef.current = onSaved; });
  const seen = useRef(new Map<string, string>());
  const signature = JSON.stringify(keys);
  useEffect(() => {
    const watched = new Set((JSON.parse(signature) as unknown[][]).map((k) => JSON.stringify(k)));
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

  useSavedSignal(
    id ? [organiserEntityQueryKey(id), organiserContactSettingsQueryKey(id, user?.id)] : [],
    () => {
      void queryClient.invalidateQueries({ queryKey: ownOrganiserEntityQueryKey(id) });
      void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
      // After the layer has cleared its drafts (it does so right after writing the cache), or its
      // leave guard would still see unsaved changes and stop this very navigation.
      window.setTimeout(() => goDone(navigate, { title: 'Saved', message: 'Saved', seriesId: null }), 0);
    },
  );

  const layer: ReactNode = id && entity.data ? (
    <Suspense fallback={null}>
      {/* The layer's Save bar is portalled to <body> at z-50; the organiser shell is z-60 and would
          cover it. Later in the DOM wins a tie, and the sheets (61) stay above both. */}
      <style>{DOCK_ABOVE_SHELL}</style>
      <EditInPlaceLayer key={id} organiserId={id} entity={entity.data as ProfileEntity} userId={user?.id} onBridge={onBridge} />
    </Suspense>
  ) : null;

  return { user, home, organisers, selected, choose, entity, bridge, layer };
}
