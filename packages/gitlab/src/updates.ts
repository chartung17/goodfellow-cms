import { findUpdateResult, GitApiError, type SiteUpdates, type UpdateRun, UpdatesError } from "@goodfellow-cms/core";
import { type ApiOptions, gitlabJson, gitlabRequest } from "./api.js";

const CI_FILE = ".gitlab-ci.yml";
/** When the nightly schedule the Updates screen adds runs, in UTC, as the GitHub Pages workflow's does. */
const NIGHTLY = "17 4 * * *";

interface Pipeline {
  id: number;
  source?: string;
  status: string;
  created_at?: string;
  web_url?: string;
}

function notAllowed(error: unknown): never {
  if (error instanceof GitApiError && (error.status === 401 || error.status === 403)) {
    throw new UpdatesError("not-allowed", "Setting up updates on GitLab needs the Maintainer role in the project.");
  }
  throw error;
}

/**
 * The site's nightly update, which runs in its GitLab Pages job on scheduled
 * pipelines, and on pipelines the Updates screen starts with `GOODFELLOW_UPDATE`.
 * It publishes with the job's own token, which GitLab only allows once the
 * project lets job tokens push.
 */
export function gitlabUpdates(
  api: ApiOptions,
  project: string,
  branch: string,
  readAt: (path: string) => Promise<string | undefined>,
): SiteUpdates {
  const base = `/projects/${encodeURIComponent(project)}`;

  async function schedules() {
    return gitlabJson<Array<{ id: number; ref: string; active: boolean }>>(api, `${base}/pipeline_schedules`);
  }

  return {
    async setup() {
      const ci = await readAt(CI_FILE);
      if (!ci?.includes("update --publish")) return "missing";
      try {
        const [settings, found] = await Promise.all([
          gitlabJson<{ ci_push_repository_for_job_token_allowed?: boolean }>(api, base),
          schedules(),
        ]);
        const scheduled = found.some(
          (schedule) => schedule.active && (schedule.ref === branch || schedule.ref === `refs/heads/${branch}`),
        );
        return settings.ci_push_repository_for_job_token_allowed && scheduled ? "ready" : "needs-setup";
      } catch (error) {
        // Developers can't see a project's schedules; they can still see what the last run did.
        if (error instanceof GitApiError && error.status === 403) return "needs-setup";
        throw error;
      }
    },

    async enable() {
      await gitlabRequest(api, base, {
        method: "PUT",
        body: { ci_push_repository_for_job_token_allowed: true },
      }).catch(notAllowed);
      const found = await schedules().catch(notAllowed);
      if (!found.some((schedule) => schedule.active && schedule.ref.endsWith(branch))) {
        await gitlabRequest(api, `${base}/pipeline_schedules`, {
          method: "POST",
          body: {
            description: "Rebuild the site and install Goodfellow's fixes each night",
            ref: branch,
            cron: NIGHTLY,
            cron_timezone: "UTC",
            active: true,
          },
        }).catch(notAllowed);
      }
    },

    async lastRun(): Promise<UpdateRun | undefined> {
      const pipelines = await gitlabJson<Pipeline[]>(
        api,
        `${base}/pipelines?${new URLSearchParams({ ref: branch, per_page: "20" })}`,
      );
      for (const pipeline of pipelines) {
        if (pipeline.source !== "schedule" && pipeline.source !== "api") continue;
        const run = { date: pipeline.created_at, detailsUrl: pipeline.web_url };
        if (["created", "pending", "running", "waiting_for_resource", "preparing"].includes(pipeline.status)) {
          return { state: "running", ...run };
        }
        const jobs = await gitlabJson<Array<{ id: number; name: string }>>(
          api,
          `${base}/pipelines/${pipeline.id}/jobs?per_page=100`,
        );
        const job = jobs.find((candidate) => candidate.name === "pages");
        if (!job) continue;
        const response = await gitlabRequest(api, `${base}/jobs/${job.id}/trace`, { allow: [403, 404] });
        const result = response.ok ? findUpdateResult(await response.text()) : undefined;
        // A pipeline started for something else, which didn't update.
        if (!result) continue;
        return { state: result.state, result, ...run };
      }
      return undefined;
    },

    async start(target) {
      await gitlabRequest(api, `${base}/pipeline`, {
        method: "POST",
        body: { ref: branch, variables: [{ key: "GOODFELLOW_UPDATE", variable_type: "env_var", value: target }] },
      }).catch(notAllowed);
    },
  };
}
