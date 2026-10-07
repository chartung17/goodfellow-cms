import { readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface, type Interface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  type Backend,
  BLOCK_CHOICES,
  type BlockChoice,
  HOSTS,
  type Host,
  hostsFor,
  parseRepo,
  ScaffoldError,
  scaffold,
  TEMPLATES,
  type TemplateName,
} from "./scaffold.js";

const HELP = `Creates a new Goodfellow site.

Usage: npm create goodfellow@latest [folder] -- [options]

Options:
  --template <name>   starter (the default), parish, or next for a Next.js site
  --github <repo>     The GitHub repository the site will be stored in, such as your-name/your-site
  --gitlab <project>  The GitLab project the site will be stored in, such as your-group/your-site
  --host <host>       github-pages, gitlab-pages or vercel. Keeps only that host's setup file.
  --blocks <choice>   recommended (the default) to add the recommended blocks, or built-in for Goodfellow's own only
  -y, --yes           Don't ask anything: use the options given, and defaults for the rest
  -h, --help          Show this help
`;

/** Bundled into the package when it's built: see scripts/bundle-templates.mjs. */
const templatesDir = fileURLToPath(new URL("../templates/", import.meta.url));

const HOST_NAMES = { github: "GitHub", gitlab: "GitLab" } as const;

interface Choice<T> {
  value: T;
  label: string;
  note?: string;
}

async function choose<T>(rl: Interface, question: string, choices: Choice<T>[]): Promise<T> {
  stdout.write(`\n${question}\n`);
  choices.forEach((choice, index) => {
    stdout.write(`  ${index + 1}. ${choice.label}${choice.note ? `\n     ${choice.note}` : ""}\n`);
  });
  for (;;) {
    const answer = (await rl.question(`Choose 1-${choices.length} (1): `)).trim();
    const choice = choices[answer === "" ? 0 : Number(answer) - 1];
    if (choice) return choice.value;
  }
}

async function askRepo(rl: Interface, host: Backend["host"]): Promise<string | undefined> {
  const example = host === "github" ? "your-name/your-site" : "your-group/your-site";
  for (;;) {
    const answer = await rl.question(
      `\nThe ${HOST_NAMES[host]} ${host === "github" ? "repository" : "project"}, such as ${example} (leave empty if it doesn't exist yet): `,
    );
    if (answer.trim() === "") return undefined;
    const repo = parseRepo(host, answer);
    if (repo) return repo;
    stdout.write(`That doesn't look like a ${HOST_NAMES[host]} address. Type it as ${example}.\n`);
  }
}

function isTemplate(name: string): name is TemplateName {
  return Object.hasOwn(TEMPLATES, name);
}

function isHost(name: string): name is Host {
  return Object.hasOwn(HOSTS, name);
}

