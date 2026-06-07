import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Users, Activity, Bell, CheckCircle, Clock, AlertCircle, XCircle, Smartphone, RefreshCw, LayoutGrid } from "lucide-react";
import { Link } from "wouter";
import { getCurrentUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type SuperDashboardUser = {
  id: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean | null;
  notifications: boolean | null;
  draftNotifications: boolean | null;
  standingsNotifications: boolean | null;
  verifiedAt: string | null;
  createdAt: string | null;
  pushSubCount: number;
  leaguesBySport: Record<string, number>;
};

type SuperDashboardLeague = {
  id: string;
  name: string;
  sport: string;
  season: string;
  maxPlayers: number;
  draftStatus: string;
  seasonStatus: string;
  memberCount: number;
  pickCount: number;
  isStalled: boolean;
};

type SuperDashboardData = {
  users: SuperDashboardUser[];
  leagues: SuperDashboardLeague[];
  pushStats: {
    totalSubscriptions: number;
    byUser: Array<{ userId: string; displayName: string; count: number }>;
  };
  syncStatuses: Array<{
    sport: string;
    lastSyncAt: string | null;
    lastSuccessAt: string | null;
    lastDurationMs: number | null;
    lastError: string | null;
  }>;
};

type SportSyncStatus = {
  sport: string;
  cadence: "live" | "idle" | "quiet" | "off_season";
  intervalLabel: string;
  liveGameInProgress: boolean;
  inSeason: boolean;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastDurationMs: number | null;
  lastError: string | null;
};

function cadenceBadgeStyle(cadence: SportSyncStatus["cadence"]) {
  switch (cadence) {
    case "live":       return "bg-green-500 text-white";
    case "idle":       return "bg-blue-500 text-white";
    case "quiet":      return "bg-gray-500 text-white";
    case "off_season": return "bg-gray-700 text-gray-300";
  }
}

function fmtRelative(ts: string | null): string {
  if (!ts) return "Never";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function activationStatus(user: SuperDashboardUser): { label: string; color: string } {
  if (user.verifiedAt) return { label: "VERIFIED", color: "bg-green-500 text-white" };
  return { label: "UNVERIFIED", color: "bg-yellow-500 text-black" };
}

function sportBadgeColor(sport: string): string {
  switch (sport) {
    case "NFL": return "bg-blue-600 text-white";
    case "MLB": return "bg-red-600 text-white";
    case "NBA": return "bg-orange-500 text-white";
    case "WORLD_CUP": return "bg-green-600 text-white";
    default: return "bg-gray-500 text-white";
  }
}

function draftStatusColor(status: string): string {
  switch (status) {
    case "completed": return "bg-green-500 text-white";
    case "active": return "bg-blue-500 text-white";
    default: return "bg-gray-400 text-white";
  }
}

export default function SuperAdmin() {
  const currentUser = getCurrentUser();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  if (!currentUser?.isAdmin) {
    navigate("/");
    return null;
  }

  const { data, isLoading, error } = useQuery<SuperDashboardData>({
    queryKey: ["/api/admin/super-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/admin/super-dashboard", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load dashboard");
      return res.json();
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: syncData, refetch: refetchSync } = useQuery<{ now: string; sports: SportSyncStatus[] }>({
    queryKey: ["/api/admin/sync-status"],
    refetchInterval: 30000,
  });

  const syncMutation = useMutation({
    mutationFn: async (sport: string) => {
      if (sport === "WORLD_CUP") {
        return apiRequest("POST", "/api/admin/sync-world-cup", {});
      }
      return apiRequest("POST", "/api/admin/sync-live-scores", { sport });
    },
    onSuccess: (_res, sport) => {
      toast({
        title: "Sync triggered",
        description: `${sport === "WORLD_CUP" ? "World Cup" : sport} sync completed successfully.`,
      });
      refetchSync();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/super-dashboard"] });
    },
    onError: (_err, sport) => {
      toast({
        title: "Sync failed",
        description: `Could not sync ${sport === "WORLD_CUP" ? "World Cup" : sport}. Check server logs.`,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-retro-yellow" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-retro-yellow retro-font neon-glow">
                SUPER ADMIN
              </h1>
              <p className="text-white/70 text-sm retro-font">Platform-wide read-only overview</p>
            </div>
          </div>
          <Link href="/admin/draft-board">
            <Button size="sm" className="bg-teal-700 hover:bg-teal-600 text-white flex items-center gap-1">
              <LayoutGrid className="w-4 h-4" />
              Draft Board Preview
            </Button>
          </Link>
        </div>

        {isLoading && (
          <div className="text-white/70 retro-font text-center py-12">Loading dashboard data...</div>
        )}

        {error && (
          <Card className="border-2 border-red-500 bg-retro-charcoal/80">
            <CardContent className="p-4 text-red-400 retro-font">
              Failed to load dashboard data. Make sure you are logged in as an admin.
            </CardContent>
          </Card>
        )}

        {data && (
          <>
            {/* Summary row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "TOTAL USERS", value: data.users.length, icon: Users, color: "text-retro-yellow" },
                { label: "TOTAL LEAGUES", value: data.leagues.length, icon: Activity, color: "text-retro-teal" },
                { label: "PUSH SUBS", value: data.pushStats.totalSubscriptions, icon: Bell, color: "text-retro-pink" },
                { label: "STALLED LEAGUES", value: data.leagues.filter(l => l.isStalled).length, icon: AlertCircle, color: "text-retro-orange" },
              ].map(({ label, value, icon: Icon, color }) => (
                <Card key={label} className="border-2 border-retro-teal/40 bg-retro-charcoal/80">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Icon className={`w-6 h-6 ${color}`} />
                    <div>
                      <div className={`text-2xl font-bold retro-font ${color}`}>{value}</div>
                      <div className="text-white/60 text-xs retro-font">{label}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* User Roster Panel */}
            <Card className="border-2 border-retro-teal bg-retro-charcoal/80">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-retro-yellow" />
                  <h2 className="text-lg font-bold text-retro-yellow retro-font">USER ROSTER</h2>
                  <span className="text-white/50 text-sm retro-font">({data.users.length} users)</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-retro-teal/30">
                        {["Display Name", "Email", "Status", "Email Notif", "Draft Notif", "Standings Notif", "Push Subs", "Leagues"].map(h => (
                          <th key={h} className="text-left py-2 px-2 text-white/60 retro-font text-xs font-bold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.users.map(user => {
                        const status = activationStatus(user);
                        const sportEntries = Object.entries(user.leaguesBySport);
                        return (
                          <tr key={user.id} className="border-b border-white/5 hover:bg-white/5">
                            <td className="py-2 px-2 retro-font text-white font-bold whitespace-nowrap">
                              {user.displayName}
                              {user.isAdmin && (
                                <Badge className="ml-2 bg-retro-pink text-white text-[10px] px-1 py-0">ADMIN</Badge>
                              )}
                            </td>
                            <td className="py-2 px-2 text-white/70 text-xs">{user.email}</td>
                            <td className="py-2 px-2">
                              <Badge className={`text-[10px] px-1.5 py-0.5 retro-font ${status.color}`}>
                                {status.label}
                              </Badge>
                            </td>
                            <td className="py-2 px-2 text-center">
                              {user.notifications ? (
                                <CheckCircle className="w-4 h-4 text-green-400 mx-auto" />
                              ) : (
                                <XCircle className="w-4 h-4 text-gray-500 mx-auto" />
                              )}
                            </td>
                            <td className="py-2 px-2 text-center">
                              {user.draftNotifications ? (
                                <CheckCircle className="w-4 h-4 text-green-400 mx-auto" />
                              ) : (
                                <XCircle className="w-4 h-4 text-gray-500 mx-auto" />
                              )}
                            </td>
                            <td className="py-2 px-2 text-center">
                              {user.standingsNotifications ? (
                                <CheckCircle className="w-4 h-4 text-green-400 mx-auto" />
                              ) : (
                                <XCircle className="w-4 h-4 text-gray-500 mx-auto" />
                              )}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <span className="text-white font-bold retro-font">{user.pushSubCount}</span>
                            </td>
                            <td className="py-2 px-2">
                              {sportEntries.length === 0 ? (
                                <span className="text-white/30 text-xs">—</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {sportEntries.map(([sport, count]) => (
                                    <Badge key={sport} className={`text-[10px] px-1.5 py-0 retro-font ${sportBadgeColor(sport)}`}>
                                      {sport === "WORLD_CUP" ? "WC" : sport} {count > 1 ? `×${count}` : ""}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* League Health Panel */}
            <Card className="border-2 border-retro-teal bg-retro-charcoal/80">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-5 h-5 text-retro-teal" />
                  <h2 className="text-lg font-bold text-retro-teal retro-font">LEAGUE HEALTH</h2>
                  <span className="text-white/50 text-sm retro-font">({data.leagues.length} leagues)</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-retro-teal/30">
                        {["League Name", "Sport", "Season", "Players", "Draft", "Season Status", "Picks", "Health"].map(h => (
                          <th key={h} className="text-left py-2 px-2 text-white/60 retro-font text-xs font-bold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.leagues.map(league => (
                        <tr key={league.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-2 px-2 retro-font text-white font-bold">{league.name}</td>
                          <td className="py-2 px-2">
                            <Badge className={`text-[10px] px-1.5 py-0.5 retro-font ${sportBadgeColor(league.sport)}`}>
                              {league.sport === "WORLD_CUP" ? "WC" : league.sport}
                            </Badge>
                          </td>
                          <td className="py-2 px-2 text-white/70 text-xs retro-font">{league.season}</td>
                          <td className="py-2 px-2 text-white retro-font">
                            {league.memberCount}<span className="text-white/40">/{league.maxPlayers}</span>
                          </td>
                          <td className="py-2 px-2">
                            <Badge className={`text-[10px] px-1.5 py-0.5 retro-font ${draftStatusColor(league.draftStatus)}`}>
                              {league.draftStatus.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="py-2 px-2 text-white/70 text-xs retro-font">{league.seasonStatus.replace("_", " ").toUpperCase()}</td>
                          <td className="py-2 px-2 text-white retro-font text-center">{league.pickCount}</td>
                          <td className="py-2 px-2">
                            {league.isStalled ? (
                              <Badge className="text-[10px] px-1.5 py-0.5 retro-font bg-yellow-500 text-black">STALLED</Badge>
                            ) : (
                              <Badge className="text-[10px] px-1.5 py-0.5 retro-font bg-green-500 text-white">OK</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Bottom row: App Health + Push Reach */}
            <div className="grid md:grid-cols-2 gap-6">

              {/* App Health Panel */}
              <Card className="border-2 border-retro-teal bg-retro-charcoal/80">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-5 h-5 text-retro-pink" />
                    <h2 className="text-lg font-bold text-retro-pink retro-font">APP HEALTH</h2>
                    <span className="text-white/50 text-sm retro-font">(sync status)</span>
                  </div>
                  <div className="space-y-3">
                    {["NFL", "MLB", "NBA", "WORLD_CUP"].map(sport => {
                      const row = data.syncStatuses.find(s => s.sport === sport);
                      const liveRow = syncData?.sports.find(s => s.sport === sport);
                      const isSyncing = syncMutation.isPending && syncMutation.variables === sport;
                      return (
                        <div key={sport} className="rounded-lg border border-white/10 p-3 bg-white/5">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge className={`text-[10px] px-1.5 py-0.5 retro-font ${sportBadgeColor(sport)}`}>
                                {sport === "WORLD_CUP" ? "WORLD CUP" : sport}
                              </Badge>
                              {liveRow && (
                                <Badge className={`text-[10px] px-1.5 py-0.5 retro-font ${cadenceBadgeStyle(liveRow.cadence)}`}>
                                  {liveRow.intervalLabel}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {row?.lastError ? (
                                <AlertCircle className="w-4 h-4 text-red-400" />
                              ) : row?.lastSuccessAt ? (
                                <CheckCircle className="w-4 h-4 text-green-400" />
                              ) : (
                                <Clock className="w-4 h-4 text-white/40" />
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-[10px] retro-font border-retro-teal/50 text-retro-teal hover:bg-retro-teal/20"
                                disabled={isSyncing}
                                onClick={() => syncMutation.mutate(sport)}
                              >
                                <RefreshCw className={`w-3 h-3 mr-1 ${isSyncing ? "animate-spin" : ""}`} />
                                {isSyncing ? "SYNCING…" : "SYNC NOW"}
                              </Button>
                            </div>
                          </div>
                          <div className="text-xs text-white/70 retro-font space-y-0.5">
                            <div>Last sync: <span className="text-white">{fmtRelative(row?.lastSyncAt ?? null)}</span></div>
                            <div>Last success: <span className="text-green-400">{fmtRelative(row?.lastSuccessAt ?? null)}</span></div>
                            {row?.lastDurationMs != null && (
                              <div>Duration: <span className="text-white">{row.lastDurationMs}ms</span></div>
                            )}
                            {row?.lastError && (
                              <div className="text-red-400 truncate" title={row.lastError}>
                                Error: {row.lastError.substring(0, 80)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Push Notification Reach Panel */}
              <Card className="border-2 border-retro-teal bg-retro-charcoal/80">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Bell className="w-5 h-5 text-retro-orange" />
                    <h2 className="text-lg font-bold text-retro-orange retro-font">PUSH REACH</h2>
                    <span className="text-white/50 text-sm retro-font">
                      ({data.pushStats.totalSubscriptions} total subs)
                    </span>
                  </div>
                  {data.pushStats.totalSubscriptions === 0 ? (
                    <p className="text-white/50 retro-font text-sm">No push subscriptions yet.</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="rounded-lg border border-retro-orange/30 p-3 bg-retro-orange/10 mb-3 flex items-center gap-3">
                        <Smartphone className="w-5 h-5 text-retro-orange" />
                        <div>
                          <div className="text-2xl font-bold text-retro-orange retro-font">
                            {data.pushStats.totalSubscriptions}
                          </div>
                          <div className="text-white/60 text-xs retro-font">active device subscriptions</div>
                        </div>
                        <div className="ml-auto text-right">
                          <div className="text-lg font-bold text-white retro-font">
                            {data.pushStats.byUser.length}
                          </div>
                          <div className="text-white/60 text-xs retro-font">users subscribed</div>
                        </div>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-1.5 px-2 text-white/50 retro-font text-xs">User</th>
                            <th className="text-right py-1.5 px-2 text-white/50 retro-font text-xs">Devices</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.pushStats.byUser.map(u => (
                            <tr key={u.userId} className="border-b border-white/5 hover:bg-white/5">
                              <td className="py-1.5 px-2 text-white retro-font">{u.displayName}</td>
                              <td className="py-1.5 px-2 text-right">
                                <Badge className="bg-retro-orange text-white retro-font text-[10px]">
                                  {u.count}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
