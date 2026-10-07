import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/**
 * The built registry from the site's `@goodfellow/registry` package, which the
 * admin panel installs from in development. The site may only have it through
 * `@goodfellow/admin`, so it's looked for there too.
 */
export function localRegistryDir(root: string): string | undefined {
  const fromRoot = createRequire(join(root, "package.json"));
  for (const require of [() => fromRoot, () => createRequire(fromRoot.resolve("@goodfellow/admin/package.json"))]) {
    try {
      return join(dirname(require().resolve("@goodfellow/registry/package.json")), "r");
    } catch {
      // Not found from here.
    }
  }
  return undefined;
}
