import { describe, expect, it } from "vitest";
import { credentialStorage, decodeBase64, encodeBase64, encodeBase64Bytes, type StorageLike } from "./git.js";

function memoryStorage(): StorageLike & { items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}

describe("credentialStorage", () => {
  it("keeps the sign-in in local storage only when asked to remember it", () => {
    const local = memoryStorage();
    const session = memoryStorage();
    const storage = credentialStorage("k", { local, session });

    storage.save("a", false);
    expect([local.items.get("k"), session.items.get("k")]).toEqual([undefined, "a"]);
    expect(storage.remembered()).toBe(false);

    storage.save("b", true);
    expect([local.items.get("k"), session.items.get("k")]).toEqual(["b", undefined]);
    expect(storage.load()).toBe("b");
    expect(storage.remembered()).toBe(true);

    storage.clear();
    expect(storage.load()).toBeNull();
  });

  it("works without storage", () => {
    const storage = credentialStorage("k", {});
    storage.save("a", true);
    expect(storage.load()).toBeNull();
  });
});

describe("encodeBase64", () => {
  it("encodes Unicode text", () => {
    expect(encodeBase64("Café ✝")).toBe("Q2Fmw6kg4pyd");
  });
});

describe("base64", () => {
  it("round-trips bytes and Unicode text", () => {
    const bytes = new Uint8Array([0, 1, 254, 255, 128]);
    expect(decodeBase64(encodeBase64Bytes(bytes))).toEqual(bytes);
    expect(new TextDecoder().decode(decodeBase64(encodeBase64("Café ✝")))).toBe("Café ✝");
  });
});
