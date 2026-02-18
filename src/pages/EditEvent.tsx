import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEventPermissions } from '@/hooks/useEventPermissions';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  ArrowLeft, 
  Upload, 
  Loader2, 
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
  social_start: z.string().optional(),
  social_end: z.string().optional(),
  tickets: z.string().optional(),
  ticket_url: z.string().optional().or(z.literal('')),
  payment_methods: z.string().optional(),
  facebook_url: z.string().optional().or(z.literal('')),
  instagram_url: z.string().optional().or(z.literal('')),
  website: z.string().optional().or(z.literal('')),
}).refine((data) => {
  const hasClass = data.class_start && data.class_end;
  const hasSocial = data.social_start && data.social_end;
  return hasClass || hasSocial;
}, {
  message: 'At least one time range (Class or Social) is required',
  path: ['class_start'],
});

type EventFormData = z.infer<typeof eventSchema>;

const EditEvent = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth(); // Removed authLoading, handled by AuthGuard
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      name: '', description: '', date: '', venue_id: '',
      class_start: '', class_end: '', social_start: '', social_end: '',
      tickets: '', ticket_url: '', payment_methods: '',
      facebook_url: '', instagram_url: '', website: ''
    },
  });

  const { data: eventData, isLoading: eventLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: async () => {
       const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
       if(error) throw error;
       return data;
    },
    enabled: !!id
  });

  const { canEdit, isLoading: permissionsLoading } = useEventPermissions(id, eventData?.created_by);

  useEffect(() => {
    if (!eventLoading && !permissionsLoading && !canEdit) {
      toast({
        title: "Unauthorized",
        description: "You do not have permission to edit this event.",
        variant: "destructive",
      });
      navigate('/');
    }
  }, [canEdit, eventLoading, permissionsLoading, navigate, toast]);

  const { data: venues } = useQuery({
    queryKey: ['venues'],
    queryFn: async () => {
      const { data, error } = await supabase.from('venues').select('id, name, city').order('name');
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (eventData) {
      reset({
        name: eventData.name,
        description: eventData.description || '',
        date: eventData.date,
        venue_id: eventData.venue_id,
        class_start: (eventData as any).class_start || '',
        class_end: (eventData as any).class_end || '',
        social_start: (eventData as any).social_start || '',
        social_end: (eventData as any).social_end || '',
        tickets: eventData.tickets || '',
        ticket_url: eventData.ticket_url || '',
        payment_methods: eventData.payment_methods || '',
        facebook_url: eventData.facebook_url || '',
        instagram_url: eventData.instagram_url || '',
        website: eventData.website || '',
      });
      setCoverImageUrl(eventData.cover_image_url || '');
    }
  }, [eventData, reset]);

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
    if (!coverImageUrl) {
      toast({ title: 'Cover image required', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      const hasClass = !!(data.class_start && data.class_end);
      const hasParty = !!(data.social_start && data.social_end);

      const keyTimes = {
        classes: {
          active: hasClass,
          start: data.class_start || null,
          end: data.class_end || null
        },
        party: {
          active: hasParty,
          start: data.social_start || null,
          end: data.social_end || null
        }
      };

      const eventPayload = {
        name: data.name.trim(),
        description: data.description.trim(),
        date: data.date,
        venue_id: data.venue_id,
        cover_image_url: coverImageUrl,
        class_start: cleanString(data.class_start),
        class_end: cleanString(data.class_end),
        social_start: cleanString(data.social_start),
        social_end: cleanString(data.social_end),
        key_times: JSON.stringify(keyTimes),
        tickets: cleanString(data.tickets),
        ticket_url: cleanString(data.ticket_url),
        payment_methods: cleanString(data.payment_methods),
        facebook_url: cleanString(data.facebook_url),
        instagram_url: cleanString(data.instagram_url),
        website: cleanString(data.website),
      };

      const { error } = await supabase.from('events').update(eventPayload).eq('id', id);
      if (error) throw error;
      toast({ title: 'Event updated' });
      navigate(`/event/${id}`);
    } catch (error) {
       console.error(error);
      toast({ title: 'Failed to update', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (eventLoading || permissionsLoading) return (
    <div className="flex justify-center items-center min-h-screen">
      <Loader2 className='w-8 h-8 animate-spin text-primary' />
    </div>
  );

  return (
    <div className='min-h-screen pt-20 px-4 pb-24'>
      <div className='max-w-2xl mx-auto'>
        <div className='flex items-center gap-4 mb-8'>
            <Button onClick={() => navigate(-1)} variant='ghost' size='icon'><ArrowLeft className='w-5 h-5' /></Button>
            <h1 className='text-2xl font-bold'>Edit Event</h1>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className='space-y-6'>
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

          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className='space-y-4'>
              <div><Label>Name</Label><Input {...register('name')} />{errors.name && <p className='text-red-500'>{errors.name.message}</p>}</div>
              <div><Label>Description</Label><Textarea {...register('description')} />{errors.description && <p className='text-red-500'>{errors.description.message}</p>}</div>
              <div><Label>Date</Label><Input type='date' {...register('date')} />{errors.date && <p className='text-red-500'>{errors.date.message}</p>}</div>
              <div>
                  <Label>Venue</Label>
                  <Select onValueChange={(v) => setValue('venue_id', v)} value={eventData?.venue_id}>
                    <SelectTrigger><SelectValue placeholder='Select Venue' /></SelectTrigger>
                    <SelectContent>
                      {venues?.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Times</CardTitle></CardHeader>
            <CardContent className='space-y-4'>
               <div className='grid grid-cols-2 gap-4'>
                 <div><Label>Class Start</Label><Input type='time' {...register('class_start')} /></div>
                 <div><Label>Class End</Label><Input type='time' {...register('class_end')} /></div>
               </div>
               <div className='grid grid-cols-2 gap-4'>
                 <div><Label>Social Start</Label><Input type='time' {...register('social_start')} /></div>
                 <div><Label>Social End</Label><Input type='time' {...register('social_end')} /></div>
               </div>
               {errors.class_start && <p className='text-red-500'>{errors.class_start.message}</p>}
            </CardContent>
          </Card>

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

          <Button type='submit' disabled={isSubmitting} className='w-full'>Save Changes</Button>
        </form>
      </div>
    </div>
  );
};
export default EditEvent;
