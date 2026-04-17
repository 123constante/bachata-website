import { Star, Sparkles } from 'lucide-react';
import PageLayout from '@/components/PageLayout';
import { EventCalendar } from '@/components/EventCalendar';

const Classes = () => {
  return (
    <PageLayout
      emoji="🎓"
      titleWhite="Learn"
      titleOrange="Bachata"
      breadcrumbLabel="Classes"
      floatingIcons={[Star, Sparkles]}
    >
      {/* Class Schedule */}
      <section id="calendar" className="px-4 mb-8">
        <EventCalendar defaultCategory="classes" />
      </section>
    </PageLayout>
  );
};

export default Classes;
