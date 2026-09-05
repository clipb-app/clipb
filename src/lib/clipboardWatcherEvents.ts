export const CLIPBOARD_CHECK_EVENT = "clipb://clipboard-check";
export const CLIPS_CHANGED_EVENT = "clipb://clips-changed";

interface ClipboardCheckOptions {
  listen: (check: () => void) => Promise<() => void>;
  check: () => Promise<void>;
  onError: (error: unknown) => void;
  locks?: Pick<LockManager, "request">;
}

export function startClipboardChecks(options: ClipboardCheckOptions): () => void {
  let stopped = false;
  let running = false;
  let pending = false;
  let unlisten: (() => void) | undefined;
  let releaseLock: (() => void) | undefined;

  async function check() {
    if (stopped) return;
    if (running) {
      pending = true;
      return;
    }

    running = true;
    try {
      do {
        pending = false;
        try {
          await options.check();
        } catch (error) {
          options.onError(error);
        }
      } while (pending && !stopped);
    } finally {
      running = false;
    }
  }

  // A held Web Lock keeps Chromium from freezing the hidden capture webview.
  void options.locks?.request(
    "clipb-clipboard-capture",
    { ifAvailable: true },
    (lock) => {
      if (!lock || stopped) return;
      return new Promise<void>((resolve) => {
        releaseLock = resolve;
      });
    },
  ).catch(options.onError);

  void options.listen(() => { void check(); }).then((dispose) => {
    if (stopped) {
      dispose();
      return;
    }
    unlisten = dispose;
    void check();
  }).catch(options.onError);

  return () => {
    stopped = true;
    unlisten?.();
    releaseLock?.();
  };
}
