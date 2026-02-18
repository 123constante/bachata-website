import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { DancerProfileGrid } from "@/components/profile/DancerProfileGrid";
import {
  mapDancerPublicProfile,
  type DancerPublicRecord,
} from "@/modules/profile/dancerPublicProfile";

const DancerProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [dancer, setDancer] = useState<DancerPublicRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDancer = async () => {
      if (!id) return;

      try {
        const { data, error } = await supabase
          .from("dancers")
          .select("id, first_name, surname, city, nationality, years_dancing, dancing_start_date, favorite_styles, partner_role, looking_for_partner, instagram, facebook, photo_url, hide_surname, website, achievements, favorite_songs, partner_search_role, partner_search_level, partner_practice_goals, partner_details, is_public, email, verified, festival_plans")
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          setError("Dancer not found.");
          return;
        }
        setDancer(data as DancerPublicRecord);
      } catch (err: any) {
        setError(err.message || "Failed to load dancer profile");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDancer();
  }, [id]);

  const dancerView = dancer ? mapDancerPublicProfile(dancer) : null;

  if (isLoading) {
    return (
      <div className="min-h-screen pb-24 pt-32">
        <div className="container max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-[minmax(160px,auto)]">
            <Skeleton className="col-span-2 row-span-2 h-full rounded-xl" />
            <Skeleton className="col-span-1 row-span-1 h-full rounded-xl" />
            <Skeleton className="col-span-1 row-span-1 h-full rounded-xl" />
            <Skeleton className="col-span-2 row-span-1 h-full rounded-xl" />
            <Skeleton className="col-span-1 row-span-1 h-full rounded-xl" />
            <Skeleton className="col-span-1 row-span-1 h-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !dancer || !dancerView) {
    return (
      <div className="min-h-screen pb-24 pt-32">
        <div className="container max-w-4xl mx-auto px-4 text-center">
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
          <p className="text-muted-foreground mb-6">
            The profile you're looking for doesn't exist or has been removed.
          </p>
          <Button onClick={() => navigate("/dancers")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dancers
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 pt-20">
      <PageBreadcrumb items={[
        { label: 'Dancers', path: '/dancers' },
        { label: dancerView.displayName }
      ]} />
      
      <div className="container max-w-5xl mx-auto px-4 pt-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/dancers")}
          className="mb-6 hover:bg-primary/10 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dancers
        </Button>

        <DancerProfileGrid dancer={dancerView} />
      </div>
    </div>
  );
};

export default DancerProfile;


