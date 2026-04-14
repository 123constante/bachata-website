import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { useCity } from '@/contexts/CityContext';

const getActiveTab = (pathname: string): string | null => {
  if (pathname === '/') return 'calendar';
  if (pathname === '/dancers') return 'dancers';
  if (pathname === '/tonight' || pathname.endsWith('/tonight')) return 'tonight';
  if (pathname === '/profile') return 'profile';
  if (pathname === '/auth') return 'profile';
  return null;
};

const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading } = useAuth();
  const { citySlug } = useCity();

  const tabRoutes: Record<string, string> = {
    calendar: citySlug ? `/${citySlug}` : '/',
    dancers: '/dancers',
    tonight: citySlug ? `/${citySlug}/tonight` : '/tonight',
    profile: '/profile',
  };

  const activeTab = getActiveTab(location.pathname);

  const navItems = [
    { id: 'calendar', label: 'Calendar', icon: Calendar },
  ];

  const handleTabChange = (tabId: string) => {
    if (tabId === 'profile') {
      trackAnalyticsEvent('profile_entry_opened', { source: 'bottom_nav' });
      if (isLoading) return;
      if (!user) {
        trackAnalyticsEvent('profile_entry_state_detected', { state: 'unauthenticated' });
        navigate('/auth?mode=signin&returnTo=/profile');
        return;
      }
    }

    const route = tabRoutes[tabId];
    if (route) navigate(route);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 backdrop-blur-xl"
      style={{
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="absolute inset-0 bg-black/90" />
      <div className="absolute inset-x-0 top-0 h-px bg-white/5" />
      <div className="absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-black/30 to-transparent pointer-events-none z-20" />
      <div className="absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-black/30 to-transparent pointer-events-none z-20" />

      <div className="flex items-center justify-around py-2 relative z-10">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const isTonight = item.id === 'tonight';

          return (
            <motion.button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={`relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors min-w-[60px] ${isActive ? 'text-festival-teal' : 'text-zinc-400'}`}
              whileTap={{
                scale: 0.9,
                y: 2,
              }}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 17,
              }}
            >
              {isTonight && !isActive && (
                <div className="absolute inset-0 bg-festival-teal/5 rounded-xl blur-lg scale-75" />
              )}

              {isActive && (
                <motion.div
                  className="absolute inset-0 rounded-xl -z-10"
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: [0.2, 0.5, 0.2],
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  style={{
                    background: 'radial-gradient(circle, hsl(var(--primary) / 0.4) 0%, transparent 70%)',
                    filter: 'blur(8px)',
                  }}
                />
              )}

              <motion.div
                animate={isActive ? { scale: [1, 1.15, 1] } : { scale: isTonight ? 1.05 : 1 }}
                transition={{ duration: 0.2 }}
              >
                <item.icon
                  className={isTonight ? 'w-6 h-6' : 'w-5 h-5'}
                  strokeWidth={isActive ? 2.5 : 1.5}
                  fill={isActive ? 'currentColor' : 'none'}
                />
              </motion.div>
              <span className={`text-[9px] leading-tight text-center ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
};

export { MobileBottomNav };
