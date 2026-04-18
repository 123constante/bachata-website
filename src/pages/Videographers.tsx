import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import PageLayout from "@/components/PageLayout";
import { Camera, Play, Film, Youtube, Instagram, Star, Video, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

const VIDEO_CATEGORIES = [
  { id: 'socials', label: 'Social Demos', icon: Camera },
  { id: 'performances', label: 'Stage Shows', icon: Star },
  { id: 'promos', label: 'Event Promos', icon: Film },
  { id: 'reels', label: 'Short Form', icon: Instagram },
];

interface Videographer {
  id: string;
  first_name: string | null;
  surname: string | null;
  business_name: string | null;
  photo_url: string | null;
  bio: string | null;
  instagram: string | null;
  website: string | null;
  verified: boolean | null;
  videography_styles: string[] | null;
}

const Videographers = () => {
  const [activeCategory, setActiveCategory] = useState('socials');
  const navigate = useNavigate();

  const { data: videographers = [], isLoading } = useQuery({
    queryKey: ['videographers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('videographers')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Videographer[];
    },
    staleTime: 1000 * 60 * 10,
  });

  return (
    <div className="min-h-screen">
      <PageHero 
        titleWhite="Media"
        titleOrange="Production"
        subtitle="Book the best eyes in the industry. Your movement deserves to be captured in cinema quality."
        emoji="🎥"
        gradientFrom="blue-600"
      />

      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Category Tabs */}
        <div className="flex overflow-x-auto pb-4 gap-2 scrollbar-none mb-8">
          {VIDEO_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 px-6 py-3 rounded-full border transition-all whitespace-nowrap ${
                  isActive 
                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/25' 
                    : 'bg-card border-border hover:border-blue-500/50 text-muted-foreground'
                }`}
              >
                <Icon size={18} />
                <span className="font-medium">{cat.label}</span>
              </button>
            )
          })}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="h-48 w-full rounded-3xl" />
                <Skeleton className="h-20 w-full rounded-lg" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && videographers.length === 0 && (
          <div className="text-center py-16">
            <Video className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Videographers Yet</h3>
            <p className="text-muted-foreground mb-6">Professional videographers will be listed here soon. Check back later!</p>
          </div>
        )}

        {/* Grid */}
        {!isLoading && videographers.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videographers.map((video) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              key={video.id}
              className="group relative bg-card rounded-3xl overflow-hidden border border-border hover:border-blue-500/30 transition-colors"
            >
              {/* Image Aspect Ratio */}
              <div className="aspect-[4/3] overflow-hidden relative">
                <img 
                  src={video.photo_url || 'https://images.unsplash.com/photo-1574701148212-8518049c7b2c?auto=format&fit=crop&q=80&w=800'} 
                  alt={video.business_name || 'Videographer'}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                   <div>
                      <div className="text-white font-bold text-lg">{video.business_name || `${video.first_name || ''} ${video.surname || ''}`.trim()}</div>
                      <div className="text-blue-300 text-sm">{video.bio?.substring(0, 40) || 'Professional videography'}</div>
                   </div>
                   {video.verified && (
                     <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-white border border-white/20">
                       Verified
                     </div>
                   )}
                </div>

                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                    <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-lg transform scale-50 group-hover:scale-100 transition-transform duration-300">
                        <Play fill="white" className="text-white ml-1" />
                    </div>
                </div>
              </div>

              <div className="p-4">
                 <div className="flex flex-wrap gap-2 mb-4">
                    {(video.videography_styles || []).map(tag => (
                        <span key={tag} className="px-2 py-1 bg-secondary text-secondary-foreground text-xs rounded-md font-medium">
                            #{tag}
                        </span>
                    ))}
                 </div>
                 
                 <Button className="w-full gap-2 group-hover:bg-blue-600 hover:text-white" variant="outline">
                    View Portfolio <ArrowRight size={16} />
                 </Button>
              </div>
            </motion.div>
          ))}
        </div>
        )}

      </div>
    </div>
  );
};

export default Videographers;


