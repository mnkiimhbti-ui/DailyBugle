/**
 * Twice daily sync, run by GitHub Actions (.github/workflows/sync.yml).
 * Running here instead of inside a Vercel function avoids serverless timeouts.
 *
 * Local run:  npm run sync
 * Flags:      --news-only  --videos-only
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { runSync } from "../src/lib/sync";

async function main() {
  const args = new Set(process.argv.slice(2));
  const report = await runSync(process.env.GITHUB_ACTIONS ? "github-actions" : "manual-cli", {
    news: !args.has("--videos-only"),
    videos: !args.has("--news-only"),
  });
  console.log(JSON.stringify(report, null, 2));
  // Partial errors (one bad channel) should not fail the workflow; a run that did nothing at all should.
  const didNothing = report.tavilyUsed === 0 && report.youtubeUsed === 0;
  if (didNothing && report.errors.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
