/**
 * A fake of the parts of GitHub's API that `@goodfellow-cms/github` uses, backed by
 * an in-memory repository. For tests only: pass `fake.fetch` as the backend's
 * `fetch`, or route browser requests to `fake.handle` in end-to-end tests.
 */
import { decodeBase64, encodeBase64Bytes, type FileChange } from "@goodfellow-cms/core";
import {
  FakeConflictError,
  type FakeFile,
  FakeRepo,
  fakeFileBytes,
  fakeFileFromBytes,
} from "@goodfellow-cms/core/testing";

export interface FakeGitHubUser {
  login: string;
  name?: string;
  /** Whether the user may publish. Defaults to true. */
  push?: boolean;
  /** Whether the token may write `.github/workflows/`. Defaults to true. */
  workflow?: boolean;
  /** Whether the token may change GitHub Pages settings. Defaults to true. */
  pages?: boolean;
  /** Whether the user is an owner (admin) of the site's repository. Defaults to false. */
  admin?: boolean;
  /** Whether the token has GitHub's Administration permission, which changing collaborators needs. Defaults to false. */
  administration?: boolean;
}

/** A repository invitation that hasn't been accepted yet. */
export interface FakeInvitation {
  id: number;
  login: string;
  permission: "admin" | "write";
}

/** The site's GitHub Pages settings, as `GET /repos/{repo}/pages` reports them. */
export interface FakePages {
  html_url: string;
  cname: string | null;
  https_enforced: boolean;
  /** The certificate's state, such as `new` while it's being issued and `approved` once it's ready. */
  certificate?: string;
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
  /** Organizations the users belong to, which new repositories can be created in. */
  orgs?: string[];
  /** The default branch of repositories created through the API, as an account's settings choose. Defaults to `main`. */
  newRepoBranch?: string;
  /** Whether private repositories can have GitHub Pages and rules, as on paid plans. Off by default, as on the free plan. */
  paidPlan?: boolean;
  /** Publishes the site with GitHub Pages, at `https://<owner>.github.io/<name>/`. Off by default. */
  pages?: boolean;
  /** Domains another GitHub Pages site already uses. */
  takenDomains?: string[];
  /** Other GitHub accounts that exist, which can be invited. Every token's user exists too. */
  accounts?: string[];
}

/** A repository created through the fake's API, as the setup page creates them. */
export interface FakeCreatedRepo {
  fullName: string;
  private: boolean;
  description?: string;
  repo: FakeRepo;
  pages?: { build_type: string };
  rulesets: unknown[];
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
  const created = new Map<string, FakeCreatedRepo>();
  const [owner = "", name = ""] = options.repo.split("/");
  const pages: { current?: FakePages } = {
    current: options.pages
      ? { html_url: `https://${owner.toLowerCase()}.github.io/${name}/`, cname: null, https_enforced: false }
      : undefined,
  };
  const trees = new Map<string, Map<string, FakeFile>>();
  /** The repository's collaborators and their permission. Every token's user is one. */
  const collaborators = new Map<string, "admin" | "push" | "read">(
    Object.values(tokens).map((user) => [user.login, user.admin ? "admin" : user.push === false ? "read" : "push"]),
  );
  const invitations: FakeInvitation[] = [];
  const accounts = new Set([...Object.values(tokens).map((user) => user.login), ...(options.accounts ?? [])]);
  let nextInvitation = 1;

