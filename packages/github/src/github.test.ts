import {
  ConflictError,
  type GitBackend,
  loadSiteContent,
  SignInError,
  type StorageLike,
  writeChanges,
} from "@goodfellow/core";
import { describe, expect, it } from "vitest";
import { github, githubTokenLinks } from "./index.js";
import { fakeGitHub } from "./testing.js";

const FILES = {
  "content/site.json": '{"version":1,"title":"Holy Name"}',
  "content/pages/index.json": '{"version":1,"data":{"root":{"props":{"title":"Home"}},"content":[]}}',
  "content/pages/about.json": '{"version":1,"data":{"root":{"props":{"title":"About"}},"content":[]}}',
  "src/styles.css": "@import 'tailwindcss';",
};

function memoryStorage(): StorageLike & { items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (k) => items.get(k) ?? null,
    setItem: (k, v) => void items.set(k, v),
    removeItem: (k) => void items.delete(k),
  };
}

function setup(options: Partial<Parameters<typeof fakeGitHub>[0]> = {}) {
  const fake = fakeGitHub({ repo: "parish/site", files: FILES, ...options });
  const local = memoryStorage();
  const session = memoryStorage();
  const host = github({ repo: "parish/site", fetch: fake.fetch, storage: { local, session } });
  return { fake, host, local, session };
}

async function signedIn(options?: Partial<Parameters<typeof fakeGitHub>[0]>) {
  const context = setup(options);
  const backend = await context.host.signInWithToken("test-token", false);
  return { ...context, backend };
}

describe("signing in", () => {
  it("links to a token page with the right permissions filled in", () => {
    const { fineGrained, classic } = githubTokenLinks("parish/site");
    const url = new URL(fineGrained);
    expect(url.origin + url.pathname).toBe("https://github.com/settings/personal-access-tokens/new");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      target_name: "parish",
      contents: "write",
      deployments: "read",
      expires_in: "90",
    });
    expect(new URL(classic).searchParams.get("scopes")).toBe("repo");
  });

  it("signs in with a token and remembers it only when asked", async () => {
    const { host, local, session } = setup();
    const backend = await host.signInWithToken("  test-token  ", false);
    expect(backend.user).toEqual({ login: "editor", name: "Test Editor", avatarUrl: "https://avatars.example/editor" });
    expect(session.items.get("goodfellow:github:parish/site")).toBe("test-token");
    expect(local.items.size).toBe(0);

    await host.signInWithToken("test-token", true);
    expect(local.items.get("goodfellow:github:parish/site")).toBe("test-token");
    expect(session.items.size).toBe(0);
  });

  it("restores a saved sign-in, and forgets it on sign-out", async () => {
    const { host, session } = setup();
    expect(await host.restore()).toBeNull();
    const backend = await host.signInWithToken("test-token", false);
    expect((await host.restore())?.user.login).toBe("editor");
    backend.signOut();
    expect(session.items.size).toBe(0);
    expect(await host.restore()).toBeNull();
  });

  it("explains why a sign-in didn't work", async () => {
    const { host } = setup({ tokens: { reader: { login: "reader", push: false }, editor: { login: "editor" } } });
    await expect(host.signInWithToken("wrong", false)).rejects.toMatchObject({ problem: "invalid" });
    await expect(host.signInWithToken("", false)).rejects.toMatchObject({ problem: "invalid" });
    await expect(host.signInWithToken("reader", false)).rejects.toMatchObject({ problem: "cant-publish" });

    const elsewhere = github({ repo: "someone/else", fetch: setup().fake.fetch, storage: {} });
    await expect(elsewhere.signInWithToken("test-token", false)).rejects.toMatchObject({ problem: "no-access" });
  });

  it("forgets a saved token that no longer works", async () => {
    const { host, session } = setup();
    session.setItem("goodfellow:github:parish/site", "revoked");
    await expect(host.restore()).rejects.toBeInstanceOf(SignInError);
    expect(session.items.size).toBe(0);
  });

  it("only ever sends the token in the Authorization header", async () => {
    const { fake, backend } = await signedIn();
    await loadSiteContent(backend);
    for (const request of fake.requests) {
      expect(request.url).not.toContain("test-token");
      expect(request.headers.get("authorization")).toBe("Bearer test-token");
    }
  });

  it("refuses repository names that aren't owner/name", () => {
    expect(() => github({ repo: "just-a-name" })).toThrow(/owner\/name/);
  });
});

