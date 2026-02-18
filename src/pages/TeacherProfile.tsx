import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollReveal } from '@/components/ScrollReveal';
import PageBreadcrumb from '@/components/PageBreadcrumb';
import ProfileEventTimeline from '@/components/profile/ProfileEventTimeline';

const TeacherProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Fetch teacher entity from entities table
  const { data: entity, isLoading, error } = useQuery({
    queryKey: ['teacher-entity', id],
    queryFn: async () => {
      if (!id) throw new Error('Teacher ID is required');
      
      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .eq('id', id)
        .eq('type', 'teacher')
        .maybeSingle();
      
      if (error) throw error;
      if (!data) throw new Error('Teacher not found');
      
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen pt-[100px] px-4 pb-24">
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
      <div className="min-h-screen pt-[100px] px-4 pb-24">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Teacher Not Found</h1>
          <p className="text-muted-foreground mb-6">The teacher profile you're looking for doesn't exist.</p>
          <Button onClick={() => navigate(-1)} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 pt-[100px]">
      <PageBreadcrumb items={[
        { label: 'Classes', path: '/classes' },
        { label: 'Teachers', path: '/teachers' },
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
                {entity.name?.charAt(0) || '“'}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1">
              {/* Page title: Teacher Name */}
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-1">
                {entity.name}
              </h1>
              {/* Subheading: Teacher */}
              <p className="text-muted-foreground text-lg">Teacher</p>
              
              {/* City if available */}
              {entity.city && (
                <p className="text-sm text-muted-foreground mt-2">{entity.city}</p>
              )}
            </div>
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

        {/* Event Timeline */}
        <ScrollReveal animation="fadeUp" delay={0.15}>
          <ProfileEventTimeline
            personType="teacher"
            personId={entity.id}
            title="Event timeline"
            emptyText="No connected events yet."
          />
        </ScrollReveal>
      </div>
    </div>
  );
};

export default TeacherProfile;


