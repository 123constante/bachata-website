import { motion } from 'framer-motion';
import { Heart, ArrowRight, GraduationCap, Headphones, Sparkles } from 'lucide-react';

const peopleCategories = [
  {
    title: 'Teachers',
    emoji: '\u{1F393}',
    description: 'Learn their story, their style, their journey',
    image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
    name: 'Ana Rodriguez',
    role: 'Sensual Bachata Instructor',
    quote: '"Dance is how I express what words cannot say"',
    students: '2,400+',
  },
  {
    title: 'DJs',
    emoji: '\u{1F3A7}',
    description: 'The heartbeat behind every unforgettable night',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
    name: 'DJ Marco',
    role: 'Bachata & Sensual Specialist',
    quote: '"I read the floor and let the music tell the story"',
    events: '300+',
  },
  {
    title: 'Dancers',
    emoji: '\u{1F483}',
    description: 'Meet the community, find your dance family',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
    name: 'Sofia Martinez',
    role: 'Social Dancer & Performer',
    quote: '"Every dance is a conversation without words"',
    years: '8 years',
  },
];

export const PeopleFocusSection = () => {
  return (
    <section className="py-24 px-4 relative overflow-hidden">
      {/* Warm background glow */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-festival-pink/10 rounded-full blur-[120px]"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px]"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, delay: 2 }}
        />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header - More human, more inviting */}
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <motion.div
            className="inline-flex items-center gap-3 px-5 py-2.5 bg-festival-pink/20 rounded-full mb-6 border border-festival-pink/30"
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <Heart className="w-5 h-5 text-festival-pink" fill="currentColor" />
            <span className="text-festival-pink font-bold">Real People, Real Stories</span>
          </motion.div>
          
          <h2 className="text-4xl md:text-6xl font-black mb-6">
            Meet The <span className="gradient-text">People</span>
          </h2>
          <p className="text-muted-foreground text-xl max-w-2xl mx-auto leading-relaxed">
            Behind every class, every track, every dance floor moment â€” there's a human with a story. 
            Get to know them.
          </p>
        </motion.div>

        {/* People Cards - Large, Personal, Story-focused */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {peopleCategories.map((person, i) => (
            <motion.div
              key={i}
              className="group relative cursor-pointer"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
            >
              <motion.div
                className="relative bg-surface/90 backdrop-blur-sm rounded-3xl border border-primary/10 overflow-hidden"
                whileHover={{ 
                  y: -8,
                  borderColor: 'hsl(var(--primary) / 0.4)',
                  boxShadow: '0 25px 50px -12px hsl(var(--primary) / 0.25)'
                }}
                transition={{ duration: 0.3 }}
              >
                {/* Image with overlay */}
                <div className="relative h-64 overflow-hidden">
                  <motion.img 
                    src={person.image} 
                    alt={person.name}
                    className="w-full h-full object-cover"
                    whileHover={{ scale: 1.08 }}
                    transition={{ duration: 0.5 }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/50 to-transparent" />
                  
                  {/* Category badge */}
                  <motion.div
                    className="absolute top-4 left-4 px-4 py-2 bg-surface/90 backdrop-blur-sm rounded-full border border-primary/20"
                    whileHover={{ scale: 1.05 }}
                  >
                    <span className="text-2xl mr-2">{person.emoji}</span>
                    <span className="font-bold text-primary">{person.title}</span>
                  </motion.div>
                </div>

                {/* Content */}
                <div className="p-6 -mt-16 relative z-10">
                  {/* Profile Info */}
                  <div className="mb-4">
                    <h3 className="text-2xl font-black mb-1">{person.name}</h3>
                    <p className="text-primary/80 font-medium text-sm">{person.role}</p>
                  </div>

                  {/* Quote */}
                  <motion.p 
                    className="text-muted-foreground italic mb-5 text-sm leading-relaxed"
                    initial={{ opacity: 0.8 }}
                    whileHover={{ opacity: 1 }}
                  >
                    {person.quote}
                  </motion.p>

                  {/* Stat */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span className="text-sm text-muted-foreground">
                        {person.students && `${person.students} students`}
                        {person.events && `${person.events} events`}
                        {person.years && `Dancing ${person.years}`}
                      </span>
                    </div>
                  </div>

                  {/* CTA */}
                  <motion.div
                    className="mt-5 pt-5 border-t border-primary/10"
                    initial={{ opacity: 0.7 }}
                    whileHover={{ opacity: 1 }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        {person.title === 'Teachers' && 'See all teachers'}
                        {person.title === 'DJs' && 'Discover DJs'}
                        {person.title === 'Dancers' && 'Meet the community'}
                      </span>
                      <motion.div
                        className="p-2 rounded-full bg-primary/10 text-primary"
                        whileHover={{ x: 5, backgroundColor: 'hsl(var(--primary) / 0.2)' }}
                      >
                        <ArrowRight className="w-4 h-4" />
                      </motion.div>
                    </div>
                  </motion.div>
                </div>

                {/* Hover glow effect */}
                <motion.div
                  className="absolute inset-0 pointer-events-none rounded-3xl"
                  initial={{ opacity: 0 }}
                  whileHover={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  style={{
                    background: 'radial-gradient(circle at 50% 0%, hsl(var(--primary) / 0.1) 0%, transparent 70%)'
                  }}
                />
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* Bottom message - human touch */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <p className="text-muted-foreground text-lg mb-6">
            Every person has a story. Every dance has a heart. {'\u{1F496}'}
          </p>
          <motion.button
            className="px-8 py-4 bg-primary/10 text-primary border border-primary/30 rounded-full font-bold inline-flex items-center gap-3"
            whileHover={{ 
              scale: 1.05, 
              backgroundColor: 'hsl(var(--primary) / 0.2)',
              borderColor: 'hsl(var(--primary))'
            }}
            whileTap={{ scale: 0.95 }}
          >
            <Heart className="w-5 h-5" fill="currentColor" />
            Explore Our Community
            <ArrowRight className="w-5 h-5" />
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
};



