/**
 * Minimal structured logger. Emits single-line JSON so logs stay greppable in
 * any platform's log drain without pulling in a logging dependency.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

function emit(level: LogLevel, msg: string, context?: LogContext) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...context,
  };
  const line = safeStringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ msg: "log_serialization_failed" });
  }
}

/** Normalize an unknown thrown value into a serializable shape. */
export function errInfo(err: unknown): { name?: string; message: string } {
  if (err instanceof Error) {
    return { name: err.name, message: err.message };
  }
  return { message: String(err) };
}

export const logger = {
  debug: (msg: string, context?: LogContext) => emit("debug", msg, context),
  info: (msg: string, context?: LogContext) => emit("info", msg, context),
  warn: (msg: string, context?: LogContext) => emit("warn", msg, context),
  error: (msg: string, context?: LogContext) => emit("error", msg, context),
  /** Returns a logger whose entries are tagged with a stable requestId. */
  child: (base: LogContext) => ({
    debug: (msg: string, context?: LogContext) =>
      emit("debug", msg, { ...base, ...context }),
    info: (msg: string, context?: LogContext) =>
      emit("info", msg, { ...base, ...context }),
    warn: (msg: string, context?: LogContext) =>
      emit("warn", msg, { ...base, ...context }),
    error: (msg: string, context?: LogContext) =>
      emit("error", msg, { ...base, ...context }),
  }),
};

export type Logger = Pick<typeof logger, "debug" | "info" | "warn" | "error">;
