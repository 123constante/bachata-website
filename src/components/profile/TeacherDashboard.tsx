import { useNavigate } from 'react-router-dom';
import { GraduationCap, Calendar, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DASHBOARD_LABELS } from '@/modules/profile/dashboardLabels';
import { useCity } from '@/contexts/CityContext';
import { buildCityPath } from '@/lib/cityPath';

export const TeacherDashboard = () => {
  const navigate = useNavigate();
  const { citySlug } = useCity();
  const classesPath = buildCityPath(citySlug, 'classes');

  return (
    <div className='dashboard-neon pt-[85px] pb-24 px-4'>
      <div className='max-w-5xl mx-auto space-y-3'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <div className='inline-flex items-center justify-center w-10 h-10 rounded-full bg-festival-teal/12'>
              <GraduationCap className='w-5 h-5 text-cyan-300' />
            </div>
            <div>
              <h1 className='text-xl font-bold'>Teacher Dashboard</h1>
              <p className='text-xs text-muted-foreground'>Tabbed bento layout with role-specific actions.</p>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <Button size='sm' variant='ghost' className='h-7 text-[10px] text-muted-foreground hover:text-foreground' onClick={() => navigate('/create-teacher-profile')}>Use wizard</Button>
            <Button size='sm' className='h-7 text-[11px]' onClick={() => navigate('/create-event')}>{DASHBOARD_LABELS.addClass}</Button>
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

          <TabsContent value='overview' className='m-0'>
            <div className='grid grid-cols-4 auto-rows-[88px] gap-1'>
              <Card className='dashboard-card col-span-2 row-span-2'>
                <CardContent className='p-2 h-full flex flex-col justify-between'>
                  <div>
                    <p className='text-xs uppercase tracking-wide text-muted-foreground'>Teaching profile</p>
                    <h2 className='text-sm font-semibold mt-1'>Ready to list workshops</h2>
                    <p className='text-xs text-muted-foreground line-clamp-2'>Keep schedule, classes, and links visible in one place.</p>
                  </div>
                  <div className='grid grid-cols-2 gap-1'>
                    <Button size='sm' className='h-6 text-[10px]' onClick={() => navigate('/create-event')}>{DASHBOARD_LABELS.addClass}</Button>
                    <Button size='sm' className='h-6 text-[10px]' variant='outline' onClick={() => navigate(classesPath)}>{DASHBOARD_LABELS.manageClasses}</Button>
                  </div>
                </CardContent>
              </Card>
              <Card className='dashboard-card col-span-2 row-span-1'><CardContent className='p-2 h-full flex items-center justify-between'><p className='text-xs font-semibold'>Classes: 0</p><Button size='sm' className='h-6 text-[10px]' variant='outline' onClick={() => navigate(classesPath)}>{DASHBOARD_LABELS.manage}</Button></CardContent></Card>
              <Card className='dashboard-card col-span-1 row-span-1'><CardContent className='p-2 h-full flex flex-col justify-between'><p className='text-xs font-semibold'>Media</p><Button size='sm' className='h-6 text-[10px]' variant='outline' onClick={() => navigate('/profile')}>{DASHBOARD_LABELS.update}</Button></CardContent></Card>
              <Card className='dashboard-card col-span-1 row-span-1'><CardContent className='p-2 h-full flex flex-col justify-between'><p className='text-xs font-semibold'>Contact</p><Button size='sm' className='h-6 text-[10px]' variant='outline' onClick={() => navigate('/profile')}>{DASHBOARD_LABELS.update}</Button></CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value='operations' className='m-0'><div className='grid grid-cols-4 auto-rows-[88px] gap-1'><Card className='dashboard-card col-span-3 row-span-2'><CardContent className='p-2 h-full flex flex-col justify-between'><p className='text-xs font-semibold'>No classes listed yet.</p><Button size='sm' className='h-6 text-[10px] w-fit' onClick={() => navigate('/create-event')}>{DASHBOARD_LABELS.addClass}</Button></CardContent></Card><Card className='dashboard-card col-span-1 row-span-2'><CardContent className='p-2 h-full flex flex-col justify-between'><p className='text-xs font-semibold'>Directory</p><Button size='sm' className='h-6 text-[10px]' variant='outline' onClick={() => navigate(classesPath)}>{DASHBOARD_LABELS.manage}</Button></CardContent></Card></div></TabsContent>

          <TabsContent value='content' className='m-0'><div className='grid grid-cols-4 auto-rows-[88px] gap-1'><Card className='dashboard-card col-span-4 row-span-2'><CardContent className='p-2 h-full flex items-center justify-between'><div><p className='text-xs uppercase text-muted-foreground'>Schedule</p><p className='text-sm font-semibold'>Manage workshop dates and class calendar</p></div><Button size='sm' className='h-6 text-[10px]' onClick={() => navigate(classesPath)}>{DASHBOARD_LABELS.manageCalendar}</Button></CardContent></Card></div></TabsContent>

          <TabsContent value='contact' className='m-0'><div className='grid grid-cols-4 auto-rows-[88px] gap-1'><Card className='dashboard-card col-span-2 row-span-2'><CardContent className='p-2 h-full flex flex-col justify-between'><p className='text-xs font-semibold'>Contact and socials</p><Button size='sm' className='h-6 text-[10px] w-fit' variant='outline' onClick={() => navigate('/profile')}>{DASHBOARD_LABELS.update}</Button></CardContent></Card><Card className='dashboard-card col-span-2 row-span-2'><CardContent className='p-2 h-full flex flex-col justify-between'><p className='text-xs font-semibold'>Availability</p><Button size='sm' className='h-6 text-[10px] w-fit' variant='outline' onClick={() => navigate(classesPath)}>{DASHBOARD_LABELS.updateAvailability}</Button></CardContent></Card></div></TabsContent>

          <TabsContent value='faq' className='m-0'><div className='grid grid-cols-4 auto-rows-[88px] gap-1'><Card className='dashboard-card col-span-4 row-span-2'><CardContent className='p-2 h-full flex flex-col justify-between'><p className='text-xs font-semibold'>FAQ for students is empty.</p><Button size='sm' className='h-6 text-[10px] w-fit' variant='outline' onClick={() => navigate('/profile')}>{DASHBOARD_LABELS.addFaq}</Button></CardContent></Card></div></TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

