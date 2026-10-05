import { cp, mkdir, readdir, readFile, rename, rm, rmdir, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";

/** The sites a new site can start from. The keys are what `--template` takes. */
export const TEMPLATES = {
  starter: { label: "Starter", description: "A simple site with a few pages and a news section" },
  parish: {
    label: "Parish example",
    description: "A made-up parish with Mass times, events, news, bulletins and staff, and blocks of its own",
  },
  next: {
    label: "Starter for Next.js",
    description: "The starter as a Next.js site, for developers who want their own Next.js pages beside it",
  },
} as const;

export type TemplateName = keyof typeof TEMPLATES;

/** Where the site's repository is stored, which the admin panel publishes to. */
export interface Backend {
  host: "github" | "gitlab";
  /** `owner/name` on GitHub, or the project's path on GitLab, such as `group/subgroup/site`. */
  repo: string;
}

/** Where the built site is served from. Each has its own setup file in the template. */
export const HOSTS = {
  "github-pages": {
    label: "GitHub Pages",
    files: [".github/workflows/deploy.yml"],
    note: "Free for public repositories. Not allowed for online businesses or shops.",
  },
  "gitlab-pages": {
    label: "GitLab Pages",
    files: [".gitlab-ci.yml"],
    note: "Free, including for private projects. No rule against business sites that we know of.",
  },
  vercel: {
    label: "Vercel",
    files: ["vercel.json"],
    note: "Works with GitHub and GitLab. The free plan is for non-commercial sites only.",
  },
} as const;

export type Host = keyof typeof HOSTS;

/** The hosts that can serve a site stored with `backend`: GitHub Pages only builds GitHub repositories, and so on. */
export function hostsFor(backend: Backend["host"] | undefined): Host[] {
  if (backend === "github") return ["github-pages", "vercel"];
  if (backend === "gitlab") return ["gitlab-pages", "vercel"];
  return ["github-pages", "gitlab-pages", "vercel"];
}

/** A problem the person creating the site can fix, described in plain words. */
export class ScaffoldError extends Error {
  override name = "ScaffoldError";
}

/** Never copied, wherever they are: installed packages and build caches. */
const SKIPPED = new Set(["node_modules", ".turbo"]);

/** Never copied from the template's own folder: build output, and files only the Goodfellow repository uses. */
const SKIPPED_AT_ROOT = new Set(["dist", "out", ".next", "next-env.d.ts", "turbo.json"]);

/**
 * npm leaves `.gitignore` files out of published packages, so templates are
 * bundled with `_gitignore` instead, and it's renamed back in the new site.
 */
export const BUNDLED_GITIGNORE = "_gitignore";

/**
 * Copies a template's files, leaving out installed packages and build output.
 * `bundling` renames `.gitignore` files for publishing; otherwise they're renamed back.
 */
export async function copyTemplate(from: string, to: string, { bundling = false } = {}): Promise<void> {
  await cp(from, to, {
    recursive: true,
    filter: (source) => {
      const path = relative(from, source).split(sep);
      return !path.some((part) => SKIPPED.has(part)) && !SKIPPED_AT_ROOT.has(path[0] ?? "");
    },
  });
  const [find, replace] = bundling ? [".gitignore", BUNDLED_GITIGNORE] : [BUNDLED_GITIGNORE, ".gitignore"];
  for (const file of await readdir(to, { recursive: true })) {
    if (basename(file) === find) await rename(join(to, file), join(to, file.slice(0, -find.length) + replace));
  }
}

/** A valid npm package name from a folder name, such as `My Parish` → `my-parish`. */
export function packageName(folder: string): string {
  const name = basename(resolve(folder))
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[._-]+|[-]+$/g, "");
  return name.slice(0, 214) || "my-site";
}

/**
 * Reads a repository from what someone typed: `owner/name`, or its address on
 * GitHub or GitLab. Returns `undefined` if it isn't one.
 */
