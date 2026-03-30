import { WHITELISTED_ENDPOINTS as ENDPOINTS } from "./endpoints/index.js";
import type { EndpointConfig } from "./types.js";

/** 
 * Swagger Auto-Generator Konfigürasyonu
 * 
 * Bu dosya artık endpoint listesini ./endpoints dizini altındaki 
 * dosyalardan (cari.ts, stok.ts vb.) alır.
 */

export type { EndpointConfig };
export const WHITELISTED_ENDPOINTS: EndpointConfig[] = ENDPOINTS;

/** Swagger JSON'un indirileceği URL */
export const SWAGGER_URL =
  process.env.SWAGGER_URL || "https://erp.aaro.com.tr/swagger/docs/v1";
