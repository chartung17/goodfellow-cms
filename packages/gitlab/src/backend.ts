import {
  ConflictError,
  type DeployStatus,
  EDITABLE_FOLDERS,
  encodeBase64Bytes,
  type FileChange,
  GitApiError,
  type GitBackend,
  type GitUser,
  SignInError,
  type WriteOptions,
} from "@goodfellow/core";
import { type ApiOptions, gitlabJson, gitlabRequest } from "./api.js";

const PAGE_SIZE = 100;

export interface GitLabBackendOptions {
  api: ApiOptions;
  project: string;
  branch: string;
  user: GitUser;
  onSignOut: () => void;
}

/**
 * The site's files on GitLab. Reads come from the commit `revision()` last
 * returned. Saves are single commits; each changed file carries the commit it
 * was last changed in, so GitLab refuses to overwrite anyone else's edits.
 */
export class GitLabBackend implements GitBackend {
  readonly user: GitUser;
  private readonly api: ApiOptions;
  private readonly project: string;
  private readonly branch: string;
  private readonly onSignOut: () => void;
  private pinned?: string;
  private readonly trees = new Map<string, Promise<Map<string, string>>>();
  private readonly blobs = new Map<string, Promise<string>>();

  constructor(options: GitLabBackendOptions) {
    this.api = options.api;
    this.project = encodeURIComponent(options.project);
    this.branch = options.branch;
    this.user = options.user;
    this.onSignOut = options.onSignOut;
  }

  private repo(path: string): string {
    return `/projects/${this.project}/repository${path}`;
  }

  async revision(): Promise<string> {
    const branch = await gitlabJson<{ commit: { id: string } }>(
      this.api,
      this.repo(`/branches/${encodeURIComponent(this.branch)}`),
    );
    this.pinned = branch.commit.id;
    return this.pinned;
  }

  /** Every file in one folder at a commit, page by page. */
  private async listFolder(sha: string, dir: string): Promise<Array<[string, string]>> {
    const files: Array<[string, string]> = [];
    for (let page = 1; ; page++) {
      const query = new URLSearchParams({
        ref: sha,
        path: dir,
        recursive: "true",
        per_page: String(PAGE_SIZE),
        page: String(page),
      });
      const response = await gitlabRequest(this.api, this.repo(`/tree?${query}`), { allow: [404] });
      if (response.status === 404) return files;
      const entries = (await response.json()) as Array<{ id: string; type: string; path: string }>;
      for (const entry of entries) if (entry.type === "blob") files.push([entry.path, entry.id]);
      if (entries.length < PAGE_SIZE) return files;
    }
  }

  /** Path → blob id for the editable files at a commit. Commits never change, so this is cached. */
  private tree(sha: string): Promise<Map<string, string>> {
    let tree = this.trees.get(sha);
    if (!tree) {
      tree = Promise.all(EDITABLE_FOLDERS.map((folder) => this.listFolder(sha, folder))).then(
        (folders) => new Map(folders.flat()),
      );
      tree.catch(() => this.trees.delete(sha));
      this.trees.set(sha, tree);
    }
    return tree;
  }

  private async currentTree(): Promise<Map<string, string>> {
    return this.tree(this.pinned ?? (await this.revision()));
  }

  async read(path: string): Promise<string | undefined> {
    const sha = (await this.currentTree()).get(path);
    if (!sha) return undefined;
    let blob = this.blobs.get(sha);
    if (!blob) {
      blob = gitlabRequest(this.api, this.repo(`/blobs/${sha}/raw`)).then((response) => response.text());
      blob.catch(() => this.blobs.delete(sha));
      this.blobs.set(sha, blob);
    }
    return blob;
  }

  async readBytes(path: string): Promise<Uint8Array | undefined> {
    const sha = (await this.currentTree()).get(path);
    if (!sha) return undefined;
    const response = await gitlabRequest(this.api, this.repo(`/blobs/${sha}/raw`));
    return new Uint8Array(await response.arrayBuffer());
  }

