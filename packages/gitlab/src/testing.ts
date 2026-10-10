/**
 * A fake of the parts of GitLab's API that `@goodfellow-cms/gitlab` uses, backed by
 * an in-memory repository, including OAuth with PKCE. For tests only.
 */
import { decodeBase64, type FileChange } from "@goodfellow-cms/core";
import { FakeRepo, fakeFileBytes } from "@goodfellow-cms/core/testing";

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
  /** Groups the users belong to, which new projects can be created in. */
  groups?: string[];
  /** Publishes the site with GitLab Pages. Off by default. */
  pages?: { uniqueDomain?: boolean };
}

/** A custom domain added to the site's GitLab Pages. */
export interface FakePagesDomain {
  verified: boolean;
  verificationCode: string;
  /** Whether Let's Encrypt has issued the certificate. */
  certificate: boolean;
}

/** The site's GitLab Pages settings, which tests can change. */
export interface FakeGitLabPages {
  uniqueDomain: boolean;
  forceHttps: boolean;
  primaryDomain: string | null;
  domains: Map<string, FakePagesDomain>;
  /** Domains whose TXT record GitLab would find, so verifying them works. */
  dnsReady: Set<string>;
}

/** A project created through the fake's API, as the setup page creates them. */
export interface FakeCreatedProject {
  id: number;
  path: string;
  visibility: string;
  description?: string;
  pagesAccessLevel?: string;
  repo: FakeRepo;
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
  const created = new Map<string, FakeCreatedProject>();
  const pages: FakeGitLabPages | undefined = options.pages
    ? {
        uniqueDomain: options.pages.uniqueDomain ?? true,
        forceHttps: true,
        primaryDomain: null,
        domains: new Map(),
        dnsReady: new Set(),
      }
    : undefined;

  function pagesUrl(): string {
    const [namespace = "", ...rest] = options.project.split("/");
    return pages?.uniqueDomain
      ? `https://${rest.join("-")}-1a2b3c.gitlab.io`
      : `https://${namespace}.gitlab.io/${rest.join("/")}`;
  }

  /** GitLab Pages' settings and custom domains, for the site's own project. */
  async function handlePages(request: Request, rest: string, accessLevel: number): Promise<Response | undefined> {
    if (!rest.startsWith("/pages")) return undefined;
    if (!pages) return json({ message: "404 Not Found" }, 404);
    if (accessLevel < 40) return json({ message: "403 Forbidden" }, 403);
    const method = request.method;
    const domainJson = (name: string, domain: FakePagesDomain) => ({
      domain: name,
      url: `https://${name}`,
      verified: domain.verified,
      verification_code: domain.verificationCode,
      auto_ssl_enabled: true,
      certificate: domain.certificate ? { subject: `/CN=${name}`, expired: false } : null,
    });
    if (rest === "/pages" && method === "GET") {
      return json({
        url: pagesUrl(),
        is_unique_domain_enabled: pages.uniqueDomain,
        force_https: pages.forceHttps,
        primary_domain: pages.primaryDomain,
      });
    }
    if (rest === "/pages" && method === "PATCH") {
      const body = (await request.json()) as {
        pages_unique_domain_enabled?: boolean;
        pages_https_only?: boolean;
        pages_primary_domain?: string;
      };
      if (body.pages_primary_domain !== undefined && !pages.domains.has(body.pages_primary_domain)) {
        return json({ message: "Primary domain must be one of the project's domains" }, 400);
      }
      if (body.pages_unique_domain_enabled !== undefined) pages.uniqueDomain = body.pages_unique_domain_enabled;
      if (body.pages_https_only !== undefined) pages.forceHttps = body.pages_https_only;
      if (body.pages_primary_domain !== undefined) pages.primaryDomain = body.pages_primary_domain;
      return json({ url: pagesUrl(), is_unique_domain_enabled: pages.uniqueDomain, force_https: pages.forceHttps });
    }
    if (rest === "/pages/domains" && method === "GET") {
      return json([...pages.domains].map(([name, domain]) => domainJson(name, domain)));
    }
    if (rest === "/pages/domains" && method === "POST") {
      const body = (await request.json()) as { domain: string };
      if (pages.domains.has(body.domain)) return json({ message: { domain: ["has already been taken"] } }, 400);
      if (!/^[a-z0-9.-]+\.[a-z]+$/.test(body.domain)) return json({ message: { domain: ["is invalid"] } }, 400);
      counter += 1;
      const domain = { verified: false, verificationCode: `code-${counter}`, certificate: false };
      pages.domains.set(body.domain, domain);
      return json(domainJson(body.domain, domain), 201);
    }
    const one = rest.match(/^\/pages\/domains\/([^/]+)(\/verify)?$/);
    const name = decodeURIComponent(one?.[1] ?? "");
    const domain = pages.domains.get(name);
    if (!one || !domain) return json({ message: "404 Not Found" }, 404);
    if (one[2] && method === "PUT") {
      if (!pages.dnsReady.has(name)) return json({ message: "Failed to verify domain ownership" }, 400);
      domain.verified = true;
      return json(domainJson(name, domain));
    }
    if (method === "GET") return json(domainJson(name, domain));
    if (method === "DELETE") {
      pages.domains.delete(name);
      if (pages.primaryDomain === name) pages.primaryDomain = null;
      return new Response(null, { status: 204 });
    }
    return json({ message: "404 Not Found" }, 404);
  }
  const groups = (options.groups ?? []).map((group, index) => ({ id: 100 + index, path: group }));

