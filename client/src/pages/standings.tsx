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

  const { data: recentGames } = useQuery<Game[]>({
    queryKey: ["/api/games/recent"],
  });

  // Determine current league
  const leagueId = urlLeagueId || userLeagues?.[0]?.id || "demo-league-1";
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
                  recentGames.slice(0, 3).map((game) => (
                    <div
                      key={game.id}
                      className="flex justify-between items-center bg-retro-cream p-3 rounded-lg border-l-4 border-retro-lime"
                    >
                      <div>
                        <span className="font-bold text-retro-charcoal retro-font">
                          Game completed
                        </span>
                        <div className="text-sm text-retro-charcoal opacity-75">
                          Score updated automatically
                        </div>
                      </div>
                      <Badge className="bg-retro-lime text-retro-charcoal">FINAL</Badge>
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

          {/* League Stats */}
          <Card className="bg-gradient-to-br from-retro-pink to-retro-purple rounded-2xl shadow-xl">
            <CardContent className="p-6 text-white">
              <h4 className="text-xl font-bold mb-4 retro-font">
                <TrendingUp className="inline mr-2" />
                LEAGUE STATS
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Total Games Tracked:</span>
                  <span className="font-bold">272</span>
                </div>
                <div className="flex justify-between">
                  <span>Average Wins per Player:</span>
                  <span className="font-bold">29.4</span>
                </div>
                <div className="flex justify-between">
                  <span>Highest Single Team:</span>
                  <span className="font-bold">15 wins (DET)</span>
                </div>
                <div className="flex justify-between">
                  <span>Season Status:</span>
                  <span className="font-bold">COMPLETE</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
