import { SetupError } from "@goodfellow-cms/core";
import { describe, expect, it } from "vitest";
import { githubSetup } from "./setup.js";
import { fakeGitHub } from "./testing.js";

const files = [
  { path: "package.json", content: "{}\n" },
  { path: ".github/workflows/deploy.yml", content: "name: Deploy\n" },
  { path: "public/media/logo.png", bytes: new Uint8Array([137, 80, 78, 71, 0, 255]) },
];

function setup(options: Parameters<typeof fakeGitHub>[0] = { repo: "someone/existing" }) {
  const fake = fakeGitHub(options);
  return { fake, host: githubSetup({ fetch: fake.fetch }) };
}

describe("githubSetup", () => {
  it("lists the person's own account first, then their organizations", async () => {
    const { host } = setup({ repo: "someone/existing", orgs: ["st-joseph"], tokens: { t: { login: "someone" } } });
    const account = await host.signInWithToken(" t ");
    expect(account.user.login).toBe("someone");
    expect((await account.owners()).map((owner) => [owner.path, owner.kind])).toEqual([
      ["someone", "personal"],
      ["st-joseph", "organization"],
    ]);
  });

  it("creates a public repository on main with Pages, every file in one commit, and protected history", async () => {
    const { fake, host } = setup({
      repo: "someone/existing",
      newRepoBranch: "master",
      tokens: { t: { login: "someone" } },
    });
    const account = await host.signInWithToken("t");
    const owner = (await account.owners())[0];
    if (!owner) throw new Error("no owner");
    expect(await account.isAvailable(owner, "parish")).toBe(true);
    const steps: string[] = [];
    const result = await account.createSite(
      { owner, name: "parish", private: false, pages: true, files, message: "Create the site" },
      (step) => steps.push(step),
    );
    expect(steps).toEqual(["repository", "pages", "files", "protection"]);
    expect(result).toEqual({
      repo: "someone/parish",
      webUrl: "https://github.com/someone/parish",
      siteUrl: "https://someone.github.io/parish/",
      buildsUrl: "https://github.com/someone/parish/actions",
      pagesUrl: "https://github.com/someone/parish/settings/pages",
      warnings: [],
    });

    const site = fake.created.get("someone/parish");
    if (!site) throw new Error("not created");
    expect(site.repo.defaultBranch).toBe("main");
    expect([...site.repo.branches.keys()]).toEqual(["main"]);
    const head = site.repo.commitAt(site.repo.head());
    // The first commit replaces the README GitHub starts the repository with.
    expect(head?.parent).toBeUndefined();
    expect(head?.message).toBe("Create the site");
    expect([...(head?.files.keys() ?? [])].sort()).toEqual([
      ".github/workflows/deploy.yml",
      "package.json",
      "public/media/logo.png",
    ]);
    expect(head?.files.get("public/media/logo.png")).toEqual(new Uint8Array([137, 80, 78, 71, 0, 255]));
    expect(site.pages).toEqual({ build_type: "workflow" });
    expect(site.rulesets).toHaveLength(1);
    expect(await account.isAvailable(owner, "parish")).toBe(false);
  });

  it("still creates a private repository on the free plan, warning that Pages and protection aren't available", async () => {
    const { host } = setup({ repo: "someone/existing", tokens: { t: { login: "someone" } } });
    const account = await host.signInWithToken("t");
    const owner = (await account.owners())[0];
    if (!owner) throw new Error("no owner");
    const result = await account.createSite({
      owner,
      name: "private-site",
      private: true,
      pages: true,
      files,
      message: "Create",
    });
    expect(result.siteUrl).toBeUndefined();
    expect(result.warnings).toEqual(["pages-unavailable", "protection-unavailable"]);
  });

  it("says when the name is taken, or the token can't write the build setup", async () => {
    const { host } = setup({
      repo: "someone/existing",
      tokens: { t: { login: "someone" }, narrow: { login: "someone", workflow: false } },
    });
    const account = await host.signInWithToken("t");
    const owner = (await account.owners())[0];
    if (!owner) throw new Error("no owner");
    const site = { owner, name: "existing", private: false, pages: false, files, message: "Create" };
    await expect(account.createSite(site)).rejects.toMatchObject({ problem: "name-taken" });
    const narrow = await host.signInWithToken("narrow");
    await expect(narrow.createSite({ ...site, name: "new-site" })).rejects.toBeInstanceOf(SetupError);
    await expect(narrow.createSite({ ...site, name: "another" })).rejects.toMatchObject({ problem: "not-allowed" });
  });
});
