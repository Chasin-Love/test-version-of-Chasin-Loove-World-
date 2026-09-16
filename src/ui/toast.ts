export type ToastTone = 'ok' | 'warn';
export type ToastHandler = (msg: string, tone?: ToastTone) => void;

let toastHandler: ToastHandler | null = null;

export function toast(msg: string, tone: ToastTone = 'ok'): void {
  toastHandler?.(msg, tone);
}

export function registerToastHandler(handler: ToastHandler): () => void {
  toastHandler = handler;
  return () => {
    if (toastHandler === handler) toastHandler = null;
  };
}
