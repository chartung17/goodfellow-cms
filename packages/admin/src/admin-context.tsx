import {
  ConflictError,
  type ContentStore,
  type DeployStatus,
  type FileChange,
  type GitBackend,
  type GitUser,
  type GoodfellowConfig,
  loadSiteContent,
  SignInError,
  type SiteContent,
  writeChanges,
} from "@goodfellow/core";
import { createPuckConfig } from "@goodfellow/react";
import type { Config } from "@puckeditor/core";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

/** How previews load the site's styles. Provided by the dev server or build that serves the admin panel. */
export interface PreviewOptions {
  /** The site's compiled stylesheets. */
  stylesheets: string[];
  /** `@goodfellow/react/theme.css`, so Tailwind in the preview knows the theme's classes. */
  themeCss: string;
  /** URL of `@tailwindcss/browser`, which styles classes typed in the editor before the site is rebuilt. */
  tailwindBrowserUrl?: string;
}

export type LoadState =
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | { status: "ready"; content: SiteContent; revision: string };

export type PublishResult = { ok: true } | { ok: false; reason: "conflict" | "error"; error: unknown };

/** Whether the latest publish has reached the live site. */
export type DeployProgress = { revision: string } & DeployStatus;

/** The signed-in person, when the admin panel is connected to a git host. */
export interface Account {
  user: GitUser;
  hostName: string;
  signOut(): void;
}

interface AdminContextValue {
  config: GoodfellowConfig;
  pageConfig: Config;
  layoutConfig: Config;
  preview: PreviewOptions;
  siteUrl: string;
  state: LoadState;
  account?: Account;
  deploy?: DeployProgress;
  reload(): Promise<void>;
  /** Saves changes as one commit, then reloads the site's content. */
  publish(changes: FileChange[], message: string): Promise<PublishResult>;
}

const AdminContext = createContext<AdminContextValue | null>(null);

const DEPLOY_CHECK_INTERVAL = 5_000;
const DEPLOY_CHECK_LIMIT = 20 * 60_000;

async function load(store: ContentStore): Promise<LoadState> {
  try {
    // Read the revision first: reads then see that revision, even if someone publishes while loading.
    const revision = await store.revision();
    const content = await loadSiteContent(store);
    return { status: "ready", content, revision };
  } catch (error) {
    return { status: "error", error };
  }
}

function isGitBackend(store: ContentStore): store is GitBackend {
  return "deployStatus" in store && typeof store.deployStatus === "function";
}

export function AdminProvider({
  config,
  store,
  account,
  preview,
  siteUrl,
  onSignInError,
  children,
}: {
  config: GoodfellowConfig;
  store: ContentStore;
  account?: Account;
  preview: PreviewOptions;
  siteUrl: string;
  /** Called when the git host stops accepting the sign-in, such as when a token expires. */
  onSignInError?: (error: SignInError) => void;
  children: ReactNode;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [deploy, setDeploy] = useState<DeployProgress>();
  const pageConfig = useMemo(() => createPuckConfig(config, "page"), [config]);
  const layoutConfig = useMemo(() => createPuckConfig(config, "layout"), [config]);

  const loadAndHandle = useCallback(async () => {
    const next = await load(store);
    if (next.status === "error" && next.error instanceof SignInError) onSignInError?.(next.error);
    return next;
  }, [store, onSignInError]);

  const reload = useCallback(async () => {
    setState(await loadAndHandle());
  }, [loadAndHandle]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const publish = useCallback(
    async (changes: FileChange[], message: string): Promise<PublishResult> => {
      if (state.status !== "ready") return { ok: false, reason: "error", error: new Error("The site isn't loaded.") };
      let revision: string;
      try {
        ({ revision } = await writeChanges(store, changes, { message, expectedRevision: state.revision }));
      } catch (error) {
        if (error instanceof SignInError && error.problem === "invalid") onSignInError?.(error);
        return { ok: false, reason: error instanceof ConflictError ? "conflict" : "error", error };
      }
      if (isGitBackend(store)) setDeploy({ revision, state: "building" });
      setState(await loadAndHandle());
      return { ok: true };
    },
    [store, state, loadAndHandle, onSignInError],
  );

  // Follows the latest publish until it's live (or fails), so editors know when visitors will see it.
  useEffect(() => {
    if (deploy?.state !== "building" || !isGitBackend(store)) return;
    const started = Date.now();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      const status = await store.deployStatus(deploy.revision).catch((): DeployStatus => ({ state: "unknown" }));
      if (cancelled) return;
      if (status.state === "building" && Date.now() - started < DEPLOY_CHECK_LIMIT) {
        timer = setTimeout(check, DEPLOY_CHECK_INTERVAL);
      } else {
        setDeploy({ revision: deploy.revision, ...status });
      }
    };
    timer = setTimeout(check, DEPLOY_CHECK_INTERVAL);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [deploy, store]);

  const value = useMemo(
    () => ({ config, pageConfig, layoutConfig, preview, siteUrl, state, account, deploy, reload, publish }),
    [config, pageConfig, layoutConfig, preview, siteUrl, state, account, deploy, reload, publish],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminContextValue {
  const value = useContext(AdminContext);
  if (!value) throw new Error("useAdmin() must be used inside <Admin>.");
  return value;
}

/** The loaded site. Only call from screens rendered once loading has finished. */
export function useSiteContent(): { content: SiteContent; revision: string } {
  const { state } = useAdmin();
  if (state.status !== "ready") throw new Error("The site isn't loaded yet.");
  return state;
}
