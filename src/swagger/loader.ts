import axios from "axios";

/**
 * ─── Swagger Tip Tanımları ────────────────────────────────────────────────────
 * Swagger/OpenAPI 2.0 (Swashbuckle) formatındaki temel yapılar.
 * AARO ERP'nin ürettiği swagger.json bu formattadır.
 */

export interface SwaggerParameter {
  name: string;
  in: "query" | "path" | "body" | "header" | "formData";
  required?: boolean;
  type?: string;           // "string" | "integer" | "number" | "boolean" | "array"
  format?: string;         // "int32" | "int64" | "float" | "double" | "date-time" vb.
  description?: string;
  minimum?: number;
  maximum?: number;
  enum?: (string | number)[];
  items?: { type?: string };
  schema?: {
    $ref?: string;
    type?: string;
    properties?: Record<string, SwaggerParameter>;
  };
}

export interface SwaggerOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  parameters?: SwaggerParameter[];
  responses?: Record<string, unknown>;
}

export interface SwaggerDoc {
  swagger?: string;
  openapi?: string;
  info?: { title?: string; version?: string };
  paths: Record<string, Record<string, SwaggerOperation>>;
  definitions?: Record<string, unknown>;
}

/**
 * Verilen URL'den Swagger JSON'u indirir ve parse eder.
 * Başarısız olursa hata fırlatır.
 */
export async function loadSwaggerDoc(url: string): Promise<SwaggerDoc> {
  process.stderr.write(`📥 Swagger dokümantasyonu yükleniyor: ${url}\n`);

  try {
    const response = await axios.get<SwaggerDoc>(url, {
      timeout: 15000,
      headers: { Accept: "application/json" },
    });

    const doc = response.data;

    if (!doc || !doc.paths) {
      throw new Error("Geçersiz Swagger belgesi: 'paths' alanı bulunamadı.");
    }

    const endpointSayisi = Object.keys(doc.paths).length;
    process.stderr.write(
      `✅ Swagger yüklendi. Toplam endpoint sayısı: ${endpointSayisi}\n`
    );

    return doc;
  } catch (error: any) {
    const mesaj = error?.response?.data || error?.message || String(error);
    throw new Error(`Swagger yüklenemedi (${url}): ${mesaj}`);
  }
}

/**
 * Swagger doc içinden belirtilen path + method'a ait operasyonu döndürür.
 * Bulunamazsa null döner.
 */
export function findOperation(
  doc: SwaggerDoc,
  path: string,
  method: string
): SwaggerOperation | null {
  const pathItem = doc.paths[path];
  if (!pathItem) return null;
  return pathItem[method.toLowerCase()] ?? null;
}