describe("reading", () => {
  it("loads the site's content", async () => {
    const { backend } = await signedIn();
    const content = await loadSiteContent(backend);
    expect(content.settings.title).toBe("Holy Name");
    expect(content.pages.map((page) => page.path)).toEqual(["/", "/about"]);
  });

  it("keeps reading the revision it started from, even if someone publishes meanwhile", async () => {
    const { fake, backend } = await signedIn();
    const revision = await backend.revision();
    fake.commit([{ path: "content/site.json", content: '{"version":1,"title":"Changed"}' }], "Theirs");
    expect(await backend.read("content/site.json")).toBe(FILES["content/site.json"]);
    expect(await backend.revision()).not.toBe(revision);
    expect(await backend.read("content/site.json")).toBe('{"version":1,"title":"Changed"}');
  });

  it("lists files under a folder and reports missing files", async () => {
    const { backend } = await signedIn();
    expect(await backend.list("content/pages")).toEqual(["content/pages/about.json", "content/pages/index.json"]);
    expect(await backend.list("content/nothing")).toEqual([]);
    expect(await backend.read("content/menus.json")).toBeUndefined();
  });
});

describe("publishing", () => {
  it("saves every change in a single commit", async () => {
    const { fake, backend } = await signedIn();
    const start = await backend.revision();
    const { revision } = await backend.write(
      [
        { path: "content/pages/news.json", content: '{"title":"Nouvelles ✝"}' },
        { path: "content/pages/about.json", delete: true },
        { path: "content/pages/never-existed.json", delete: true },
      ],
      { message: "Add news", expectedRevision: start },
    );
    expect(fake.repo.commitAt(revision)).toMatchObject({ parent: start, message: "Add news" });
    expect(fake.repo.files().get("content/pages/news.json")).toBe('{"title":"Nouvelles ✝"}');
    expect(fake.repo.files().has("content/pages/about.json")).toBe(false);
    expect(await backend.read("content/pages/news.json")).toBe('{"title":"Nouvelles ✝"}');
  });

  it("refuses to save over someone else's newer commit", async () => {
    const { fake, backend } = await signedIn();
    const start = await backend.revision();
    fake.commit([{ path: "content/site.json", content: "theirs" }], "Theirs");
    await expect(
      backend.write([{ path: "content/site.json", content: "mine" }], { message: "Mine", expectedRevision: start }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(fake.repo.files().get("content/site.json")).toBe("theirs");
  });

  it("saves on top of someone else's changes to other files", async () => {
    const { fake, backend } = await signedIn();
    const start = await backend.revision();
    fake.commit([{ path: "content/pages/index.json", content: "theirs" }], "Theirs");
    await writeChanges(backend, [{ path: "content/site.json", content: "mine" }], {
      message: "Mine",
      expectedRevision: start,
    });
    expect(fake.repo.files().get("content/site.json")).toBe("mine");
    expect(fake.repo.files().get("content/pages/index.json")).toBe("theirs");
  });

  it("reports which files changed between revisions", async () => {
    const { fake, backend } = await signedIn();
    const start = await backend.revision();
    const end = fake.commit([{ path: "content/a.json", content: "1" }], "A");
    expect(await backend.changedPaths(start, end)).toEqual(["content/a.json"]);
  });
});

describe("deploy status", () => {
  async function published(deployAfterChecks?: number): Promise<{ backend: GitBackend; revision: string }> {
    const { backend } = await signedIn({ deployAfterChecks });
    const { revision } = await backend.write([{ path: "content/site.json", content: "{}" }], {
      message: "Publish",
      expectedRevision: await backend.revision(),
    });
    return { backend, revision };
  }

  it("follows the deployment until it's live", async () => {
    const { backend, revision } = await published(1);
    expect(await backend.deployStatus(revision)).toEqual({ state: "building", detailsUrl: undefined });
    expect(await backend.deployStatus(revision)).toEqual({
      state: "live",
      detailsUrl: "https://github.com/parish/site/actions/runs/1",
    });
  });

  it("reports unknown when the site has never been deployed", async () => {
    const { backend, revision } = await published();
    expect(await backend.deployStatus(revision)).toEqual({ state: "unknown" });
  });
});
