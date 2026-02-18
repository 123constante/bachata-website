import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';

export const VenueCTA = () => {
  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <Link to="/venue-directory">
          <motion.div
            className="relative overflow-hidden rounded-2xl cursor-pointer group"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {/* Background Image */}
            <div className="absolute inset-0">
              <img 
                src="https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=1200" 
                alt="Dance venue"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-transparent" />
            </div>

            {/* Content */}
            <div className="relative p-6 md:p-8 flex items-center justify-between min-h-[120px]">
              <div className="flex items-center gap-4">
                <motion.div 
                  className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center"
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <MapPin className="w-6 h-6 text-primary" />
                </motion.div>
                <div>
                  <h3 className="text-xl md:text-2xl font-black">
                    Discover <span className="gradient-text">Venues</span>
                  </h3>
                  <p className="text-sm text-muted-foreground">Find your next dance floor</p>
                </div>
              </div>

              <motion.div
                className="w-10 h-10 rounded-full bg-primary flex items-center justify-center"
                whileHover={{ scale: 1.1, x: 3 }}
              >
                <ArrowRight className="w-5 h-5 text-primary-foreground" />
              </motion.div>
            </div>
          </motion.div>
        </Link>
      </div>
    </section>
  );
};
