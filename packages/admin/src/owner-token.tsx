import { EditorsError } from "@goodfellow-cms/core";
import { useState } from "react";
import { useAdmin } from "./admin-context.js";
import { useStrings } from "./strings.js";
import { Button, ErrorMessage, TextField } from "./ui.js";

/**
 * Asks for the owner token that hosts such as GitHub need for changing editors
 * and Pages settings, which signing in can't. It's used for this tab only.
 */
export function OwnerTokenForm({ onReady }: { onReady: () => void }) {
  const t = useStrings();
  const { ownerAccess, account } = useAdmin();
  const host = account?.hostName ?? "";
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  if (!ownerAccess) return null;

  const use = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await ownerAccess.applyToken(token);
      setToken("");
      onReady();
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  return (
    // Not a <form>: screens show this inside their own forms, and forms can't be nested.
    <section className="gfa-form gfa-owner-token">
      <h2 className="gfa-section-title">{t("owner.token.title")}</h2>
      <p>{t("owner.token.intro", { host })}</p>
      <ol>
        <li>
          <a href={ownerAccess.tokenLink.url} target="_blank" rel="noreferrer">
            {t(ownerAccess.tokenLink.label, { host })}
          </a>{" "}
          {t("owner.token.chooseSite", { host })}
        </li>
        <li>{t("owner.token.paste")}</li>
      </ol>
      <TextField
        label={t("owner.token.label")}
        type="password"
        autoComplete="off"
        value={token}
        onChange={setToken}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          if (token.trim()) void use();
        }}
      />
      {error !== undefined && (
        <ErrorMessage
          message={t(error instanceof EditorsError ? "owner.token.error" : "editors.error.other")}
          error={error}
        />
      )}
      <div>
        <Button variant="primary" disabled={busy || !token.trim()} onClick={() => void use()}>
          {busy ? t("owner.token.checking") : t("owner.token.use")}
        </Button>
      </div>
    </section>
  );
}

/** Says an owner token is in use in this tab, with a way to stop using it. */
export function OwnerTokenActive({ onForget }: { onForget: () => void }) {
  const t = useStrings();
  const { ownerAccess } = useAdmin();
  if (!ownerAccess?.active) return null;
  return (
    <p className="gfa-notice">
      {t("owner.token.active")}{" "}
      <Button
        variant="ghost"
        onClick={() => {
          ownerAccess.forget();
          onForget();
        }}
      >
        {t("owner.token.forget")}
      </Button>
    </p>
  );
}
