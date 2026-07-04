import { Keyboard, Send } from "lucide-react";
import { useAppStore } from "../store/appStore";

export function CommandBar() {
  const promptText = useAppStore((state) => state.promptText);
  const rawInput = useAppStore((state) => state.rawInput);
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const busy = useAppStore((state) => state.busy);
  const setPromptText = useAppStore((state) => state.setPromptText);
  const setRawInput = useAppStore((state) => state.setRawInput);
  const sendPrompt = useAppStore((state) => state.sendPrompt);

  return (
    <form
      className="command-bar"
      onSubmit={(event) => {
        event.preventDefault();
        void sendPrompt();
      }}
    >
      <textarea
        aria-label="Prompt"
        value={promptText}
        onChange={(event) => setPromptText(event.target.value)}
        placeholder="Send a prompt to the active agent"
        disabled={!activeSessionId || busy}
      />
      <div className="command-actions">
        <label className="raw-toggle">
          <input
            type="checkbox"
            checked={rawInput}
            onChange={(event) => setRawInput(event.target.checked)}
            disabled={!activeSessionId}
          />
          <Keyboard size={15} aria-hidden="true" />
          <span>Raw</span>
        </label>
        <button
          className="primary-action icon-action"
          type="submit"
          disabled={!activeSessionId || busy || promptText.trim().length === 0}
        >
          <Send size={15} aria-hidden="true" />
          <span>Send</span>
        </button>
      </div>
    </form>
  );
}
