import type { StorageLike } from "@goodfellow-cms/core";
import { describe, expect, it } from "vitest";
import { gitlabSetup } from "./setup.js";
import { fakeGitLab } from "./testing.js";

const files = [
  { path: "package.json", content: "{}\n" },
  { path: ".gitlab-ci.yml", content: "pages:\n" },
  { path: "public/media/logo.png", bytes: new Uint8Array([137, 80, 78, 71, 0, 255]) },
];

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

describe("gitlabSetup", () => {
  it("creates a private project with public Pages and every file in one commit", async () => {
    const fake = fakeGitLab({
      project: "someone/existing",
      groups: ["st-joseph"],
      tokens: { t: { username: "someone" } },
    });
    const account = await gitlabSetup({ fetch: fake.fetch }).signInWithToken("t");
    const owners = await account.owners();
    expect(owners.map((owner) => [owner.path, owner.kind])).toEqual([
      ["someone", "personal"],
      ["st-joseph", "organization"],
    ]);
    const group = owners[1];
    if (!group) throw new Error("no group");
    const steps: string[] = [];
    const result = await account.createSite(
      { owner: group, name: "parish", private: true, pages: true, files, message: "Create the site" },
      (step) => steps.push(step),
    );
    expect(steps).toEqual(["repository", "files"]);
    expect(result).toEqual({
      repo: "st-joseph/parish",
      webUrl: "https://gitlab.com/st-joseph/parish",
      buildsUrl: "https://gitlab.com/st-joseph/parish/-/pipelines",
      pagesUrl: "https://gitlab.com/st-joseph/parish/pages",
      warnings: [],
    });
    const project = fake.created.get("st-joseph/parish");
    expect(project?.visibility).toBe("private");
    expect(project?.pagesAccessLevel).toBe("public");
    const head = project?.repo.commitAt(project.repo.head("main"));
    expect(head?.message).toBe("Create the site");
    expect(head?.files.get("public/media/logo.png")).toEqual(new Uint8Array([137, 80, 78, 71, 0, 255]));
    await expect(
      account.createSite({ owner: group, name: "parish", private: true, pages: true, files, message: "Again" }),
    ).rejects.toMatchObject({ problem: "name-taken" });
  });

  it("signs in by redirect with PKCE, keeping nothing but the pending sign-in", async () => {
    const fake = fakeGitLab({
      project: "someone/existing",
      oauth: { clientId: "app", user: { username: "someone", name: "Some One" } },
    });
    let href = "https://docs.example/new-site/";
    const location = {
      href: () => href,
      assign: (url: string) => {
        href = fake.authorize(url);
      },
      replace: (url: string) => {
        href = url;
      },
    };
    const session = memoryStorage();
    const local = memoryStorage();
    const host = gitlabSetup({ clientId: "app", fetch: fake.fetch, location, storage: { session, local } });
    expect(host.canRedirect).toBe(true);
    expect(await host.restore()).toBeNull();
    await host.startRedirect();
    expect(href).toContain("code=");
    const account = await host.restore();
    expect(account?.user).toMatchObject({ login: "someone", name: "Some One" });
    expect(href).toBe("https://docs.example/new-site/");
    expect(session.getItem("goodfellow:gitlab-setup:pending")).toBeNull();
    expect(local.getItem("goodfellow:gitlab-setup:pending")).toBeNull();
  });
});
