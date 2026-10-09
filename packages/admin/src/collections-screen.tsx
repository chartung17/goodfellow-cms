import { addressPatternProblem, isAddressSegment } from "@goodfellow-cms/core";
import { type FormEvent, useState } from "react";
import { useAdmin, useSiteContent } from "./admin-context.js";
import { addressPatternFor, collectionFileChange, newCollectionSettings, slugify } from "./changes.js";
import { type Failure, PublishFailure } from "./publish-failure.js";
import { collectionHref, navigate } from "./router.js";
import { useStrings } from "./strings.js";
import { Button, Dialog, TextField } from "./ui.js";

function NewCollectionDialog({ onClose }: { onClose: () => void }) {
  const t = useStrings();
  const { config, publish } = useAdmin();
  const { content } = useSiteContent();
  const [name, setName] = useState("");
  const [entryName, setEntryName] = useState("");
  const [withPages, setWithPages] = useState(true);
  const [address, setAddress] = useState("/");
  const [addressEdited, setAddressEdited] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure>(null);

  const id = slugify(name);
  const pattern = addressPatternFor(address);
  const nameError = !name.trim()
    ? t("field.required")
    : !isAddressSegment(id) || content.collections.some((collection) => collection.id === id)
      ? t("newCollection.nameTaken")
      : undefined;
  const entryNameError = entryName.trim() ? undefined : t("field.required");
  const addressError =
    withPages && (address.trim() === "/" || addressPatternProblem(pattern) !== undefined)
      ? t("address.invalid")
      : undefined;
  const valid = !nameError && !entryNameError && !addressError;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!valid) return;
    setBusy(true);
    const settings = newCollectionSettings({
      name: name.trim(),
      entryName: entryName.trim(),
      path: withPages ? pattern : undefined,
      withEntryFields: "EntryField" in config.blocks,
    });
    const result = await publish(
      [collectionFileChange(id, settings)],
      t("newCollection.message", { name: name.trim() }),
    );
    setBusy(false);
    if (result.ok) {
      onClose();
      navigate(collectionHref(id), () => true);
    } else {
      setFailure(result);
    }
  };

  return (
    <Dialog title={t("newCollection.title")} onClose={onClose}>
      <form onSubmit={onSubmit} className="gfa-form" noValidate>
        <TextField
          label={t("newCollection.name")}
          hint={t("newCollection.nameHint")}
          value={name}
          error={submitted ? nameError : undefined}
          autoFocus
          onChange={(value) => {
            setName(value);
            if (!addressEdited) setAddress(`/${slugify(value)}`);
          }}
        />
        <TextField
          label={t("newCollection.entryName")}
          hint={t("newCollection.entryNameHint")}
          value={entryName}
          error={submitted ? entryNameError : undefined}
          onChange={setEntryName}
        />
        <label className="gfa-checkbox">
          <input type="checkbox" checked={withPages} onChange={(event) => setWithPages(event.target.checked)} />
          {t("newCollection.pages")}
        </label>
        {withPages && (
          <TextField
            label={t("newCollection.address")}
            hint={t("newCollection.addressHint")}
            value={address}
            error={submitted ? addressError : undefined}
            onChange={(value) => {
              setAddress(value);
              setAddressEdited(true);
            }}
          />
        )}
        <PublishFailure failure={failure} />
        <div className="gfa-dialog-actions">
          <Button onClick={onClose}>{t("action.cancel")}</Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? t("publish.publishing") : t("newCollection.create")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function CollectionsScreen() {
  const t = useStrings();
  const { content } = useSiteContent();
  const [creating, setCreating] = useState(false);

  return (
    <div className="gfa-screen">
      <div className="gfa-screen-header">
        <h1>{t("collections.title")}</h1>
        <Button variant="primary" onClick={() => setCreating(true)}>
          {t("collections.new")}
        </Button>
      </div>
      <p className="gfa-hint">{t("collections.intro")}</p>

      {content.collections.length === 0 ? (
        <p>{t("collections.empty")}</p>
      ) : (
        <table className="gfa-table">
          <thead>
            <tr>
              <th>{t("collections.column.name")}</th>
              <th>{t("collections.column.count")}</th>
              <th>{t("collections.column.address")}</th>
            </tr>
          </thead>
          <tbody>
            {content.collections.map((collection) => (
              <tr key={collection.id}>
                <td>
                  <a href={collectionHref(collection.id)} className="gfa-link-strong">
                    {collection.settings.name}
                  </a>
                </td>
                <td>{collection.entries.length}</td>
                <td>
                  {collection.settings.path ? (
                    <code>{collection.settings.path}</code>
                  ) : (
                    <span className="gfa-hint">{t("collections.noPages")}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {creating && <NewCollectionDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
