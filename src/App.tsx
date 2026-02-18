import { GlobalBackground } from "@/components/GlobalBackground";
import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { CursorTrail } from "@/components/CursorTrail";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { GlobalHeader } from "@/components/GlobalHeader";
import { AuthProvider } from "@/hooks/useAuth";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CityProvider } from "@/contexts/CityContext";
import Index from "./pages/Index";
import Parties from "./pages/Parties";
import Classes from "./pages/Classes";
import Discounts from "./pages/Discounts";

import Venue from "./pages/Venue";
import Tonight from "./pages/Tonight";
import EventDetail from "./pages/EventDetail";
import PracticePartners from "./pages/PracticePartners";
import FestivalHub from "./pages/FestivalHub";
import FestivalDetail from "./pages/FestivalDetail";
import Experience from "./pages/Experience";
import Videographers from "./pages/Videographers";
import Choreography from "./pages/Choreography";
import Dancers from "./pages/Dancers";
import DancerProfile from "./pages/DancerProfile";
import Teachers from "./pages/Teachers";
import TeacherProfile from "./pages/TeacherProfile";
import DJs from "./pages/DJs";
import DJProfile from "./pages/DJProfile";
import Venues from "./pages/Venues";
import Organisers from "./pages/Organisers";
import OrganiserProfile from "./pages/OrganiserProfile";
import VenueDirectory from "./pages/VenueDirectory";
import VenueEntity from "./pages/VenueEntity";
import CreateProfile from "./pages/CreateProfile";
import CreateOrganiserProfile from "./pages/CreateOrganiserProfile";
import CreateTeacherProfile from "./pages/CreateTeacherProfile";
import CreateDJProfile from "./pages/CreateDJProfile";
import CreateVideographerProfile from "./pages/CreateVideographerProfile";
import CreateVendorProfile from "./pages/CreateVendorProfile";
import VendorDashboardPage from "./pages/VendorDashboardPage";
import Vendors from "./pages/Vendors";
import VendorDetail from "./pages/VendorDetail";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import Onboarding from "./pages/Onboarding";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import EditEvent from "./pages/EditEvent";
import CreateEvent from "./pages/CreateEvent";
import Debug from "./pages/Debug";
import DashboardPatternsDemo from "./pages/DashboardPatternsDemo";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AnimatedRoutes = () => {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Index /></PageTransition>} />
        <Route path="/:city" element={<PageTransition><Index /></PageTransition>} />
        <Route path="/:city/calendar" element={<PageTransition><Index /></PageTransition>} />
        <Route path="/parties" element={<PageTransition><Parties /></PageTransition>} />
        <Route path="/classes" element={<PageTransition><Classes /></PageTransition>} />
        <Route path="/discounts" element={<PageTransition><Discounts /></PageTransition>} />
        
        <Route path="/venues/:slug" element={<PageTransition><Venue /></PageTransition>} />
        <Route path="/tonight" element={<PageTransition><Tonight /></PageTransition>} />
        <Route path="/:city/tonight" element={<PageTransition><Tonight /></PageTransition>} />
        <Route path="/event/:id" element={<PageTransition><EventDetail /></PageTransition>} />
        <Route path="/practice-partners" element={<PageTransition><PracticePartners /></PageTransition>} />
        <Route path="/:city/practice-partners" element={<PageTransition><PracticePartners /></PageTransition>} />
        <Route path="/festivals" element={<PageTransition><FestivalHub /></PageTransition>} />
        <Route path="/festival/:id" element={<PageTransition><FestivalDetail /></PageTransition>} />
        <Route path="/vendors" element={<PageTransition><Vendors /></PageTransition>} />
        <Route path="/vendors/:id" element={<PageTransition><VendorDetail /></PageTransition>} />
        <Route path="/experience" element={<PageTransition><Experience /></PageTransition>} />
        <Route path="/videographers" element={<PageTransition><Videographers /></PageTransition>} />
        <Route path="/choreography" element={<PageTransition><Choreography /></PageTransition>} />
        <Route path="/dancers" element={<PageTransition><Dancers /></PageTransition>} />
        <Route path="/dancers/:id" element={<PageTransition><DancerProfile /></PageTransition>} />
        <Route path="/teachers" element={<PageTransition><Teachers /></PageTransition>} />
        <Route path="/teachers/:id" element={<PageTransition><TeacherProfile /></PageTransition>} />
        <Route path="/djs" element={<PageTransition><DJs /></PageTransition>} />
        <Route path="/djs/:id" element={<PageTransition><DJProfile /></PageTransition>} />
        <Route path="/venues" element={<PageTransition><Venues /></PageTransition>} />
        <Route path="/organisers" element={<PageTransition><Organisers /></PageTransition>} />
        <Route path="/organisers/:id" element={<PageTransition><OrganiserProfile /></PageTransition>} />
        <Route path="/venue-directory" element={<PageTransition><VenueDirectory /></PageTransition>} />
        <Route path="/:city/directory" element={<PageTransition><VenueDirectory /></PageTransition>} />
        <Route path="/venue-entity/:id" element={<PageTransition><VenueEntity /></PageTransition>} />
        
        {/* Protected Routes */}
        <Route path="/create-dancers-profile" element={
          <AuthGuard>
            <PageTransition><CreateProfile /></PageTransition>
          </AuthGuard>
        } />
        <Route path="/create-organiser-profile" element={
          <AuthGuard>
            <PageTransition><CreateOrganiserProfile /></PageTransition>
          </AuthGuard>
        } />
        <Route path="/create-teacher-profile" element={
          <AuthGuard>
            <PageTransition><CreateTeacherProfile /></PageTransition>
          </AuthGuard>
        } />
        <Route path="/create-dj-profile" element={
          <AuthGuard>
            <PageTransition><CreateDJProfile /></PageTransition>
          </AuthGuard>
        } />
        <Route path="/create-videographer-profile" element={
          <AuthGuard>
            <PageTransition><CreateVideographerProfile /></PageTransition>
          </AuthGuard>
        } />
        <Route path="/create-vendor-profile" element={
          <AuthGuard>
            <PageTransition><CreateVendorProfile /></PageTransition>
          </AuthGuard>
        } />
        <Route path="/profile" element={
          <AuthGuard>
            <PageTransition><Profile /></PageTransition>
          </AuthGuard>
        } />
        <Route path="/dashboard/vendor" element={
          <AuthGuard>
            <PageTransition><Navigate to="/profile?role=vendor" replace /></PageTransition>
          </AuthGuard>
        } />
        <Route path="/vendor-dashboard/edit" element={
          <AuthGuard>
            <PageTransition><VendorDashboardPage /></PageTransition>
          </AuthGuard>
        } />
        <Route path="/edit-profile" element={
          <AuthGuard>
            <PageTransition><EditProfile /></PageTransition>
          </AuthGuard>
        } />
        <Route path="/create-event" element={
          <AuthGuard>
            <PageTransition><CreateEvent /></PageTransition>
          </AuthGuard>
        } />
        <Route path="/event/:id/edit" element={
          <AuthGuard>
            <PageTransition><EditEvent /></PageTransition>
          </AuthGuard>
        } />

        <Route path="/auth" element={<PageTransition><Auth /></PageTransition>} />
        <Route path="/auth/callback" element={<PageTransition><AuthCallback /></PageTransition>} />
        <Route path="/onboarding" element={
          <AuthGuard>
            <PageTransition><Onboarding /></PageTransition>
          </AuthGuard>
        } />
        <Route path="/debug" element={<PageTransition><Debug /></PageTransition>} />
        <Route path="/debug/dashboard-patterns" element={<PageTransition><DashboardPatternsDemo /></PageTransition>} />
        
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          {/* <CursorTrail /> */}
          <BrowserRouter>
            <CityProvider>
              <GlobalBackground />
              <GlobalHeader />
              <AnimatedRoutes />
              <MobileBottomNav />
            </CityProvider>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;