  /** Creating projects, and committing to the projects created, as the setup page does. */
  async function handleCreated(request: Request, path: string, user: FakeGitLabUser): Promise<Response | undefined> {
    if (path === "/namespaces") {
      return json([
        { id: 1, kind: "user", full_path: user.username, name: user.name ?? user.username },
        ...groups.map((group) => ({ id: group.id, kind: "group", full_path: group.path, name: group.path })),
      ]);
    }
    if (path === "/projects" && request.method === "POST") {
      const body = (await request.json()) as {
        name: string;
        path: string;
        namespace_id?: number;
        visibility: string;
        description?: string;
        pages_access_level?: string;
      };
      const namespace =
        body.namespace_id === undefined || body.namespace_id === 1
          ? user.username
          : groups.find((group) => group.id === body.namespace_id)?.path;
      if (!namespace) return json({ message: "404 Namespace Not Found" }, 404);
      if (!/^[\w.-]+$/.test(body.path)) return json({ message: { path: ["is invalid"] } }, 400);
      const fullPath = `${namespace}/${body.path}`;
      if (created.has(fullPath) || fullPath === options.project) {
        return json({ message: { name: ["has already been taken"] } }, 400);
      }
      counter += 1;
      const project: FakeCreatedProject = {
        id: 1000 + counter,
        path: fullPath,
        visibility: body.visibility,
        description: body.description,
        pagesAccessLevel: body.pages_access_level,
        repo: new FakeRepo({}),
      };
      created.set(fullPath, project);
      return json({ id: project.id, path_with_namespace: fullPath, web_url: `${webUrl}/${fullPath}` }, 201);
    }
    const match = path.match(/^\/projects\/([^/]+)(\/.*)?$/);
    const key = decodeURIComponent(match?.[1] ?? "");
    const project = created.get(key) ?? [...created.values()].find((candidate) => String(candidate.id) === key);
    if (!match || !project) return undefined;
    const rest = match[2] ?? "";
    if (rest === "") return json({ id: project.id, path_with_namespace: project.path, default_branch: "main" });
    if (rest === "/repository/commits" && request.method === "POST") {
      const body = (await request.json()) as {
        branch: string;
        commit_message: string;
        actions: { action: string; file_path: string; content?: string; encoding?: string }[];
      };
      const sha = project.repo.commit(
        body.actions.map((action) =>
          action.encoding === "base64"
            ? { path: action.file_path, bytes: decodeBase64(action.content ?? "") }
            : { path: action.file_path, content: action.content ?? "" },
        ),
        body.commit_message,
        { branch: body.branch },
      );
      return json({ id: sha, message: body.commit_message }, 201);
    }
    return json({ message: "404 Not Found" }, 404);
  }

  function commit(changes: FileChange[], message: string, author?: string): string {
    const sha = repo.commit(changes, message, { author });
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

    const setup = await handleCreated(request, path, user);
    if (setup) return setup;

    const projectMatch = path.match(/^\/projects\/([^/]+)(\/.*)?$/);
    if (!projectMatch || decodeURIComponent(projectMatch[1] ?? "") !== options.project)
      return json({ message: "404 Project Not Found" }, 404);
    const rest = projectMatch[2] ?? "";
    const accessLevel = user.accessLevel ?? 40;
    const pagesResponse = await handlePages(request, rest, accessLevel);
    if (pagesResponse) return pagesResponse;

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

    const raw = rest.match(/^\/repository\/files\/([^/]+)\/raw$/);
    if (raw) {
      const ref = url.searchParams.get("ref") ?? repo.defaultBranch;
      if (!repo.commitAt(repo.branches.get(ref) ?? ref)) return json({ message: "404 Commit Not Found" }, 404);
      const content = repo.files(ref).get(decodeURIComponent(raw[1] ?? ""));
      return content === undefined
        ? json({ message: "404 File Not Found" }, 404)
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
        user.name ?? user.username,
      );
      return json({ id: sha, message: body.commit_message }, 201);
    }

    if (rest === "/repository/commits" && request.method === "GET") {
      const ref = url.searchParams.get("ref_name") ?? repo.defaultBranch;
      const file = url.searchParams.get("path");
      if (!repo.commitAt(repo.branches.get(ref) ?? ref)) return json({ message: "404 Reference Not Found" }, 404);
      const perPage = Number(url.searchParams.get("per_page") ?? 20);
      const page = Number(url.searchParams.get("page") ?? 1);
      const commits = file ? repo.history(file, ref) : [];
      return json(
        commits.slice((page - 1) * perPage, page * perPage).map((commit) => ({
          id: commit.sha,
          title: commit.message.split("\n")[0],
          message: commit.message,
          author_name: commit.author ?? "GitLab",
          authored_date: commit.date,
          committed_date: commit.date,
        })),
      );
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
    /** Projects created through the API, by full path. */
    created,
    /** The site's GitLab Pages, if it has them, which tests can change. */
    pages,
    requests,
    commit,
    authorize,
    handle,
    fetch: ((input: RequestInfo | URL, init?: RequestInit) => handle(new Request(input, init))) as typeof fetch,
  };
}

export type FakeGitLab = ReturnType<typeof fakeGitLab>;
