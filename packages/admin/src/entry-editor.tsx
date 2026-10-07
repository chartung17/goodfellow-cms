import type { AiFieldHint } from "@goodfellow/ai";
import {
  type Collection,
  type CollectionField,
  type Entry,
  entryTitle,
  findEntry,
  isEmptyValue,
  type SiteContent,
} from "@goodfellow/core";
import { applyEntry, type SiteContextValue, SiteProvider, siteMetadata } from "@goodfellow/react";
import {
  AutoField,
  type Config,
  createUsePuck,
  type Data,
  type Field,
  FieldLabel,
  type Fields,
  legacySideBarPlugin,
  migrate,
  Render,
  resolveAllData,
} from "@puckeditor/core";
import { useEffect, useMemo, useState } from "react";
import { useAdmin, useSiteContent } from "./admin-context.js";
import { entryFileChange, storedEntryFields } from "./changes.js";
import { CollectionLayout, inSentence } from "./collection-screen.js";
import { MarkdownField } from "./markdown-field.js";
import { MediaChooser } from "./media-library.js";
import { PuckEditor, SiteFrame } from "./puck-editor.js";
import { useStrings } from "./strings.js";
import { AppLink } from "./use-link.js";

const usePuck = createUsePuck();
const entryPlugins = [legacySideBarPlugin()];

function Hint({ text }: { text?: string }) {
  return text ? <p className="gfa-puck-hint">{text}</p> : null;
}

/** The Puck field for one of a collection's fields, shown in the editor's sidebar. */
/** What the AI assistant is told a field holds, since it can't tell from a custom field. */
function aiHint(field: CollectionField, markdown: boolean): AiFieldHint {
  const description = field.hint;
  if (markdown) {
    return {
      type: "string",
      description: [description, "Formatted text, written in Markdown"].filter(Boolean).join(". "),
    };
  }
  switch (field.type) {
    case "number":
      return { type: "number", description };
    case "date":
      return { type: "date", description };
    case "select":
      return { type: "choice", options: field.options ?? [], description };
    case "link":
      return {
        type: "string",
        description: [description, "A web address or a page address such as /about"].filter(Boolean).join(". "),
      };
    case "image":
      return {
        type: "string",
        description: [description, "An image address. Leave empty unless one is given"].filter(Boolean).join(". "),
      };
    default:
      return { type: "string", description };
  }
}

function puckField(field: CollectionField, collection: Collection): Field {
  const markdown = collection.settings.markdown?.body === field.name;
  return { ...fieldControl(field, markdown), metadata: { ai: aiHint(field, markdown) } };
}

function fieldControl(field: CollectionField, markdown: boolean): Field {
  const label = field.required ? `${field.label} *` : field.label;
  if (markdown) {
    return {
      type: "custom",
      label,
      render: ({ value, onChange, id }) => (
        <MarkdownField
          id={id}
          label={label}
          hint={field.hint}
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
        />
      ),
    };
  }
  switch (field.type) {
    case "richtext":
      return { type: "richtext", label };
    case "select":
      return {
        type: "custom",
        label,
        render: ({ value, onChange, id }) => (
          <FieldLabel label={label}>
            <AutoField
              id={id}
              field={{ type: "select", options: [{ label: "", value: "" }, ...(field.options ?? [])] }}
              value={value ?? ""}
              onChange={onChange}
            />
            <Hint text={field.hint} />
          </FieldLabel>
        ),
      };
    case "number":
      return {
        type: "custom",
        label,
        render: ({ value, onChange, id }) => (
          <FieldLabel label={label}>
            <AutoField
              id={id}
              field={{ type: "number" }}
              value={value}
              onChange={(next) => onChange(typeof next === "number" && Number.isFinite(next) ? next : undefined)}
            />
            <Hint text={field.hint} />
          </FieldLabel>
        ),
      };
    case "date":
      return {
        type: "custom",
        label,
        render: ({ value, onChange, id }) => (
          <FieldLabel label={label}>
            <input
              id={id}
              type="date"
              className="gfa-puck-input"
              value={typeof value === "string" ? value : ""}
              onChange={(event) => onChange(event.target.value)}
            />
            <Hint text={field.hint} />
          </FieldLabel>
        ),
      };
    default:
      return {
        type: "custom",
        label,
        render: ({ value, onChange, id }) => (
          <FieldLabel label={label}>
            <AutoField
              id={id}
              field={{ type: field.type === "textarea" ? "textarea" : "text" }}
              value={typeof value === "string" ? value : ""}
              onChange={onChange}
            />
            {(field.type === "image" || field.type === "link") && (
              <MediaChooser
                value={typeof value === "string" ? value : ""}
                kind={field.type === "image" ? "image" : "file"}
                onChange={onChange}
              />
            )}
            <Hint text={field.hint} />
          </FieldLabel>
        ),
      };
  }
}

interface PreviewProps {
  collection: Collection;
  entry: Entry;
  content: SiteContent;
  templateConfig: Config;
  layoutConfig: Config;
}

