import { type FileChange, serializeContent } from "@goodfellow/core";
import { cx, type SiteContextValue, SiteProvider, siteMetadata } from "@goodfellow/react";
import { type Config, type Data, migrate, Puck, Render } from "@puckeditor/core";
import { type ReactNode, useMemo, useRef, useState } from "react";
import { useAdmin, useSiteContent } from "./admin-context.js";
import { storedData } from "./changes.js";
import { usePreviewStyles } from "./preview.js";
import { useUnsavedChanges } from "./router.js";
import { useStrings } from "./strings.js";
import { Button, ErrorMessage } from "./ui.js";

export type EditorKind = "page" | "header" | "footer";

function Iframe({ children, document, site }: { children: ReactNode; document?: Document; site: SiteContextValue }) {
  const { content } = useSiteContent();
  const styles = useMemo(
    () => ({ theme: site.settings.theme, customCss: content.customCss }),
    [site, content.customCss],
  );
  usePreviewStyles(document, styles);
  return <>{children}</>;
}

/**
 * Wraps the editor's canvas the way the live site wraps it, so custom CSS
 * targeting `.gf-header`, `.gf-main` or `.gf-footer` previews correctly. Pages
 * also show the site's header and footer, read-only, for context.
 */
function editorConfig(
  kind: EditorKind,
  config: Config,
  layoutConfig: Config,
  header: Data,
  footer: Data,
  site: SiteContextValue,
): Config {
  const metadata = siteMetadata(site);
  const render =
    kind === "page"
      ? ({ children, className }: { children?: ReactNode; className?: string }) => (
          <>
            {header.content.length > 0 && (
              <header className="gf-header" inert>
                <Render config={layoutConfig} data={header} metadata={metadata} />
              </header>
            )}
            <main className={cx("gf-main", className)}>{children}</main>
            {footer.content.length > 0 && (
              <footer className="gf-footer" inert>
                <Render config={layoutConfig} data={footer} metadata={metadata} />
              </footer>
            )}
          </>
        )
      : ({ children }: { children?: ReactNode }) =>
          kind === "header" ? (
            <header className="gf-header">{children}</header>
          ) : (
            <footer className="gf-footer">{children}</footer>
          );

  return { ...config, root: { ...config.root, render } } as Config;
}

export interface PuckEditorProps {
  kind: EditorKind;
  /** The page's address, or `/` for the header and footer (for menus that highlight the current page). */
  path: string;
  title: string;
  data: Data;
  /** The changes that publish `data`, and the save's description. */
  toChanges: (data: Data) => { changes: FileChange[]; message: string };
  actions?: ReactNode;
}

/** Puck, set up for one page, header or footer: site context, live preview styles and publishing. */
export function PuckEditor({ kind, path, title, data, toChanges, actions }: PuckEditorProps) {
  const t = useStrings();
  const { pageConfig, layoutConfig, publish, reload } = useAdmin();
  const { content } = useSiteContent();
  const [status, setStatus] = useState<
    { type: "idle" | "publishing" | "done" } | { type: "failed"; reason: "conflict" | "error"; error: unknown }
  >({ type: "idle" });

  const site = useMemo<SiteContextValue>(
    () => ({ settings: content.settings, menus: content.menus, path }),
    [content, path],
  );
  const config = useMemo(
    () =>
      editorConfig(
        kind,
        kind === "page" ? pageConfig : layoutConfig,
        layoutConfig,
        content.header.data as Data,
        content.footer.data as Data,
        site,
      ),
    [kind, pageConfig, layoutConfig, content, site],
  );

  // Puck works with current data; files saved by older versions of Puck are upgraded first.
  const initialData = useMemo(() => migrate(data), [data]);
  const published = useRef(serializeContent(storedData(initialData)));
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty);

  const onPublish = async (next: Data) => {
    setStatus({ type: "publishing" });
    const { changes, message } = toChanges(next);
    const result = await publish(changes, message);
    if (result.ok) {
      published.current = serializeContent(storedData(next));
      setDirty(false);
      setStatus({ type: "done" });
    } else {
      setStatus({ type: "failed", reason: result.reason, error: result.error });
    }
  };

  const overrides = useMemo(
    () => ({
      iframe: ({ children, document }: { children: ReactNode; document?: Document }) => (
        <Iframe document={document} site={site}>
          {children}
        </Iframe>
      ),
      headerActions: ({ children }: { children: ReactNode }) => (
        <>
          {actions}
          {children}
        </>
      ),
    }),
    [site, actions],
  );

  return (
    <div className="gfa-editor">
      {status.type !== "idle" && (
        <div className="gfa-editor-status">
          {status.type === "publishing" && <p className="gfa-notice">{t("publish.publishing")}</p>}
          {status.type === "done" && (
            <p className="gfa-notice gfa-notice-success" role="status">
              {t("publish.done")}
            </p>
          )}
          {status.type === "failed" && (
            <ErrorMessage
              message={t(status.reason === "conflict" ? "publish.conflict" : "publish.error")}
              error={status.error}
              action={
                status.reason === "conflict" ? (
                  <Button onClick={() => void reload()}>{t("action.reload")}</Button>
                ) : (
                  <Button onClick={() => setStatus({ type: "idle" })}>{t("action.close")}</Button>
                )
              }
            />
          )}
        </div>
      )}
      <SiteProvider value={site}>
        <Puck
          config={config}
          data={initialData}
          metadata={siteMetadata(site)}
          headerTitle={title}
          headerPath={kind === "page" ? path : undefined}
          height="100%"
          iframe={{ syncHostStyles: false }}
          overrides={overrides}
          onChange={(next) => setDirty(serializeContent(storedData(next)) !== published.current)}
          onPublish={onPublish}
        />
      </SiteProvider>
    </div>
  );
}
