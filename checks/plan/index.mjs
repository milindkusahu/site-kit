import { checkBriefs } from "./briefs.mjs";
import { checkConsolidated, checkDesignDecisions, checkReferences } from "./design.mjs";
import { checkAiAnswers, checkCompetitors, checkInventory } from "./research.mjs";
import { checkSilo } from "./silo.mjs";
import { createContext, tickedStages } from "./util.mjs";

export const STAGES = ["research", "silo plan", "design references", "design directions", "design consolidated", "page briefs"];

export function runPlanChecks(root) {
  const ctx = createContext(root);
  ctx.summary = [];
  const ticked = tickedStages(ctx);
  const on = (s) => ticked.has(s);
  const inventory = checkInventory(ctx, on("research"));
  const competitors = checkCompetitors(ctx, on("research"));
  checkAiAnswers(ctx, on("research"));
  const silo = checkSilo(ctx, on("silo plan"), inventory, competitors);
  checkReferences(ctx, on("design references"));
  checkDesignDecisions(ctx, on("design directions"));
  checkConsolidated(ctx, on("design consolidated"));
  checkBriefs(ctx, on("page briefs"), silo);
  for (const [i, stage] of STAGES.entries()) {
    const earlier = STAGES.slice(0, i).filter((s) => !on(s));
    if (on(stage) && earlier.length > 0) ctx.fail("order", "docs/PROGRESS.md", `"${stage}" is ticked before ${earlier.join(", ")}.`);
  }
  return { problems: ctx.problems, summary: ctx.summary, ticked: [...ticked] };
}
