import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Clock, TrendingUp } from "lucide-react";
import StandingsTable from "@/components/StandingsTable";
import { type Game, type League } from "@shared/schema";
import { CURRENT_SEASON, NFL_TEAM_COLORS, MLB_TEAM_COLORS, NBA_TEAM_COLORS } from "@/lib/constants";
import { getCurrentUser } from "@/lib/auth";

export default function Standings() {
  const currentUser = getCurrentUser();
  
  // Get league ID from URL params or default to first league
  const urlParams = new URLSearchParams(window.location.search);
  const urlLeagueId = urlParams.get('league');
  
  const { data: userLeagues } = useQuery<League[]>({
    queryKey: ["/api/users", currentUser?.id, "leagues"],
    enabled: !!currentUser?.id,
  });

  // Determine current league
  const leagueId = urlLeagueId || userLeagues?.[0]?.id || "demo-league-1";

  const { data: recentGames } = useQuery<any[]>({
    queryKey: ["/api/leagues", leagueId, "games/recent"],
    refetchInterval: 60000, // Poll every 1 minute for live game updates
  });

  const { data: upcomingGames } = useQuery<any[]>({
    queryKey: ["/api/leagues", leagueId, "games/upcoming"],
    refetchInterval: 300000, // Poll every 5 minutes for upcoming games
  });
  const currentLeague = userLeagues?.find(league => league.id === leagueId) || userLeagues?.[0];

  // Sport-specific content functions
  const getGamePeriodLabel = () => {
    switch(currentLeague?.sport) {
      case 'NFL': return 'WEEK';
      case 'MLB': return 'SERIES';
      case 'NBA': return 'GAMES';
      default: return 'WEEK';
    }
  };

  const getTeamColors = () => {
    switch(currentLeague?.sport) {
      case 'MLB': return MLB_TEAM_COLORS;
      case 'NBA': return NBA_TEAM_COLORS;
      default: return NFL_TEAM_COLORS;
    }
  };

  const getCurrentPeriodLabel = () => {
    switch(currentLeague?.sport) {
      case 'NFL': return 'WEEK 9 COMPLETE';
      case 'MLB': return 'SEASON ACTIVE';
      case 'NBA': return 'SEASON ACTIVE';
      default: return 'WEEK 9 COMPLETE';
    }
  };

  const getRecentResultsTitle = () => {
    switch(currentLeague?.sport) {
      case 'NFL': return 'WEEK 9 RESULTS';
      case 'MLB': return "TODAY'S GAMES";
      case 'NBA': return "TODAY'S GAMES";
      default: return 'WEEK 9 RESULTS';
    }
  };

  const getUpcomingTitle = () => {
    switch(currentLeague?.sport) {
      case 'NFL': return 'WEEK 10 PREVIEW';
      case 'MLB': return "TOMORROW'S GAMES";
      case 'NBA': return "TOMORROW'S GAMES";
      default: return 'WEEK 10 PREVIEW';
    }
  };

  // Function to get display abbreviation from team ID
  const getTeamDisplayName = (teamId: string) => {
    if (!teamId) return 'N/A';
    
    // Handle MLB team IDs that end with -MLB
    if (teamId.endsWith('-MLB')) {
      return teamId.replace('-MLB', '');
    }
    
    // Handle NBA team IDs that end with -NBA  
    if (teamId.endsWith('-NBA')) {
      return teamId.replace('-NBA', '');
    }
    
    // For NFL and other teams, return as-is (they're already 3 characters)
    return teamId;
  };

  const getByeWeekTeams = () => {
    // Only NFL has bye weeks
    if (currentLeague?.sport === 'NFL') {
      return {
        current: ['CIN', 'CLE', 'LV', 'NYG'],
        next: ['CHI', 'DAL', 'DET', 'PHI'],
        currentLabel: 'WEEK 9 BYES:',
        nextLabel: 'WEEK 10 BYES:'
      };
    }
    return null;
  };

  return (
    <>
      {/* Hero Section */}
      <section className="text-center mb-8 relative px-4">
        <div className="bg-gradient-to-r from-retro-purple to-retro-pink p-4 sm:p-6 rounded-2xl retro-border mb-6">
          <div className="bg-retro-charcoal rounded-xl p-4 bg-opacity-80">
            <h2 className="text-retro-yellow text-2xl sm:text-3xl md:text-4xl font-bold mb-3 neon-glow retro-font">
              {currentLeague?.name || "TOTAL WINS"}
            </h2>
            <p className="text-white text-sm sm:text-base md:text-lg font-bold">
              {currentLeague?.sport || "NFL"} • {currentLeague?.season || "2024-25"} • STANDINGS
            </p>
            <div className="mt-3 flex justify-center space-x-2 flex-wrap gap-2">
              <Badge className="bg-retro-lime text-retro-charcoal px-3 py-1 rounded-full font-bold text-xs">
                LIVE
              </Badge>
              <Badge className="bg-retro-teal text-white px-3 py-1 rounded-full font-bold text-xs">
                {getCurrentPeriodLabel()}
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Current Standings Table */}
      <section className="mb-8 px-4">
        <h3 className="text-black text-xl sm:text-2xl font-bold mb-2 text-center retro-font">
          <Trophy className="inline text-retro-teal mr-2 w-5 h-5 sm:w-6 sm:h-6" />
          STANDINGS
        </h3>
        <p className="text-xs text-gray-600 text-center mb-4">
          Last updated: {new Date().toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short'
          })}
        </p>
        
        <StandingsTable leagueId={leagueId} />
      </section>

      {/* Recent Updates Section */}
      <section className="mb-8 px-4">
        <h3 className="text-retro-pink text-xl sm:text-2xl font-bold mb-4 text-center retro-font">
          <Clock className="inline text-retro-teal mr-2 w-5 h-5 sm:w-6 sm:h-6" />
          {currentLeague?.sport === 'NFL' && 'NFL GAMES'}
          {currentLeague?.sport === 'MLB' && 'MLB GAMES'}
          {currentLeague?.sport === 'NBA' && 'NBA GAMES'}
          {!currentLeague?.sport && 'NFL GAMES'}
        </h3>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Recent Game Results */}
          <Card className="bg-white rounded-2xl retro-border shadow-xl">
            <CardContent className="p-6">
              <h4 className="text-retro-purple text-xl font-bold mb-4 retro-font">
                {getRecentResultsTitle()}
              </h4>
              <div className="space-y-2">
                {recentGames && recentGames.length > 0 ? (
                  recentGames.map((game) => (
                    <div
                      key={game.id}
                      className="flex justify-between items-center bg-retro-cream p-2 rounded-lg border-l-4 border-retro-lime"
                    >
                      <div className="flex-1">
                        <div className="font-bold text-retro-charcoal retro-font text-xs">
                          {getTeamDisplayName(game.awayTeamId)} @ {getTeamDisplayName(game.homeTeamId)}
                        </div>
                        <div className="text-xs text-retro-charcoal font-bold">
                          {game.status === 'completed' || game.status === 'in_progress' ? (
                            <>
                              <div>{game.awayScore} - {game.homeScore}</div>
                              {game.status === 'in_progress' && game.period && (
                                <div className="text-xs text-blue-600 font-bold">{game.period}</div>
                              )}
                            </>
                          ) : (
                            new Date(game.gameDate).toLocaleDateString('en-US', { 
                              weekday: 'short', 
                              month: 'short', 
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit'
                            })
                          )}
                        </div>
                        <div className="text-xs text-retro-charcoal opacity-75 border-t border-gray-200 pt-1">
                          {game.awayOwner?.displayName || 'N/A'} v {game.homeOwner?.displayName || 'N/A'}
                        </div>
                      </div>
                      <Badge className={
                        game.status === 'completed' 
                          ? "bg-retro-lime text-retro-charcoal text-xs" 
                          : game.status === 'in_progress'
                          ? "bg-red-500 text-white text-xs animate-pulse"
                          : "bg-retro-orange text-white text-xs"
                      }>
                        {game.status === 'completed' ? 'FINAL' : game.status === 'in_progress' ? 'LIVE' : 'SCHEDULED'}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4">
                    <p className="text-retro-charcoal opacity-75">No recent game updates</p>
                  </div>
                )}
                
                {/* Bye Week Teams - NFL Only */}
                {getByeWeekTeams() && (
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <div className="text-xs font-bold text-retro-purple mb-2">{getByeWeekTeams()!.currentLabel}</div>
                    <div className="grid grid-cols-2 gap-1">
                      {getByeWeekTeams()!.current.map((team) => {
                        const teamColors = getTeamColors();
                        const colors = (teamColors as any)[team] || { background: '#f3f4f6', font: '#374151' };
                        return (
                          <div 
                            key={team} 
                            className="p-2 rounded text-xs text-center font-bold"
                            style={{
                              backgroundColor: colors.background,
                              color: colors.font
                            }}
                          >
                            {team} - BYE
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Next Week's Games */}
          <Card className="bg-white rounded-2xl retro-border shadow-xl">
            <CardContent className="p-6">
              <h4 className="text-retro-purple text-xl font-bold mb-4 retro-font">
                {getUpcomingTitle()}
              </h4>
              <div className="space-y-2">
                {upcomingGames && upcomingGames.length > 0 ? (
                  upcomingGames.map((game) => (
                    <div
                      key={game.id}
                      className="flex justify-between items-center bg-retro-cream p-2 rounded-lg border-l-4 border-retro-orange"
                    >
                      <div className="flex-1">
                        <div className="font-bold text-retro-charcoal retro-font text-xs">
                          {getTeamDisplayName(game.awayTeamId)} @ {getTeamDisplayName(game.homeTeamId)}
                        </div>
                        <div className="text-xs text-retro-charcoal">
                          {new Date(game.gameDate).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </div>
                        <div className="text-xs text-retro-charcoal opacity-75 border-t border-gray-200 pt-1">
                          {game.awayOwner?.displayName || 'N/A'} v {game.homeOwner?.displayName || 'N/A'}
                        </div>
                      </div>
                      <Badge className="bg-retro-orange text-white text-xs">SCHEDULED</Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4">
                    <p className="text-retro-charcoal opacity-75">No upcoming games</p>
                  </div>
                )}
                
                {/* Bye Week Teams - NFL Only */}
                {getByeWeekTeams() && (
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <div className="text-xs font-bold text-retro-purple mb-2">{getByeWeekTeams()!.nextLabel}</div>
                    <div className="grid grid-cols-2 gap-1">
                      {getByeWeekTeams()!.next.map((team) => {
                        const teamColors = getTeamColors();
                        const colors = (teamColors as any)[team] || { background: '#f3f4f6', font: '#374151' };
                        return (
                          <div 
                            key={team} 
                            className="p-2 rounded text-xs text-center font-bold"
                            style={{
                              backgroundColor: colors.background,
                              color: colors.font
                            }}
                          >
                            {team} - BYE
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
