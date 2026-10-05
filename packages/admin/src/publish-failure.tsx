import { useStrings } from "./strings.js";
import { ErrorMessage } from "./ui.js";

export type Failure = { reason: "conflict" | "error"; error: unknown } | null;

/** Explains why a publish from a dialog or form didn't go through. */
export function PublishFailure({ failure }: { failure: Failure }) {
  const t = useStrings();
  if (!failure) return null;
  return (
    <ErrorMessage
      message={t(failure.reason === "conflict" ? "publish.conflict" : "publish.error")}
      error={failure.error}
    />
  );
}
