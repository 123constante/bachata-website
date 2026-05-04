// =============================================================================
// EraseGuestEntry -- minimal dancer-facing GDPR erasure page.
//
// Route: /erase/:token   (no auth; the token IS the secret).
//
// Flow:
//   1. On mount: call dancer_export_my_guest_entries_v1(p_token) to confirm
//      the token is valid + show what's being erased. Server returns
//      {ok:false, reason:'token_consumed'} if already erased -> show success.
//   2. Big primary button "Erase my data".
//   3. On click: call dancer_erase_guest_entry_v1(p_token). Server is
//      idempotent (already_consumed:true on re-submit).
//   4. Show success state.
//
// No email comms. Density-compliant with the Website theme.
// =============================================================================

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import GlobalLayout from "@/components/layout/GlobalLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Phase = "loading" | "preview" | "consumed" | "invalid" | "erasing" | "done";

interface EntryPreview {
  kind: "raffle" | "guest_list";
  first_name: string | null;
  phone_e164?: string | null;
  created_at?: string;
}

export default function EraseGuestEntry() {
  const { token } = useParams<{ token: string }>();
  const [phase, setPhase] = useState<Phase>("loading");
  const [entry, setEntry] = useState<EntryPreview | null>(null);
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
        entry?: EntryPreview;
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
      setPhase("preview");
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleErase = async () => {
    if (!token) return;
    setPhase("erasing");
    setErrorMsg(null);
    const { data, error } = await supabase.rpc("dancer_erase_guest_entry_v1", {
      p_token: token,
    });
    if (error) {
      setErrorMsg(error.message);
      setPhase("preview");
      return;
    }
    const payload = (data ?? {}) as { ok?: boolean; reason?: string };
    if (!payload.ok) {
      setErrorMsg(payload.reason ?? "erase_failed");
      setPhase("preview");
      return;
    }
    setPhase("done");
  };

  return (
    <GlobalLayout breadcrumbs={[{ label: "Erase my data" }]}>
      <div className="flex items-center justify-center min-h-[60vh] px-4 pb-24">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-semibold mb-1">Erase my data</h1>
          <p className="text-sm text-muted-foreground mb-6">
            This page lets you remove your name and any contact details we hold from a single
            event sign-up. The action is final.
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
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
              <div className="font-medium text-emerald-700 dark:text-emerald-300">
                Your data was already erased
              </div>
              <div className="text-muted-foreground mt-1">
                This link has already been used. Nothing more to do.
              </div>
            </div>
          )}

          {(phase === "preview" || phase === "erasing") && entry && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-4 text-sm">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  About to erase
                </div>
                <div>
                  <span className="text-muted-foreground">Type:</span>{" "}
                  <span className="font-medium">
                    {entry.kind === "raffle" ? "Raffle entry" : "Guest list entry"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Name:</span>{" "}
                  <span className="font-medium">{entry.first_name ?? "(unknown)"}</span>
                </div>
                {entry.phone_e164 && (
                  <div>
                    <span className="text-muted-foreground">Phone:</span>{" "}
                    <span className="font-mono text-xs">{entry.phone_e164}</span>
                  </div>
                )}
              </div>

              {errorMsg && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  {errorMsg}
                </div>
              )}

              <Button
                onClick={handleErase}
                disabled={phase === "erasing"}
                variant="destructive"
                size="lg"
                className="w-full"
              >
                {phase === "erasing" ? "Erasing..." : "Erase my data"}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                After this, your name and phone are removed from the entry. We retain a single
                anonymised marker for our internal audit; nothing identifies you personally.
              </p>
            </div>
          )}

          {phase === "done" && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm space-y-2">
              <div className="font-medium text-emerald-700 dark:text-emerald-300">
                Erased
              </div>
              <div className="text-muted-foreground">
                Your data has been removed from this event. You can close this page.
              </div>
            </div>
          )}
        </div>
      </div>
    </GlobalLayout>
  );
}
