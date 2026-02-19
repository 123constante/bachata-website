import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Users, Moon, User, GraduationCap, Music, Camera, ShoppingBag, MapPin, ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import MagicLinkConfirmation from '@/components/MagicLinkConfirmation';
import { supabase } from '@/integrations/supabase/client';
import { signInWithDevBypass, DEV_AUTH_BYPASS_HINT, createRandomDevAccount } from '@/lib/devAuthBypass';
import { CityPicker } from '@/components/ui/city-picker';

const tabRoutes: Record<string, string> = {
  'calendar': '/',
  'dancers': '/dancers',
  'tonight': '/tonight',
  'profile': '/profile',
};

const getActiveTab = (pathname: string): string | null => {
  if (pathname === '/') return 'calendar';
  if (pathname === '/dancers') return 'dancers';
  if (pathname === '/tonight' || pathname.endsWith('/tonight')) return 'tonight';
  if (pathname === '/profile') return 'profile';
  if (pathname === '/auth') return 'profile';
  return null;
};

const roleOptions = [
  { label: 'Dancer', value: 'dancer', icon: User, desc: 'Find classes, partners & events' },
  { label: 'Organiser', value: 'organiser', icon: Calendar, desc: 'Promote and manage your events' },
  { label: 'Teacher', value: 'teacher', icon: GraduationCap, desc: 'Reach students in your city' },
  { label: 'DJ', value: 'dj', icon: Music, desc: 'Get booked and share your mixes' },
  { label: 'Videographer', value: 'videographer', icon: Camera, desc: 'Showcase your work to organisers' },
  { label: 'Vendor', value: 'vendor', icon: ShoppingBag, desc: 'Sell to the dance community' },
];

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

  // Multi-step signup state
  const [signupStep, setSignupStep] = useState(1);
  const [firstName, setFirstName] = useState('');
  const [city, setCity] = useState('');

  const activeTab = getActiveTab(location.pathname);

  const navItems = [
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'dancers', label: 'Dancers', icon: Users },
    { id: 'tonight', label: 'Tonight', icon: Moon },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  const resetSignupState = () => {
    setSignupStep(1);
    setFirstName('');
    setCity('');
    setSelectedRole('dancer');
    setSignInEmail('');
    setMagicLinkSent(false);
  };

  const handleTabChange = (tabId: string) => {
    if (tabId === 'profile') {
      trackAnalyticsEvent('profile_entry_opened', { source: 'bottom_nav' });
      if (isLoading) return;
      if (!user) {
        trackAnalyticsEvent('profile_entry_state_detected', { state: 'unauthenticated' });
        setAuthGateTab('signin');
        setIsAuthGateOpen(true);
        return;
      }
    }
    const route = tabRoutes[tabId];
    if (route) navigate(route);
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
          data: isCreateAccount
            ? { user_type: selectedRole, first_name: firstName.trim(), city: city.trim() }
            : undefined,
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
      toast({ title: 'Dev quick login unavailable', description: error?.message || DEV_AUTH_BYPASS_HINT, variant: 'destructive' });
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
      toast({ title: 'Random test account created', description: `${result.email} / ${result.password}` });
      setIsAuthGateOpen(false);
      navigate('/profile');
    } catch (error: any) {
      toast({ title: 'Could not create random account', description: error?.message || DEV_AUTH_BYPASS_HINT, variant: 'destructive' });
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsAuthGateOpen(open);
    if (!open) resetSignupState();
  };

  const handleTabSwitch = (tab: 'signin' | 'signup') => {
    setAuthGateTab(tab);
    if (tab === 'signup') {
      setSignupStep(1);
    }
  };

  const progressPercent = authGateTab === 'signup' ? Math.round((signupStep / 3) * 100) : 0;

  return (
    <>
      <nav
        className={`fixed bottom-0 left-0 right-0 z-40 backdrop-blur-xl ${isAuthGateOpen ? 'pointer-events-none opacity-0' : ''}`}
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
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
                whileTap={{ scale: 0.9, y: 2 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              >
                {(isTonight && !isActive) && (
                  <div className="absolute inset-0 bg-festival-teal/5 rounded-xl blur-lg scale-75" />
                )}
                {isActive && (
                  <motion.div
                    className="absolute inset-0 rounded-xl -z-10"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.2, 0.5, 0.2], scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.4) 0%, transparent 70%)', filter: 'blur(8px)' }}
                  />
                )}
                <motion.div
                  animate={isActive ? { scale: [1, 1.15, 1] } : { scale: isTonight ? 1.05 : 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <item.icon className={isTonight ? 'w-6 h-6' : 'w-5 h-5'} strokeWidth={isActive ? 2.5 : 1.5} fill={isActive ? 'currentColor' : 'none'} />
                </motion.div>
                <span className={`text-[9px] leading-tight text-center ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {item.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </nav>

      <Dialog open={isAuthGateOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="z-[220] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Open Profile</DialogTitle>
            <DialogDescription>Pick a tab to continue your journey.</DialogDescription>
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
              {/* Tab toggle */}
              <div className="grid w-full grid-cols-2 rounded-md border border-border p-1">
                <button
                  type="button"
                  className={`h-9 rounded-sm text-sm font-medium transition ${authGateTab === 'signin' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => handleTabSwitch('signin')}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  className={`h-9 rounded-sm text-sm font-medium transition ${authGateTab === 'signup' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => handleTabSwitch('signup')}
                >
                  Create account
                </button>
              </div>

              {/* ── SIGN IN (unchanged) ── */}
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
                      onChange={(e) => setSignInEmail(e.target.value)}
                    />
                  </div>
                  <Button className="w-full font-semibold" onClick={handleSendMagicLink} disabled={isSigningIn}>
                    {isSigningIn ? 'Sending…' : 'Send magic link'}
                  </Button>
                  <button
                    type="button"
                    className="w-full text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => { setIsAuthGateOpen(false); navigate('/auth?mode=signin&returnTo=/profile'); }}
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

              {/* ── SIGN UP (multi-step wizard) ── */}
              {authGateTab === 'signup' && (
                <div className="space-y-3 mt-0">
                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Step {signupStep} of 3</span>
                      <span>{progressPercent}%</span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-festival-teal to-cyan-400"
                        initial={false}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                      />
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {/* ── Step 1: Role ── */}
                    {signupStep === 1 && (
                      <motion.div
                        key="signup-step-1"
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -30 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-3"
                      >
                        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground/90">
                          What brings you here?
                        </div>
                        <div className="grid gap-2">
                          {roleOptions.map((role) => {
                            const Icon = role.icon;
                            const isActive = selectedRole === role.value;
                            return (
                              <Button
                                key={role.value}
                                variant="outline"
                                className={`w-full justify-start text-foreground h-auto py-2.5 ${isActive ? 'border-cyan-300/85 bg-festival-teal/28' : 'border-festival-teal/40 bg-festival-teal/10 hover:bg-festival-teal/20'}`}
                                onClick={() => setSelectedRole(role.value)}
                              >
                                <Icon className="w-4 h-4 mr-2 text-cyan-300 shrink-0" />
                                <div className="text-left">
                                  <div className="font-medium text-sm">{role.label}</div>
                                  <div className="text-[11px] text-muted-foreground font-normal">{role.desc}</div>
                                </div>
                              </Button>
                            );
                          })}
                        </div>
                        <Button className="w-full font-semibold" onClick={() => setSignupStep(2)}>
                          Continue
                        </Button>
                      </motion.div>
                    )}

                    {/* ── Step 2: Name & City ── */}
                    {signupStep === 2 && (
                      <motion.div
                        key="signup-step-2"
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -30 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-3"
                      >
                        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground/90">
                          A little about you
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="auth-gate-firstname" className="text-xs flex items-center gap-1">
                            <User className="w-3 h-3" /> First name
                          </Label>
                          <Input
                            id="auth-gate-firstname"
                            type="text"
                            placeholder="Your first name"
                            className="bg-background"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> City
                          </Label>
                          <CityPicker value={city} onChange={setCity} placeholder="Search your city..." />
                        </div>
                        <Button
                          className="w-full font-semibold"
                          onClick={() => setSignupStep(3)}
                          disabled={!firstName.trim() || !city.trim()}
                        >
                          Continue
                        </Button>
                        <button
                          type="button"
                          className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1"
                          onClick={() => setSignupStep(1)}
                        >
                          <ArrowLeft className="w-3 h-3" /> Back
                        </button>
                      </motion.div>
                    )}

                    {/* ── Step 3: Email ── */}
                    {signupStep === 3 && (
                      <motion.div
                        key="signup-step-3"
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -30 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-3"
                      >
                        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground/90">
                          Last step — your email
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="auth-gate-signup-email" className="text-xs">Email</Label>
                          <Input
                            id="auth-gate-signup-email"
                            type="email"
                            placeholder="you@example.com"
                            className="bg-background"
                            value={signInEmail}
                            onChange={(e) => setSignInEmail(e.target.value)}
                          />
                        </div>
                        <Button className="w-full font-semibold" onClick={handleSendMagicLink} disabled={isSigningIn || !isValidEmail(signInEmail)}>
                          {isSigningIn ? 'Sending…' : 'Send magic link'}
                        </Button>
                        <button
                          type="button"
                          className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1"
                          onClick={() => setSignupStep(2)}
                        >
                          <ArrowLeft className="w-3 h-3" /> Back
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
                      </motion.div>
                    )}
                  </AnimatePresence>
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
