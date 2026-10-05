import {
  DEFAULT_THEME_COLORS,
  type FileChange,
  type Menus,
  menusFileSchema,
  type SiteSettings,
  serializeContent,
  siteSettingsSchema,
  THEME_COLORS,
  type ThemeColor,
} from "@goodfellow/core";
import { PageBody, type SiteContextValue } from "@goodfellow/react";
import type { Data } from "@puckeditor/core";
import { useMemo, useState } from "react";
import { useAdmin, useSiteContent } from "./admin-context.js";
import { customCssFileChange, menusFileChange, siteSettingsFileChange, storedCss } from "./changes.js";
import { MenusEditor } from "./menus-editor.js";
import { PreviewFrame } from "./preview.js";
import { useUnsavedChanges } from "./router.js";
import { type StringKey, useStrings } from "./strings.js";
import { Button, ErrorMessage, Field, TextField } from "./ui.js";

export type SettingsTab = "general" | "theme" | "menus" | "css";
export const SETTINGS_TABS: SettingsTab[] = ["general", "theme", "menus", "css"];

const tabLabels: Record<SettingsTab, StringKey> = {
  general: "settings.tab.general",
  theme: "settings.tab.theme",
  menus: "settings.tab.menus",
  css: "settings.tab.css",
};

/** Turns the form's values into settings: empty optional fields are left out rather than saved as "". */
function cleanSettings(draft: SiteSettings): unknown {
  const optional = (value: string | undefined) => (value?.trim() ? value.trim() : undefined);
  const colors = Object.fromEntries(Object.entries(draft.theme.colors).filter(([, value]) => value?.trim()));
  return {
    ...draft,
    url: optional(draft.url),
    favicon: optional(draft.favicon),
    socialImage: optional(draft.socialImage),
    logo: draft.logo?.src.trim() ? { src: draft.logo.src.trim(), alt: draft.logo.alt } : undefined,
    theme: {
      colors,
      fonts: { heading: optional(draft.theme.fonts.heading), body: optional(draft.theme.fonts.body) },
      radius: optional(draft.theme.radius),
    },
  };
}

/** Validation problems keyed by field path, such as `theme.colors.primary`. */
function validate(draft: SiteSettings): { settings?: SiteSettings; errors: Record<string, string> } {
  const result = siteSettingsSchema.safeParse(cleanSettings(draft));
  if (result.success) return { settings: result.data, errors: {} };
  return { errors: Object.fromEntries(result.error.issues.map((issue) => [issue.path.join("."), issue.message])) };
}

function GeneralTab({
  draft,
  errors,
  onChange,
}: {
  draft: SiteSettings;
  errors: Record<string, string>;
  onChange: (draft: SiteSettings) => void;
}) {
  const t = useStrings();
  const text = (key: "title" | "description" | "url" | "language" | "titleTemplate" | "favicon" | "socialImage") => ({
    value: draft[key] ?? "",
    error: errors[key],
    onChange: (value: string) => onChange({ ...draft, [key]: value }),
  });
  return (
    <div className="gfa-form">
      <TextField label={t("general.siteTitle")} {...text("title")} />
      <TextField label={t("general.description")} hint={t("general.descriptionHint")} {...text("description")} />
      <TextField
        label={t("general.url")}
        hint={t("general.urlHint")}
        type="url"
        placeholder="https://"
        {...text("url")}
      />
      <TextField label={t("general.titleTemplate")} hint={t("general.titleTemplateHint")} {...text("titleTemplate")} />
      <TextField label={t("general.language")} hint={t("general.languageHint")} {...text("language")} />
      <TextField
        label={t("general.logo")}
        value={draft.logo?.src ?? ""}
        error={errors["logo.src"]}
        onChange={(src) => onChange({ ...draft, logo: { alt: draft.logo?.alt ?? "", src } })}
      />
      <TextField
        label={t("general.logoAlt")}
        value={draft.logo?.alt ?? ""}
        onChange={(alt) => onChange({ ...draft, logo: { src: draft.logo?.src ?? "", alt } })}
      />
      <TextField label={t("general.favicon")} {...text("favicon")} />
      <TextField label={t("general.socialImage")} {...text("socialImage")} />
    </div>
  );
}

