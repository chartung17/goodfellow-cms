import {
  cleanEventValue,
  datePart,
  type EventRepeat,
  type EventValue,
  formatDate,
  formatOccurrence,
  isAllDay,
  isEventLike,
  shownOccurrence,
  todayIn,
  WEEKDAYS,
  type Weekday,
  wallClock,
  weekdayName,
  weekdayOf,
} from "@goodfellow-cms/core";
import { FieldLabel } from "@puckeditor/core";
import { useState } from "react";
import { type StringKey, useStrings } from "./strings.js";

type Every = EventRepeat["every"];

const EVERY_LABELS: Record<Every | "none", StringKey> = {
  none: "event.repeat.none",
  day: "event.repeat.day",
  week: "event.repeat.week",
  month: "event.repeat.month",
  year: "event.repeat.year",
};

const INTERVAL_LABELS: Record<Every, StringKey> = {
  day: "event.interval.days",
  week: "event.interval.weeks",
  month: "event.interval.months",
  year: "event.interval.years",
};

const NTH: Record<number, StringKey> = {
  1: "event.nth.1",
  2: "event.nth.2",
  3: "event.nth.3",
  4: "event.nth.4",
  5: "event.nth.5",
};

const DEFAULT_TIME = "09:00";

function timeOf(value: string | undefined): string {
  return value && !isAllDay(value) ? value.slice(11, 16) : "";
}

interface EventFieldProps {
  id: string;
  label: string;
  hint?: string;
  value: unknown;
  onChange: (value: EventValue | undefined) => void;
  language: string;
  timeZone?: string;
}

/**
 * An event field: when it starts and ends, whether it's all day, and how it
 * repeats, with dates it skips. Times are the site's own, in its time zone.
 */
