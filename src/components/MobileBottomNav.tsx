import { motion } from 'framer-motion';
import { Calendar, Users, Moon, User, GraduationCap, Music, Camera, ShoppingBag } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import MagicLinkConfirmation from '@/components/MagicLinkConfirmation';
import { supabase } from '@/integrations/supabase/client';
import { signInWithDevBypass, DEV_AUTH_BYPASS_HINT, createRandomDevAccount } from '@/lib/devAuthBypass';

const tabRoutes: Record<string, string> = {
  'calendar': '/',
  'dancers': '/dancers',
  'tonight': '/tonight',
  'profile': '/profile',
};

// Helper function to determine active tab from pathname
const getActiveTab = (pathname: string): string | null => {
  if (pathname === '/') return 'calendar';
  if (pathname === '/dancers') return 'dancers';
  if (pathname === '/tonight' || pathname.endsWith('/tonight')) return 'tonight';
  if (pathname === '/profile') return 'profile';
  if (pathname === '/auth') return 'profile';
  return null; // No tab active for other routes
};

const OTP_RESEND_COOLDOWN_SECONDS = 30;

const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [isAuthGateOpen, setIsAuthGateOpen] = useState(false);
  const [authGateTab, setAuthGateTab] = useState<'signin' | 'signup'>('signin');
  const [signInEmail, setSignInEmail] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('dancer');

  const createRoleOptions = useMemo(
    () => [
      {
        label: 'Dancer',
        value: 'dancer',
        icon: User,
        buttonClass: 'border-festival-teal/40 bg-festival-teal/10 hover:bg-festival-teal/20',
        iconClass: 'text-cyan-300',
      },
      {
        label: 'Organiser',
        value: 'organiser',
        icon: Calendar,
        buttonClass: 'border-festival-teal/40 bg-festival-teal/10 hover:bg-festival-teal/20',
        iconClass: 'text-cyan-300',
      },
      {
        label: 'Teacher',
        value: 'teacher',
        icon: GraduationCap,
        buttonClass: 'border-festival-teal/40 bg-festival-teal/10 hover:bg-festival-teal/20',
        iconClass: 'text-cyan-300',
      },
      {
        label: 'DJ',
        value: 'dj',
        icon: Music,
        buttonClass: 'border-festival-teal/40 bg-festival-teal/10 hover:bg-festival-teal/20',
        iconClass: 'text-cyan-300',
      },
      {
        label: 'Videographer',
        value: 'videographer',
        icon: Camera,
        buttonClass: 'border-festival-teal/40 bg-festival-teal/10 hover:bg-festival-teal/20',
        iconClass: 'text-cyan-300',
      },
      {
        label: 'Vendor',
        value: 'vendor',
        icon: ShoppingBag,
        buttonClass: 'border-festival-teal/40 bg-festival-teal/10 hover:bg-festival-teal/20',
        iconClass: 'text-cyan-300',
      },
    ],
    []
  );
  
  const activeTab = getActiveTab(location.pathname);
  
  const navItems = [
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'dancers', label: 'Dancers', icon: Users },
    { id: 'tonight', label: 'Tonight', icon: Moon },
    { 
      id: 'profile', 
      label: 'Profile', 
      icon: User
    },
  ];
  
  const handleTabChange = (tabId: string) => {
    if (tabId === 'profile') {
      trackAnalyticsEvent('profile_entry_opened', { source: 'bottom_nav' });

      if (isLoading) {
        return;
      }

      if (!user) {
        trackAnalyticsEvent('profile_entry_state_detected', { state: 'unauthenticated' });
        setAuthGateTab('signin');
        setIsAuthGateOpen(true);
        return;
      }
    }

    const route = tabRoutes[tabId];
    if (route) {
      navigate(route);
    }
  };

  const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

  const handleSendMagicLink = async () => {
    const normalizedEmail = signInEmail.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      toast({ title: 'Enter a valid email', description: 'Use a valid email to receive a magic link.', variant: 'destructive' });
      return;
    }

    const isCreateAccount = authGateTab === 'signup';
    if (isCreateAccount) {
      localStorage.setItem('pending_profile_role', selectedRole);
    }

    setIsSigningIn(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: isCreateAccount,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: isCreateAccount ? { user_type: selectedRole } : undefined,
        },
      });

      if (error) throw error;

      setMagicLinkSent(true);
    } catch (error: any) {
      toast({ title: 'Unable to send link', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleDevQuickLogin = async () => {
    setIsSigningIn(true);
    try {
      const { error } = await signInWithDevBypass();
      if (error) throw error;

      setIsAuthGateOpen(false);
      navigate('/profile');
    } catch (error: any) {
      toast({
        title: 'Dev quick login unavailable',
        description: error?.message || DEV_AUTH_BYPASS_HINT,
        variant: 'destructive',
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleCreateRandomDevAccount = async () => {
    setIsSigningIn(true);
    try {
      const result = await createRandomDevAccount();
      if (result.error) {
        throw new Error(`${result.error.message}${result.email ? ` | ${result.email}` : ''}${result.password ? ` | ${result.password}` : ''}`);
      }

      toast({
        title: 'Random test account created',
        description: `${result.email} / ${result.password}`,
      });
      setIsAuthGateOpen(false);
      navigate('/profile');
    } catch (error: any) {
      toast({
        title: 'Could not create random account',
        description: error?.message || DEV_AUTH_BYPASS_HINT,
        variant: 'destructive',
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <>
      <nav
        className={`fixed bottom-0 left-0 right-0 z-40 backdrop-blur-xl ${isAuthGateOpen ? 'pointer-events-none opacity-0' : ''}`}
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
                className={`relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors min-w-[60px] ${
                  isActive ? 'text-festival-teal' : 'text-zinc-400'
                }`}
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
                {(isTonight && !isActive) && (
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

      <Dialog open={isAuthGateOpen} onOpenChange={(open) => { setIsAuthGateOpen(open); if (!open) setMagicLinkSent(false); }}>
        <DialogContent className="z-[220] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Open Profile</DialogTitle>
            <DialogDescription>
              Pick a tab to continue your journey.
            </DialogDescription>
          </DialogHeader>

          {magicLinkSent ? (
            <MagicLinkConfirmation
              email={signInEmail}
              onResend={handleSendMagicLink}
              onChangeEmail={() => setMagicLinkSent(false)}
              role={authGateTab === 'signup' ? selectedRole : undefined}
            />
          ) : (
            <div className="space-y-3">
              <div className="grid w-full grid-cols-2 rounded-md border border-border p-1">
                <button
                  type="button"
                  className={`h-9 rounded-sm text-sm font-medium transition ${authGateTab === 'signin' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => setAuthGateTab('signin')}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  className={`h-9 rounded-sm text-sm font-medium transition ${authGateTab === 'signup' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => setAuthGateTab('signup')}
                >
                  Create account
                </button>
              </div>

              {authGateTab === 'signin' && (
                <div className="space-y-3 mt-0">
                  <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground/90">
                    Enter your email to receive a magic link.
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="auth-gate-email" className="text-xs">Email</Label>
                    <Input
                      id="auth-gate-email"
                      type="email"
                      placeholder="you@example.com"
                      className="bg-background"
                      value={signInEmail}
                      onChange={(event) => setSignInEmail(event.target.value)}
                    />
                  </div>
                  <Button className="w-full font-semibold" onClick={handleSendMagicLink} disabled={isSigningIn}>
                    {isSigningIn ? 'Sending…' : 'Send magic link'}
                  </Button>
                  <button
                    type="button"
                    className="w-full text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setIsAuthGateOpen(false);
                      navigate('/auth?mode=signin&returnTo=/profile');
                    }}
                  >
                    Open full sign-in page
                  </button>
                  {import.meta.env.DEV && (
                    <button type="button" className="w-full text-xs text-muted-foreground hover:text-foreground" onClick={() => void handleDevQuickLogin()} disabled={isSigningIn}>
                      Dev quick login
                    </button>
                  )}
                  {import.meta.env.DEV && (
                    <button type="button" className="w-full text-xs text-muted-foreground hover:text-foreground" onClick={() => void handleCreateRandomDevAccount()} disabled={isSigningIn}>
                      Create random test account
                    </button>
                  )}
                </div>
              )}

              {authGateTab === 'signup' && (
                <div className="space-y-3 mt-0">
                  <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground/90">
                    Choose your role, then enter your email.
                  </div>
                  <div className="grid gap-2">
                    {createRoleOptions.map((role) => {
                      const Icon = role.icon;
                      const isActive = selectedRole === role.value;
                      return (
                        <Button
                          key={role.value}
                          variant="outline"
                          className={`w-full justify-start text-foreground ${isActive ? 'border-cyan-300/85 bg-festival-teal/28' : role.buttonClass}`}
                          onClick={() => setSelectedRole(role.value)}
                        >
                          <Icon className={`w-4 h-4 mr-2 ${role.iconClass}`} />
                          {role.label}
                        </Button>
                      );
                    })}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="auth-gate-signup-email" className="text-xs">Email</Label>
                    <Input
                      id="auth-gate-signup-email"
                      type="email"
                      placeholder="you@example.com"
                      className="bg-background"
                      value={signInEmail}
                      onChange={(event) => setSignInEmail(event.target.value)}
                    />
                  </div>
                  <Button className="w-full font-semibold" onClick={handleSendMagicLink} disabled={isSigningIn}>
                    {isSigningIn ? 'Sending…' : 'Send magic link'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export { MobileBottomNav };