  /** Collaborators and invitations, which only owners' tokens with the Administration permission can change. */
  async function handleCollaborators(request: Request, rest: string, user: FakeGitHubUser) {
    const forbidden = () => json({ message: "Resource not accessible by personal access token" }, 403);
    const canManage = user.admin === true && user.administration === true;
    if (rest === "/collaborators" && request.method === "GET") {
      return json(
        [...collaborators].map(([login, permission]) => ({
          login,
          avatar_url: `https://avatars.example/${login}`,
          permissions: { admin: permission === "admin", maintain: false, push: permission !== "read", pull: true },
        })),
      );
    }
    if (rest === "/invitations" && request.method === "GET") {
      if (!canManage) return forbidden();
      return json(
        invitations.map((invitation) => ({
          id: invitation.id,
          invitee: { login: invitation.login, avatar_url: `https://avatars.example/${invitation.login}` },
          permissions: invitation.permission,
        })),
      );
    }
    const collaborator = rest.match(/^\/collaborators\/([^/]+)$/);
    if (collaborator) {
      if (!canManage) return forbidden();
      const login = decodeURIComponent(collaborator[1] ?? "");
      if (request.method === "DELETE") {
        collaborators.delete(login);
        return new Response(null, { status: 204 });
      }
      if (request.method === "PUT") {
        if (!accounts.has(login)) return json({ message: "Not Found" }, 404);
        const { permission = "push" } = (await request.json()) as { permission?: "admin" | "push" };
        if (collaborators.has(login)) {
          collaborators.set(login, permission);
          return new Response(null, { status: 204 });
        }
        const existing = invitations.find((invitation) => invitation.login === login);
        const invitation = existing ?? { id: nextInvitation++, login, permission: "write" as const };
        invitation.permission = permission === "admin" ? "admin" : "write";
        if (!existing) invitations.push(invitation);
        return json({ id: invitation.id, invitee: { login }, permissions: invitation.permission }, 201);
      }
    }
    const invitation = rest.match(/^\/invitations\/(\d+)$/);
    if (invitation) {
      if (!canManage) return forbidden();
      const index = invitations.findIndex((candidate) => candidate.id === Number(invitation[1]));
      if (index === -1) return json({ message: "Not Found" }, 404);
      if (request.method === "DELETE") {
        invitations.splice(index, 1);
        return new Response(null, { status: 204 });
      }
      if (request.method === "PATCH") {
        const { permissions } = (await request.json()) as { permissions: "admin" | "write" };
        (invitations[index] as FakeInvitation).permission = permissions;
        return json({ id: invitations[index]?.id, permissions });
      }
    }
    return undefined;
  }

  /** Simulates an invited person accepting the invitation. */
  function accept(login: string): void {
    const index = invitations.findIndex((invitation) => invitation.login === login);
    const [invitation] = index === -1 ? [] : invitations.splice(index, 1);
    if (invitation) collaborators.set(login, invitation.permission === "admin" ? "admin" : "push");
  }

