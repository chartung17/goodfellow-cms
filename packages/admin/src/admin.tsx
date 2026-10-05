import { ContentError, type ContentStore, type GitHost, type GoodfellowConfig } from "@goodfellow/core";
import { createRoot } from "react-dom/client";
import { AdminProvider, type PreviewOptions, useAdmin } from "./admin-context.js";
import { LayoutEditorScreen, PageEditorScreen } from "./editor-screens.js";
import { PagesScreen } from "./pages-screen.js";
import { useRoute } from "./router.js";
import { SETTINGS_TABS, SettingsScreen, type SettingsTab } from "./settings-screen.js";
import { SignInGate } from "./sign-in.js";
import { type Strings, StringsProvider, useStrings } from "./strings.js";
import { Button, ErrorMessage } from "./ui.js";
import { AppLink } from "./use-link.js";

export interface AdminProps {
  /** The site's `goodfellow.config.tsx`. */
  config: GoodfellowConfig;
  /**
   * Where the site's files are read from and published to, without signing in.
   * Used by `goodfellow dev`. Otherwise the admin panel signs in to `host`.
   */
  store?: ContentStore;
  /** The git host the site is stored on. Defaults to the config's `backend`. */
  host?: GitHost;
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

function DeployIndicator() {
  const t = useStrings();
  const { deploy } = useAdmin();
  if (!deploy || deploy.state === "unknown") return null;
  return (
    <span className={`gfa-deploy gfa-deploy-${deploy.state}`} role="status">
      {t(deploy.state === "building" ? "deploy.building" : deploy.state === "live" ? "deploy.live" : "deploy.failed")}
      {deploy.state === "failed" && deploy.detailsUrl && (
        <>
          {" "}
          <a href={deploy.detailsUrl} target="_blank" rel="noreferrer">
            {t("deploy.details")}
          </a>
        </>
      )}
    </span>
  );
}

function AccountMenu() {
  const t = useStrings();
  const { account } = useAdmin();
  if (!account) return null;
  const { user } = account;
  return (
    <div className="gfa-account">
      {user.avatarUrl && <img src={user.avatarUrl} alt="" width={24} height={24} />}
      <span title={t("account.signedInAs", { name: user.login })}>{user.name || user.login}</span>
      <Button variant="ghost" onClick={account.signOut}>
        {t("account.signOut")}
      </Button>
    </div>
  );
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
        <DeployIndicator />
        <a className="gfa-topbar-link" href={siteUrl} target="_blank" rel="noreferrer">
          {t("app.viewSite")}
        </a>
        <AccountMenu />
      </header>
      <main className="gfa-content">
        {state.status === "loading" && <p className="gfa-screen">{t("loading")}</p>}
        {state.status === "error" && <LoadError error={state.error} />}
        {state.status === "ready" && <Screen />}
      </main>
    </div>
  );
}

function MissingBackend() {
  const t = useStrings();
  return (
    <div className="gfa-screen">
      <ErrorMessage message={t("setup.noBackend")} />
    </div>
  );
}

/** The admin panel. Render it on its own page, such as `/admin`. */
export function Admin({ config, store, host = config.backend, preview, siteUrl = "/", strings }: AdminProps) {
  const body = store ? (
    <AdminProvider config={config} store={store} preview={preview} siteUrl={siteUrl}>
      <Shell />
    </AdminProvider>
  ) : host ? (
    <SignInGate host={host}>
      {(backend, signOut) => (
        <AdminProvider
          config={config}
          store={backend}
          account={{ user: backend.user, hostName: host.name, signOut: () => signOut() }}
          preview={preview}
          siteUrl={siteUrl}
          onSignInError={(error) => signOut(error)}
        >
          <Shell />
        </AdminProvider>
      )}
    </SignInGate>
  ) : (
    <MissingBackend />
  );
  return <StringsProvider strings={strings}>{body}</StringsProvider>;
}

/** Renders the admin panel into an element. */
export function mountAdmin(element: Element, props: AdminProps): void {
  createRoot(element).render(<Admin {...props} />);
}
