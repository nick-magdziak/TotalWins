import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";
import { type PlayerStanding, type League, type WorldCupTeam } from "@shared/schema";
import { NFL_TEAM_COLORS, MLB_TEAM_COLORS, NBA_TEAM_COLORS, WC_CONFEDERATION_COLORS } from "@/lib/constants";
import { FlagImage } from "@/lib/flagUtils";

interface StandingsTableProps {
  leagueId: string;
}

export default function StandingsTable({ leagueId }: StandingsTableProps) {
  const { data: standings, isLoading } = useQuery<PlayerStanding[]>({
    queryKey: ["/api/leagues", leagueId, "standings"],
  });

  const { data: league } = useQuery<League>({
    queryKey: ["/api/leagues", leagueId],
  });

  // Get team colors based on sport
  const getTeamColors = () => {
    switch (league?.sport) {
      case 'MLB':
        return MLB_TEAM_COLORS;
      case 'NBA':
        return NBA_TEAM_COLORS;
      default:
        return NFL_TEAM_COLORS;
    }
  };

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
    const draftStatus = league?.draftStatus;
    let title = "No standings yet";
    let message = "Standings will appear once your league is set up.";
    if (draftStatus === "active") {
      title = "Draft in progress";
      message = "Standings will populate as soon as the draft wraps up.";
    } else if (draftStatus === "paused") {
      title = "Draft paused";
      message = "Standings will appear once the draft resumes and finishes.";
    } else if (!draftStatus || draftStatus === "scheduled" || draftStatus === "not_started") {
      title = "Draft hasn't happened yet";
      message = "Once the draft is complete, your standings will show up here.";
    }
    return (
      <div className="bg-white rounded-2xl retro-border overflow-hidden shadow-xl">
        <div className="p-10 text-center">
          <Trophy className="mx-auto w-12 h-12 text-retro-pink/50 mb-3" />
          <p className="text-retro-charcoal text-lg font-bold retro-font mb-1" data-testid="standings-empty-title">
            {title}
          </p>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">{message}</p>
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

  // Render a single team chip — shared between desktop table and mobile cards
  const renderTeamChip = (team: any) => {
    if (league?.sport === 'WORLD_CUP') {
      const wcTeam = team as unknown as WorldCupTeam & { wins: number };
      const confColors = WC_CONFEDERATION_COLORS[wcTeam.confederation] || { background: '#374151', font: '#ffffff' };
      return (
        <div key={team.id} style={{ width: '68px' }} className="flex items-center">
          <div
            className="flex items-center justify-center flex-1 min-w-0 rounded px-1 py-0.5 text-xs font-bold"
            style={{ backgroundColor: confColors.background, color: confColors.font }}
          >
            <FlagImage teamId={wcTeam.id} emoji={wcTeam.flagEmoji} name={wcTeam.name} size={14} className="mr-0.5 flex-shrink-0" />
            <span>{wcTeam.abbreviation}</span>
          </div>
          <span className="flex-shrink-0 ml-1 text-xs font-bold text-retro-charcoal" style={{ width: '14px', textAlign: 'right' }}>
            {wcTeam.wins}
          </span>
        </div>
      );
    }
    const teamColorsMap = getTeamColors();
    const teamColors = teamColorsMap[team.abbreviation as keyof typeof teamColorsMap];
    return (
      <div key={team.id} style={{ width: '58px' }} className="flex items-center">
        <div
          className="flex items-center justify-center flex-1 min-w-0 rounded px-1 py-0.5 text-xs font-bold"
          style={{
            backgroundColor: teamColors?.background || '#374151',
            color: teamColors?.font || '#ffffff'
          }}
        >
          {team.abbreviation}
        </div>
        <span className="flex-shrink-0 ml-1 text-xs font-bold text-retro-charcoal" style={{ width: '14px', textAlign: 'right' }}>
          {team.wins}
        </span>
      </div>
    );
  };

  const winsLabel = league?.sport === 'WORLD_CUP' ? 'PTS' : 'WINS';
  const teamChipWidth = league?.sport === 'WORLD_CUP' ? '68px' : '58px';

  return (
    <>
      {/* Mobile: card layout (visible below sm breakpoint) */}
      <div className="sm:hidden space-y-3" data-testid="standings-mobile">
        {standings.map((standing) => {
          const rankAccent =
            standing.rank === 1
              ? 'bg-gradient-to-r from-retro-yellow to-retro-lime text-retro-charcoal'
              : standing.rank === 2
              ? 'bg-retro-pink text-white'
              : standing.rank === 3
              ? 'bg-retro-teal text-white'
              : 'bg-gray-200 text-retro-charcoal';
          return (
            <div
              key={standing.userId}
              className={`bg-white rounded-2xl retro-border shadow-lg overflow-hidden ${
                standing.rank === 1 ? 'ring-2 ring-retro-yellow' : ''
              }`}
              data-testid={`standings-card-${standing.userId}`}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-base retro-font ${rankAccent}`}>
                    {standing.rank}
                  </div>
                  <div className="font-bold text-base text-retro-charcoal retro-font truncate">
                    {standing.displayName}
                  </div>
                </div>
                <div className="flex items-baseline gap-1 flex-shrink-0 ml-3">
                  <span className="text-2xl font-bold text-retro-charcoal retro-font leading-none">
                    {standing.totalWins}
                  </span>
                  <span className="text-xs font-bold text-gray-500 retro-font">{winsLabel}</span>
                </div>
              </div>
              <div className="px-4 py-3 bg-retro-cream/50">
                <div
                  style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, ${teamChipWidth})`, gap: '4px' }}
                >
                  {standing.teams.map((team) => renderTeamChip(team))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: table layout (visible at sm and up) */}
      <div className="hidden sm:block bg-white rounded-2xl retro-border overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed">
          <thead className="bg-gradient-to-r from-retro-pink to-retro-teal text-white">
            <tr>
              <th className="pl-2 pr-0 py-3 text-left font-bold text-xs retro-font" style={{ width: '24px' }}>RANK</th>
              <th className="pl-0 pr-0 py-3 text-left font-bold text-xs retro-font" style={{ width: '120px' }}>PLAYER</th>
              <th className="pl-0 pr-2 py-3 text-center font-bold text-xs retro-font" style={{ width: '60px' }}>
                {league?.sport === 'WORLD_CUP' ? 'PTS' : 'WINS'}
              </th>
              <th className="px-2 py-3 text-left font-bold text-xs retro-font">TEAMS</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((standing) => (
              <tr key={standing.userId} className={getRowClass(standing.rank)}>
                <td className="pl-2 pr-0 py-3 text-sm font-bold text-retro-charcoal" style={{ width: '24px' }}>
                  {standing.rank}
                </td>
                <td className="pl-0 pr-0 py-3" style={{ width: '120px' }}>
                  <div className="font-bold text-sm text-retro-charcoal retro-font truncate">
                    {standing.displayName}
                  </div>
                </td>
                <td className="pl-0 pr-2 py-3 text-center" style={{ width: '60px' }}>
                  <span className="text-lg font-bold text-retro-charcoal retro-font">
                    {standing.totalWins}
                  </span>
                </td>
                <td className="px-2 py-3">
                  {league?.sport === 'WORLD_CUP' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 68px)', gap: '3px' }}>
                      {standing.teams.map((team) => {
                        const wcTeam = team as unknown as WorldCupTeam & { wins: number };
                        const confColors = WC_CONFEDERATION_COLORS[wcTeam.confederation] || { background: '#374151', font: '#ffffff' };
                        return (
                          <div key={team.id} style={{ width: '68px' }} className="flex items-center">
                            <div
                              className="flex items-center justify-center flex-1 min-w-0 rounded px-1 py-0.5 text-xs font-bold"
                              style={{ backgroundColor: confColors.background, color: confColors.font }}
                            >
                              <FlagImage teamId={wcTeam.id} emoji={wcTeam.flagEmoji} name={wcTeam.name} size={14} className="mr-0.5 flex-shrink-0" />
                              <span>{wcTeam.abbreviation}</span>
                            </div>
                            <span className="flex-shrink-0 ml-1 text-xs font-bold text-retro-charcoal" style={{ width: '14px', textAlign: 'right' }}>
                              {wcTeam.wins}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 58px)', gap: '3px' }}>
                      {standing.teams.map((team) => {
                        const teamColorsMap = getTeamColors();
                        const teamColors = teamColorsMap[team.abbreviation as keyof typeof teamColorsMap];
                        return (
                          <div key={team.id} style={{ width: '58px' }} className="flex items-center">
                            <div
                              className="flex items-center justify-center flex-1 min-w-0 rounded px-1 py-0.5 text-xs font-bold"
                              style={{
                                backgroundColor: teamColors?.background || '#374151',
                                color: teamColors?.font || '#ffffff'
                              }}
                            >
                              {team.abbreviation}
                            </div>
                            <span className="flex-shrink-0 ml-1 text-xs font-bold text-retro-charcoal" style={{ width: '14px', textAlign: 'right' }}>
                              {team.wins}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </>
  );
}
