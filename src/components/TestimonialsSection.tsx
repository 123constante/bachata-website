import { motion } from 'framer-motion';
import { Quote, Star } from 'lucide-react';

const testimonials = [
  {
    name: 'Sofia M.',
    role: '’ƒ Social Dancer',
    quote: "Found my dance family through this calendar! I went from dancing alone at home to hitting 3 socials a week.",
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
    rating: 5,
  },
  {
    name: 'Marcus J.',
    role: '“ Teacher',
    quote: "My classes went from half-empty to fully booked. This platform connects us with dancers who are genuinely passionate.",
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    rating: 5,
  },
  {
    name: 'Priya K.',
    role: '¨ Beginner',
    quote: "I was so nervous to start dancing. Now I've made friends for life and can't imagine weekends without bachata!",
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
    rating: 5,
  },
  {
    name: 'David L.',
    role: '§ DJ',
    quote: "The community here is unreal. Every event I play, I see familiar faces and new dancers mixing together.",
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    rating: 5,
  },
];

export const TestimonialsSection = () => {
  return (
    <section className="py-16 px-4 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl md:text-3xl font-black mb-1">
            From Our <span className="gradient-text">Community</span>
          </h2>
          <p className="text-muted-foreground text-sm">Real stories from dancers</p>
        </motion.div>

        {/* Testimonials Grid - 2 columns on desktop, 1 on mobile */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {testimonials.map((testimonial, i) => (
            <motion.div
              key={i}
              className="p-3 bg-surface/60 backdrop-blur-sm rounded-xl border border-primary/10"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.02, borderColor: 'hsl(var(--primary) / 0.3)' }}
            >
              {/* Avatar & Name */}
              <div className="flex items-center gap-2 mb-2">
                <img
                  src={testimonial.image}
                  alt={testimonial.name}
                  className="w-8 h-8 rounded-full object-cover border border-primary/30"
                />
                <div className="min-w-0">
                  <h3 className="font-semibold text-xs truncate">{testimonial.name}</h3>
                  <span className="text-[10px] text-muted-foreground">{testimonial.role}</span>
                </div>
              </div>
              
              {/* Stars */}
              <div className="flex gap-0.5 mb-2">
                {[...Array(testimonial.rating)].map((_, j) => (
                  <Star key={j} className="w-2.5 h-2.5 fill-primary text-primary" />
                ))}
              </div>

              <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-3">
                "{testimonial.quote}"
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

