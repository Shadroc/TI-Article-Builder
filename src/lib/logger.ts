type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  runId?: string;
  articleIndex?: number;
  step?: string;
  durationMs?: number;
  error?: string;
  [key: string]: unknown;
}

function emit(entry: LogEntry) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    ...entry,
  });

  switch (entry.level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    default:
      console.log(line);
  }
}

export const logger = {
  info(message: string, meta?: Omit<LogEntry, "level" | "message">) {
    emit({ level: "info", message, ...meta });
  },
  warn(message: string, meta?: Omit<LogEntry, "level" | "message">) {
    emit({ level: "warn", message, ...meta });
  },
  error(message: string, meta?: Omit<LogEntry, "level" | "message">) {
    emit({ level: "error", message, ...meta });
  },
};
