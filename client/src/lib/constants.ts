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
  "BAL": { background: "#241773", font: "#9E7C0C" },
  "BUF": { background: "#00338D", font: "#FFFFFF" },
  "CAR": { background: "#0085CA", font: "#101820" },
  "CHI": { background: "#0B162A", font: "#c83803" },
  "CIN": { background: "#FB4F14", font: "#000000" },
  "CLE": { background: "#311D00", font: "#FF3C00" },
  "DAL": { background: "#869397", font: "#041E42" },
  "DEN": { background: "#FB4F14", font: "#002244" },
  "DET": { background: "#0076B6", font: "#B0B7BC" },
  "GB": { background: "#203731", font: "#FFB612" },
  "HOU": { background: "#03202F", font: "#A71930" },
  "IND": { background: "#002C5F", font: "#FFFFFF" },
  "JAX": { background: "#006778", font: "#D7A22A" },
  "KC": { background: "#E31837", font: "#FFB81C" },
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

// MLB Team Colors
export const MLB_TEAM_COLORS = {
  "ARI": { background: "#A71930", font: "#E3D4AD" },
  "ATL": { background: "#CE1141", font: "#13274F" },
  "BAL": { background: "#000000", font: "#DF4601" },
  "BOS": { background: "#FFFFFF", font: "#BD3039" },
  "CHC": { background: "#0E3386", font: "#CC3433" },
  "CWS": { background: "#27251F", font: "#C4CED4" },
  "CIN": { background: "#C6011F", font: "#FFFFFF" },
  "CLE": { background: "#E50022", font: "#00385D" },
  "COL": { background: "#333366", font: "#C4CED4" },
  "DET": { background: "#0C2340", font: "#FA4616" },
  "HOU": { background: "#EB6E1F", font: "#002D62" },
  "KC": { background: "#004687", font: "#BD9B60" },
  "LAA": { background: "#BA0021", font: "#FFFFFF" },
  "LAD": { background: "#005A9C", font: "#FFFFFF" },
  "MIA": { background: "#00A3E0", font: "#000000" },
  "MIL": { background: "#FFC52F", font: "#12284B" },
  "MIN": { background: "#002B5C", font: "#D31145" },
  "NYM": { background: "#002D72", font: "#FF5910" },
  "NYY": { background: "#0C2340", font: "#FFFFFF" },
  "OAK": { background: "#003831", font: "#EFB21E" },
  "PHI": { background: "#E81828", font: "#FFFFFF" },
  "PIT": { background: "#27251F", font: "#FDB827" },
  "SD": { background: "#2F241D", font: "#FFC425" },
  "SF": { background: "#27251F", font: "#FD5A1E" },
  "SEA": { background: "#0C2C56", font: "#005C5C" },
  "STL": { background: "#C41E3A", font: "#FEDB00" },
  "TB": { background: "#8FBCE6", font: "#F5D130" },
  "TEX": { background: "#003278", font: "#C0111F" },
  "TOR": { background: "#134A8E", font: "#FFFFFF" },
  "WSH": { background: "#AB0003", font: "#14225A" }
} as const;

// NBA Team Colors
export const NBA_TEAM_COLORS = {
  "ATL": { background: "#C8102E", font: "#FDB927" },
  "BOS": { background: "#007A33", font: "#FFFFFF" },
  "BKN": { background: "#000000", font: "#FFFFFF" },
  "CHA": { background: "#00788C", font: "#A1A1A4" },
  "CHI": { background: "#CE1141", font: "#000000" },
  "CLE": { background: "#860038", font: "#FDBB30" },
  "DAL": { background: "#002B5E", font: "#B8C4CA" },
  "DEN": { background: "#0E2240", font: "#FEC524" },
  "DET": { background: "#1D42BA", font: "#C8102E" },
  "GSW": { background: "#FFC72C", font: "#1D428A" },
  "HOU": { background: "#CE1141", font: "#C4CED4" },
  "IND": { background: "#FDBB30", font: "#002D62" },
  "LAC": { background: "#1D428A", font: "#C8102E" },
  "LAL": { background: "#FDB927", font: "#552583" },
  "MEM": { background: "#5D76A9", font: "#707271" },
  "MIA": { background: "#000000", font: "#98002E" },
  "MIL": { background: "#00471B", font: "#EEE1C6" },
  "MIN": { background: "#236192", font: "#9EA2A2" },
  "NOP": { background: "#0C2340", font: "#85714D" },
  "NYK": { background: "#006BB6", font: "#F58426" },
  "OKC": { background: "#007AC1", font: "#EF3B24" },
  "ORL": { background: "#0077C0", font: "#000000" },
  "PHI": { background: "#FFFFFF", font: "#006BB6" },
  "PHX": { background: "#1D1160", font: "#E56020" },
  "POR": { background: "#000000", font: "#E03A3E" },
  "SAC": { background: "#5A2D81", font: "#63727A" },
  "SAS": { background: "#C4CED4", font: "#000000" },
  "TOR": { background: "#753BBD", font: "#CE1141" },
  "UTA": { background: "#00471B", font: "#F9A01B" },
  "WAS": { background: "#002B5C", font: "#E31837" }
} as const;
