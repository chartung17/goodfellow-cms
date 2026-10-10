import { type Collection, type Entry, formatFieldValue } from "@goodfellow-cms/core";
import type { ComponentData, Config, Data, Fields } from "@puckeditor/core";

/** `{title}`, `{event-date}`: a field's name in braces. */
const PLACEHOLDER = /\{([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\}/g;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type Values = Map<string, string>;

function fillText(text: string, values: Values, html: boolean): string {
  return text.replace(PLACEHOLDER, (match, name: string) => {
    const value = values.get(name);
    if (value === undefined) return match;
    return html ? escapeHtml(value) : value;
  });
}

function fillValue(value: unknown, values: Values): unknown {
  if (typeof value === "string") return fillText(value, values, false);
  if (Array.isArray(value)) return value.map((item) => fillValue(item, values));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, fillValue(item, values)]));
  }
  return value;
}

function fillProps(
  props: Record<string, unknown>,
  fields: Fields | undefined,
  values: Values,
  config: Config,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(props).map(([key, value]) => {
      if (key === "id") return [key, value];
      const type = fields?.[key]?.type;
      if (type === "slot" && Array.isArray(value)) {
        return [key, value.map((child) => fillComponent(child as ComponentData, values, config))];
      }
      if (type === "richtext" && typeof value === "string") return [key, fillText(value, values, true)];
      return [key, fillValue(value, values)];
    }),
  );
}

function fillComponent(component: ComponentData, values: Values, config: Config): ComponentData {
  const fields = config.components[component.type]?.fields as Fields | undefined;
  return { ...component, props: fillProps(component.props, fields, values, config) as ComponentData["props"] };
}

/** Each field's value as it appears in place of its placeholder. */
export function placeholderValues(collection: Collection, entry: Entry, language: string, timeZone?: string): Values {
  return new Map(
    collection.settings.fields.map((field) => [
      field.name,
      formatFieldValue(field, entry.content.fields[field.name], language, timeZone),
    ]),
  );
}

/**
 * Fills an entry's values into its collection's template. Wherever the
 * template's text says `{name}` for one of the collection's fields, such as
 * `{title}` in a heading or `{video}` in a link, the entry's value goes in its
 * place. Values are plain text, escaped where the text is rich text. Text in
 * braces that isn't a field name is left as it is.
 */
export function applyEntry(
  data: Data,
  config: Config,
  collection: Collection,
  entry: Entry,
  language = "en",
  timeZone?: string,
): Data {
  const values = placeholderValues(collection, entry, language, timeZone);
  const rootFields = config.root?.fields as Fields | undefined;
  return {
    ...data,
    root: { ...data.root, props: fillProps(data.root.props ?? {}, rootFields, values, config) },
    content: data.content.map((component) => fillComponent(component, values, config)),
    ...(data.zones && {
      zones: Object.fromEntries(
        Object.entries(data.zones).map(([zone, content]) => [
          zone,
          content.map((component) => fillComponent(component, values, config)),
        ]),
      ),
    }),
  };
}
