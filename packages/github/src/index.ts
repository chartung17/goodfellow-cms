import { credentialStorage, GitApiError, type GitHost, SignInError, type StorageLike } from "@goodfellow-cms/core";
import { type ApiOptions, githubJson, repoPath } from "./api.js";
import { GitHubBackend } from "./backend.js";

export { GitHubBackend } from "./backend.js";
export { githubPagesRecords } from "./pages.js";
export { type GitHubSetupOptions, githubSetup, githubSetupTokenLinks } from "./setup.js";

export interface GitHubOptions {
  /** The site's repository, as `owner/name`. */
  repo: string;
  /** The branch the live site is built from. Defaults to the repository's default branch. */
  branch?: string;
  /** For GitHub Enterprise. Defaults to `https://api.github.com`. */
  apiUrl?: string;
  /** For GitHub Enterprise. Defaults to `https://github.com`. */
  webUrl?: string;
  /** For tests. */
  fetch?: typeof fetch;
  /** For tests. */
  storage?: { local?: StorageLike; session?: StorageLike };
}

/**
 * Links to GitHub's token page with everything filled in except the
 * repository, which GitHub doesn't let links choose.
 */
export function githubTokenLinks(repo: string, webUrl = "https://github.com") {
  const [owner = ""] = repo.split("/");
  const fineGrained = new URLSearchParams({
    name: "Goodfellow admin",
    description: `Edit ${repo} in its admin panel`,
    target_name: owner,
    expires_in: "90",
    contents: "write",
    deployments: "read",
  });
  const classic = new URLSearchParams({ scopes: "repo", description: `Goodfellow admin for ${repo}` });
  // Connecting a domain also changes GitHub Pages settings, which site owners' tokens need the Pages permission for.
  const withPages = new URLSearchParams(fineGrained);
  withPages.set("pages", "write");
  withPages.set("description", `Edit ${repo} in its admin panel, and connect its domain`);
  return {
    fineGrained: `${webUrl}/settings/personal-access-tokens/new?${fineGrained}`,
    classic: `${webUrl}/settings/tokens/new?${classic}`,
    withPages: `${webUrl}/settings/personal-access-tokens/new?${withPages}`,
  };
}

/** Sign-in and storage for a site whose repository is on GitHub. */
export function github(options: GitHubOptions): GitHost {
  if (!/^[\w.-]+\/[\w.-]+$/.test(options.repo)) {
    throw new Error(`github({ repo }) must look like "owner/name" (got "${options.repo}").`);
  }
  const apiUrl = (options.apiUrl ?? "https://api.github.com").replace(/\/$/, "");
  const links = githubTokenLinks(options.repo, options.webUrl);
  const storage = credentialStorage(`goodfellow:github:${options.repo}`, options.storage);

  async function connect(token: string): Promise<GitHubBackend> {
    const api: ApiOptions = { apiUrl, token, fetch: options.fetch ?? globalThis.fetch.bind(globalThis) };
    const user = await githubJson<{ login: string; name?: string | null; avatar_url?: string }>(api, "/user");
    let repo: { default_branch: string; permissions?: { push?: boolean } };
    try {
      repo = await githubJson(api, `/repos/${repoPath(options.repo)}`);
    } catch (error) {
      if (error instanceof GitApiError && (error.status === 404 || error.status === 403)) {
        throw new SignInError("no-access", `The GitHub account ${user.login} can't see ${options.repo}.`);
      }
      throw error;
    }
    if (repo.permissions?.push === false) {
      throw new SignInError(
        "cant-publish",
        `The GitHub account ${user.login} can see ${options.repo} but can't publish to it.`,
      );
    }
    return new GitHubBackend({
      api,
      repo: options.repo,
      branch: options.branch ?? repo.default_branch,
      user: { login: user.login, name: user.name ?? undefined, avatarUrl: user.avatar_url },
      onSignOut: () => storage.clear(),
      pagesTokenLink: { url: links.withPages, label: "domain.token.create" },
    });
  }

  return {
    name: "GitHub",
    canRedirect: false,
    tokenLinks: [
      { url: links.fineGrained, label: "signIn.token.create" },
      { url: links.classic, label: "signIn.token.createBroad", hint: "signIn.token.createBroadHint" },
    ],
    async restore() {
      const token = storage.load();
      if (!token) return null;
      try {
        return await connect(token);
      } catch (error) {
        if (error instanceof SignInError) storage.clear();
        throw error;
      }
    },
    async signInWithToken(token, remember) {
      const trimmed = token.trim();
      if (!trimmed) throw new SignInError("invalid", "Paste a token to sign in.");
      const backend = await connect(trimmed);
      storage.save(trimmed, remember);
      return backend;
    },
    async startRedirect() {
      throw new Error("Signing in by redirect needs a sign-in server, which isn't supported for GitHub yet.");
    },
  };
}
