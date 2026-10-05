import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  CONTENT_DIR,
  ConflictError,
  type ContentStore,
  type FileChange,
  isEditablePath,
  MEDIA_DIR,
} from "@goodfellow/core";
import { fileSystemSource } from "./fs-source.js";

export class InvalidPathError extends Error {
  override name = "InvalidPathError";
}

function assertEditable(path: string): void {
  if (!isEditablePath(path)) {
    throw new InvalidPathError(
      `${path} can't be edited from the admin panel. Only files in content/ and public/media/ can.`,
    );
  }
}

/**
 * The development server's local backend: a `ContentStore` over the site's
 * files on disk. Revisions are a hash of every editable file, so any change on
 * disk (from the admin panel or a text editor) produces a new revision.
 * Writes are serialized so two saves can't interleave.
 */
export function localFileStore(root: string): ContentStore {
  const source = fileSystemSource(root);
  let queue: Promise<unknown> = Promise.resolve();

  async function revision(): Promise<string> {
    const files = [...(await source.list(CONTENT_DIR)), ...(await source.list(MEDIA_DIR))].sort();
    const hash = createHash("sha256");
    for (const file of files) {
      const content = await readFile(join(root, file));
      hash.update(file).update("\0").update(createHash("sha256").update(content).digest()).update("\0");
    }
    return hash.digest("hex").slice(0, 16);
  }

  async function applyChanges(changes: FileChange[], expectedRevision: string): Promise<{ revision: string }> {
    for (const change of changes) assertEditable(change.path);
    if ((await revision()) !== expectedRevision) throw new ConflictError();

    for (const change of changes) {
      const file = join(root, change.path);
      if ("delete" in change) {
        await rm(file, { force: true });
      } else {
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, change.content);
      }
    }
    return { revision: await revision() };
  }

  return {
    read: async (path) => {
      assertEditable(path);
      return source.read(path);
    },
    list: async (dir) => {
      if (!isEditablePath(`${dir}/x`)) throw new InvalidPathError(`${dir} can't be listed from the admin panel.`);
      return source.list(dir);
    },
    revision,
    write: (changes, { expectedRevision }) => {
      const result = queue.then(() => applyChanges(changes, expectedRevision));
      queue = result.catch(() => undefined);
      return result;
    },
  };
}
