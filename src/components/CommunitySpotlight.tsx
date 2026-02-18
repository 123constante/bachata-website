
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion } from "framer-motion";
import { buildFullName, getInitials } from "@/lib/name-utils";

interface Dancer {
  id: string;
  first_name: string;
  surname: string | null;
  photo_url: string | null;
}

export const CommunitySpotlight = () => {
  const [dancers, setDancers] = useState<Dancer[]>([]);

  useEffect(() => {
    const fetchDancers = async () => {
      const { data } = await supabase
        .from('dancers')
        .select('id, first_name, surname, photo_url')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (data) setDancers(data);
    };

    fetchDancers();
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
              <AvatarImage src={dancer.photo_url || ''} alt={buildFullName(dancer.first_name, dancer.surname)} />
              <AvatarFallback className="bg-green-100 text-green-700 text-[10px]">
                {getInitials(dancer)}
              </AvatarFallback>
            </Avatar>
          </motion.div>
        ))}
        {dancers.length === 0 && (
           <div className="flex -space-x-2">
             {[1,2,3].map(i => (
               <div key={i} className="w-9 h-9 rounded-full bg-muted border-2 border-background animate-pulse" />
             ))}
           </div>
        )}
      </div>
      <div className="flex flex-col animate-fade-in">
        <span className="text-sm font-medium text-foreground">
          {dancers.length > 0 ? "2,600+" : "Loading..."}
        </span>
        <span className="text-[10px] text-muted-foreground">active dancers</span>
      </div>
    </div>
  );
};
