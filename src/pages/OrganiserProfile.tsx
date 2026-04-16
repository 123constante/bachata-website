import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  ArrowLeft, Instagram, Globe, Pencil, Loader2, Phone, Facebook,
  Calendar, Users, Crown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { ScrollReveal } from '@/components/ScrollReveal';
import PageBreadcrumb from '@/components/PageBreadcrumb';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CityPicker } from '@/components/ui/city-picker';
import ProfileEventTimeline from '@/components/profile/ProfileEventTimeline';
import { hasRequiredCity, normalizeRequiredCity } from '@/lib/profile-validation';
import { resolveCanonicalCity } from '@/lib/city-canonical';

const OrganiserProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    avatar_url: '',
    bio: '',
    city: '',
    instagram: '',
    website: '',
  });

  // Fetch entity from the generic entities table
  const { data: entity, isLoading, error } = useQuery({
    queryKey: ['entity', id],
    queryFn: async () => {
      if (!id) throw new Error('Entity ID is required');
      
      const { data, error } = await supabase
        .from('entities')
        .select(`
          *,
          cities:cities!entities_city_id_fkey (
            name
          )
        `)
        .eq('id', id)
        .eq('type', 'organiser')
        .maybeSingle();
      
      if (error) throw error;
      if (!data) throw new Error('Organiser not found');

      return data;
    },
    enabled: !!id,
  });

  // ── Events this organiser hosts (upcoming + active only) ──
  const { data: hostedEvents = [] } = useQuery({
    queryKey: ['organiser-hosted-events', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('event_entities')
        .select('event_id, events(id, name, date, start_time, is_active)')
        .eq('entity_id', id)
        .eq('role', 'organiser');
      if (error) return [];
      const now = Date.now();
      type Row = { event_id: string; events: { id: string; name: string; date: string | null; start_time: string | null; is_active: boolean | null } | null };
      return (data as unknown as Row[])
        .map((r) => r.events)
        .filter((e): e is NonNullable<Row['events']> => Boolean(e))
        .filter((e) => e.is_active !== false)
        .filter((e) => {
          const raw = e.start_time ?? e.date;
          if (!raw) return true; // keep undated events
          return new Date(raw).getTime() >= now - 24 * 60 * 60 * 1000;
        })
        .sort((a, b) => {
          const aT = a.start_time ?? a.date ?? '';
          const bT = b.start_time ?? b.date ?? '';
          return aT.localeCompare(bT);
        });
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  // ── Team members ──
  // Fetches organiser_team_members (active), then resolves display data
  // from the member_profiles_directory view (member_profiles itself is
  // not exposed to anon).
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['organiser-team', id],
    queryFn: async () => {
      if (!id) return [];
      const { data: teamRows, error } = await supabase
        .from('organiser_team_members')
        .select('id, role, is_head, is_leader, sort_order, member_profile_id, is_active')
        .eq('organiser_entity_id', id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true, nullsFirst: false });
      if (error || !teamRows?.length) return [];

      const memberIds = teamRows.map((r) => r.member_profile_id);
      const { data: memberRows } = await supabase
        .from('member_profiles_directory')
        .select('id, first_name, last_name, full_name, avatar_url')
        .in('id', memberIds);

      type MemberRow = { id: string; first_name: string | null; last_name: string | null; full_name: string | null; avatar_url: string | null };
      const memberMap = new Map<string, MemberRow>(
        (memberRows as MemberRow[] | null ?? []).map((m) => [m.id, m]),
      );

      return teamRows.map((t) => {
        const m = memberMap.get(t.member_profile_id);
        const name =
          m?.full_name?.trim() ||
          [m?.first_name, m?.last_name].filter(Boolean).join(' ').trim() ||
          'Team member';
        return {
          id: t.id,
          memberId: t.member_profile_id,
          name,
          avatarUrl: m?.avatar_url ?? null,
          role: t.role,
          isHead: t.is_head,
          isLeader: t.is_leader,
        };
      });
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  // Handle claiming directly on entities ownership
  const handleClaim = async () => {
    if (!id || !user?.id) return;
    
    try {
      const { error } = await supabase
        .from('entities')
        .update({ claimed_by: user.id })
        .eq('id', id)
        .eq('type', 'organiser')
        .is('claimed_by', null);
      
      if (error) throw error;
      
      toast({
        title: 'Profile claimed',
        description: "You can now edit this organiser's profile.",
      });
      
      queryClient.invalidateQueries({ queryKey: ['entity', id] });
    } catch (error) {
      console.error('Claim error:', error);
      toast({
        title: 'Failed to claim profile',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Open edit modal with current values
  const openEditModal = () => {
    if (!entity) return;
    const socials = entity.socials as { instagram?: string; website?: string } | null;
    setEditForm({
      name: entity.name || '',
      avatar_url: entity.avatar_url || '',
      bio: entity.bio || '',
      city: entity.cities?.name || '',
      instagram: socials?.instagram || '',
      website: socials?.website || '',
    });
    setIsEditOpen(true);
  };

  // Handle save - MUST include claimed_by check
  const handleSave = async () => {
    if (!id || !user?.id) return;

    const city = normalizeRequiredCity(editForm.city);
    if (!hasRequiredCity(city)) {
      toast({
        title: 'City is required',
        description: 'Please add city before saving.',
        variant: 'destructive',
      });
      return;
    }

    const canonicalCity = await resolveCanonicalCity(city);
    if (!canonicalCity) {
      toast({
        title: 'Select a valid city',
        description: 'Please choose city from the city picker list.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('entities')
        .update({
          name: editForm.name.trim(),
          avatar_url: editForm.avatar_url.trim() || null,
          bio: editForm.bio.trim() || null,
          city_id: canonicalCity.cityId,
          socials: {
            instagram: editForm.instagram.trim() || null,
            website: editForm.website.trim() || null,
          },
        })
        .eq('id', id)
        .eq('claimed_by', user.id); // Security: only update if claimed by current user

      if (error) throw error;

      toast({
        title: 'Profile updated',
      });

      setIsEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ['entity', id] });
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: 'Unable to save changes. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pt-20 px-4 pb-24 bg-background">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-8 w-32" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (error || !entity) {
    return (
      <div className="min-h-screen pt-20 px-4 pb-24 bg-background">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Organiser Not Found</h1>
          <p className="text-muted-foreground mb-6">The organiser profile you're looking for doesn't exist.</p>
          <Button onClick={() => navigate(-1)} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Parse socials from JSONB — also check direct entity fields as fallback
  const socials = entity.socials as { instagram?: string; website?: string; facebook?: string } | null;
  const instagramRaw = (entity as any).instagram || socials?.instagram || null;
  const websiteRaw = (entity as any).website || socials?.website || null;
  const facebookRaw = (entity as any).facebook || socials?.facebook || null;
  const contactEmail = (entity as any).contact_email || null;
  const contactPhone = (entity as any).contact_phone || null;
  const organisationCategory = (entity as any).organisation_category || null;
  const galleryUrls: string[] = (() => {
    const raw = (entity as any).gallery_urls;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (typeof raw === 'string') { try { const p = JSON.parse(raw); return Array.isArray(p) ? p.filter(Boolean) : []; } catch { return []; } }
    return [];
  })();

  const instagramUrl = instagramRaw
    ? (instagramRaw.startsWith('http') ? instagramRaw : `https://instagram.com/${instagramRaw.replace('@', '')}`)
    : null;
  const websiteUrl = websiteRaw
    ? (websiteRaw.startsWith('http') ? websiteRaw : `https://${websiteRaw}`)
    : null;
  const facebookUrl = facebookRaw
    ? (facebookRaw.startsWith('http')
        ? facebookRaw
        : facebookRaw.includes('facebook.com')
          ? `https://${facebookRaw}`
          : `https://facebook.com/${facebookRaw.replace('@', '')}`)
    : null;
  const phoneHref = contactPhone ? `tel:${contactPhone.replace(/\s+/g, '')}` : null;

  // Claiming states
  const isUnclaimed = !entity.claimed_by;
  const isClaimedByUser = entity.claimed_by === user?.id;
  const canClaim = user && isUnclaimed;

  return (
    <div className="min-h-screen pb-24 pt-20 bg-background">
      <PageBreadcrumb items={[
        { label: 'Parties', path: '/parties' },
        { label: 'Organisers', path: '/organisers' },
        { label: entity.name }
      ]} />
      <div className="max-w-4xl mx-auto px-4">
        {/* Back Button */}
        <Button
          onClick={() => navigate(-1)}
          variant="ghost"
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {/* Header with Avatar */}
        <ScrollReveal animation="fadeUp">
          <div className="flex flex-col sm:flex-row items-start gap-6 mb-8">
            <Avatar className="w-24 h-24 border-2 border-primary/20">
              <AvatarImage src={entity.avatar_url || undefined} alt={entity.name} />
              <AvatarFallback className="text-3xl bg-primary/10 text-primary">
                {entity.name?.charAt(0) || '­'}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1">
              {/* Page title: Organiser Name */}
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-1">
                {entity.name}
              </h1>
              {/* Subheading: Event organiser */}
              <p className="text-muted-foreground text-lg">Event organiser</p>
              
              {/* City if available */}
              {entity.cities?.name && (
                <p className="text-sm text-muted-foreground mt-2">{entity.cities.name}</p>
              )}

              {/* Organisation category */}
              {organisationCategory && (
                <span className="inline-block mt-2 text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                  {organisationCategory}
                </span>
              )}

              {/* Social + contact links */}
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {instagramUrl && (
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors text-sm text-primary"
                  >
                    <Instagram className="w-4 h-4" /> Instagram
                  </a>
                )}
                {facebookUrl && (
                  <a
                    href={facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors text-sm text-primary"
                  >
                    <Facebook className="w-4 h-4" /> Facebook
                  </a>
                )}
                {websiteUrl && (
                  <a
                    href={websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors text-sm text-primary"
                  >
                    <Globe className="w-4 h-4" /> Website
                  </a>
                )}
                {phoneHref && contactPhone && (
                  <a
                    href={phoneHref}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors text-sm text-primary"
                  >
                    <Phone className="w-4 h-4" />
                    <span className="font-medium">Contact:</span>
                    <span>{contactPhone}</span>
                  </a>
                )}
                {contactEmail && (
                  <a
                    href={`mailto:${contactEmail}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors text-sm text-primary"
                  >
                    <span className="text-xs">✉️</span> {contactEmail}
                  </a>
                )}
              </div>
            </div>

            {/* Claim Button - Only if unclaimed */}
            {canClaim && (
              <Button variant="outline" onClick={handleClaim}>
                Claim this organiser profile
              </Button>
            )}

            {/* Edit Profile Button - Only if claimed by current user */}
            {isClaimedByUser && (
              <Button variant="outline" onClick={openEditModal}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit profile
              </Button>
            )}
          </div>
        </ScrollReveal>

        {/* About Section */}
        {entity.bio && (
          <ScrollReveal animation="fadeUp" delay={0.1}>
            <Card className="mb-6">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold text-foreground mb-3">About</h2>
                <p className="text-muted-foreground whitespace-pre-wrap">{entity.bio}</p>
              </CardContent>
            </Card>
          </ScrollReveal>
        )}

        {/* Gallery */}
        {galleryUrls.length > 0 && (
          <ScrollReveal animation="fadeUp" delay={0.12}>
            <Card className="mb-6">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">Gallery</h2>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {galleryUrls.slice(0, 8).map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={url}
                        alt={`${entity.name} photo ${i + 1}`}
                        className="w-full aspect-square object-cover rounded-lg hover:opacity-80 transition-opacity"
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>
        )}

        {/* Team members */}
        {teamMembers.length > 0 && (
          <ScrollReveal animation="fadeUp" delay={0.13}>
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-semibold text-foreground">Team</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {teamMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/50 p-3"
                    >
                      <Avatar className="w-10 h-10 border border-primary/10 shrink-0">
                        <AvatarImage src={member.avatarUrl || undefined} alt={member.name} />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                          {member.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <p className="font-semibold text-sm text-foreground truncate">
                            {member.name}
                          </p>
                          {member.isHead && (
                            <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                          )}
                        </div>
                        {member.role && (
                          <p className="text-xs text-muted-foreground truncate">{member.role}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>
        )}

        {/* Events hosted (upcoming) */}
        {hostedEvents.length > 0 && (
          <ScrollReveal animation="fadeUp" delay={0.14}>
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-semibold text-foreground">Upcoming events</h2>
                </div>
                <div className="space-y-2">
                  {hostedEvents.slice(0, 20).map((event) => {
                    const rawDate = event.start_time ?? event.date;
                    const dateLabel = rawDate
                      ? new Date(rawDate).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'Date TBA';
                    return (
                      <Link
                        key={event.id}
                        to={`/event/${event.id}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-card/50 px-3 py-2 hover:border-primary/40 hover:bg-primary/5 transition-colors"
                      >
                        <span className="text-sm font-medium text-foreground truncate">
                          {event.name}
                        </span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {dateLabel}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>
        )}

        {/* Event Timeline (session-level connections) */}
        <ScrollReveal animation="fadeUp" delay={0.15}>
          <ProfileEventTimeline
            personType="organiser"
            personId={entity.id}
            title="All connected events"
            emptyText="No connected events yet."
          />
        </ScrollReveal>
      </div>

      {/* Edit Profile Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Organiser name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="avatar_url">Avatar URL</Label>
              <Input
                id="avatar_url"
                value={editForm.avatar_url}
                onChange={(e) => setEditForm({ ...editForm, avatar_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <CityPicker
                value={editForm.city}
                onChange={(city) => setEditForm({ ...editForm, city })}
                placeholder="Select city..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={editForm.bio}
                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                placeholder="About this organiser..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instagram">Instagram</Label>
              <Input
                id="instagram"
                value={editForm.instagram}
                onChange={(e) => setEditForm({ ...editForm, instagram: e.target.value })}
                placeholder="@username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={editForm.website}
                onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving || !editForm.name.trim()}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrganiserProfile;


