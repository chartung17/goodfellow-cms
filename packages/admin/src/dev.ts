import { ConflictError, type ContentStore } from "@goodfellow/core";

/**
 * A content store that reads and writes the site's files through
 * `goodfellow dev`. For local development only: it is never part of a built site.
 */
export function localStore(apiBase = "/__goodfellow/api"): ContentStore {
  async function request(path: string, init: RequestInit = {}): Promise<Response> {
    const response = await fetch(`${apiBase}/${path}`, {
      ...init,
      headers: { "x-goodfellow-request": "1", ...init.headers },
    });
    if (response.status === 409) throw new ConflictError();
    if (!response.ok && response.status !== 404) {
      const body = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
      throw new Error(body.message ?? `The development server answered ${response.status} (${body.error ?? "error"}).`);
    }
    return response;
  }

  return {
    async read(path) {
      const response = await request(`file?path=${encodeURIComponent(path)}`);
      if (response.status === 404) return undefined;
      return ((await response.json()) as { content: string }).content;
    },
    async list(dir) {
      const response = await request(`files?dir=${encodeURIComponent(dir)}`);
      return ((await response.json()) as { files: string[] }).files;
    },
    async revision() {
      return ((await (await request("revision")).json()) as { revision: string }).revision;
    },
    async write(changes, { message, expectedRevision }) {
      const response = await request("write", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ changes, message, expectedRevision }),
      });
      return (await response.json()) as { revision: string };
    },
  };
}
