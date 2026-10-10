import {
  ConflictError,
  type DeployStatus,
  encodeBase64,
  encodeBase64Bytes,
  type FileChange,
  type FileVersion,
  GitApiError,
  type GitBackend,
  type GitUser,
  type HistoryOptions,
  type OwnerAccess,
  type PagesDomains,
  SignInError,
  type SiteEditors,
  type TokenLink,
  type WriteOptions,
} from "@goodfellow-cms/core";
import { type ApiOptions, githubJson, githubRequest, repoPath } from "./api.js";
import { githubEditors, githubOwnerAccess } from "./editors.js";
import { githubPages } from "./pages.js";

interface TreeResponse {
  tree: Array<{ path: string; type: string; sha: string }>;
  truncated: boolean;
}

interface CommitResponse {
  sha: string;
  commit: { message: string; author?: { name?: string; date?: string } | null };
  author?: { login: string } | null;
}

interface GraphQLResponse {
  data?: { createCommitOnBranch?: { commit?: { oid: string } } };
  errors?: Array<{ type?: string; message: string }>;
}

const COMMIT_MUTATION = `mutation ($input: CreateCommitOnBranchInput!) {
  createCommitOnBranch(input: $input) { commit { oid } }
}`;

export interface GitHubBackendOptions {
  api: ApiOptions;
  repo: string;
  branch: string;
  user: GitUser;
  onSignOut: () => void;
  /** Where to create the owner token, which can change editors and GitHub Pages settings. */
  ownerTokenLink: TokenLink;
}

/**
 * The site's files on GitHub. Reads come from the commit `revision()` last
 * returned; saves are single commits made with GraphQL's `createCommitOnBranch`,
 * which fails if the branch has moved, so nothing is ever overwritten.
 */
export class GitHubBackend implements GitBackend {
  readonly user: GitUser;
  readonly pages: PagesDomains;
  readonly editors: SiteEditors;
  readonly ownerAccess: OwnerAccess;
  private readonly api: ApiOptions;
  private readonly repo: string;
  private readonly branch: string;
  private readonly onSignOut: () => void;
  private pinned?: string;
  private readonly trees = new Map<string, Promise<Map<string, string>>>();
  private readonly blobs = new Map<string, Promise<string>>();

  constructor(options: GitHubBackendOptions) {
    this.api = options.api;
    this.repo = repoPath(options.repo);
    this.branch = options.branch;
    this.user = options.user;
    this.onSignOut = options.onSignOut;
    const owner = githubOwnerAccess(this.api, this.repo, options.ownerTokenLink);
    this.ownerAccess = owner.access;
    this.pages = githubPages(() => owner.api() ?? this.api, this.repo);
    this.editors = githubEditors(this.api, owner.api, this.repo, this.user.login);
  }

  async revision(): Promise<string> {
    const ref = await githubJson<{ object: { sha: string } }>(
      this.api,
      `/repos/${this.repo}/git/ref/heads/${encodeURIComponent(this.branch)}`,
    );
    this.pinned = ref.object.sha;
    return this.pinned;
  }

  /** Path → blob id for every file at a commit. Commits never change, so this is cached. */
  private tree(sha: string): Promise<Map<string, string>> {
    let tree = this.trees.get(sha);
    if (!tree) {
      tree = githubJson<TreeResponse>(this.api, `/repos/${this.repo}/git/trees/${sha}?recursive=1`).then((response) => {
        if (response.truncated) {
          throw new GitApiError(413, "The repository has too many files for GitHub to list at once.");
        }
        return new Map(response.tree.filter((entry) => entry.type === "blob").map((entry) => [entry.path, entry.sha]));
      });
      tree.catch(() => this.trees.delete(sha));
      this.trees.set(sha, tree);
    }
    return tree;
  }

  private async currentTree(): Promise<Map<string, string>> {
    return this.tree(this.pinned ?? (await this.revision()));
  }

  async read(path: string): Promise<string | undefined> {
    return this.readFrom(await this.currentTree(), path);
  }

  private readFrom(tree: Map<string, string>, path: string): Promise<string | undefined> {
    const sha = tree.get(path);
    if (!sha) return Promise.resolve(undefined);
    let blob = this.blobs.get(sha);
    if (!blob) {
      blob = githubRequest(this.api, `/repos/${this.repo}/git/blobs/${sha}`, {
        accept: "application/vnd.github.raw+json",
      }).then((response) => response.text());
      blob.catch(() => this.blobs.delete(sha));
      this.blobs.set(sha, blob);
    }
    return blob;
  }

  async readBytes(path: string): Promise<Uint8Array | undefined> {
    const sha = (await this.currentTree()).get(path);
    if (!sha) return undefined;
    const response = await githubRequest(this.api, `/repos/${this.repo}/git/blobs/${sha}`, {
      accept: "application/vnd.github.raw+json",
    });
    return new Uint8Array(await response.arrayBuffer());
  }

