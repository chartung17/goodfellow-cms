import { z } from "zod";
import type { ContentSource } from "./content/load.js";
import { CONTENT_DIR, INSTALLED_RECORD_FILE, MEDIA_DIR } from "./content/paths.js";
import { ConflictError, type ContentStore, type FileChange, type WriteOptions } from "./content/store.js";
import { hashText } from "./registry.js";

/**
 * Demo mode: an admin panel anyone can try without signing in. It starts from a
 * copy of the site's content that the build includes, and keeps each visitor's
 * changes in their own browser, so nothing is ever published.
 */

/** Where builds put the copy of the site's content that the demo reads, relative to the site's address. */
export const DEMO_CONTENT_PATH = "admin/demo-content.json";

const demoContentSchema = z.object({
  version: z.literal(1),
  /** Changes whenever the copied files do. */
  revision: z.string(),
  /** The text of every content file, and the record of installed blocks, by path. */
  files: z.record(z.string(), z.string()),
  /** The site's media files, which the demo shows from the site's own address. */
  media: z.array(z.string()),
});

export type DemoContent = z.infer<typeof demoContentSchema>;

/** The copy of a site's content that a demo starts from, as the text of `DEMO_CONTENT_PATH`. */
export async function demoContent(source: ContentSource): Promise<string> {
  const files: Record<string, string> = {};
  for (const path of [...(await source.list(CONTENT_DIR)), INSTALLED_RECORD_FILE]) {
    const text = await source.read(path);
    if (text !== undefined) files[path] = text;
  }
  const media = await source.list(MEDIA_DIR);
  const revision = (await hashText(JSON.stringify({ files, media }))).slice(0, 16);
  const content: DemoContent = { version: 1, revision, files, media };
  return `${JSON.stringify(content)}\n`;
}

/** Reads `DEMO_CONTENT_PATH`'s text. Throws if it isn't a demo's content. */
export function parseDemoContent(text: string): DemoContent {
  return demoContentSchema.parse(JSON.parse(text));
}

/**
 * A read-only store of the content a build copied for its demo. Media files are
 * read with `readMedia`, from the site's own address.
 */
export function demoContentStore(
  load: () => Promise<DemoContent>,
  readMedia: (path: string) => Promise<Uint8Array | undefined>,
): ContentStore {
  let loaded: Promise<DemoContent> | undefined;
  const content = () => {
    loaded ??= load();
    loaded.catch(() => {
      loaded = undefined;
    });
    return loaded;
  };
  return {
    async revision() {
      return (await content()).revision;
    },
    async read(path) {
      return (await content()).files[path];
    },
    async readBytes(path) {
      const { files, media } = await content();
      const text = files[path];
      if (text !== undefined) return new TextEncoder().encode(text);
      return media.includes(path) ? readMedia(path) : undefined;
    },
    async list(dir) {
      const { files, media } = await content();
      const prefix = `${dir}/`;
      return [...Object.keys(files), ...media].filter((path) => path.startsWith(prefix)).sort();
    },
    async write() {
      throw new Error("A demo's content can't be changed.");
    },
  };
}

/** A visitor's changes, as their browser keeps them. */
export interface DemoChanges {
  /** Counts the visitor's saves, so a save from an out-of-date tab can be refused. */
  saves: number;
  /** Each changed file's new text or bytes, or `null` if it was deleted. */
  files: Record<string, { content: string } | { bytes: Uint8Array } | null>;
}

/** Where a demo keeps a visitor's changes: in the browser, or in memory for tests. */
export interface DemoStorage {
  load(): Promise<DemoChanges | undefined>;
  save(changes: DemoChanges): Promise<void>;
  clear(): Promise<void>;
}

export function memoryDemoStorage(): DemoStorage {
  let stored: DemoChanges | undefined;
  return {
    load: async () => stored && copyChanges(stored),
    save: async (changes) => {
      stored = copyChanges(changes);
    },
    clear: async () => {
      stored = undefined;
    },
  };
}

function copyChanges(changes: DemoChanges): DemoChanges {
  return { saves: changes.saves, files: { ...changes.files } };
}

const EMPTY_CHANGES: DemoChanges = { saves: 0, files: {} };

/** A store whose saves stay in the visitor's browser, on top of the site's real content. */
export interface DemoStore extends ContentStore {
  readonly demo: true;
  /** The files the visitor has changed, as they are now. */
  changes(): Promise<FileChange[]>;
  /** Forgets every change, going back to the site's real content. */
  reset(): Promise<void>;
}

export function isDemoStore(store: ContentStore): store is DemoStore {
  return "demo" in store && store.demo === true;
}

/**
 * Reads from `base`, the site's real content, and keeps saves in `storage`
 * instead of publishing them. Saves from a tab that loaded an older version of
 * the visitor's changes are refused with `ConflictError`, as a real site's are.
 */
export function demoStore(base: ContentStore, storage: DemoStorage): DemoStore {
  let current = EMPTY_CHANGES;
  const latest = async () => {
    current = (await storage.load()) ?? EMPTY_CHANGES;
    return current;
  };
  const revisionOf = (changes: DemoChanges) => `demo-${changes.saves}`;

  return {
    demo: true,
    async revision() {
      await base.revision();
      return revisionOf(await latest());
    },
    async read(path) {
      if (!(path in current.files)) return base.read(path);
      const file = current.files[path];
      if (!file) return undefined;
      return "content" in file ? file.content : new TextDecoder().decode(file.bytes);
    },
    async readBytes(path) {
      if (!(path in current.files)) return base.readBytes(path);
      const file = current.files[path];
      if (!file) return undefined;
      return "bytes" in file ? file.bytes : new TextEncoder().encode(file.content);
    },
    async list(dir) {
      const prefix = `${dir}/`;
      const paths = new Set(await base.list(dir));
      for (const [path, file] of Object.entries(current.files)) {
        if (!path.startsWith(prefix)) continue;
        if (file) paths.add(path);
        else paths.delete(path);
      }
      return [...paths].sort();
    },
    async write(changes: FileChange[], { expectedRevision }: WriteOptions) {
      const saved = await latest();
      if (revisionOf(saved) !== expectedRevision) throw new ConflictError();
      const files = { ...saved.files };
      for (const change of changes) {
        files[change.path] =
          "delete" in change ? null : "bytes" in change ? { bytes: change.bytes } : { content: change.content };
      }
      const next = { saves: saved.saves + 1, files };
      await storage.save(next);
      current = next;
      return { revision: revisionOf(next) };
    },
    async changes() {
      return Object.entries((await latest()).files).map(
        ([path, file]): FileChange =>
          !file
            ? { path, delete: true }
            : "bytes" in file
              ? { path, bytes: file.bytes }
              : { path, content: file.content },
      );
    },
    async reset() {
      await storage.clear();
      current = EMPTY_CHANGES;
    },
  };
}
