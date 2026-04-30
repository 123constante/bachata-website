import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import type { ListingSection } from '@/lib/featureFlags';

interface ListingRequestFormProps {
  section: ListingSection;
}

const URL_RE = /^https?:\/\//i;

export default function ListingRequestForm({ section }: ListingRequestFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [eventLink, setEventLink] = useState('');
  // Honeypot field &mdash; bots fill, humans don't. Rejected on the server.
  const [fieldUrlCheck, setFieldUrlCheck] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim() || !phone.trim() || !eventLink.trim()) {
      setErrorMessage('Please fill in name, phone, and event link.');
      return;
    }
    if (!URL_RE.test(eventLink.trim())) {
      setErrorMessage('Event link must start with http:// or https://');
      return;
    }

    setSubmitting(true);
    try {
      const sourceUrl = typeof window !== 'undefined'
        ? window.location.pathname + window.location.search
        : null;

      const { data, error } = await (supabase.rpc as any)('submit_listing_request_v1', {
        p_payload: {
          section,
          name: name.trim(),
          phone: phone.trim(),
          event_link: eventLink.trim(),
          source_url: sourceUrl,
          field_url_check: fieldUrlCheck,
        },
      });

      if (error) throw new Error(error.message ?? 'Submission failed.');

      const result = data as { ok?: boolean; error?: string } | null;
      if (!result?.ok) {
        if (result?.error === 'rate_limited') {
          setErrorMessage('Too many submissions from your network. Please try again in an hour.');
          return;
        }
        if (result?.error === 'invalid_event_link') {
          setErrorMessage('Event link must start with http:// or https://');
          return;
        }
        if (result?.error === 'missing_required_fields') {
          setErrorMessage('Please fill in name, phone, and event link.');
          return;
        }
        if (result?.error === 'invalid_section') {
          setErrorMessage('Form configuration error &mdash; please refresh and try again.');
          return;
        }
        // Unknown server error
        setErrorMessage('Sorry, something went wrong. Please try again.');
        return;
      }

      setSuccess(true);
      setName('');
      setPhone('');
      setEventLink('');
      setFieldUrlCheck('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Submission failed.';
      setErrorMessage(msg);
      toast({ title: 'Submission failed', description: msg, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div
        role="status"
        className="rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm text-orange-900"
      >
        Thanks &mdash; I&rsquo;ll call you soon.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="block text-sm font-medium text-slate-900 mb-1">Your name</span>
          <input
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
            className="w-full rounded-md border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-slate-100"
          />
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-slate-900 mb-1">Phone</span>
          <input
            type="tel"
            required
            autoComplete="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={submitting}
            className="w-full rounded-md border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-slate-100"
          />
        </label>
      </div>

      <label className="block">
        <span className="block text-sm font-medium text-slate-900 mb-1">Event link</span>
        <input
          type="url"
          required
          inputMode="url"
          placeholder="https://"
          value={eventLink}
          onChange={(e) => setEventLink(e.target.value)}
          disabled={submitting}
          className="w-full rounded-md border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-slate-100"
        />
        <span className="block text-xs text-slate-600 mt-1">
          Paste a link to your event &mdash; your Facebook event, Eventbrite, Instagram post,
          your own site, anything.
        </span>
      </label>

      {/* Honeypot &mdash; visually hidden but still focusable for bots that scan the DOM. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', height: 0, overflow: 'hidden' }}>
        <label>
          Do not fill this in
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={fieldUrlCheck}
            onChange={(e) => setFieldUrlCheck(e.target.value)}
          />
        </label>
      </div>

      {errorMessage ? (
        <p role="alert" className="text-sm text-red-600">{errorMessage}</p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center rounded-md bg-orange-500 py-2 px-4 text-sm font-medium text-white hover:bg-orange-600 disabled:bg-orange-300 disabled:cursor-not-allowed"
      >
        {submitting ? 'Sending&hellip;' : 'Send my details'}
      </button>
    </form>
  );
}
