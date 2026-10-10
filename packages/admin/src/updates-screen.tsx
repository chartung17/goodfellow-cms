import {
  type AvailableUpdates,
  availableUpdates,
  NPM_REGISTRY,
  releaseVersions,
  siteVersion,
  type UpdateRun,
  UpdatesError,
  type UpdatesSetup,
  VERSION_PACKAGE,
} from "@goodfellow-cms/core";
import { useCallback, useEffect, useState } from "react";
import { useAdmin, useSiteContent } from "./admin-context.js";
import { OwnerTokenActive, OwnerTokenForm } from "./owner-token.js";
import { SettingsTabs } from "./settings-screen.js";
import { type StringKey, useStrings } from "./strings.js";
import { Button, ErrorMessage } from "./ui.js";

/** Where each release's changes are described. */
const RELEASES_URL = "https://github.com/chartung17/goodfellow-cms/releases";
/** How often the screen checks on an update while one is running. */
const CHECK_INTERVAL = 15_000;

const STEP_TEXT: Record<string, StringKey> = {
  build: "updates.failed.build",
  install: "updates.failed.install",
  blocks: "updates.failed.blocks",
  publish: "updates.failed.publish",
};

function formatDate(date: string | undefined): string {
  const parsed = date ? new Date(date) : undefined;
  return parsed && !Number.isNaN(parsed.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsed)
    : "";
}

/** The site's Goodfellow release, the fixes and releases it can update to, and its nightly update job. */
export function UpdatesScreen() {
  const t = useStrings();
  const { updates, demo } = useAdmin();

  return (
    <div className="gfa-screen">
      <div className="gfa-screen-header">
        <h1>{t("settings.title")}</h1>
      </div>
      <SettingsTabs tab="updates" />
      <div className="gfa-form">
        <p>{t("updates.intro")}</p>
        {demo ? <p>{t("updates.demo")}</p> : updates ? <UpdatesPanel /> : <p>{t("updates.local")}</p>}
      </div>
    </div>
  );
}

interface Loaded {
  current?: string;
  available: AvailableUpdates;
  setup: UpdatesSetup;
  last?: UpdateRun;
  owner: boolean;
}

