import fs from 'fs';
import path from 'path';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Orval dosyalarındaki JSDoc yorumlarını basit bir şekilde ayıklar.
 * tsc derlemesi sırasında yorumlar kaybolduğu için .ts dosyalarını metin olarak okuruz.
 */
function extractMetadata(fileContent: string, schemaName: string) {
  // export const [schemaName] = zod.object... diziliminden hemen önceki yorum bloğunu bulur
  const regex = new RegExp(`\\/\\*\\*([\\s\\S]*?)\\*\\/\\s*export const ${schemaName}`, 'm');
  const match = fileContent.match(regex);

  if (!match) return null;

  const comment = match[1];
  const summary = comment.match(/@summary\s+(.*)/)?.[1]?.trim() || "";
  const intent = comment.match(/INTENT:\s+(.*)/)?.[1]?.trim() || "";
  const kullanim = comment.match(/KULLANIM:\s+(.*)/)?.[1]?.trim() || "";
  const mcpNot = comment.match(/MCP_NOT:\s+(.*)/)?.[1]?.trim() || "";
  const filtre = comment.match(/FILTRE:\s+(.*)/)?.[1]?.trim() || "";

  return {
    summary,
    description: `${summary}\n\nİSTEK AMACI: ${intent}\nKULLANIM: ${kullanim}\nNOT: ${mcpNot}${filtre ? `\nFİLTRE ÖRNEĞİ: ${filtre}` : ''}`.trim()
  };
}

interface EndpointRegistry {
  operationId: string;
  summary: string;
  description: string;
  category: string;
  zodSchema: z.ZodTypeAny;
  execute: (input: any) => Promise<any>;
}

/**
 * Orval tarafından üretilen src/api/endpoints klasörünü tarar ve hafızaya doldurur.
 * MCP'ye ise sadece 3 adet metatool kaydeder (Dynamic Router Yöntemi).
 */
