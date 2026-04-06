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

// ─── ERP Auth: API_TOKEN / ERP_BEARER_TOKEN ──────────────────────────────────
// Orval-generated client uses global fetch. We wrap fetch once so every API call
// automatically sends Authorization header from Claude Desktop "env".
const bearerFromEnv =
  process.env.API_TOKEN || process.env.ERP_BEARER_TOKEN || undefined;

if (bearerFromEnv) {
  const originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const existing = new Headers(init?.headers ?? undefined);
    if (!existing.has("Authorization")) {
      existing.set("Authorization", `Bearer ${bearerFromEnv}`);
    }
    if (!existing.has("Accept")) existing.set("Accept", "application/json");

    return originalFetch(input, {
      ...init,
      headers: existing,
    });
  };
}

// ─── Hata Yakalayıcılar ─────────────────────────────────────────────────────
process.on("uncaughtException", (err) => {
  process.stderr.write(`Yakalanmamis hata: ${err.message}\n${err.stack}\n`);
});

process.on("unhandledRejection", (reason) => {
  process.stderr.write(`Yakalanmamis Promise hatasi: ${String(reason)}\n`);
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
    async (args) => searchTools(args.query, args.limit),
  );

  // ── 2. get_tool_details ──────────────────────────────────────────────────
  server.tool(
    "get_tool_details",
    "Belirli bir API tool'unun parametre detaylarını (alan adları ve tipleri) getirir. search_api_tools sonucundan gelen tool adını kullanın.",
    {
      toolName: z.string().describe("Tool adı (search_api_tools sonucundan)"),
    },
    async (args) => getToolDetails(args.toolName),
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
    async (args) => callTool(args.toolName, args.params),
  );

  // ── Claude Desktop'a Bağlan ────────────────────────────────────────────
  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write("AARO ERP MCP Server baslatildi (stdio modu)\n");
}

main().catch((err) => {
  process.stderr.write(`Baslatma hatasi: ${err.message}\n`);
  process.exit(1);
});