function UpdatesPanel() {
  const t = useStrings();
  const { updates, versions, editors, ownerAccess, account } = useAdmin();
  const { revision } = useSiteContent();
  const host = account?.hostName ?? "";
  const [loaded, setLoaded] = useState<Loaded>();
  const [error, setError] = useState<unknown>();
  const [problem, setProblem] = useState<unknown>();
  const [started, setStarted] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!updates) return;
    try {
      const [packageJson, metadata, setup, last, people] = await Promise.all([
        versions?.readAt("package.json", revision),
        window
          .fetch(`${NPM_REGISTRY}/${VERSION_PACKAGE}`, { headers: { accept: "application/vnd.npm.install-v1+json" } })
          .then((response) => (response.ok ? response.json() : undefined))
          .catch(() => undefined),
        updates.setup(),
        updates.lastRun(),
        editors?.list().catch(() => undefined),
      ]);
      const current = packageJson ? siteVersion(packageJson) : undefined;
      setLoaded({
        current,
        available: current ? availableUpdates(current, releaseVersions(metadata)) : {},
        setup,
        last,
        // Without a list of editors, the host decides who may update when asked.
        owner: people ? people.editors.some((editor) => editor.self && editor.role === "owner") : true,
      });
      setError(undefined);
    } catch (caught) {
      setError(caught);
    }
  }, [updates, versions, editors, revision]);

  useEffect(() => {
    void load();
  }, [load]);

  // While an update runs, check on it now and then.
  const running = started || loaded?.last?.state === "running";
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => void load(), CHECK_INTERVAL);
    return () => clearInterval(timer);
  }, [running, load]);
  useEffect(() => {
    if (started && loaded?.last && loaded.last.state !== "running") setStarted(false);
  }, [started, loaded]);

  const act = async (run: () => Promise<void>, after?: () => void) => {
    setBusy(true);
    setProblem(undefined);
    try {
      await run();
      after?.();
    } catch (caught) {
      setProblem(caught);
    }
    await load();
    setBusy(false);
  };
  const start = (target: string) =>
    act(
      () => updates?.start(target) ?? Promise.resolve(),
      () => setStarted(true),
    );

  if (!updates) return null;
  if (error) return <ErrorMessage message={t("updates.error.load")} error={error} />;
  if (!loaded) return <p role="status">{t("updates.loading")}</p>;
  const { current, available, setup, last, owner } = loaded;
  const needsToken = problem instanceof UpdatesError && problem.problem === "not-allowed" && ownerAccess;

  return (
    <>
      <p>{current ? t("updates.current", { version: current }) : t("updates.unknownVersion")}</p>
      <OwnerTokenActive onForget={() => void load()} />

      {setup === "missing" && <p className="gfa-notice">{t("updates.missing")}</p>}
      {setup === "needs-setup" && (
        <div className="gfa-notice">
          <p>{t("updates.needsSetup", { host })}</p>
          {updates.enable && (
            <Button disabled={busy} onClick={() => void act(() => updates.enable?.() ?? Promise.resolve())}>
              {t("updates.enable")}
            </Button>
          )}
        </div>
      )}

      {current && setup !== "missing" && (
        <>
          <h2 className="gfa-section-title">{t("updates.fixes.title")}</h2>
          {available.fixes ? (
            <>
              <p>{t("updates.fixes.ready", { version: available.fixes })}</p>
              <div>
                <Button variant="primary" disabled={busy || running} onClick={() => void start("fixes")}>
                  {t("updates.fixes.now")}
                </Button>
              </div>
            </>
          ) : (
            <p>{t("updates.fixes.none")}</p>
          )}

          {available.newer && (
            <>
              <h2 className="gfa-section-title">{t("updates.newer.title", { version: available.newer })}</h2>
              <p>
                {t("updates.newer.body")}{" "}
                <a href={RELEASES_URL} target="_blank" rel="noreferrer">
                  {t("updates.newer.whatsNew")}
                </a>
              </p>
              {owner ? (
                <div>
                  <Button disabled={busy || running} onClick={() => void start(available.newer ?? "")}>
                    {t("updates.newer.install", { version: available.newer })}
                  </Button>
                </div>
              ) : (
                <p className="gfa-hint">{t("updates.newer.onlyOwners")}</p>
              )}
            </>
          )}
        </>
      )}

      {needsToken && <OwnerTokenForm onReady={() => setProblem(undefined)} />}
      {problem !== undefined && !needsToken && (
        <ErrorMessage
          message={t(problem instanceof UpdatesError ? `updates.error.${problem.problem}` : "updates.error.other", {
            host,
          })}
          error={problem}
        />
      )}
      {started && last?.state !== "running" && <p role="status">{t("updates.started")}</p>}

      <h2 className="gfa-section-title">{t("updates.last.title")}</h2>
      <LastRun run={last} />
    </>
  );
}

function LastRun({ run }: { run?: UpdateRun }) {
  const t = useStrings();
  const { account } = useAdmin();
  const host = account?.hostName ?? "";
  if (!run) return <p>{t("updates.last.none")}</p>;
  const date = formatDate(run.date);
  const result = run.result;
  let message: string;
  if (run.state === "running") message = t("updates.last.running");
  else if (run.state === "updated") {
    message = result?.to
      ? t("updates.last.updated", { date, version: result.to })
      : t("updates.last.updatedSome", { date });
  } else if (run.state === "up-to-date") message = t("updates.last.upToDate", { date });
  else if (run.state === "failed") {
    const why = result?.step && STEP_TEXT[result.step];
    message = `${t("updates.last.failed", { date })}${why ? ` ${t(why, { version: result?.to ?? "" })}` : ""}`;
  } else message = t("updates.last.unknown", { date });
  const kept = result?.kept ?? [];
  const cause = result?.cause;

  return (
    <div className="gfa-form">
      <p role={run.state === "running" ? "status" : undefined}>{message}</p>
      {cause && (
        <details className="gfa-details">
          <summary>{t("details.show")}</summary>
          <pre>{[cause.file, cause.message].filter(Boolean).join("\n")}</pre>
        </details>
      )}
      {kept.length > 0 && (
        <>
          <p className="gfa-hint">{t("updates.kept")}</p>
          <ul>
            {kept.map((file) => (
              <li key={file}>
                <code>{file}</code>
              </li>
            ))}
          </ul>
        </>
      )}
      {run.detailsUrl && (
        <p>
          <a href={run.detailsUrl} target="_blank" rel="noreferrer">
            {t("updates.last.details", { host })}
          </a>
        </p>
      )}
    </div>
  );
}
