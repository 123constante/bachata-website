import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { optimizedImageUrl } from '@/lib/imageCdn';
import { supabase } from '@/integrations/supabase/client';
import { uploadToR2 } from '@/lib/uploadToR2';
import { captureException } from '@/lib/sentry';
import { useAuth } from '@/hooks/useAuth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ScrollReveal } from '@/components/ScrollReveal';
import { validateImageFile } from '@/lib/upload-validation';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';

const cleanString = (str: string | undefined | null) => {
  if (!str) return null;
  const trimmed = str.trim();
  return trimmed === '' ? null : trimmed;
};

function buildEventTimestamps(
  date: string,
  times: { class_start?: string; class_end?: string; party_start?: string; party_end?: string },
) {
  const { class_start, class_end, party_start, party_end } = times;
  const iso = (d: string, t: string) => `${d}T${t}:00`;
  const nextDay = (d: string) => {
    const [y, m, day] = d.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, day + 1)).toISOString().slice(0, 10);
  };
  const startCandidates = [class_start, party_start].filter(Boolean) as string[];
  const start_time = startCandidates.length ? iso(date, startCandidates.sort()[0]) : null;
  const endCandidates: string[] = [];
  if (class_end) endCandidates.push(iso(date, class_end));
  if (party_end && party_start) {
    endCandidates.push(iso(party_end <= party_start ? nextDay(date) : date, party_end));
  } else if (party_end) {
    endCandidates.push(iso(date, party_end));
  }
  const end_time = endCandidates.length ? endCandidates.sort().reverse()[0] : null;
  return { start_time, end_time };
}

const eventSchema = z.object({
  name: z.string().min(1, 'Event name is required').max(200),
  description: z.string().min(1, 'Description is required').max(2000),
  date: z.string().min(1, 'Date is required'),
  venue_id: z.string().min(1, 'Venue is required'),
  class_start: z.string().optional(),
  class_end: z.string().optional(),
  party_start: z.string().optional(),
  party_end: z.string().optional(),
  tickets: z.string().optional(),
  ticket_url: z.string().optional().or(z.literal('')),
  payment_methods: z.string().optional(),
  facebook_url: z.string().optional().or(z.literal('')),
  instagram_url: z.string().optional().or(z.literal('')),
  website: z.string().optional().or(z.literal('')),
}).refine((data) => {
  const hasClass = data.class_start && data.class_end;
  const hasSocial = data.party_start && data.party_end;
  return hasClass || hasSocial;
}, {
  message: 'At least one time range (Class or Party) is required',
  path: ['class_start'],
});

type EventFormData = z.infer<typeof eventSchema>;

