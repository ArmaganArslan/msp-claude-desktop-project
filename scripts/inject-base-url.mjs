/**
 * inject-base-url.mjs
 *
 * Orval generate sonrası çalışan post-processing script.
 * http-client.ts içindeki hardcode 'https://erp.aaro.com.tr' URL'lerini
 * runtime'da değiştirilebilir getBaseUrl() çağrısına dönüştürür.
 *
 * Pipeline: orval → fix-esm-imports → inject-base-url → generate-models
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const HTTP_CLIENT_PATH = join(__dirname, "../src/api/http-client.ts");
const HARDCODED_BASE_URL = "https://erp.aaro.com.tr";

// ── 1. Dosyayı oku ──────────────────────────────────────────────────────────
let content = readFileSync(HTTP_CLIENT_PATH, "utf-8");

// ── 2. Hardcode URL sayısını kontrol et ──────────────────────────────────────
const occurrences = (content.match(new RegExp(HARDCODED_BASE_URL, "g")) || []).length;

if (occurrences === 0) {
  console.log("[inject-base-url] Hardcode baseUrl bulunamadı, atlanıyor.");
  process.exit(0);
}

console.log(`[inject-base-url] ${occurrences} hardcode baseUrl bulundu.`);

// ── 3. Import satırını ekle (dosyanın mevcut import'larından sonra) ──────────
const importLine = `import { getBaseUrl } from '../api-config.js';`;

if (!content.includes(importLine)) {
  // İlk import satırını bul ve ondan önce ekle
  const firstImportIdx = content.indexOf("\nimport ");
  if (firstImportIdx !== -1) {
    content =
      content.slice(0, firstImportIdx) +
      "\n" +
      importLine +
      content.slice(firstImportIdx);
  } else {
    // Import yoksa dosyanın başına ekle (header comment'ten sonra)
    const headerEnd = content.indexOf("*/");
    if (headerEnd !== -1) {
      const insertPos = headerEnd + 2;
      content =
        content.slice(0, insertPos) +
        "\n\n" +
        importLine +
        "\n" +
        content.slice(insertPos);
    } else {
      content = importLine + "\n\n" + content;
    }
  }
}

// ── 4. Hardcode URL'leri getBaseUrl() ile değiştir ───────────────────────────
// Template literal içinde: `https://erp.aaro.com.tr/api/...`
//                    →     `${getBaseUrl()}/api/...`
content = content.replaceAll(
  "`" + HARDCODED_BASE_URL,
  "`${getBaseUrl()}"
);

// String literal içinde (varsa): 'https://erp.aaro.com.tr'
// Bu pattern normalde template literal dışında kullanılmaz ama güvenlik için
content = content.replaceAll(
  "'" + HARDCODED_BASE_URL + "'",
  "getBaseUrl()"
);
content = content.replaceAll(
  '"' + HARDCODED_BASE_URL + '"',
  "getBaseUrl()"
);

// ── 5. Dosyayı yaz ──────────────────────────────────────────────────────────
writeFileSync(HTTP_CLIENT_PATH, content, "utf-8");

// ── 6. Doğrulama ────────────────────────────────────────────────────────────
const remaining = (content.match(new RegExp(HARDCODED_BASE_URL, "g")) || []).length;

if (remaining > 0) {
  console.error(
    `[inject-base-url] UYARI: ${remaining} hardcode URL hala kaldı!`
  );
  process.exit(1);
}

console.log(
  `[inject-base-url] Tamamlandı. ${occurrences} URL → getBaseUrl() ile değiştirildi.`
);
