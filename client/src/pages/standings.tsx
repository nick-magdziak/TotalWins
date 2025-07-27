import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Clock, TrendingUp } from "lucide-react";
import StandingsTable from "@/components/StandingsTable";
import { type Game } from "@shared/schema";
import { CURRENT_SEASON } from "@/lib/constants";

export default function Standings() {
  const { data: recentGames } = useQuery<Game[]>({
    queryKey: ["/api/games/recent"],
  });

  // For demo purposes, using a hardcoded league ID
  // In a real app, this would come from user context or route params
  const leagueId = "demo-league-1";

  return (
    <>
      {/* Hero Section */}
      <section className="text-center mb-12 relative">
        <div className="bg-gradient-to-r from-retro-purple to-retro-pink p-8 rounded-3xl retro-border mb-8">
          <div className="bg-retro-charcoal rounded-2xl p-6 bg-opacity-80">
            <h2 className="text-retro-yellow text-4xl md:text-6xl font-bold mb-4 neon-glow retro-font">
              TOTAL WINS
            </h2>
            <p className="text-white text-xl md:text-2xl font-bold">WEEK 18 • FINAL STANDINGS</p>
            <div className="mt-4 flex justify-center space-x-4 flex-wrap gap-2">
              <Badge className="bg-retro-lime text-retro-charcoal px-4 py-2 rounded-full font-bold">
                LIVE
              </Badge>
              <Badge className="bg-retro-orange text-white px-4 py-2 rounded-full font-bold">
                SEASON COMPLETE
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Current Standings Table */}
      <section className="mb-12">
        <h3 className="text-retro-purple text-3xl font-bold mb-6 text-center retro-font">
          <Trophy className="inline text-retro-yellow mr-3" />
          FINAL STANDINGS
        </h3>
        
        <StandingsTable leagueId={leagueId} />
      </section>

      {/* Recent Updates Section */}
      <section className="mb-12">
        <h3 className="text-retro-pink text-3xl font-bold mb-6 text-center retro-font">
          <Clock className="inline text-retro-teal mr-3" />
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