const HEX = /^#[0-9a-f]{6}$/i;

function ThemeTab({
  draft,
  errors,
  onChange,
}: {
  draft: SiteSettings;
  errors: Record<string, string>;
  onChange: (draft: SiteSettings) => void;
}) {
  const t = useStrings();
  const { theme } = draft;
  const setColor = (name: ThemeColor, value: string) =>
    onChange({ ...draft, theme: { ...theme, colors: { ...theme.colors, [name]: value } } });

  return (
    <div className="gfa-form">
      <h2 className="gfa-section-title">{t("theme.colors")}</h2>
      <div className="gfa-color-grid">
        {THEME_COLORS.map((name) => {
          const value = theme.colors[name] ?? "";
          const shown = value || DEFAULT_THEME_COLORS[name];
          return (
            <Field key={name} label={t(`theme.color.${name}` as StringKey)} error={errors[`theme.colors.${name}`]}>
              {(props) => (
                <div className="gfa-color-input">
                  <input
                    type="color"
                    aria-label={t("theme.pickColor", { name: t(`theme.color.${name}` as StringKey) })}
                    value={HEX.test(shown) ? shown : "#000000"}
                    onChange={(event) => setColor(name, event.target.value)}
                  />
                  <input
                    {...props}
                    className="gfa-input"
                    value={value}
                    placeholder={`${t("theme.default")}: ${DEFAULT_THEME_COLORS[name]}`}
                    onChange={(event) => setColor(name, event.target.value)}
                  />
                </div>
              )}
            </Field>
          );
        })}
      </div>

      <h2 className="gfa-section-title">{t("theme.fonts")}</h2>
      <p className="gfa-hint">{t("theme.fontsHint")}</p>
      <TextField
        label={t("theme.headingFont")}
        value={theme.fonts.heading ?? ""}
        error={errors["theme.fonts.heading"]}
        onChange={(heading) => onChange({ ...draft, theme: { ...theme, fonts: { ...theme.fonts, heading } } })}
      />
      <TextField
        label={t("theme.bodyFont")}
        value={theme.fonts.body ?? ""}
        error={errors["theme.fonts.body"]}
        onChange={(body) => onChange({ ...draft, theme: { ...theme, fonts: { ...theme.fonts, body } } })}
      />
      <TextField
        label={t("theme.radius")}
        hint={t("theme.radiusHint")}
        value={theme.radius ?? ""}
        error={errors["theme.radius"]}
        onChange={(radius) => onChange({ ...draft, theme: { ...theme, radius } })}
      />
    </div>
  );
}

function CssTab({ css, onChange }: { css: string; onChange: (css: string) => void }) {
  const t = useStrings();
  return (
    <div className="gfa-form">
      <p className="gfa-hint">{t("css.intro")}</p>
      <Field label={t("css.label")}>
        {(props) => (
          <textarea
            {...props}
            className="gfa-input gfa-code"
            spellCheck={false}
            rows={24}
            value={css}
            onChange={(event) => onChange(event.target.value)}
          />
        )}
      </Field>
    </div>
  );
}