  /** Repository creation and the Git data API, for repositories created through the fake. */
  async function handleCreated(request: Request, path: string, login: string): Promise<Response | undefined> {
    if (path === "/user/orgs") return json((options.orgs ?? []).map((org) => ({ login: org })));
    const create = path === "/user/repos" ? login : path.match(/^\/orgs\/([^/]+)\/repos$/)?.[1];
    if (create !== undefined && request.method === "POST") {
      if (path !== "/user/repos" && !options.orgs?.includes(create)) return json({ message: "Not Found" }, 404);
      const body = (await request.json()) as { name: string; private?: boolean; description?: string };
      if (!/^[\w.-]+$/.test(body.name)) return json({ message: "Repository creation failed." }, 422);
      const fullName = `${create}/${body.name}`;
      if (created.has(fullName) || fullName === options.repo) {
        return json(
          { message: "Repository creation failed.", errors: [{ message: "name already exists on this account" }] },
          422,
        );
      }
      const repo = new FakeRepo({ "README.md": `# ${body.name}\n` }, options.newRepoBranch ?? "main");
      created.set(fullName, {
        fullName,
        private: body.private === true,
        description: body.description,
        repo,
        rulesets: [],
      });
      return json(
        { full_name: fullName, html_url: `https://github.com/${fullName}`, default_branch: repo.defaultBranch },
        201,
      );
    }

    const match = path.match(/^\/repos\/([^/]+\/[^/]+)(\/.*)?$/);
    const site = created.get(decodeURIComponent(match?.[1] ?? ""));
    if (!match || !site) return undefined;
    const { repo } = site;
    const rest = match[2] ?? "";
    const method = request.method;

    if (rest === "" && method === "GET") {
      return json({ full_name: site.fullName, default_branch: repo.defaultBranch, permissions: { push: true } });
    }
    if (rest === "" && method === "PATCH") {
      const body = (await request.json()) as { default_branch?: string };
      if (body.default_branch) {
        if (!repo.branches.has(body.default_branch)) return json({ message: "Not Found" }, 422);
        repo.defaultBranch = body.default_branch;
      }
      return json({ full_name: site.fullName, default_branch: repo.defaultBranch });
    }
    const ref = rest.match(/^\/git\/refs?\/heads\/(.+)$/);
    if (ref && method === "GET") {
      const sha = repo.branches.get(decodeURIComponent(ref[1] ?? ""));
      return sha ? json({ object: { sha } }) : json({ message: "Not Found" }, 404);
    }
    if (ref && method === "DELETE") {
      repo.branches.delete(decodeURIComponent(ref[1] ?? ""));
      return new Response(null, { status: 204 });
    }
    if (ref && method === "PATCH") {
      const body = (await request.json()) as { sha: string; force?: boolean };
      const branch = decodeURIComponent(ref[1] ?? "");
      const commit = repo.commitAt(body.sha);
      if (!commit || !repo.branches.has(branch)) return json({ message: "Reference does not exist" }, 422);
      if (!body.force && commit.parent !== repo.branches.get(branch)) {
        return json({ message: "Update is not a fast forward" }, 422);
      }
      if (site.rulesets.length > 0 && commit.parent !== repo.branches.get(branch)) {
        return json({ message: "Cannot force-push to this branch" }, 422);
      }
      repo.branches.set(branch, body.sha);
      deploy(body.sha);
      return json({ object: { sha: body.sha } });
    }
    if (rest === "/git/refs" && method === "POST") {
      const body = (await request.json()) as { ref: string; sha: string };
      repo.branches.set(body.ref.replace(/^refs\/heads\//, ""), body.sha);
      return json({ ref: body.ref, object: { sha: body.sha } }, 201);
    }
    if (rest === "/git/blobs" && method === "POST") {
      const body = (await request.json()) as { content: string; encoding: string };
      return json(
        {
          sha: repo.blobSha(body.encoding === "base64" ? fakeFileFromBytes(decodeBase64(body.content)) : body.content),
        },
        201,
      );
    }
    if (rest === "/git/trees" && method === "POST") {
      const body = (await request.json()) as { tree: { path: string; content?: string; sha?: string }[] };
      const files = new Map<string, FakeFile>();
      for (const entry of body.tree) {
        if (entry.path.startsWith(".github/workflows/") && user(request)?.workflow === false) {
          return json({ message: "Resource not accessible by personal access token" }, 404);
        }
        const content = entry.content ?? repo.blobs.get(entry.sha ?? "");
        if (content === undefined) return json({ message: `No blob ${entry.sha}` }, 422);
        files.set(entry.path, content);
      }
      const sha = repo.blobSha(`tree:${[...files.keys()].join(",")}:${trees.size}`);
      trees.set(sha, files);
      return json({ sha }, 201);
    }
    if (rest === "/git/commits" && method === "POST") {
      const body = (await request.json()) as { message: string; tree: string; parents: string[] };
      const files = trees.get(body.tree);
      if (!files) return json({ message: "Tree not found" }, 422);
      return json({ sha: repo.addCommit(body.parents[0], body.message, new Map(files)) }, 201);
    }
    if (rest === "/pages" && method === "POST") {
      if (site.private && !options.paidPlan) {
        return json({ message: "Your current plan does not support GitHub Pages for this repository." }, 422);
      }
      site.pages = (await request.json()) as { build_type: string };
      const [owner, name] = site.fullName.split("/");
      return json({ html_url: `https://${owner}.github.io/${name}/`, build_type: site.pages.build_type }, 201);
    }
    if (rest === "/rulesets" && method === "POST") {
      if (site.private && !options.paidPlan) return json({ message: "Upgrade to GitHub Pro" }, 403);
      site.rulesets.push(await request.json());
      return json({ id: site.rulesets.length }, 201);
    }
    return json({ message: "Not Found" }, 404);
  }

  function user(request: Request): FakeGitHubUser | undefined {
    return tokens[request.headers.get("authorization")?.replace(/^Bearer /, "") ?? ""];
  }

  function deploy(sha: string): void {
    if (options.deployAfterChecks === undefined) return;
    deployments.unshift({ id: nextDeployment++, sha, statuses: [{ state: "in_progress" }], checks: 0 });
  }

  function commit(changes: FileChange[], message: string, expectedHead?: string, author?: string): string {
    const sha = repo.commit(changes, message, { expectedHead, author });
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

    const setup = await handleCreated(request, path, user.login);
    if (setup) return setup;

    const account = path.match(/^\/users\/([^/]+)$/);
    if (account) {
      const login = decodeURIComponent(account[1] ?? "");
      return accounts.has(login) ? json({ login }) : json({ message: "Not Found" }, 404);
    }

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
          user.name ?? user.login,
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

    if (rest === "/pages" && request.method === "GET") {
      const site = pages.current;
      if (!site) return json({ message: "Not Found" }, 404);
      return json({
        html_url: site.cname ? `https://${site.cname}/` : site.html_url,
        cname: site.cname,
        https_enforced: site.https_enforced,
        https_certificate: site.cname ? { state: site.certificate ?? "new", domains: [site.cname] } : null,
      });
    }
    if (rest === "/pages" && request.method === "PUT") {
      const site = pages.current;
      if (!site) return json({ message: "Not Found" }, 404);
      if (user.pages === false) return json({ message: "Resource not accessible by personal access token" }, 403);
      const body = (await request.json()) as { cname?: string | null; https_enforced?: boolean };
      if (body.cname && options.takenDomains?.includes(body.cname)) {
        return json({ message: `The CNAME \`${body.cname}\` is already taken.` }, 422);
      }
      if (body.https_enforced && !["approved", "issued"].includes(site.certificate ?? "")) {
        return json({ message: "The certificate does not exist yet" }, 422);
      }
      if (body.cname !== undefined) {
        site.cname = body.cname;
        site.certificate = body.cname ? "new" : undefined;
        if (!body.cname) site.https_enforced = false;
      }
      if (body.https_enforced !== undefined) site.https_enforced = body.https_enforced;
      return new Response(null, { status: 204 });
    }

    if (rest === "") {
      return json({
        full_name: options.repo,
        default_branch: repo.defaultBranch,
        permissions: { push: user.push !== false, admin: user.admin === true },
      });
    }

    const people = await handleCollaborators(request, rest, user);
    if (people) return people;

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

    if (rest === "/commits") {
      const ref = url.searchParams.get("sha") ?? repo.defaultBranch;
      const file = url.searchParams.get("path");
      if (!repo.commitAt(repo.branches.get(ref) ?? ref)) return json({ message: "No commit found for SHA" }, 422);
      const perPage = Number(url.searchParams.get("per_page") ?? 30);
      const page = Number(url.searchParams.get("page") ?? 1);
      const commits = file ? repo.history(file, ref) : [];
      return json(
        commits.slice((page - 1) * perPage, page * perPage).map((commit) => ({
          sha: commit.sha,
          commit: { message: commit.message, author: { name: commit.author ?? "GitHub", date: commit.date } },
          author: null,
        })),
      );
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
    /** Repositories created through the API, by `owner/name`. */
    created,
    /** The site's GitHub Pages settings, which tests can change, such as to issue the certificate. */
    pages,
    /** The repository's collaborators, by login, and invitations waiting to be accepted. */
    collaborators,
    invitations,
    accept,
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
