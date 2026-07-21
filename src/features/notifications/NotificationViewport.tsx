import { useEffect } from "react";
import { CloseIcon } from "../../components/ui/icons";
import { useNotificationStore } from "./notificationStore";

export function NotificationViewport() {
  const messages = useNotificationStore((state) => state.messages);
  const dismiss = useNotificationStore((state) => state.dismiss);
  const reset = useNotificationStore((state) => state.reset);

  useEffect(() => reset, [reset]);

  return (
    <div className="toast-stack" aria-label="Notifications" aria-live="polite">
      {messages.map((message) => (
        <div
          className="toast-message"
          data-kind={message.kind}
          key={message.id}
          role={message.kind === "error" ? "alert" : "status"}
        >
          <span>{message.text}</span>
          <button
            aria-label={`Dismiss notification: ${message.text}`}
            className="toast-close"
            type="button"
            onClick={() => dismiss(message.id)}
          >
            <CloseIcon />
          </button>
        </div>
      ))}
    </div>
  );
}