/** The entry's page as it will look, with the values being edited filled into the collection's template. */
function EntryPreview({ collection, entry, content, templateConfig, layoutConfig }: PreviewProps) {
  const t = useStrings();
  const values = usePuck((state) => state.appState.data.root.props) as Record<string, unknown> | undefined;
  const current = useMemo<Entry>(
    () => ({ ...entry, content: { version: 1, fields: storedEntryFields(values ?? {}) } }),
    [entry, values],
  );
  const site = useMemo<SiteContextValue>(
    () => ({
      settings: content.settings,
      menus: content.menus,
      path: entry.path ?? "/",
      collections: content.collections,
      collection,
      entry: current,
    }),
    [content, entry.path, collection, current],
  );
  const metadata = useMemo(() => siteMetadata(site), [site]);
  const applied = useMemo(
    () =>
      applyEntry(
        migrate(collection.settings.template as Data),
        templateConfig,
        collection,
        current,
        content.settings.language,
      ),
    [collection, templateConfig, current, content.settings.language],
  );

  // Blocks such as Entry field fill themselves in with resolveData, as they do when the site is built.
  const [resolved, setResolved] = useState<Data>(applied);
  useEffect(() => {
    let cancelled = false;
    void resolveAllData(applied, templateConfig, metadata).then((data) => {
      if (!cancelled) setResolved(data as Data);
    });
    return () => {
      cancelled = true;
    };
  }, [applied, templateConfig, metadata]);

  if (!collection.settings.path) {
    return (
      <p style={{ maxWidth: "36rem", margin: "4rem auto", padding: "0 1rem", textAlign: "center" }}>
        {t("editEntry.noPage", { name: collection.settings.name })}
      </p>
    );
  }

  const className = (resolved.root.props as Record<string, unknown> | undefined)?.className;
  return (
    <SiteProvider value={site}>
      <SiteFrame
        layoutConfig={layoutConfig}
        header={content.header.data as Data}
        footer={content.footer.data as Data}
        site={site}
        className={typeof className === "string" ? className : undefined}
      >
        <Render config={templateConfig} data={resolved} metadata={metadata} />
      </SiteFrame>
    </SiteProvider>
  );
}

/** The values Puck edits: the entry's stored values, with every field present so Puck shows it. */
function formValues(collection: Collection, entry: Entry): Record<string, unknown> {
  const values: Record<string, unknown> = { ...entry.content.fields };
  for (const field of collection.settings.fields) {
    if (values[field.name] === undefined && field.type !== "number") values[field.name] = "";
  }
  return values;
}

function EntryEditor({ collection, entry }: { collection: Collection; entry: Entry }) {
  const t = useStrings();
  const { config: siteConfig, templateConfig, layoutConfig } = useAdmin();
  const { content } = useSiteContent();
  const { fields } = collection.settings;

  const config = useMemo<Config>(
    () => ({
      components: {},
      root: {
        fields: Object.fromEntries(fields.map((field) => [field.name, puckField(field, collection)])) as Fields,
        render: () => (
          <EntryPreview
            collection={collection}
            entry={entry}
            content={content}
            templateConfig={templateConfig}
            layoutConfig={layoutConfig}
          />
        ),
      },
    }),
    [fields, collection, entry, content, templateConfig, layoutConfig],
  );
  const data = useMemo<Data>(
    () => ({ root: { props: formValues(collection, entry) }, content: [] }),
    [collection, entry],
  );
  const entryName = inSentence(collection.settings.entryName);

  return (
    <PuckEditor
      key={entry.file}
      kind="entry"
      path={entry.path ?? "/"}
      title={entryTitle(entry)}
      data={data}
      collection={collection}
      config={config}
      // Entries have no blocks to add, so instead of the block list the left side has the AI
      // assistant, open at the start. Without it, there's nothing on the left at all.
      ui={
        siteConfig.ai === false
          ? { leftSideBarVisible: false }
          : { leftSideBarVisible: true, plugin: { current: "ai" } }
      }
      plugins={siteConfig.ai === false ? entryPlugins : undefined}
      validate={(next) => {
        const values: Record<string, unknown> = next.root.props ?? {};
        const missing = fields.filter((field) => field.required && isEmptyValue(values[field.name]));
        return missing.length > 0
          ? t("editEntry.required", { fields: missing.map((field) => field.label).join(", ") })
          : undefined;
      }}
      toChanges={(next) => {
        const values = Object.fromEntries(Object.entries(next.root.props ?? {}).filter(([name]) => name !== "id"));
        const title = typeof values.title === "string" && values.title.trim() ? values.title.trim() : entry.slug;
        return {
          changes: [entryFileChange(collection, entry.slug, values)],
          message: t("editEntry.message", { entry: entryName, title }),
        };
      }}
    />
  );
}

export function EntryEditorScreen({ collectionId, slug }: { collectionId: string; slug: string }) {
  const t = useStrings();
  const { content } = useSiteContent();
  const found = findEntry(content, collectionId, slug);
  const collection = content.collections.find((candidate) => candidate.id === collectionId);

  if (!found) {
    return (
      <div className="gfa-screen">
        <p>{t("editEntry.notFound")}</p>
        <AppLink href={collection ? `#/collections/${collection.id}` : "#/collections"}>
          {collection ? t("editEntry.back", { name: collection.settings.name }) : t("collection.back")}
        </AppLink>
      </div>
    );
  }

  return (
    <CollectionLayout collection={found.collection} tab="entries">
      <EntryEditor collection={found.collection} entry={found.entry} />
    </CollectionLayout>
  );
}
