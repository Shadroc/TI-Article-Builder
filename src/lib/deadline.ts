export class DeadlineExceededError extends Error {
  constructor(message = "Deadline exceeded") {
    super(message);
    this.name = "DeadlineExceededError";
  }
}

export interface Deadline {
  expiresAt: number;
  signal: AbortSignal;
  remainingMs(): number;
}

function makeAbortedSignal(reason: string): AbortSignal {
  const controller = new AbortController();
  controller.abort(new DeadlineExceededError(reason));
  return controller.signal;
}

function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();

  const abort = (signal: AbortSignal) => {
    if (!controller.signal.aborted) {
      controller.abort(signal.reason);
    }
  };

  for (const signal of signals) {
    if (signal.aborted) {
      abort(signal);
      return controller.signal;
    }
    signal.addEventListener("abort", () => abort(signal), { once: true });
  }

  return controller.signal;
}

export function createDeadline(durationMs: number, message = "Deadline exceeded"): Deadline {
  const controller = new AbortController();
  const expiresAt = Date.now() + durationMs;
  const timer = setTimeout(() => {
    controller.abort(new DeadlineExceededError(message));
  }, durationMs);

  controller.signal.addEventListener("abort", () => clearTimeout(timer), { once: true });

  return {
    expiresAt,
    signal: controller.signal,
    remainingMs() {
      return Math.max(0, expiresAt - Date.now());
    },
  };
}

export function throwIfDeadlineExceeded(deadline: Deadline | undefined, message = "Deadline exceeded"): void {
  if (!deadline) return;
  if (deadline.signal.aborted || deadline.remainingMs() <= 0) {
    throw new DeadlineExceededError(message);
  }
}

export function withDeadlineSignal(
  deadline: Deadline | undefined,
  timeoutMs: number,
  timeoutMessage = "Operation timed out"
): AbortSignal {
  if (!deadline) {
    return AbortSignal.timeout(timeoutMs);
  }

  const remainingMs = deadline.remainingMs();
  if (deadline.signal.aborted || remainingMs <= 0) {
    return makeAbortedSignal(timeoutMessage);
  }

  const localTimeout = AbortSignal.timeout(Math.max(1, Math.min(timeoutMs, remainingMs)));
  return anySignal([deadline.signal, localTimeout]);
}
