/**
 * Aaro ERP API — Runtime Base URL Yapılandırması
 *
 * Orval generate sırasında hardcode edilen baseUrl'i runtime'da
 * environment variable üzerinden değiştirmeyi sağlar.
 *
 * Kullanım:
 *   AARO_BASE_URL=https://staging.aaro.com.tr node dist/index.js
 *
 * Değiştirilmezse varsayılan olarak https://erp.aaro.com.tr kullanılır.
 */

// Varsayılan baseUrl — orval.config.ts ile aynı değer
const DEFAULT_BASE_URL = "https://erp.aaro.com.tr";

/**
 * Aktif baseUrl'i döndürür.
 * Öncelik: AARO_BASE_URL env variable > varsayılan
 */
export function getBaseUrl(): string {
  const envUrl = process.env.AARO_BASE_URL;
  if (envUrl) {
    // Sondaki slash'i temizle
    return envUrl.replace(/\/+$/, "");
  }
  return DEFAULT_BASE_URL;
}
