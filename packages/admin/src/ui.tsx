import { type ReactNode, useEffect, useId, useRef } from "react";
import { useStrings } from "./strings.js";

export function Button({
  variant = "secondary",
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  return <button type={type} {...props} className={`gfa-button gfa-button-${variant} ${props.className ?? ""}`} />;
}

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
}

/** A labelled form control with an optional hint and error message. */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="gfa-field">
      <label htmlFor={id} className="gfa-label">
        {label}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint && (
        <p id={`${id}-hint`} className="gfa-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="gfa-error-text">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  value,
  onChange,
  ...input
}: Omit<FieldProps, "children"> &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
    value: string;
    onChange: (value: string) => void;
  }) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(props) => (
        <input
          {...input}
          {...props}
          className="gfa-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

/** Shows what went wrong in plain words, with the technical details behind a toggle. */
export function ErrorMessage({ message, error, action }: { message: string; error?: unknown; action?: ReactNode }) {
  const t = useStrings();
  const details = error instanceof Error ? `${error.name}: ${error.message}` : error ? String(error) : "";
  return (
    <div className="gfa-notice gfa-notice-error" role="alert">
      <p>{message}</p>
      {details && (
        <details className="gfa-details">
          <summary>{t("details.show")}</summary>
          <pre>{details}</pre>
        </details>
      )}
      {action}
    </div>
  );
}

/** A modal dialog using the native `<dialog>` element. */
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className="gfa-dialog" onClose={onClose} aria-labelledby="gfa-dialog-title">
      <h2 id="gfa-dialog-title" className="gfa-dialog-title">
        {title}
      </h2>
      {children}
    </dialog>
  );
}
