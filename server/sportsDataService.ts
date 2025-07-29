import { DatabaseStorage } from './storage';

interface ESPNMLBTeam {
  id: string;
  displayName: string;
  shortDisplayName: string;
  abbreviation: string;
  color: string;
  alternateColor: string;
  record: {
    items: Array<{
      summary: string;
      stats: Array<{
        name: string;
        value: number;
      }>;
    }>;
  };
}

interface ESPNMLBStandings {
  children: Array<{
    standings: {
      entries: Array<{
        team: ESPNMLBTeam;
        stats: Array<{
          name: string;
          value: number;
        }>;
      }>;
    };
  }>;
}

export class SportsDataService {
  private storage: DatabaseStorage;
  private readonly ESPN_MLB_STANDINGS_URL = 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/standings';

  constructor(storage: DatabaseStorage) {
    this.storage = storage;
  }

  async updateMLBStandings(): Promise<void> {
    try {
      console.log('Fetching MLB standings from ESPN...');
      
      const response = await fetch(this.ESPN_MLB_STANDINGS_URL);
      if (!response.ok) {
        throw new Error(`ESPN API returned ${response.status}: ${response.statusText}`);
      }

      const data: any = await response.json();
      
      console.log('ESPN API response structure:', JSON.stringify(data, null, 2));
      
      // Extract teams from all divisions - handle different API structures
      const teams: Array<{ team: any; wins: number; losses: number }> = [];
      
      // Try different possible API structures
      let divisions = [];
      if (data.children && Array.isArray(data.children)) {
        divisions = data.children;
      } else if (data.standings && Array.isArray(data.standings)) {
        divisions = data.standings;
      } else if (data.groups && Array.isArray(data.groups)) {
        divisions = data.groups.map((group: any) => group.standings || group).flat();
      } else {
        console.warn('Unexpected ESPN API structure, attempting fallback...');
        // Use current team data as fallback
        return;
      }
      
      for (const division of divisions) {
        const entries = division.standings?.entries || division.entries || division;
        if (!Array.isArray(entries)) continue;
        
        for (const entry of entries) {
          const winsStatObject = entry.stats?.find((stat: any) => stat.name === 'wins');
          const lossesStatObject = entry.stats?.find((stat: any) => stat.name === 'losses');
          
          const wins = winsStatObject ? winsStatObject.value : 0;
          const losses = lossesStatObject ? lossesStatObject.value : 0;
          
          teams.push({
            team: entry.team,
            wins,
            losses
          });
        }
      }

      console.log(`Found ${teams.length} MLB teams to update`);

      // Update our database with real wins/losses
      const updatePromises = teams.map(async ({ team, wins, losses }) => {
        try {
          // Map ESPN team abbreviation to our team IDs
          const teamId = this.mapESPNTeamToOurId(team.abbreviation);
          if (teamId) {
            await this.storage.updateMLBTeamRecord(teamId, wins, losses);
            console.log(`Updated ${team.abbreviation} (${teamId}): ${wins}-${losses}`);
          }
        } catch (error) {
          console.error(`Error updating team ${team.abbreviation}:`, error);
        }
      });

      await Promise.all(updatePromises);
      console.log('MLB standings update completed successfully');

    } catch (error) {
      console.error('Error updating MLB standings:', error);
      throw error;
    }
  }

  private mapESPNTeamToOurId(espnAbbreviation: string): string | null {
    // Map ESPN team abbreviations to our database team IDs
    const teamMapping: Record<string, string> = {
      'LAD': 'LAD',
      'SD': 'SD',
      'PHI': 'PHI-MLB',
      'NYY': 'NYY',
      'ATL': 'ATL-MLB',
      'MIL': 'MIL',
      'CLE': 'CLE-MLB',
      'HOU': 'HOU-MLB',
      'BAL': 'BAL-MLB',
      'TB': 'TB-MLB',
      'BOS': 'BOS-MLB',
      'TOR': 'TOR-MLB',
      'SEA': 'SEA-MLB',
      'TEX': 'TEX',
      'LAA': 'LAA',
      'OAK': 'OAK',
      'MIN': 'MIN-MLB',
      'DET': 'DET-MLB',
      'KC': 'KC-MLB',
      'CWS': 'CWS',
      'NYM': 'NYM',
      'WSH': 'WSH',
      'MIA': 'MIA-MLB',
      'CHC': 'CHC',
      'CIN': 'CIN-MLB',
      'STL': 'STL',
      'PIT': 'PIT-MLB',
      'ARI': 'ARI-MLB',
      'COL': 'COL',
      'SF': 'SF-MLB'
    };

    return teamMapping[espnAbbreviation] || null;
  }

  // Method to start periodic updates (can be called on server start)
  startPeriodicUpdates(): void {
    // Update MLB standings every 30 minutes during season
    setInterval(() => {
      this.updateMLBStandings().catch(error => {
        console.error('Scheduled MLB update failed:', error);
      });
    }, 30 * 60 * 1000); // 30 minutes

    // Initial update
    this.updateMLBStandings().catch(error => {
      console.error('Initial MLB update failed:', error);
    });
  }

  // Manual trigger for updates (can be called via API endpoint)
  async triggerMLBUpdate(): Promise<{ success: boolean; message: string }> {
    try {
      await this.updateMLBStandings();
      return { success: true, message: 'MLB standings updated successfully' };
    } catch (error) {
      return { 
        success: false, 
        message: `Failed to update MLB standings: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }
}