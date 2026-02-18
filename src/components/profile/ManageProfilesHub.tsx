import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Camera, GraduationCap, LogOut, Music, Plus, ShoppingBag, User, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { UserRole, UserIds } from "@/hooks/useUserIds";
import { trackAnalyticsEvent } from "@/lib/analytics";

type Props = {
  ids: Omit<UserIds, "loading">;
  onRefreshRoles?: () => void;
  onSignOut?: () => void;
  mode?: "card" | "strip";
};

type ClaimableEntityType = Extract<UserRole, "organiser" | "teacher" | "dj">;

type EntitySearchRow = {
  id: string;
  name: string;
  type: ClaimableEntityType;
};

const CLAIM_TABLE_MAP: Record<ClaimableEntityType, string> = {
  organiser: 'organisers',
  teacher: 'teacher_profiles',
  dj: 'dj_profiles',
};

const resolveProfileName = (row: any): string => {
  const fullName = [row?.first_name, row?.surname].filter(Boolean).join(' ').trim();
  return row?.name || row?.business_name || row?.display_name || fullName || 'Unnamed profile';
};

const ROLE_META: Record<UserRole, { label: string; icon: typeof User; tone: string }> = {
  dancer: { label: "Dancer", icon: User, tone: "text-cyan-300" },
  organiser: { label: "Organiser", icon: Building2, tone: "text-cyan-300" },
  teacher: { label: "Teacher", icon: GraduationCap, tone: "text-cyan-300" },
  dj: { label: "DJ", icon: Music, tone: "text-cyan-300" },
  videographer: { label: "Videographer", icon: Camera, tone: "text-cyan-300" },
  vendor: { label: "Vendor", icon: ShoppingBag, tone: "text-cyan-300" },
};

const getPublicProfileRoute = (role: UserRole, id: string): string | null => {
  switch (role) {
    case "dancer":
      return `/dancers/${id}`;
    case "organiser":
      return `/organisers/${id}`;
    case "teacher":
      return `/teachers/${id}`;
    case "dj":
      return `/djs/${id}`;
    case "vendor":
      return `/vendors/${id}`;
    case "videographer":
      return null;
    default:
      return null;
  }
};

