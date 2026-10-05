import { type Collection, type FileChange, serializeContent } from "@goodfellow/core";
import { cx, type SiteContextValue, SiteProvider, siteMetadata } from "@goodfellow/react";
import { type Config, type Data, migrate, type Plugin, Puck, Render, type UiState } from "@puckeditor/core";
import { type ReactNode, useMemo, useRef, useState } from "react";
import { useAdmin, useSiteContent } from "./admin-context.js";
import { storedData } from "./changes.js";
import { usePreviewStyles } from "./preview.js";
import { useUnsavedChanges } from "./router.js";
import { useStrings } from "./strings.js";
import { Button, ErrorMessage } from "./ui.js";

/** Pages and templates are shown between the header and footer; entries supply their own `config`. */
export type EditorKind = "page" | "header" | "footer" | "template" | "entry";

function Iframe({ children, document, site }: { children: ReactNode; document?: Document; site: SiteContextValue }) {
  const { content } = useSiteContent();
  const styles = useMemo(
    () => ({ theme: site.settings.theme, customCss: content.customCss }),
    [site, content.customCss],
  );
  usePreviewStyles(document, styles);
  return <>{children}</>;
}

/** The site's header and footer, read-only, around a page's content, the way the live site shows them. */
export function SiteFrame({
  layoutConfig,
  header,
  footer,
  site,
  className,
  children,
}: {
  layoutConfig: Config;
  header: Data;
  footer: Data;
  site: SiteContextValue;
  className?: string;
  children: ReactNode;
}) {
  const metadata = siteMetadata(site);
  return (
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
  );
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
  const render =
    kind === "page" || kind === "template"
      ? ({ children, className }: { children?: ReactNode; className?: string }) => (
          <SiteFrame layoutConfig={layoutConfig} header={header} footer={footer} site={site} className={className}>
            {children}
          </SiteFrame>
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
  /** The collection whose template or entry is being edited. */
  collection?: Collection;
  /** Replaces the Puck config `kind` would choose. */
  config?: Config;
  /** Returns why `data` can't be published yet, as text to show, or `undefined` if it can. */
  validate?: (data: Data) => string | undefined;
  /** The changes that publish `data`, and the save's description. */
  toChanges: (data: Data) => { changes: FileChange[]; message: string };
  actions?: ReactNode;
  /** Shown above the editor, such as help for the screen. */
  notice?: ReactNode;
  ui?: Partial<UiState>;
  plugins?: Plugin[];
}

/** Puck, set up for one page, header, footer, template or entry: site context, live preview styles and publishing. */
export function PuckEditor({
  kind,
  path,
  title,
  data,
  collection,
  config: customConfig,
  validate,
  toChanges,
  actions,
  notice,
  ui,
  plugins,
}: PuckEditorProps) {
  const t = useStrings();
  const { pageConfig, layoutConfig, templateConfig, publish, reload } = useAdmin();
  const { content } = useSiteContent();
  const [status, setStatus] = useState<
    | { type: "idle" | "publishing" | "done" }
    | { type: "invalid"; message: string }
    | { type: "failed"; reason: "conflict" | "error"; error: unknown }
  >({ type: "idle" });

  const site = useMemo<SiteContextValue>(
    () => ({ settings: content.settings, menus: content.menus, path, collections: content.collections, collection }),
    [content, path, collection],
  );
  const config = useMemo(
    () =>
      customConfig ??
      editorConfig(
        kind,
        kind === "page" ? pageConfig : kind === "template" ? templateConfig : layoutConfig,
        layoutConfig,
        content.header.data as Data,
        content.footer.data as Data,
        site,
      ),
    [customConfig, kind, pageConfig, templateConfig, layoutConfig, content, site],
  );

  // Puck works with current data; files saved by older versions of Puck are upgraded first.
  const initialData = useMemo(() => migrate(data), [data]);
  const published = useRef(serializeContent(storedData(initialData)));
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty);

  const onPublish = async (next: Data) => {
    const problem = validate?.(next);
    if (problem) {
      setStatus({ type: "invalid", message: problem });
      return;
    }
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
      {notice && <div className="gfa-editor-notice">{notice}</div>}
      {status.type !== "idle" && (
        <div className="gfa-editor-status">
          {status.type === "publishing" && <p className="gfa-notice">{t("publish.publishing")}</p>}
          {status.type === "done" && (
            <p className="gfa-notice gfa-notice-success" role="status">
              {t("publish.done")}
            </p>
          )}
          {status.type === "invalid" && (
            <ErrorMessage
              message={status.message}
              action={<Button onClick={() => setStatus({ type: "idle" })}>{t("action.close")}</Button>}
            />
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
      <div className="gfa-editor-puck">
        <SiteProvider value={site}>
          <Puck
            config={config}
            data={initialData}
            metadata={siteMetadata(site)}
            headerTitle={title}
            headerPath={kind === "page" || kind === "entry" ? path : undefined}
            height="100%"
            iframe={{ syncHostStyles: false }}
            ui={ui}
            plugins={plugins}
            overrides={overrides}
            onChange={(next) => setDirty(serializeContent(storedData(next)) !== published.current)}
            onPublish={onPublish}
          />
        </SiteProvider>
      </div>
    </div>
  );
}
