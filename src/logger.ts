/**
 * MCP sunucusu stdio ile çalışır: stdout'a ASLA yazılmaz.
 * Loglar: stderr (Claude MCP log paneli) + logs/ altında dosya (dev + prod).
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

type LogLevelName = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevelName, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
};

function projectRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

const LOG_DIR = process.env.LOG_DIR
  ? path.resolve(process.env.LOG_DIR)
  : path.join(projectRoot(), "logs");

const LOG_TO_FILE = process.env.LOG_TO_FILE !== "0" && process.env.LOG_TO_FILE !== "false";

function logFilePath(): string {
  if (process.env.LOG_FILE) {
    return path.isAbsolute(process.env.LOG_FILE)
      ? process.env.LOG_FILE
      : path.join(LOG_DIR, process.env.LOG_FILE);
  }
  const d = new Date();
  const day = d.toISOString().slice(0, 10);
  return path.join(LOG_DIR, `mcp-${day}.log`);
}

let logFileResolved = "";

function ensureLogDir(): void {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  } catch {
    //
  }
}

function parseLogLevel(): LogLevelName {
  const raw = (process.env.LOG_LEVEL || "").toLowerCase().trim();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

const minLevel = parseLogLevel();

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

function isoTimestamp(): string {
  return new Date().toISOString();
}

const REDACT_KEYS = new Set(
  [
    "authorization",
    "api_token",
    "apitoken",
    "token",
    "password",
    "secret",
    "cookie",
    "set-cookie",
    "erp_bearer_token",
    "bearer",
  ].map((k) => k.toLowerCase()),
);

export function redactSensitive(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map(redactSensitive);
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (REDACT_KEYS.has(k.toLowerCase())) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactSensitive(v);
      }
    }
    return out;
  }
  return value;
}

function shouldLog(level: LogLevelName): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel];
}

function levelLabel(level: LogLevelName): string {
  return level.toUpperCase().padEnd(5);
}

function colorFor(level: LogLevelName): string {
  switch (level) {
    case "debug":
      return C.gray;
    case "info":
      return C.blue;
    case "warn":
      return C.yellow;
    case "error":
      return C.red;
    default:
      return C.reset;
  }
}

function writeLine(level: LogLevelName, message: string, meta?: unknown): void {
  if (!shouldLog(level)) return;

  const ts = isoTimestamp();
  const metaStr =
    meta !== undefined
      ? ` ${typeof meta === "string" ? meta : JSON.stringify(redactSensitive(meta))}`
      : "";

  const stderrLine =
    `${C.gray}[${ts}]${C.reset} ${colorFor(level)}${levelLabel(level)}${C.reset} ${message}${metaStr ? C.dim + metaStr + C.reset : ""}`;
  process.stderr.write(stderrLine + "\n");

  if (!LOG_TO_FILE) return;

  ensureLogDir();
  if (!logFileResolved) {
    logFileResolved = logFilePath();
  }

  const fileRecord = {
    ts,
    level,
    message,
    ...(meta !== undefined ? { meta: redactSensitive(meta) } : {}),
  };

  try {
    fs.appendFileSync(
      logFileResolved,
      JSON.stringify(fileRecord) + "\n",
      "utf-8",
    );
  } catch {
    //
  }
}

export const log = {
  debug: (message: string, meta?: unknown) =>
    writeLine("debug", message, meta),
  info: (message: string, meta?: unknown) => writeLine("info", message, meta),
  warn: (message: string, meta?: unknown) => writeLine("warn", message, meta),
  error: (message: string, meta?: unknown) =>
    writeLine("error", message, meta),
};

export function logMcpTool(
  toolName: string,
  phase: "start" | "end" | "error",
  args?: Record<string, unknown>,
  extra?: Record<string, unknown>,
): void {
  const payload = {
    tool: toolName,
    phase,
    ...(args !== undefined ? { args: redactSensitive(args) } : {}),
    ...extra,
  };
  const level: LogLevelName = phase === "error" ? "error" : "info";
  writeLine(level, `[MCP] ${toolName} ${phase}`, payload);
}

export function logHttp(
  method: string,
  url: string,
  status: number,
  durationMs: number,
): void {
  writeLine("info", `[HTTP] ${method} ${status} ${durationMs}ms`, {
    method,
    url,
    status,
    durationMs,
  });
}

export function getLogConfig(): {
  logLevel: LogLevelName;
  logDir: string;
  logFile: string | null;
  logToFile: boolean;
} {
  ensureLogDir();
  const file = LOG_TO_FILE ? logFilePath() : null;
  return {
    logLevel: minLevel,
    logDir: LOG_DIR,
    logFile: file,
    logToFile: LOG_TO_FILE,
  };
}

// ─── Geriye dönük API (swagger/generator, cariOlusturCustom) ────────────────

export function logInfo(message: string): void {
  log.info(message);
}

export function logRequest(
  toolName: string,
  method: string,
  reqPath: string,
  params?: Record<string, unknown>,
  body?: unknown,
): void {
  writeLine("info", `[HTTP] ${method} ${reqPath}`, {
    tool: toolName,
    ...(params && Object.keys(params).length > 0
      ? { query: redactSensitive(params) }
      : {}),
    ...(body !== undefined ? { body: redactSensitive(body) } : {}),
  });
}

export function logResponse(
  reqPath: string,
  statusCode: number,
  recordCount: number | string,
  durationMs: number,
): void {
  writeLine("info", `[HTTP] OK ${statusCode}`, {
    path: reqPath,
    status: statusCode,
    records: recordCount,
    ms: durationMs,
  });
}

export function logError(
  reqPath: string,
  statusCode: number | string,
  message: string,
  durationMs: number,
): void {
  writeLine("error", `[HTTP] ERROR ${statusCode}`, {
    path: reqPath,
    status: statusCode,
    message,
    ms: durationMs,
  });
}
