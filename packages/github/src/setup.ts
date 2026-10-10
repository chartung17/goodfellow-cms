import {
  type CreatedSiteRepository,
  encodeBase64Bytes,
  GitApiError,
  type NewSiteRepository,
  type SetupAccount,
  SetupError,
  type SetupHost,
  type SetupOwner,
  type SetupWarning,
  SignInError,
} from "@goodfellow-cms/core";
import { type ApiOptions, githubJson, githubRequest, repoPath } from "./api.js";

export interface GitHubSetupOptions {
  /** For GitHub Enterprise. Defaults to `https://api.github.com`. */
  apiUrl?: string;
  /** For GitHub Enterprise. Defaults to `https://github.com`. */
  webUrl?: string;
  /** For tests. */
  fetch?: typeof fetch;
}

/** The branch the deploy setups build from. */
const MAIN = "main";

/**
 * Links to GitHub's token pages with what creating a site needs: creating the
 * repository (administration), writing its files and its build setup
 * (contents and workflows), and turning on GitHub Pages (pages).
 */
export function githubSetupTokenLinks(webUrl = "https://github.com") {
  const fineGrained = new URLSearchParams({
    name: "Goodfellow site setup",
    description: "Create a Goodfellow site. It can be deleted once the site is created.",
    expires_in: "7",
    administration: "write",
    contents: "write",
    workflows: "write",
    pages: "write",
  });
  const classic = new URLSearchParams({ scopes: "repo,workflow", description: "Goodfellow site setup" });
  return {
    fineGrained: `${webUrl}/settings/personal-access-tokens/new?${fineGrained}`,
    classic: `${webUrl}/settings/tokens/new?${classic}`,
  };
}

interface GitHubRepo {
  full_name: string;
  html_url: string;
  default_branch: string;
}

