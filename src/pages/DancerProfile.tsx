import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Image } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import GlobalLayout from "@/components/layout/GlobalLayout";
import { useEntitySlugOrId, useCanonicalReplaceState } from '@/lib/seo';
import { DancerProfileGrid } from "@/components/profile/DancerProfileGrid";
import {
  DANCER_PUBLIC_COLS,
  attachPublicDancerName,
  mapDancerPublicProfile,
  type DancerPublicQueryRecord,
  type DancerPublicRecord,
} from "@/modules/profile/dancerPublicProfile";
import { NOT_DEACTIVATED } from "@/lib/notDeactivatedFilter";
import { useQuery } from "@tanstack/react-query";
import { useEmbeddedProfile } from "@/lib/embeddedProfile";
import { AlsoRoles } from "@/modules/person-page/AlsoRoles";
import { flags } from "@/lib/featureFlags";
import { DancerRoleBar } from "@/modules/dancer-app/public-page/DancerRoleBar";
import { useDancerRoleBar } from "@/modules/dancer-app/public-page/roleBarModel";
import { PublicDancerPageV2 } from "@/modules/dancer-app/public-page/PublicDancerPageV2";
import { buildPublicDancerPage, type PublicPageV2Data } from "@/modules/dancer-app/public-page/model";

type DancerProfileProps = {
  /** From the route loader: v2 when the dancer area is open, else null/absent = today's page. */
  publicPage?: PublicPageV2Data | null;
  /** The Dancing tab of /people/:id: v2 renders embedded (no Back, photo, name). Absent = today's page. */
  embedded?: boolean;
};

