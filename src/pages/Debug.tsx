import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { useCity } from '@/contexts/CityContext';

const Debug = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const { citySlug } = useCity();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        if (!citySlug) {
          setData([]);
          return;
        }

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30);

        // M2b: repointed off the legacy v1 get_calendar_events (reads
        // calendar_occurrences) to the P5-native v2 — identical args + shape.
        const { data: events, error } = await supabase.rpc('get_calendar_events_v2' as any, {
          range_start: startDate.toISOString(),
          range_end: endDate.toISOString(),
          city_slug_param: citySlug,
        });

        if (error) throw error;
        setData(events);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [citySlug]);

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-8 pt-24">
      <h1 className="text-3xl font-bold mb-6">Debug Data</h1>
      
      {loading && <div>Loading...</div>}
      {error && <div className="text-red-500">Error: {JSON.stringify(error)}</div>}
      
      {data && (
        <Card className="bg-neutral-900 border-neutral-800 p-4 overflow-auto">
          <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap">
            {JSON.stringify(data, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
};

export default Debug;
