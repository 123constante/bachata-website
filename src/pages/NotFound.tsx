import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import GlobalLayout from "@/components/layout/GlobalLayout";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <GlobalLayout breadcrumbs={[{ label: 'Page not found' }]}>
      <div className="flex items-center justify-center min-h-[60vh] px-4 pb-24">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold">404</h1>
          <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
          <a href="/" className="text-primary underline hover:text-primary/90">
            Return to Home
          </a>
        </div>
      </div>
    </GlobalLayout>
  );
};

export default NotFound;
