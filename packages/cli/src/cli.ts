import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { ContentError, formatUpdateResult } from "@goodfellow-cms/core";
import { update } from "@goodfellow-cms/core/node";
import { writeSearchIndex } from "@goodfellow-cms/core/search-index";
import { build } from "./build.js";
import { dev } from "./dev.js";
import { preview } from "./preview.js";
import { buildCause, reportBuildCause } from "./problems.js";
import { SiteSetupError } from "./site.js";

const HELP = `Usage: goodfellow <command> [options]

Commands:
  dev       Start a development server that re-renders pages as you edit
  build     Build the static site into dist/
  preview   Serve the built site the way a static host would
  index     Index a built site's pages for its search block (build does this itself)
  update    Update Goodfellow, and blocks from its registry, if the site still builds

Options:
  --root <dir>    The site's folder (default: current folder)
  --out <dir>     Build output folder (default: dist)
  --base <path>   Serve the site from a subfolder, such as /my-repo/ (also GOODFELLOW_BASE)
  --port <port>   Port for dev or preview
  --to <release>  For update: fixes (the default), latest, or a release such as 0.5.0
  --publish       For update: publish the update to the site's main branch once it builds
  -h, --help      Show this help
`;

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      root: { type: "string" },
      out: { type: "string" },
      base: { type: "string" },
      port: { type: "string" },
      to: { type: "string" },
      publish: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });

  const [command] = positionals;
  const port = values.port ? Number(values.port) : undefined;
  const base = values.base ?? process.env.GOODFELLOW_BASE;

  if (values.help || !command) {
    console.log(HELP);
    return;
  }

  switch (command) {
    case "dev":
      await dev({ root: values.root, port });
      return;
    case "build": {
      const started = performance.now();
      let result: Awaited<ReturnType<typeof build>>;
      try {
        result = await build({ root: values.root, outDir: values.out, base });
      } catch (error) {
        // For the admin panel, which reads it in the host's log to explain the failure.
        for (const line of reportBuildCause(buildCause(error, resolve(values.root ?? ".")))) console.log(line);
        throw error;
      }
      const seconds = ((performance.now() - started) / 1000).toFixed(1);
      console.log(
        `Built ${result.pages.length} page${result.pages.length === 1 ? "" : "s"} into ${result.outDir} in ${seconds}s`,
      );
      if (result.searchIndexed !== undefined) console.log(`Indexed ${result.searchIndexed} pages for search`);
      return;
    }
    case "index": {
      const dir = positionals[1] ?? values.out ?? "out";
      const indexed = await writeSearchIndex(dir);
      console.log(
        indexed === undefined
          ? `No page in ${dir} has a search block, so there's nothing to index`
          : `Indexed ${indexed} pages for search`,
      );
      return;
    }
    case "update": {
      const result = await update({ root: values.root, to: values.to, publish: values.publish });
      // For the admin panel, which reads it in the host's log.
      console.log(formatUpdateResult(result));
      if (result.state === "failed") process.exitCode = 1;
      return;
    }
    case "preview":
      await preview({ root: values.root, outDir: values.out, base, port });
      return;
    default:
      console.error(`Unknown command "${command}".\n\n${HELP}`);
      process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  if (error instanceof ContentError) {
    console.error(
      `\nSome content files have problems:\n${error.problems.map((p) => `  ${p.file}: ${p.message}`).join("\n")}\n`,
    );
  } else if (error instanceof SiteSetupError) {
    console.error(`\n${error.message}\n`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
