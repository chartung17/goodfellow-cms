import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEV_API_PREFIX, handleDevApi } from "./dev-api.js";
import { localFileStore } from "./local-files.js";

describe("handleDevApi", () => {
  let root: string;
  let server: Server;
  let base: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "goodfellow-api-"));
    const store = localFileStore(root);
    server = createServer(async (req, res) => {
      if (!(await handleDevApi(store, req, res))) res.writeHead(418).end();
    });
    await new Promise<void>((done) => server.listen(0, done));
    base = `http://localhost:${(server.address() as AddressInfo).port}${DEV_API_PREFIX}`;
  });

  afterAll(async () => {
    await new Promise((done) => server.close(done));
    await rm(root, { recursive: true, force: true });
  });

  const headers = { "x-goodfellow-request": "1" };
  const json = { ...headers, "content-type": "application/json" };

  it("ignores other URLs", async () => {
    expect((await fetch(base.replace(DEV_API_PREFIX, "/about"))).status).toBe(418);
  });

  it("reads, writes and lists files", async () => {
    const { revision } = await (await fetch(`${base}/revision`, { headers })).json();
    const write = await fetch(`${base}/write`, {
      method: "POST",
      headers: json,
      body: JSON.stringify({
        changes: [{ path: "content/site.json", content: "{}" }],
        message: "Save",
        expectedRevision: revision,
      }),
    });
    expect(write.status).toBe(200);
    expect(await (await fetch(`${base}/file?path=content/site.json`, { headers })).json()).toEqual({ content: "{}" });
    expect(await (await fetch(`${base}/files?dir=content`, { headers })).json()).toEqual({
      files: ["content/site.json"],
    });
    expect((await fetch(`${base}/file?path=content/missing.json`, { headers })).status).toBe(404);
  });

  it("answers 409 when the site changed since the given revision", async () => {
    const response = await fetch(`${base}/write`, {
      method: "POST",
      headers: json,
      body: JSON.stringify({
        changes: [{ path: "content/x.json", content: "{}" }],
        message: "Stale",
        expectedRevision: "old",
      }),
    });
    expect(response.status).toBe(409);
  });

  it("refuses requests other websites could send", async () => {
    expect((await fetch(`${base}/revision`)).status).toBe(403);
    expect((await fetch(`${base}/revision`, { headers: { ...headers, origin: "https://evil.example" } })).status).toBe(
      403,
    );
    const plainText = await fetch(`${base}/write`, {
      method: "POST",
      headers: { ...headers, "content-type": "text/plain" },
      body: "{}",
    });
    expect(plainText.status).toBe(415);
  });

  it("refuses files outside content/ and public/media/, and malformed saves", async () => {
    expect((await fetch(`${base}/file?path=package.json`, { headers })).status).toBe(400);
    const bad = await fetch(`${base}/write`, {
      method: "POST",
      headers: json,
      body: JSON.stringify({ changes: "nope" }),
    });
    expect(bad.status).toBe(400);
    const notJson = await fetch(`${base}/write`, { method: "POST", headers: json, body: "{ nope" });
    expect(notJson.status).toBe(400);
  });
});
