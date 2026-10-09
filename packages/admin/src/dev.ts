import { ConflictError, type ContentStore, decodeBase64, encodeBase64Bytes } from "@goodfellow-cms/core";

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
    async readBytes(path) {
      const response = await request(`file?path=${encodeURIComponent(path)}&as=bytes`);
      if (response.status === 404) return undefined;
      return decodeBase64(((await response.json()) as { base64: string }).base64);
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
        // JSON can't carry bytes, so uploads go as base64.
        body: JSON.stringify({
          changes: changes.map((change) =>
            "bytes" in change ? { path: change.path, base64: encodeBase64Bytes(change.bytes) } : change,
          ),
          message,
          expectedRevision,
        }),
      });
      return (await response.json()) as { revision: string };
    },
  };
}
