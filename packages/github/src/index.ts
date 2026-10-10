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
  const [repoOwner = ""] = repo.split("/");
  const fineGrained = new URLSearchParams({
    name: "Goodfellow admin",
    description: `Edit ${repo} in its admin panel`,
    target_name: repoOwner,
    expires_in: "90",
    contents: "write",
    deployments: "read",
    // Which step of a failed rebuild failed, so the admin panel can explain it.
    actions: "read",
  });
  const classic = new URLSearchParams({ scopes: "repo", description: `Goodfellow admin for ${repo}` });
  // Changing editors and GitHub Pages settings needs permissions signing in doesn't ask for, including
  // Administration, which can also delete the repository. So owners make a second token, used for one tab only.
  const owner = new URLSearchParams({
    name: "Goodfellow owner",
    description: `Manage the editors and domain of ${repo}`,
    target_name: repoOwner,
    // GitHub's shortest: the admin panel forgets the token when the tab closes anyway.
    expires_in: "1",
    administration: "write",
    pages: "write",
  });
  return {
    fineGrained: `${webUrl}/settings/personal-access-tokens/new?${fineGrained}`,
    classic: `${webUrl}/settings/tokens/new?${classic}`,
    owner: `${webUrl}/settings/personal-access-tokens/new?${owner}`,
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
      ownerTokenLink: { url: links.owner, label: "owner.token.create" },
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
