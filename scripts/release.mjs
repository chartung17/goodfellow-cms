#!/usr/bin/env node
// Releases Goodfellow's packages to npm, all with the same version. See RELEASING.md.
//
//   node scripts/release.mjs version            Turns the changesets into changelogs and new versions.
//   node scripts/release.mjs publish [--dry-run] [--yes] [--ci]
//                                               Publishes the versions npm doesn't have yet, then tags them.
//                                               The release workflow runs it with --ci once CI passes on master.
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

class ReleaseError extends Error {}

/** On Windows, pnpm and npm are .cmd files, which Node only starts through a shell. */
const windows = process.platform === "win32";

/** An argument as cmd.exe reads it: quoted unless it's plain. */
function quote(arg) {
  return /^[\w@+=:,./\\-]+$/.test(arg) ? arg : `"${arg.replace(/"/g, '""')}"`;
}

function spawn(command, args, options) {
  return windows
    ? spawnSync([command, ...args.map(quote)].join(" "), { cwd: root, shell: true, ...options })
    : spawnSync(command, args, { cwd: root, ...options });
}

/** Runs a command, showing its output. Throws if it fails. */
function run(command, args, options = {}) {
  console.log(`\n$ ${[command, ...args].join(" ")}`);
  const result = spawn(command, args, { stdio: "inherit", ...options });
  if (result.error) throw new ReleaseError(`Couldn't run ${command}: ${result.error.message}`);
  if (result.status !== 0) throw new ReleaseError(`${command} ${args.join(" ")} failed.`);
}

/** Runs a command and returns what it printed. */
function read(command, args, options = {}) {
  const result = spawn(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options });
  if (result.error) throw new ReleaseError(`Couldn't run ${command}: ${result.error.message}`);
  if (result.status !== 0) {
    throw new ReleaseError(`${command} ${args.join(" ")} failed:\n${result.stderr?.trim() ?? ""}`);
  }
  return result.stdout.trim();
}

/** The packages that are published: every package in packages/ that isn't private. */
function packages() {
  return readdirSync(join(root, "packages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = join(root, "packages", entry.name);
      const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
      return { dir, manifest, name: manifest.name, version: manifest.version };
    })
    .filter(({ manifest }) => !manifest.private);
}

/** The packages in the order to publish them: each after the packages it depends on. */
function inDependencyOrder(list) {
  const byName = new Map(list.map((pkg) => [pkg.name, pkg]));
  const ordered = [];
  const visiting = new Set();
  const visit = (pkg) => {
    if (ordered.includes(pkg)) return;
    if (visiting.has(pkg.name)) throw new ReleaseError(`${pkg.name} depends on itself through other packages.`);
    visiting.add(pkg.name);
    const { dependencies = {}, peerDependencies = {}, devDependencies = {} } = pkg.manifest;
    for (const name of Object.keys({ ...dependencies, ...peerDependencies, ...devDependencies })) {
      const dependency = byName.get(name);
      if (dependency) visit(dependency);
    }
    visiting.delete(pkg.name);
    ordered.push(pkg);
  };
  for (const pkg of [...list].sort((a, b) => a.name.localeCompare(b.name))) visit(pkg);
  return ordered;
}

/** The changesets waiting to be released. */
function pendingChangesets() {
  return readdirSync(join(root, ".changeset")).filter((name) => name.endsWith(".md") && name !== "README.md");
}

function requireCleanTree() {
  const status = read("git", ["status", "--porcelain"]);
  if (status) throw new ReleaseError(`Commit or stash these changes first:\n${status}`);
}

/** Every package has the same version, since they're released together. */
function sharedVersion(list) {
  const versions = [...new Set(list.map((pkg) => pkg.version))];
  if (versions.length !== 1) {
    throw new ReleaseError(
      `The packages should all have the same version, but have ${versions.join(", ")}. Check .changeset/config.json's "fixed".`,
    );
  }
  return versions[0];
}

/** Whether this exact version is already on npm. */
function isPublished(name, version) {
  const result = spawn("npm", ["view", `${name}@${version}`, "version", "--json"], { encoding: "utf8" });
  if (result.error) throw new ReleaseError(`Couldn't run npm: ${result.error.message}`);
  if (result.status === 0) return result.stdout.trim() !== "";
  // npm reports a version it doesn't have as E404, on stdout with --json and on stderr.
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (/E404|404 Not Found/.test(output)) return false;
  throw new ReleaseError(`Couldn't ask npm about ${name}@${version}:\n${output.trim()}`);
}

async function confirm(question) {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^y(es)?$/i.test((await prompt.question(`${question} [y/N] `)).trim());
  } finally {
    prompt.close();
  }
}

function version() {
  requireCleanTree();
  if (pendingChangesets().length === 0) {
    throw new ReleaseError("There are no changesets, so there's nothing to release. Add them with `pnpm changeset`.");
  }
  run("pnpm", ["changeset", "version"]);
  // Keeps the lockfile in step with the new versions.
  run("pnpm", ["install", "--lockfile-only"]);
  const next = sharedVersion(packages());
  console.log(`
Every package is now ${next}. Next:
  1. Read the new CHANGELOG.md files and the version changes (git diff).
  2. Commit them on a branch, such as "Release ${next}", and open a pull request.
  3. Once CI passes, merge it. The release workflow then publishes ${next} to npm
     and updates the docs site.`);
}