export function parseRepo(host: Backend["host"], input: string): string | undefined {
  let path = input
    .trim()
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");
  const prefix = host === "github" ? /^(?:https?:\/\/)?(?:www\.)?github\.com\//i : /^(?:https?:\/\/)?gitlab\.com\//i;
  path = path.replace(prefix, "");
  const pattern =
    host === "github" ? /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/ : /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9._-]+)+$/;
  return pattern.test(path) ? path : undefined;
}

/** The template's `package.json`, named for the new site and with workspace links replaced by published versions. */
export function sitePackageJson(source: string, name: string, versions: Record<string, string>): string {
  const pkg = JSON.parse(source) as Record<string, unknown> & { version?: string };
  const result: Record<string, unknown> = { ...pkg, name };
  for (const key of ["dependencies", "devDependencies"] as const) {
    const deps = pkg[key] as Record<string, string> | undefined;
    if (!deps) continue;
    result[key] = Object.fromEntries(
      Object.entries(deps).map(([dep, range]) => {
        if (!range.startsWith("workspace:")) return [dep, range];
        const version = versions[dep];
        if (!version) throw new Error(`No version of ${dep} to use in the new site.`);
        return [dep, `^${version}`];
      }),
    );
  }
  return `${JSON.stringify(result, null, 2)}\n`;
}

/** Turns on one of the commented-out `backend` lines in a template's `goodfellow.config.tsx`. */
export function configureBackend(config: string, backend: Backend): string {
  const importLine = `// import { ${backend.host} } from "@goodfellow/${backend.host}";`;
  const backendLine = new RegExp(`^([ \\t]*)// backend: ${backend.host}\\(.*$`, "m");
  if (!config.includes(importLine) || !backendLine.test(config)) {
    throw new Error(`The template's goodfellow.config.tsx has no ${backend.host} line to turn on.`);
  }
  const call =
    backend.host === "github"
      ? `github({ repo: ${JSON.stringify(backend.repo)} })`
      : `gitlab({ project: ${JSON.stringify(backend.repo)} })`;
  return config.replace(importLine, importLine.slice(3)).replace(backendLine, `$1backend: ${call},`);
}

export interface ScaffoldOptions {
  /** The template's folder. */
  template: string;
  /** The new site's folder. It must be empty or not exist yet. */
  target: string;
  /** Versions of Goodfellow's packages, by name, to replace the template's workspace links. */
  versions: Record<string, string>;
  backend?: Backend;
  /** Keeps only this host's setup file. All are kept if it isn't set. */
  host?: Host;
}

async function isEmptyFolder(path: string): Promise<boolean> {
  try {
    return (await readdir(path)).length === 0;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
    throw error;
  }
}

/** Creates a new site in `target` from a template. */
export async function scaffold({ template, target, versions, backend, host }: ScaffoldOptions): Promise<void> {
  if (!(await isEmptyFolder(target))) {
    throw new ScaffoldError(`The folder ${target} already has files in it. Choose a new folder for the site.`);
  }
  await mkdir(target, { recursive: true });
  await copyTemplate(template, target);

  const pkgPath = join(target, "package.json");
  await writeFile(pkgPath, sitePackageJson(await readFile(pkgPath, "utf8"), packageName(target), versions));

  if (backend) {
    const configPath = join(target, "goodfellow.config.tsx");
    await writeFile(configPath, configureBackend(await readFile(configPath, "utf8"), backend));
  }

  if (host) {
    for (const [name, { files }] of Object.entries(HOSTS)) {
      if (name === host) continue;
      for (const file of files) await rm(join(target, file), { force: true });
    }
    // Leaves no empty .github/workflows folder behind.
    for (const dir of [".github/workflows", ".github"]) {
      if (await isEmptyFolder(join(target, dir))) await rmdir(join(target, dir)).catch(() => undefined);
    }
  }
}