const CreateEvent = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      name: '', description: '', date: '', venue_id: '',
      class_start: '', class_end: '', party_start: '', party_end: '',
      tickets: '', ticket_url: '', payment_methods: '',
      facebook_url: '', instagram_url: '', website: ''
    },
  });

  const { data: venues = [] } = useQuery({
    queryKey: ['venues'],
    queryFn: async () => {
      const { data, error } = await supabase.from('venues').select('id, name, city_id, cities(name)').order('name');
      if (error) throw error;
      return data;
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const check = validateImageFile(file);
    if (!check.ok) { toast({ title: check.message, variant: 'destructive' }); return; }
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${fileExt}`;
      const filePath = `covers/${fileName}`;
      const publicUrl = await uploadToR2(file, 'events', filePath);
      setCoverImageUrl(publicUrl);
      toast({ title: 'Image uploaded' });
    } catch (error) {
      toast({ title: 'Upload failed', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = async (data: EventFormData) => {
    if (!user) return;

    if (!coverImageUrl) {
      toast({ title: 'Cover image required', variant: 'destructive' });
      return;
    }

    // city_id is derived from the already-loaded venues list (no extra DB call)
    const selectedVenue = venues?.find(v => v.id === data.venue_id);
    const city_id = selectedVenue?.city_id ?? null;

    setIsSubmitting(true);
    try {
      const { start_time, end_time } = buildEventTimestamps(data.date, data);
      const { data: result, error } = await (supabase.rpc as any)('organiser_save_event_v1', {
        p_event_id: null,
        p_payload: {
          name:          data.name.trim(),
          description:   data.description.trim(),
          venue_id:      data.venue_id,
          country:       'GB',
          city_id,
          poster_url:    coverImageUrl || null,
          ticket_url:    cleanString(data.ticket_url),
          website:       cleanString(data.website),
          facebook_url:  cleanString(data.facebook_url),
          instagram_url: cleanString(data.instagram_url),
          start_time,
          end_time,
        },
      });
      if (error) throw error;
      const body = result as { success: boolean; event_id?: string; errors?: { code: string; message: string }[] };
      if (!body.success) throw new Error(body.errors?.[0]?.message ?? 'Save failed');
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast({ title: 'Event created' });
      navigate(`/event/${body.event_id}`);
    } catch (error: any) {
      captureException(error, { context: 'CreateEvent.submit' });
      toast({ title: 'Failed to create', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <GlobalLayout breadcrumbs={buildBreadcrumbs('profile.createEvent')} backHref='/profile?role=organiser'>
    <div className='px-4 pb-24'>
      <div className='max-w-2xl mx-auto'>
        <ScrollReveal animation='fadeUp'>
          <div className='flex items-center gap-4 mb-8'>
            <h1 className='text-2xl font-bold'>Create Event</h1>
          </div>
        </ScrollReveal>
        <form onSubmit={handleSubmit(onSubmit)} className='space-y-6'>
          <ScrollReveal animation='fadeUp' delay={0.05}>
          <Card>
            <CardHeader><CardTitle>Cover Image</CardTitle></CardHeader>
            <CardContent>
              {coverImageUrl ? (
                <div className='relative'>
                  <img src={optimizedImageUrl(coverImageUrl, 640)} alt='Cover' className='w-full h-48 object-cover rounded-lg' loading="lazy"/>
                  <Button type='button' variant='secondary' size='sm' className='absolute bottom-3 right-3' onClick={() => setCoverImageUrl('')}>Change</Button>
                </div>
              ) : (
                <label className='flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg cursor-pointer'>
                  <input type='file' accept='image/*' onChange={handleImageUpload} className='hidden' disabled={isUploading} />
                  <Upload className='w-8 h-8 text-muted-foreground' />
                  <span className='text-sm text-muted-foreground mt-2'>Upload Cover</span>
                </label>
              )}
            </CardContent>
          </Card>
          </ScrollReveal>

          <ScrollReveal animation='fadeUp' delay={0.1}>
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className='space-y-4'>
              <div><Label>Name</Label><Input {...register('name')} />{errors.name && <p className='text-red-500'>{errors.name.message}</p>}</div>
              <div><Label>Description</Label><Textarea {...register('description')} />{errors.description && <p className='text-red-500'>{errors.description.message}</p>}</div>
              <div><Label>Date</Label><Input type='date' {...register('date')} />{errors.date && <p className='text-red-500'>{errors.date.message}</p>}</div>
              <div>
                <Label>Venue</Label>
                <Select onValueChange={(v) => setValue('venue_id', v)}>
                  <SelectTrigger><SelectValue placeholder='Select Venue' /></SelectTrigger>
                  <SelectContent>
                    {venues?.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          </ScrollReveal>

          <ScrollReveal animation='fadeUp' delay={0.15}>
          <Card>
            <CardHeader><CardTitle>Times</CardTitle></CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid grid-cols-2 gap-4'>
                <div><Label>Class Start</Label><Input type='time' {...register('class_start')} /></div>
                <div><Label>Class End</Label><Input type='time' {...register('class_end')} /></div>
              </div>
              <div className='grid grid-cols-2 gap-4'>
                <div><Label>Party Start</Label><Input type='time' {...register('party_start')} /></div>
                <div><Label>Party End</Label><Input type='time' {...register('party_end')} /></div>
              </div>
              {errors.class_start && <p className='text-red-500'>{errors.class_start.message}</p>}
            </CardContent>
          </Card>
          </ScrollReveal>

          <ScrollReveal animation='fadeUp' delay={0.2}>
          <Card>
            <CardHeader><CardTitle>Tickets & Links</CardTitle></CardHeader>
            <CardContent className='space-y-4'>
              <div><Label>Ticket Price Information</Label><Input {...register('tickets')} placeholder='e.g. Â£10' /></div>
              <div><Label>Ticket URL</Label><Input {...register('ticket_url')} placeholder='https://' /></div>
              <div><Label>Payment Methods</Label><Input {...register('payment_methods')} placeholder='Cash, Card...' /></div>
              <div><Label>Facebook Event</Label><Input {...register('facebook_url')} placeholder='https://' /></div>
              <div><Label>Instagram Post</Label><Input {...register('instagram_url')} placeholder='https://' /></div>
              <div><Label>Website</Label><Input {...register('website')} placeholder='https://' /></div>
            </CardContent>
          </Card>

          <Button type='submit' disabled={isSubmitting} className='w-full'>Create Event</Button>
          </ScrollReveal>
        </form>
      </div>
    </div>
    </GlobalLayout>
  );
};
export default CreateEvent;
