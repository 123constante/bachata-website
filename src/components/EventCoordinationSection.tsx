import { useState, useEffect } from 'react';
import { Lock, Unlock, MapPin, Car, MessageSquare, Send } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

interface EventCoordinationSectionProps {
  eventId: string;
  goingCount: number;
  threshold?: number;
}

interface Post {
  id: number;
  content: string;
  thread: string;
  created_at: string;
}

const COORDINATION_THRESHOLD = 10;

const ThreadSection = ({
  eventId,
  thread,
  icon: Icon,
  title,
  description,
  posts,
  isUserGoing,
  onPostSubmit,
}: {
  eventId: string;
  thread: string;
  icon: React.ElementType;
  title: string;
  description: string;
  posts: Post[];
  isUserGoing: boolean;
  onPostSubmit: (thread: string, content: string) => Promise<void>;
}) => {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setIsSubmitting(true);
    try {
      await onPostSubmit(thread, content.trim());
      setContent('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 border border-border rounded-lg bg-background">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="font-medium text-foreground">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-3">{description}</p>

      {/* Posts list */}
      {posts.length > 0 && (
        <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
          {posts.map((post) => (
            <div
              key={post.id}
              className="p-2 bg-muted/50 rounded text-sm text-foreground"
            >
              <p>{post.content}</p>
              <span className="text-xs text-muted-foreground">
                {format(new Date(post.created_at), 'MMM d, h:mm a')}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      {isUserGoing ? (
        <div className="flex gap-2">
          <Textarea
            placeholder={`Share your ${title.toLowerCase()} ideas...`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[60px] resize-none"
          />
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={!content.trim() || isSubmitting}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div className="py-3 border border-dashed border-border rounded text-center">
          <span className="text-xs text-muted-foreground">
            Mark yourself as "Going" to post here
          </span>
        </div>
      )}
    </div>
  );
};

export const EventCoordinationSection = ({
  eventId,
  goingCount,
  threshold = COORDINATION_THRESHOLD,
}: EventCoordinationSectionProps) => {
  const { user } = useAuth();
  const isUnlocked = goingCount >= threshold;
  const remaining = threshold - goingCount;

  const [posts, setPosts] = useState<Post[]>([]);
  const [isUserGoing, setIsUserGoing] = useState(false);

  useEffect(() => {
    if (!isUnlocked) return;

    const fetchPosts = async () => {
      const { data } = await supabase
        .from('event_posts')
        .select('id, content, thread, created_at')
        .eq('event_id', eventId)
        .eq('kind', 'board')
        .order('created_at', { ascending: true });

      if (data) setPosts(data);
    };

    const checkUserGoing = async () => {
      if (!user) {
        setIsUserGoing(false);
        return;
      }
      const { data } = await supabase
        .from('event_participants')
        .select('status')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .maybeSingle();

      setIsUserGoing(data?.status === 'going');
    };

    fetchPosts();
    checkUserGoing();
  }, [eventId, isUnlocked, user]);

  const handlePostSubmit = async (thread: string, content: string) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('event_posts')
      .insert({
        event_id: eventId,
        user_id: user.id,
        kind: 'board',
        thread,
        content,
      })
      .select('id, content, thread, created_at')
      .single();

    if (!error && data) {
      setPosts((prev) => [...prev, data]);
    }
  };

  const getPostsByThread = (thread: string) =>
    posts.filter((p) => p.thread === thread);

  if (!isUnlocked) {
    return (
      <Card className="border-muted bg-muted/30">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold text-muted-foreground">
              Event Coordination
            </h2>
          </div>

          <div className="flex flex-col items-center justify-center py-8 border border-dashed border-muted-foreground/30 rounded-lg bg-muted/50">
            <Lock className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground font-medium text-center">
              {remaining} more {remaining === 1 ? 'person' : 'people'} needed to
              unlock coordination
            </p>
            <p className="text-sm text-muted-foreground/70 mt-2 text-center max-w-xs">
              Once {threshold} people are going, coordination features will
              unlock for everyone
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Unlock className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">
            Event Coordination
          </h2>
          <span className="ml-auto text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-medium">
            Unlocked!
          </span>
        </div>

        <div className="space-y-4">
          <ThreadSection
            eventId={eventId}
            thread="meetup"
            icon={MapPin}
            title="Meet-up Planning"
            description="Coordinate pre-event meetups and post-event plans"
            posts={getPostsByThread('meetup')}
            isUserGoing={isUserGoing}
            onPostSubmit={handlePostSubmit}
          />

          <ThreadSection
            eventId={eventId}
            thread="rides"
            icon={Car}
            title="Ride Sharing"
            description="Offer or request rides to and from the venue"
            posts={getPostsByThread('rides')}
            isUserGoing={isUserGoing}
            onPostSubmit={handlePostSubmit}
          />

          <ThreadSection
            eventId={eventId}
            thread="general"
            icon={MessageSquare}
            title="General Notes"
            description="Share tips and information with other attendees"
            posts={getPostsByThread('general')}
            isUserGoing={isUserGoing}
            onPostSubmit={handlePostSubmit}
          />
        </div>
      </CardContent>
    </Card>
  );
};
