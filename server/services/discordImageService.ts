import type { PlayerStanding, WCPlayerStanding } from "../../shared/schema";

type AnyStanding = {
  rank: number;
  displayName: string;
  totalWins: number;
  teams: { abbreviation: string; wins?: number | null; eliminated?: boolean }[];
};

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rankColor(rank: number): string {
  if (rank === 1) return "#ffd700";
  if (rank === 2) return "#00d4c8";
  if (rank === 3) return "#ff6b9d";
  return "#94a3b8";
}

function rowBg(rank: number, index: number): string {
  if (rank === 1) return "#1a2500";
  if (rank === 2) return "#001a1a";
  if (rank === 3) return "#1a0010";
  return index % 2 === 0 ? "#111827" : "#0f172a";
}

export async function generateStandingsImage(
  leagueName: string,
  sport: string,
  standings: AnyStanding[]
): Promise<Buffer> {
  const { Resvg } = await import("@resvg/resvg-js");

  const PADDING = 16;
  const ROW_H = 44;
  const HEADER_H = 70;
  const COL_RANK = 36;
  const COL_NAME = 160;
  const COL_WINS = 56;
  const TEAM_CELL = 82;

  const maxTeams = Math.max(...standings.map(s => s.teams.length), 0);
  const W = PADDING + COL_RANK + COL_NAME + COL_WINS + maxTeams * TEAM_CELL + PADDING;
  const H = HEADER_H + standings.length * ROW_H + PADDING;

  const today = new Date();
  const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;

  let rows = "";
  for (let i = 0; i < standings.length; i++) {
    const s = standings[i];
    const y = HEADER_H + i * ROW_H;
    const midY = y + ROW_H / 2;
    const baselineY = midY + 5;
    const bg = rowBg(s.rank, i);
    const rc = rankColor(s.rank);

    rows += `<rect x="0" y="${y}" width="${W}" height="${ROW_H}" fill="${bg}"/>`;

    let x = PADDING;

    rows += `<text x="${x + COL_RANK - 4}" y="${baselineY}" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="15" font-weight="bold" fill="${rc}">${s.rank}</text>`;
    x += COL_RANK + 8;

    rows += `<text x="${x}" y="${baselineY}" text-anchor="start" font-family="Arial,Helvetica,sans-serif" font-size="15" font-weight="bold" fill="#f1f5f9">${escapeXml(s.displayName)}</text>`;
    x += COL_NAME;

    rows += `<text x="${x}" y="${baselineY}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="bold" fill="${rc}">${s.totalWins}</text>`;
    x += COL_WINS;

    for (const team of s.teams) {
      rows += `<text x="${x + 4}" y="${baselineY - 3}" text-anchor="start" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="bold" fill="#94a3b8">${escapeXml(team.abbreviation)}</text>`;
      rows += `<text x="${x + 34}" y="${baselineY - 3}" text-anchor="start" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="bold" fill="#e2e8f0">${team.wins ?? 0}</text>`;
      // Gray overlay for eliminated teams — mirrors the bg-gray-500/60 overlay in StandingsTable
      if (team.eliminated) {
        rows += `<rect x="${x + 1}" y="${y + 3}" width="${TEAM_CELL - 3}" height="${ROW_H - 6}" rx="2" fill="#6b7280" fill-opacity="0.6"/>`;
      }
      rows += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + ROW_H}" stroke="#1e293b" stroke-width="1"/>`;
      x += TEAM_CELL;
    }

    rows += `<line x1="0" y1="${y + ROW_H}" x2="${W}" y2="${y + ROW_H}" stroke="#1e293b" stroke-width="1"/>`;
  }

  const colHeaderY = HEADER_H - 6;
  let colHeaders = "";
  {
    let x = PADDING;
    colHeaders += `<text x="${x + COL_RANK - 4}" y="${colHeaderY}" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="10" fill="#475569">#</text>`;
    x += COL_RANK + 8;
    colHeaders += `<text x="${x}" y="${colHeaderY}" text-anchor="start" font-family="Arial,Helvetica,sans-serif" font-size="10" fill="#475569">NAME</text>`;
    x += COL_NAME;
    colHeaders += `<text x="${x}" y="${colHeaderY}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="10" fill="#475569">W</text>`;
    x += COL_WINS;
    colHeaders += `<text x="${x}" y="${colHeaderY}" text-anchor="start" font-family="Arial,Helvetica,sans-serif" font-size="10" fill="#475569">TEAMS</text>`;
  }

  const sportLabel = sport === "WORLD_CUP" ? "WORLD CUP" : sport;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#0a0f1a"/>
  <rect x="0" y="0" width="${W}" height="${HEADER_H - 16}" fill="#0f172a"/>
  <text x="${W / 2}" y="26" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="17" font-weight="bold" fill="#00d4c8">${escapeXml(leagueName)} · Standings</text>
  <text x="${W / 2}" y="46" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="13" fill="#64748b">As Of: ${escapeXml(dateStr)}</text>
  ${colHeaders}
  ${rows}
</svg>`;

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width" as const, value: W },
  });
  const pngData = resvg.render();
  return Buffer.from(pngData.asPng());
}
