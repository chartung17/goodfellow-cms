/**
 * Calendar files (iCalendar, `.ics`): writing a site's events for visitors to
 * subscribe to or add to their calendars, and reading a calendar kept
 * elsewhere, such as a public Google Calendar, when the site is built.
 */

import {
  addDays,
  datePart,
  type EventRepeat,
  type EventValue,
  formatWallClock,
  isAllDay,
  isTimeZone,
  type Occurrence,
  occurrences,
  WEEKDAYS,
  type Weekday,
  wallClock,
  zonedInstant,
  zonedTime,
  zoneOffset,
} from "./calendar.js";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

// Writing ---------------------------------------------------------------------

/** One of the site's events, for a calendar file. */
export interface CalendarEvent {
  /** Stays the same for as long as the event exists, so calendars update it rather than add it again. */
  uid: string;
  title: string;
  event: EventValue;
  place?: string;
  description?: string;
  /** Its page on the site, as a full address. */
  url?: string;
}

export interface CalendarFileOptions {
  /** The calendar's name, as calendar apps show it. */
  name: string;
  /** The site's time zone. Without one, times are written as they are, for each visitor's own time zone. */
  timeZone?: string;
  /** When the file is written. */
  now?: Date;
}

function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds a line to 75 bytes, as calendar files' lines must be, without splitting a character. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const max = parts.length === 0 ? 75 : 74;
    if (bytes + size > max) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** `2026-12-24T19:00` → `20261224T190000`; `2026-12-24` → `20261224`. */
function icsLocal(value: string): string {
  const date = value.slice(0, 10).replace(/-/g, "");
  return isAllDay(value) ? date : `${date}T${value.slice(11, 13)}${value.slice(14, 16)}00`;
}

function icsUtc(instant: Date): string {
  return `${instant.toISOString().slice(0, 19).replace(/[-:]/g, "")}Z`;
}

function dateTimeLine(name: string, value: string, timeZone: string | undefined): string {
  if (isAllDay(value)) return `${name};VALUE=DATE:${icsLocal(value)}`;
  return timeZone ? `${name};TZID=${timeZone}:${icsLocal(value)}` : `${name}:${icsLocal(value)}`;
}

const ICS_DAYS: Record<Weekday, string> = { mo: "MO", tu: "TU", we: "WE", th: "TH", fr: "FR", sa: "SA", su: "SU" };

/** An event's repeat as an `RRULE` value, such as `FREQ=WEEKLY;BYDAY=SU`. */
export function repeatRule(event: EventValue, timeZone?: string): string | undefined {
  const repeat = event.repeat;
  if (!repeat) return undefined;
  const parts = [`FREQ=${{ day: "DAILY", week: "WEEKLY", month: "MONTHLY", year: "YEARLY" }[repeat.every]}`];
  if (repeat.interval && repeat.interval > 1) parts.push(`INTERVAL=${repeat.interval}`);
  const startMs = wallClock(event.start) ?? 0;
  const weekday = WEEKDAYS[(new Date(startMs).getUTCDay() + 6) % 7] ?? "mo";
  if (repeat.every === "week" && repeat.days?.length) {
    parts.push(`BYDAY=${repeat.days.map((day) => ICS_DAYS[day]).join(",")}`);
  }
  if (repeat.every === "month" && repeat.on === "weekday") {
    parts.push(`BYDAY=${Math.ceil(new Date(startMs).getUTCDate() / 7)}${ICS_DAYS[weekday]}`);
  }
  if (repeat.every === "month" && repeat.on === "last") parts.push(`BYDAY=-1${ICS_DAYS[weekday]}`);
  if (repeat.until) {
    if (isAllDay(event.start)) parts.push(`UNTIL=${icsLocal(repeat.until)}`);
    else if (timeZone) parts.push(`UNTIL=${icsUtc(zonedInstant(`${repeat.until}T23:59`, timeZone))}`);
    else parts.push(`UNTIL=${icsLocal(`${repeat.until}T23:59`)}`);
  }
  return parts.join(";");
}

