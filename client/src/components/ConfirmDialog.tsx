/** Inventory Studio design reminder: reuses the ivory modal chrome + ceramic-orange action button. */
import { AlertTriangle } from "lucide-react";

export type ConfirmDialogState = {
  title: string;
  message: string;
  /** Label for the confirming action. Defaults to "Remove". Pass null to render a single-button notice (no cancel). */
  confirmLabel?: string | null;
  onConfirm?: () => void;
};

export function ConfirmDialog({
  state,
  onClose,
}: {
  state: ConfirmDialogState;
  onClose: () => void;
}) {
  const isNotice = state.confirmLabel === null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="confirm-icon">
          <AlertTriangle size={20} />
        </div>
        <h2 id="confirm-dialog-title">{state.title}</h2>
        <p>{state.message}</p>
        <div className="confirm-actions">
          {!isNotice && (
            <button type="button" className="cancel" onClick={onClose}>
              Cancel
            </button>
          )}
          <button
            type="button"
            className="save"
            onClick={() => {
              state.onConfirm?.();
              onClose();
            }}
          >
            {isNotice ? "OK" : (state.confirmLabel ?? "Remove")}
          </button>
        </div>
      </div>
    </div>
  );
}
