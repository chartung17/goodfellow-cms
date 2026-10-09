import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  blockPackages,
  type ClientModuleExports,
  clientModuleExports,
  inNodeModules,
  insideDir,
  islandModule,
} from "./islands.js";

/** Runs an island module with stand-ins for the client module and `island()`, and returns its exports. */
async function exportsOf(module: Record<string, unknown>, exports: ClientModuleExports) {
  const code = islandModule("/site/blocks/a.tsx", "blocks/a.tsx", exports)
    .replace('import * as __gf_module from "/site/blocks/a.tsx";', `const __gf_module = globalThis.__gfTestModule;`)
    .replace(
      'import { island as __gf_island } from "@goodfellow-cms/react/island";',
      "const __gf_island = (value, module, name) => ({ value, module, name });",
    )
    .replace('export * from "/site/blocks/a.tsx";', "");
  (globalThis as { __gfTestModule?: unknown }).__gfTestModule = module;
  return import(`data:text/javascript,${encodeURIComponent(code)}`);
}

describe("clientModuleExports", () => {
  it('lists the values a module that starts with "use client" exports', () => {
    const code = [
      "// Tabs, for blocks.",
      '"use client";',
      'import type { ReactNode } from "react";',
      "export type TabsProps = { children: ReactNode };",
      "export interface TabProps {}",
      "export function Tabs({ children }: TabsProps) { return <div>{children}</div>; }",
      "export const Tab = () => null, label = 'Tabs', { a, b: [c] } = { a: 1, b: [2] };",
      "export enum Size { Small }",
      "export declare const injected: string;",
      "function useTabs() {}",
      'export { useTabs, useTabs as "use tabs", type TabProps as Props };',
      'export { Other } from "./other";',
      'export * as icons from "./icons";',
      "export default function Gallery() { return null; }",
    ].join("\n");
    expect(clientModuleExports(code, "/site/blocks/tabs.tsx")).toEqual({
      names: ["Tabs", "Tab", "label", "a", "c", "Size", "useTabs", "use tabs", "Other", "icons", "default"],
      star: false,
    });
    expect(clientModuleExports('"use client";\nexport * from "./a";', "/a.js")).toEqual({ names: [], star: true });
  });

  it("leaves other modules alone", () => {
    expect(clientModuleExports('import "x";\n"use client";\nexport const a = 1;', "/a.js")).toBeUndefined();
    expect(clientModuleExports('const text = "use client";\nexport { text };', "/a.js")).toBeUndefined();
  });
});

describe("islandModule", () => {
  it("wraps each export of a Client Component's module in island()", async () => {
    function Counter() {}
    const module = { Counter, "Tab item": Counter, default: Counter };
    const exports = await exportsOf(module, { names: ["Counter", "Tab item", "default"], star: true });
    expect(exports.Counter).toEqual({ value: Counter, module: "blocks/a.tsx", name: "Counter" });
    expect(exports["Tab item"]).toEqual({ value: Counter, module: "blocks/a.tsx", name: "Tab item" });
    expect(exports.default).toEqual({ value: Counter, module: "blocks/a.tsx", name: "default" });
    expect(islandModule("/a.tsx", "a.tsx", { names: [], star: true })).toContain('export * from "/a.tsx";');
  });
});

describe("insideDir and inNodeModules", () => {
  it("compare Vite's module ids with Node's paths on Windows, where one has forward slashes and the other backslashes", () => {
    const dir = "C:\\Users\\me\\site\\node_modules\\@goodfellow-cms\\react";
    expect(insideDir("C:/Users/me/site/node_modules/@goodfellow-cms/react/dist/site-context.js", dir)).toBe(true);
    expect(insideDir("c:/Users/me/site/node_modules/@goodfellow-cms/react/dist/site-context.js", dir)).toBe(true);
    expect(insideDir("C:/Users/me/site/node_modules/@goodfellow-cms/react-extra/index.js", dir)).toBe(false);
    expect(insideDir("C:/Users/me/site/blocks/counter.tsx", dir)).toBe(false);
    expect(inNodeModules("C:/Users/me/site/node_modules/radix-ui/dist/index.mjs")).toBe(true);
    expect(inNodeModules("C:\\Users\\me\\site\\node_modules\\radix-ui\\dist\\index.mjs")).toBe(true);
    expect(inNodeModules("C:/Users/me/site/blocks/counter.tsx")).toBe(false);
  });

  it("work with paths on other systems", () => {
    expect(insideDir("/home/me/site/blocks/counter.tsx", "/home/me/site/blocks")).toBe(true);
    expect(insideDir("/home/me/site/blocks-extra/counter.tsx", "/home/me/site/blocks")).toBe(false);
    expect(inNodeModules("/home/me/site/node_modules/radix-ui/dist/index.mjs")).toBe(true);
  });
});

describe("blockPackages", () => {
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "goodfellow-packs-"));
    const pkg = (name: string, extra: object) =>
      writeFile(join(root, "node_modules", name, "package.json"), JSON.stringify({ name, ...extra }));
    for (const name of ["@acme/blocks", "left-pad", "@goodfellow-cms/admin"]) {
      await mkdir(join(root, "node_modules", name), { recursive: true });
    }
    await pkg("@acme/blocks", { peerDependencies: { "@goodfellow-cms/react": "^1.0.0" } });
    await pkg("left-pad", {});
    await pkg("@goodfellow-cms/admin", { dependencies: { "@goodfellow-cms/react": "1.0.0" } });
    // The workspace's own block pack, linked like pnpm links it: a junction on Windows, which needs no
    // administrator rights, and a symlink elsewhere.
    await symlink(
      resolve(import.meta.dirname, "../../blocks"),
      join(root, "node_modules/@goodfellow-cms/blocks"),
      "junction",
    );
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        dependencies: {
          "@acme/blocks": "1.0.0",
          "left-pad": "1.0.0",
          "@goodfellow-cms/admin": "1.0.0",
          "@goodfellow-cms/blocks": "1.0.0",
        },
        devDependencies: { missing: "1.0.0" },
      }),
    );
  });

  afterAll(() => rm(root, { recursive: true, force: true }));

  it("finds the site's packages that build on @goodfellow-cms/react", () => {
    expect(blockPackages(root)).toEqual(["@acme/blocks", "@goodfellow-cms/blocks"]);
  });
});