/** The dates a repeat skips, as an `EXDATE` line. */
function skipLine(event: EventValue, timeZone: string | undefined): string | undefined {
  const skip = event.repeat?.skip ?? [];
  if (skip.length === 0) return undefined;
  if (isAllDay(event.start)) return `EXDATE;VALUE=DATE:${skip.map((date) => icsLocal(date)).join(",")}`;
  const time = event.start.slice(10);
  const values = skip.map((date) => icsLocal(`${date}${time}`)).join(",");
  return timeZone ? `EXDATE;TZID=${timeZone}:${values}` : `EXDATE:${values}`;
}

function eventLines(item: CalendarEvent, timeZone: string | undefined, stamp: string): string[] {
  const { event } = item;
  const lines = ["BEGIN:VEVENT", `UID:${escapeText(item.uid)}`, `DTSTAMP:${stamp}`];
  lines.push(dateTimeLine("DTSTART", event.start, timeZone));
  if (isAllDay(event.start)) {
    // An all-day event's end is the day after its last day.
    lines.push(dateTimeLine("DTEND", addDays(event.end ?? event.start, 1), timeZone));
  } else if (event.end) {
    lines.push(dateTimeLine("DTEND", event.end, timeZone));
  }
  const rule = repeatRule(event, timeZone);
  if (rule) lines.push(`RRULE:${rule}`);
  const skip = skipLine(event, timeZone);
  if (skip) lines.push(skip);
  lines.push(`SUMMARY:${escapeText(item.title)}`);
  if (item.place) lines.push(`LOCATION:${escapeText(item.place)}`);
  if (item.description) lines.push(`DESCRIPTION:${escapeText(item.description)}`);
  if (item.url) lines.push(`URL:${item.url}`);
  lines.push("END:VEVENT");
  return lines;
}

/** The years a calendar's events need its time zone's rules for. */
function yearsFor(events: CalendarEvent[], now: Date): [number, number] {
  const thisYear = now.getUTCFullYear();
  let first = thisYear;
  for (const { event } of events) {
    const year = Number(event.start.slice(0, 4));
    if (Number.isFinite(year) && year < first) first = year;
  }
  return [Math.max(first, thisYear - 5), thisYear + 2];
}

/** Writes a calendar file of a site's events. */
export function calendarFile(events: CalendarEvent[], options: CalendarFileOptions): string {
  const now = options.now ?? new Date();
  const timeZone = isTimeZone(options.timeZone) ? options.timeZone : undefined;
  const stamp = icsUtc(now);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Goodfellow//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(options.name)}`,
  ];
  if (timeZone) {
    lines.push(`X-WR-TIMEZONE:${timeZone}`);
    const timed = events.some(({ event }) => !isAllDay(event.start));
    if (timed) lines.push(...timeZoneLines(timeZone, yearsFor(events, now)));
  }
  for (const item of events) lines.push(...eventLines(item, timeZone, stamp));
  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

// Time zone definitions -------------------------------------------------------

interface Transition {
  /** The instant the clocks change. */
  at: number;
  from: number;
  to: number;
}

/** When a time zone's offset changes during a year. */
function transitions(timeZone: string, year: number): Transition[] {
  const found: Transition[] = [];
  const end = Date.UTC(year + 1, 0, 1);
  let previous = Date.UTC(year, 0, 1);
  let offset = zoneOffset(previous, timeZone);
  for (let at = previous + DAY / 4; at <= end; at += DAY / 4) {
    const next = zoneOffset(at, timeZone);
    if (next !== offset) {
      // Narrows it down to the minute.
      let low = previous;
      let high = at;
      while (high - low > MINUTE) {
        const middle = low + Math.floor((high - low) / MINUTE / 2) * MINUTE;
        if (zoneOffset(middle, timeZone) === offset) low = middle;
        else high = middle;
      }
      found.push({ at: high, from: offset, to: next });
      offset = next;
    }
    previous = at;
  }
  return found;
}

