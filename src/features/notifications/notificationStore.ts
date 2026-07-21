import { create } from "zustand";

export type ToastKind = "success" | "error";
export type ToastMessage = { id: string; kind: ToastKind; text: string };

export const toastDismissMs = 4_000;
export const maxVisibleToasts = 3;

let sequence = 0;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function boundToastMessages(messages: ToastMessage[]) {
  return messages.slice(-maxVisibleToasts);
}

type NotificationStore = {
  messages: ToastMessage[];
  push: (kind: ToastKind, text: string) => string;
  dismiss: (id: string) => void;
  reset: () => void;
};

function clearTimer(id: string) {
  const timer = timers.get(id);
  if (timer !== undefined) clearTimeout(timer);
  timers.delete(id);
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  messages: [],
  push: (kind, text) => {
    const id = `toast-${Date.now()}-${sequence++}`;
    const currentMessages = get().messages;
    const messages = boundToastMessages([...currentMessages, { id, kind, text }]);
    const visibleIds = new Set(messages.map((message) => message.id));
    for (const message of currentMessages) {
      if (!visibleIds.has(message.id)) clearTimer(message.id);
    }
    set({ messages });
    const timer = setTimeout(() => get().dismiss(id), toastDismissMs);
    timers.set(id, timer);
    return id;
  },
  dismiss: (id) => {
    clearTimer(id);
    set((state) => ({ messages: state.messages.filter((message) => message.id !== id) }));
  },
  reset: () => {
    for (const id of timers.keys()) clearTimer(id);
    sequence = 0;
    set({ messages: [] });
  },
}));
