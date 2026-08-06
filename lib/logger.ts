// Tiny structured JSON-line logger with zero dependencies.
// Output shape: { level, time: ISO string, msg, ...fields } on one line,
// emitted via the matching console method. Minimum level comes from the
// LOG_LEVEL environment variable (default "info"); levels below it are dropped.

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;

export type LogLevel = keyof typeof LEVELS;

type LogFields = Record<string, unknown>;

export function minLevelFrom(envValue: string | undefined): LogLevel {
  const level = envValue?.trim().toLowerCase();
  if (level && level in LEVELS) return level as LogLevel;
  return "info";
}

function emit(level: LogLevel, msg: string, fields: LogFields): void {
  if (LEVELS[level] < LEVELS[minLevelFrom(process.env.LOG_LEVEL)]) return;
  const line = JSON.stringify({ level, time: new Date().toISOString(), msg, ...fields });
  console[level](line);
}

export const logger = {
  debug(msg: string, fields: LogFields = {}) {
    emit("debug", msg, fields);
  },
  info(msg: string, fields: LogFields = {}) {
    emit("info", msg, fields);
  },
  warn(msg: string, fields: LogFields = {}) {
    emit("warn", msg, fields);
  },
  error(msg: string, fields: LogFields = {}) {
    emit("error", msg, fields);
  },
};
