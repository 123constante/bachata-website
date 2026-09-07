
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPhotoUrl } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion } from "framer-motion";
import { buildFullName, getInitials } from "@/lib/name-utils";
import { optimizedImageUrl } from '@/lib/imageCdn';
import { captureException } from '@/lib/sentry';

interface Dancer {
  id: string;
  first_name: string;
  surname: string | null;
  avatar_url: string[] | null;
}

// MANUALLY MAINTAINED -- no column backs this number, and nothing in this
// repo can keep it true. It counts the London WhatsApp community, which does
// not live in this database; it was 3,500 when Ricky measured it on
// 2026-09-07. It is stated as a COMMUNITY figure and never as a platform one,
// because dancer_profiles holds two orders of magnitude fewer rows and the
// label must name what the number actually counts.
//
// Be honest about what this is: it is the same SHAPE as the fabricated count
// it replaces -- a literal with no column behind it -- and differs only in
// being true on the day it was written. P7 must either give it an evidence
// source or strike it.
//
// The old figure is deliberately NOT quoted here: it survives into the built
// sourcemap, so a comment carrying the exact literal a fabrication guard
// hunts for would trip that guard from the very code that removed the claim.
const WHATSAPP_COMMUNITY_SIZE = '3,500+';

export const CommunitySpotlight = () => {
  const [dancers, setDancers] = useState<Dancer[]>([]);

  useEffect(() => {
    const fetchDancers = async () => {
      // Same filter as Dancers.tsx:78 -- without it this strip can show a
      // face that /dancers itself does not list.
      const { data, error } = await supabase
        .from('dancer_profiles')
        .select('id, first_name, surname, avatar_url')
        .or('is_active.is.null,is_active.eq.true')
        .order('created_at', { ascending: false })
        .limit(5);

      // supabase's builder RESOLVES with { data, error } rather than
      // rejecting, so the try/catch that used to sit here could never fire --
      // the failure has to be read off the result. Left unread it told Sentry
      // nothing, which is the whole reason this branch exists; the strip just
      // stays empty, so there is no failure state left to track in React.
      if (error) {
        captureException(error, { context: 'CommunitySpotlight.fetchDancers' });
        return;
      }

      setDancers(data ?? []);
    };

    void fetchDancers();
  }, []);

  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="flex -space-x-2">
        {dancers.map((dancer, i) => (
          <motion.div
            key={dancer.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 * i }}
          >
            <Avatar className="w-9 h-9 border-2 border-background ring-2 ring-primary/10">
              <AvatarImage src={optimizedImageUrl(getPhotoUrl(dancer.avatar_url) || '', 96)} alt={buildFullName(dancer.first_name, dancer.surname)} />
              <AvatarFallback className="bg-green-100 text-green-700 text-[10px]">
                {getInitials(dancer)}
              </AvatarFallback>
            </Avatar>
          </motion.div>
        ))}
        {/*
          The pulsing placeholder avatars are GONE rather than fixed. They were
          shown whenever `dancers` was empty, which conflates three different
          states -- still fetching, fetched nothing, and fetch failed -- so two
          of them pulsed for ever, promising faces that were never coming. The
          strip simply renders whatever avatars it has, and nothing when it has
          none.
        */}
      </div>
      <div className="flex flex-col animate-fade-in">
        <span className="text-sm font-medium text-foreground">
          {WHATSAPP_COMMUNITY_SIZE}
        </span>
        <span className="text-[10px] text-muted-foreground">dancers in the London WhatsApp community</span>
      </div>
    </div>
  );
};
