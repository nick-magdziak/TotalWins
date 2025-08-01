export interface DraftConfiguration {
  key: string;
  label: string;
  players: number;
  teams: number;
  draftStyle: string;
}

export const DRAFT_CONFIGURATIONS: Record<string, DraftConfiguration[]> = {
  NFL: [
    {
      key: "4_players_8_teams",
      label: "4 Players, 8 Teams",
      players: 4,
      teams: 8,
      draftStyle: "snake"
    },
    {
      key: "5_players_6_teams",
      label: "5 Players, 6 Teams",
      players: 5,
      teams: 6,
      draftStyle: "snake"
    },
    {
      key: "7_players_4_teams",
      label: "7 Players, 4 Teams",
      players: 7,
      teams: 4,
      draftStyle: "snake"
    },
    {
      key: "8_players_4_teams",
      label: "8 Players, 4 Teams",
      players: 8,
      teams: 4,
      draftStyle: "snake"
    },
    {
      key: "10_players_3_teams",
      label: "10 Players, 3 Teams (custom config)",
      players: 10,
      teams: 3,
      draftStyle: "custom_10_30"
    },
    {
      key: "6_players_5_teams_custom",
      label: "6 Players, 5 Teams (custom config)",
      players: 6,
      teams: 5,
      draftStyle: "custom_6_30"
    }
  ],
  MLB: [
    {
      key: "4_players_6_teams",
      label: "4 Players, 6 Teams",
      players: 4,
      teams: 6,
      draftStyle: "snake"
    },
    {
      key: "5_players_6_teams",
      label: "5 Players, 6 Teams",
      players: 5,
      teams: 6,
      draftStyle: "snake"
    },
    {
      key: "7_players_4_teams",
      label: "7 Players, 4 Teams",
      players: 7,
      teams: 4,
      draftStyle: "snake"
    },
    {
      key: "8_players_3_teams",
      label: "8 Players, 3 Teams",
      players: 8,
      teams: 3,
      draftStyle: "custom_8_24"
    },
    {
      key: "10_players_3_teams",
      label: "10 Players, 3 Teams (custom config)",
      players: 10,
      teams: 3,
      draftStyle: "custom_10_30"
    },
    {
      key: "6_players_5_teams_custom",
      label: "6 Players, 5 Teams (custom config)",
      players: 6,
      teams: 5,
      draftStyle: "custom_6_30"
    }
  ],
  NBA: [
    {
      key: "4_players_6_teams",
      label: "4 Players, 6 Teams",
      players: 4,
      teams: 6,
      draftStyle: "snake"
    },
    {
      key: "5_players_6_teams",
      label: "5 Players, 6 Teams",
      players: 5,
      teams: 6,
      draftStyle: "snake"
    },
    {
      key: "7_players_4_teams",
      label: "7 Players, 4 Teams",
      players: 7,
      teams: 4,
      draftStyle: "snake"
    },
    {
      key: "8_players_3_teams",
      label: "8 Players, 3 Teams",
      players: 8,
      teams: 3,
      draftStyle: "custom_8_24"
    },
    {
      key: "10_players_3_teams",
      label: "10 Players, 3 Teams (custom config)",
      players: 10,
      teams: 3,
      draftStyle: "custom_10_30"
    },
    {
      key: "6_players_5_teams_custom",
      label: "6 Players, 5 Teams (custom config)",
      players: 6,
      teams: 5,
      draftStyle: "custom_6_30"
    }
  ]
};

export function getDraftConfigByKey(key: string): DraftConfiguration | null {
  for (const sport in DRAFT_CONFIGURATIONS) {
    const config = DRAFT_CONFIGURATIONS[sport].find(c => c.key === key);
    if (config) return config;
  }
  return null;
}

export function getDefaultDraftConfig(sport: string): DraftConfiguration {
  const configs = DRAFT_CONFIGURATIONS[sport];
  return configs?.[0] || DRAFT_CONFIGURATIONS.NFL[0];
}