---
name: WC daily standings Discord timing
description: How getTodayLastCompletedGameAt and checkAndPostDailyStandings work together to post standings once per day after all games finish
---

## Rule
`getTodayLastCompletedGameAt` uses an **EDT boundary** (window = today 04:00 UTC → tomorrow 04:00 UTC) so that games like KOR vs CZE at 02:00 UTC (10pm ET) are treated as the same game-day as afternoon games.

**Why:** Using UTC midnight caused premature posts — a 10pm ET game at 02:00 UTC fell outside the UTC window, so the system saw only 3pm ET games as "today", declared allDone=true, and posted 4 hours early.

**How to apply:** `etOffsetMs = 4 * 60 * 60 * 1000`; `etNow = new Date(Date.now() - etOffsetMs)`; `todayStart = Date.UTC(etNow.getUTCFullYear, month, date) + etOffsetMs`. Window is `[todayStart, todayStart + 24h)`.

## Persistence
`dailyPostSentOn` was an in-memory Map — cleared on every server restart, causing re-posts on any deploy/crash. Fixed by storing `discordStandingsPostedOn` (text "YYYY-MM-DD" UTC) on the `leagues` row. Updated via `storage.updateLeagueDiscordStandingsPostedOn(leagueId, todayStr)`.

`todayStr = new Date().toISOString().slice(0, 10)` (UTC date). Intentionally UTC, not ET — the posting event happens after midnight UTC for late ET games, which is fine since the ET window ensures all same-ET-day games are checked together before posting.

## Debug log
`[getTodayLastCompletedGameAt]` line in storage.ts prints sport, window, and found games on every check. Useful for diagnosing future timing issues.

## Dev DB note
Dev DB re-seeds all 72 WC fixtures on every server restart (wipes ESPN-synced scores). Normal behavior. ESPN sync re-applies live data on startup.
