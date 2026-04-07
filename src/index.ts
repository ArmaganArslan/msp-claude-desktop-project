import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// ─── .env Yükleme ─────────────────────────────────────────────────────────────
// Standart dotenv paketi stdout'a çıktı yazabildiğinden kullanmıyoruz.
// Claude Desktop ile stdio modunda çalışırken stdout SADECE JSON protokolü
// için kullanılmalı; aksi halde MCP iletişimi bozulur.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  const envPath = join(__dirname, "../../.env");
  const lines = readFileSync(envPath, "utf-8").split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed
      .slice(eqIndex + 1)
      .trim()
      .replace(/^[\"']|[\"']$/g, "");

    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
} catch {
  // .env yoksa sessizce devam et
}

// ─── Imports ─────────────────────────────────────────────────────────────────
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  searchTools,
  getToolDetails,
  callTool,
} from "./registry/tool-registry.js";
import { log, logHttp, logMcpTool, getLogConfig } from "./logger.js";

// ─── ERP Auth: API_TOKEN / ERP_BEARER_TOKEN ──────────────────────────────────
// Orval-generated client uses global fetch. We wrap fetch once so every API call
// automatically sends Authorization header from Claude Desktop "env".
const bearerFromEnv =
  process.env.API_TOKEN || process.env.ERP_BEARER_TOKEN || undefined;

const originalFetch = globalThis.fetch.bind(globalThis);

globalThis.fetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  const method = (init?.method ?? "GET").toUpperCase();

  if (bearerFromEnv) {
    const existing = new Headers(init?.headers ?? undefined);
    if (!existing.has("Authorization")) {
      existing.set("Authorization", `Bearer ${bearerFromEnv}`);
    }
    if (!existing.has("Accept")) existing.set("Accept", "application/json");
    init = { ...init, headers: existing };
  }

  const started = performance.now();
  try {
    const res = await originalFetch(input, init);
    logHttp(method, url, res.status, Math.round(performance.now() - started));
    return res;
  } catch (err: any) {
    log.error("[HTTP] fetch failed", {
      method,
      url,
      message: err?.message ?? String(err),
    });
    throw err;
  }
};

// ─── Hata Yakalayıcılar ─────────────────────────────────────────────────────
process.on("uncaughtException", (err) => {
  log.error("uncaughtException", { message: err.message, stack: err.stack });
});

process.on("unhandledRejection", (reason) => {
  log.error("unhandledRejection", { reason: String(reason) });
});

// ─── Ana Fonksiyon ───────────────────────────────────────────────────────────
async function main() {
  const server = new McpServer({
    name: "aaro-erp-mcp",
    version: "2.0.0",
  });

  // ── 1. search_api_tools ──────────────────────────────────────────────────
  server.tool(
    "search_api_tools",
    "Aaro ERP API endpointlerini arar. Türkçe veya İngilizce arama yapabilirsiniz. Örnek: 'cari kart listele', 'stok bakiye', 'fatura olustur'",
    {
      query: z.string().describe("Arama sorgusu"),
      limit: z
        .number()
        .optional()
        .default(10)
        .describe("Maksimum sonuç sayısı"),
    },
    async (args) => {
      logMcpTool("search_api_tools", "start", args as Record<string, unknown>);
      const started = performance.now();
      try {
        const out = await searchTools(args.query, args.limit);
        logMcpTool("search_api_tools", "end", undefined, {
          ms: Math.round(performance.now() - started),
        });
        return out;
      } catch (e: any) {
        logMcpTool("search_api_tools", "error", args as Record<string, unknown>, {
          message: e?.message,
        });
        throw e;
      }
    },
  );

  // ── 2. get_tool_details ──────────────────────────────────────────────────
  server.tool(
    "get_tool_details",
    "Belirli bir API tool'unun parametre detaylarını (alan adları ve tipleri) getirir. search_api_tools sonucundan gelen tool adını kullanın.",
    {
      toolName: z.string().describe("Tool adı (search_api_tools sonucundan)"),
    },
    async (args) => {
      logMcpTool("get_tool_details", "start", args as Record<string, unknown>);
      const started = performance.now();
      try {
        const out = await getToolDetails(args.toolName);
        logMcpTool("get_tool_details", "end", undefined, {
          ms: Math.round(performance.now() - started),
        });
        return out;
      } catch (e: any) {
        logMcpTool("get_tool_details", "error", args as Record<string, unknown>, {
          message: e?.message,
        });
        throw e;
      }
    },
  );

  // ── 3. call_api_tool ────────────────────────────────────────────────────
  server.tool(
    "call_api_tool",
    "Belirtilen Aaro API endpoint'ini çağırır. Parametreler pathParams, queryParams ve/veya bodyParams olarak verilir.",
    {
      toolName: z.string().describe("Çağrılacak tool adı"),
      params: z
        .record(z.string(), z.unknown())
        .optional()
        .describe(
          "Tool parametreleri: { pathParams?: {...}, queryParams?: {...}, bodyParams?: {...} }",
        ),
    },
    async (args) => {
      logMcpTool("call_api_tool", "start", args as Record<string, unknown>);
      const started = performance.now();
      try {
        const out = await callTool(args.toolName, args.params);
        const err =
          out &&
          typeof out === "object" &&
          "isError" in out &&
          (out as { isError?: boolean }).isError;
        logMcpTool("call_api_tool", "end", undefined, {
          ms: Math.round(performance.now() - started),
          targetTool: args.toolName,
          mcpError: Boolean(err),
        });
        return out;
      } catch (e: any) {
        logMcpTool("call_api_tool", "error", args as Record<string, unknown>, {
          message: e?.message,
        });
        throw e;
      }
    },
  );

  // ── Claude Desktop'a Bağlan ────────────────────────────────────────────
  const transport = new StdioServerTransport();
  await server.connect(transport);

  const cfg = getLogConfig();
  log.info("AARO ERP MCP Server baslatildi (stdio)", {
    ...cfg,
    authConfigured: Boolean(bearerFromEnv),
  });
}

main().catch((err) => {
  log.error("Baslatma hatasi", { message: err.message, stack: err.stack });
  process.exit(1);
});