/** Tells the workflow running this what happened, for its later steps. */
function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

/**
 * Publishes the versions npm doesn't have yet. Run on your computer, it checks
 * you're on GitHub's master and runs the checks first; with `--ci`, the release
 * workflow runs it after CI has passed on the commit, so it only builds.
 */
async function publish({ ci, dryRun, yes }) {
  requireCleanTree();
  if (!ci) {
    const branch = read("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
    if (branch !== "master") throw new ReleaseError(`Publish from master, not ${branch}.`);
    run("git", ["fetch", "origin", "master", "--tags"]);
    if (read("git", ["rev-parse", "HEAD"]) !== read("git", ["rev-parse", "origin/master"])) {
      throw new ReleaseError(
        "This master isn't the same as GitHub's. Run `git pull` (and push anything of yours) first.",
      );
    }
  }

  const list = inDependencyOrder(packages());
  const next = sharedVersion(list);
  setOutput("version", next);
  setOutput("published", "false");
  // 0.0.0 is the version before the first release, never one to publish.
  if (next === "0.0.0") {
    console.log("\nThe packages haven't been given a version yet. Run `pnpm release:version` first.");
    return;
  }
  const toPublish = list.filter((pkg) => !isPublished(pkg.name, pkg.version));
  if (toPublish.length === 0) {
    const waiting = pendingChangesets().length;
    console.log(
      `\nEvery package is already on npm at ${next}, so there's nothing to publish.${
        waiting > 0
          ? ` To release the ${waiting} waiting changesets, run \`pnpm release:version\` and merge its pull request.`
          : ""
      }`,
    );
    return;
  }

  if (!ci) {
    const whoami = spawn("npm", ["whoami"], { encoding: "utf8" });
    if (whoami.error) throw new ReleaseError(`Couldn't run npm: ${whoami.error.message}`);
    if (whoami.status === 0) console.log(`\nSigned in to npm as ${whoami.stdout.trim()}.`);
    else if (dryRun) console.log("\nNot signed in to npm; a dry run doesn't need it.");
    else throw new ReleaseError("You aren't signed in to npm. Run `npm login`, then try again.");
  }
  // CI has passed on the commit the workflow publishes, end-to-end tests included.
  for (const step of ci ? ["build"] : ["lint", "typecheck", "test", "build"]) run("pnpm", [step]);

  const out = mkdtempSync(join(tmpdir(), "goodfellow-release-"));
  try {
    // pnpm writes the package's dependencies on other packages here (workspace:*) as their versions.
    const tarballs = toPublish.map((pkg) => {
      const packed = JSON.parse(read("pnpm", ["pack", "--json", "--pack-destination", out], { cwd: pkg.dir }));
      return { ...pkg, tarball: packed.filename };
    });

    console.log(`\n${dryRun ? "Would publish" : "Publishing"} ${next}:`);
    for (const pkg of tarballs) console.log(`  ${pkg.name}`);
    const skipped = list.filter((pkg) => !toPublish.includes(pkg));
    if (skipped.length > 0) console.log(`Already on npm: ${skipped.map((pkg) => pkg.name).join(", ")}`);

    if (!ci && !dryRun && !yes && !(await confirm(`\nPublish ${tarballs.length} packages to npm?`))) {
      throw new ReleaseError("Nothing was published.");
    }
    // In GitHub Actions, npm records where each package was built (provenance).
    const flags = ["--access", "public", ...(process.env.GITHUB_ACTIONS ? ["--provenance"] : [])];
    for (const pkg of tarballs) {
      // On your computer, npm asks for a one-time code or a browser sign-in itself if the account needs one.
      run("npm", ["publish", pkg.tarball, ...flags, ...(dryRun ? ["--dry-run"] : [])]);
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }

  // A tag for each package, as Changesets makes them, and one for the release.
  const tags = [...list.map((pkg) => `${pkg.name}@${pkg.version}`), `v${next}`];
  const existing = new Set(read("git", ["tag", "--list"]).split("\n"));
  const missing = tags.filter((tag) => !existing.has(tag));
  if (dryRun) {
    console.log(`\nWould tag ${missing.length > 0 ? missing.join(", ") : "nothing (all tagged)"} and push the tags.`);
    return;
  }
  setOutput("published", "true");
  for (const tag of missing) run("git", ["tag", tag]);
  if (missing.length > 0) run("git", ["push", "origin", ...missing.map((tag) => `refs/tags/${tag}`)]);
  console.log(
    ci
      ? `\nReleased ${next}.`
      : `\nReleased ${next}. To update the docs site, run the "Deploy docs" workflow in the repository's Actions tab.`,
  );
}

const [command, ...flags] = process.argv.slice(2);
try {
  if (command === "version") version();
  else if (command === "publish") {
    await publish({ ci: flags.includes("--ci"), dryRun: flags.includes("--dry-run"), yes: flags.includes("--yes") });
  } else throw new ReleaseError("Run `node scripts/release.mjs version` or `node scripts/release.mjs publish`.");
} catch (error) {
  if (!(error instanceof ReleaseError)) throw error;
  console.error(`\n${error.message}`);
  process.exitCode = 1;
}
