/**
 * Updating a site to newer Goodfellow releases: which release to update to,
 * the line `goodfellow update` prints about what it did, and what a backend's
 * optional `updates` capability does with the site's nightly update job.
 */

import type { BuildCause } from "./build-problems.js";

/** npm's registry, which answers browsers too. */
export const NPM_REGISTRY = "https://registry.npmjs.org";

/** The package whose version is the site's Goodfellow version: every Goodfellow package has the same one. */
export const VERSION_PACKAGE = "@goodfellow-cms/react";

type Parts = [number, number, number];

/** A release's version, such as `0.4.2`, from a version or a range such as `^0.4.2`; pre-releases don't count. */
function parse(version: string): Parts | undefined {
  const match = /^[\^~=v]*(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
}

function compare(a: Parts, b: Parts): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/** A release version without a range's `^` or `~`, or `undefined` if it isn't one. */
export function releaseVersion(version: string): string | undefined {
  const parts = parse(version);
  return parts?.join(".");
}

/** The releases of a package, oldest first, from npm's metadata for it. */
export function releaseVersions(metadata: unknown): string[] {
  const versions = Object.keys((metadata as { versions?: Record<string, unknown> } | null)?.versions ?? {});
  return versions
    .flatMap((version) => {
      const parts = parse(version);
      return parts ? [{ version, parts }] : [];
    })
    .sort((a, b) => compare(a.parts, b.parts))
    .map(({ version }) => version);
}

/** What a site can update to: the newest fixes for its release, and the newest release, if they're newer. */
export interface AvailableUpdates {
  /** The newest release with the same major and minor version, which installs on its own each night. */
  fixes?: string;
  /** The newest release, when it's a newer minor or major release, which an owner chooses to install. */
  newer?: string;
}

export function availableUpdates(current: string, versions: readonly string[]): AvailableUpdates {
  const now = parse(current);
  if (!now) return {};
  let fixes: Parts | undefined;
  let newer: Parts | undefined;
  for (const version of versions) {
    const parts = parse(version);
    if (!parts || compare(parts, now) <= 0) continue;
    if (parts[0] === now[0] && parts[1] === now[1]) {
      if (!fixes || compare(parts, fixes) > 0) fixes = parts;
    } else if (!newer || compare(parts, newer) > 0) {
      newer = parts;
    }
  }
  return { ...(fixes && { fixes: fixes.join(".") }), ...(newer && { newer: newer.join(".") }) };
}

/**
 * The release to update to: `fixes` for the newest release with the same
 * major and minor version, `latest` for the newest of all, or a release
 * itself. `undefined` when there's nothing newer.
 */
export function chooseUpdate(current: string, versions: readonly string[], target: string): string | undefined {
  const available = availableUpdates(current, versions);
  if (target === "fixes") return available.fixes;
  if (target === "latest") return available.newer ?? available.fixes;
  const wanted = releaseVersion(target);
  const now = parse(current);
  const parts = wanted ? parse(wanted) : undefined;
  return wanted && now && parts && versions.includes(wanted) && compare(parts, now) > 0 ? wanted : undefined;
}

/** The site's Goodfellow version, from its `package.json`. */
export function siteVersion(packageJson: string): string | undefined {
  try {
    const { dependencies = {}, devDependencies = {} } = JSON.parse(packageJson) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const range = dependencies[VERSION_PACKAGE] ?? devDependencies[VERSION_PACKAGE];
    return range ? releaseVersion(range) : undefined;
  } catch {
    return undefined;
  }
}

/** What `goodfellow update` did. */
export interface UpdateResult {
  /** Nothing newer; updated and published; or not published, because the site didn't build or install with it. */
  state: "up-to-date" | "updated" | "failed";
  from: string;
  to?: string;
  /** For a failed update, the step that failed. */
  step?: "install" | "build" | "blocks" | "publish";
  /** What the build said, when building the site with the update failed. */
  cause?: BuildCause;
  /** Installed blocks' files someone changed, which the update left as they were. */
  kept?: string[];
}

/** Starts the line `goodfellow update` prints about what it did. */
export const UPDATE_RESULT_MARKER = "goodfellow-update ";

export function formatUpdateResult(result: UpdateResult): string {
  return `${UPDATE_RESULT_MARKER}${JSON.stringify(result)}`;
}

/** The last result `goodfellow update` printed in a log, if any. */
export function findUpdateResult(log: string): UpdateResult | undefined {
  const lines = log.split("\n");
  for (let index = lines.length - 1; index >= 0; index--) {
    const line = lines[index] ?? "";
    const at = line.indexOf(UPDATE_RESULT_MARKER);
    if (at === -1) continue;
    try {
      const found = JSON.parse(line.slice(at + UPDATE_RESULT_MARKER.length).trim()) as UpdateResult;
      if (["up-to-date", "updated", "failed"].includes(found.state) && typeof found.from === "string") return found;
    } catch {
      // Not a line goodfellow update wrote; keep looking.
    }
  }
  return undefined;
}

/** The site's last run of its update job. */
export interface UpdateRun {
  /** Still running; or what it did, where the host says; `unknown` when it finished without saying. */
  state: "running" | "unknown" | UpdateResult["state"];
  /** When it started, as an ISO 8601 date. */
  date?: string;
  result?: UpdateResult;
  /** Where to see it on the host. */
  detailsUrl?: string;
}

/**
 * Whether the site's update job can run: `ready`; `needs-setup` when the host
 * still needs something turned on, which `enable()` does; `missing` when the
 * site's build setup has no update job, such as older sites or sites on Vercel.
 */
export type UpdatesSetup = "ready" | "needs-setup" | "missing";

/** A git host's runs of the site's nightly update job. */
export interface SiteUpdates {
  setup(): Promise<UpdatesSetup>;
  /** Turns on what the host needs, such as letting the job publish and running it each night. */
  enable?(): Promise<void>;
  lastRun(): Promise<UpdateRun | undefined>;
  /** Runs the update job now: `fixes` for the newest fixes, or a release, such as a newer one an owner chose. */
  start(target: string): Promise<void>;
}

/** Why the update job couldn't be run or set up, in a form the admin panel turns into plain words. */
export type UpdatesProblem =
  /** The sign-in, or the owner token, can't run it or change the host's settings. */
  | "not-allowed"
  /** The site's build setup has no update job. */
  | "missing";

export class UpdatesError extends Error {
  override name = "UpdatesError";
  constructor(
    readonly problem: UpdatesProblem,
    message: string,
  ) {
    super(message);
  }
}
