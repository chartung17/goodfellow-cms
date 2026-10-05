import {
  AiError,
  type AiRequest,
  type AiTask,
  buildRequest,
  CLAUDE_MODELS,
  listModels,
  manualPrompt,
  PROVIDERS,
  type ProviderId,
  parseAnswer,
  runRequest,
  type SiteSummary,
  toContent,
  toValues,
} from "@goodfellow/ai";
import { allPages, type Collection, entryTitle, type SiteContent } from "@goodfellow/core";
import { type ComponentData, createUsePuck, type Fields, type Plugin, useGetPuck } from "@puckeditor/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAdmin, useSiteContent } from "./admin-context.js";
import { allowedProviders, useAiSettings } from "./ai-settings.js";
import { pageTitle } from "./changes.js";
import { inSentence } from "./collection-screen.js";
import { type StringKey, useStrings } from "./strings.js";
import { Button, ErrorMessage, Field, TextField } from "./ui.js";

const usePuck = createUsePuck();

/** Which editor the panel is in, which decides what it can do. */
export interface AiContext {
  kind: "page" | "header" | "footer" | "template" | "entry";
  path: string;
  title: string;
  collection?: Collection;
}

type Mode = "add" | "edit" | "fill";

const claudeModelLabels: Record<string, StringKey> = {
  "claude-opus-5-5": "ai.model.claude-opus-5-5",
  "claude-sonnet-5-5": "ai.model.claude-sonnet-5-5",
  "claude-haiku-4-5": "ai.model.claude-haiku-4-5",
};

function siteSummary(content: SiteContent): SiteSummary {
  return {
    title: content.settings.title,
    description: content.settings.description,
    language: content.settings.language,
    pages: allPages(content)
      .slice(0, 200)
      .map((page) => {
        const found = page.entry && content.collections.find((collection) => collection.id === page.entry?.collection);
        const entry = found?.entries.find((candidate) => candidate.slug === page.entry?.slug);
        return { path: page.path, title: entry ? entryTitle(entry) : pageTitle(page) };
      }),
    collections: content.collections.map((collection) => ({
      id: collection.id,
      name: collection.settings.name,
      fields: collection.settings.fields.map(({ name, label }) => ({ name, label })),
    })),
  };
}

function newId(type: string): string {
  return `${type}-${crypto.randomUUID()}`;
}

type Status =
  | { type: "idle" }
  | { type: "working"; characters: number }
  | { type: "done" }
  | { type: "failed"; error: unknown }
  | { type: "manual"; prompt: string; task: AiTask };

function problemKey(error: unknown): StringKey {
  if (error instanceof AiError) return `ai.error.${error.problem}` as StringKey;
  if (error instanceof SyntaxError) return "ai.error.answer";
  return "ai.error.service";
}