const DancerProfile = ({ publicPage = null, embedded: embeddedProp = false }: DancerProfileProps = {}) => {
  const embeddedCtx = useEmbeddedProfile();
  const embedded = embeddedProp || embeddedCtx;
  const { id: routeParam } = useParams<{ id: string }>();
  const resolved = useEntitySlugOrId(routeParam, 'dancer_profiles');
  const id = resolved.id ?? undefined;
  // flags.personHub: the role bar shows "Back to <name>"; while it is on screen the public page
  // drops its own Back (one Back, never two). Null with the flag OFF, embedded, or off the public page.
  const roleBar = useDancerRoleBar(id, resolved.slug, embedded || !publicPage);
  useCanonicalReplaceState({
    arrivedViaUuid: resolved.arrivedViaUuid,
    slug: resolved.slug,
    buildPath: (s) => `/dancers/${s}`,
  });
  const navigate = useNavigate();
  const { data: dancer, isLoading, error: dancerError } = useQuery({
    queryKey: ["dancer-profile", id],
    queryFn: async () => {
      if (!id) throw new Error("Dancer ID required");
      // Same query body as app/routes/dancers.tsx's loader, which dehydrates
      // this exact ["dancer-profile", id] cache entry -- must match or SSR
      // hydration and this client fetch disagree on what "found" means.
      const { data, error } = await supabase
        .from("dancer_profiles")
        .select(DANCER_PUBLIC_COLS)
        .eq("id", id)
        .not(...NOT_DEACTIVATED)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Dancer not found.");
      return (await attachPublicDancerName(data)) as unknown as DancerPublicQueryRecord;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
  const dancerView = dancer ? mapDancerPublicProfile(dancer) : null;
  // No useSeo() here: DancerProfile renders only under app/routes/dancers.tsx,
  // which wraps in InitialVisiblePageTransition and so sets RouteOwnsHeadContext --
  // useSeo returns before touching the head. That route's loader + meta() own it,
  // building the same buildSeoForRoute('dancer.detail', ...) input from the row it
  // already fetched. Which useSeo calls are inert and which are live is a census,
  // not a rule of thumb -- see BentoPage.tsx before deleting another (arc W22).

  const error = dancerError ? (dancerError as Error).message || "Failed to load dancer profile" : null;
  if (isLoading) {
    return (
      <GlobalLayout
        showSubheader={false}
        backHref="/dancers"
      >
        <div className="container max-w-4xl mx-auto px-4 pb-24">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-[minmax(160px,auto)]">
            <Skeleton className="col-span-2 row-span-2 h-full rounded-xl" />
            <Skeleton className="col-span-1 row-span-1 h-full rounded-xl" />
            <Skeleton className="col-span-1 row-span-1 h-full rounded-xl" />
            <Skeleton className="col-span-2 row-span-1 h-full rounded-xl" />
            <Skeleton className="col-span-1 row-span-1 h-full rounded-xl" />
            <Skeleton className="col-span-1 row-span-1 h-full rounded-xl" />
          </div>
        </div>
      </GlobalLayout>
    );
  }

  if (error || !dancer || !dancerView) {
    if (dancerError) console.error('DancerProfile error:', dancerError);
    return (
      <GlobalLayout
        showSubheader={false}
        backHref="/dancers"
        hero={{
          emoji: '',
          titleWhite: 'Dancer',
          titleOrange: 'not found',
          largeTitle: true,
        }}
      >
        <div className="container max-w-4xl mx-auto px-4 pb-24 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-6xl mb-4"
          >
            👾
          </motion.div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {error || "Dancer not found"}
          </h1>
          {id && <p className="text-xs text-muted-foreground mb-4">ID: {id}</p>}
          <p className="text-muted-foreground mb-6">
            The profile you're looking for doesn't exist or has been removed.
          </p>
          <Button onClick={() => navigate("/dancers")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dancers
          </Button>
        </div>
      </GlobalLayout>
    );
  }

  if (publicPage) {
    const gallery = (dancer as { gallery_urls?: unknown }).gallery_urls;
    const galleryList: unknown[] = Array.isArray(gallery) ? gallery : [];
    return (
      <GlobalLayout showSubheader={false} backHref="/dancers" gradientPalette="dancer">
        <div className={`container max-w-xl mx-auto px-4 pt-3${embedded ? '' : ' pb-24'}`}>
          {flags.personHub
            ? roleBar && <DancerRoleBar model={roleBar} className="-mx-4 px-4" />
            : <AlsoRoles current="dancer" id={id} slug={resolved.slug} className="pb-2" />}
          <PublicDancerPageV2
            model={buildPublicDancerPage(dancerView, publicPage.extras, galleryList)}
            extrasOk={publicPage.extrasOk}
            profileId={dancerView.id}
            pathname={resolved.slug ? `/dancers/${resolved.slug}` : `/dancers/${routeParam ?? dancerView.id}`}
            embedded={embedded}
            back={!roleBar}
          />
        </div>
      </GlobalLayout>
    );
  }

  const dancerSubtitle = [dancer.cities?.name, dancer.nationality].filter(Boolean).join(' \u00b7 ');

  return (
    <GlobalLayout
      showSubheader={false}
      backHref="/dancers"
      hero={{
        emoji: '',
        // Empty, not "Dancer": the hero already prints "Dancer" as titleOrange,
        // so a nameless profile reads "Dancer" once rather than twice -- and the
        // page's SUBJECT stays unclaimed, which is what the noindex on this same
        // resolution (app/routes/dancers.tsx) is asserting to a crawler.
        titleWhite: dancerView.displayName ?? '',
        titleOrange: 'Dancer',
        subtitle: dancerSubtitle,
        largeTitle: true,
      }}
    >
      <div className="container max-w-5xl mx-auto px-4 pb-24 pt-8">
        <AlsoRoles current="dancer" id={id} slug={resolved.slug} />
        <DancerProfileGrid dancer={dancerView} />

        {/* Gallery */}
        {(() => {
          const gallery = Array.isArray((dancer as any)?.gallery_urls)
            ? ((dancer as any).gallery_urls as string[]).filter(Boolean)
            : [];
          if (!gallery.length) return null;
          return (
            <div className="mt-8">
              <h2 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                <Image className="w-5 h-5 text-primary" /> Gallery
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {gallery.slice(0, 12).map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={url}
                      alt={`${dancerView.displayName ?? 'Dancer'} photo ${i + 1}`}
                      className="w-full aspect-square object-cover rounded-xl hover:opacity-80 transition-opacity"
                      loading="lazy"
                    />
                  </a>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </GlobalLayout>
  );
};

export default DancerProfile;

