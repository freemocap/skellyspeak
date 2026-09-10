import { useRef } from "react";

export function KeyBadge({
  state,
  label,
  detail,
  configured,
  disabled,
  onRemove,
  onClear,
}: {
  state: "idle" | "checking" | "valid" | "invalid";
  label: string;
  detail: string;
  configured: boolean;
  disabled: boolean;
  onRemove: () => void;
  onClear?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const status =
    state === "valid"
      ? "✓"
      : state === "invalid"
        ? "✕"
        : state === "checking"
          ? "…"
          : configured
            ? "•"
            : "";
  return (
    <>
      <span
        className={`key-badge ${state}`}
        role="status"
        aria-label={
          label === "OpenRouter API key"
            ? state === "valid"
              ? "API key validated"
              : state === "invalid"
                ? "API key not validated"
                : state === "checking"
                  ? "Checking API key"
                  : "API key not checked"
            : `${label}: ${state}`
        }
        title={detail}
      >
        {onClear ? (
          <button
            type="button"
            className="key-delete-control"
            aria-label={`Clear ${label} entry`}
            title="Clear entry"
            disabled={disabled}
            onClick={onClear}
          >
            ✕
          </button>
        ) : configured ? (
          <button
            type="button"
            className="key-delete-control"
            aria-label={`Delete ${label}`}
            title={`Delete ${label}`}
            disabled={disabled}
            onClick={() => dialog.current?.showModal()}
          >
            <span className="key-check-icon" aria-hidden="true">
              {status}
            </span>
            <span className="key-delete-icon" aria-hidden="true">
              ✕
            </span>
          </button>
        ) : (
          status
        )}
      </span>
      <dialog
        ref={dialog}
        className="key-delete-dialog"
        aria-label={`Delete ${label}?`}
        onClick={(event) => event.stopPropagation()}
      >
        <h3>Are you sure?</h3>
        <p>Delete the saved {label}?</p>
        <div className="account-actions">
          <button
            type="button"
            autoFocus
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </button>
          <button
            type="button"
            className="key-delete-confirm"
            disabled={disabled}
            onClick={() => {
              dialog.current?.close();
              onRemove();
            }}
          >
            Delete key
          </button>
        </div>
      </dialog>
    </>
  );
}
