import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Plus, UserCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useCity } from '@/contexts/CityContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DASHBOARD_LABELS } from '@/modules/profile/dashboardLabels';

export const OrganiserDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { citySlug } = useCity();
  const [loading, setLoading] = useState(true);
  const [organiser, setOrganiser] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    const fetchOrganiserData = async () => {
      if (!user) return;

      try {
        // Fetch the organiser entity claimed by this user
        const { data: entity } = await supabase
          .from('entities')
          .select('*')
          .eq('claimed_by', user.id)
          .eq('type', 'organiser')
          .maybeSingle();

        if (entity) {
          setOrganiser(entity);

          // Fetch associated events
          const { data: entityEvents, error: eventsError } = await supabase.rpc(
            'get_entity_events',
            {
              p_entity_id: entity.id,
              p_role: 'organiser',
              p_city_slug: citySlug,
            }
          );

          if (!eventsError && entityEvents) {
            const mappedEvents = (entityEvents as any[])
              .filter(Boolean)
              .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
            setEvents(mappedEvents);
          }
        }
      } catch (error) {
        console.error('Error fetching organiser data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrganiserData();
  }, [citySlug, user]);


  if (loading) {
    return (
      <div className="p-4 space-y-4 pt-20">
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!organiser) {
      // Should not happen if routed correctly, but safe fallback
      return <div className="pt-20 p-4">Associate organiser profile not found.</div>;
  }

  return (
    <div className='dashboard-neon pt-[85px] pb-24 px-4'>
      <div className='max-w-5xl mx-auto space-y-3'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-xl font-bold'>Organiser Hub</h1>
            <p className='text-xs text-muted-foreground line-clamp-1'>{organiser.name}</p>
            <p className='text-xs text-muted-foreground'>Tabbed bento layout with role-specific actions.</p>
          </div>
          <div className='flex items-center gap-2'>
            <Button size='sm' variant='ghost' className='h-7 text-[10px] text-muted-foreground hover:text-foreground' onClick={() => navigate('/create-organiser-profile')}>Use wizard</Button>
            <Button size='sm' className='h-7 text-[11px]' onClick={() => navigate('/create-event')}>{DASHBOARD_LABELS.addEvent}</Button>
          </div>
        </div>

        <Tabs defaultValue='overview' className='space-y-2'>
          <TabsList className='grid w-full grid-cols-5 h-8'>
            <TabsTrigger value='overview' className='text-[10px]'>Overview</TabsTrigger>
            <TabsTrigger value='operations' className='text-[10px]'>Operations</TabsTrigger>
            <TabsTrigger value='content' className='text-[10px]'>Content</TabsTrigger>
            <TabsTrigger value='contact' className='text-[10px]'>Contact</TabsTrigger>
            <TabsTrigger value='faq' className='text-[10px]'>FAQ</TabsTrigger>
          </TabsList>

          <TabsContent value='overview' className='m-0'><div className='grid grid-cols-4 auto-rows-[88px] gap-1'><Card className='dashboard-card col-span-2 row-span-2'><CardContent className='p-2 h-full flex flex-col justify-between'><div><p className='text-xs uppercase text-muted-foreground'>Organiser profile</p><p className='text-sm font-semibold mt-1'>Manage your events and profile</p></div><div className='grid grid-cols-2 gap-1'><Button size='sm' className='h-6 text-[10px]' onClick={() => navigate('/create-event')}>{DASHBOARD_LABELS.addEvent}</Button><Button size='sm' className='h-6 text-[10px]' variant='outline' onClick={() => navigate(`/organisers/${organiser.id}`)}>{DASHBOARD_LABELS.manageProfile}</Button></div></CardContent></Card><Card className='dashboard-card col-span-1 row-span-1'><CardContent className='p-2 h-full flex flex-col justify-between'><CalendarDays className='w-4 h-4' /><p className='text-xs font-semibold'>Events: {events.length}</p></CardContent></Card><Card className='dashboard-card col-span-1 row-span-1'><CardContent className='p-2 h-full flex flex-col justify-between'><UserCircle className='w-4 h-4' /><Button size='sm' className='h-6 text-[10px]' variant='outline' onClick={() => navigate(`/organisers/${organiser.id}`)}>{DASHBOARD_LABELS.manage}</Button></CardContent></Card><Card className='dashboard-card col-span-2 row-span-1'><CardContent className='p-2 h-full flex items-center justify-between'><p className='text-xs font-semibold'>Drafts: {events.filter((e) => !e.is_published).length}</p><Button size='sm' className='h-6 text-[10px]' variant='outline' onClick={() => navigate('/create-event')}><Plus className='w-3 h-3 mr-1' />{DASHBOARD_LABELS.addEvent}</Button></CardContent></Card></div></TabsContent>

          <TabsContent value='operations' className='m-0'>
            {events.length === 0 ? (
              <div className='grid grid-cols-4 auto-rows-[88px] gap-1'>
                <Card className='dashboard-card col-span-4 row-span-2'>
                  <CardContent className='p-2 h-full flex flex-col justify-between'>
                    <p className='text-xs font-semibold'>No events created yet.</p>
                    <Button size='sm' className='h-6 text-[10px] w-fit' onClick={() => navigate('/create-event')}>{DASHBOARD_LABELS.addEvent}</Button>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className='grid grid-cols-1 gap-2'>
                {events.map((event) => (
                  <Card key={event.id} className='dashboard-card overflow-hidden hover:bg-accent/50 transition-colors cursor-pointer' onClick={() => navigate(`/event/${event.id}/edit`)}>
                    <div className='flex'>
                      {event.cover_image_url && (
                        <div className='w-24 bg-cover bg-center' style={{ backgroundImage: `url(${event.cover_image_url})` }} />
                      )}
                      <div className='p-3 flex-1'>
                        <div className='flex justify-between items-start'>
                          <h3 className='font-semibold line-clamp-1'>{event.name}</h3>
                          {event.is_published ? (
                            <Badge variant='outline' className='text-[10px] bg-green-500/10 text-green-500 border-green-500/20'>Published</Badge>
                          ) : (
                            <Badge variant='outline' className='text-[10px]'>Draft</Badge>
                          )}
                        </div>
                        <p className='text-xs text-muted-foreground mt-1'>{new Date(event.date).toLocaleDateString()}</p>
                        <p className='text-xs text-muted-foreground line-clamp-1'>{event.location}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value='content' className='m-0'><div className='grid grid-cols-4 auto-rows-[88px] gap-1'><Card className='dashboard-card col-span-2 row-span-2'><CardContent className='p-2 h-full flex flex-col justify-between'><p className='text-xs font-semibold'>Published events</p><p className='text-2xl font-bold'>{events.filter((e) => e.is_published).length}</p></CardContent></Card><Card className='dashboard-card col-span-2 row-span-2'><CardContent className='p-2 h-full flex flex-col justify-between'><p className='text-xs font-semibold'>Draft events</p><p className='text-2xl font-bold'>{events.filter((e) => !e.is_published).length}</p></CardContent></Card></div></TabsContent>

          <TabsContent value='contact' className='m-0'><div className='grid grid-cols-4 auto-rows-[88px] gap-1'><Card className='dashboard-card col-span-2 row-span-2'><CardContent className='p-2 h-full flex flex-col justify-between'><p className='text-xs font-semibold'>Public profile</p><Button size='sm' className='h-6 text-[10px] w-fit' variant='outline' onClick={() => navigate(`/organisers/${organiser.id}`)}>{DASHBOARD_LABELS.manageProfile}</Button></CardContent></Card><Card className='dashboard-card col-span-2 row-span-2'><CardContent className='p-2 h-full flex flex-col justify-between'><p className='text-xs font-semibold'>Profile editing</p><Button size='sm' className='h-6 text-[10px] w-fit' variant='outline' onClick={() => navigate(`/organisers/${organiser.id}`)}>{DASHBOARD_LABELS.updateProfile}</Button></CardContent></Card></div></TabsContent>

          <TabsContent value='faq' className='m-0'><div className='grid grid-cols-4 auto-rows-[88px] gap-1'><Card className='dashboard-card col-span-4 row-span-2'><CardContent className='p-2 h-full flex flex-col justify-between'><p className='text-xs font-semibold'>FAQ not set.</p><Button size='sm' className='h-6 text-[10px] w-fit' variant='outline' onClick={() => navigate(`/organisers/${organiser.id}`)}>{DASHBOARD_LABELS.addFaq}</Button></CardContent></Card></div></TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
