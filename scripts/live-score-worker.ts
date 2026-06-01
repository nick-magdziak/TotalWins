/**
 * Live score worker — thin wrapper
 * ---------------------------------
 * All sync logic lives in server/services/liveScoreSync.ts.
 * This file registers signal handlers and launches the shared module,
 * preserving the option to run a standalone worker on a Reserved VM.
 *
 * Run locally:
 *   npm run worker:live-scores
 */

import { startLiveScoreSync } from "../server/services/liveScoreSync";

process.on("SIGTERM", () => {
  console.log("[live-score-worker] SIGTERM received, exiting");
  process.exit(0);
});
process.on("SIGINT", () => {
  console.log("[live-score-worker] SIGINT received, exiting");
  process.exit(0);
});

startLiveScoreSync((err) => {
  console.error("[live-score-worker] fatal error in sync loop:", err);
  process.exit(1);
});
