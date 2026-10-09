import {
  type ContentStore,
  DEMO_CONTENT_PATH,
  type DemoChanges,
  type DemoStorage,
  type DemoStore,
  demoContentStore,
  demoStore,
  parseDemoContent,
} from "@goodfellow-cms/core";
import { mediaUrl } from "./media.js";

const DATABASE = "goodfellow-demo";
const TABLE = "changes";

function request<T>(pending: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    pending.onsuccess = () => resolve(pending.result);
    pending.onerror = () => reject(pending.error);
  });
}

/**
 * Keeps a demo visitor's changes in the browser's IndexedDB, which can hold
 * uploads too large for local storage. `key` tells apart demos served from the
 * same address, such as two GitHub Pages sites of one account.
 */
export function browserDemoStorage(key: string): DemoStorage {
  let database: Promise<IDBDatabase> | undefined;
  const open = () => {
    database ??= new Promise<IDBDatabase>((resolve, reject) => {
      const opening = indexedDB.open(DATABASE, 1);
      opening.onupgradeneeded = () => opening.result.createObjectStore(TABLE);
      opening.onsuccess = () => resolve(opening.result);
      opening.onerror = () => reject(opening.error);
    });
    return database;
  };
  const table = async (mode: IDBTransactionMode) => (await open()).transaction(TABLE, mode).objectStore(TABLE);
  return {
    load: async () => (await request((await table("readonly")).get(key))) as DemoChanges | undefined,
    save: async (changes) => {
      await request((await table("readwrite")).put(changes, key));
    },
    clear: async () => {
      await request((await table("readwrite")).delete(key));
    },
  };
}

/**
 * The store a demo admin panel uses: the site's content, read from `base` or
 * from the copy the build put beside the admin panel, with the visitor's
 * changes kept in their browser.
 */
export function createDemoStore(siteUrl: string, base?: ContentStore): DemoStore {
  const root = siteUrl.replace(/\/+$/, "");
  const content =
    base ??
    demoContentStore(
      async () => {
        const response = await fetch(`${root}/${DEMO_CONTENT_PATH}`);
        if (!response.ok) throw new Error(`The demo's content couldn't be loaded (${response.status}).`);
        return parseDemoContent(await response.text());
      },
      async (path) => {
        const response = await fetch(`${root}${mediaUrl(path)}`);
        return response.ok ? new Uint8Array(await response.arrayBuffer()) : undefined;
      },
    );
  return demoStore(content, browserDemoStorage(new URL(`${root}/`, location.href).href));
}
