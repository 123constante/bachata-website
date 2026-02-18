import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

type UseUnsavedChangesGuardOptions = {
  enabled: boolean;
  message?: string;
};

const DEFAULT_MESSAGE = 'You have unsaved changes. Are you sure you want to leave this page?';

export const useUnsavedChangesGuard = ({ enabled, message = DEFAULT_MESSAGE }: UseUnsavedChangesGuardOptions) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!enabled) return;

    const confirmLeave = () => window.confirm(message);

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

      const nextUrl = new URL(anchor.href, window.location.origin);
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;

      if (nextPath === currentPath) return;

      event.preventDefault();
      if (!confirmLeave()) return;

      if (nextUrl.origin !== window.location.origin) {
        window.location.href = nextUrl.toString();
        return;
      }

      navigate(nextPath);
    };

    const handlePopState = () => {
      if (confirmLeave()) {
        window.removeEventListener('popstate', handlePopState);
        window.history.back();
        return;
      }

      window.history.pushState({ unsavedGuard: true }, '', window.location.href);
    };

    window.history.pushState({ unsavedGuard: true }, '', window.location.href);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleDocumentClick, true);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleDocumentClick, true);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [enabled, message, navigate]);
};
