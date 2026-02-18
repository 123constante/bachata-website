import { useState } from "react";
import { motion } from "framer-motion";
import PageHero from "@/components/PageHero";
import { Camera, Play, Film, Youtube, Instagram, Star, Video, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const VIDEO_CATEGORIES = [
  { id: 'socials', label: 'Social Demos', icon: Camera },
  { id: 'performances', label: 'Stage Shows', icon: Star },
  { id: 'promos', label: 'Event Promos', icon: Film },
  { id: 'reels', label: 'Short Form', icon: Instagram },
];

const VIDEOGRAPHERS = [
  {
    id: 1,
    name: "Kiko & Christina Visuals",
    specialty: "Cinematic Socials",
    location: "Madrid, Spain",
    image: "https://images.unsplash.com/photo-1574701148212-8518049c7b2c?auto=format&fit=crop&q=80&w=800",
    price: "â‚¬â‚¬â‚¬",
    verified: true,
    tags: ["4K", "Drone", "Slow Mo"]
  },
  {
    id: 2,
    name: "BachataTV",
    specialty: "Congress Coverage",
    location: "Milan, Italy",
    image: "https://images.unsplash.com/photo-1536240478700-b869070f9279?auto=format&fit=crop&q=80&w=800",
    price: "â‚¬â‚¬",
    verified: true,
    tags: ["Live Stream", "Official"]
  },
  {
    id: 3,
    name: "Dance Reels NYC",
    specialty: "Short Form Content",
    location: "New York, USA",
    image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=800",
    price: "â‚¬â‚¬",
    verified: false,
    tags: ["Vertical", "Viral"]
  }
];

const Videographers = () => {
  const [activeCategory, setActiveCategory] = useState('socials');
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <PageHero 
        titleWhite="Media"
        titleOrange="Production"
        subtitle="Book the best eyes in the industry. Your movement deserves to be captured in cinema quality."
        emoji="¥"
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

        {/* Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {VIDEOGRAPHERS.map((video) => (
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
                  src={video.image} 
                  alt={video.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                   <div>
                      <div className="text-white font-bold text-lg">{video.name}</div>
                      <div className="text-blue-300 text-sm">{video.specialty}</div>
                   </div>
                   <div className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-white border border-white/20">
                     {video.price}
                   </div>
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
                    {video.tags.map(tag => (
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

      </div>
    </div>
  );
};

export default Videographers;


