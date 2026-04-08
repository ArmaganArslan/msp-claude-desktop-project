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
import express from "express";
import cors from "cors";
import { AsyncLocalStorage } from "node:async_hooks";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import {
  searchTools,
  getToolDetails,
  callTool,
} from "./registry/tool-registry.js";
import { log, logHttp, logMcpTool, getLogConfig } from "./logger.js";

// ─── ERP Auth: API_TOKEN / ERP_BEARER_TOKEN ──────────────────────────────────
// Orval-generated client uses global fetch. We wrap fetch once so every API call
// automatically sends Authorization header from Claude Desktop "env" or express request.
const bearerFromEnv =
  process.env.API_TOKEN || process.env.ERP_BEARER_TOKEN || undefined;

export const authContext = new AsyncLocalStorage<string | undefined>();

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

  const currentBearer = authContext.getStore() || bearerFromEnv;

  if (currentBearer) {
    const existing = new Headers(init?.headers ?? undefined);
    if (!existing.has("Authorization")) {
      existing.set("Authorization", `Bearer ${currentBearer}`);
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
  },
    {
      instructions: [
        "You are connected to a LIVE ERP system via tools.",

        "You do NOT have access to ERP data unless you use tools.",

        "If the request is about ERP and you do not call tools, your answer is INCORRECT.",

        "ALWAYS use tools for anything related to:",
        "- stok",
        "- cari",
        "- fatura",
        "- sipariş",
        "- muhasebe",
        "- müşteri",
        "- ürün",
        "- or ANY business / ERP data",

        "",
        "MANDATORY WORKFLOW:",
        "1. You MUST call search_api_tools first",
        "2. Then you MUST call get_tool_details",
        "3. Then you MUST call call_api_tool",

        "",
        "STRICT RULES:",
        "- You are NOT allowed to skip steps",
        "- You are NOT allowed to answer directly",
        "- You MUST follow the workflow exactly",
        "- If unsure, ALWAYS start with search_api_tools",

        "",
        "If you skip tool usage when required, your answer is WRONG.",
        "Do NOT guess. Do NOT simulate data.",
      ].join("\n"),
    },
  );

  // ── 1. search_api_tools ──────────────────────────────────────────────────
  server.tool(
    "search_api_tools",
    [
      "PRIMARY ENTRY POINT for ALL ERP requests.",

      "",
      "You MUST call this tool if the user asks for:",
      "- any data",
      "- listing records",
      "- fetching information",
      "- searching",
      "- filtering",
      "- anything related to business entities (stok, cari, fatura, sipariş, müşteri, ürün, etc.)",

      "",
      "STRICT RULES:",
      "- Do NOT answer the user directly",
      "- Do NOT skip this step",
      "- If there is ANY chance this is ERP-related → CALL THIS TOOL",

      "",
      "MANDATORY FLOW:",
      "- After calling this tool, you MUST call get_tool_details",
      "- You MUST NOT produce final answers after this step",

      "",
      "If you do not call this tool when required, your answer is INCORRECT.",
    ].join("\n"),
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
    [
      "SECOND STEP in ERP workflow.",

      "",
      "Use this tool AFTER search_api_tools to retrieve:",
      "- parameter names",
      "- parameter types",
      "- required fields",

      "",
      "STRICT RULES:",
      "- You MUST use the toolName from search_api_tools result",
      "- Do NOT guess parameters",
      "- Do NOT skip this step",

      "",
      "MANDATORY FLOW:",
      "- After calling this tool, you MUST call call_api_tool",
      "- You MUST NOT answer the user yet",

      "",
      "If you skip this step, your answer is INCORRECT.",
    ].join("\n"),
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
    [
      "FINAL STEP in ERP workflow.",

      "",
      "This tool performs the actual API call and returns REAL ERP data.",

      "",
      "STRICT RULES:",
      "- This is the ONLY tool that can produce a final answer",
      "- You MUST have correct parameters from get_tool_details",
      "- Do NOT guess parameters",

      "",
      "MANDATORY:",
      "- You MUST call this tool before answering the user",
      "- You MUST NOT answer the user without calling this tool",

      "",
      "If you answer without calling this tool, your answer is INCORRECT.",
    ].join("\n"),
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

  // ── Sunucu Bağlantı / Taşıma Ayarı ─────────────────────────────────────
  const transportMode = process.env.TRANSPORT || "stdio";
  const cfg = getLogConfig();

  if (transportMode === "sse") {
    // SSE / Express Modu (Uzak Sunucu / Canlı)
    const app = express();
    app.use(cors());
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());

    // ─── CLAUDE WEB OAUTH 2.0 HACK ──────────────────────────────────────────
    // Claude'un "kullanıcıyı login'e yollayıp token alma" akışını simüle ediyoruz.
    // Kullanıcının ekrandan gireceği token'ı geçici "code" parametresi gibi Claude'a aktarıp,
    // Claude'un arka planda yapacağı /token isteğinde bunu gerçek "access_token" gibi teslim ediyoruz.
    
    app.get("/authorize", (req, res) => {
      const redirectUri = req.query.redirect_uri as string;
      const state = req.query.state as string;
      
      if (!redirectUri) {
         res.status(400).send("redirect_uri eksik.");
         return;
      }

      const html = `
        <html>
          <head>
             <meta charset="utf-8">
            <title>AARO ERP Kimlik Doğrulama</title>
            <style>
              body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f4f4f5; margin:0;}
              .box { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 400px; width:100%;}
              input { padding: 10px; width: 100%; margin: 15px 0; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
              button { background: #3b82f6; color: white; border: none; padding: 10px; width: 100%; border-radius: 4px; cursor: pointer; font-weight: bold;}
              button:hover { background: #2563eb; }
              p { color: #555; font-size: 14px;}
            </style>
          </head>
          <body>
            <div class="box">
              <h2>Claude ↔ AARO ERP</h2>
              <p>Claude üzerinden AARO ERP verilerine erişmek için lütfen size ait olan <b>API Bağlantı Token</b> bilginizi kutucuğa yapıştırın.</p>
              <form method="POST" action="/authorize">
                <input type="hidden" name="redirect_uri" value="\${encodeURIComponent(redirectUri)}" />
                <input type="hidden" name="state" value="\${encodeURIComponent(state || "")}" />
                <input type="password" name="erp_token" placeholder="AARO API Token Gönderin" required />
                <button type="submit">Doğrula ve Bağlan</button>
              </form>
            </div>
          </body>
        </html>
      `;
      res.send(html);
    });

    app.post("/authorize", (req, res) => {
      const { erp_token, redirect_uri, state } = req.body;
      if (!redirect_uri || !erp_token) {
        res.status(400).send("Eksik bilgi (token veya redirect_uri).");
        return;
      }
      // Tokonu guvenli sekilde encode edip OAuth Code gibi claude'a yolluyoruz.
      res.redirect(`\${decodeURIComponent(redirect_uri)}?code=\${encodeURIComponent(erp_token)}&state=\${encodeURIComponent(state || "")}`);
    });

    app.post("/token", (req, res) => {
      // YONTEM 1: Claude eger OAuth Client Credentials istiyorsa, client_secret bizim ERP tokenimiz olacaktir.
      if (req.body.client_secret) {
        res.json({
          access_token: req.body.client_secret,
          token_type: "Bearer"
        });
        return;
      }

      // YONTEM 2: Claude eger /token istegini Basic Auth ile yapiyorsa
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.toLowerCase().startsWith("basic ")) {
         const b64 = authHeader.substring(6);
         const decoded = Buffer.from(b64, 'base64').toString('utf-8');
         const parts = decoded.split(':');
         if (parts.length === 2 && parts[1]) {
             res.json({
               access_token: parts[1], // Client Secret = ERP Token
               token_type: "Bearer"
             });
             return;
         }
      }

      // YONTEM 3: Kullanici Login akisindan (Code flow) geldiyse
      const code = req.body.code || req.query.code;
      if (code) {
        res.json({
          access_token: code,
          token_type: "Bearer"
        });
        return;
      }

      res.status(400).json({ error: "invalid_request", error_description: "Code, client_secret veya basic auth parametreleri bulunamadi" });
    });

    // ─── CLAUDE WEB OAUTH BITIS ──────────────────────────────────────────

    const sseTransport = new StreamableHTTPServerTransport();
    await server.connect(sseTransport);

    const handleReq = async (req: express.Request, res: express.Response) => {
      // Authorization başlığından token çekilir
      let token = undefined;
      const authHeader = req.headers.authorization;
      
      if (authHeader) {
        if (authHeader.toLowerCase().startsWith("bearer ")) {
          // Normal Token kullaniminda (Code akisindan sonra veya std custom connector ile)
          token = authHeader.substring(7);
        } else if (authHeader.toLowerCase().startsWith("basic ")) {
          // Claude eger doğrudan Basic Auth ile erismek istiyorsa (Client credentials'i dogrudan HTTP requestlerine isliyorsa)
          const b64 = authHeader.substring(6);
          const decoded = Buffer.from(b64, 'base64').toString('utf-8');
          const parts = decoded.split(':');
          if (parts.length === 2 && parts[1]) {
             token = parts[1]; // Sifre (Client Secret) = ERP Token
          }
        }
      }

      // authContext ile sarmalayarak fetch override'ına thread-local token'i geçir
      authContext.run(token, () => {
        sseTransport.handleRequest(req, res);
      });
    };

    // Client hem GET /sse hem de POST /message yapabilmeli 
    // veya dogrudan /mcp diyerek tek uctan baglanabilmeli
    app.all("/mcp", handleReq);
    app.all("/sse", handleReq);
    app.all("/message", handleReq);

    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      log.info(`AARO ERP MCP Server (SSE Modu) http://localhost:${port} adresinde dinliyor`, {
        ...cfg,
        authConfigured: Boolean(bearerFromEnv),
      });
    });
  } else {
    // Standart I/O Modu (Lokal Geliştirme - Claude Desktop)
    const transport = new StdioServerTransport();
    await server.connect(transport);

    log.info("AARO ERP MCP Server baslatildi (stdio)", {
      ...cfg,
      authConfigured: Boolean(bearerFromEnv),
    });
  }
}

main().catch((err) => {
  log.error("Baslatma hatasi", { message: err.message, stack: err.stack });
  process.exit(1);
});