export function EventField({ id, label, hint, value, onChange, language, timeZone }: EventFieldProps) {
  const t = useStrings();
  const event = isEventLike(value) ? value : undefined;
  const [skipDate, setSkipDate] = useState("");

  const start = event?.start ?? "";
  const allDay = start ? isAllDay(start) : false;
  const startDate = datePart(start);
  const repeat = event?.repeat;

  const update = (changes: Partial<EventValue>) => {
    const next = { ...(event ?? { start: "" }), ...changes } as EventValue;
    if (!next.start) return onChange(undefined);
    onChange(cleanEventValue(next));
  };
  const updateRepeat = (changes: Partial<EventRepeat> | undefined) => {
    if (changes === undefined) return update({ repeat: undefined });
    update({ repeat: { every: repeat?.every ?? "week", ...repeat, ...changes } });
  };

  const setStartDate = (date: string) => {
    if (!date) return update({ start: "", end: undefined });
    const time = allDay ? "" : `T${timeOf(start) || DEFAULT_TIME}`;
    // Keeps the end the same distance after the start.
    let end = event?.end;
    if (end && startDate) {
      const shift = (wallClock(date) ?? 0) - (wallClock(startDate) ?? 0);
      const moved = new Date((wallClock(end) ?? 0) + shift).toISOString();
      end = allDay ? moved.slice(0, 10) : moved.slice(0, 16);
    }
    update({ start: `${date}${time}`, end });
  };
  const setAllDay = (checked: boolean) => {
    if (!startDate) return;
    const endDate = event?.end ? datePart(event.end) : undefined;
    if (checked) update({ start: startDate, end: endDate && endDate !== startDate ? endDate : undefined });
    else {
      const time = DEFAULT_TIME;
      update({ start: `${startDate}T${time}`, end: endDate ? `${endDate}T10:00` : undefined });
    }
  };
  const setEnd = (date: string, time: string) => {
    if (!date && !time) return update({ end: undefined });
    const day = date || startDate;
    update({ end: allDay ? day : `${day}T${time || timeOf(start) || DEFAULT_TIME}` });
  };

  const weekday = startDate ? weekdayOf(startDate) : "mo";
  const nth = startDate ? Math.ceil(Number(startDate.slice(8)) / 7) : 1;
  const shown = event?.start ? shownOccurrence(event, todayIn(timeZone)) : undefined;
  const days = repeat?.days?.length ? repeat.days : [weekday];

  return (
    // A group of controls with labels of their own, so not one label around them all.
    <FieldLabel label={label} el="div">
      <fieldset className="gfa-event-field" id={id} aria-label={label}>
        <div className="gfa-event-row">
          <label className="gfa-event-part">
            <span>{t("event.starts")}</span>
            <input
              type="date"
              className="gfa-puck-input"
              value={startDate}
              onChange={(change) => setStartDate(change.target.value)}
            />
          </label>
          {!allDay && startDate && (
            <label className="gfa-event-part">
              <span>{t("event.time")}</span>
              <input
                type="time"
                className="gfa-puck-input"
                value={timeOf(start)}
                onChange={(change) => change.target.value && update({ start: `${startDate}T${change.target.value}` })}
              />
            </label>
          )}
        </div>
        {startDate && (
          <>
            <label className="gfa-checkbox">
              <input type="checkbox" checked={allDay} onChange={(change) => setAllDay(change.target.checked)} />
              {t("event.allDay")}
            </label>
            <div className="gfa-event-row">
              <label className="gfa-event-part">
                <span>{t("event.ends")}</span>
                <input
                  type="date"
                  className="gfa-puck-input"
                  value={event?.end ? datePart(event.end) : ""}
                  min={startDate}
                  onChange={(change) => setEnd(change.target.value, timeOf(event?.end))}
                />
              </label>
              {!allDay && (
                <label className="gfa-event-part">
                  <span>{t("event.time")}</span>
                  <input
                    type="time"
                    className="gfa-puck-input"
                    value={timeOf(event?.end)}
                    onChange={(change) => setEnd(event?.end ? datePart(event.end) : "", change.target.value)}
                  />
                </label>
              )}
            </div>

            <label className="gfa-event-part">
              <span>{t("event.repeats")}</span>
              <select
                className="gfa-puck-input"
                value={repeat?.every ?? "none"}
                onChange={(change) =>
                  change.target.value === "none"
                    ? updateRepeat(undefined)
                    : updateRepeat({ every: change.target.value as Every })
                }
              >
                {(["none", "day", "week", "month", "year"] as const).map((every) => (
                  <option key={every} value={every}>
                    {t(EVERY_LABELS[every])}
                  </option>
                ))}
              </select>
            </label>

            {repeat && (
              <div className="gfa-event-repeat">
                <label className="gfa-event-part gfa-event-interval">
                  <span>{t(INTERVAL_LABELS[repeat.every])}</span>
                  <input
                    type="number"
                    min={1}
                    className="gfa-puck-input"
                    value={repeat.interval ?? 1}
                    onChange={(change) => {
                      const interval = Math.max(1, Math.round(Number(change.target.value) || 1));
                      updateRepeat({ interval });
                    }}
                  />
                </label>

                {repeat.every === "week" && (
                  <fieldset className="gfa-event-days">
                    <legend>{t("event.onDays")}</legend>
                    {WEEKDAYS.map((day: Weekday) => (
                      <label key={day} className="gfa-checkbox">
                        <input
                          type="checkbox"
                          checked={days.includes(day)}
                          onChange={(change) => {
                            const chosen = change.target.checked ? [...days, day] : days.filter((d) => d !== day);
                            if (chosen.length > 0) updateRepeat({ days: chosen });
                          }}
                        />
                        {weekdayName(day, language)}
                      </label>
                    ))}
                  </fieldset>
                )}

                {repeat.every === "month" && (
                  <label className="gfa-event-part">
                    <span>{t("event.monthlyOn")}</span>
                    <select
                      className="gfa-puck-input"
                      value={repeat.on ?? "date"}
                      onChange={(change) => updateRepeat({ on: change.target.value as EventRepeat["on"] })}
                    >
                      <option value="date">
                        {t("event.monthly.date", { day: String(Number(startDate.slice(8))) })}
                      </option>
                      {nth <= 4 && (
                        <option value="weekday">
                          {t("event.monthly.weekday", {
                            nth: t(NTH[nth] ?? "event.nth.1"),
                            weekday: weekdayName(weekday, language, "long"),
                          })}
                        </option>
                      )}
                      <option value="last">
                        {t("event.monthly.last", { weekday: weekdayName(weekday, language, "long") })}
                      </option>
                    </select>
                  </label>
                )}

                <label className="gfa-event-part">
                  <span>{t("event.until")}</span>
                  <input
                    type="date"
                    className="gfa-puck-input"
                    value={repeat.until ?? ""}
                    min={startDate}
                    onChange={(change) => updateRepeat({ until: change.target.value || undefined })}
                  />
                </label>

                <div className="gfa-event-part">
                  <span>{t("event.skip")}</span>
                  {(repeat.skip ?? []).length > 0 && (
                    <ul className="gfa-event-skips">
                      {(repeat.skip ?? []).map((date) => (
                        <li key={date} className="gfa-event-skip">
                          <span>{formatDate(date, language, "medium")}</span>
                          <button
                            type="button"
                            className="gfa-button gfa-button-ghost"
                            onClick={() => updateRepeat({ skip: (repeat.skip ?? []).filter((d) => d !== date) })}
                          >
                            {t("menus.remove")}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="gfa-event-row">
                    <input
                      type="date"
                      aria-label={t("event.skipDate")}
                      className="gfa-puck-input"
                      value={skipDate}
                      min={startDate}
                      onChange={(change) => setSkipDate(change.target.value)}
                    />
                    <button
                      type="button"
                      className="gfa-button"
                      disabled={!skipDate}
                      onClick={() => {
                        updateRepeat({ skip: [...(repeat.skip ?? []), skipDate] });
                        setSkipDate("");
                      }}
                    >
                      {t("event.addSkip")}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {shown && (
              <p className="gfa-puck-hint" role="status">
                {t(repeat ? "event.next" : "event.when", { when: formatOccurrence(shown, language) })}
              </p>
            )}
          </>
        )}
        {hint && <p className="gfa-puck-hint">{hint}</p>}
      </fieldset>
    </FieldLabel>
  );
}
