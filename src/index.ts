import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// dotenv yerine elle .env okuma — stdout'a hiçbir şey yazmıyor
// Stdio MCP modunda stdout sadece JSON protokolü için kullanılmalı!
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
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
} catch {
  // .env yoksa sessizce devam et
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadSwaggerDoc } from "./swagger/loader.js";
import { registerSwaggerTools } from "./swagger/generator.js";
import { SWAGGER_URL, WHITELISTED_ENDPOINTS } from "./swagger/config.js";

// ─── Crash önleyiciler ────────────────────────────────────────────────────────
process.on("uncaughtException", (err) => {
  process.stderr.write(`💥 Yakalanmamış hata: ${err.message}\n${err.stack}\n`);
});

process.on("unhandledRejection", (reason) => {
  process.stderr.write(`💥 Yakalanmamış Promise hatası: ${String(reason)}\n`);
});

async function main() {
  const server = new McpServer({
    name: "aaro-erp-mcp",
    version: "1.0.0",
  });

  // ─── Swagger'dan Dinamik Tool Kayıt ─────────────────────────────────────────
  // Swagger JSON'u URL'den indir ve sadece whitelist'teki endpoint'leri
  // otomatik olarak MCP tool'una dönüştür.
  try {
    const swaggerDoc = await loadSwaggerDoc(SWAGGER_URL);
    registerSwaggerTools(server, swaggerDoc, WHITELISTED_ENDPOINTS);
  } catch (err: any) {
    process.stderr.write(
      `❌ Swagger yüklenemedi, tool'lar kaydedilemedi: ${err.message}\n`
    );
    // Swagger yüklenemese bile server ayağa kalksın (boş tool listesiyle)
  }

  // Stdio transport (Claude Desktop ile uyumlu)
  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write("✅ AARO ERP MCP Server başladı (stdio modu)\n");
}

main().catch((err) => {
  process.stderr.write(`❌ Başlatma hatası: ${err.message}\n`);
  process.exit(1);
});