function backendFromOptions(github: string | undefined, gitlab: string | undefined): Backend | undefined {
  if (github !== undefined && gitlab !== undefined) {
    throw new ScaffoldError("Choose either --github or --gitlab, not both.");
  }
  const host = github !== undefined ? "github" : gitlab !== undefined ? "gitlab" : undefined;
  if (!host) return undefined;
  const repo = parseRepo(host, (github ?? gitlab) as string);
  if (!repo) {
    throw new ScaffoldError(
      host === "github"
        ? "--github takes a repository such as your-name/your-site."
        : "--gitlab takes a project such as your-group/your-site.",
    );
  }
  return { host, repo };
}

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      template: { type: "string" },
      github: { type: "string" },
      gitlab: { type: "string" },
      host: { type: "string" },
      blocks: { type: "string" },
      yes: { type: "boolean", short: "y" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    stdout.write(HELP);
    return;
  }

  let folder = positionals[0];
  let template = values.template;
  if (template !== undefined && !isTemplate(template)) {
    throw new ScaffoldError(`There's no template called "${template}". Choose ${Object.keys(TEMPLATES).join(" or ")}.`);
  }
  let backend = backendFromOptions(values.github, values.gitlab);
  let host: string | undefined = values.host;
  if (host !== undefined && !isHost(host)) {
    throw new ScaffoldError(`--host takes ${Object.keys(HOSTS).join(", ")}.`);
  }
  let blocks: string | undefined = values.blocks;
  if (blocks !== undefined && !(blocks in BLOCK_CHOICES)) {
    throw new ScaffoldError(`--blocks takes ${Object.keys(BLOCK_CHOICES).join(" or ")}.`);
  }

  if (stdin.isTTY && !values.yes) {
    const rl = createInterface({ input: stdin, output: stdout });
    try {
      if (!folder) folder = (await rl.question("Folder for the new site (my-site): ")).trim() || "my-site";
      template ??= await choose(
        rl,
        "Start from:",
        Object.entries(TEMPLATES).map(([value, { label, description }]) => ({
          value: value as TemplateName,
          label,
          note: description,
        })),
      );
      let storage = backend?.host;
      if (!backend) {
        storage = await choose<Backend["host"] | undefined>(
          rl,
          "Where will the site be stored? Editors sign in there, and publishing saves to it.",
          [
            { value: "github", label: "GitHub" },
            { value: "gitlab", label: "GitLab" },
            { value: undefined, label: "Not decided yet" },
          ],
        );
        const repo = storage && (await askRepo(rl, storage));
        if (storage && repo) backend = { host: storage, repo };
      }
      host ??= await chooseHost(rl, storage);
      blocks ??= await choose(
        rl,
        "Which blocks should the editor offer to start with?",
        Object.entries(BLOCK_CHOICES).map(([value, { label, description }]) => ({
          value: value as BlockChoice,
          label,
          note: description,
        })),
      );
    } finally {
      rl.close();
    }
  }

  if (!folder) {
    throw new ScaffoldError("Say which folder to create the site in, such as: npm create goodfellow@latest my-site");
  }
  if (host && backend && !hostsFor(backend.host).includes(host as Host)) {
    throw new ScaffoldError(`${HOSTS[host as Host].label} can't serve a site stored on ${HOST_NAMES[backend.host]}.`);
  }

  const target = resolve(folder);
  const versions = JSON.parse(readFileSync(join(templatesDir, "versions.json"), "utf8")) as Record<string, string>;
  await scaffold({
    template: join(templatesDir, template ?? "starter"),
    target,
    versions,
    ...(backend && { backend }),
    ...(host && { host: host as Host }),
    ...((blocks ?? "recommended") === "recommended" && { registryDir: join(templatesDir, "registry") }),
  });

  const where = relative(process.cwd(), target) || ".";
  const lines = [
    "",
    `Created a new site in ${where}.`,
    "",
    "Next:",
    ...(where === "." ? [] : [`  cd ${/\s/.test(where) ? JSON.stringify(where) : where}`]),
    "  npm install",
    "  npm run dev",
    "",
    "Then open http://localhost:4321/admin to start editing. README.md explains how to put the site online.",
  ];
  if (!backend) {
    lines.push("Before you do, say where the site is stored in goodfellow.config.tsx; README.md shows how.");
  }
  stdout.write(`${lines.join("\n")}\n`);
}

async function chooseHost(rl: Interface, storage: Backend["host"] | undefined): Promise<Host | undefined> {
  stdout.write(
    "\nEach host's free plan has its own rules about business use. Check them if the site is for a business,",
  );
  stdout.write("\nsells anything, shows ads, or anyone is paid to build or look after it.\n");
  return choose<Host | undefined>(rl, "Where will the site be hosted?", [
    ...hostsFor(storage).map((value) => ({ value, label: HOSTS[value].label, note: HOSTS[value].note })),
    { value: undefined, label: "Not decided yet", note: "Keeps the setup files for every host." },
  ]);
}

main().catch((error: unknown) => {
  if ((error as { code?: string }).code === "ABORT_ERR") process.exit(130);
  console.error(error instanceof ScaffoldError ? error.message : error);
  process.exit(1);
});
