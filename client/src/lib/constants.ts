export const NFL_DIVISIONS = {
  "AFC East": ["BUF", "MIA", "NE", "NYJ"],
  "AFC North": ["BAL", "CIN", "CLE", "PIT"],
  "AFC South": ["HOU", "IND", "JAX", "TEN"],
  "AFC West": ["DEN", "KC", "LV", "LAC"],
  "NFC East": ["DAL", "NYG", "PHI", "WAS"],
  "NFC North": ["CHI", "DET", "GB", "MIN"],
  "NFC South": ["ATL", "CAR", "NO", "TB"],
  "NFC West": ["ARI", "LAR", "SF", "SEA"]
} as const;

export const TEAM_ICONS = {
  "BUF": "🦬", "MIA": "🐬", "NE": "🏴‍☠️", "NYJ": "✈️",
  "BAL": "🐦‍⬛", "CIN": "🐅", "CLE": "🐕", "PIT": "⚫",
  "HOU": "🤠", "IND": "🐎", "JAX": "🐆", "TEN": "⚔️",
  "DEN": "🐴", "KC": "👑", "LV": "🏴‍☠️", "LAC": "⚡",
  "DAL": "⭐", "NYG": "🏗️", "PHI": "🦅", "WAS": "🏛️",
  "CHI": "🐻", "DET": "🦁", "GB": "🧀", "MIN": "⚔️",
  "ATL": "🦅", "CAR": "🐾", "NO": "⚜️", "TB": "🏴‍☠️",
  "ARI": "🏜️", "LAR": "🐏", "SF": "🌉", "SEA": "🦅"
} as const;

export const CURRENT_SEASON = "2024";
export const CURRENT_WEEK = 18;

// NFL Team Colors from official team branding
export const NFL_TEAM_COLORS = {
  "ARI": { background: "#97233F", font: "#000000" },
  "ATL": { background: "#000000", font: "#A71930" },
  "BAL": { background: "#241773", font: "#000000" },
  "BUF": { background: "#FFFFFF", font: "#C60C30" },
  "CAR": { background: "#0085CA", font: "#101820" },
  "CHI": { background: "#0B162A", font: "#FFFFFF" },
  "CIN": { background: "#FB4F14", font: "#000000" },
  "CLE": { background: "#311D00", font: "#FF3C00" },
  "DAL": { background: "#869397", font: "#041E42" },
  "DEN": { background: "#FB4F14", font: "#002244" },
  "DET": { background: "#0076B6", font: "#B0B7BC" },
  "GB": { background: "#203731", font: "#FFB612" },
  "HOU": { background: "#03202F", font: "#A71930" },
  "IND": { background: "#002C5F", font: "#FFFFFF" },
  "JAX": { background: "#006778", font: "#D7A22A" },
  "KC": { background: "#E31837", font: "#FFFFFF" },
  "LV": { background: "#A5ACAF", font: "#000000" },
  "LAC": { background: "#0080C6", font: "#FFC20E" },
  "LAR": { background: "#003594", font: "#FFD100" },
  "MIA": { background: "#008E97", font: "#FC4C02" },
  "MIN": { background: "#4F2683", font: "#FFC62F" },
  "NE": { background: "#C60C30", font: "#002244" },
  "NO": { background: "#D3BC8D", font: "#101820" },
  "NYG": { background: "#0B2265", font: "#A71930" },
  "NYJ": { background: "#125740", font: "#FFFFFF" },
  "PHI": { background: "#004C54", font: "#A5ACAF" },
  "PIT": { background: "#FFB612", font: "#101820" },
  "SF": { background: "#AA0000", font: "#B3995D" },
  "SEA": { background: "#002244", font: "#69BE28" },
  "TB": { background: "#D50A0A", font: "#34302B" },
  "TEN": { background: "#4B92DB", font: "#A2AAAD" },
  "WAS": { background: "#5A1414", font: "#FFB612" }
} as const;
