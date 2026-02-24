import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  ArrowLeft, 
  Upload, 
  Ticket, 
  Link as LinkIcon, 
  CreditCard, 
  Facebook, 
  Instagram, 
  Globe 
} from 'lucide-react';
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
import { useCity } from '@/contexts/CityContext';

const cleanString = (str: string | undefined | null) => {
  if (!str) return null;
  const trimmed = str.trim();
  return trimmed === '' ? null : trimmed;
};

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
  const { user } = useAuth();
  const { toast } = useToast();
  const { citySlug } = useCity();
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

  const { data: venues } = useQuery({
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
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${fileExt}`;
      const filePath = `covers/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('events').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('events').getPublicUrl(filePath);
      setCoverImageUrl(publicUrl);
      toast({ title: 'Image uploaded' });
    } catch (error) {
      toast({ title: 'Upload failed', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = async (data: EventFormData) => {
    if (!user) return; // Should not happen due to AuthGuard

    if (!citySlug) {
      toast({
        title: 'Select a city',
        description: 'Please choose a city before creating an event.',
        variant: 'destructive',
      });
      return;
    }

    const { data: validCity, error: cityError } = await (supabase.rpc as any)('is_valid_city_slug', {
      p_slug: citySlug,
    });

    if (cityError || !validCity) {
      toast({
        title: 'Invalid city',
        description: 'Please choose a valid city before creating an event.',
        variant: 'destructive',
      });
      return;
    }

    if (!coverImageUrl) {
      toast({ title: 'Cover image required', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      const hasClass = !!(data.class_start && data.class_end);
      const hasParty = !!(data.party_start && data.party_end);

      const keyTimes = {
        classes: {
          active: hasClass,
          start: data.class_start || null,
          end: data.class_end || null
        },
        party: {
          active: hasParty,
          start: data.party_start || null,
          end: data.party_end || null
        }
      };

      const eventData = {
        name: data.name.trim(),
        description: data.description.trim(),
        date: data.date,
        venue_id: data.venue_id,
        cover_image_url: coverImageUrl,
        city_slug: citySlug,
        class_start: cleanString(data.class_start),
        class_end: cleanString(data.class_end),
        party_start: cleanString(data.party_start),
        party_end: cleanString(data.party_end),
        key_times: JSON.stringify(keyTimes),
        tickets: cleanString(data.tickets),
        ticket_url: cleanString(data.ticket_url),
        payment_methods: cleanString(data.payment_methods),
        facebook_url: cleanString(data.facebook_url),
        instagram_url: cleanString(data.instagram_url),
        website: cleanString(data.website),
        is_published: true,
        created_by: user.id,
      };

      const { data: newEvent, error } = await supabase.from('events').insert(eventData).select().single();
      if (error) throw error;
      toast({ title: 'Event created' });
      navigate(`/event/${newEvent.id}`);
    } catch (error: any) {
       console.error(error);
      toast({ title: 'Failed to create', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='min-h-screen pt-20 px-4 pb-24'>
      <div className='max-w-2xl mx-auto'>
        <ScrollReveal animation='fadeUp'>
          <div className='flex items-center gap-4 mb-8'>
            <Button onClick={() => navigate(-1)} variant='ghost' size='icon'><ArrowLeft className='w-5 h-5' /></Button>
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
                   <img src={coverImageUrl} alt='Cover' className='w-full h-48 object-cover rounded-lg' />
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
              <div><Label>Ticket Price Information</Label><Input {...register('tickets')} placeholder='e.g. £10' /></div>
              <div><Label>Ticket URL</Label><Input {...register('ticket_url')} placeholder='https://' /></div>
              <div><Label>Payment Methods</Label><Input {...register('payment_methods')} placeholder='Cash, Card...' /></div>
              <div><Label>Facebook Event</Label><Input {...register('facebook_url')} placeholder='https://' /></div>
              <div><Label>Instagram Post</Label><Input {...register('instagram_url')} placeholder='https://' /></div>
              <div><Label>Website</Label><Input {...register('website')} placeholder='https://' /></div>
            </CardContent>
          </Card>

          <Button type='submit' disabled={isSubmitting} className='w-full'>Create Draft</Button>
          </ScrollReveal>
        </form>
      </div>
    </div>
  );
};
export default CreateEvent;
