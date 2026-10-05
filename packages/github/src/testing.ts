/**
 * A fake of the parts of GitHub's API that `@goodfellow/github` uses, backed by
 * an in-memory repository. For tests only: pass `fake.fetch` as the backend's
 * `fetch`, or route browser requests to `fake.handle` in end-to-end tests.
 */
import { decodeBase64, encodeBase64Bytes, type FileChange } from "@goodfellow/core";
import { FakeConflictError, FakeRepo, fakeFileBytes } from "@goodfellow/core/testing";

export interface FakeGitHubUser {
  login: string;
  name?: string;
  /** Whether the user may publish. Defaults to true. */
  push?: boolean;
}

export interface FakeDeploymentStatus {
  state: "queued" | "in_progress" | "success" | "failure" | "error" | "inactive";
  log_url?: string;
}

export interface FakeGitHubOptions {
  /** `owner/name`. */
  repo: string;
  files?: Record<string, string>;
  /** Access tokens and the users they belong to. */
  tokens?: Record<string, FakeGitHubUser>;
  /**
   * Simulates GitHub Pages or Vercel: every commit gets a deployment that
   * reports success after being checked this many times. Off by default.
   */
  deployAfterChecks?: number;
}

interface Deployment {
  id: number;
  sha: string;
  statuses: FakeDeploymentStatus[];
  checks: number;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export function fakeGitHub(options: FakeGitHubOptions) {
  const repo = new FakeRepo(options.files);
  const tokens = options.tokens ?? { "test-token": { login: "editor", name: "Test Editor" } };
  const deployments: Deployment[] = [];
  const requests: Request[] = [];
  let nextDeployment = 1;

  function deploy(sha: string): void {
    if (options.deployAfterChecks === undefined) return;
    deployments.unshift({ id: nextDeployment++, sha, statuses: [{ state: "in_progress" }], checks: 0 });
  }

  function commit(changes: FileChange[], message: string, expectedHead?: string): string {
    const sha = repo.commit(changes, message, { expectedHead });
    deploy(sha);
    return sha;
  }

  async function handle(request: Request): Promise<Response> {
    requests.push(request.clone());
    const url = new URL(request.url);
    const path = url.pathname;
    const user = tokens[request.headers.get("authorization")?.replace(/^Bearer /, "") ?? ""];
    if (!user) return json({ message: "Bad credentials" }, 401);

    if (path === "/user")
      return json({ login: user.login, name: user.name ?? null, avatar_url: `https://avatars.example/${user.login}` });

    if (path === "/graphql" && request.method === "POST") {
      const { variables } = (await request.json()) as {
        variables: {
          input: {
            branch: { repositoryNameWithOwner: string; branchName: string };
            message: { headline: string };
            expectedHeadOid: string;
            fileChanges: { additions?: Array<{ path: string; contents: string }>; deletions?: Array<{ path: string }> };
          };
        };
      };
      const { input } = variables;
      if (input.branch.repositoryNameWithOwner !== options.repo) {
        return json({ errors: [{ type: "NOT_FOUND", message: "Could not resolve to a Repository" }] });
      }
      if (user.push === false) return json({ errors: [{ type: "FORBIDDEN", message: "Resource not accessible" }] });
      const files = repo.files(input.branch.branchName);
      for (const deletion of input.fileChanges.deletions ?? []) {
        if (!files.has(deletion.path)) return json({ errors: [{ message: `No file at ${deletion.path}` }] });
      }
      try {
        const oid = commit(
          [
            ...(input.fileChanges.additions ?? []).map((addition) => ({
              path: addition.path,
              bytes: decodeBase64(addition.contents),
            })),
            ...(input.fileChanges.deletions ?? []).map((deletion) => ({ path: deletion.path, delete: true as const })),
          ],
          input.message.headline,
          input.expectedHeadOid,
        );
        return json({ data: { createCommitOnBranch: { commit: { oid } } } });
      } catch (error) {
        if (error instanceof FakeConflictError) {
          return json({
            data: { createCommitOnBranch: null },
            errors: [{ type: "STALE_DATA", message: "Expected branch to point to another commit" }],
          });
        }
        throw error;
      }
    }

    const match = path.match(/^\/repos\/([^/]+\/[^/]+)(\/.*)?$/);
    if (!match || decodeURIComponent(match[1] ?? "") !== options.repo) return json({ message: "Not Found" }, 404);
    const rest = match[2] ?? "";

    if (rest === "") {
      return json({
        full_name: options.repo,
        default_branch: repo.defaultBranch,
        permissions: { push: user.push !== false },
      });
    }

    const ref = rest.match(/^\/git\/ref\/heads\/(.+)$/);
    if (ref) {
      const sha = repo.branches.get(decodeURIComponent(ref[1] ?? ""));
      return sha ? json({ object: { sha, type: "commit" } }) : json({ message: "Not Found" }, 404);
    }

    const tree = rest.match(/^\/git\/trees\/([0-9a-f]{40})$/);
    if (tree) {
      const commitSha = tree[1] ?? "";
      if (!repo.commitAt(commitSha)) return json({ message: "Not Found" }, 404);
      const entries = [...repo.files(commitSha)].map(([file, content]) => ({
        path: file,
        type: "blob",
        sha: repo.blobSha(content),
      }));
      return json({ sha: commitSha, tree: entries, truncated: false });
    }

    const blob = rest.match(/^\/git\/blobs\/([0-9a-f]{40})$/);
    if (blob) {
      const content = repo.blobs.get(blob[1] ?? "");
      if (content === undefined) return json({ message: "Not Found" }, 404);
      return request.headers.get("accept")?.includes("raw")
        ? new Response(fakeFileBytes(content))
        : json({ content: encodeBase64Bytes(fakeFileBytes(content)), encoding: "base64" });
    }

    const compare = rest.match(/^\/compare\/([0-9a-f]{40})\.\.\.([0-9a-f]{40})$/);
    if (compare) {
      return json({ files: repo.changedPaths(compare[1] ?? "", compare[2] ?? "").map((filename) => ({ filename })) });
    }

    if (rest === "/deployments") {
      const sha = url.searchParams.get("sha");
      const list = deployments.filter((deployment) => !sha || deployment.sha === sha);
      return json(list.slice(0, Number(url.searchParams.get("per_page") ?? 30)).map(({ id, sha }) => ({ id, sha })));
    }

    const statuses = rest.match(/^\/deployments\/(\d+)\/statuses$/);
    if (statuses) {
      const deployment = deployments.find((candidate) => candidate.id === Number(statuses[1]));
      if (!deployment) return json({ message: "Not Found" }, 404);
      deployment.checks += 1;
      if (deployment.checks > (options.deployAfterChecks ?? 0) && deployment.statuses[0]?.state === "in_progress") {
        deployment.statuses.unshift({
          state: "success",
          log_url: `https://github.com/${options.repo}/actions/runs/${deployment.id}`,
        });
      }
      return json(deployment.statuses);
    }

    return json({ message: "Not Found" }, 404);
  }

  return {
    repo,
    deployments,
    /** Every request received, for checking what the backend sent. */
    requests,
    /** Simulates someone else publishing. */
    commit,
    handle,
    /** A `fetch` that answers from the fake instead of the network. */
    fetch: ((input: RequestInfo | URL, init?: RequestInit) => handle(new Request(input, init))) as typeof fetch,
  };
}

export type FakeGitHub = ReturnType<typeof fakeGitHub>;