  async list(dir: string): Promise<string[]> {
    const prefix = `${dir}/`;
    return [...(await this.currentTree()).keys()].filter((path) => path.startsWith(prefix)).sort();
  }

  private async lastCommitFor(path: string, ref: string): Promise<string> {
    const file = await gitlabJson<{ last_commit_id: string }>(
      this.api,
      this.repo(`/files/${encodeURIComponent(path)}?ref=${ref}`),
    );
    return file.last_commit_id;
  }

  async write(changes: FileChange[], { message, expectedRevision }: WriteOptions): Promise<{ revision: string }> {
    // GitLab has no "only if the branch hasn't moved" option, so check first. The
    // per-file last_commit_id below still protects the files being saved from races.
    if ((await this.revision()) !== expectedRevision) throw new ConflictError();

    const existing = await this.tree(expectedRevision);
    const actions = await Promise.all(
      changes.map(async (change) => {
        const exists = existing.has(change.path);
        if ("delete" in change) {
          return exists
            ? {
                action: "delete",
                file_path: change.path,
                last_commit_id: await this.lastCommitFor(change.path, expectedRevision),
              }
            : undefined;
        }
        // Uploads such as images are sent as base64; text as it is, so commits stay readable.
        const content =
          "bytes" in change
            ? { content: encodeBase64Bytes(change.bytes), encoding: "base64" }
            : { content: change.content };
        return exists
          ? {
              action: "update",
              file_path: change.path,
              ...content,
              last_commit_id: await this.lastCommitFor(change.path, expectedRevision),
            }
          : { action: "create", file_path: change.path, ...content };
      }),
    );
    const toApply = actions.filter((action) => action !== undefined);
    if (toApply.length === 0) return { revision: expectedRevision };

    try {
      const commit = await gitlabJson<{ id: string }>(this.api, this.repo("/commits"), {
        method: "POST",
        body: { branch: this.branch, commit_message: message, actions: toApply },
      });
      this.pinned = commit.id;
      return { revision: commit.id };
    } catch (error) {
      if (!(error instanceof GitApiError)) throw error;
      if (error.status === 403) throw new SignInError("cant-publish", "This GitLab account can't publish to the site.");
      // A file changed or appeared since the editor loaded, or the branch moved.
      const fileConflict = error.status === 400 && /already exists|changed since/i.test(error.message);
      if (fileConflict || (await this.revision()) !== expectedRevision) throw new ConflictError();
      throw error;
    }
  }

  async changedPaths(from: string, to: string): Promise<string[]> {
    const comparison = await gitlabJson<{ diffs?: Array<{ old_path: string; new_path: string }> }>(
      this.api,
      this.repo(`/compare?${new URLSearchParams({ from, to, straight: "true" })}`),
    );
    return [...new Set((comparison.diffs ?? []).flatMap((diff) => [diff.old_path, diff.new_path]))];
  }

  /**
   * Reads the commit's pipeline and external statuses (GitLab Pages jobs, or
   * Vercel). Before any exist, the site counts as building if it has pipelines.
   */
  async deployStatus(revision: string): Promise<DeployStatus> {
    try {
      const statuses = await gitlabJson<Array<{ status: string; target_url?: string | null }>>(
        this.api,
        this.repo(`/commits/${revision}/statuses`),
      );
      if (statuses.length === 0) {
        const pipelines = await gitlabJson<unknown[]>(this.api, `/projects/${this.project}/pipelines?per_page=1`);
        return { state: pipelines.length > 0 ? "building" : "unknown" };
      }
      const failed = statuses.find((status) => status.status === "failed" || status.status === "canceled");
      if (failed) return { state: "failed", detailsUrl: failed.target_url ?? undefined };
      if (statuses.every((status) => status.status === "success" || status.status === "skipped")) {
        return { state: "live", detailsUrl: statuses[0]?.target_url ?? undefined };
      }
      return { state: "building", detailsUrl: statuses[0]?.target_url ?? undefined };
    } catch (error) {
      if (error instanceof GitApiError) return { state: "unknown" };
      throw error;
    }
  }

  signOut(): void {
    this.onSignOut();
  }
}
