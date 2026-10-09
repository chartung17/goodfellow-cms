import { ConflictError, loadSiteContent, type StorageLike, writeChanges } from "@goodfellow-cms/core";
import { describe, expect, it } from "vitest";
import { type BrowserLocation, gitlab, redirectUri } from "./index.js";
import { fakeGitLab } from "./testing.js";

const FILES = {
  "content/site.json": '{"version":1,"title":"St. Joseph"}',
  "content/pages/index.json": '{"version":1,"data":{"root":{"props":{"title":"Home"}},"content":[]}}',
  "content/pages/about.json": '{"version":1,"data":{"root":{"props":{"title":"About"}},"content":[]}}',
  "public/media/logo.svg": "<svg/>",
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

function fakeLocation(start: string): BrowserLocation & { current: string; assigned: string[] } {
  const location = {
    current: start,
    assigned: [] as string[],
    href: () => location.current,
    assign: (url: string) => void location.assigned.push(url),
    replace: (url: string) => {
      location.current = url;
    },
  };
  return location;
}

function setup(options: Partial<Parameters<typeof fakeGitLab>[0]> = {}, clientId?: string) {
  const fake = fakeGitLab({ project: "parish/web/site", files: FILES, ...options });
  const local = memoryStorage();
  const session = memoryStorage();
  const location = fakeLocation("https://parish.example/admin/#/settings/theme");
  const host = gitlab({
    project: "parish/web/site",
    clientId,
    fetch: fake.fetch,
    storage: { local, session },
    location,
  });
  return { fake, host, local, session, location };
}

describe("signing in with a token", () => {
  it("signs in, loads the site and saves the token where asked", async () => {
    const { host, local, session } = setup();
    expect(host.canRedirect).toBe(false);
    expect(host.tokenLinks?.[0]?.url).toBe(
      "https://gitlab.com/-/user_settings/personal_access_tokens?name=Goodfellow+admin&scopes=api",
    );

    const backend = await host.signInWithToken("test-token", true);
    expect(backend.user.login).toBe("editor");
    expect(local.items.size).toBe(1);
    expect(session.items.size).toBe(0);
    const content = await loadSiteContent(backend);
    expect(content.pages.map((page) => page.path)).toEqual(["/", "/about"]);
    expect(await backend.list("public/media")).toEqual(["public/media/logo.svg"]);
    expect(await backend.read("src/styles.css")).toBeUndefined();
  });

  it("refuses accounts that can't publish", async () => {
    const { host } = setup({ tokens: { reporter: { username: "reporter", accessLevel: 20 } } });
    await expect(host.signInWithToken("reporter", false)).rejects.toMatchObject({ problem: "cant-publish" });
    await expect(host.signInWithToken("nope", false)).rejects.toMatchObject({ problem: "invalid" });
  });
});

describe("signing in with GitLab (OAuth with PKCE)", () => {
  it("sends the browser to GitLab and finishes signing in when it comes back", async () => {
    const { fake, host, location, session } = setup(
      { oauth: { clientId: "app-1", user: { username: "oauth-editor" } } },
      "app-1",
    );
    expect(host.canRedirect).toBe(true);
    expect(await host.restore()).toBeNull();

    await host.startRedirect(false);
    const authorize = new URL(location.assigned[0] ?? "");
    expect(authorize.origin + authorize.pathname).toBe("https://gitlab.com/oauth/authorize");
    expect(authorize.searchParams.get("redirect_uri")).toBe("https://parish.example/admin/");
    expect(authorize.searchParams.get("scope")).toBe("api");

    // GitLab sends the browser back with a code.
    location.current = fake.authorize(authorize.toString());
    const backend = await host.restore();
    expect(backend?.user.login).toBe("oauth-editor");
    expect(location.current).toBe("https://parish.example/admin/#/settings/theme");
    // The saved sign-in now works without redirecting again.
    expect(session.items.size).toBe(1);
    expect((await host.restore())?.user.login).toBe("oauth-editor");
  });

  it("rejects a return whose state doesn't match", async () => {
    const { fake, host, location } = setup({ oauth: { clientId: "app-1", user: { username: "u" } } }, "app-1");
    await host.startRedirect(false);
    const back = new URL(fake.authorize(location.assigned[0] ?? ""));
    back.searchParams.set("state", "forged");
    location.current = back.toString();
    await expect(host.restore()).rejects.toMatchObject({ problem: "redirect-failed" });
  });

  it("refreshes the access token when it expires", async () => {
    const { fake, host, location } = setup(
      { oauth: { clientId: "app-1", user: { username: "u" }, expiresIn: 1 } },
      "app-1",
    );
    await host.startRedirect(true);
    location.current = fake.authorize(location.assigned[0] ?? "");
    const backend = await host.restore();
    await backend?.revision();
    const refreshes = fake.requests.filter((request) => request.url.endsWith("/oauth/token")).length;
    expect(refreshes).toBeGreaterThanOrEqual(2);
  });

  it("builds a redirect address that matches whether or not the address ends in a slash", () => {
    expect(redirectUri("https://parish.example/admin#/pages")).toBe("https://parish.example/admin/");
    expect(redirectUri("https://parish.example/repo/admin/?code=1")).toBe("https://parish.example/repo/admin/");
  });
});

describe("publishing", () => {
  async function signedIn(options?: Partial<Parameters<typeof fakeGitLab>[0]>) {
    const context = setup(options);
    return { ...context, backend: await context.host.signInWithToken("test-token", false) };
  }

  it("creates, updates and deletes files in one commit", async () => {
    const { fake, backend } = await signedIn();
    const start = await backend.revision();
    const { revision } = await backend.write(
      [
        { path: "content/pages/news.json", content: "{}" },
        { path: "content/site.json", content: '{"version":1,"title":"New"}' },
        { path: "content/pages/about.json", delete: true },
        { path: "content/pages/missing.json", delete: true },
      ],
      { message: "Edit", expectedRevision: start },
    );
    expect(fake.repo.commitAt(revision)).toMatchObject({ parent: start, message: "Edit" });
    expect([...fake.repo.files().keys()].filter((path) => path.startsWith("content/")).sort()).toEqual([
      "content/pages/index.json",
      "content/pages/news.json",
      "content/site.json",
    ]);
  });

  it("reads and writes the code of installed blocks", async () => {
    const { backend } = await signedIn({
      files: { ...FILES, "components/ui/button.tsx": "export function Button() {}\n" },
    });
    expect(await backend.read("components/ui/button.tsx")).toBe("export function Button() {}\n");
    await backend.write(
      [
        { path: "blocks/installed/shadcn-faq/block.tsx", content: "export default {};\n" },
        { path: "lib/utils.ts", content: "export {};\n" },
      ],
      { message: "Add the FAQ block", expectedRevision: await backend.revision() },
    );
    await backend.revision();
    expect(await backend.read("blocks/installed/shadcn-faq/block.tsx")).toBe("export default {};\n");
    expect(await backend.read("lib/utils.ts")).toBe("export {};\n");
  });

  it("uploads files that aren't text, such as images, and reads them back", async () => {
    const { fake, backend } = await signedIn();
    const image = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0x00, 0x80]);
    await backend.write([{ path: "public/media/photo.png", bytes: image }], {
      message: "Add photo.png",
      expectedRevision: await backend.revision(),
    });
    expect(fake.repo.files().get("public/media/photo.png")).toEqual(image);
    expect(await backend.list("public/media")).toContain("public/media/photo.png");
    expect(await backend.readBytes("public/media/photo.png")).toEqual(image);
    expect(await backend.readBytes("public/media/missing.png")).toBeUndefined();
  });

  it("refuses to save over someone else's commit", async () => {
    const { fake, backend } = await signedIn();
    const start = await backend.revision();
    fake.commit([{ path: "content/site.json", content: "theirs" }], "Theirs");
    await expect(
      backend.write([{ path: "content/site.json", content: "mine" }], { message: "Mine", expectedRevision: start }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(fake.repo.files().get("content/site.json")).toBe("theirs");
  });

  it("saves on top of changes to other files", async () => {
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

  it("reports deploys from the commit's pipeline", async () => {
    const { backend } = await signedIn({ deployAfterChecks: 1 });
    expect(await backend.deployStatus("0".repeat(40))).toEqual({ state: "unknown" });
    const { revision } = await backend.write([{ path: "content/site.json", content: "{}" }], {
      message: "Publish",
      expectedRevision: await backend.revision(),
    });
    expect((await backend.deployStatus(revision)).state).toBe("building");
    expect(await backend.deployStatus(revision)).toEqual({
      state: "live",
      detailsUrl: "https://gitlab.com/parish/web/site/-/jobs/1",
    });
  });
});
