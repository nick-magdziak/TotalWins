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
        <table className="w-full table-fixed">
          <thead className="bg-gradient-to-r from-retro-pink to-retro-teal text-white">
            <tr>
              <th className="pl-2 pr-0 py-3 text-left font-bold text-xs retro-font" style={{ width: '24px' }}>RANK</th>
              <th className="pl-0 pr-2 py-3 text-left font-bold text-xs retro-font" style={{ width: '100px' }}>PLAYER</th>
              <th className="pl-2 pr-2 py-3 text-center font-bold text-xs retro-font" style={{ width: '60px' }}>WINS</th>
              <th className="px-2 py-3 text-left font-bold text-xs retro-font">TEAMS</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((standing) => (
              <tr key={standing.userId} className={getRowClass(standing.rank)}>
                <td className="pl-2 pr-0 py-3 text-sm font-bold text-retro-charcoal" style={{ width: '24px' }}>
                  {standing.rank}
                </td>
                <td className="pl-0 pr-2 py-3" style={{ width: '100px' }}>
                  <div className="font-bold text-sm text-retro-charcoal retro-font truncate">
                    {standing.displayName}
                  </div>
                </td>
                <td className="pl-2 pr-2 py-3 text-center" style={{ width: '60px' }}>
                  <span className="text-lg font-bold text-retro-charcoal retro-font">
                    {standing.totalWins}
                  </span>
                </td>
                <td className="px-2 py-3">
                  <div className="flex flex-col gap-1">
                    {standing.teams.map((team) => (
                      <div key={team.id} className="flex items-center gap-1 whitespace-nowrap">
                        <Badge className="bg-retro-charcoal text-white px-2 py-1 rounded text-xs font-bold">
                          {team.abbreviation}
                        </Badge>
                        <span className="text-xs font-bold text-retro-charcoal">
                          {team.wins}
                        </span>
                      </div>
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
