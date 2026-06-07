// Tiny app-level toast store (module-level pub/sub) so toasts survive client
// navigation — e.g. a sync that finishes after you've left the page can still
// show its result. Trigger with showToast(); render <Toaster/> once in providers.

export type ToastType = 'success' | 'error' | 'info';
export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

let toasts: Toast[] = [];
const listeners = new Set<() => void>();
let nextId = 1;

function emit() {
  for (const l of listeners) l();
}

export function showToast(message: string, type: ToastType = 'info', durationMs = 4000): void {
  const id = nextId++;
  toasts = [...toasts, { id, message, type }];
  emit();
  setTimeout(() => dismissToast(id), durationMs);
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

// Stable snapshot reference between changes (required by useSyncExternalStore).
export function getToasts(): Toast[] {
  return toasts;
}

export function subscribeToasts(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
