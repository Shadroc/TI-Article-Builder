/**
 * Test that TMT site can be published to. Runs pipeline with 1 article.
 * Run: npx tsx scripts/test-tmt-publish.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const { runPipeline } = await import("../src/pipeline/orchestrator");
  const result = await runPipeline({
    trigger: "manual",
    articleCount: 1,
    headlinesDate: "today",
  });
  console.log("Run ID:", result.runId);
  console.log("Articles processed:", result.articlesProcessed);
  if (result.errors.length > 0) {
    console.error("Errors:", result.errors);
    process.exit(1);
  }
  console.log("Success - check workflow_steps for publish_tmt step.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
