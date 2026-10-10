import { type BuildProblem, MEDIA_DIR } from "@goodfellow-cms/core";
import { useEffect, useState } from "react";
import { useAdmin } from "./admin-context.js";
import { type StringKey, useStrings } from "./strings.js";
import { Button, Dialog } from "./ui.js";
import { AppLink } from "./use-link.js";
import { versionsHref } from "./versions-screen.js";

/** Whether a file is the site's code, which only a rebuild checks, rather than content the admin panel loads. */
function isCode(path: string): boolean {
  return !path.startsWith("content/") && !path.startsWith(`${MEDIA_DIR}/`);
}

const STEP_TEXT: Record<Exclude<BuildProblem["step"], "build">, StringKey> = {
  "not-started": "build.notStarted",
  install: "build.install",
  pages: "build.pages",
  deploy: "build.deploy",
  host: "build.host",
};

/** "What went wrong?", beside the top bar's "couldn't be updated", which explains a failed rebuild. */
export function BuildProblemButton() {
  const t = useStrings();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" className="gfa-deploy-why" onClick={() => setOpen(true)}>
        {t("build.why")}
      </Button>
      {open && <BuildProblemDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function BuildProblemDialog({ onClose }: { onClose: () => void }) {
  const t = useStrings();
  const { deploy, account, changedPaths } = useAdmin();
  const host = account?.hostName ?? "";
  const problem = deploy?.problem;
  // Whether the publish changed the site's code, such as by adding a block, which is the likeliest reason for a build to fail.
  const [codeChanged, setCodeChanged] = useState<boolean>();

  useEffect(() => {
    if (!deploy?.previous || !changedPaths || problem?.step !== "build" || problem.cause?.kind === "content") return;
    let cancelled = false;
    changedPaths(deploy.previous, deploy.revision).then(
      (paths) => !cancelled && setCodeChanged(paths.some(isCode)),
      () => !cancelled && setCodeChanged(false),
    );
    return () => {
      cancelled = true;
    };
  }, [deploy, changedPaths, problem]);

  const cause = problem?.cause;
  let message: string;
  let action: React.ReactNode;
  if (!problem) {
    message = t("build.unknown", { host });
  } else if (problem.step !== "build") {
    message = t(STEP_TEXT[problem.step], { host });
  } else if (cause?.kind === "content" && cause.file) {
    message = t("build.content", { file: cause.file });
    action = (
      <AppLink href={versionsHref(cause.file)} onClick={onClose}>
        {t("build.contentHistory", { file: cause.file })}
      </AppLink>
    );
  } else if (codeChanged) {
    message = t("build.codeChanged");
    action = (
      <AppLink href="#/blocks" onClick={onClose}>
        {t("build.blocks")}
      </AppLink>
    );
  } else {
    message = cause?.file ? t("build.codeFile", { file: cause.file }) : t("build.code");
  }
  const details = [cause?.message, problem?.detail].filter(Boolean).join("\n\n");

  return (
    <Dialog title={t("build.title")} onClose={onClose}>
      <div className="gfa-build-problem">
        <p>{message}</p>
        {action && <p>{action}</p>}
        <p className="gfa-hint">{t("build.saved")}</p>
        {details && (
          <details className="gfa-details">
            <summary>{t("details.show")}</summary>
            <pre>{details}</pre>
          </details>
        )}
        {deploy?.detailsUrl && (
          <p>
            <a href={deploy.detailsUrl} target="_blank" rel="noreferrer">
              {t("build.hostDetails", { host })}
            </a>
          </p>
        )}
      </div>
      <div className="gfa-dialog-actions">
        <Button onClick={onClose}>{t("action.close")}</Button>
      </div>
    </Dialog>
  );
}
