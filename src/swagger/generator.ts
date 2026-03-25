import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createErpClient } from "../erp/client.js";
import {
  SwaggerDoc,
  SwaggerOperation,
  SwaggerParameter,
  findOperation,
} from "./loader.js";
import { EndpointConfig } from "./config.js";

// Swagger'dan gelen parametre bilgisini alıp
// bunu Zod şemasına (validation schema) dönüştüren fonksiyon.
// Amaç: Swagger parametrelerini MCP tool input şemasına çevirmek.
function swaggerParamToZod(param: SwaggerParameter): z.ZodTypeAny {
  // Swagger parametresinin type bilgisini alıyoruz.
  // Eğer type yoksa varsayılan olarak "string" kabul ediyoruz.
  const type = param.type?.toLowerCase() ?? "string";

  // Format bilgisini alıyoruz (int32, int64, date vb.).
  // Yoksa boş string.
  const format = param.format?.toLowerCase() ?? "";

  // Açıklama varsa onu kullanıyoruz.
  // Yoksa parametre adını açıklama olarak kullanıyoruz.
  const desc = param.description ?? param.name;

  // Oluşturulacak Zod şemasını tutacak değişken
  let schema: z.ZodTypeAny;

  // Eğer parametre tipi number veya integer ise
  if (type === "integer" || type === "number") {
    // Temel number schema oluştur
    let numSchema = z.number();

    // Eğer integer ise veya format int32/int64 ise
    // sadece tam sayı kabul edecek şekilde ayarla
    if (type === "integer" || format === "int32" || format === "int64") {
      numSchema = numSchema.int();
    }

    // Minimum değer varsa Zod min kuralını ekle
    if (param.minimum !== undefined) {
      numSchema = numSchema.min(param.minimum);
    }

    // Maximum değer varsa Zod max kuralını ekle
    if (param.maximum !== undefined) {
      numSchema = numSchema.max(param.maximum);
    }

    // Son oluşturulan number schema'yı ana schema'ya ata
    schema = numSchema;

    // Eğer parametre boolean ise
  } else if (type === "boolean") {
    // Boolean Zod schema oluştur
    schema = z.boolean();
  } else {
    // Diğer tüm durumlar string olarak kabul edilir

    // Eğer Swagger parametresinde enum varsa
    if (param.enum && param.enum.length > 0) {
      // Enum değerlerini string'e çevir
      // Zod enum için tuple formatı gerekiyor
      const strEnums = param.enum.map(String) as [string, ...string[]];

      // Enum değerlerini kabul eden Zod enum schema oluştur
      schema = z.enum(strEnums);
    } else {
      // Enum yoksa normal string kabul eden schema oluştur
      schema = z.string();
    }
  }

  // Schema'ya açıklama ekliyoruz.
  // Bu açıklama MCP tool input'unda Claude'a gösterilir.
  schema = (schema as z.ZodString).describe(
    `${desc}${param.required ? " (zorunlu)" : " (opsiyonel)"}`
  );

  // Eğer parametre zorunlu değilse
  // schema'yı optional yapıyoruz
  if (!param.required) {
    schema = schema.optional();
  }

  // Son oluşturulan Zod schema'yı döndür
  return schema;
}

// Swagger'dan gelen bir operation (endpoint tanımı) içindeki parametreleri
// Zod şemasına dönüştürerek MCP tool input shape'i oluşturan fonksiyon.
// Amaç: Swagger parametrelerinden otomatik Zod input objesi üretmek.
function buildZodShape(
  operation: SwaggerOperation
): Record<string, z.ZodTypeAny> {
  // Zod shape objesi oluşturuyoruz.
  // Bu obje MCP tool'un input parametrelerini tanımlar.
  // Record<string, z.ZodTypeAny> → key parametre adı, value Zod schema.
  const shape: Record<string, z.ZodTypeAny> = {
    // Her endpoint için ortak olarak kullanılabilecek "token" parametresi ekleniyor.
    // Bu parametre kullanıcı isterse manuel token gönderebilsin diye var.
    token: z
      .string()
      .optional()
      .describe(
        "Bearer token. Girilmezse .env'deki ERP_BEARER_TOKEN kullanılır."
      ),
  };

  const params = operation.parameters ?? [];
  for (const param of params) {
    // Sadece query ve path parametrelerini alıyoruz
    // body parametrelerini şu an desteklemiyoruz (GET isteklerinde olmaz zaten)
    if (param.in !== "query" && param.in !== "path") continue;

    // Parametre adını olduğu gibi kullanıyoruz
    const safeKey = param.name;

    try {
      shape[safeKey] = swaggerParamToZod(param);
    } catch {
      // Dönüşümde hata olursa string olarak ekle
      shape[safeKey] = z.string().optional().describe(param.description ?? safeKey);
    }
  }

  return shape;
}

// Path içindeki {id}, {cariId} gibi alanları
// tool input içinden alıp gerçek değere çevirir.
//
// Örnek:
// path  = "/api/Cari/{id}"
// input = { id: 123 }
// sonuç = "/api/Cari/123"
function buildPathParams(
  path: string,
  input: Record<string, unknown>
): string {
  return path.replace(/{(.*?)}/g, (_, key) => {
    const value = input[key];

    if (value === undefined || value === null || value === "") {
      throw new Error(`Zorunlu path parametresi eksik: ${key}`);
    }

    return encodeURIComponent(String(value));
  });
}

