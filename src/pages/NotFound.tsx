import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import GlobalLayout from "@/components/layout/GlobalLayout";
import { useSeo } from "@/lib/seo";

const RECOVERY_LINKS = [
  { to: "/", label: "Home" },
  { to: "/tonight", label: "Bachata tonight" },
  { to: "/parties", label: "Bachata parties" },
  { to: "/london-bachata-guide", label: "London bachata guide" },
];

const NotFound = () => {
  const location = useLocation();

  // Soft-404 hardening: tell crawlers not to index unresolved routes (the SPA
  // renders this for any unknown path). Middleware already noindexes bot HTML
  // for unresolved entity routes; this covers the user/prerender path.
  useSeo({
    title: "Page not found",
    description:
      "That page doesn't exist. Find bachata events, classes and parties in London on Bachata Calendar.",
    noindex: true,
  });

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <GlobalLayout breadcrumbs={[{ label: "Page not found" }]}>
      <div className="flex items-center justify-center min-h-[60vh] px-4 pb-24">
        <div className="text-center">
          <h1 className="mb-2 text-4xl font-bold">404</h1>
          <p className="mb-6 text-lg text-muted-foreground">
            Sorry, we couldn&rsquo;t find that page.
          </p>
          <nav className="flex flex-wrap justify-center gap-3 text-sm" aria-label="Recovery links">
            {RECOVERY_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="rounded-md border border-border px-3 py-2 text-primary hover:bg-muted"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </GlobalLayout>
  );
};

export default NotFound;
