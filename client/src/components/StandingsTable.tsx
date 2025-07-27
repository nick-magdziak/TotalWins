import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Crown, Medal } from "lucide-react";
import { type PlayerStanding } from "@shared/schema";

interface StandingsTableProps {
  leagueId: string;
}

export default function StandingsTable({ leagueId }: StandingsTableProps) {
  const { data: standings, isLoading } = useQuery<PlayerStanding[]>({
    queryKey: ["/api/leagues", leagueId, "standings"],
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-3xl retro-border overflow-hidden shadow-2xl">
        <div className="checkered-bg p-4">
          <h4 className="text-retro-charcoal text-2xl font-bold text-center retro-font">
            CHAMPIONSHIP RESULTS
          </h4>
        </div>
        <div className="p-8 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-retro-pink border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-retro-charcoal">Loading standings...</p>
        </div>
      </div>
    );
  }

  if (!standings || standings.length === 0) {
    return (
      <div className="bg-white rounded-3xl retro-border overflow-hidden shadow-2xl">
        <div className="checkered-bg p-4">
          <h4 className="text-retro-charcoal text-2xl font-bold text-center retro-font">
            CHAMPIONSHIP RESULTS
          </h4>
        </div>
        <div className="p-8 text-center">
          <p className="text-retro-charcoal">No standings data available.</p>
        </div>
      </div>
    );
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-6 w-6 text-retro-orange" />;
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Medal className="h-6 w-6 text-amber-600" />;
      default:
        return null;
    }
  };

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return <Badge className="bg-retro-lime text-retro-charcoal font-bold">WINNER</Badge>;
      case 2:
        return <Badge className="bg-retro-orange text-white font-bold">2ND</Badge>;
      case 3:
        return <Badge className="bg-retro-teal text-white font-bold">3RD</Badge>;
      default:
        return <Badge variant="secondary" className="font-bold">{rank}TH</Badge>;
    }
  };

  const getRowClass = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-r from-retro-yellow to-retro-lime border-b-4 border-retro-purple";
      case 2:
        return "bg-retro-cream border-b-2 border-retro-pink hover:bg-gradient-to-r hover:from-retro-cream hover:to-white";
      case 3:
        return "bg-white border-b-2 border-retro-teal hover:bg-gradient-to-r hover:from-white hover:to-retro-cream";
      default:
        return "bg-retro-cream border-b border-gray-200 hover:bg-white";
    }
  };

  return (
    <div className="bg-white rounded-3xl retro-border overflow-hidden shadow-2xl">
      <div className="checkered-bg p-4">
        <h4 className="text-retro-charcoal text-2xl font-bold text-center retro-font">
          CHAMPIONSHIP RESULTS
        </h4>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-retro-pink to-retro-teal text-white">
            <tr>
              <th className="p-4 text-left font-bold text-lg retro-font">RANK</th>
              <th className="p-4 text-left font-bold text-lg retro-font">PLAYER</th>
              <th className="p-4 text-center font-bold text-lg retro-font">WINS</th>
              <th className="p-4 text-left font-bold text-lg retro-font">TEAMS</th>
              <th className="p-4 text-center font-bold text-lg retro-font">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((standing) => (
              <tr key={standing.userId} className={getRowClass(standing.rank)}>
                <td className="p-4 text-xl font-bold text-retro-charcoal">
                  <div className="flex items-center space-x-2">
                    {getRankIcon(standing.rank)}
                    <span>{standing.rank}</span>
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-retro-purple rounded-full flex items-center justify-center text-white font-bold text-xl">
                      {standing.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-lg text-retro-charcoal retro-font">
                        {standing.displayName}
                      </div>
                      {standing.rank === 1 && (
                        <div className="text-sm text-retro-charcoal opacity-75">Champion 🏆</div>
                      )}
                      {standing.rank === 2 && (
                        <div className="text-sm text-retro-charcoal opacity-75">Runner-up 🥈</div>
                      )}
                      {standing.rank === 3 && (
                        <div className="text-sm text-retro-charcoal opacity-75">3rd Place 🥉</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-4 text-center">
                  <span className={`${standing.rank === 1 ? "text-3xl" : "text-2xl"} font-bold text-retro-charcoal retro-font`}>
                    {standing.totalWins}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {standing.teams.map((team) => (
                      <Badge
                        key={team.id}
                        className="bg-retro-charcoal text-white px-3 py-1 rounded-full text-sm font-bold"
                      >
                        {team.abbreviation}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="p-4 text-center">
                  {getRankBadge(standing.rank)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
