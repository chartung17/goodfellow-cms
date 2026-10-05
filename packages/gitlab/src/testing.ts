/**
 * A fake of the parts of GitLab's API that `@goodfellow/gitlab` uses, backed by
 * an in-memory repository, including OAuth with PKCE. For tests only.
 */
import { decodeBase64, type FileChange } from "@goodfellow/core";
import { FakeRepo, fakeFileBytes } from "@goodfellow/core/testing";

export interface FakeGitLabUser {
  username: string;
  name?: string;
  /** GitLab access level: 30 is Developer, 40 Maintainer. Defaults to 40. */
  accessLevel?: number;
}

export interface FakeGitLabOptions {
  project: string;
  url?: string;
  files?: Record<string, string>;
  /** Personal access tokens and their users. */
  tokens?: Record<string, FakeGitLabUser>;
  /** The OAuth application's ID, and the user who signs in through it. */
  oauth?: { clientId: string; user: FakeGitLabUser; expiresIn?: number };
  /** Simulates a GitLab Pages pipeline that succeeds after being checked this many times. Off by default. */
  deployAfterChecks?: number;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function sha256Base64Url(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  let binary = "";
  for (const byte of digest) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fakeGitLab(options: FakeGitLabOptions) {
  const webUrl = options.url ?? "https://gitlab.com";
  const repo = new FakeRepo(options.files);
  const tokens = new Map<string, FakeGitLabUser>(
    Object.entries(options.tokens ?? { "test-token": { username: "editor", name: "Test Editor" } }),
  );
  const codes = new Map<string, { challenge: string; redirectUri: string }>();
  const refreshTokens = new Map<string, FakeGitLabUser>();
  const pipelines = new Map<string, { checks: number }>();
  const requests: Request[] = [];
  let counter = 0;

  function commit(changes: FileChange[], message: string): string {
    const sha = repo.commit(changes, message);
    if (options.deployAfterChecks !== undefined) pipelines.set(sha, { checks: 0 });
    return sha;
  }

  function issueTokens(user: FakeGitLabUser) {
    counter += 1;
    const access = `oauth-access-${counter}`;
    const refresh = `oauth-refresh-${counter}`;
    tokens.set(access, user);
    refreshTokens.set(refresh, user);
    return {
      access_token: access,
      refresh_token: refresh,
      expires_in: options.oauth?.expiresIn ?? 7200,
      token_type: "Bearer",
    };
  }

  /**
   * What GitLab's sign-in page does once the person approves: returns the
   * address the browser is sent back to, with a one-time code.
   */
  function authorize(authorizeUrl: string): string {
    const url = new URL(authorizeUrl);
    const params = url.searchParams;
    if (params.get("client_id") !== options.oauth?.clientId) throw new Error("Unknown OAuth application");
    if (params.get("code_challenge_method") !== "S256") throw new Error("PKCE with S256 is required");
    counter += 1;
    const code = `code-${counter}`;
    codes.set(code, { challenge: params.get("code_challenge") ?? "", redirectUri: params.get("redirect_uri") ?? "" });
    const back = new URL(params.get("redirect_uri") ?? "");
    back.searchParams.set("code", code);
    back.searchParams.set("state", params.get("state") ?? "");
    return back.toString();
  }

  async function handle(request: Request): Promise<Response> {
    requests.push(request.clone());
    const url = new URL(request.url);

    if (url.pathname === "/oauth/token" && request.method === "POST") {
      const body = new URLSearchParams(await request.text());
      if (body.get("client_id") !== options.oauth?.clientId || !options.oauth)
        return json({ error: "invalid_client" }, 401);
      if (body.get("grant_type") === "authorization_code") {
        const issued = codes.get(body.get("code") ?? "");
        codes.delete(body.get("code") ?? "");
        if (!issued || issued.redirectUri !== body.get("redirect_uri")) return json({ error: "invalid_grant" }, 400);
        if ((await sha256Base64Url(body.get("code_verifier") ?? "")) !== issued.challenge) {
          return json({ error: "invalid_grant", error_description: "PKCE verification failed" }, 400);
        }
        return json(issueTokens(options.oauth.user));
      }
      if (body.get("grant_type") === "refresh_token") {
        const user = refreshTokens.get(body.get("refresh_token") ?? "");
        refreshTokens.delete(body.get("refresh_token") ?? "");
        return user ? json(issueTokens(user)) : json({ error: "invalid_grant" }, 400);
      }
      return json({ error: "unsupported_grant_type" }, 400);
    }

    if (!url.pathname.startsWith("/api/v4/")) return json({ message: "404 Not Found" }, 404);
    const user = tokens.get(request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "");
    if (!user) return json({ message: "401 Unauthorized" }, 401);
    // Keep the encoded project path intact: split on raw slashes only.
    const path = url.pathname.slice("/api/v4".length);

    if (path === "/user")
      return json({ username: user.username, name: user.name, avatar_url: `https://avatars.example/${user.username}` });

    const projectMatch = path.match(/^\/projects\/([^/]+)(\/.*)?$/);
    if (!projectMatch || decodeURIComponent(projectMatch[1] ?? "") !== options.project)
      return json({ message: "404 Project Not Found" }, 404);
    const rest = projectMatch[2] ?? "";
    const accessLevel = user.accessLevel ?? 40;

    if (rest === "") {
      return json({
        default_branch: repo.defaultBranch,
        permissions: { project_access: { access_level: accessLevel }, group_access: null },
      });
    }

    const branch = rest.match(/^\/repository\/branches\/(.+)$/);
    if (branch) {
      const sha = repo.branches.get(decodeURIComponent(branch[1] ?? ""));
      return sha ? json({ commit: { id: sha } }) : json({ message: "404 Branch Not Found" }, 404);
    }

    if (rest === "/repository/tree") {
      const ref = url.searchParams.get("ref") ?? repo.defaultBranch;
      const dir = url.searchParams.get("path") ?? "";
      const perPage = Number(url.searchParams.get("per_page") ?? 20);
      const page = Number(url.searchParams.get("page") ?? 1);
      const entries = [...repo.files(ref)]
        .filter(([file]) => file.startsWith(`${dir}/`))
        .map(([file, content]) => ({
          id: repo.blobSha(content),
          type: "blob",
          path: file,
          name: file.split("/").at(-1),
        }));
      if (entries.length === 0) return json({ message: "404 Tree Not Found" }, 404);
      return json(entries.slice((page - 1) * perPage, page * perPage));
    }

    const blob = rest.match(/^\/repository\/blobs\/([0-9a-f]{40})\/raw$/);
    if (blob) {
      const content = repo.blobs.get(blob[1] ?? "");
      return content === undefined
        ? json({ message: "404 Blob Not Found" }, 404)
        : new Response(fakeFileBytes(content));
    }

    const file = rest.match(/^\/repository\/files\/([^/]+)$/);
    if (file) {
      const filePath = decodeURIComponent(file[1] ?? "");
      const ref = url.searchParams.get("ref") ?? repo.defaultBranch;
      const lastCommit = repo.files(ref).has(filePath) ? repo.lastCommitFor(filePath, ref) : undefined;
      return lastCommit
        ? json({ file_path: filePath, last_commit_id: lastCommit })
        : json({ message: "404 File Not Found" }, 404);
    }

    if (rest === "/repository/commits" && request.method === "POST") {
      if (accessLevel < 30) return json({ message: "403 Forbidden" }, 403);
      const body = (await request.json()) as {
        branch: string;
        commit_message: string;
        actions: Array<{
          action: string;
          file_path: string;
          content?: string;
          encoding?: string;
          last_commit_id?: string;
        }>;
      };
      const files = repo.files(body.branch);
      for (const action of body.actions) {
        if (action.action === "create" && files.has(action.file_path)) {
          return json({ message: "A file with this name already exists" }, 400);
        }
        if ((action.action === "update" || action.action === "delete") && !files.has(action.file_path)) {
          return json({ message: "A file with this name doesn't exist" }, 400);
        }
        if (action.last_commit_id && repo.lastCommitFor(action.file_path, body.branch) !== action.last_commit_id) {
          return json(
            { message: "You are attempting to update a file that has changed since you started editing it." },
            400,
          );
        }
      }
      const sha = commit(
        body.actions.map((action) =>
          action.action === "delete"
            ? { path: action.file_path, delete: true as const }
            : action.encoding === "base64"
              ? { path: action.file_path, bytes: decodeBase64(action.content ?? "") }
              : { path: action.file_path, content: action.content ?? "" },
        ),
        body.commit_message,
      );
      return json({ id: sha, message: body.commit_message }, 201);
    }

    if (rest === "/repository/compare") {
      const changed = repo.changedPaths(url.searchParams.get("from") ?? "", url.searchParams.get("to") ?? "");
      return json({ diffs: changed.map((changedPath) => ({ old_path: changedPath, new_path: changedPath })) });
    }

    const statuses = rest.match(/^\/repository\/commits\/([0-9a-f]{40})\/statuses$/);
    if (statuses) {
      const pipeline = pipelines.get(statuses[1] ?? "");
      if (!pipeline) return json([]);
      pipeline.checks += 1;
      const done = pipeline.checks > (options.deployAfterChecks ?? 0);
      return json([
        { name: "pages", status: done ? "success" : "running", target_url: `${webUrl}/${options.project}/-/jobs/1` },
      ]);
    }

    if (rest === "/pipelines") return json([...pipelines.keys()].map((sha, index) => ({ id: index + 1, sha })));

    return json({ message: "404 Not Found" }, 404);
  }

  return {
    repo,
    requests,
    commit,
    authorize,
    handle,
    fetch: ((input: RequestInfo | URL, init?: RequestInit) => handle(new Request(input, init))) as typeof fetch,
  };
}

export type FakeGitLab = ReturnType<typeof fakeGitLab>;
