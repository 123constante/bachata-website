// =============================================================================
// ExportGuestEntry -- minimal dancer-facing GDPR export page.
//
// Route: /export/:token  (no auth; the token IS the secret).
//
// Calls dancer_export_my_guest_entries_v1(p_token) and renders the entry plus
// a "Download as JSON" button. If the token has been consumed via the Erase
// flow, returns reason='token_consumed' and shows a friendly message.
// =============================================================================

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import GlobalLayout from "@/components/layout/GlobalLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface EntryPayload {
  kind: "raffle" | "guest_list";
  id: string;
  event_id: string;
  first_name: string | null;
  status: string;
  created_at: string;
  deleted_at: string | null;
  phone_e164?: string | null;
  consent_version?: string | null;
  consent_at?: string | null;
  admin_note?: string | null;
}

type Phase = "loading" | "ready" | "consumed" | "invalid";

export default function ExportGuestEntry() {
  const { token } = useParams<{ token: string }>();
  const [phase, setPhase] = useState<Phase>("loading");
  const [entry, setEntry] = useState<EntryPayload | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setPhase("invalid");
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("dancer_export_my_guest_entries_v1", {
        p_token: token,
      });
      if (cancelled) return;
      if (error) {
        setErrorMsg(error.message);
        setPhase("invalid");
        return;
      }
      const payload = (data ?? {}) as {
        ok?: boolean;
        reason?: string;
        entry?: EntryPayload;
      };
      if (!payload.ok) {
        if (payload.reason === "token_consumed") {
          setPhase("consumed");
        } else {
          setErrorMsg(payload.reason ?? "invalid_token");
          setPhase("invalid");
        }
        return;
      }
      setEntry(payload.entry ?? null);
      setPhase("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleDownload = () => {
    if (!entry) return;
    const blob = new Blob([JSON.stringify(entry, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bachata-calendar-entry-${entry.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <GlobalLayout breadcrumbs={[{ label: "Export my data" }]}>
      <div className="flex items-center justify-center min-h-[60vh] px-4 pb-24">
        <div className="w-full max-w-lg">
          <h1 className="text-2xl font-semibold mb-1">Export my data</h1>
          <p className="text-sm text-muted-foreground mb-6">
            This page shows everything we hold for a single event sign-up.
          </p>

          {phase === "loading" && (
            <div className="text-sm text-muted-foreground">Looking up your entry...</div>
          )}

          {phase === "invalid" && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm">
              <div className="font-medium text-destructive">This link is not valid</div>
              <div className="text-muted-foreground mt-1">
                {errorMsg === "invalid_token"
                  ? "The token does not match any record. The link may have been mistyped."
                  : errorMsg === "token_required"
                  ? "Missing token in the URL."
                  : errorMsg ?? "Please contact the organiser if you believe this is wrong."}
              </div>
            </div>
          )}

          {phase === "consumed" && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
              <div className="font-medium text-amber-700 dark:text-amber-300">
                This link has been used to erase the data
              </div>
              <div className="text-muted-foreground mt-1">
                Once data is erased the export link no longer works. There's nothing left to
                show. Generate a new link via the organiser if needed.
              </div>
            </div>
          )}

          {phase === "ready" && entry && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-4 text-sm space-y-1">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  Entry contents
                </div>
                <Row label="Type" value={entry.kind === "raffle" ? "Raffle entry" : "Guest list entry"} />
                <Row label="Name" value={entry.first_name ?? "(none)"} />
                {entry.phone_e164 && <Row label="Phone" value={entry.phone_e164} mono />}
                {entry.consent_version && (
                  <Row label="Consent version" value={entry.consent_version} />
                )}
                {entry.consent_at && (
                  <Row label="Consented at" value={new Date(entry.consent_at).toISOString()} />
                )}
                <Row label="Joined at" value={new Date(entry.created_at).toISOString()} />
                <Row label="Status" value={entry.status} />
                {entry.admin_note && <Row label="Admin note" value={entry.admin_note} />}
              </div>

              <div className="flex flex-col gap-2">
                <Button onClick={handleDownload} size="lg" className="w-full">
                  Download as JSON
                </Button>
                <a
                  href={`/erase/${token}`}
                  className="text-xs text-center text-muted-foreground hover:text-foreground underline"
                >
                  Want to delete this instead? Use the erase link.
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </GlobalLayout>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-muted-foreground text-xs w-32 shrink-0">{label}</span>
      <span className={mono ? "font-mono text-xs" : "text-sm"}>{value}</span>
    </div>
  );
}
