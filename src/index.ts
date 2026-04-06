/**
 * 📄 index.ts — MCP Server Giriş Noktası
 *
 * Bu dosya uygulamanın başladığı yerdir. Sırasıyla şunları yapar:
 *   1. .env dosyasını okuyarak ortam değişkenlerini yükler
 *   2. MCP server örneğini oluşturur
 *   3. Manuel yazılmış custom tool'ları kaydeder
 *   4. Swagger JSON'u yerel dosyadan okuyarak whitelist'teki
 *      endpoint'leri otomatik tool'a dönüştürür
 *   5. Stdio transport ile Claude Desktop'a bağlanır
 *
 * 🚀 Çalıştırmak için:
 *   npm run dev       → tsx ile geliştirme modu
 *   npm run build     → TypeScript derle
 *   npm run start     → derlenmiş dist/ klasöründen çalıştır
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// ─── .env Yükleme ─────────────────────────────────────────────────────────────
// Standart dotenv paketi stdout'a çıktı yazabildiğinden kullanmıyoruz.
// Claude Desktop ile stdio modunda çalışırken stdout SADECE JSON protokolü
// için kullanılmalı; aksi halde MCP iletişimi bozulur.
// Bu yüzden .env'i elle, fs.readFileSync ile okuyoruz.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  // .env dosyası index.ts'in iki üst dizininde (proje kökünde) bulunur
  const envPath = join(__dirname, "../../.env");
  const lines = readFileSync(envPath, "utf-8").split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    // Boş satırları ve yorum satırlarını atla
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed
      .slice(eqIndex + 1)
      .trim()
      .replace(/^[\"']|[\"']$/g, ""); // Tırnak işaretlerini temizle

    // Zaten set edilmiş env değişkenlerini ezmez (sistem env önceliklidir)
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
} catch {
  // .env dosyası yoksa sessizce devam et (production ortamı için normal)
}

// ─── MCP & Swagger Importları ─────────────────────────────────────────────────
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerOrvalTools } from "./api/registerOrvalTools.js";

// Custom tool'lar — Swagger'ın yetersiz kaldığı veya özelleştirme
// gerektiren durumlar için manuel yazılmış tool'lar buradan import edilir.
// Yeni bir custom tool eklemek için:
//   1. src/tools/ altında yeni bir .ts dosyası oluştur
//   2. Burada import et ve aşağıda registerXxx(server) ile kaydet
import { registerCariOlusturCustomTool } from "./tools/cariOlusturCustom.js";

// ─── Hata Yakalayıcılar ───────────────────────────────────────────────────────
// Yakalanmayan hatalar uygulamayı çökertmeden stderr'e yazılır.
// Claude Desktop'taki MCP server'ın stabil kalması için kritiktir.
process.on("uncaughtException", (err) => {
  process.stderr.write(`💥 Yakalanmamış hata: ${err.message}\n${err.stack}\n`);
});

process.on("unhandledRejection", (reason) => {
  process.stderr.write(`💥 Yakalanmamış Promise hatası: ${String(reason)}\n`);
});

// ─── Ana Fonksiyon ────────────────────────────────────────────────────────────
async function main() {
  // MCP server örneği oluştur
  const server = new McpServer({
    name: "aaro-erp-mcp",
    version: "1.0.0",
  });

  // ── 1. Custom Tool'ları Kaydet ──────────────────────────────────────────────
  // Bu tool'lar Swagger'dan bağımsız, elle yazılmıştır.
  // Swagger yüklenemese bile bu tool'lar çalışmaya devam eder.
  registerCariOlusturCustomTool(server);

  // ── 2. Orval'den Otomatik Tool Keşfi ──────────────────────────────────────
  // src/api/endpoints/ klasörü altındaki üretilmiş dosyaları tarar
  // ve her bir API metodunu otomatik olarak bir MCP tool'una dönüştürür.
  try {
    const endpointsDir = join(__dirname, "api/endpoints");
    await registerOrvalTools(server, endpointsDir);
  } catch (err: any) {
    // Tool'lar yüklenemezse log yaz
    process.stderr.write(
      `❌ Orval tool'ları kaydedilemedi: ${err.message}\n`,
    );
  }

  // ── 3. Claude Desktop'a Bağlan ─────────────────────────────────────────────
  // Stdio transport: Claude Desktop ile standart input/output üzerinden
  // JSON-RPC protokolüyle haberleşir.
  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write("✅ AARO ERP MCP Server başladı (stdio modu)\n");
}

// main() fonksiyonunu başlat, hata olursa logla ve çık
main().catch((err) => {
  process.stderr.write(`❌ Başlatma hatası: ${err.message}\n`);
  process.exit(1);
});