/** Signing in to GitHub to create a site's repository, with GitHub Pages if wanted. */
export function githubSetup(options: GitHubSetupOptions = {}): SetupHost {
  const apiUrl = (options.apiUrl ?? "https://api.github.com").replace(/\/$/, "");
  const links = githubSetupTokenLinks(options.webUrl);
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);

  async function connect(token: string): Promise<SetupAccount> {
    const api: ApiOptions = { apiUrl, token, fetch: fetcher };
    const user = await githubJson<{ login: string; name?: string | null; avatar_url?: string }>(api, "/user");

    async function owners(): Promise<SetupOwner[]> {
      const own: SetupOwner = { path: user.login, name: user.name || user.login, kind: "personal" };
      // A fine-grained token may not be allowed to list organizations; the person's own account still works.
      const orgs = await githubJson<{ login: string }[]>(api, "/user/orgs?per_page=100").catch(() => []);
      return [own, ...orgs.map((org): SetupOwner => ({ path: org.login, name: org.login, kind: "organization" }))];
    }

    async function isAvailable(owner: SetupOwner, name: string): Promise<boolean> {
      const response = await githubRequest(api, `/repos/${repoPath(`${owner.path}/${name}`)}`, { allow: [404] });
      return response.status === 404;
    }

    async function createRepository(site: NewSiteRepository): Promise<GitHubRepo> {
      const path =
        site.owner.kind === "personal" ? "/user/repos" : `/orgs/${encodeURIComponent(site.owner.path)}/repos`;
      // GitHub's answer when a name is taken doesn't say so in its message, so it's checked first.
      if (!(await isAvailable(site.owner, site.name))) {
        throw new SetupError("name-taken", `There's already a repository called ${site.owner.path}/${site.name}.`);
      }
      try {
        // GitHub's API can't write files to an empty repository, so it starts with a README that the first commit replaces.
        return await githubJson<GitHubRepo>(api, path, {
          method: "POST",
          body: { name: site.name, private: site.private, description: site.description, auto_init: true },
        });
      } catch (error) {
        if (error instanceof GitApiError && error.status === 422) {
          throw new SetupError("name-invalid", `GitHub can't use "${site.name}" as a repository name.`);
        }
        if (error instanceof GitApiError && (error.status === 403 || error.status === 404)) {
          throw new SetupError("not-allowed", `This sign-in can't create repositories in ${site.owner.path}.`);
        }
        throw error;
      }
    }

    /** Makes `main` the default branch, which the deploy setups build from. */
    async function useMainBranch(repo: GitHubRepo): Promise<void> {
      if (repo.default_branch === MAIN) return;
      const base = `/repos/${repoPath(repo.full_name)}`;
      const ref = await githubJson<{ object: { sha: string } }>(api, `${base}/git/ref/heads/${repo.default_branch}`);
      await githubRequest(api, `${base}/git/refs`, {
        method: "POST",
        body: { ref: `refs/heads/${MAIN}`, sha: ref.object.sha },
      });
      await githubRequest(api, base, { method: "PATCH", body: { default_branch: MAIN } });
      await githubRequest(api, `${base}/git/refs/heads/${repo.default_branch}`, { method: "DELETE" });
    }

    /** Turns on GitHub Pages, published by the site's own workflow. Returns the site's address. */
    async function turnOnPages(repo: GitHubRepo): Promise<string | undefined> {
      try {
        const pages = await githubJson<{ html_url?: string }>(api, `/repos/${repoPath(repo.full_name)}/pages`, {
          method: "POST",
          body: { build_type: "workflow" },
        });
        return pages.html_url;
      } catch (error) {
        // GitHub's free plan has no Pages for private repositories.
        if (error instanceof GitApiError && [403, 404, 409, 422].includes(error.status)) return undefined;
        throw error;
      }
    }

    /** Writes every file in one commit, which replaces the starting README rather than following it. */
    async function writeFiles(repo: GitHubRepo, site: NewSiteRepository): Promise<void> {
      const base = `/repos/${repoPath(repo.full_name)}`;
      const tree: { path: string; mode: "100644"; type: "blob"; content?: string; sha?: string }[] = [];
      for (const file of site.files) {
        if ("delete" in file) continue;
        if ("content" in file) {
          tree.push({ path: file.path, mode: "100644", type: "blob", content: file.content });
          continue;
        }
        // Files that may not be text, such as images, are uploaded on their own.
        const blob = await githubJson<{ sha: string }>(api, `${base}/git/blobs`, {
          method: "POST",
          body: { content: encodeBase64Bytes(file.bytes), encoding: "base64" },
        });
        tree.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
      }
      try {
        const created = await githubJson<{ sha: string }>(api, `${base}/git/trees`, { method: "POST", body: { tree } });
        const commit = await githubJson<{ sha: string }>(api, `${base}/git/commits`, {
          method: "POST",
          body: { message: site.message, tree: created.sha, parents: [] },
        });
        await githubRequest(api, `${base}/git/refs/heads/${MAIN}`, {
          method: "PATCH",
          body: { sha: commit.sha, force: true },
        });
      } catch (error) {
        // Writing `.github/workflows/` needs the workflow permission, which the token may not have.
        if (error instanceof GitApiError && (error.status === 403 || error.status === 404)) {
          throw new SetupError("not-allowed", "This sign-in can't write the site's files, or its build setup.");
        }
        throw error;
      }
    }

    /** Stops anyone rewriting or deleting the main branch's history. Not every plan allows it. */
    async function protectMain(repo: GitHubRepo): Promise<boolean> {
      const response = await githubRequest(api, `/repos/${repoPath(repo.full_name)}/rulesets`, {
        method: "POST",
        body: {
          name: "Protect the published history",
          target: "branch",
          enforcement: "active",
          conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
          rules: [{ type: "non_fast_forward" }, { type: "deletion" }],
        },
        allow: [403, 404, 422],
      });
      return response.ok;
    }

    return {
      user: { login: user.login, name: user.name ?? undefined, avatarUrl: user.avatar_url },
      owners,
      isAvailable,
      async createSite(site, onStep): Promise<CreatedSiteRepository> {
        const warnings: SetupWarning[] = [];
        onStep?.("repository");
        const repo = await createRepository(site);
        await useMainBranch(repo);
        let siteUrl: string | undefined;
        if (site.pages) {
          // Before the files, so the first build, which starts as soon as they're written, can publish.
          onStep?.("pages");
          siteUrl = await turnOnPages(repo);
          if (!siteUrl) warnings.push("pages-unavailable");
        }
        onStep?.("files");
        await writeFiles(repo, site);
        onStep?.("protection");
        if (!(await protectMain(repo))) warnings.push("protection-unavailable");
        return {
          repo: repo.full_name,
          webUrl: repo.html_url,
          siteUrl,
          buildsUrl: `${repo.html_url}/actions`,
          pagesUrl: site.pages ? `${repo.html_url}/settings/pages` : undefined,
          warnings,
        };
      },
    };
  }

  return {
    name: "GitHub",
    canRedirect: false,
    tokenLinks: [
      { url: links.fineGrained, label: "signIn.token.create" },
      { url: links.classic, label: "signIn.token.createBroad", hint: "signIn.token.createBroadHint" },
    ],
    async restore() {
      return null;
    },
    async signInWithToken(token) {
      const trimmed = token.trim();
      if (!trimmed) throw new SignInError("invalid", "Paste a token to sign in.");
      return connect(trimmed);
    },
    async startRedirect() {
      throw new Error("Signing in by redirect needs a sign-in server, which isn't supported for GitHub yet.");
    },
  };
}
