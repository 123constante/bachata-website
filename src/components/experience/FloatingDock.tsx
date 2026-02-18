import { motion } from "framer-motion";
import { Plane, Camera, Music, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type TabId = 'travel' | 'media' | 'stage';

interface FloatingDockProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export const FloatingDock = ({ activeTab, onTabChange }: FloatingDockProps) => {
  const tabs = [
    { id: 'travel', label: 'Travel', icon: Plane, color: 'text-orange-500', bg: 'bg-orange-500' },
    { id: 'media', label: 'Media', icon: Camera, color: 'text-blue-500', bg: 'bg-blue-500' },
    { id: 'stage', label: 'Training', icon: Music, color: 'text-purple-500', bg: 'bg-purple-500' },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-2 p-2 rounded-full bg-black/40 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/50">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id as TabId)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-3 rounded-full transition-all duration-500 ease-out group overflow-hidden",
                isActive ? "bg-white/10" : "hover:bg-white/5"
              )}
            >
              {/* Active Background Glow */}
              {isActive && (
                <motion.div
                  layoutId="activeTabGlow"
                  className={cn("absolute inset-0 opacity-20", tab.bg)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.2 }}
                  exit={{ opacity: 0 }}
                />
              )}

              {/* Icon */}
              <Icon 
                size={20} 
                className={cn(
                    "relative z-10 transition-colors duration-300", 
                    isActive ? tab.color : "text-white/60 group-hover:text-white"
                )} 
              />
              
              {/* Label (Only visible when active for cleanliness, or always? Let's keep it clean) */}
              {/* Option C usually implies minimalist dock. Let's show label on active or hover? Let's Active Only for maximizing space */}
              <span className={cn(
                  "relative z-10 text-sm font-bold tracking-wide transition-all duration-500 overflow-hidden whitespace-nowrap",
                  isActive ? "w-auto opacity-100 ml-1" : "w-0 opacity-0"
              )}>
                {tab.label}
              </span>
              
              {/* Active Bottom Indicator */}
               {isActive && (
                <motion.div
                    layoutId="activeTabIndicator"
                    className={cn("absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full mb-1", tab.bg)}
                />
               )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
