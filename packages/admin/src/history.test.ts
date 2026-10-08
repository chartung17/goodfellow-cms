import { describe, expect, it } from "vitest";
import { changedField, createHistory, GROUP_MS, HISTORY_LIMIT, record, redo, undo } from "./history.js";

const form = (title: string, colors: Record<string, string> = {}, links: string[] = []) => ({
  settings: { title, theme: { colors } },
  links,
});

describe("changedField", () => {
  it("names the one field that changed", () => {
    expect(changedField(form("A"), form("AB"))).toBe("settings.title");
    expect(changedField(form("A"), form("A", { primary: "#000" }))).toBe("settings.theme.colors.primary");
    expect(changedField(form("A", {}, ["a"]), form("A", {}, ["b"]))).toBe("links.0");
  });

  it("gives nothing when several things or the shape changed", () => {
    expect(changedField(form("A"), form("A"))).toBeUndefined();
    expect(changedField(form("A", { primary: "#000" }), form("B", { primary: "#fff" }))).toBeUndefined();
    expect(changedField(form("A", {}, ["a"]), form("A", {}, ["a", "b"]))).toBeUndefined();
    expect(changedField({ logo: undefined }, { logo: { src: "/x.png" } })).toBeUndefined();
  });
});

describe("history", () => {
  it("undoes and redoes changes", () => {
    let history = createHistory(form("A"));
    history = record(history, form("A", { primary: "#000" }), 0);
    history = record(history, form("B", { primary: "#000" }), 5000);
    history = undo(history);
    expect(history.present).toEqual(form("A", { primary: "#000" }));
    history = undo(history);
    expect(history.present).toEqual(form("A"));
    expect(undo(history)).toBe(history);
    history = redo(history);
    expect(history.present).toEqual(form("A", { primary: "#000" }));
    // A new change drops what was undone.
    history = record(history, form("C", { primary: "#000" }), 9000);
    expect(redo(history)).toBe(history);
  });

  it("takes back typing in one field as one step", () => {
    let history = createHistory(form(""));
    history = record(history, form("H"), 0);
    history = record(history, form("Hi"), 300);
    history = record(history, form("Hi!"), 600);
    expect(undo(history).present).toEqual(form(""));

    // A pause, or another field, starts a new step.
    history = record(history, form("Hi!?"), 600 + GROUP_MS);
    history = record(history, form("Hi!?", { primary: "#000" }), 700 + GROUP_MS);
    history = undo(history);
    expect(history.present).toEqual(form("Hi!?"));
    expect(undo(history).present).toEqual(form("Hi!"));
  });

  it("doesn't count a copy with the same values as a step", () => {
    const history = record(createHistory(form("A")), form("B"), 0);
    expect(record(history, form("B"), 5000)).toBe(history);
  });

  it("starts a new step after undoing", () => {
    let history = createHistory(form("A"));
    history = record(history, form("AB"), 0);
    history = record(history, form("ABC"), 5000);
    history = undo(history);
    history = record(history, form("ABX"), 5100);
    expect(undo(history).present).toEqual(form("AB"));
  });

  it("keeps a limited number of steps", () => {
    let history = createHistory(form("0"));
    for (let i = 1; i <= HISTORY_LIMIT + 10; i++)
      history = record(history, form(String(i), { n: String(i) }, [String(i)]), i * 5000);
    expect(history.past).toHaveLength(HISTORY_LIMIT);
  });
});
