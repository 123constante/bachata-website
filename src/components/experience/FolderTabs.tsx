import { motion } from "framer-motion";
import { Plane, Camera, Music, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type TabId = 'travel' | 'media' | 'stage';

interface TabConfig {
  id: TabId;
  label: string;
  icon: LucideIcon;
  color: string;
  stroke: string;
}

interface FolderTabsProps {
  activeTab: TabId;
  onTabChange: (id: TabId) => void;
}

const TABS: TabConfig[] = [
  { id: 'travel', label: 'Travel', icon: Plane, color: 'text-orange-500', stroke: 'stroke-orange-500/30' },
  { id: 'media', label: 'Cinema', icon: Camera, color: 'text-blue-500', stroke: 'stroke-blue-500/30' },
  { id: 'stage', label: 'Training', icon: Music, color: 'text-purple-500', stroke: 'stroke-purple-500/30' },
];

export const FolderTabs = ({ activeTab, onTabChange }: FolderTabsProps) => {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 relative z-30">
        <div className="flex items-end -mb-[1px] pl-2"> 
            {TABS.map((tab, index) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                
                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={cn(
                            "relative h-12 flex items-center justify-center min-w-[140px] px-8 transition-all duration-300 group focus:outline-none",
                            isActive ? "z-20" : "z-10 hover:z-15"
                        )}
                        style={{
                            marginLeft: index === 0 ? 0 : '4px' 
                        }}
                    >
                        {/* Tab Background & Shape */}
                        <div className="absolute inset-0 w-full h-full drop-shadow-md">
                           <svg className="w-full h-full" viewBox="0 0 148 44" preserveAspectRatio="none">
                               <defs>
                                   <linearGradient id={`tabGrad-${tab.id}`} x1="0" y1="0" x2="0" y2="1">
                                       <stop offset="0%" stopColor="rgba(255,255,255,0.05)" />
                                       <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                                   </linearGradient>
                               </defs>
                               
                               {/* Fill Path */}
                               <path 
                                 d="M0,44 L12,4 C14,0 18,0 22,0 L126,0 C130,0 134,0 136,4 L148,44 Z" 
                                 className={cn(
                                     "transition-all duration-300 ease-out",
                                     isActive 
                                       ? "fill-black/90" // High opacity to verify visibility vs line
                                       : "fill-black/40 hover:fill-black/60"
                                 )}
                               />

                               {/* Gradient Overlay for texture */}
                               <path 
                                 d="M0,44 L12,4 C14,0 18,0 22,0 L126,0 C130,0 134,0 136,4 L148,44 Z" 
                                 fill={`url(#tabGrad-${tab.id})`}
                                 className="opacity-50"
                               />

                               {/* Stroke Path (Open Bottom) */}
                               <path 
                                 d="M0,44 L12,4 C14,0 18,0 22,0 L126,0 C130,0 134,0 136,4 L148,44"
                                 fill="none"
                                 className={cn(
                                     "transition-all duration-300",
                                     isActive 
                                       ? cn(tab.stroke, "stroke-[1.5px]") 
                                       : "stroke-white/10 stroke-[1px]"
                                 )}
                               />
                           </svg>
                        </div>

                        {/* Content */}
                        <div className={cn(
                            "relative z-10 flex items-center gap-2 transform transition-transform duration-300",
                             isActive ? "-translate-y-1" : "translate-y-0 opacity-60 group-hover:opacity-100"
                        )}>
                            <Icon size={16} className={cn("transition-colors", isActive ? tab.color : "text-white")} />
                            <span className={cn("font-bold text-xs uppercase tracking-widest transition-colors", isActive ? "text-white" : "text-white")}>
                                {tab.label}
                            </span>
                        </div>
                    </button>
                )
            })}
        </div>
        
        {/* Connection Line */}
        <div className="h-px w-full bg-white/10" />
    </div>
  );
};

