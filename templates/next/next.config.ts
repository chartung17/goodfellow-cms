import { withGoodfellow } from "@goodfellow-cms/next/config";

// Builds the site as static files in out/. Add your own Next.js settings inside withGoodfellow({ ... }).
export default withGoodfellow({
  // Stops `next dev` adding AGENTS.md and CLAUDE.md to the site.
  agentRules: false,
});
