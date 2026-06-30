---
name: Penalty shootout tracking
description: How World Cup penalty shootout results are parsed, stored, and used for scoring/elimination.
---

# Penalty Shootout Tracking

## Rule
When ESPN returns `STATUS_FINAL_PEN`, the regular-time score is level (e.g. 1-1). The actual winner is identified via `competitor.winner === true` (or `shootoutScore` fallback). Goal-diff alone cannot determine winner/loser.

## How to apply
- `penaltyWinnerId TEXT` column in `games` table (added via `ALTER TABLE`).
- worldCupService.ts parser checks `statusName === "STATUS_FINAL_PEN"`, reads `homeComp.winner` / `awayComp.winner`, writes winning team's internal ID into `penaltyWinnerId`.
- Both `updateGame` call sites (syncWorldCupGames + syncWorldCupGamesForDate) pass `penaltyWinnerId`.
- Scoring: `gf > ga || g.penaltyWinnerId === teamId` awards +2 for knockout wins (two places in storage.ts: calculateWorldCupPlayerPoints and getWorldCupPlayerStandings).
- Elimination: when scores equal and `penaltyWinnerId` set, eliminate the OTHER team.

**Why:** ESPN encodes the shootout result in `competitor.winner`, not in the regular score. Without this column, a 1-1 pen game awards 0 points and neither team gets eliminated.