/** Site settings, theme, menus and custom CSS, with a live preview of the home page. Publishing saves every changed file in one go. */
export function SettingsScreen({ tab }: { tab: SettingsTab }) {
  const t = useStrings();
  const { pageConfig, layoutConfig, publish, reload } = useAdmin();
  const { content } = useSiteContent();
  const [settings, setSettings] = useState<SiteSettings>(content.settings);
  const [menus, setMenus] = useState<Menus>(content.menus);
  const [css, setCss] = useState(content.customCss);
  const [showErrors, setShowErrors] = useState(false);
  const [status, setStatus] = useState<
    | { type: "idle" | "publishing" | "done" | "invalid" }
    | { type: "failed"; reason: "conflict" | "error"; error: unknown }
  >({ type: "idle" });

  const validation = useMemo(() => validate(settings), [settings]);
  const changes = useMemo(() => {
    const result: FileChange[] = [];
    if (validation.settings && serializeContent(validation.settings) !== serializeContent(content.settings)) {
      result.push(siteSettingsFileChange(validation.settings));
    }
    if (serializeContent(menus) !== serializeContent(content.menus)) result.push(menusFileChange(menus));
    if (storedCss(css) !== storedCss(content.customCss)) result.push(customCssFileChange(css));
    return result;
  }, [validation, menus, css, content]);

  const dirty = changes.length > 0 || !validation.settings;
  useUnsavedChanges(dirty);

  const onPublish = async () => {
    setShowErrors(true);
    if (!validation.settings || !menusFileSchema.safeParse({ version: 1, menus }).success) {
      setStatus({ type: "invalid" });
      return;
    }
    if (changes.length === 0) return;
    setStatus({ type: "publishing" });
    const result = await publish(changes, t("settings.message"));
    setStatus(result.ok ? { type: "done" } : { type: "failed", reason: result.reason, error: result.error });
  };

  // The preview shows unpublished changes as they're made.
  const previewSettings = validation.settings ?? content.settings;
  const previewSite = useMemo<SiteContextValue>(
    () => ({ settings: previewSettings, menus, path: "/", collections: content.collections }),
    [previewSettings, menus, content.collections],
  );
  const previewStyles = useMemo(() => ({ theme: previewSettings.theme, customCss: css }), [previewSettings, css]);
  const home = content.pages.find((page) => page.path === "/");
  const errors = showErrors ? validation.errors : {};

  return (
    <div className="gfa-split">
      <div className="gfa-split-main">
        <div className="gfa-screen-header">
          <h1>{t("settings.title")}</h1>
          <Button variant="primary" disabled={status.type === "publishing" || !dirty} onClick={() => void onPublish()}>
            {status.type === "publishing" ? t("publish.publishing") : t("publish.button")}
          </Button>
        </div>
        {status.type === "done" && !dirty && (
          <p className="gfa-notice gfa-notice-success" role="status">
            {t("publish.done")}
          </p>
        )}
        {status.type === "invalid" && <ErrorMessage message={t("publish.invalid")} />}
        {status.type === "failed" && (
          <ErrorMessage
            message={t(status.reason === "conflict" ? "publish.conflict" : "publish.error")}
            error={status.error}
            action={
              status.reason === "conflict" ? (
                <Button onClick={() => void reload()}>{t("action.reload")}</Button>
              ) : undefined
            }
          />
        )}

        <nav className="gfa-tabs" aria-label={t("settings.title")}>
          {SETTINGS_TABS.map((name) => (
            // Switching tabs keeps unpublished changes, so it doesn't need the leave confirmation.
            <a
              key={name}
              href={`#/settings/${name}`}
              className="gfa-tab"
              aria-current={name === tab ? "page" : undefined}
            >
              {t(tabLabels[name])}
            </a>
          ))}
        </nav>

        {tab === "general" && <GeneralTab draft={settings} errors={errors} onChange={setSettings} />}
        {tab === "theme" && <ThemeTab draft={settings} errors={errors} onChange={setSettings} />}
        {tab === "menus" && <MenusEditor menus={menus} onChange={setMenus} />}
        {tab === "css" && <CssTab css={css} onChange={setCss} />}
      </div>

      <section className="gfa-split-preview" aria-label={t("settings.preview")}>
        <h2 className="gfa-visually-hidden">{t("settings.preview")}</h2>
        {home ? (
          <PreviewFrame title={t("settings.preview")} styles={previewStyles}>
            <PageBody
              site={previewSite}
              pageConfig={pageConfig}
              layoutConfig={layoutConfig}
              page={home.content.data as Data}
              header={content.header.data as Data}
              footer={content.footer.data as Data}
            />
          </PreviewFrame>
        ) : (
          <p className="gfa-hint">{t("settings.previewEmpty")}</p>
        )}
      </section>
    </div>
  );
}
