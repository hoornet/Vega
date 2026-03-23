import { create } from "zustand";

interface Toast {
  id: string;
  message: string;
  type: "info" | "warning" | "success";
  autoCloseMs: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type: Toast["type"], autoCloseMs?: number) => void;
  removeToast: (id: string) => void;
}

const MAX_TOASTS = 5;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (message, type, autoCloseMs = 4000) => {
    // Deduplicate — don't add if same message already visible
    if (get().toasts.some((t) => t.message === message)) return;

    const id = crypto.randomUUID();
    const toast: Toast = { id, message, type, autoCloseMs };

    set((state) => {
      const toasts = [...state.toasts, toast];
      // Drop oldest if over limit
      if (toasts.length > MAX_TOASTS) toasts.shift();
      return { toasts };
    });

    setTimeout(() => get().removeToast(id), autoCloseMs);
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));
