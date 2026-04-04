import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Clock, TrendingUp, Globe, ChevronDown } from "lucide-react";
import StandingsTable from "@/components/StandingsTable";
import { type Game, type League, type WCGroupStanding, type WCPlayerStanding } from "@shared/schema";
import { CURRENT_SEASON, NFL_TEAM_COLORS, MLB_TEAM_COLORS, NBA_TEAM_COLORS, WC_CONFEDERATION_COLORS } from "@/lib/constants";
import { getCurrentUser } from "@/lib/auth";
import { FlagImage } from "@/lib/flagUtils";

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

  // Resolve current league early so queries can be sport-aware
  const currentLeague = userLeagues?.find(league => league.id === leagueId) || userLeagues?.[0];

  // Season history for this franchise (hidden when only one season)
  const { data: seasonHistory } = useQuery<League[]>({
    queryKey: ["/api/leagues", leagueId, "seasons"],
    queryFn: () => fetch(`/api/leagues/${leagueId}/seasons`).then(r => r.json()),
    enabled: !!leagueId,
  });

  // Selected season — default to current (null = use leagueId)
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);

  // The ID we actually pass to standings & game queries
  const activeLeagueId = selectedSeasonId ?? leagueId;

  // When navigating away and back, reset to current
  // (state already resets on unmount; no extra effect needed)

  // Compute local date info from the browser's clock (not the server's UTC clock)
  const now = new Date();
  const tzOffset = now.getTimezoneOffset(); // minutes west of UTC (e.g. 240 for ET, 420 for PT)
  const toLocalDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayStr = toLocalDateStr(now);
  const yesterdayStr = toLocalDateStr(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const tomorrowStr = toLocalDateStr(new Date(now.getTime() + 24 * 60 * 60 * 1000));

  // WC uses a 2-day window (yesterday+today); other sports use a single-day window
  const isWorldCup = currentLeague?.sport === 'WORLD_CUP';
  const recentDateStr = isWorldCup ? yesterdayStr : todayStr;

  const { data: recentGames } = useQuery<any[]>({
    queryKey: ["/api/leagues", activeLeagueId, "games/recent", recentDateStr],
    queryFn: () =>
      fetch(`/api/leagues/${activeLeagueId}/games/recent?localDate=${recentDateStr}&tzOffset=${tzOffset}`)
        .then(r => r.json()),
    refetchInterval: 60000, // Poll every 1 minute for live game updates
  });

  const { data: upcomingGames } = useQuery<any[]>({
    queryKey: ["/api/leagues", activeLeagueId, "games/upcoming", tomorrowStr],
    queryFn: () =>
      fetch(`/api/leagues/${activeLeagueId}/games/upcoming?localDate=${tomorrowStr}&tzOffset=${tzOffset}`)
        .then(r => r.json()),
    refetchInterval: 300000, // Poll every 5 minutes for upcoming games
  });

  const { data: wcGroups } = useQuery<Record<string, WCGroupStanding[]>>({
    queryKey: ["/api/world-cup/groups"],
    enabled: isWorldCup,
  });

  const { data: wcPlayerStandings } = useQuery<WCPlayerStanding[]>({
    queryKey: ["/api/leagues", activeLeagueId, "world-cup/standings"],
    enabled: isWorldCup,
    refetchInterval: 60000,
  });

  const getGamePeriodLabel = () => {
    switch(currentLeague?.sport) {
      case 'NFL': return 'WEEK';
      case 'MLB': return 'SERIES';
      case 'NBA': return 'GAMES';
      case 'WORLD_CUP': return 'TOURNAMENT';
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

  const getSeasonPeriodLabel = (sport?: string) => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    switch(sport) {
      case 'WORLD_CUP': {
        if (year < 2026 || (year === 2026 && month < 6)) return 'STARTS JUNE 11, 2026';
        if (year === 2026 && month >= 6 && month <= 7) return 'TOURNAMENT LIVE';
        return 'TOURNAMENT COMPLETE';
      }
      case 'NFL': {
        const seasonStartYear = month >= 9 ? year : year - 1;
        const seasonStart = new Date(seasonStartYear, 8, 4);
        while (seasonStart.getDay() !== 4) seasonStart.setDate(seasonStart.getDate() + 1);
        const seasonEnd = new Date(seasonStart);
        seasonEnd.setDate(seasonEnd.getDate() + 18 * 7);
        if (now < seasonStart) {
          const nextStart = new Date(year, 8, 4);
          while (nextStart.getDay() !== 4) nextStart.setDate(nextStart.getDate() + 1);
          const mo = nextStart.toLocaleString('en-US', { month: 'short' }).toUpperCase();
          return `STARTS ${mo} ${nextStart.getDate()}, ${year}`;
        }
        if (now > seasonEnd) return 'SEASON COMPLETE';
        const diffDays = Math.ceil((now.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24));
        const currentWeek = Math.min(Math.max(1, Math.ceil(diffDays / 7)), 18);
        return `WEEK ${currentWeek} LIVE`;
      }
      case 'MLB': {
        const mlbStart = new Date(year, 2, 27);
        const mlbEnd = new Date(year, 8, 28);
        if (now < mlbStart) return `STARTS MAR 27, ${year}`;
        if (now > mlbEnd) return 'SEASON COMPLETE';
        return 'SEASON ACTIVE';
      }
      case 'NBA': {
        const nbaSeasonYear = month >= 10 ? year : year - 1;
        const nbaStart = new Date(nbaSeasonYear, 9, 23);
        const nbaEnd = new Date(nbaSeasonYear + 1, 3, 13);
        if (now < nbaStart) return `STARTS OCT 23, ${nbaSeasonYear}`;
        if (now > nbaEnd) return 'SEASON COMPLETE';
        return 'SEASON ACTIVE';
      }
      default: return 'SEASON ACTIVE';
    }
  };

  const formatDraftDate = (draftScheduledAt?: string | Date | null) => {
    if (!draftScheduledAt) return null;
    const d = new Date(draftScheduledAt);
    const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const day = d.getDate();
    const time = d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `DRAFT ${month} ${day} · ${time}`;
  };

  const getDraftStatusLabel = (status?: string, sport?: string) => {
    if (status === 'active') return 'DRAFT IN PROGRESS';
    if (status === 'completed') return getSeasonPeriodLabel(sport);
    return 'DRAFT NOT STARTED';
  };

  const getDraftStatusClass = (status?: string) => {
    if (status === 'active') return 'bg-orange-500 text-white animate-pulse';
    if (status === 'completed') return 'bg-retro-teal text-white';
    return 'bg-gray-500 text-white';
  };

  const getTealBadgeLabel = (status?: string, sport?: string, draftScheduledAt?: string | Date | null) => {
    if (status === 'completed') return null;
    if (status !== 'active' && draftScheduledAt) return formatDraftDate(draftScheduledAt);
    return getSeasonPeriodLabel(sport);
  };

  const getRecentResultsTitle = () => {
    switch(currentLeague?.sport) {
      case 'NFL': {
        // Calculate current NFL week dynamically
        const now = new Date();
        const currentYear = now.getFullYear();
        const seasonStartYear = now.getMonth() >= 8 ? currentYear : currentYear - 1;
        const seasonStart = new Date(seasonStartYear, 8, 4);
        
        while (seasonStart.getDay() !== 4) {
          seasonStart.setDate(seasonStart.getDate() + 1);
        }
        
        const diffTime = now.getTime() - seasonStart.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const weekNumber = Math.max(1, Math.ceil(diffDays / 7));
        const currentWeek = Math.min(weekNumber, 18);
        
        return `WEEK ${currentWeek} RESULTS`;
      }
      case 'MLB': return "TODAY'S GAMES";
      case 'NBA': return "TODAY'S GAMES";
      case 'WORLD_CUP': return "RECENT MATCHES";
      default: return "TODAY'S GAMES";
    }
  };

  const getUpcomingTitle = () => {
    switch(currentLeague?.sport) {
      case 'NFL': {
        // Calculate next NFL week dynamically
        const now = new Date();
        const currentYear = now.getFullYear();
        const seasonStartYear = now.getMonth() >= 8 ? currentYear : currentYear - 1;
        const seasonStart = new Date(seasonStartYear, 8, 4);
        
        while (seasonStart.getDay() !== 4) {
          seasonStart.setDate(seasonStart.getDate() + 1);
        }
        
        const diffTime = now.getTime() - seasonStart.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const weekNumber = Math.max(1, Math.ceil(diffDays / 7));
        const currentWeek = Math.min(weekNumber, 18);
        const nextWeek = Math.min(currentWeek + 1, 18);
        
        return `WEEK ${nextWeek} PREVIEW`;
      }
      case 'MLB': return "TOMORROW'S GAMES";
      case 'NBA': return "TOMORROW'S GAMES";
      case 'WORLD_CUP': return "UPCOMING MATCHES";
      default: return "TOMORROW'S GAMES";
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
      // Calculate current NFL week dynamically
      const now = new Date();
      const currentYear = now.getFullYear();
      const seasonStartYear = now.getMonth() >= 8 ? currentYear : currentYear - 1;
      const seasonStart = new Date(seasonStartYear, 8, 4);
      
      while (seasonStart.getDay() !== 4) {
        seasonStart.setDate(seasonStart.getDate() + 1);
      }
      
      const diffTime = now.getTime() - seasonStart.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const weekNumber = Math.max(1, Math.ceil(diffDays / 7));
      const currentWeek = Math.min(weekNumber, 18);
      const nextWeek = Math.min(currentWeek + 1, 18);
      
      // NFL bye weeks start in Week 5 - no byes in Weeks 1-4
      if (currentWeek < 5) {
        return {
          current: [],
          next: [],
          currentLabel: `WEEK ${currentWeek} BYES:`,
          nextLabel: `WEEK ${nextWeek} BYES:`
        };
      }
      
      // For weeks 5+ when byes actually happen, would need real bye week data
      return {
        current: [],
        next: [],
        currentLabel: `WEEK ${currentWeek} BYES:`,
        nextLabel: `WEEK ${nextWeek} BYES:`
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
              {currentLeague?.sport === 'WORLD_CUP' ? 'WORLD CUP' : (currentLeague?.sport || "NFL")} • {currentLeague?.season || "2025-26"} • STANDINGS
            </p>
            <div className="mt-3 flex flex-row items-center justify-center gap-3 flex-wrap">
              <Badge className={`px-3 py-1 rounded-full font-bold text-xs ${getDraftStatusClass(currentLeague?.draftStatus)}`}>
                {getDraftStatusLabel(currentLeague?.draftStatus, currentLeague?.sport)}
              </Badge>
              {getTealBadgeLabel(currentLeague?.draftStatus, currentLeague?.sport, currentLeague?.draftScheduledAt) && (
                <Badge className="bg-retro-teal text-white px-3 py-1 rounded-full font-bold text-xs">
                  {getTealBadgeLabel(currentLeague?.draftStatus, currentLeague?.sport, currentLeague?.draftScheduledAt)}
                </Badge>
              )}
            </div>

            {/* Season selector — only shown when franchise has multiple seasons */}
            {seasonHistory && seasonHistory.length > 1 && (
              <div className="mt-3 flex items-center justify-center gap-2">
                <span className="text-gray-300 text-xs font-semibold uppercase tracking-wide">Season:</span>
                <div className="relative inline-block">
                  <select
                    value={selectedSeasonId ?? leagueId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedSeasonId(val === leagueId ? null : val);
                    }}
                    className="appearance-none bg-white/10 border border-white/30 text-white text-xs font-bold px-3 py-1 pr-7 rounded-full cursor-pointer focus:outline-none focus:border-white/60"
                  >
                    {[...seasonHistory].reverse().map((s) => (
                      <option key={s.id} value={s.id} className="bg-gray-800 text-white">
                        {s.season}{s.id === leagueId ? " (current)" : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/70 pointer-events-none" />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Current Standings Table */}
      <section className="mb-8 px-4">
        <h3 className="text-black text-xl sm:text-2xl font-bold mb-2 text-center retro-font">
          <Trophy className="inline text-retro-teal mr-2 w-5 h-5 sm:w-6 sm:h-6" />
          STANDINGS
        </h3>

        {/* Past season banner */}
        {selectedSeasonId && selectedSeasonId !== leagueId && (
          <div className="flex justify-center mb-3">
            <Badge className="bg-amber-500 text-white px-4 py-1 rounded-full font-bold text-xs tracking-wide">
              PAST SEASON — {seasonHistory?.find(s => s.id === selectedSeasonId)?.season || ""}
            </Badge>
          </div>
        )}

        <p className="text-xs text-gray-600 text-center mb-4">
          {selectedSeasonId && selectedSeasonId !== leagueId
            ? "Final standings — this season is complete"
            : `Last updated: ${new Date().toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                timeZoneName: 'short'
              })}`}
        </p>
        
        <StandingsTable leagueId={activeLeagueId} />
      </section>

      {/* World Cup Group Tables */}
      {isWorldCup && (
        <section className="mb-8 px-4">
          <h3 className="text-black text-xl sm:text-2xl font-bold mb-4 text-center retro-font">
            <Globe className="inline text-retro-teal mr-2 w-5 h-5 sm:w-6 sm:h-6" />
            GROUP STAGE STANDINGS
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {wcGroups && Object.keys(wcGroups).length > 0 ? Object.entries(wcGroups).map(([groupLetter, group]) => {
              const groupName = `Group ${groupLetter}`;
              return (
                <Card key={groupLetter} className="bg-white rounded-2xl retro-border shadow-xl">
                  <CardContent className="p-4">
                    <h4 className="text-retro-purple font-bold mb-2 text-center retro-font text-sm">{groupName}</h4>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 border-b">
                          <th className="text-left py-1">Team</th>
                          <th className="text-center py-1">P</th>
                          <th className="text-center py-1">W</th>
                          <th className="text-center py-1">D</th>
                          <th className="text-center py-1">L</th>
                          <th className="text-center py-1">GF</th>
                          <th className="text-center py-1">GA</th>
                          <th className="text-center py-1">Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.map((standing, si) => (
                          <tr key={si} className={`border-b border-gray-100 ${si < 2 ? 'bg-green-50' : ''}`}>
                            <td className="py-1">
                              <div className="flex items-center gap-1">
                                <FlagImage teamId={standing.teamId} emoji={standing.flagEmoji} name={standing.name} size={18} />
                                <span className="font-bold truncate" title={standing.name}>{standing.abbreviation || standing.name}</span>
                              </div>
                            </td>
                            <td className="text-center py-1">{standing.played}</td>
                            <td className="text-center py-1">{standing.wins}</td>
                            <td className="text-center py-1">{standing.draws}</td>
                            <td className="text-center py-1">{standing.losses}</td>
                            <td className="text-center py-1">{standing.goalsFor}</td>
                            <td className="text-center py-1">{standing.goalsAgainst}</td>
                            <td className="text-center py-1 font-bold">{standing.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-1 text-xs text-gray-400 text-right">Top 2 advance</div>
                  </CardContent>
                </Card>
              );
            }) : (
              <div className="col-span-3 text-center py-8 text-gray-500">
                <Globe className="mx-auto mb-2 w-8 h-8 opacity-40" />
                <p>Group stage data will appear once the tournament begins on June 11, 2026.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Recent Updates Section */}
      <section className="mb-8 px-4">
        <h3 className="text-black text-xl sm:text-2xl font-bold mb-4 text-center retro-font">
          <Clock className="inline text-retro-teal mr-2 w-5 h-5 sm:w-6 sm:h-6" />
          {currentLeague?.sport === 'NFL' && 'NFL GAMES'}
          {currentLeague?.sport === 'MLB' && 'MLB GAMES'}
          {currentLeague?.sport === 'NBA' && 'NBA GAMES'}
          {currentLeague?.sport === 'WORLD_CUP' && 'WORLD CUP MATCHES'}
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
