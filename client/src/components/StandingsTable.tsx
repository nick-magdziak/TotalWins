import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
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
      <div className="bg-white rounded-2xl retro-border overflow-hidden shadow-xl">
        <div className="p-8 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-retro-pink border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-retro-charcoal">Loading standings...</p>
        </div>
      </div>
    );
  }

  if (!standings || standings.length === 0) {
    return (
      <div className="bg-white rounded-2xl retro-border overflow-hidden shadow-xl">
        <div className="p-8 text-center">
          <p className="text-retro-charcoal">No standings data available.</p>
        </div>
      </div>
    );
  }



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
    <div className="bg-white rounded-2xl retro-border overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-retro-pink to-retro-teal text-white">
            <tr>
              <th className="px-2 py-3 text-left font-bold text-xs retro-font">RANK</th>
              <th className="px-2 py-3 text-left font-bold text-xs retro-font">PLAYER</th>
              <th className="px-2 py-3 text-center font-bold text-xs retro-font">WINS</th>
              <th className="px-2 py-3 text-left font-bold text-xs retro-font">TEAMS</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((standing) => (
              <tr key={standing.userId} className={getRowClass(standing.rank)}>
                <td className="px-2 py-3 text-sm font-bold text-retro-charcoal">
                  {standing.rank}
                </td>
                <td className="px-2 py-3">
                  <div className="font-bold text-sm text-retro-charcoal retro-font">
                    {standing.displayName}
                  </div>
                </td>
                <td className="px-2 py-3 text-center">
                  <span className="text-lg font-bold text-retro-charcoal retro-font">
                    {standing.totalWins}
                  </span>
                </td>
                <td className="px-2 py-3">
                  <div className="flex flex-wrap gap-1">
                    {standing.teams.map((team) => (
                      <Badge
                        key={team.id}
                        className="bg-retro-charcoal text-white px-2 py-1 rounded text-xs font-bold"
                      >
                        {team.abbreviation}
                      </Badge>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