export async function registerOrvalTools(server: McpServer, endpointsDir: string) {
  const categories = fs.readdirSync(endpointsDir);
  const registry: Record<string, EndpointRegistry> = {};
  let totalToolsLoaded = 0;

  for (const cat of categories) {
    const catPath = path.join(endpointsDir, cat);
    if (!fs.statSync(catPath).isDirectory()) continue;

    // banka-hesap -> banka-hesap.ts / banka-hesap.zod.ts
    const zodFilePath = path.join(catPath, `${cat}.zod.ts`);
    const apiFilePath = path.join(catPath, `${cat}.ts`);

    if (!fs.existsSync(zodFilePath) || !fs.existsSync(apiFilePath)) continue;

    // 1. Zod dosyasını metin olarak oku (metadata için)
    const zodFileContent = fs.readFileSync(zodFilePath, 'utf-8');

    // 2. Modülleri dinamik olarak import et
    // Windows path'lerini file:// formatına çeviriyoruz
    const zodFileUrl = `file:///${zodFilePath.replace(/\\/g, '/')}`;
    const apiFileUrl = `file:///${apiFilePath.replace(/\\/g, '/')}`;

    const zodModule = await import(zodFileUrl);
    const apiModule = await import(apiFileUrl);

    // Orval fabrika fonksiyonunu bul (getCari, getBankaHesap vb.)
    const factoryName = Object.keys(apiModule).find(k => k.startsWith('get'));
    if (!factoryName) continue;

    const methods = apiModule[factoryName]();

    // 3. Zod şemalarını gez ve eşleşen metodları hafızaya ata
    const schemas = Object.keys(zodModule);

    for (const schemaName of schemas) {
      if (schemaName.endsWith('Response')) continue; // Yanıt şemalarını atla

      const metadata = extractMetadata(zodFileContent, schemaName);
      if (!metadata) continue;

      // Basit bir eşleştirme mantığı: methods içindeki anahtarlardan schemaName ile en çok benzeyeni bul
      const matchingMethod = Object.keys(methods).find(methodName => {
        // Hem metod hem şema ismindeki tüm özel karakterleri ( _ , - , . ) temizle ve küçük harfe çevir
        const cleanMethod = methodName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanSchema = schemaName.toLowerCase()
          .replace('queryparams', '')
          .replace('body', '')
          .replace('pathparameters', '')
          .replace('params', '')
          .replace(/[^a-z0-9]/g, '');

        return cleanMethod === cleanSchema || cleanMethod.startsWith(cleanSchema);
      });

      if (matchingMethod) {
        const operationId = matchingMethod; // Metodun asıl (camelCase) ismi

        if (registry[operationId]) {
          // Zaten kaydedilmiş (muhtemelen hem Body hem QueryParams var veya diğer pakette var)
          continue;
        }

        const zodShape = zodModule[schemaName];

        registry[operationId] = {
          operationId,
          summary: metadata.summary || operationId,
          description: metadata.description || metadata.summary || "Aaro API Endpoint Tool",
          category: cat,
          zodSchema: zodShape.shape ? z.object(zodShape.shape) : zodShape,
          execute: async (input: any) => {
            // Orval metodları parametre yapısına göre farklılık gösterebilir.
            const func = methods[matchingMethod];

            if (schemaName.endsWith('Body')) {
              // POST/PUT isteği
              return await func(input);
            } else {
              // GET/DELETE isteği
              return await func(input);
            }
          }
        };

        totalToolsLoaded++;
      }
    }
  }

  process.stderr.write(`🚀 Orval Discovery: ${totalToolsLoaded} metod hafızaya yüklendi.\n`);

  // --- KAYIT: MCP METATOOL'LARI ---

  server.tool(
    "search_erp_endpoints",
    "İç hafızada (RAM) arama yaparak ilgili ERP API metodlarının isimlerini (operationId) ve kısa özetlerini döner. Metodları kategori veya anahtar kelime ile arayabilirsiniz.",
    {
      category: z.string().optional().describe("Aramayı daraltmak için kategori adı (örn: cari-hesap)"),
      query: z.string().optional().describe("Aramak için anahtar kelime veya operationId parçası")
    },
    async (args: { category?: string; query?: string }) => {
      let results = Object.values(registry);

      const { category, query } = args;

      if (category) {
        results = results.filter(r => r.category.toLowerCase() === category.toLowerCase() || r.category.toLowerCase().includes(category.toLowerCase()));
      }

      if (query) {
        const q = query.toLowerCase();
        results = results.filter(r =>
          r.operationId.toLowerCase().includes(q) ||
          r.summary.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q)
        );
      }

      // En fazla 100 sonuç dönerek context'i boğmayalım
      const mapped = results.map(r => ({ operationId: r.operationId, summary: r.summary, category: r.category })).slice(0, 100);

      return {
        content: [
          {
            type: "text" as const,
            text: mapped.length > 0
              ? JSON.stringify(mapped, null, 2)
              : "Böyle bir endpoint bulunamadı. Lütfen daha geniş bir arama (query/category) yapın.",
          },
        ],
      };
    }
  );

  server.tool(
    "get_erp_endpoint_schema",
    "İstek atılacak metodun ne tür parametreler istediğini JSON Schema olarak döner. İsteği oluşturmadan önce bu şemaya bakarak doğru formatta veri hazırlamalısınız.",
    {
      operationId: z.string().describe("API metodunun kimliği (örn: setCariKayitDetayli)")
    },
    async (args: { operationId: string }) => {
      const { operationId } = args;
      const endpoint = registry[operationId];

      if (!endpoint) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Hata: ${operationId} adında bir endpoint bulunamadı. Lütfen "search_erp_endpoints" aracıyla geçerli bir ID seçin.` }]
        };
      }

      try {
        const schema = zodToJsonSchema(endpoint.zodSchema as any, "Payload");
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                operationId: endpoint.operationId,
                description: endpoint.description,
                schema
              }, null, 2)
            }
          ]
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Schema üretilirken hata: ${err?.message}` }]
        };
      }
    }
  );

  server.tool(
    "execute_erp_endpoint",
    "Bir ERP metodunu (operationId) tetikler ve payload (istenilen parametreler/body) verisini ona gönderir. Sonucu döner. Lütfen önce şemayı 'get_erp_endpoint_schema' aracılığıyla teyit edin.",
    {
      operationId: z.string().describe("Tetiklenecek metodun ID'si"),
      // z.any() kullanılamayacağı için z.record veya genel bir tür kullanmak daha güvenli:
      payload: z.any().optional().describe("İstek için gönderilecek veri.")
    },
    async (args: { operationId: string; payload?: any }) => {
      const { operationId, payload } = args;

      const endpoint = registry[operationId];
      if (!endpoint) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `Hata: ${operationId} adında bir endpoint bulunamadı. Lütfen geçerli bir metod ID'si sağladığınızdan emin olun.` }]
        };
      }

      try {
        const response = await endpoint.execute(payload);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: error?.message || "Bilinmeyen API hatası (Axios veya Metod)",
            },
          ],
        };
      }
    }
  );

  process.stderr.write(`🚀 MCP: 3 adet Dynamic Router aracı başarıyla kaydedildi.\n`);
}
