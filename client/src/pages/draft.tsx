import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Users, ListOrdered, Volleyball } from "lucide-react";
import TeamCard from "@/components/TeamCard";
import { type NFLTeam, type DraftPick, type DraftStatus } from "@shared/schema";
import { NFL_DIVISIONS, NFL_TEAM_COLORS } from "@/lib/constants";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getCurrentUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { type League } from "@shared/schema";

export default function Draft() {
  const [selectedTeamForDraft, setSelectedTeamForDraft] = useState<NFLTeam | null>(null);
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

  const { data: teams } = useQuery<NFLTeam[]>({
    queryKey: ["/api/teams"],
  });

  const { data: draftPicks, isLoading: picksLoading } = useQuery<DraftPick[]>({
    queryKey: ["/api/leagues", leagueId, "draft", "picks"],
  });

  const { data: draftStatus } = useQuery<DraftStatus>({
    queryKey: ["/api/leagues", leagueId, "draft", "status"],
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
    
    if (draftPicks) {
      draftPicks.forEach((pick) => {
        drafted.add(pick.teamId!);
        // You'd need to fetch user info to get display name
        draftedBy[pick.teamId!] = "Player"; // Simplified for demo
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
              {currentLeague?.sport || "NFL"} • {currentLeague?.season || "2024-25"} • DRAFT
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
                      {draftStatus.currentPlayer}
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
                    <div className="text-sm text-retro-charcoal opacity-75">Previous Team Selected</div>
                    <div className="text-lg font-bold text-retro-purple retro-font">
                      {draftPicks && draftPicks.length > 0 ? (
                        (() => {
                          const lastPick = draftPicks[draftPicks.length - 1];
                          const lastTeam = teams?.find(t => t.id === lastPick.teamId);
                          return lastTeam ? `${lastTeam.city} ${lastTeam.name}` : "No picks yet";
                        })()
                      ) : (
                        "No picks yet"
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
                      // Use embedded team data from the API response
                      const team = (pick as any).team || teams?.find(t => t.id === pick.teamId);
                      const user = (pick as any).user;
                      const teamColors = team?.abbreviation ? NFL_TEAM_COLORS[team.abbreviation as keyof typeof NFL_TEAM_COLORS] : null;
                      return (
                        <div key={pick.id} className="p-3 rounded-lg border-2 border-retro-teal shadow-lg"
                             style={{ 
                               backgroundColor: teamColors?.background || '#f3f4f6',
                               color: teamColors?.font || '#374151'
                             }}>
                          <div className="flex justify-between items-center">
                            <div className="flex-1">
                              <div className="font-bold retro-font text-lg">
                                {team ? `${team.city} ${team.name}` : `Team ${pick.teamId}`}
                              </div>
                              <div className="text-sm font-semibold opacity-75">
                                Pick #{pick.pickNumber} • Round {pick.round}
                              </div>
                            </div>
                            <div className="text-sm text-right">
                              <div className="font-bold">{user?.displayName || "Player"}</div>
                              <div className="opacity-75">{team?.division || "Division"}</div>
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
              <h3 className="text-retro-purple text-2xl font-bold mb-6 text-center retro-font">
                <Volleyball className="inline mr-2" />
                NFL TEAMS - 2024 SEASON
              </h3>

              {/* Two Column Layout: AFC Left, NFC Right */}
              <div className="grid grid-cols-2 gap-6">
                {/* AFC Column */}
                <div>
                  <h4 className="text-retro-purple text-lg font-bold mb-4 text-center retro-font">AFC</h4>
                  {["AFC East", "AFC North", "AFC South", "AFC West"].map((division) => {
                    const divisionTeams = teams?.filter(team => {
                      const divisionTeamIds = NFL_DIVISIONS[division as keyof typeof NFL_DIVISIONS];
                      return divisionTeamIds && divisionTeamIds.includes(team.abbreviation);
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
                      return divisionTeamIds && divisionTeamIds.includes(team.abbreviation);
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
                  backgroundColor: NFL_TEAM_COLORS[selectedTeamForDraft.abbreviation as keyof typeof NFL_TEAM_COLORS]?.background || '#f3f4f6',
                  color: NFL_TEAM_COLORS[selectedTeamForDraft.abbreviation as keyof typeof NFL_TEAM_COLORS]?.font || '#374151'
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