function ServiceSettings({
  providers,
  settings,
  onChange,
}: {
  providers: ProviderId[];
  settings: ReturnType<typeof useAiSettings>[0];
  onChange: ReturnType<typeof useAiSettings>[1];
}) {
  const t = useStrings();
  const info = PROVIDERS[settings.provider];
  const service = serviceName(settings.provider, t);
  const [models, setModels] = useState<string[]>(info.models ?? []);
  const listId = useRef(`gfa-ai-models-${Math.random().toString(36).slice(2)}`).current;

  // Ask the service which models it has, once it can be asked.
  const { provider, apiKey, baseUrl } = settings;
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setModels(PROVIDERS[provider].models ?? []);
    const timer = setTimeout(() => {
      listModels({ provider, apiKey, baseUrl, model: "" }, { signal: controller.signal })
        .then((found) => {
          if (!cancelled && found.length > 0) setModels(found);
        })
        .catch(() => {});
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [provider, apiKey, baseUrl]);

  return (
    <div className="gfa-form gfa-ai-settings">
      <Field label={t("ai.provider")}>
        {(props) => (
          <select
            {...props}
            className="gfa-input"
            value={settings.provider}
            onChange={(event) => onChange({ provider: event.target.value as ProviderId })}
          >
            {providers.map((id) => (
              <option key={id} value={id}>
                {serviceName(id, t)}
                {!PROVIDERS[id].needsKey && id !== "manual" && id !== "custom" ? ` ${t("ai.noKey")}` : ""}
              </option>
            ))}
          </select>
        )}
      </Field>

      {settings.provider === "custom" && (
        <TextField
          label={t("ai.baseUrl")}
          hint={t("ai.baseUrlHint")}
          type="url"
          value={settings.baseUrl ?? ""}
          onChange={(baseUrl) => onChange({ baseUrl })}
        />
      )}

      {settings.provider !== "manual" && (info.needsKey || settings.provider === "custom") && (
        <>
          <TextField
            label={t("ai.key")}
            hint={t("ai.keyHint", { service })}
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={settings.apiKey ?? ""}
            onChange={(apiKey) => onChange({ apiKey: apiKey.trim() || undefined })}
          />
          {info.keyUrl && (
            <a className="gfa-hint" href={info.keyUrl} target="_blank" rel="noreferrer">
              {t("ai.getKey", { service })}
            </a>
          )}
          <label className="gfa-checkbox">
            <input
              type="checkbox"
              checked={settings.remember}
              onChange={(event) => onChange({ remember: event.target.checked })}
            />
            {t("ai.remember")}
          </label>
          {info.needsKey && <p className="gfa-hint">{t("ai.costHint", { service })}</p>}
          {settings.apiKey && (
            <div>
              <Button variant="ghost" onClick={() => onChange({ apiKey: undefined })}>
                {t("ai.forget")}
              </Button>
            </div>
          )}
        </>
      )}

      {settings.provider === "anthropic" ? (
        <Field label={t("ai.model")}>
          {(props) => (
            <select
              {...props}
              className="gfa-input"
              value={settings.model}
              onChange={(event) => onChange({ model: event.target.value })}
            >
              {CLAUDE_MODELS.map((model) => (
                <option key={model} value={model}>
                  {claudeModelLabels[model] ? t(claudeModelLabels[model]) : model}
                </option>
              ))}
            </select>
          )}
        </Field>
      ) : (
        settings.provider !== "manual" && (
          <>
            <TextField
              label={t("ai.model")}
              hint={t("ai.modelHint")}
              list={listId}
              spellCheck={false}
              value={settings.model}
              onChange={(model) => onChange({ model: model.trim() })}
            />
            <datalist id={listId}>
              {models.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
          </>
        )
      )}
    </div>
  );
}

function serviceName(id: ProviderId, t: ReturnType<typeof useStrings>): string {
  if (id === "manual") return t("ai.provider.manual");
  if (id === "custom") return t("ai.provider.custom");
  return PROVIDERS[id].name;
}

/** The AI panel: describe what to write, and it's added to the page, replaces the selected block, or fills in the fields. */
function AiPanel({ context }: { context: AiContext }) {
  const t = useStrings();
  const { config } = useAdmin();
  const { content } = useSiteContent();
  const getPuck = useGetPuck();
  const selected = usePuck((state) => state.selectedItem);
  const providers = useMemo(() => allowedProviders(config.ai ? config.ai.providers : undefined), [config.ai]);
  const [settings, updateSettings] = useAiSettings(providers);
  const [instruction, setInstruction] = useState("");
  const [reply, setReply] = useState("");
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const controller = useRef<AbortController | null>(null);

  const mode: Mode = context.kind === "entry" ? "fill" : selected ? "edit" : "add";
  const service = serviceName(settings.provider, t);
  const blockName = (block: ComponentData | null) =>
    block ? (getPuck().config.components[block.type]?.label ?? block.type) : "";
  const itemName = inSentence(context.collection?.settings.entryName ?? "");
  const ready =
    settings.provider === "manual" ||
    (Boolean(settings.model) && (!PROVIDERS[settings.provider].needsKey || Boolean(settings.apiKey)));

  // Open at first if the service isn't set up yet, and then wherever the editor leaves it.
  const [settingsOpen, setSettingsOpen] = useState(!ready);

  useEffect(() => () => controller.current?.abort(), []);

  const taskFor = (text: string): AiTask => {
    const { appState, config: puckConfig, selectedItem } = getPuck();
    if (mode === "fill") {
      return {
        kind: "fill",
        name: itemName,
        fields: (puckConfig.root?.fields ?? {}) as Fields,
        values: { ...(appState.data.root.props ?? {}) },
        instruction: text,
      };
    }
    if (mode === "edit" && selectedItem) return { kind: "edit", block: selectedItem, instruction: text };
    return {
      kind: "add",
      page: { path: context.path, title: context.title },
      content: appState.data.content,
      ...(context.kind === "template" &&
        context.collection && {
          template: {
            name: context.collection.settings.name,
            fields: context.collection.settings.fields.map(({ name, label }) => ({ name, label })),
          },
        }),
      instruction: text,
    };
  };

  /** Puts the AI's answer into the editor, where Undo can take it back. */
  const apply = (task: AiTask, answer: unknown) => {
    const { appState, config: puckConfig, dispatch, getSelectorForId } = getPuck();
    if (task.kind === "fill") {
      const values = toValues(answer, task.fields, task.values);
      dispatch({ type: "replaceRoot", root: { ...appState.data.root, props: values } });
      return;
    }
    const blocks = toContent(answer, puckConfig, newId);
    const [first] = blocks;
    if (!first) throw new AiError("answer", "The answer didn't contain any blocks that could be used.");
    if (task.kind === "edit") {
      const selector = getSelectorForId(task.block.props.id);
      if (!selector) throw new AiError("answer", "The block being changed is no longer on the page.");
      dispatch({
        type: "replace",
        destinationIndex: selector.index,
        destinationZone: selector.zone,
        // Puck replaces a block only if it keeps its id.
        data: { ...first, props: { ...first.props, id: task.block.props.id } },
        ui: { itemSelector: selector },
      });
      return;
    }
    dispatch({ type: "setData", data: (previous) => ({ ...previous, content: [...previous.content, ...blocks] }) });
  };

  const run = async () => {
    const text = instruction.trim();
    if (!text) return;
    const task = taskFor(text);
    const request: AiRequest = buildRequest(task, getPuck().config, siteSummary(content));
    if (settings.provider === "manual") {
      setReply("");
      setCopied(false);
      setStatus({ type: "manual", prompt: manualPrompt(request), task });
      return;
    }
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setStatus({ type: "working", characters: 0 });
    try {
      const answer = await runRequest(settings, request, {
        signal: current.signal,
        onProgress: (characters) => setStatus({ type: "working", characters }),
      });
      if (current.signal.aborted) return;
      apply(task, answer);
      setStatus({ type: "done" });
    } catch (error) {
      if (current.signal.aborted) setStatus({ type: "idle" });
      else setStatus({ type: "failed", error });
    }
  };

  const applyReply = () => {
    if (status.type !== "manual") return;
    try {
      apply(status.task, parseAnswer(reply));
      setStatus({ type: "done" });
    } catch (error) {
      setStatus({ type: "failed", error });
    }
  };

  const working = status.type === "working";

  return (
    <div className="gfa-ai">
      <h2 className="gfa-ai-title">{t("ai.title")}</h2>
      <p className="gfa-hint">
        {mode === "fill"
          ? t("ai.mode.fill", { item: itemName })
          : mode === "edit"
            ? t("ai.mode.edit", { block: blockName(selected) })
            : t("ai.mode.add")}
      </p>

      <Field label={t("ai.instruction")}>
        {(props) => (
          <textarea
            {...props}
            className="gfa-input"
            rows={6}
            value={instruction}
            placeholder={t(
              mode === "fill" ? "ai.placeholder.fill" : mode === "edit" ? "ai.placeholder.edit" : "ai.placeholder.add",
            )}
            onChange={(event) => setInstruction(event.target.value)}
          />
        )}
      </Field>

      {!ready && <p className="gfa-hint">{t("ai.needsKey", { service })}</p>}

      <div className="gfa-ai-actions">
        <Button variant="primary" disabled={working || !ready || !instruction.trim()} onClick={() => void run()}>
          {t(mode === "fill" ? "ai.fill" : mode === "edit" ? "ai.change" : "ai.write")}
        </Button>
        {working && <Button onClick={() => controller.current?.abort()}>{t("ai.stop")}</Button>}
      </div>

      {working && (
        <p className="gfa-notice" role="status">
          {status.characters > 0 ? t("ai.progress", { count: String(status.characters) }) : t("ai.working")}
        </p>
      )}
      {status.type === "done" && (
        <p className="gfa-notice gfa-notice-success" role="status">
          {t("ai.done")}
        </p>
      )}
      {status.type === "failed" && (
        <ErrorMessage message={t(problemKey(status.error), { service })} error={status.error} />
      )}

      {status.type === "manual" && (
        <div className="gfa-form gfa-ai-manual">
          <Field label={t("ai.manual.step1")}>
            {(props) => <textarea {...props} className="gfa-input gfa-code" rows={5} readOnly value={status.prompt} />}
          </Field>
          <div>
            <Button
              onClick={() =>
                void navigator.clipboard?.writeText(status.prompt).then(
                  () => setCopied(true),
                  () => setCopied(false),
                )
              }
            >
              {copied ? t("ai.manual.copied") : t("ai.manual.copy")}
            </Button>
          </div>
          <Field label={t("ai.manual.step2")}>
            {(props) => (
              <textarea
                {...props}
                className="gfa-input gfa-code"
                rows={5}
                value={reply}
                onChange={(event) => setReply(event.target.value)}
              />
            )}
          </Field>
          <div>
            <Button variant="primary" disabled={!reply.trim()} onClick={applyReply}>
              {t("ai.manual.use")}
            </Button>
          </div>
        </div>
      )}

      <p className="gfa-hint">{t("ai.check")}</p>

      <details
        className="gfa-ai-service"
        open={settingsOpen}
        onToggle={(event) => setSettingsOpen(event.currentTarget.open)}
      >
        <summary>{t("ai.settings", { service })}</summary>
        <ServiceSettings providers={providers} settings={settings} onChange={updateSettings} />
      </details>
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z" strokeLinejoin="round" />
      <path d="M19 15v4M17 17h4" strokeLinecap="round" />
    </svg>
  );
}

/** The AI panel as a Puck plugin, shown in the editor's left-hand rail. */
export function aiPlugin(context: AiContext, label: string): Plugin {
  return {
    name: "ai",
    label,
    icon: <SparkleIcon />,
    render: () => <AiPanel context={context} />,
  };
}
