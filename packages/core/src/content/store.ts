import type { ContentSource } from "./load.js";
import { CONTENT_DIR, MEDIA_DIR } from "./paths.js";

/** One change in a save: a file's new text, or its removal. */
export type FileChange = { path: string; content: string } | { path: string; delete: true };

export interface WriteOptions {
  /** Describes the change, such as `Update page "About us"`. Becomes the commit message. */
  message: string;
  /** The revision the editor started from. The write fails if the site has changed since. */
  expectedRevision: string;
}

/**
 * Read and write access to a site's editable files. Implemented by the
 * development server's local backend and by each git backend.
 */
export interface ContentStore extends ContentSource {
  /**
   * Identifies the current version of the site's files. Changes whenever any
   * file changes. Reads made afterwards see the site at this revision, so a
   * load that starts with `revision()` is consistent even if someone saves meanwhile.
   */
  revision(): Promise<string>;
  /**
   * Applies every change together, or none of them. Throws `ConflictError` if the
   * site is no longer at `options.expectedRevision`. Returns the new revision.
   */
  write(changes: FileChange[], options: WriteOptions): Promise<{ revision: string }>;
  /**
   * The paths of files that differ between two revisions. Stores with history
   * implement this, which lets `writeChanges` save over changes to unrelated files.
   */
  changedPaths?(from: string, to: string): Promise<string[]>;
}

/** Thrown when a save would overwrite changes someone else made in the meantime. */
export class ConflictError extends Error {
  override name = "ConflictError";

  constructor(message = "The site changed since it was loaded.") {
    super(message);
  }
}

const EDITABLE_ROOTS = [CONTENT_DIR, MEDIA_DIR];

/**
 * Whether the admin panel may read or write a path: only files under
 * `content/` and `public/media/`, written as plain relative paths.
 */
export function isEditablePath(path: string): boolean {
  if (path.startsWith("/") || path.includes("\\") || path.includes("\0")) return false;
  const segments = path.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) return false;
  return EDITABLE_ROOTS.some((root) => path.startsWith(`${root}/`));
}

/**
 * Saves changes, tolerating saves by other people to other files. If the site
 * changed since `expectedRevision` but none of the files being saved did, the
 * save is retried on top of the newer revision. If any of them did, it throws
 * `ConflictError`, because saving would overwrite someone else's work.
 */
export async function writeChanges(
  store: ContentStore,
  changes: FileChange[],
  options: WriteOptions,
): Promise<{ revision: string }> {
  let expected = options.expectedRevision;
  const paths = new Set(changes.map((change) => change.path));

  for (let attempt = 0; ; attempt++) {
    try {
      return await store.write(changes, { ...options, expectedRevision: expected });
    } catch (error) {
      if (!(error instanceof ConflictError) || !store.changedPaths || attempt === 2) throw error;
      const current = await store.revision();
      if (current === expected) throw error;
      const changed = await store.changedPaths(options.expectedRevision, current);
      if (changed.some((path) => paths.has(path))) throw error;
      expected = current;
    }
  }
}
