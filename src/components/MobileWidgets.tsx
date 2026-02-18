import { motion } from 'framer-motion';
import { 
  Calendar, Star,
  Flame, Sparkles, ChevronRight, Music
} from 'lucide-react';

interface MobileWidgetsProps {
  activeFilter?: string;
}

const MobileWidgets = ({ activeFilter = 'all' }: MobileWidgetsProps) => {
  const featuredWidgets = [
    { title: 'Tonight', subtitle: '3 events', icon: Flame, gradient: 'from-primary/20 to-festival-pink/20', iconColor: 'text-primary' },
    { title: 'This Week', subtitle: '12 events', icon: Calendar, gradient: 'from-festival-purple/20 to-festival-blue/20', iconColor: 'text-festival-purple' },
    { title: 'Trending', subtitle: 'Top picks', icon: Sparkles, gradient: 'from-festival-pink/20 to-primary/20', iconColor: 'text-festival-pink' },
  ];


  const topTeachers = [
    { name: 'Maria S.', specialty: 'Sensual', rating: 5.0, image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop' },
    { name: 'Carlos R.', specialty: 'Dominican', rating: 4.9, image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop' },
    { name: 'Elena V.', specialty: 'Moderna', rating: 4.8, image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop' },
    { name: 'Miguel A.', specialty: 'Traditional', rating: 4.9, image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop' },
  ];

  const topDJs = [
    { name: 'DJ Luna', style: 'Sensual Mix', image: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=100&h=100&fit=crop' },
    { name: 'DJ Rico', style: 'Dominican', image: 'https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=100&h=100&fit=crop' },
    { name: 'DJ Sofia', style: 'Remix Queen', image: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=100&h=100&fit=crop' },
    { name: 'DJ Marco', style: 'Classic', image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop' },
  ];

  const dancers = [
    { name: 'Ana M.', level: 'Advanced', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop' },
    { name: 'David K.', level: 'Intermediate', image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop' },
    { name: 'Sofia L.', level: 'Pro', image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop' },
    { name: 'James P.', level: 'Advanced', image: 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=100&h=100&fit=crop' },
  ];

  const showAll = activeFilter === 'all';
  const showTeachers = showAll || activeFilter === 'teachers';
  const showDJs = showAll || activeFilter === 'djs';
  const showDancers = showAll || activeFilter === 'dancers';

  // Full-width divider component
  const SectionDivider = () => (
    <div className="w-full py-6">
      <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
    </div>
  );

  return (
    <section className="pb-32">
      {/* Section Header */}
      <div className="py-12 px-4 bg-background">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-xl md:text-2xl font-black mb-1">
              <span className="gradient-text">Explore</span> London
            </h2>
            <p className="text-muted-foreground text-xs">Tap to discover</p>
          </motion.div>
        </div>
      </div>

      {/* Featured Widgets - Only show on All */}
      {showAll && (
        <>
          <div className="py-8 px-4 bg-gradient-to-b from-primary/5 to-background">
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-4 gap-4">
                {featuredWidgets.map((widget, i) => (
                  <motion.div
                    key={i}
                    className={`p-2 rounded-xl bg-gradient-to-br ${widget.gradient} border border-primary/10 cursor-pointer`}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <motion.div
                      className="w-6 h-6 rounded-lg bg-background/50 flex items-center justify-center mb-1"
                      animate={{ rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 3, repeat: Infinity, delay: i * 0.3 }}
                    >
                      <widget.icon className={`w-3 h-3 ${widget.iconColor}`} />
                    </motion.div>
                    <h3 className="font-bold text-[10px]">{widget.title}</h3>
                    <p className="text-[8px] text-muted-foreground">{widget.subtitle}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
          <SectionDivider />
        </>
      )}


      {/* Top Teachers */}
      {showTeachers && (
        <>
          <div className="py-10 px-4 bg-gradient-to-b from-festival-pink/5 to-background">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-xs flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-festival-pink" />
                  Top Teachers
                </h3>
                <motion.button className="text-primary text-[10px] font-medium flex items-center gap-0.5" whileHover={{ x: 2 }}>
                  See all <ChevronRight className="w-2.5 h-2.5" />
                </motion.button>
              </div>

              <div className="grid grid-cols-4 gap-4">
                {topTeachers.map((teacher, i) => (
                  <motion.div
                    key={i}
                    className="p-2 bg-surface rounded-lg border border-primary/10 cursor-pointer"
                    whileHover={{ scale: 1.02, borderColor: 'hsl(var(--festival-pink))' }}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div className="flex flex-col items-center text-center">
                      <img 
                        src={teacher.image} 
                        alt={teacher.name}
                        className="w-8 h-8 rounded-full object-cover ring-2 ring-festival-pink/30 mb-1"
                      />
                      <h4 className="font-semibold text-[10px] truncate w-full">{teacher.name}</h4>
                      <p className="text-[8px] text-muted-foreground">{teacher.specialty}</p>
                      <div className="flex items-center gap-0.5 mt-0.5">
                        <Star className="w-2 h-2 text-primary fill-primary" />
                        <span className="text-[8px] font-medium">{teacher.rating}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
          <SectionDivider />
        </>
      )}

      {/* Top DJs */}
      {showDJs && (
        <>
          <div className="py-10 px-4 bg-gradient-to-b from-festival-blue/5 to-background">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-xs flex items-center gap-1">
                  <Music className="w-3 h-3 text-festival-purple" />
                  Top DJs
                </h3>
                <motion.button className="text-primary text-[10px] font-medium flex items-center gap-0.5" whileHover={{ x: 2 }}>
                  See all <ChevronRight className="w-2.5 h-2.5" />
                </motion.button>
              </div>

              <div className="grid grid-cols-4 gap-4">
                {topDJs.map((dj, i) => (
                  <motion.div
                    key={i}
                    className="p-2 bg-surface rounded-lg border border-primary/10 cursor-pointer"
                    whileHover={{ scale: 1.02, borderColor: 'hsl(var(--festival-purple))' }}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div className="flex flex-col items-center text-center">
                      <img 
                        src={dj.image} 
                        alt={dj.name}
                        className="w-8 h-8 rounded-full object-cover ring-2 ring-festival-purple/30 mb-1"
                      />
                      <h4 className="font-semibold text-[10px] truncate w-full">{dj.name}</h4>
                      <p className="text-[8px] text-muted-foreground">{dj.style}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
          <SectionDivider />
        </>
      )}

      {/* Dancers */}
      {showDancers && (
        <>
          <div className="py-10 px-4 bg-gradient-to-b from-primary/5 to-background">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-xs flex items-center gap-1">
                  ’ƒ Dancers
                </h3>
                <motion.button className="text-primary text-[10px] font-medium flex items-center gap-0.5" whileHover={{ x: 2 }}>
                  See all <ChevronRight className="w-2.5 h-2.5" />
                </motion.button>
              </div>

              <div className="grid grid-cols-4 gap-4">
                {dancers.map((dancer, i) => (
                  <motion.div
                    key={i}
                    className="p-2 bg-surface rounded-lg border border-primary/10 cursor-pointer"
                    whileHover={{ scale: 1.02, borderColor: 'hsl(var(--primary))' }}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div className="flex flex-col items-center text-center">
                      <img 
                        src={dancer.image} 
                        alt={dancer.name}
                        className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/30 mb-1"
                      />
                      <h4 className="font-semibold text-[10px] truncate w-full">{dancer.name}</h4>
                      <p className="text-[8px] text-muted-foreground">{dancer.level}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
          <SectionDivider />
        </>
      )}

      {/* Join Community CTA - Compact */}
      {showAll && (
        <div className="py-10 px-4 bg-gradient-to-b from-festival-pink/10 via-festival-purple/5 to-background">
          <div className="max-w-6xl mx-auto">
            <motion.div
              className="p-4 bg-gradient-to-r from-primary/20 via-festival-pink/20 to-festival-purple/20 rounded-xl border border-primary/20 cursor-pointer"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div 
                    className="w-10 h-10 rounded-full bg-background/50 flex items-center justify-center text-lg"
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    ’¬
                  </motion.div>
                  <div>
                    <h4 className="font-bold text-sm">Join 500+ dancers</h4>
                    <p className="text-xs text-muted-foreground">Connect on WhatsApp</p>
                  </div>
                </div>
                <motion.div
                  className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"
                  whileHover={{ scale: 1.1 }}
                >
                  <ChevronRight className="w-4 h-4 text-primary-foreground" />
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </section>
  );
};

export { MobileWidgets };

