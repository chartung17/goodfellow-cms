/** A problem with one content file. */
export interface ContentProblem {
  /** Repo-relative path of the file. */
  file: string;
  /** What's wrong, in plain language. */
  message: string;
}

/** Thrown when one or more content files can't be used. Lists every problem found, not just the first. */
export class ContentError extends Error {
  override name = "ContentError";
  readonly problems: ContentProblem[];

  constructor(problems: ContentProblem[]) {
    super(
      problems.length === 1
        ? `${problems[0]?.file}: ${problems[0]?.message}`
        : `${problems.length} content files have problems:\n${problems
            .map((problem) => `  ${problem.file}: ${problem.message}`)
            .join("\n")}`,
    );
    this.problems = problems;
  }
}