function offsetText(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}${String(abs % 60).padStart(2, "0")}`;
}

/** A transition's yearly rule: the month, weekday and which one of it, such as the last Sunday of March. */
interface YearlyRule {
  month: number;
  weekday: number;
  n: number;
  time: string;
}

function ruleOf(transition: Transition): YearlyRule {
  const local = transition.at + transition.from * MINUTE;
  const date = new Date(local);
  const day = date.getUTCDate();
  const days = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  return {
    month: date.getUTCMonth(),
    weekday: (date.getUTCDay() + 6) % 7,
    n: day + 7 > days ? -1 : Math.ceil(day / 7),
    time: formatWallClock(local, true).slice(11),
  };
}

function sameRule(a: YearlyRule, b: YearlyRule): boolean {
  return a.month === b.month && a.weekday === b.weekday && a.n === b.n && a.time === b.time;
}

/** A `VTIMEZONE` for a time zone, with yearly rules where its changes follow them. */
function timeZoneLines(timeZone: string, [first, last]: [number, number]): string[] {
  const lines = ["BEGIN:VTIMEZONE", `TZID:${timeZone}`];
  const byYear = new Map<number, Transition[]>();
  for (let year = first; year <= last; year++) byYear.set(year, transitions(timeZone, year));
  const all = [...byYear.values()].flat();

  const observance = (transition: Transition, rule?: string) => {
    const kind = transition.to > transition.from ? "DAYLIGHT" : "STANDARD";
    const lines = [
      `BEGIN:${kind}`,
      `DTSTART:${icsLocal(formatWallClock(transition.at + transition.from * MINUTE, true))}`,
      `TZOFFSETFROM:${offsetText(transition.from)}`,
      `TZOFFSETTO:${offsetText(transition.to)}`,
    ];
    if (rule) lines.push(`RRULE:${rule}`);
    lines.push(`END:${kind}`);
    return lines;
  };

  if (all.length === 0) {
    const offset = offsetText(zoneOffset(Date.UTC(last, 0, 1), timeZone));
    lines.push("BEGIN:STANDARD", "DTSTART:19700101T000000", `TZOFFSETFROM:${offset}`, `TZOFFSETTO:${offset}`);
    lines.push("END:STANDARD", "END:VTIMEZONE");
    return lines;
  }

  // Zones whose clocks change on the same weekday of the same month each year get one rule for each change.
  const years = [...byYear.values()];
  const pattern = years[0]?.map(ruleOf) ?? [];
  const regular =
    pattern.length > 0 &&
    years.every(
      (changes) =>
        changes.length === pattern.length &&
        changes.every((change, index) => {
          const expected = pattern[index];
          return expected !== undefined && sameRule(ruleOf(change), expected);
        }),
    );
  if (regular) {
    for (const [index, rule] of pattern.entries()) {
      const firstChange = years[0]?.[index];
      if (!firstChange) continue;
      const day = WEEKDAYS[rule.weekday] ?? "mo";
      lines.push(...observance(firstChange, `FREQ=YEARLY;BYMONTH=${rule.month + 1};BYDAY=${rule.n}${ICS_DAYS[day]}`));
    }
  } else {
    for (const change of all) lines.push(...observance(change));
  }
  lines.push("END:VTIMEZONE");
  return lines;
}

// Reading ---------------------------------------------------------------------

/** One time an event in another calendar happens, in the site's time zone. */
export interface FeedOccurrence extends Occurrence {
  uid: string;
  title: string;
  place?: string;
  description?: string;
  url?: string;
}

interface Property {
  name: string;
  params: Record<string, string>;
  value: string;
}

interface Component {
  name: string;
  properties: Property[];
  children: Component[];
}

function unescapeText(text: string): string {
  return text.replace(/\\([\\;,nN])/g, (_, char: string) => (char === "n" || char === "N" ? "\n" : char));
}

function parseLine(line: string): Property | undefined {
  // The value starts at the first colon outside a quoted parameter.
  let inQuotes = false;
  let colon = -1;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ":" && !inQuotes) {
      colon = index;
      break;
    }
  }
  if (colon === -1) return undefined;
  const [name = "", ...rawParams] = line.slice(0, colon).split(";");
  const params: Record<string, string> = {};
  for (const param of rawParams) {
    const equals = param.indexOf("=");
    if (equals === -1) continue;
    params[param.slice(0, equals).toUpperCase()] = param.slice(equals + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

/** Reads a calendar file's components. */
function parseComponents(text: string): Component[] {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n");
  const root: Component = { name: "", properties: [], children: [] };
  const stack: Component[] = [root];
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const property = parseLine(raw);
    if (!property) continue;
    const current = stack[stack.length - 1] ?? root;
    if (property.name === "BEGIN") {
      const child: Component = { name: property.value.toUpperCase(), properties: [], children: [] };
      current.children.push(child);
      stack.push(child);
    } else if (property.name === "END") {
      if (stack.length > 1) stack.pop();
    } else {
      current.properties.push(property);
    }
  }
  return root.children;
}

function property(component: Component, name: string): Property | undefined {
  return component.properties.find((candidate) => candidate.name === name);
}

/** A time zone that a feed defines itself, such as Outlook's "Eastern Standard Time". */
interface FeedZone {
  observances: Array<{ start: number; offset: number; rule?: Record<string, string> }>;
}

function parseRule(value: string): Record<string, string> {
  return Object.fromEntries(
    value.split(";").flatMap((part) => {
      const [key, item] = part.split("=");
      return key && item !== undefined ? [[key.toUpperCase(), item.toUpperCase()]] : [];
    }),
  );
}

/** A date or date and time from a feed: `20261224`, `20261224T190000` or `20261224T190000Z`. */
function parseIcsTime(value: string): { local: string; utc: boolean } | undefined {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!match) return undefined;
  const [, year, month, day, hour, minute, , z] = match;
  const date = `${year}-${month}-${day}`;
  return hour === undefined ? { local: date, utc: false } : { local: `${date}T${hour}:${minute}`, utc: z === "Z" };
}

/** Offsets of a feed's own time zone, by its observances' rules. */
function feedZoneOffset(zone: FeedZone, localMs: number): number {
  let best: { at: number; offset: number } | undefined;
  for (const observance of zone.observances) {
    const year = new Date(localMs).getUTCFullYear();
    const candidates: number[] = [];
    const rule = observance.rule;
    if (rule?.FREQ === "YEARLY" && rule.BYMONTH && rule.BYDAY) {
      const byday = /^(-?\d)?([A-Z]{2})$/.exec(rule.BYDAY);
      const weekday = WEEKDAYS.findIndex((day) => ICS_DAYS[day] === byday?.[2]);
      const n = Number(byday?.[1] ?? 1);
      const time = observance.start % DAY;
      for (const y of [year - 1, year]) {
        const month = Number(rule.BYMONTH) - 1;
        const days = new Date(Date.UTC(y, month + 1, 0)).getUTCDate();
        let date: number;
        if (n === -1) {
          const last = Date.UTC(y, month, days);
          date = last - ((((new Date(last).getUTCDay() + 6) % 7) - weekday + 7) % 7) * DAY;
        } else {
          const first = Date.UTC(y, month, 1);
          date = first + (((weekday - ((new Date(first).getUTCDay() + 6) % 7) + 7) % 7) + (n - 1) * 7) * DAY;
        }
        if (date + time >= observance.start) candidates.push(date + time);
      }
    } else {
      candidates.push(observance.start);
    }
    for (const at of candidates) {
      if (at <= localMs && (!best || at > best.at)) best = { at, offset: observance.offset };
    }
  }
  return best?.offset ?? zone.observances[0]?.offset ?? 0;
}

function parseOffset(value: string | undefined): number {
  const match = /^([+-])(\d{2})(\d{2})/.exec(value ?? "");
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}

function feedZones(components: Component[]): Map<string, FeedZone> {
  const zones = new Map<string, FeedZone>();
  for (const calendar of components) {
    for (const zone of calendar.children.filter((child) => child.name === "VTIMEZONE")) {
      const id = property(zone, "TZID")?.value;
      if (!id) continue;
      const observances = zone.children.flatMap((child) => {
        const start = parseIcsTime(property(child, "DTSTART")?.value ?? "");
        const startMs = start ? wallClock(start.local) : undefined;
        if (startMs === undefined) return [];
        const rule = property(child, "RRULE")?.value;
        return [
          {
            start: startMs,
            offset: parseOffset(property(child, "TZOFFSETTO")?.value),
            ...(rule && { rule: parseRule(rule) }),
          },
        ];
      });
      zones.set(id, { observances });
    }
  }
  return zones;
}

/** A feed's time, as an instant: UTC, in a named zone, in the feed's own zone, or floating (the site's). */
type Clock = (local: string, utc: boolean, zone?: string) => number;

function clockFor(zones: Map<string, FeedZone>, siteZone: string | undefined): Clock {
  return (local, utc, zone) => {
    const ms = wallClock(local) ?? 0;
    if (utc) return ms;
    if (zone && isTimeZone(zone)) return zonedInstant(local, zone).getTime();
    const own = zone ? zones.get(zone) : undefined;
    if (own) return ms - feedZoneOffset(own, ms) * MINUTE;
    return zonedInstant(local, siteZone).getTime();
  };
}

/** A feed's `RRULE`, as this module's repeats can express it, with its `COUNT`. */
function feedRepeat(
  rule: Record<string, string>,
  untilDate: string | undefined,
): {
  repeat?: EventRepeat;
  count?: number;
} {
  const every = { DAILY: "day", WEEKLY: "week", MONTHLY: "month", YEARLY: "year" }[rule.FREQ ?? ""] as
    | EventRepeat["every"]
    | undefined;
  if (!every) return {};
  const repeat: EventRepeat = { every };
  const interval = Number(rule.INTERVAL);
  if (Number.isInteger(interval) && interval > 1) repeat.interval = interval;
  const days = (rule.BYDAY ?? "").split(",").filter(Boolean);
  if (every === "week" && days.length) {
    repeat.days = days.flatMap((day) => {
      const found = WEEKDAYS.find((weekday) => ICS_DAYS[weekday] === day.slice(-2));
      return found ? [found] : [];
    });
  }
  if (every === "month" && days.length) repeat.on = days[0]?.startsWith("-1") ? "last" : "weekday";
  if (untilDate) repeat.until = untilDate;
  const count = Number(rule.COUNT);
  return { repeat, ...(Number.isInteger(count) && count > 0 && { count }) };
}

export interface FeedOptions {
  /** The site's time zone, which the occurrences are given in. */
  timeZone?: string;
  /** The first and last dates to include, as `YYYY-MM-DD`. */
  from: string;
  to: string;
}

/**
 * The events in a calendar file between two dates, in the site's time zone,
 * oldest first. Repeats, skipped dates, changed and cancelled occurrences are
 * followed. Anything a feed says that can't be read is left out.
 */
export function readCalendar(text: string, options: FeedOptions): FeedOccurrence[] {
  const components = parseComponents(text);
  const clock = clockFor(feedZones(components), options.timeZone);
  const siteZone = isTimeZone(options.timeZone) ? options.timeZone : undefined;
  const events = components.flatMap((calendar) => calendar.children.filter((child) => child.name === "VEVENT"));

  /** A feed time, as the site's wall-clock time: dates stay dates. */
  const toSite = (prop: Property | undefined): string | undefined => {
    const parsed = prop ? parseIcsTime(prop.value) : undefined;
    if (!parsed) return undefined;
    if (isAllDay(parsed.local)) return parsed.local;
    return zonedTime(new Date(clock(parsed.local, parsed.utc, prop?.params.TZID)), siteZone);
  };

  // Changed occurrences replace the ones their RECURRENCE-ID names.
  const overridden = new Map<string, Set<string>>();
  for (const event of events) {
    const uid = property(event, "UID")?.value;
    const id = toSite(property(event, "RECURRENCE-ID"));
    if (!uid || !id) continue;
    const set = overridden.get(uid) ?? new Set<string>();
    set.add(id);
    overridden.set(uid, set);
  }

  const found: FeedOccurrence[] = [];
  for (const event of events) {
    if (property(event, "STATUS")?.value.toUpperCase() === "CANCELLED") continue;
    const startProp = property(event, "DTSTART");
    const parsedStart = startProp ? parseIcsTime(startProp.value) : undefined;
    if (!startProp || !parsedStart) continue;
    const uid = property(event, "UID")?.value ?? `${parsedStart.local}-${found.length}`;
    const allDay = isAllDay(parsedStart.local);
    const zone = startProp.params.TZID;

    // Repeats are worked out in the event's own time, then each occurrence moved to the site's.
    const sourceStart = parsedStart.local;
    const endProp = property(event, "DTEND");
    const parsedEnd = endProp ? parseIcsTime(endProp.value) : undefined;
    let sourceEnd: string | undefined;
    if (parsedEnd) {
      if (allDay) sourceEnd = addDays(parsedEnd.local.slice(0, 10), -1);
      else {
        const endMs = clock(parsedEnd.local, parsedEnd.utc, endProp?.params.TZID);
        const startMs = clock(sourceStart, parsedStart.utc, zone);
        sourceEnd = formatWallClock((wallClock(sourceStart) ?? 0) + (endMs - startMs), true);
      }
    }
    const ruleText = property(event, "RRULE")?.value;
    const rule = ruleText ? parseRule(ruleText) : undefined;
    let untilDate: string | undefined;
    if (rule?.UNTIL) {
      const until = parseIcsTime(rule.UNTIL);
      if (until) untilDate = isAllDay(until.local) ? until.local : datePart(until.local);
    }
    const { repeat, count } = rule && !property(event, "RECURRENCE-ID") ? feedRepeat(rule, untilDate) : {};

    const skips = new Set<string>();
    for (const exdate of event.properties.filter((prop) => prop.name === "EXDATE")) {
      for (const value of exdate.value.split(",")) {
        const parsed = parseIcsTime(value);
        if (!parsed) continue;
        if (isAllDay(parsed.local) || !parsed.utc) skips.add(datePart(parsed.local));
        else
          skips.add(
            datePart(zonedTime(new Date(clock(parsed.local, true)), zone && isTimeZone(zone) ? zone : siteZone)),
          );
      }
    }

    const source: EventValue = {
      start: sourceStart,
      ...(sourceEnd && sourceEnd !== sourceStart && { end: sourceEnd }),
      ...(repeat && { repeat: { ...repeat, ...(skips.size && { skip: [...skips] }) } }),
    };
    // A day either side, since moving to the site's time zone can change an occurrence's date.
    const window = { from: addDays(options.from, -1), to: addDays(options.to, 1) };
    const times = occurrences(source, { ...window, ...(count !== undefined && { count }) });
    const replaced = overridden.get(uid);
    const title = unescapeText(property(event, "SUMMARY")?.value ?? "");
    const place = property(event, "LOCATION")?.value;
    const description = property(event, "DESCRIPTION")?.value;
    const url = property(event, "URL")?.value;

    for (const time of times) {
      let start = time.start;
      let end = time.end;
      if (!allDay) {
        const offset = clock(time.start, parsedStart.utc, zone) - (wallClock(time.start) ?? 0);
        start = zonedTime(new Date((wallClock(time.start) ?? 0) + offset), siteZone);
        if (time.end) end = zonedTime(new Date((wallClock(time.end) ?? 0) + offset), siteZone);
      }
      // The master event's occurrences that a changed one replaces are left out.
      if (!property(event, "RECURRENCE-ID") && replaced?.has(start)) continue;
      const lastDay = datePart(end ?? start);
      if (lastDay < options.from || datePart(start) > options.to) continue;
      found.push({
        uid,
        title: title || "(no title)",
        start,
        ...(end && { end }),
        allDay,
        ...(place && { place: unescapeText(place) }),
        ...(description && { description: unescapeText(description) }),
        ...(url && /^https?:\/\//i.test(url) && { url }),
      });
    }
  }
  return found.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
}
