import {
  ConflictError,
  type ContentStore,
  type FileChange,
  type GoodfellowConfig,
  loadSiteContent,
  type SiteContent,
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

interface AdminContextValue {
  config: GoodfellowConfig;
  pageConfig: Config;
  layoutConfig: Config;
  preview: PreviewOptions;
  siteUrl: string;
  state: LoadState;
  reload(): Promise<void>;
  /** Saves changes as one commit, then reloads the site's content. */
  publish(changes: FileChange[], message: string): Promise<PublishResult>;
}

const AdminContext = createContext<AdminContextValue | null>(null);

async function load(store: ContentStore): Promise<LoadState> {
  try {
    // Read the revision first: if files change while loading, the next save fails safely instead of overwriting them.
    const revision = await store.revision();
    const content = await loadSiteContent(store);
    return { status: "ready", content, revision };
  } catch (error) {
    return { status: "error", error };
  }
}

export function AdminProvider({
  config,
  store,
  preview,
  siteUrl,
  children,
}: {
  config: GoodfellowConfig;
  store: ContentStore;
  preview: PreviewOptions;
  siteUrl: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const pageConfig = useMemo(() => createPuckConfig(config, "page"), [config]);
  const layoutConfig = useMemo(() => createPuckConfig(config, "layout"), [config]);

  const reload = useCallback(async () => {
    setState(await load(store));
  }, [store]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const publish = useCallback(
    async (changes: FileChange[], message: string): Promise<PublishResult> => {
      if (state.status !== "ready") return { ok: false, reason: "error", error: new Error("The site isn't loaded.") };
      try {
        await store.write(changes, { message, expectedRevision: state.revision });
      } catch (error) {
        return { ok: false, reason: error instanceof ConflictError ? "conflict" : "error", error };
      }
      setState(await load(store));
      return { ok: true };
    },
    [store, state],
  );

  const value = useMemo(
    () => ({ config, pageConfig, layoutConfig, preview, siteUrl, state, reload, publish }),
    [config, pageConfig, layoutConfig, preview, siteUrl, state, reload, publish],
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
