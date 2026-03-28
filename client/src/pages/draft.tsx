import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Users, ListOrdered, Volleyball } from "lucide-react";
import TeamCard from "@/components/TeamCard";
import { type NFLTeam, type MLBTeam, type NBATeam, type WorldCupTeam, type DraftPick, type DraftStatus } from "@shared/schema";
import { NFL_DIVISIONS, MLB_DIVISIONS, NBA_DIVISIONS, NFL_TEAM_COLORS, MLB_TEAM_COLORS, NBA_TEAM_COLORS, WC_GROUPS, WC_CONFEDERATION_COLORS } from "@/lib/constants";
import { FlagImage } from "@/lib/flagUtils";

// Helper function to check if team belongs to division
const isTeamInDivision = (teamAbbr: string, divisionTeams: readonly string[]): boolean => {
  return divisionTeams.includes(teamAbbr);
};
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getCurrentUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { type League } from "@shared/schema";

export default function Draft() {
  const [selectedTeamForDraft, setSelectedTeamForDraft] = useState<NFLTeam | MLBTeam | NBATeam | null>(null);
  const [showDraftConfirmation, setShowDraftConfirmation] = useState(false);

  const currentUser = getCurrentUser();
  const { toast } = useToast();
  
  // Get league ID from URL params or default to first league
  const urlParams = new URLSearchParams(window.location.search);
  const urlLeagueId = urlParams.get('league');
  
  const { data: userLeagues } = useQuery<League[]>({
    queryKey: ["/api/users", currentUser?.id, "leagues"],
    enabled: !!currentUser?.id,
  });

  // Determine current league
  const leagueId = urlLeagueId || userLeagues?.[0]?.id || "demo-league-1";
  const currentLeague = userLeagues?.find(league => league.id === leagueId) || userLeagues?.[0];

  const sportTeamsPath = currentLeague?.sport === 'WORLD_CUP'
    ? '/api/world-cup/teams'
    : `/api/${currentLeague?.sport?.toLowerCase() || 'nfl'}/teams`;

  const { data: teams } = useQuery<(NFLTeam | MLBTeam | NBATeam | WorldCupTeam)[]>({
    queryKey: [sportTeamsPath],
    enabled: !!currentLeague?.sport,
  });

  const { data: draftStatus } = useQuery<DraftStatus>({
    queryKey: ["/api/leagues", leagueId, "draft", "status"],
    refetchInterval: 3000, // Always poll draft status for immediate admin feedback
  });

  const { data: draftPicks, isLoading: picksLoading } = useQuery<DraftPick[]>({
    queryKey: ["/api/leagues", leagueId, "draft", "picks"],
    refetchInterval: draftStatus?.isActive ? 3000 : 30000, // 3s when active, 30s when inactive
  });

  const { data: userPicks } = useQuery<DraftPick[]>({
    queryKey: ["/api/leagues", leagueId, "users", currentUser?.id, "picks"],
    enabled: !!currentUser?.id,
  });



  const draftPickMutation = useMutation({
    mutationFn: async (teamId: string) => {
      const pickNumber = (draftPicks?.length || 0) + 1;
      const round = Math.ceil(pickNumber / 8); // Assuming 8 players
      
      return apiRequest("POST", `/api/leagues/${leagueId}/draft/picks`, {
        userId: currentUser?.id,
        teamId,
        pickNumber,
        round,
        sport: currentLeague?.sport || 'NFL',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leagues", leagueId, "draft"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({
        title: "Team drafted successfully!",
        description: "Your pick has been recorded.",
      });
    },
    onError: () => {
      toast({
        title: "Draft failed",
        description: "Failed to draft team. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleTeamSelect = (teamId: string) => {
    if (!drafted.has(teamId) && isCurrentUserTurn) {
      const team = teams?.find(t => t.id === teamId);
      if (team) {
        setSelectedTeamForDraft(team);
        setShowDraftConfirmation(true);
      }
    }
  };

  const confirmDraftPick = () => {
    if (selectedTeamForDraft) {
      draftPickMutation.mutate(selectedTeamForDraft.id);
      setShowDraftConfirmation(false);
      setSelectedTeamForDraft(null);
    }
  };

  const cancelDraftPick = () => {
    setShowDraftConfirmation(false);
    setSelectedTeamForDraft(null);
  };

  const getDraftedTeams = () => {
    const drafted = new Set<string>();
    const draftedBy: { [teamId: string]: string } = {};
    
    if (draftPicks && teams) {
      draftPicks.forEach((pick) => {
        // Find the team to get both ID and abbreviation
        const team = teams.find(t => t.id === pick.teamId || t.abbreviation === pick.teamId);
        if (team) {
          // Add both team ID and abbreviation to the drafted set
          drafted.add(team.id);
          drafted.add(team.abbreviation);
          draftedBy[team.id] = "Player"; // Simplified for demo
          draftedBy[team.abbreviation] = "Player";
        } else {
          // Fallback to just the teamId if team not found
          drafted.add(pick.teamId!);
          draftedBy[pick.teamId!] = "Player";
        }
      });
    }
    
    return { drafted, draftedBy };
  };

  const { drafted, draftedBy } = getDraftedTeams();



  const isCurrentUserTurn = draftStatus?.currentPlayer === currentUser?.displayName;

  return (
    <>
      {/* Hero Section */}
      <section className="text-center mb-12">
        <div className="bg-gradient-to-r from-retro-teal to-retro-purple p-8 rounded-3xl retro-border">
          <div className="bg-retro-charcoal rounded-xl p-4 bg-opacity-80">
            <h2 className="text-retro-yellow text-2xl sm:text-3xl md:text-4xl font-bold mb-3 neon-glow retro-font">
              {currentLeague?.name || "TOTAL WINS"}
            </h2>
            <p className="text-white text-sm sm:text-base md:text-lg font-bold">
              {currentLeague?.sport || "NFL"} • {currentLeague?.season || "2025-26"} • DRAFT
            </p>
            <div className="mt-3 flex justify-center space-x-2 flex-wrap gap-2">
              <Badge className="bg-retro-lime text-retro-charcoal px-3 py-1 rounded-full font-bold text-xs">
                LIVE
              </Badge>
              <Badge className={`px-3 py-1 rounded-full font-bold text-xs ${
                !draftStatus?.isActive 
                  ? "bg-gray-500 text-white" 
                  : draftStatus.currentPick <= 32 
                    ? "bg-retro-teal text-white" 
                    : "bg-retro-orange text-white"
              }`}>
                {!draftStatus?.isActive 
                  ? "DRAFT NOT STARTED" 
                  : draftStatus.currentPick <= 32 
                    ? "DRAFT IN PROGRESS" 
                    : "DRAFT COMPLETED"}
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Draft Interface */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Draft Order & Status */}
        <div className="lg:col-span-1">
          <Card className="bg-white rounded-2xl retro-border mb-6 shadow-xl">
            <CardContent className="p-6">
              <h3 className="text-retro-purple text-xl font-bold mb-4 retro-font">
                <ListOrdered className="inline mr-2" />
                DRAFT STATUS
              </h3>
              
              {draftStatus && (
                <div className="space-y-3">
                  <div className={`p-3 rounded-lg ${isCurrentUserTurn ? "bg-gradient-to-r from-retro-yellow to-retro-orange" : "bg-retro-cream"}`}>
                    <div className="text-sm text-retro-charcoal opacity-75">Current Player</div>
                    <div className="text-lg font-bold text-retro-charcoal retro-font">
                      {draftStatus.currentPlayer || "—"}
                      {isCurrentUserTurn && (
                        <Badge className="ml-2 bg-retro-purple text-white animate-pulse">
                          YOUR TURN
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="bg-retro-cream p-3 rounded-lg">
                    <div className="text-sm text-retro-charcoal opacity-75">Current Pick</div>
                    <div className="text-xl font-bold text-retro-purple retro-font">
                      #{draftStatus.currentPick}
                    </div>
                  </div>
                  <div className="bg-retro-cream p-3 rounded-lg">
                    <div className="text-sm text-retro-charcoal opacity-75">Last Pick</div>
                    <div className="text-lg font-bold text-retro-purple retro-font">
                      {draftPicks && draftPicks.length > 0 ? (
                        (() => {
                          const lastPick = draftPicks[draftPicks.length - 1];
                          const lastTeam = teams?.find(t => t.id === lastPick.teamId);
                          return lastTeam
                            ? (currentLeague?.sport === 'WORLD_CUP'
                                ? lastTeam.name
                                : `${lastTeam.city} ${lastTeam.name}`)
                            : "none";
                        })()
                      ) : (
                        "none"
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Draft Picks */}
          <Card className="bg-gradient-to-br from-retro-orange to-retro-pink rounded-2xl text-white shadow-xl">
            <CardContent className="p-6">
              <h3 className="text-retro-purple text-xl font-bold mb-4 retro-font">
                <Users className="inline mr-2" />
                RECENT PICKS
              </h3>
              
              <div className="h-96 overflow-y-auto space-y-2 bg-black bg-opacity-20 rounded-lg p-2">
                {picksLoading ? (
                  <div className="text-center py-8">
                    <p className="text-white text-lg font-bold">Loading picks...</p>
                  </div>
                ) : draftPicks && draftPicks.length > 0 ? (
                  <>
                    <div className="text-white text-sm font-bold mb-2">
                      Recent picks (scroll for more)
                    </div>
                    {[...draftPicks].reverse().map((pick, index) => {
                      // Use embedded team data from the API response, or find by teamId or abbreviation
                      const team = (pick as any).team || teams?.find(t => 
                        t.id === pick.teamId || t.abbreviation === pick.teamId
                      );
                      const user = (pick as any).user;
                      const getTeamColors = () => {
                        switch (currentLeague?.sport) {
                          case 'MLB':
                            return MLB_TEAM_COLORS;
                          case 'NBA':
                            return NBA_TEAM_COLORS;
                          default:
                            return NFL_TEAM_COLORS;
                        }
                      };
                      const teamColorsMap = getTeamColors();
                      const teamColors = team?.abbreviation ? teamColorsMap[team.abbreviation as keyof typeof teamColorsMap] : null;
                      return (
                        <div key={pick.id} className="p-3 rounded-lg border-2 border-retro-teal shadow-lg"
                             style={{ 
                               backgroundColor: teamColors?.background || '#f3f4f6',
                               color: teamColors?.font || '#374151'
                             }}>
                          <div className="flex justify-between items-center">
                            <div className="flex-1">
                              <div className="font-bold retro-font text-lg">
                                {team
                                  ? (currentLeague?.sport === 'WORLD_CUP'
                                      ? team.name
                                      : `${team.city} ${team.name}`)
                                  : `Team ${pick.teamId}`}
                              </div>
                              <div className="text-sm font-semibold opacity-75">
                                Pick #{pick.pickNumber} • Round {pick.round}
                              </div>
                            </div>
                            <div className="text-sm text-right">
                              <div className="font-bold">{user?.displayName || "Player"}</div>
                              <div className="opacity-75">
                                {currentLeague?.sport === 'WORLD_CUP'
                                  ? (team?.group ? `Group ${team.group}` : '')
                                  : (team?.division || '')}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-white text-lg font-bold">No picks made yet</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Team Selection Grid */}
        <div className="lg:col-span-2">
          <Card className="bg-white rounded-2xl retro-border shadow-xl">
            <CardContent className="p-6">
              <h3 className="text-retro-purple text-2xl font-bold mb-6 text-center retro-font flex items-center justify-center gap-2">
                {currentLeague?.sport === 'MLB' && (
                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center border-2 border-retro-purple">
                    ⚾
                  </div>
                )}
                {currentLeague?.sport === 'NBA' && (
                  <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                    🏀
                  </div>
                )}
                {currentLeague?.sport === 'NFL' && (
                  <div className="w-8 h-8 bg-brown-600 rounded-full flex items-center justify-center">
                    🏈
                  </div>
                )}
                {currentLeague?.sport === 'WORLD_CUP' && (
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                    ⚽
                  </div>
                )}
                {currentLeague?.sport === 'WORLD_CUP' ? "WORLD CUP 2026 TEAMS" : `${currentLeague?.sport || "NFL"} TEAMS`}
              </h3>

              {currentLeague?.sport === 'WORLD_CUP' ? (
                // World Cup Group Layout
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                  {Object.entries(WC_GROUPS).map(([groupName, teamIds]) => {
                    const groupTeams = (teams as WorldCupTeam[] | undefined)?.filter(t => (teamIds as readonly string[]).includes(t.id)) || [];
                    return (
                      <div key={groupName} className="mb-4">
                        <h5 className="text-retro-charcoal font-bold mb-2 text-sm border-b border-gray-200 pb-1">{groupName}</h5>
                        <div className="space-y-2">
                          {groupTeams.map((team) => {
                            const confColors = WC_CONFEDERATION_COLORS[team.confederation] || { background: "#6b7280", font: "#ffffff" };
                            const isDrafted = drafted.has(team.id);
                            return (
                              <button
                                key={team.id}
                                onClick={() => handleTeamSelect(team.id)}
                                disabled={isDrafted || !isCurrentUserTurn || draftPickMutation.isPending}
                                className={`w-full p-2 rounded-lg text-left font-bold transition-all duration-200 cursor-pointer ${
                                  isDrafted ? "opacity-50 cursor-not-allowed" : "hover:opacity-80"
                                }`}
                                style={{
                                  backgroundColor: isDrafted ? '#d1d5db' : confColors.background,
                                  color: isDrafted ? '#6b7280' : confColors.font,
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <FlagImage teamId={team.id} name={team.name} size={22} />
                                  <div className="flex-1 min-w-0">
                                    <div className="retro-font text-sm truncate">{team.placeholder || team.name}</div>
                                    <div className="text-xs opacity-75">{team.confederation}{team.fifaRanking ? ` • #${team.fifaRanking}` : ""}</div>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : currentLeague?.sport === 'NFL' ? (
                // NFL Division Layout
                <div className="grid grid-cols-2 gap-6">
                  {/* AFC Column */}
                  <div>
                    <h4 className="text-retro-purple text-lg font-bold mb-4 text-center retro-font">AFC</h4>
                    {["AFC East", "AFC North", "AFC South", "AFC West"].map((division) => {
                      const divisionTeams = teams?.filter(team => {
                        const divisionTeamIds = NFL_DIVISIONS[division as keyof typeof NFL_DIVISIONS];
                        return divisionTeamIds && isTeamInDivision(team.abbreviation, divisionTeamIds);
                      }) || [];
                      
                      return (
                        <div key={division} className="mb-6">
                          <h5 className="text-retro-charcoal font-bold mb-2 text-sm">{division.replace("AFC ", "")}</h5>
                          <div className="space-y-2">
                            {divisionTeams.map((team) => {
                              const teamColors = NFL_TEAM_COLORS[team.abbreviation as keyof typeof NFL_TEAM_COLORS];
                              return (
                                <button
                                  key={team.id}
                                  onClick={() => handleTeamSelect(team.id)}
                                  disabled={drafted.has(team.id) || !isCurrentUserTurn || draftPickMutation.isPending}
                                  className={`w-full p-3 rounded-lg text-left font-bold transition-all duration-200 cursor-pointer ${
                                    drafted.has(team.id) ? "opacity-50 cursor-not-allowed" : "hover:opacity-80"
                                  }`}
                                  style={{
                                    backgroundColor: drafted.has(team.id) ? '#d1d5db' : teamColors?.background || '#f3f4f6',
                                    color: drafted.has(team.id) ? '#6b7280' : teamColors?.font || '#374151'
                                  }}
                                >
                                  <span className="retro-font">{team.city} {team.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* NFC Column */}
                  <div>
                    <h4 className="text-retro-purple text-lg font-bold mb-4 text-center retro-font">NFC</h4>
                    {["NFC East", "NFC North", "NFC South", "NFC West"].map((division) => {
                      const divisionTeams = teams?.filter(team => {
                        const divisionTeamIds = NFL_DIVISIONS[division as keyof typeof NFL_DIVISIONS];
                        return divisionTeamIds && isTeamInDivision(team.abbreviation, divisionTeamIds);
                      }) || [];
                      
                      return (
                        <div key={division} className="mb-6">
                          <h5 className="text-retro-charcoal font-bold mb-2 text-sm">{division.replace("NFC ", "")}</h5>
                          <div className="space-y-2">
                            {divisionTeams.map((team) => {
                              const teamColors = NFL_TEAM_COLORS[team.abbreviation as keyof typeof NFL_TEAM_COLORS];
                              return (
                                <button
                                  key={team.id}
                                  onClick={() => handleTeamSelect(team.id)}
                                  disabled={drafted.has(team.id) || !isCurrentUserTurn || draftPickMutation.isPending}
                                  className={`w-full p-3 rounded-lg text-left font-bold transition-all duration-200 cursor-pointer ${
                                    drafted.has(team.id) ? "opacity-50 cursor-not-allowed" : "hover:opacity-80"
                                  }`}
                                  style={{
                                    backgroundColor: drafted.has(team.id) ? '#d1d5db' : teamColors?.background || '#f3f4f6',
                                    color: drafted.has(team.id) ? '#6b7280' : teamColors?.font || '#374151'
                                  }}
                                >
                                  <span className="retro-font">{team.city} {team.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : currentLeague?.sport === 'MLB' ? (
                // MLB Division Layout (AL/NL)
                <div className="grid grid-cols-2 gap-6">
                  {/* AL Column */}
                  <div>
                    <h4 className="text-retro-purple text-lg font-bold mb-4 text-center retro-font">American League</h4>
                    {["AL East", "AL Central", "AL West"].map((division) => {
                      const divisionTeams = teams?.filter(team => {
                        const divisionTeamIds = MLB_DIVISIONS[division as keyof typeof MLB_DIVISIONS];
                        return divisionTeamIds && isTeamInDivision(team.abbreviation, divisionTeamIds);
                      }) || [];
                      
                      return (
                        <div key={division} className="mb-6">
                          <h5 className="text-retro-charcoal font-bold mb-2 text-sm">{division.replace("AL ", "")}</h5>
                          <div className="space-y-2">
                            {divisionTeams.map((team) => {
                              const teamColors = MLB_TEAM_COLORS[team.abbreviation as keyof typeof MLB_TEAM_COLORS];
                              return (
                                <button
                                  key={team.id}
                                  onClick={() => handleTeamSelect(team.id)}
                                  disabled={drafted.has(team.id) || !isCurrentUserTurn || draftPickMutation.isPending}
                                  className={`w-full p-3 rounded-lg text-left font-bold transition-all duration-200 cursor-pointer ${
                                    drafted.has(team.id) ? "opacity-50 cursor-not-allowed" : "hover:opacity-80"
                                  }`}
                                  style={{
                                    backgroundColor: drafted.has(team.id) ? '#d1d5db' : teamColors?.background || '#f3f4f6',
                                    color: drafted.has(team.id) ? '#6b7280' : teamColors?.font || '#374151'
                                  }}
                                >
                                  <span className="retro-font">{team.city} {team.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* NL Column */}
                  <div>
                    <h4 className="text-retro-purple text-lg font-bold mb-4 text-center retro-font">National League</h4>
                    {["NL East", "NL Central", "NL West"].map((division) => {
                      const divisionTeams = teams?.filter(team => {
                        const divisionTeamIds = MLB_DIVISIONS[division as keyof typeof MLB_DIVISIONS];
                        return divisionTeamIds && isTeamInDivision(team.abbreviation, divisionTeamIds);
                      }) || [];
                      
                      return (
                        <div key={division} className="mb-6">
                          <h5 className="text-retro-charcoal font-bold mb-2 text-sm">{division.replace("NL ", "")}</h5>
                          <div className="space-y-2">
                            {divisionTeams.map((team) => {
                              const teamColors = MLB_TEAM_COLORS[team.abbreviation as keyof typeof MLB_TEAM_COLORS];
                              return (
                                <button
                                  key={team.id}
                                  onClick={() => handleTeamSelect(team.id)}
                                  disabled={drafted.has(team.id) || !isCurrentUserTurn || draftPickMutation.isPending}
                                  className={`w-full p-3 rounded-lg text-left font-bold transition-all duration-200 cursor-pointer ${
                                    drafted.has(team.id) ? "opacity-50 cursor-not-allowed" : "hover:opacity-80"
                                  }`}
                                  style={{
                                    backgroundColor: drafted.has(team.id) ? '#d1d5db' : teamColors?.background || '#f3f4f6',
                                    color: drafted.has(team.id) ? '#6b7280' : teamColors?.font || '#374151'
                                  }}
                                >
                                  <span className="retro-font">{team.city} {team.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : currentLeague?.sport === 'NBA' ? (
                // NBA Division Layout (East/West)
                <div className="grid grid-cols-2 gap-6">
                  {/* Eastern Conference */}
                  <div>
                    <h4 className="text-retro-purple text-lg font-bold mb-4 text-center retro-font">Eastern Conference</h4>
                    {["Atlantic", "Central", "Southeast"].map((division) => {
                      const divisionTeams = teams?.filter(team => {
                        const divisionTeamIds = NBA_DIVISIONS[division as keyof typeof NBA_DIVISIONS];
                        return divisionTeamIds && isTeamInDivision(team.abbreviation, divisionTeamIds);
                      }) || [];
                      
                      return (
                        <div key={division} className="mb-6">
                          <h5 className="text-retro-charcoal font-bold mb-2 text-sm">{division}</h5>
                          <div className="space-y-2">
                            {divisionTeams.map((team) => {
                              const teamColors = NBA_TEAM_COLORS[team.abbreviation as keyof typeof NBA_TEAM_COLORS];
                              return (
                                <button
                                  key={team.id}
                                  onClick={() => handleTeamSelect(team.id)}
                                  disabled={drafted.has(team.id) || !isCurrentUserTurn || draftPickMutation.isPending}
                                  className={`w-full p-3 rounded-lg text-left font-bold transition-all duration-200 cursor-pointer ${
                                    drafted.has(team.id) ? "opacity-50 cursor-not-allowed" : "hover:opacity-80"
                                  }`}
                                  style={{
                                    backgroundColor: drafted.has(team.id) ? '#d1d5db' : teamColors?.background || '#f3f4f6',
                                    color: drafted.has(team.id) ? '#6b7280' : teamColors?.font || '#374151'
                                  }}
                                >
                                  <span className="retro-font">{team.city} {team.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Western Conference */}
                  <div>
                    <h4 className="text-retro-purple text-lg font-bold mb-4 text-center retro-font">Western Conference</h4>
                    {["Northwest", "Pacific", "Southwest"].map((division) => {
                      const divisionTeams = teams?.filter(team => {
                        const divisionTeamIds = NBA_DIVISIONS[division as keyof typeof NBA_DIVISIONS];
                        return divisionTeamIds && isTeamInDivision(team.abbreviation, divisionTeamIds);
                      }) || [];
                      
                      return (
                        <div key={division} className="mb-6">
                          <h5 className="text-retro-charcoal font-bold mb-2 text-sm">{division}</h5>
                          <div className="space-y-2">
                            {divisionTeams.map((team) => {
                              const teamColors = NBA_TEAM_COLORS[team.abbreviation as keyof typeof NBA_TEAM_COLORS];
                              return (
                                <button
                                  key={team.id}
                                  onClick={() => handleTeamSelect(team.id)}
                                  disabled={drafted.has(team.id) || !isCurrentUserTurn || draftPickMutation.isPending}
                                  className={`w-full p-3 rounded-lg text-left font-bold transition-all duration-200 cursor-pointer ${
                                    drafted.has(team.id) ? "opacity-50 cursor-not-allowed" : "hover:opacity-80"
                                  }`}
                                  style={{
                                    backgroundColor: drafted.has(team.id) ? '#d1d5db' : teamColors?.background || '#f3f4f6',
                                    color: drafted.has(team.id) ? '#6b7280' : teamColors?.font || '#374151'
                                  }}
                                >
                                  <span className="retro-font">{team.city} {team.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // Fallback Simple Grid Layout
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {teams?.map((team) => {
                    const getTeamColors = () => {
                      switch (currentLeague?.sport) {
                        case 'MLB':
                          return MLB_TEAM_COLORS;
                        case 'NBA':
                          return NBA_TEAM_COLORS;
                        default:
                          return NFL_TEAM_COLORS;
                      }
                    };
                    const teamColorsMap = getTeamColors();
                    const teamColors = teamColorsMap[team.abbreviation as keyof typeof teamColorsMap];
                    
                    return (
                      <button
                        key={team.id}
                        onClick={() => handleTeamSelect(team.id)}
                        disabled={drafted.has(team.id) || !isCurrentUserTurn || draftPickMutation.isPending}
                        className={`w-full p-3 rounded-lg text-left font-bold transition-all duration-200 cursor-pointer ${
                          drafted.has(team.id) ? "opacity-50 cursor-not-allowed" : "hover:opacity-80"
                        }`}
                        style={{
                          backgroundColor: drafted.has(team.id) ? '#d1d5db' : teamColors?.background || '#f3f4f6',
                          color: drafted.has(team.id) ? '#6b7280' : teamColors?.font || '#374151'
                        }}
                      >
                        <div className="flex justify-between items-center">
                          <span className="retro-font">{team.city} {team.name}</span>
                          <span className="text-xs opacity-75">{team.abbreviation}</span>
                        </div>
                        {team.division && (
                          <div className="text-xs opacity-60 mt-1">{team.division}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Draft Confirmation Modal */}
      <Dialog open={showDraftConfirmation} onOpenChange={setShowDraftConfirmation}>
        <DialogContent className="bg-white rounded-2xl retro-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-retro-purple text-xl font-bold retro-font text-center">
              Confirm Your Draft Pick
            </DialogTitle>
          </DialogHeader>
          
          {selectedTeamForDraft && (
            <div className="my-6">
              <div 
                className="p-4 rounded-lg border-2 border-retro-teal shadow-lg text-center"
                style={{
                  backgroundColor: (() => {
                    const getTeamColors = () => {
                      switch (currentLeague?.sport) {
                        case 'MLB':
                          return MLB_TEAM_COLORS;
                        case 'NBA':
                          return NBA_TEAM_COLORS;
                        default:
                          return NFL_TEAM_COLORS;
                      }
                    };
                    const teamColorsMap = getTeamColors();
                    return teamColorsMap[selectedTeamForDraft.abbreviation as keyof typeof teamColorsMap]?.background || '#f3f4f6';
                  })(),
                  color: (() => {
                    const getTeamColors = () => {
                      switch (currentLeague?.sport) {
                        case 'MLB':
                          return MLB_TEAM_COLORS;
                        case 'NBA':
                          return NBA_TEAM_COLORS;
                        default:
                          return NFL_TEAM_COLORS;
                      }
                    };
                    const teamColorsMap = getTeamColors();
                    return teamColorsMap[selectedTeamForDraft.abbreviation as keyof typeof teamColorsMap]?.font || '#374151';
                  })()
                }}
              >
                <div className="text-2xl font-bold retro-font">
                  {selectedTeamForDraft.city} {selectedTeamForDraft.name}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-center gap-4">
            <Button
              variant="outline"
              onClick={cancelDraftPick}
              className="px-6 py-2 border-retro-charcoal text-retro-charcoal hover:bg-retro-cream"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDraftPick}
              disabled={draftPickMutation.isPending}
              className="px-6 py-2 bg-retro-teal hover:bg-retro-purple text-white font-bold retro-font"
            >
              {draftPickMutation.isPending ? "Drafting..." : "Draft Team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
