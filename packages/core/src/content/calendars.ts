/**
 * Calendars in a site: the pages a month-at-a-time Calendar block adds, and
 * the calendar files builds write for collections of events.
 */

import { isEventLike, isMonth, monthsAround } from "../calendar.js";
import { absoluteUrl } from "../head.js";
import { type CalendarEvent, calendarFile } from "../ics.js";
import { type Collection, entryTitle, richTextToPlainText } from "./collections.js";
import { allPages, type Page, type SiteContent } from "./load.js";
import { markdownText } from "./markdown.js";

/** The built-in Calendar block's name in a site's blocks, which content refers to it by. */
export const CALENDAR_BLOCK = "Calendar";

/** Where builds put calendar files: `/calendars/<collection>.ics`, and `/calendars/<collection>/<slug>.ics` for each event. */
export const CALENDARS_DIR = "calendars";

/** The most months a calendar gives pages before or after the current one. */
export const MAX_CALENDAR_MONTHS = 36;

/** The address of the calendar file of a collection's events, which visitors subscribe to. */
export function calendarFilePath(collection: string): string {
  return `/${CALENDARS_DIR}/${collection}.ics`;
}

/** The address of one event's calendar file, for adding it to a calendar. */
export function eventFilePath(collection: string, slug: string): string {
  return `/${CALENDARS_DIR}/${collection}/${slug}.ics`;
}

/** How many months a month-at-a-time calendar shows before and after the current one. */
export interface CalendarMonths {
  before: number;
  after: number;
}

function monthCount(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? Math.min(value, MAX_CALENDAR_MONTHS)
    : fallback;
}

/** The months a Calendar block set to a month at a time shows, read from its props. */
export function calendarMonths(props: Record<string, unknown>): CalendarMonths {
  return { before: monthCount(props.monthsBefore, 1), after: monthCount(props.monthsAfter, 12) };
}

/** The first Calendar block in Puck data that shows a month at a time, wherever it is. */
function monthCalendar(value: unknown): CalendarMonths | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = monthCalendar(item);
      if (found) return found;
    }
    return undefined;
  }
  if (!value || typeof value !== "object") return undefined;
  const record = value as { type?: unknown; props?: Record<string, unknown> };
  if (record.type === CALENDAR_BLOCK && record.props?.view === "month") return calendarMonths(record.props);
  for (const child of Object.values(value)) {
    const found = monthCalendar(child);
    if (found) return found;
  }
  return undefined;
}

/** A month page's address: the calendar's page with the month after it. */
export function monthPagePath(path: string, month: string): string {
  return path === "/" ? `/${month}` : `${path}/${month}`;
}

/**
 * Every page a build writes: the site's pages and its entries' pages (see
 * `allPages`), and a page for each month that a month-at-a-time Calendar block
 * shows, around the month `today` is in. A month page never takes an address
 * a page or entry already has.
 */
export function sitePages(content: SiteContent, today: string): Page[] {
  const pages = allPages(content);
  const taken = new Set(pages.map((page) => page.path));
  const months: Page[] = [];
  for (const page of pages) {
    if (page.entry || page.path === "/404") continue;
    const calendar = monthCalendar(page.content.data.content) ?? monthCalendar(page.content.data.zones);
    if (!calendar) continue;
    for (const month of monthsAround(today, calendar.before, calendar.after)) {
      const path = monthPagePath(page.path, month);
      if (taken.has(path)) continue;
      taken.add(path);
      months.push({ ...page, path, month });
    }
  }
  return [...pages, ...months].sort((a, b) => a.path.localeCompare(b.path));
}

/** The page a month page belongs to, and its month, from a month page's address. */
export function splitMonthPath(path: string): { path: string; month: string } | undefined {
  const last = path.slice(path.lastIndexOf("/") + 1);
  if (!isMonth(last)) return undefined;
  const parent = path.slice(0, path.lastIndexOf("/"));
  return { path: parent || "/", month: last };
}

/** The collections that are calendars: ones whose settings name their event field. */
export function calendarCollections(content: Pick<SiteContent, "collections">): Collection[] {
  return content.collections.filter((collection) => collection.settings.calendar);
}

/** A field's value as a calendar's plain text: summaries lose their formatting. */
function plainValue(collection: Collection, field: string | undefined, value: unknown): string | undefined {
  if (!field || typeof value !== "string" || !value.trim()) return undefined;
  if (collection.settings.markdown?.body === field) return markdownText(value);
  const type = collection.settings.fields.find((candidate) => candidate.name === field)?.type;
  return type === "richtext" ? richTextToPlainText(value) : value.trim();
}

/** One of a collection's events, with the entry it's from. */
export interface CollectionEvent extends CalendarEvent {
  slug: string;
}

/** A calendar collection's events, for its calendar files. */
export function collectionEvents(collection: Collection, siteUrl?: string): CollectionEvent[] {
  const calendar = collection.settings.calendar;
  if (!calendar) return [];
  const host = siteUrl ? new URL(siteUrl).hostname : "goodfellow.invalid";
  return collection.entries.flatMap((entry): CollectionEvent[] => {
    const event = entry.content.fields[calendar.when];
    if (!isEventLike(event)) return [];
    const place = plainValue(collection, calendar.place, entry.content.fields[calendar.place ?? ""]);
    const description = plainValue(collection, calendar.summary, entry.content.fields[calendar.summary ?? ""]);
    return [
      {
        slug: entry.slug,
        uid: `${collection.id}-${entry.slug}@${host}`,
        title: entryTitle(entry),
        event,
        ...(place && { place }),
        ...(description && { description }),
        ...(siteUrl && entry.path && { url: absoluteUrl(siteUrl, entry.path) }),
      },
    ];
  });
}

/** A file a build writes, by its address on the site. */
export interface BuildFile {
  path: string;
  content: string;
}

/**
 * The calendar files a build writes: one for each calendar collection, which
 * visitors subscribe to, and one for each of its events, which visitors add to
 * their calendars.
 */
export function calendarFiles(content: SiteContent, now = new Date()): BuildFile[] {
  const { settings } = content;
  const options = { timeZone: settings.timeZone, now };
  return calendarCollections(content).flatMap((collection) => {
    const events = collectionEvents(collection, settings.url);
    const name = `${collection.settings.name} – ${settings.title}`;
    return [
      { path: calendarFilePath(collection.id), content: calendarFile(events, { ...options, name }) },
      ...events.map(({ slug, ...event }) => ({
        path: eventFilePath(collection.id, slug),
        content: calendarFile([event], { ...options, name: event.title }),
      })),
    ];
  });
}
