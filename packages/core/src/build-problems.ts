/**
 * Why a site's rebuild failed, in a form the admin panel turns into plain
 * words: which step of the host's build failed, and what `goodfellow build`
 * said about it. `goodfellow build` prints that on a line of its own
 * (`formatBuildCause()`), which backends find in the host's log (`findBuildCause()`).
 */

/**
 * The step that failed: the host didn't start the build (such as when the
 * account's build minutes have run out), installing packages, setting up the
 * host's Pages, building the site, publishing what was built, or a problem on
 * the host's side.
 */
export type BuildStep = "not-started" | "install" | "pages" | "build" | "deploy" | "host";

/** What `goodfellow build` said went wrong: a content file it couldn't read, or code that wouldn't build. */
export interface BuildCause {
  kind: "content" | "code";
  /** The file, relative to the site's folder, such as `content/pages/about.json`. */
  file?: string;
  message: string;
}

export interface BuildProblem {
  step: BuildStep;
  cause?: BuildCause;
  /** The host's own words, such as the failed step's name, for the details. */
  detail?: string;
}

/** Starts the line `goodfellow build` prints when it fails. */
export const BUILD_CAUSE_MARKER = "goodfellow-build-problem ";

/** The line `goodfellow build` prints about why it failed. */
export function formatBuildCause(cause: BuildCause): string {
  return `${BUILD_CAUSE_MARKER}${JSON.stringify(cause)}`;
}

/** The last cause `goodfellow build` printed in a build's log, if any. */
export function findBuildCause(log: string): BuildCause | undefined {
  const lines = log.split("\n");
  for (let index = lines.length - 1; index >= 0; index--) {
    const line = lines[index] ?? "";
    const at = line.indexOf(BUILD_CAUSE_MARKER);
    if (at === -1) continue;
    try {
      const found = JSON.parse(line.slice(at + BUILD_CAUSE_MARKER.length).trim()) as Partial<BuildCause>;
      if ((found.kind === "content" || found.kind === "code") && typeof found.message === "string") {
        return {
          kind: found.kind,
          message: found.message,
          ...(typeof found.file === "string" && found.file && { file: found.file }),
        };
      }
    } catch {
      // Not a line goodfellow build wrote; keep looking.
    }
  }
  return undefined;
}

/**
 * The step a CI step or command is, by what it runs: `npm ci`, the host's
 * Pages actions, or a build. `undefined` when it can't tell.
 */
export function buildStepFor(name: string): BuildStep | undefined {
  const text = name.toLowerCase();
  if (/deploy-pages|deploy to |pages:deploy/.test(text)) return "deploy";
  if (/configure-pages|upload-pages-artifact|setup pages|set up pages/.test(text)) return "pages";
  if (/\b(npm (ci|install)|pnpm install|yarn( install)?|install packages)\b/.test(text)) return "install";
  if (/\bbuild\b/.test(text)) return "build";
  return undefined;
}
