/**
 * An in-memory git repository for testing backends without calling a real git
 * host. Each backend package builds a fake of its host's API on top of it.
 * Never shipped to browsers: import it only from tests.
 */
import type { FileChange } from "./content/store.js";

export interface FakeCommit {
  sha: string;
  parent?: string;
  message: string;
  files: ReadonlyMap<string, string>;
}

export class FakeConflictError extends Error {
  override name = "FakeConflictError";
}

function fakeHash(text: string, seed: number): string {
  let hash = 2166136261 ^ seed;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export class FakeRepo {
  readonly commits = new Map<string, FakeCommit>();
  readonly branches = new Map<string, string>();
  readonly blobs = new Map<string, string>();
  private count = 0;

  constructor(
    files: Record<string, string> = {},
    readonly defaultBranch = "main",
  ) {
    const sha = this.addCommit(undefined, "Initial commit", new Map(Object.entries(files)));
    this.branches.set(defaultBranch, sha);
  }

  /** A 40-character content hash, like git's blob ids. */
  blobSha(content: string): string {
    const sha = [1, 2, 3, 4, 5].map((seed) => fakeHash(content, seed)).join("");
    this.blobs.set(sha, content);
    return sha;
  }

  head(branch = this.defaultBranch): string {
    const sha = this.branches.get(branch);
    if (!sha) throw new Error(`No branch ${branch}`);
    return sha;
  }

  commitAt(sha: string): FakeCommit | undefined {
    return this.commits.get(sha);
  }

  files(ref: string = this.defaultBranch): ReadonlyMap<string, string> {
    const commit = this.commits.get(this.branches.get(ref) ?? ref);
    if (!commit) throw new Error(`No commit ${ref}`);
    return commit.files;
  }

  /** Commits changes to a branch. Throws `FakeConflictError` if `expectedHead` is given and the branch has moved. */
  commit(changes: FileChange[], message: string, options: { branch?: string; expectedHead?: string } = {}): string {
    const branch = options.branch ?? this.defaultBranch;
    const parent = this.head(branch);
    if (options.expectedHead && options.expectedHead !== parent) throw new FakeConflictError(`${branch} has moved`);
    const files = new Map(this.files(parent));
    for (const change of changes) {
      if ("delete" in change) files.delete(change.path);
      else files.set(change.path, change.content);
    }
    const sha = this.addCommit(parent, message, files);
    this.branches.set(branch, sha);
    return sha;
  }

  /** Simulates someone else saving: commits straight to the branch. */
  write(path: string, content: string, message = `Edit ${path}`): string {
    return this.commit([{ path, content }], message);
  }

  changedPaths(from: string, to: string): string[] {
    const a = this.files(from);
    const b = this.files(to);
    return [...new Set([...a.keys(), ...b.keys()])].filter((path) => a.get(path) !== b.get(path)).sort();
  }

  /** The most recent commit at or before `ref` that changed `path`. */
  lastCommitFor(path: string, ref: string = this.defaultBranch): string | undefined {
    let commit = this.commits.get(this.branches.get(ref) ?? ref);
    while (commit) {
      const parent = commit.parent ? this.commits.get(commit.parent) : undefined;
      if (commit.files.get(path) !== parent?.files.get(path))
        return commit.files.has(path) || parent ? commit.sha : undefined;
      commit = parent;
    }
    return undefined;
  }

  private addCommit(parent: string | undefined, message: string, files: Map<string, string>): string {
    this.count += 1;
    const sha = this.count.toString(16).padStart(40, "0");
    for (const content of files.values()) this.blobSha(content);
    this.commits.set(sha, { sha, parent, message, files });
    return sha;
  }
}
