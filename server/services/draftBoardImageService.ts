import type { WorldCupTeam, DraftPick, League, LeagueMember } from "../../shared/schema";

export type DraftBoardData = {
  league: League;
  members: Array<{ userId: string; displayName: string; draftPosition: number | null }>;
  picks: DraftPick[];
  wcTeams: WorldCupTeam[];
};

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const GROUPS = ["A","B","C","D","E","F","G","H","I","J","K","L"] as const;

const GROUP_PALETTE = [
  { hdr: "#00d4c8", hdrBg: "#081f1e", teamBg: "#0a1410" }, // teal
  { hdr: "#ff6b9d", hdrBg: "#1f0811", teamBg: "#140a0d" }, // pink
  { hdr: "#a78bfa", hdrBg: "#100817", teamBg: "#0d0a14" }, // purple
  { hdr: "#ffd700", hdrBg: "#1a1500", teamBg: "#131000" }, // gold
];

export async function generateDraftBoardImage(data: DraftBoardData): Promise<Buffer> {
  const { Resvg } = await import("@resvg/resvg-js");

  const { league, members, picks, wcTeams } = data;

  // Index data
  const teamById = new Map(wcTeams.map(t => [t.id, t]));
  const userById = new Map(members.map(m => [m.userId, m.displayName]));
  const pickedTeamIds = new Set(picks.map(p => p.teamId));
  const pickByNumber = [...picks].sort((a, b) => (a.pickNumber ?? 0) - (b.pickNumber ?? 0));

  const picksByUserId = new Map<string, WorldCupTeam[]>();
  for (const m of members) picksByUserId.set(m.userId, []);
  for (const pick of pickByNumber) {
    const team = teamById.get(pick.teamId);
    if (team && pick.userId) {
      picksByUserId.get(pick.userId)?.push(team);
    }
  }

  const teamsByGroup = new Map<string, WorldCupTeam[]>();
  for (const g of GROUPS) teamsByGroup.set(g, []);
  for (const t of wcTeams) {
    teamsByGroup.get(t.group)?.push(t);
  }

  const totalExpectedPicks = Math.min(48, members.length * (league.teamsPerPlayer ?? 6));
  const maxTeamsPerPlayer = Math.max(...members.map(m => (picksByUserId.get(m.userId)?.length ?? 0)), 1, league.teamsPerPlayer ?? 6);

  // Layout constants
  const TOTAL_W = 1000;
  const HEADER_H = 50;
  const LEFT_W = 182;
  const RIGHT_W = 142;
  const CENTER_W = TOTAL_W - LEFT_W - RIGHT_W; // 676

  const PICK_ROW_H = 16;
  const PICK_HDR_H = 22;
  const LEFT_CONTENT_H = PICK_HDR_H + totalExpectedPicks * PICK_ROW_H;

  const GRP_COL_W = Math.floor(CENTER_W / 4); // 169
  const GRP_HDR_H = 22;
  const GRP_TEAM_H = 18;
  const GRP_CELL_H = GRP_HDR_H + 4 * GRP_TEAM_H; // 94
  const GRP_GAP = 6;
  const GRP_SECTION_H = 3 * GRP_CELL_H + 2 * GRP_GAP; // 294

  const PLR_COL_W = Math.floor(CENTER_W / 4); // 169
  const PLR_HDR_H = 22;
  const PLR_TEAM_H = 17;
  const PLR_CELL_H = PLR_HDR_H + maxTeamsPerPlayer * PLR_TEAM_H;
  const PLR_GAP = 6;
  const PLR_ROWS = Math.ceil(members.length / 4);
  const PLR_SECTION_H = PLR_ROWS * PLR_CELL_H + (PLR_ROWS - 1) * PLR_GAP;

  const CENTER_SECTION_GAP = 10;
  const CENTER_CONTENT_H = GRP_SECTION_H + CENTER_SECTION_GAP + PLR_SECTION_H;

  const ALPHA_ROW_H = 15;
  const ALPHA_HDR_H = 22;
  const RIGHT_CONTENT_H = ALPHA_HDR_H + wcTeams.length * ALPHA_ROW_H;

  const CONTENT_H = Math.max(LEFT_CONTENT_H, CENTER_CONTENT_H, RIGHT_CONTENT_H);
  const TOTAL_H = HEADER_H + CONTENT_H + 12;

  const CONTENT_TOP = HEADER_H + 8;

  const today = new Date();
  const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${TOTAL_W}" height="${TOTAL_H}" viewBox="0 0 ${TOTAL_W} ${TOTAL_H}">
  <defs>
    <style>text { font-family: Arial, Helvetica, sans-serif; }</style>
  </defs>
  <!-- Background -->
  <rect width="${TOTAL_W}" height="${TOTAL_H}" fill="#0a0f1a"/>
  <!-- Header -->
  <rect x="0" y="0" width="${TOTAL_W}" height="${HEADER_H}" fill="#0f172a"/>
  <text x="${TOTAL_W / 2}" y="22" text-anchor="middle" font-size="17" font-weight="bold" fill="#00d4c8">${escapeXml(league.name)} · WORLD CUP DRAFT BOARD</text>
  <text x="${TOTAL_W / 2}" y="40" text-anchor="middle" font-size="12" fill="#64748b">Updated: ${escapeXml(dateStr)} · ${picks.length} / ${totalExpectedPicks} picks made</text>
  <!-- Panel dividers -->
  <line x1="${LEFT_W}" y1="${HEADER_H}" x2="${LEFT_W}" y2="${TOTAL_H}" stroke="#1e293b" stroke-width="1"/>
  <line x1="${TOTAL_W - RIGHT_W}" y1="${HEADER_H}" x2="${TOTAL_W - RIGHT_W}" y2="${TOTAL_H}" stroke="#1e293b" stroke-width="1"/>
`;

  // ── LEFT PANEL: pick list ──────────────────────────────────────────────
  const LP = 4; // left padding
  svg += `<rect x="0" y="${HEADER_H}" width="${LEFT_W}" height="${TOTAL_H - HEADER_H}" fill="#080d18"/>`;

  // Column headers
  const hdrY = CONTENT_TOP + 14;
  svg += `<text x="${LP + 20}" y="${hdrY}" text-anchor="middle" font-size="9" fill="#475569">#</text>`;
  svg += `<text x="${LP + 58}" y="${hdrY}" text-anchor="middle" font-size="9" fill="#475569">TEAM</text>`;
  svg += `<text x="${LP + 130}" y="${hdrY}" text-anchor="middle" font-size="9" fill="#475569">PLAYER</text>`;
  svg += `<line x1="0" y1="${CONTENT_TOP + PICK_HDR_H}" x2="${LEFT_W}" y2="${CONTENT_TOP + PICK_HDR_H}" stroke="#1e293b" stroke-width="1"/>`;

  for (let i = 0; i < totalExpectedPicks; i++) {
    const pick = pickByNumber[i];
    const rowY = CONTENT_TOP + PICK_HDR_H + i * PICK_ROW_H;
    const midY = rowY + PICK_ROW_H / 2 + 4;
    const rowBg = i % 2 === 0 ? "#080d18" : "#0c1320";

    svg += `<rect x="0" y="${rowY}" width="${LEFT_W}" height="${PICK_ROW_H}" fill="${rowBg}"/>`;

    if (pick) {
      const team = teamById.get(pick.teamId);
      const player = userById.get(pick.userId ?? "") ?? "?";
      const teamAbbr = team?.abbreviation ?? pick.teamId.slice(0, 3).toUpperCase();
      const teamName = team?.name ?? pick.teamId;
      const gidx = GROUPS.indexOf((team?.group ?? "A") as typeof GROUPS[number]);
      const c = GROUP_PALETTE[gidx % 4];

      svg += `<text x="${LP + 20}" y="${midY}" text-anchor="middle" font-size="10" fill="#64748b">${pick.pickNumber}</text>`;
      svg += `<text x="${LP + 40}" y="${midY}" text-anchor="start" font-size="10" font-weight="bold" fill="${c.hdr}">${escapeXml(teamAbbr)}</text>`;
      svg += `<text x="${LP + 78}" y="${midY}" text-anchor="start" font-size="9" fill="#94a3b8">${escapeXml(teamName.length > 10 ? teamName.slice(0, 10) : teamName)}</text>`;
      svg += `<text x="${LEFT_W - LP}" y="${midY}" text-anchor="end" font-size="9" fill="#cbd5e1">${escapeXml(player.length > 10 ? player.slice(0, 10) : player)}</text>`;
    } else {
      svg += `<text x="${LP + 20}" y="${midY}" text-anchor="middle" font-size="10" fill="#1e293b">${i + 1}</text>`;
    }
  }

  // ── CENTER PANEL: groups grid ──────────────────────────────────────────
  const CX = LEFT_W; // center x start

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const gidx = row * 4 + col;
      const grp = GROUPS[gidx];
      const palette = GROUP_PALETTE[col % 4];
      const gx = CX + col * GRP_COL_W;
      const gy = CONTENT_TOP + row * (GRP_CELL_H + GRP_GAP);
      const teams = teamsByGroup.get(grp) ?? [];

      // Group cell background
      svg += `<rect x="${gx}" y="${gy}" width="${GRP_COL_W}" height="${GRP_CELL_H}" fill="${palette.teamBg}"/>`;

      // Group header
      svg += `<rect x="${gx}" y="${gy}" width="${GRP_COL_W}" height="${GRP_HDR_H}" fill="${palette.hdrBg}"/>`;
      svg += `<text x="${gx + GRP_COL_W / 2}" y="${gy + 15}" text-anchor="middle" font-size="12" font-weight="bold" fill="${palette.hdr}">Group ${grp}</text>`;

      // Teams in group
      for (let ti = 0; ti < Math.min(4, teams.length); ti++) {
        const t = teams[ti];
        const ty = gy + GRP_HDR_H + ti * GRP_TEAM_H;
        const isDrafted = pickedTeamIds.has(t.id);
        const rowColor = ti % 2 === 0 ? palette.teamBg : "#0a0f1a";
        svg += `<rect x="${gx}" y="${ty}" width="${GRP_COL_W}" height="${GRP_TEAM_H}" fill="${rowColor}"/>`;

        if (isDrafted) {
          const draftedBy = picks.find(p => p.teamId === t.id);
          const player = draftedBy?.userId ? (userById.get(draftedBy.userId) ?? "") : "";
          svg += `<text x="${gx + 5}" y="${ty + 13}" text-anchor="start" font-size="10" fill="#334155">${escapeXml(t.name)}</text>`;
          if (player) {
            svg += `<text x="${gx + GRP_COL_W - 4}" y="${ty + 13}" text-anchor="end" font-size="9" fill="#475569">✓ ${escapeXml(player.slice(0, 8))}</text>`;
          }
        } else {
          svg += `<text x="${gx + 5}" y="${ty + 13}" text-anchor="start" font-size="10" fill="#e2e8f0">${escapeXml(t.name)}</text>`;
        }
      }

      // Bottom border
      svg += `<line x1="${gx}" y1="${gy + GRP_CELL_H}" x2="${gx + GRP_COL_W}" y2="${gy + GRP_CELL_H}" stroke="#1e293b" stroke-width="1"/>`;
      // Right border
      if (col < 3) {
        svg += `<line x1="${gx + GRP_COL_W}" y1="${gy}" x2="${gx + GRP_COL_W}" y2="${gy + GRP_CELL_H}" stroke="#1e293b" stroke-width="1"/>`;
      }
    }
  }

  // ── CENTER PANEL: player draft boards ─────────────────────────────────
  const PLR_TOP = CONTENT_TOP + GRP_SECTION_H + CENTER_SECTION_GAP;

  // Sort members by draft position
  const sortedMembers = [...members].sort((a, b) => (a.draftPosition ?? 99) - (b.draftPosition ?? 99));

  for (let mi = 0; mi < sortedMembers.length; mi++) {
    const member = sortedMembers[mi];
    const col = mi % 4;
    const row = Math.floor(mi / 4);
    const px = CX + col * PLR_COL_W;
    const py = PLR_TOP + row * (PLR_CELL_H + PLR_GAP);
    const playerTeams = picksByUserId.get(member.userId) ?? [];

    // Player header
    svg += `<rect x="${px}" y="${py}" width="${PLR_COL_W}" height="${PLR_HDR_H}" fill="#0f1f3d"/>`;
    svg += `<text x="${px + PLR_COL_W / 2}" y="${py + 15}" text-anchor="middle" font-size="11" font-weight="bold" fill="#ff6b9d">${escapeXml(member.displayName)}</text>`;

    // Player's teams
    for (let ti = 0; ti < maxTeamsPerPlayer; ti++) {
      const team = playerTeams[ti];
      const ty = py + PLR_HDR_H + ti * PLR_TEAM_H;
      const rowBg = ti % 2 === 0 ? "#0c1320" : "#080d18";
      svg += `<rect x="${px}" y="${ty}" width="${PLR_COL_W}" height="${PLR_TEAM_H}" fill="${rowBg}"/>`;

      if (team) {
        const gidx = GROUPS.indexOf(team.group as typeof GROUPS[number]);
        const c = GROUP_PALETTE[gidx % 4];
        svg += `<text x="${px + 5}" y="${ty + 12}" text-anchor="start" font-size="10" fill="${c.hdr}">${escapeXml(team.abbreviation)}</text>`;
        svg += `<text x="${px + 32}" y="${ty + 12}" text-anchor="start" font-size="10" fill="#cbd5e1">${escapeXml(team.name.length > 12 ? team.name.slice(0, 12) : team.name)}</text>`;
      }
    }

    // Border
    if (col < 3) {
      svg += `<line x1="${px + PLR_COL_W}" y1="${py}" x2="${px + PLR_COL_W}" y2="${py + PLR_CELL_H}" stroke="#1e293b" stroke-width="1"/>`;
    }
    svg += `<line x1="${px}" y1="${py + PLR_CELL_H}" x2="${px + PLR_COL_W}" y2="${py + PLR_CELL_H}" stroke="#1e293b" stroke-width="1"/>`;
    svg += `<rect x="${px}" y="${py}" width="${PLR_COL_W}" height="${PLR_CELL_H}" fill="none" stroke="#1e293b" stroke-width="1"/>`;
  }

  // ── RIGHT PANEL: alphabetical team list ───────────────────────────────
  const RX = TOTAL_W - RIGHT_W;
  const RP = 5;

  svg += `<rect x="${RX}" y="${HEADER_H}" width="${RIGHT_W}" height="${TOTAL_H - HEADER_H}" fill="#080d18"/>`;

  const alphaTeams = [...wcTeams].sort((a, b) => a.name.localeCompare(b.name));

  svg += `<text x="${RX + RIGHT_W / 2}" y="${CONTENT_TOP + 14}" text-anchor="middle" font-size="9" fill="#475569">ALL TEAMS</text>`;
  svg += `<line x1="${RX}" y1="${CONTENT_TOP + ALPHA_HDR_H}" x2="${TOTAL_W}" y2="${CONTENT_TOP + ALPHA_HDR_H}" stroke="#1e293b" stroke-width="1"/>`;

  for (let i = 0; i < alphaTeams.length; i++) {
    const t = alphaTeams[i];
    const ty = CONTENT_TOP + ALPHA_HDR_H + i * ALPHA_ROW_H;
    const isDrafted = pickedTeamIds.has(t.id);
    const rowBg = i % 2 === 0 ? "#080d18" : "#0c1320";
    svg += `<rect x="${RX}" y="${ty}" width="${RIGHT_W}" height="${ALPHA_ROW_H}" fill="${rowBg}"/>`;

    if (isDrafted) {
      svg += `<text x="${RX + RP}" y="${ty + 11}" text-anchor="start" font-size="9" fill="#334155">${escapeXml(t.name)}</text>`;
    } else {
      const gidx = GROUPS.indexOf(t.group as typeof GROUPS[number]);
      const c = GROUP_PALETTE[gidx % 4];
      svg += `<text x="${RX + RP}" y="${ty + 11}" text-anchor="start" font-size="9" fill="#e2e8f0">${escapeXml(t.name)}</text>`;
      svg += `<text x="${TOTAL_W - RP}" y="${ty + 11}" text-anchor="end" font-size="8" fill="${c.hdr}">${escapeXml(t.group)}</text>`;
    }
  }

  svg += `</svg>`;

  const resvg = new Resvg(svg, { fitTo: { mode: "width" as const, value: TOTAL_W } });
  const pngData = resvg.render();
  return Buffer.from(pngData.asPng());
}