  async list(dir: string): Promise<string[]> {
    const prefix = `${dir}/`;
    return [...(await this.currentTree()).keys()].filter((path) => path.startsWith(prefix)).sort();
  }

  async write(changes: FileChange[], { message, expectedRevision }: WriteOptions): Promise<{ revision: string }> {
    const existing = await this.tree(expectedRevision);
    const additions = changes.flatMap((change) =>
      "delete" in change
        ? []
        : [
            {
              path: change.path,
              contents: "bytes" in change ? encodeBase64Bytes(change.bytes) : encodeBase64(change.content),
            },
          ],
    );
    // GitHub refuses to delete files that don't exist, and there's nothing to do for them anyway.
    const deletions = changes.flatMap((change) =>
      "delete" in change && existing.has(change.path) ? [{ path: change.path }] : [],
    );
    if (additions.length === 0 && deletions.length === 0) return { revision: expectedRevision };

    const response = await githubJson<GraphQLResponse>(this.api, "/graphql", {
      method: "POST",
      body: {
        query: COMMIT_MUTATION,
        variables: {
          input: {
            branch: { repositoryNameWithOwner: decodeURIComponent(this.repo), branchName: this.branch },
            message: { headline: message },
            expectedHeadOid: expectedRevision,
            fileChanges: { additions, deletions },
          },
        },
      },
    });

    const oid = response.data?.createCommitOnBranch?.commit?.oid;
    if (oid) {
      this.pinned = oid;
      return { revision: oid };
    }

    // The mutation failed. If the branch has moved, that's why: someone else saved first.
    if ((await this.revision()) !== expectedRevision) throw new ConflictError();
    const error = response.errors?.[0];
    if (error?.type === "FORBIDDEN")
      throw new SignInError("cant-publish", "This GitHub account can't publish to the site.");
    throw new GitApiError(422, `GitHub couldn't save the changes: ${error?.message ?? "unknown error"}`);
  }

  async history(path: string, { page = 1, perPage = 20 }: HistoryOptions = {}): Promise<FileVersion[]> {
    const query = new URLSearchParams({
      sha: this.pinned ?? (await this.revision()),
      path,
      per_page: String(perPage),
      page: String(page),
    });
    const commits = await githubJson<CommitResponse[]>(this.api, `/repos/${this.repo}/commits?${query}`);
    return commits.map((commit) => ({
      revision: commit.sha,
      date: commit.commit.author?.date ?? "",
      author: commit.commit.author?.name || commit.author?.login || undefined,
      message: commit.commit.message.split("\n")[0] ?? "",
    }));
  }

  async readAt(path: string, revision: string): Promise<string | undefined> {
    return this.readFrom(await this.tree(revision), path);
  }

  async changedPaths(from: string, to: string): Promise<string[]> {
    const comparison = await githubJson<{ files?: Array<{ filename: string; previous_filename?: string }> }>(
      this.api,
      `/repos/${this.repo}/compare/${from}...${to}`,
    );
    return [
      ...new Set((comparison.files ?? []).flatMap((file) => [file.filename, file.previous_filename ?? []].flat())),
    ];
  }

  /**
   * Reads the deployment GitHub Pages or Vercel created for a commit. Before
   * one exists, the site counts as building if it has ever been deployed.
   */
  async deployStatus(revision: string): Promise<DeployStatus> {
    try {
      const deployments = await githubJson<Array<{ id: number }>>(
        this.api,
        `/repos/${this.repo}/deployments?sha=${revision}&per_page=5`,
      );
      const latest = deployments[0];
      if (!latest) {
        const any = await githubJson<unknown[]>(this.api, `/repos/${this.repo}/deployments?per_page=1`);
        return { state: any.length > 0 ? "building" : "unknown" };
      }
      const [status] = await githubJson<Array<{ state: string; log_url?: string; target_url?: string }>>(
        this.api,
        `/repos/${this.repo}/deployments/${latest.id}/statuses?per_page=1`,
      );
      const detailsUrl = status?.log_url || status?.target_url || undefined;
      switch (status?.state) {
        case "success":
        case "inactive":
          return { state: "live", detailsUrl };
        case "failure":
        case "error":
          return { state: "failed", detailsUrl };
        default:
          return { state: "building", detailsUrl };
      }
    } catch (error) {
      // Tokens without the Deployments permission can still publish; they just can't see deploys.
      if (error instanceof GitApiError) return { state: "unknown" };
      throw error;
    }
  }

  signOut(): void {
    this.ownerAccess.forget();
    this.onSignOut();
  }
}