// MCP tool'dan gelen input parametrelerini alıp
// ERP API'ye gönderilecek query parametrelerini hazırlayan fonksiyon.
//
// Amaç:
// Claude → MCP Tool Input → API Query Params dönüşümünü yapmak
function buildRequestParams(
  input: Record<string, unknown>,
  path: string
): Record<string, string | number | boolean> {
  // API'ye gönderilecek parametreleri tutacak obje.
  const params: Record<string, string | number | boolean> = {};

  // Path içindeki parametre adlarını çıkarıyoruz.
  // Örn: "/api/Cari/{id}" -> ["id"]
  const pathParamNames = Array.from(path.matchAll(/{(.*?)}/g)).map(
    (match) => match[1]
  );

  // Tool input objesindeki tüm key-value çiftlerini dolaşıyoruz
  for (const [key, value] of Object.entries(input)) {
    // token query param'a gitmez
    if (key === "token") continue;

    // path içinde kullanılan parametre query'ye tekrar eklenmez
    if (pathParamNames.includes(key)) continue;

    // boş değerleri query'ye gönderme
    if (value === undefined || value === null || value === "") continue;

    // geçerli değerleri params objesine ekle
    params[key] = value as string | number | boolean;
  }

  return params;
}

/**
 * ─── Ana Fonksiyon: Dinamik Tool Kayıt ───────────────────────────────────────
 *
 * Beyaz listedeki endpoint'leri teker teker Swagger doc'tan bulur,
 * Zod şemasını otomatik üretir ve MCP server'a tool olarak kaydeder.
 *
 * @param server  - MCP server instance
 * @param doc     - Swagger JSON dökümanı
 * @param configs - Kullanmak istediğimiz endpoint'lerin whitelist konfigürasyonu
 */
export function registerSwaggerTools(
  server: McpServer,
  doc: SwaggerDoc,
  configs: EndpointConfig[]
): void {
  // Kaç tool başarıyla kaydedildi onu saymak için sayaç
  let basariSayisi = 0;

  // Kaç endpoint swagger'da bulunamadı ya da kaydedilemedi onu saymak için sayaç
  let hataSayisi = 0;

  // Whitelist'teki her endpoint config'ini tek tek dolaşıyoruz
  for (const config of configs) {
    // İlgili endpoint'i swagger dokümanı içinde bulmaya çalışıyoruz
    const operation = findOperation(doc, config.path, config.method);

    // Eğer swagger içinde bu endpoint yoksa
    if (!operation) {
      process.stderr.write(
        `⚠️  Bulunamadı: ${config.method.toUpperCase()} ${config.path} (swagger'da yok, atlanıyor)\n`
      );

      hataSayisi++;
      continue;
    }

    // Tool açıklamasını belirliyoruz
    const toolDescription =
      config.description ||
      operation.summary ||
      operation.description ||
      `${config.path} endpoint'ini sorgular.`;

    // Swagger operation içindeki parametrelerden Zod input schema üretiyoruz
    const zodShape = buildZodShape(operation);

    // Closure içinde kullanmak için path'i ayrı değişkende tutuyoruz
    const endpointPath = config.path;

    // MCP tool'unu server'a kaydediyoruz
    server.tool(
      config.toolName,
      toolDescription,
      zodShape,
      async (input) => {
        try {
          // Eğer kullanıcı input içinde token gönderirse onu al
          const token = typeof input.token === "string" ? input.token : undefined;

          // ERP API client'ını oluştur
          const client = createErpClient(token);

          // Path parametrelerini URL içine yerleştir
          const resolvedPath = buildPathParams(
            endpointPath,
            input as Record<string, unknown>
          );

          // Query parametrelerini hazırla
          const params = buildRequestParams(
            input as Record<string, unknown>,
            endpointPath
          );

          // Method'a göre doğru HTTP isteğini at
          let response;
          if (config.method === "delete") {
            response = await client.delete(resolvedPath);
          } else {
            // ERP endpoint'ine GET isteği at
            response = await client.get(resolvedPath, { params });
          }

          // Dönen response body
          const data = response.data;

          // Dönen veri içindeki kayıt sayısını tahmin etmeye çalışıyoruz
          const kayitSayisi = Array.isArray(data?.sonuc)
            ? data.sonuc.length
            : Array.isArray(data)
            ? data.length
            : "?";

          return {
            content: [
              {
                type: "text" as const,
                text:
                  `✅ ${resolvedPath} başarıyla sorgulandı.\n` +
                  `📊 Dönen kayıt sayısı: ${kayitSayisi}\n\n` +
                  JSON.stringify(data, null, 2),
              },
            ],
          };
        } catch (error: any) {
          const mesaj =
            error?.response?.data?.message ||
            error?.response?.data ||
            error?.message ||
            "Bilinmeyen hata";

          const statusKod = error?.response?.status ?? "N/A";

          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text:
                  `❌ ${endpointPath} sorgulanamadı.\n` +
                  `HTTP Durum: ${statusKod}\n` +
                  `Hata: ${JSON.stringify(mesaj, null, 2)}`,
              },
            ],
          };
        }
      }
    );

    process.stderr.write(
      `✅ Tool kaydedildi: ${config.toolName} ← ${config.method.toUpperCase()} ${endpointPath}\n`
    );

    basariSayisi++;
  }

  process.stderr.write(
    `\n📋 Tool kayıt özeti: ${basariSayisi} başarılı, ${hataSayisi} başarısız.\n`
  );
}