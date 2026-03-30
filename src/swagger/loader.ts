import axios from "axios";
import * as fs from "fs";
import * as path from "path";

/**
 * Swagger/OpenAPI 2.0 şema tipi
 */
export interface SwaggerSchema {
  $ref?: string;
  type?: string;
  format?: string;
  description?: string;
  enum?: (string | number)[];
  items?: SwaggerSchema;
  required?: string[];
  properties?: Record<string, SwaggerSchema>;
  additionalProperties?: SwaggerSchema | boolean;
}

/**
 * Swagger parametresi
 */
export interface SwaggerParameter {
  name: string;
  in: "query" | "path" | "body" | "header" | "formData";
  required?: boolean;
  type?: string;
  format?: string;
  description?: string;
  minimum?: number;
  maximum?: number;
  enum?: (string | number)[];
  items?: { type?: string };
  schema?: SwaggerSchema;
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
  definitions?: Record<string, SwaggerSchema>;
}

/**
 * Verilen URL'den Swagger JSON'u indirir ve parse eder.
 * Başarısız olursa hata fırlatır.
 */
export async function loadSwaggerDoc(urlOrPath: string): Promise<SwaggerDoc> {
  const isLocalFile =
    !urlOrPath.startsWith("http://") && !urlOrPath.startsWith("https://");

  if (isLocalFile) {
    const absolutePath = path.resolve(urlOrPath);
    process.stderr.write(
      `📂 Swagger yerel dosyadan yükleniyor: ${absolutePath}\n`,
    );

    const raw = fs.readFileSync(absolutePath, "utf-8");
    const doc: SwaggerDoc = JSON.parse(raw);

    if (!doc || !doc.paths) {
      throw new Error(
        `Geçersiz Swagger belgesi: 'paths' alanı bulunamadı. (${absolutePath})`,
      );
    }

    const endpointSayisi = Object.keys(doc.paths).length;
    process.stderr.write(
      `✅ Swagger yüklendi (yerel). Toplam endpoint sayısı: ${endpointSayisi}\n`,
    );

    return doc;
  }

  process.stderr.write(`📥 Swagger uzak sunucudan yükleniyor: ${urlOrPath}\n`);

  try {
    const response = await axios.get<SwaggerDoc>(urlOrPath, {
      timeout: 15000,
      headers: { Accept: "application/json" },
    });

    const doc = response.data;

    if (!doc || !doc.paths) {
      throw new Error("Geçersiz Swagger belgesi: 'paths' alanı bulunamadı.");
    }

    const endpointSayisi = Object.keys(doc.paths).length;
    process.stderr.write(
      `✅ Swagger yüklendi (uzak). Toplam endpoint sayısı: ${endpointSayisi}\n`,
    );

    return doc;
  } catch (error: any) {
    const mesaj = error?.response?.data || error?.message || String(error);
    throw new Error(`Swagger yüklenemedi (${urlOrPath}): ${mesaj}`);
  }
}

/**
 * Swagger doc içinden belirtilen path + method'a ait operasyonu döndürür.
 * Bulunamazsa null döner.
 */
export function findOperation(
  doc: SwaggerDoc,
  path: string,
  method: string,
): SwaggerOperation | null {
  const pathItem = doc.paths[path];
  if (!pathItem) return null;
  return pathItem[method.toLowerCase()] ?? null;
}
