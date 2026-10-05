import { ContentError, type ContentStore, type GoodfellowConfig } from "@goodfellow/core";
import { createRoot } from "react-dom/client";
import { AdminProvider, type PreviewOptions, useAdmin } from "./admin-context.js";
import { LayoutEditorScreen, PageEditorScreen } from "./editor-screens.js";
import { PagesScreen } from "./pages-screen.js";
import { useRoute } from "./router.js";
import { SETTINGS_TABS, SettingsScreen, type SettingsTab } from "./settings-screen.js";
import { type Strings, StringsProvider, useStrings } from "./strings.js";
import { Button, ErrorMessage } from "./ui.js";
import { AppLink } from "./use-link.js";

export interface AdminProps {
  /** The site's `goodfellow.config.tsx`. */
  config: GoodfellowConfig;
  /** Where the site's files are read from and published to. */
  store: ContentStore;
  preview: PreviewOptions;
  /** The live site's address, for "View" links. Defaults to `/`. */
  siteUrl?: string;
  /** Replaces any of the admin panel's text, for rewording or translation. */
  strings?: Partial<Strings>;
}

function LoadError({ error }: { error: unknown }) {
  const t = useStrings();
  const { reload } = useAdmin();
  const details =
    error instanceof ContentError ? new Error(error.problems.map((p) => `${p.file}: ${p.message}`).join("\n")) : error;
  return (
    <div className="gfa-screen">
      <h1>{t("loadError.title")}</h1>
      <ErrorMessage
        message={t(error instanceof ContentError ? "loadError.contentProblems" : "loadError.other")}
        error={details}
        action={<Button onClick={() => void reload()}>{t("action.tryAgain")}</Button>}
      />
    </div>
  );
}

function Screen() {
  const { segments, params } = useRoute();
  const [section, sub] = segments;

  if (section === "pages" && sub === "edit") return <PageEditorScreen path={params.get("path") ?? "/"} />;
  if (section === "layout") return <LayoutEditorScreen part={sub === "footer" ? "footer" : "header"} />;
  if (section === "settings") {
    const tab = SETTINGS_TABS.includes(sub as SettingsTab) ? (sub as SettingsTab) : "general";
    return <SettingsScreen tab={tab} />;
  }
  return <PagesScreen />;
}

function Shell() {
  const t = useStrings();
  const { state, siteUrl } = useAdmin();
  const [section] = useRoute().segments;
  const current = section === "layout" || section === "settings" ? section : "pages";

  return (
    <div className="gfa-app">
      <header className="gfa-topbar">
        <span className="gfa-brand">{state.status === "ready" ? state.content.settings.title : t("app.title")}</span>
        <nav className="gfa-nav" aria-label={t("app.title")}>
          <AppLink href="#/pages" aria-current={current === "pages" ? "page" : undefined}>
            {t("nav.pages")}
          </AppLink>
          <AppLink href="#/layout/header" aria-current={current === "layout" ? "page" : undefined}>
            {t("nav.layout")}
          </AppLink>
          <AppLink href="#/settings/general" aria-current={current === "settings" ? "page" : undefined}>
            {t("nav.settings")}
          </AppLink>
        </nav>
        <a className="gfa-topbar-link" href={siteUrl} target="_blank" rel="noreferrer">
          {t("app.viewSite")}
        </a>
      </header>
      <main className="gfa-content">
        {state.status === "loading" && <p className="gfa-screen">{t("loading")}</p>}
        {state.status === "error" && <LoadError error={state.error} />}
        {state.status === "ready" && <Screen />}
      </main>
    </div>
  );
}

/** The admin panel. Render it on its own page, such as `/admin`. */
export function Admin({ config, store, preview, siteUrl = "/", strings }: AdminProps) {
  return (
    <StringsProvider strings={strings}>
      <AdminProvider config={config} store={store} preview={preview} siteUrl={siteUrl}>
        <Shell />
      </AdminProvider>
    </StringsProvider>
  );
}

/** Renders the admin panel into an element. */
export function mountAdmin(element: Element, props: AdminProps): void {
  createRoot(element).render(<Admin {...props} />);
}
