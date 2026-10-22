"use client";
export default function SaveNotice({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return message ? (
    <div className="notice save-notice">
      <p role="status">{message}</p>
      <button
        type="button"
        className="icon-button"
        aria-label="Dismiss confirmation"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  ) : null;
}
