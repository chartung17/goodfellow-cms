import {
  type AvailableBlock,
  availableBlocks,
  type BlockUse,
  blockUses,
  type FetchJson,
  INSTALLED_RECORD_FILE,
  type InstalledRecord,
  parseInstalledRecord,
  planInstall,
  planRemove,
  RegistryError,
  type RegistryProblem,
} from "@goodfellow/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin, useSiteContent } from "./admin-context.js";
import { type Failure, PublishFailure } from "./publish-failure.js";
import { type StringKey, type Translate, useStrings } from "./strings.js";
import { Button, Dialog, ErrorMessage } from "./ui.js";

const fetchJson: FetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} answered ${response.status}.`);
  return response.json();
};

/** What went wrong with a block registry, in plain words. */
function problemText(t: Translate, problem: RegistryProblem, name: string): string {
  const key = `blocks.error.${problem.code}` as StringKey;
  if (problem.code === "packages") return t(key, { packages: problem.packages.join(", ") });
  if (problem.code === "file-exists" || problem.code === "unsupported-file") return t(key, { path: problem.path });
  return t(key, { name });
}

/** The places a block is used, as they're named elsewhere in the admin panel. */
function placesText(t: Translate, uses: BlockUse[]): string {
  return uses
    .map((use) => {
      if (use.kind === "page") return use.title ? `${use.title} (${use.path})` : use.path;
      if (use.kind === "template") return t("blocks.usedTemplate", { name: use.name });
      return t(use.kind === "header" ? "layout.header" : "layout.footer");
    })
    .join(", ");
}

type Notice = { type: "added" | "removed"; name: string } | { type: "failed"; message: string; error?: unknown };

function RemoveBlockDialog({
  name,
  title,
  record,
  onDone,
  onClose,
}: {
  name: string;
  title: string;
  record: InstalledRecord;
  onDone: () => void;
  onClose: () => void;
}) {
  const t = useStrings();
  const { publish, readFile } = useAdmin();
  const { content } = useSiteContent();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure>(null);
  const [error, setError] = useState<string>();
  const uses = useMemo(() => blockUses(content, name), [content, name]);

  const onRemove = async () => {
    setBusy(true);
    try {
      const plan = await planRemove({ name, record, readFile, content });
      const result = await publish(plan.changes, t("blocks.removeMessage", { name: title }));
      if (result.ok) onDone();
      else setFailure(result);
    } catch (caught) {
      setError(caught instanceof RegistryError ? problemText(t, caught.problem, title) : t("publish.error"));
    }
    setBusy(false);
  };

  return (
    <Dialog title={t("blocks.removeTitle", { name: title })} onClose={onClose}>
      <p>
        {uses.length > 0
          ? t("blocks.inUse", { name: title, places: placesText(t, uses) })
          : t("blocks.removeBody", { name: title })}
      </p>
      {error && <ErrorMessage message={error} />}
      <PublishFailure failure={failure} />
      <div className="gfa-dialog-actions">
        <Button onClick={onClose}>{t("action.cancel")}</Button>
        {uses.length === 0 && (
          <Button variant="danger" disabled={busy} onClick={() => void onRemove()}>
            {busy ? t("publish.publishing") : t("blocks.remove")}
          </Button>
        )}
      </div>
    </Dialog>
  );
}

function BlockCard({
  block,
  installed,
  busy,
  onAdd,
}: {
  block: AvailableBlock;
  installed: boolean;
  busy: boolean;
  onAdd: () => void;
}) {
  const t = useStrings();
  return (
    <li className="gfa-block-card">
      {block.image && <img src={block.image} alt="" className="gfa-block-image" loading="lazy" />}
      <div className="gfa-block-text">
        <h3 className="gfa-block-title">
          {block.title}
          {block.recommended && <span className="gfa-badge">{t("blocks.recommended")}</span>}
        </h3>
        {block.description && <p className="gfa-hint">{block.description}</p>}
      </div>
      {installed ? (
        <span className="gfa-block-added">{t("blocks.added")}</span>
      ) : (
        <Button disabled={busy} onClick={onAdd} aria-label={t("blocks.addLabel", { name: block.title })}>
          {t("blocks.add")}
        </Button>
      )}
    </li>
  );
}

/**
 * Adds blocks from block registries to the site, and removes them. Adding
 * writes the block's code into the site in one publish; the editor offers it
 * once the site has been rebuilt with it.
 */
export function BlocksScreen() {
  const t = useStrings();
  const { config, registries, readFile, publish, demo } = useAdmin();
  const { revision } = useSiteContent();
  const [record, setRecord] = useState<InstalledRecord>();
  const [available, setAvailable] = useState<AvailableBlock[]>();
  const [recordError, setRecordError] = useState<unknown>();
  const [loadError, setLoadError] = useState<unknown>();
  const [busy, setBusy] = useState<string>();
  const [notice, setNotice] = useState<Notice>();
  const [removing, setRemoving] = useState<{ name: string; title: string }>();

  // The record is read again after each publish, which changes the revision.
  useEffect(() => {
    let current = true;
    // The revision changes after each publish, and with it what the record says.
    void revision;
    readFile(INSTALLED_RECORD_FILE)
      .then((text) => parseInstalledRecord(text))
      .then(
        (next) => current && setRecord(next),
        (error: unknown) => current && setRecordError(error),
      );
    return () => {
      current = false;
    };
  }, [readFile, revision]);

  const loadAvailable = useCallback(() => {
    setLoadError(undefined);
    availableBlocks(registries, fetchJson).then(setAvailable, setLoadError);
  }, [registries]);
  useEffect(loadAvailable, [loadAvailable]);

  const onAdd = async (block: AvailableBlock) => {
    if (!record) return;
    setBusy(block.ref);
    setNotice(undefined);
    try {
      const plan = await planInstall({
        ref: block.ref,
        registries,
        fetchJson,
        readFile,
        record,
        blocks: Object.keys(config.blocks),
      });
      const result = await publish(plan.changes, t("blocks.addMessage", { name: block.title }));
      setNotice(
        result.ok
          ? { type: "added", name: block.title }
          : {
              type: "failed",
              message: t(result.reason === "conflict" ? "publish.conflict" : "publish.error"),
              error: result.error,
            },
      );
    } catch (error) {
      setNotice({
        type: "failed",
        message: error instanceof RegistryError ? problemText(t, error.problem, block.title) : t("publish.error"),
        error,
      });
    }
    setBusy(undefined);
  };

  const installed = record ? Object.entries(record.blocks).sort(([, a], [, b]) => a.title.localeCompare(b.title)) : [];
  const categories = new Map<string, AvailableBlock[]>();
  for (const block of available ?? [])
    categories.set(block.category, [...(categories.get(block.category) ?? []), block]);

  return (
    <div className="gfa-screen">
      <div className="gfa-screen-header">
        <h1>{t("blocks.title")}</h1>
      </div>
      <p className="gfa-hint">{t("blocks.intro")}</p>
      {demo && (
        <p className="gfa-notice" role="note">
          {t("blocks.demo")}
        </p>
      )}

      {notice?.type === "added" && (
        <p className="gfa-notice gfa-notice-success" role="status">
          {t("blocks.addedNotice", { name: notice.name })}
        </p>
      )}
      {notice?.type === "removed" && (
        <p className="gfa-notice gfa-notice-success" role="status">
          {t("blocks.removedNotice", { name: notice.name })}
        </p>
      )}
      {notice?.type === "failed" && <ErrorMessage message={notice.message} error={notice.error} />}

      <h2 className="gfa-section-title">{t("blocks.installed")}</h2>
      {installed.length === 0 ? (
        <p className="gfa-hint">{record ? t("blocks.noneInstalled") : t("loading")}</p>
      ) : (
        <ul className="gfa-block-list">
          {installed.map(([name, block]) => (
            <li key={name} className="gfa-block-row">
              <span>
                <strong>{block.title}</strong> <span className="gfa-hint">{block.category}</span>
              </span>
              <Button
                variant="ghost"
                disabled={Boolean(demo)}
                aria-label={t("blocks.removeLabel", { name: block.title })}
                onClick={() => setRemoving({ name, title: block.title })}
              >
                {t("blocks.remove")}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {recordError !== undefined && <ErrorMessage message={t("blocks.error.record")} error={recordError} />}
      {loadError !== undefined && (
        <ErrorMessage
          message={
            loadError instanceof RegistryError ? problemText(t, loadError.problem, "") : t("blocks.error.unreachable")
          }
          error={loadError}
          action={<Button onClick={loadAvailable}>{t("action.tryAgain")}</Button>}
        />
      )}
      {!available && loadError === undefined && <p className="gfa-hint">{t("blocks.loading")}</p>}
      {[...categories].map(([category, blocks]) => (
        <section key={category}>
          <h2 className="gfa-section-title">{category}</h2>
          <ul className="gfa-block-grid">
            {blocks.map((block) => (
              <BlockCard
                key={block.ref}
                block={block}
                installed={Boolean(record?.blocks[block.name])}
                busy={busy !== undefined || !record || Boolean(demo)}
                onAdd={() => void onAdd(block)}
              />
            ))}
          </ul>
        </section>
      ))}

      {removing && record && (
        <RemoveBlockDialog
          name={removing.name}
          title={removing.title}
          record={record}
          onClose={() => setRemoving(undefined)}
          onDone={() => {
            setNotice({ type: "removed", name: removing.title });
            setRemoving(undefined);
          }}
        />
      )}
    </div>
  );
}