export const ManageProfilesHub = ({ ids, onRefreshRoles, onSignOut, mode = "card" }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isStrip = mode === "strip";

  const ownedRoleIds = useMemo(
    () => ({
      dancer: ids.dancerId,
      organiser: ids.organiserId,
      teacher: ids.teacherId,
      dj: ids.djId,
      videographer: ids.videographerId,
      vendor: ids.vendorId,
    }),
    [ids]
  );

  const missingRoles = (Object.keys(ownedRoleIds) as UserRole[]).filter((role) => !ownedRoleIds[role]);
  const missingAddableRoles = missingRoles.filter((role) => role !== "dancer");

  const [claimOpen, setClaimOpen] = useState(false);
  const [claimType, setClaimType] = useState<ClaimableEntityType>("organiser");
  const [claimQuery, setClaimQuery] = useState("");
  const [claimPending, setClaimPending] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimResults, setClaimResults] = useState<EntitySearchRow[]>([]);

  const openClaim = (type: ClaimableEntityType) => {
    setClaimType(type);
    setClaimQuery("");
    setClaimError(null);
    setClaimResults([]);
    setClaimOpen(true);
  };

  useEffect(() => {
    if (!claimOpen) return;

    const run = async () => {
      if (!claimQuery.trim()) {
        setClaimResults([]);
        setClaimError(null);
        return;
      }

      setClaimPending(true);
      setClaimError(null);

      // Note: We intentionally use `any` here because the local generated Supabase types
      // can drift from migrations. This keeps UI unblocked.
      const normalizedQuery = claimQuery.trim().toLowerCase();

      const { data, error } = await (supabase as any)
        .from(CLAIM_TABLE_MAP[claimType])
        .select("*")
        .is("user_id", null)
        .limit(100);

      if (error) {
        setClaimError(error.message || "Failed to search profiles.");
        setClaimResults([]);
      } else {
        const mapped = ((data || []) as any[])
          .filter((row) => {
            if (!normalizedQuery) return true;
            return resolveProfileName(row).toLowerCase().includes(normalizedQuery);
          })
          .map((row) => ({
            id: row.id,
            name: resolveProfileName(row),
            type: claimType,
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
          .slice(0, 15);
        setClaimResults(mapped);
      }

      setClaimPending(false);
    };

    void run();
  }, [claimOpen, claimQuery, claimType]);

  const CLAIM_RPC_MAP: Record<ClaimableEntityType, string> = {
    organiser: 'claim_organiser_profile',
    teacher: 'claim_teacher_profile',
    dj: 'claim_dj_profile',
  };

  const claimEntity = async (entityId: string) => {
    if (!user?.id) return;

    setClaimPending(true);
    setClaimError(null);

    const rpcName = CLAIM_RPC_MAP[claimType];
    const paramKey = `p_${claimType === 'dj' ? 'dj' : claimType === 'teacher' ? 'teacher' : 'organiser'}_id`;

    const { error } = await supabase.rpc(rpcName as any, {
      [paramKey]: entityId,
    } as any);

    if (error) {
      setClaimError(error.message || "Failed to claim profile.");
      setClaimPending(false);
      return;
    }

    setClaimPending(false);
    setClaimOpen(false);
    onRefreshRoles?.();
  };

  const handleCreateRole = (role: UserRole) => {
    localStorage.setItem('profile_entry_role', role);
    localStorage.removeItem('auth_signup_draft_v1');
    navigate(`/auth?mode=signup&returnTo=${encodeURIComponent('/profile')}&userType=${encodeURIComponent(role)}`);
  };

  return (
    <div className={isStrip ? "px-2.5 sm:px-4" : "px-4 pb-10"}>
      <div className={`${isStrip ? "max-w-6xl mx-auto" : "max-w-lg mx-auto mt-6"} ${isStrip ? "space-y-2" : "space-y-4"}`}>
        <Card className={`border-festival-teal/35 bg-background/65 backdrop-blur-xl ${isStrip ? "shadow-md" : "shadow-xl"}`}>
          <CardHeader className={isStrip ? "space-y-0.5 p-2.5 pb-1.5" : "space-y-1"}>
            <CardTitle className={isStrip ? "text-base" : "text-lg"}>Manage profiles</CardTitle>
            <p className={`${isStrip ? "text-xs" : "text-sm"} text-muted-foreground`}>
              {isStrip ? "Create or claim profiles." : "Create extra profiles, claim existing pages, and jump to edits."}
            </p>
          </CardHeader>
          <CardContent className={isStrip ? "space-y-2 p-2.5 pt-0" : "space-y-5"}>
            <div className={isStrip ? "space-y-2" : "space-y-3"}>
              <div className={`flex items-center gap-2 ${isStrip ? "text-xs" : "text-sm"} font-medium`}>
                <Users className={isStrip ? "h-3.5 w-3.5" : "h-4 w-4"} />
                Your profiles
              </div>

              <div className={`grid gap-2 ${isStrip ? "md:grid-cols-2" : ""}`}>
                {(Object.keys(ownedRoleIds) as UserRole[])
                  .filter((role) => Boolean(ownedRoleIds[role]))
                  .map((role) => {
                    const Icon = ROLE_META[role].icon;
                    const id = ownedRoleIds[role] as string;
                    const publicRoute = getPublicProfileRoute(role, id);
                    const primaryAction = {
                      label: "Open dashboard",
                      onClick: () => {
                        localStorage.setItem("profile_last_active_role", role);
                        navigate(`/profile?role=${role}`);
                      },
                    };

                    return (
                      <div key={role} className={`flex items-center justify-between gap-2 rounded-lg border border-festival-teal/25 bg-background/50 ${isStrip ? "min-h-[36px] p-1.5" : "p-3"}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`${isStrip ? "h-6 w-6" : "h-9 w-9"} rounded-full bg-background/70 border border-festival-teal/25 flex items-center justify-center ${ROLE_META[role].tone}`}>
                            <Icon className={isStrip ? "h-3 w-3" : "h-4 w-4"} />
                          </div>
                          <div className="min-w-0">
                            <p className={`${isStrip ? "text-sm" : ""} font-medium leading-tight`}>{ROLE_META[role].label}</p>
                          </div>
                        </div>

                        <div className={`flex items-center shrink-0 ${isStrip ? "gap-1.5" : "gap-2"}`}>
                          <Button size="sm" variant="outline" className={`${isStrip ? "h-6 min-w-[76px] justify-center text-[11px] px-2" : ""} border-festival-teal/30 bg-background/45 hover:bg-festival-teal/15 focus-visible:ring-2 focus-visible:ring-festival-teal/60 transition-colors`} onClick={primaryAction.onClick}>
                            {primaryAction.label}
                          </Button>
                          {publicRoute && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className={`${isStrip ? "h-6 min-w-[76px] justify-center text-[11px] px-2" : ""} text-muted-foreground hover:text-foreground`}
                              onClick={() => navigate(publicRoute)}
                            >
                              View public page
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className={isStrip ? "space-y-2" : "space-y-3"}>
              <div className={`flex items-center gap-2 ${isStrip ? "text-xs" : "text-sm"} font-medium`}>
                <Plus className={isStrip ? "h-3.5 w-3.5" : "h-4 w-4"} />
                Add profile
              </div>
              {missingAddableRoles.length === 0 ? (
                <p className={`${isStrip ? "text-xs" : "text-sm"} text-muted-foreground`}>You already have every profile type.</p>
              ) : (
                <div className={`grid gap-2 ${isStrip ? "md:grid-cols-2" : ""}`}>
                  {missingAddableRoles.map((role) => {
                    const Icon = ROLE_META[role].icon;
                    const isClaimable = role === "organiser" || role === "teacher" || role === "dj";

                    return (
                      <div key={role} className={`flex items-center justify-between gap-2 rounded-lg border border-festival-teal/25 bg-background/50 ${isStrip ? "min-h-[36px] p-1.5" : "p-3"}`}>
                        <div className="flex items-center gap-2">
                          <div className={`${isStrip ? "h-6 w-6" : "h-9 w-9"} rounded-full bg-background/70 border border-festival-teal/25 flex items-center justify-center ${ROLE_META[role].tone}`}>
                            <Icon className={isStrip ? "h-3 w-3" : "h-4 w-4"} />
                          </div>
                          <div>
                            <p className={`${isStrip ? "text-sm" : ""} font-medium`}>{ROLE_META[role].label}</p>
                            {!isStrip && <p className="text-xs text-muted-foreground">Create a new {ROLE_META[role].label.toLowerCase()} profile.</p>}
                          </div>
                        </div>

                        <div className={`flex items-center ${isStrip ? "gap-1.5" : "gap-2"}`}>
                          <Button
                            size="sm"
                            className={`${isStrip ? "h-6 min-w-[76px] justify-center text-[11px] px-2" : ""} bg-gradient-to-r from-festival-teal to-cyan-400 text-black font-semibold hover:opacity-95 focus-visible:ring-2 focus-visible:ring-primary/60 transition-all`}
                            onClick={async () => {
                              trackAnalyticsEvent('profile_add_role_clicked', { role, action: 'create' });
                              await handleCreateRole(role);
                            }}
                          >
                            Create
                          </Button>
                          {isClaimable && (
                            <Button
                              size="sm"
                              variant="outline"
                              className={`${isStrip ? "h-6 min-w-[76px] justify-center text-[11px] px-2" : ""} border-festival-teal/30 bg-background/45 hover:bg-festival-teal/15 focus-visible:ring-2 focus-visible:ring-festival-teal/60 transition-colors`}
                              onClick={() => {
                                trackAnalyticsEvent('profile_add_role_clicked', { role, action: 'claim' });
                                openClaim(role as ClaimableEntityType);
                              }}
                            >
                              Claim
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {onSignOut && (
              <div className={`space-y-1 pt-2 border-t border-festival-teal/10 ${isStrip ? "mt-0.5" : ""}`}>
                <div className={`flex items-center gap-2 ${isStrip ? "text-[11px] text-muted-foreground" : "text-sm"} font-medium`}>
                  <LogOut className={isStrip ? "h-3.5 w-3.5" : "h-4 w-4"} />
                  Account
                </div>
                <div className={`flex items-center justify-between gap-2 rounded-lg border border-festival-teal/20 bg-background/40 ${isStrip ? "min-h-[36px] p-1.5" : "p-3"}`}>
                  <div className="flex items-center gap-2">
                    <div className={`${isStrip ? "h-6 w-6" : "h-9 w-9"} rounded-full bg-background/70 border border-festival-teal/20 flex items-center justify-center text-muted-foreground`}>
                      <LogOut className={isStrip ? "h-3 w-3" : "h-4 w-4"} />
                    </div>
                    <div>
                      <p className={`${isStrip ? "text-sm" : ""} font-medium`}>Sign Out</p>
                      {!isStrip && <p className="text-xs text-muted-foreground">End your current session.</p>}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    className={`${isStrip ? "h-6 min-w-[76px] justify-center text-[11px] px-2" : ""} text-red-400 hover:text-red-300 hover:bg-red-500/10 focus-visible:ring-2 focus-visible:ring-red-400/50 transition-colors`}
                    onClick={onSignOut}
                  >
                    Sign Out
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={claimOpen} onOpenChange={setClaimOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="pb-1">
            <DialogTitle>Claim {ROLE_META[claimType].label} profile</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            <div className="space-y-2">
              <Label>Search by name</Label>
              <Input
                value={claimQuery}
                onChange={(e) => setClaimQuery(e.target.value)}
                placeholder="Type a name"
                className="focus-visible:ring-2 focus-visible:ring-primary/60"
              />
            </div>

            {claimError && <p className="text-sm text-destructive">{claimError}</p>}

            <div className="max-h-72 overflow-auto rounded-md border border-border">
              {claimPending ? (
                <div className="p-3 text-sm text-muted-foreground">Searching…</div>
              ) : claimResults.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">
                  {claimQuery.trim() ? "No matches." : "Start typing to search."}
                </div>
              ) : (
                <div className="divide-y">
                  {claimResults.map((row) => (
                    <div key={row.id} className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{row.name}</p>
                      </div>
                      <Button size="sm" className="focus-visible:ring-2 focus-visible:ring-primary/60" onClick={() => claimEntity(row.id)} disabled={claimPending}>
                        Claim
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="ghost" className="focus-visible:ring-2 focus-visible:ring-primary/60" onClick={() => setClaimOpen(false)} disabled={claimPending}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
