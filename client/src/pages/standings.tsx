import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Clock, TrendingUp } from "lucide-react";
import StandingsTable from "@/components/StandingsTable";
import { type Game, type League } from "@shared/schema";
import { CURRENT_SEASON } from "@/lib/constants";
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
  });

  const { data: upcomingGames } = useQuery<any[]>({
    queryKey: ["/api/leagues", leagueId, "games/upcoming"],
  });
  const currentLeague = userLeagues?.find(league => league.id === leagueId) || userLeagues?.[0];

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
              <Badge className="bg-retro-orange text-white px-3 py-1 rounded-full font-bold text-xs">
                SEASON COMPLETE
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Current Standings Table */}
      <section className="mb-8 px-4">
        <h3 className="text-black text-xl sm:text-2xl font-bold mb-4 text-center retro-font">
          <Trophy className="inline text-retro-teal mr-2 w-5 h-5 sm:w-6 sm:h-6" />
          STANDINGS
        </h3>
        
        <StandingsTable leagueId={leagueId} />
      </section>

      {/* Recent Updates Section */}
      <section className="mb-8 px-4">
        <h3 className="text-retro-pink text-xl sm:text-2xl font-bold mb-4 text-center retro-font">
          <Clock className="inline text-retro-teal mr-2 w-5 h-5 sm:w-6 sm:h-6" />
          RECENT UPDATES
        </h3>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Recent Game Results */}
          <Card className="bg-white rounded-2xl retro-border shadow-xl">
            <CardContent className="p-6">
              <h4 className="text-retro-purple text-xl font-bold mb-4 retro-font">
                WEEK 18 RESULTS
              </h4>
              <div className="space-y-3">
                {recentGames && recentGames.length > 0 ? (
                  recentGames.slice(0, 4).map((game) => (
                    <div
                      key={game.id}
                      className="flex justify-between items-center bg-retro-cream p-3 rounded-lg border-l-4 border-retro-lime"
                    >
                      <div className="flex-1">
                        <div className="font-bold text-retro-charcoal retro-font text-sm">
                          {game.awayTeamId} @ {game.homeTeamId}
                        </div>
                        <div className="text-sm text-retro-charcoal font-bold">
                          {game.awayScore} - {game.homeScore}
                        </div>
                        <div className="text-xs text-retro-charcoal opacity-75 mt-1 border-t border-gray-200 pt-1">
                          {game.awayOwner?.displayName || 'N/A'} v {game.homeOwner?.displayName || 'N/A'}
                        </div>
                      </div>
                      <Badge className="bg-retro-lime text-retro-charcoal text-xs">FINAL</Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4">
                    <p className="text-retro-charcoal opacity-75">No recent game updates</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Next Week's Games */}
          <Card className="bg-white rounded-2xl retro-border shadow-xl">
            <CardContent className="p-6">
              <h4 className="text-retro-purple text-xl font-bold mb-4 retro-font">
                PLAYOFF WILD CARD
              </h4>
              <div className="space-y-3">
                {upcomingGames && upcomingGames.length > 0 ? (
                  upcomingGames.slice(0, 4).map((game) => (
                    <div
                      key={game.id}
                      className="flex justify-between items-center bg-retro-cream p-3 rounded-lg border-l-4 border-retro-orange"
                    >
                      <div className="flex-1">
                        <div className="font-bold text-retro-charcoal retro-font text-sm">
                          {game.awayTeamId} @ {game.homeTeamId}
                        </div>
                        <div className="text-sm text-retro-charcoal">
                          {new Date(game.gameDate).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </div>
                        <div className="text-xs text-retro-charcoal opacity-75 mt-1 border-t border-gray-200 pt-1">
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
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
