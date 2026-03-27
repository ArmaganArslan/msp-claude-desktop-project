/**
 * ─── MCP Logger ─────────────────────────────────────────────────────────────────
 *
 * MCP sunucusu stdio üzerinden çalıştığı için console.log() kesinlikle
 * kullanılamaz — stdout'a yazan her şey MCP protokolünü bozar.
 *
 * Bu modül tüm logları iki yere yazar:
 *   1. process.stderr  → Claude Desktop MCP log paneli
 *   2. logs/requests.log → Terminalde canlı izlenebilir dosya
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// Proje kök dizini
const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const LOG_DIR  = path.join(PROJECT_ROOT, "logs");
const LOG_FILE = path.join(LOG_DIR, "requests.log");

// Log dizini yoksa oluştur
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ─── ANSI Renk Kodları ────────────────────────────────────────────────────────
const C = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  dim:    "\x1b[2m",
  cyan:   "\x1b[36m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  red:    "\x1b[31m",
  blue:   "\x1b[34m",
  magenta:"\x1b[35m",
  gray:   "\x1b[90m",
  bgBlack: "\x1b[40m",
};

function timestamp(): string {
  const d = new Date();
  return d.toLocaleTimeString("tr-TR", { hour12: false });
}

/** ANSI escape kodlarını temizler (dosyaya sade metin yazılır) */
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

/** stderr'e RENKLİ, dosyaya SAF metin yazar */
function write(line: string): void {
  process.stderr.write(line + "\n");
  try {
    fs.appendFileSync(LOG_FILE, stripAnsi(line) + "\n");
  } catch {
    //
  }
}

// ─── Log Seviyeleri ───────────────────────────────────────────────────────────

export function logInfo(message: string): void {
  write(`\n${C.gray}[${timestamp()}]${C.reset} ${C.blue}INFO${C.reset}  ${message}`);
}

export function logRequest(
  toolName: string,
  method: string,
  path: string,
  params?: Record<string, unknown>,
  body?: unknown
): void {
  const methodColor =
    method === "GET"    ? C.green  :
    method === "POST"   ? C.cyan   :
    method === "PUT"    ? C.yellow :
    method === "DELETE" ? C.red    : C.reset;

  write(`\n${C.gray}──────────────────────────────────────────────────────────────────────────${C.reset}`);
  write(
    `${C.gray}[${timestamp()}]${C.reset} ` +
    `${C.bold}${methodColor}${method.padEnd(7)}${C.reset} ` +
    `${C.bold}${path}${C.reset}`
  );
  write(`${C.gray}               Tool: ${C.magenta}${toolName}${C.reset}`);

  if (params && Object.keys(params).length > 0) {
    write(`${C.gray}               Query: ${C.reset}${JSON.stringify(params, null, 2).replace(/\n/g, "\n               ")}`);
  }

  if (body !== undefined) {
    const bodyStr = typeof body === "string" ? body : JSON.stringify(body, null, 2);
    write(`${C.gray}               Body:  ${C.reset}${bodyStr.replace(/\n/g, "\n               ")}`);
  }
}

export function logResponse(
  path: string,
  statusCode: number,
  recordCount: number | string,
  durationMs: number
): void {
  const ok = statusCode >= 200 && statusCode < 300;
  const statusColor = ok ? C.green : C.yellow;
  const icon = ok ? "OK" : "!!";

  write(
    `${C.gray}[${timestamp()}]${C.reset} ` +
    `${statusColor}${icon} ${statusCode}${C.reset}  ` +
    `${C.gray}Süre: ${C.reset}${durationMs}ms  ` +
    `${C.gray}Kayıt: ${C.reset}${recordCount}`
  );
}

export function logError(
  path: string,
  statusCode: number | string,
  message: string,
  durationMs: number
): void {
  write(
    `${C.gray}[${timestamp()}]${C.reset} ` +
    `${C.red}ERROR ${statusCode}${C.reset} ` +
    `${C.gray}Süre: ${C.reset}${durationMs}ms`
  );
  write(`${C.red}               Hata:  ${C.reset}${message}`);
}
