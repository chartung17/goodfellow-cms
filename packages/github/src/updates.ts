import { GitApiError, type SiteUpdates, siteVersion, type UpdateRun, UpdatesError } from "@goodfellow-cms/core";
import { type ApiOptions, githubJson, githubRequest } from "./api.js";

/** The starters' GitHub Pages workflow, which runs `goodfellow update` each night and when it's dispatched. */
const WORKFLOW = "deploy.yml";
const WORKFLOW_FILE = `.github/workflows/${WORKFLOW}`;

interface Run {
  id: number;
  event: string;
  status: string;
  conclusion: string | null;
  head_sha: string;
  created_at?: string;
  html_url?: string;
}

interface Job {
  name: string;
  conclusion: string | null;
}

interface Reads {
  read(path: string): Promise<string | undefined>;
  readAt(path: string, revision: string): Promise<string | undefined>;
}

/**
 * The site's nightly update, which runs in its GitHub Pages workflow. Running
 * it now dispatches the workflow, which needs GitHub's Actions permission
 * with write access: `manage()` gives the owner token when one is in use.
 */
export function githubUpdates(
  read: ApiOptions,
  manage: () => ApiOptions | undefined,
  repo: string,
  branch: string,
  files: Reads,
): SiteUpdates {
  const path = `/repos/${repo}/actions/workflows/${WORKFLOW}`;

  return {
    async setup() {
      const workflow = await files.read(WORKFLOW_FILE);
      return workflow?.includes("update --publish") ? "ready" : "missing";
    },

    async lastRun(): Promise<UpdateRun | undefined> {
      const response = await githubRequest(read, `${path}/runs?branch=${encodeURIComponent(branch)}&per_page=20`, {
        allow: [403, 404],
      });
      if (!response.ok) return undefined;
      const { workflow_runs: runs = [] } = (await response.json()) as { workflow_runs?: Run[] };
      for (const run of runs.filter((candidate) => ["schedule", "workflow_dispatch"].includes(candidate.event))) {
        const base = { date: run.created_at, detailsUrl: run.html_url };
        if (run.status !== "completed") return { state: "running", ...base };
        const { jobs = [] } = await githubJson<{ jobs?: Job[] }>(read, `/repos/${repo}/actions/runs/${run.id}/jobs`);
        const job = jobs.find((candidate) => candidate.name === "update");
        // A run dispatched only to build, which didn't update.
        if (!job || job.conclusion === "skipped") continue;
        if (job.conclusion !== "success") return { state: "failed", ...base };
        // Fine-grained tokens can't read the job's log, so compare the site's version before and after.
        const before = siteVersion((await files.readAt("package.json", run.head_sha)) ?? "");
        const now = siteVersion((await files.read("package.json")) ?? "");
        if (!before || !now || before === now) return { state: "up-to-date", ...base };
        return { state: "updated", ...base, result: { state: "updated", from: before, to: now } };
      }
      return undefined;
    },

    async start(target) {
      try {
        await githubRequest(manage() ?? read, `${path}/dispatches`, {
          method: "POST",
          body: { ref: branch, inputs: { update: target } },
        });
      } catch (error) {
        if (error instanceof GitApiError && (error.status === 403 || error.status === 401)) {
          throw new UpdatesError("not-allowed", "Running the update needs a token that can run the site's workflows.");
        }
        // No such workflow, or an older one that takes no inputs.
        if (error instanceof GitApiError && (error.status === 404 || error.status === 422)) {
          throw new UpdatesError("missing", "The site's GitHub Pages workflow doesn't update Goodfellow.");
        }
        throw error;
      }
    },
  };
}
