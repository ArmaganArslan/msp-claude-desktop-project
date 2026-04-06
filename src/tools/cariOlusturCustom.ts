/**
 * 📄 cariOlusturCustom.ts
 *
 * Bu dosya, ERP sisteminde yeni bir cari kart oluşturmak için
 * Manuel olarak yazılmış özel (custom) bir MCP tool'u içerir.
 *
 * ⚙️ Neden custom tool?
 *   Swagger'dan otomatik üretilen tool'larda kullanıcı TipID gibi
 *   numeric ID'leri bilmek zorunda kalıyordu. Bu custom tool sayesinde
 *   kullanıcı "Müşteri", "Satıcı" gibi Türkçe ifadeler kullanır,
 *   biz içeride doğru ID'ye çeviririz.
 *
 * 🔗 Hedef endpoint: POST /api/Cari
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createErpClient } from "../erp/client.js";
import { logRequest, logResponse, logError } from "../logger.js";

/**
 * Kullanıcının yazdığı cari tipini ERP'nin beklediği numeric ID'ye çevirir.
 * Kullanıcı "Müşteri" yazar → API'ye 102001 gider.
 *
 * Yeni bir tip eklemek için buraya satır eklemek ve
 * aşağıdaki z.enum listesini güncellemek yeterli.
 */
const TIP_MAP: Record<string, number> = {
  "Müşteri":   102001,
  "Satıcı":    102002,
  "Kara Liste":102003,
  "Potansiyel":102004,
  "Personel":  102005,
  "Kamu":      102006,
  "Ortak":     102007,
};

/**
 * Bu fonksiyon, MCP server'a "cari_olustur_custom" adlı tool'u kaydeder.
 * src/index.ts içinde çağrılır: registerCariOlusturCustomTool(server)
 *
 * @param server - MCP server instance'ı (index.ts'den gelir)
 */
export function registerCariOlusturCustomTool(server: McpServer) {
  server.tool(
    // Tool adı — Claude Desktop'ta bu isimle görünür
    "cari_olustur_custom",

    // Claude'a bu tool'un ne iş yaptığını anlatan açıklama.
    // Claude bu metni okuyarak hangi durumda bu tool'u çağıracağına karar verir.
    "ERP sisteminde yeni bir cari kartı oluşturur. Müşteri, satıcı, personel vb. cari tipleri desteklenir.",

    // ─── Parametre Şeması (Zod) ───────────────────────────────────────
    // Claude bu şemayı okuyarak hangi bilgileri kullanıcıdan soracağını belirler.
    // z.string(), z.number(), z.boolean() → alan tipi
    // .describe("...") → Claude'a bu alanın ne anlama geldiğini açıklar
    // .optional() → zorunlu değil, verilmezse body'e eklenmez
    {
      // Opsiyonel bearer token. Girilmezse .env'deki ERP_BEARER_TOKEN kullanılır.
      token: z
        .string()
        .optional()
        .describe(
          "Bearer token. Girilmezse .env içindeki ERP_BEARER_TOKEN kullanılır.",
        ),

      // Zorunlu alanlar — API bu alanlar olmadan cari oluşturmayı reddeder
      CariKodu: z.string().min(1).describe("Cari kodu (benzersiz olmalı, örn: 'MUS-001')"),
      CariAdi:  z.string().min(1).describe("Cari adı veya unvanı (örn: 'ABC Ticaret A.Ş.')"),

      // Kullanıcı Türkçe tip ismi yazar → TIP_MAP ile ID'ye çevrilir
      Tip: z
        .enum(["Müşteri", "Satıcı", "Kara Liste", "Potansiyel", "Personel", "Kamu", "Ortak"])
        .describe("Cari tipi: Müşteri, Satıcı, Kara Liste, Potansiyel, Personel, Kamu veya Ortak"),

      VergiNo:       z.string().min(1).describe("Vergi numarası veya TC kimlik numarası"),
      VergiDairesiID: z.number().int().describe("Vergi dairesi ID numarası"),

      // ─── Opsiyonel Alanlar ──────────────────────────────────────────
      // Bu alanlar girilmezse API'ye gönderilmez (cleanedBody ile filtrelenir)
      CalismaParaBirimiID:  z.number().int().optional(),
      MuhtelifMi:           z.boolean().optional(),
      Vade:                 z.number().int().optional(),
      PlasiyerID:           z.number().int().optional(),
      SubeID:               z.number().int().optional(),
      SirketID:             z.number().int().optional(),
      Durum:                z.boolean().optional(),

      // Sınıflandırma kodları
      Kod1ID: z.number().int().optional(),
      Kod2ID: z.number().int().optional(),
      Kod3ID: z.number().int().optional(),
      Kod4ID: z.number().int().optional(),
      Kod5ID: z.number().int().optional(),
      Kod6ID: z.number().int().optional(),

      // Etiketler
      Etiket1ID: z.number().int().optional(),
      Etiket2ID: z.number().int().optional(),
      Etiket3ID: z.number().int().optional(),
      Etiket4ID: z.number().int().optional(),
      Etiket5ID: z.number().int().optional(),

      // Serbest metin alanları
      YedekS1: z.string().optional(),
      YedekS2: z.string().optional(),
      YedekS3: z.string().optional(),

      // Diğer opsiyonel alanlar
      TabelaAdi:             z.string().optional(),
      FiyatListesiCariGrupID:z.number().int().optional(),
      Seviye:                z.number().int().optional(),
      EntegrasyonTanimID:    z.number().int().optional(),
      SablonID:              z.number().int().optional(),
      GoruntulemeGrupID:     z.number().int().optional(),
    },

    // ─── Tool Handler (Asıl iş burada yapılır) ────────────────────────
    // Claude parametreleri doldurduğunda bu async fonksiyon çalışır.
    async (input) => {
      const startTime = Date.now(); // Yanıt süresini ölçmek için

      try {
        // Bearer token: kullanıcı verdiyse onu, yoksa .env'dekini kullan
        const token = input.token;
        const client = createErpClient(token);

        // API'ye gönderilecek body'yi oluştur.
        // Kullanıcının yazdığı "Müşteri" → TIP_MAP ile 102001'e çevrilir.
        const body = {
          CariKodu:   input.CariKodu,
          CariAdi:    input.CariAdi,
          TipID:      TIP_MAP[input.Tip], // "Müşteri" → 102001
          VergiNo:    input.VergiNo,
          VergiDairesiID: input.VergiDairesiID,

          CalismaParaBirimiID:   input.CalismaParaBirimiID,
          MuhtelifMi:            input.MuhtelifMi,
          Vade:                  input.Vade,
          PlasiyerID:            input.PlasiyerID,
          SubeID:                input.SubeID,
          SirketID:              input.SirketID,
          Durum:                 input.Durum,

          Kod1ID: input.Kod1ID,
          Kod2ID: input.Kod2ID,
          Kod3ID: input.Kod3ID,
          Kod4ID: input.Kod4ID,
          Kod5ID: input.Kod5ID,
          Kod6ID: input.Kod6ID,

          Etiket1ID: input.Etiket1ID,
          Etiket2ID: input.Etiket2ID,
          Etiket3ID: input.Etiket3ID,
          Etiket4ID: input.Etiket4ID,
          Etiket5ID: input.Etiket5ID,

          YedekS1: input.YedekS1,
          YedekS2: input.YedekS2,
          YedekS3: input.YedekS3,

          TabelaAdi:              input.TabelaAdi,
          FiyatListesiCariGrupID: input.FiyatListesiCariGrupID,
          Seviye:                 input.Seviye,
          EntegrasyonTanimID:     input.EntegrasyonTanimID,
          SablonID:               input.SablonID,
          GoruntulemeGrupID:      input.GoruntulemeGrupID,
        };

        // undefined olan alanları body'den çıkar — API gereksiz null alanları sevmez
        const cleanedBody = Object.fromEntries(
          Object.entries(body).filter(([, value]) => value !== undefined),
        );

        // İsteği loglara yaz (logs/requests.log dosyasına)
        logRequest(
          "cari_olustur_custom",
          "POST",
          "/api/Cari",
          undefined,
          cleanedBody,
        );

        // ERP API'sine POST isteği gönder
        const res = await client.post("/api/Cari", cleanedBody);

        const responseData = res.data;

        // Dönen kayıt sayısını belirle (loglama için)
        const recordCount = Array.isArray(responseData?.Model)
          ? responseData.Model.length
          : Array.isArray(responseData)
            ? responseData.length
            : 1;

        // Başarılı yanıtı logla
        logResponse(
          "/api/Cari",
          res.status,
          recordCount,
          Date.now() - startTime,
        );

        // Claude Desktop'a gösterilecek başarı mesajı
        return {
          content: [
            {
              type: "text" as const,
              text:
                "✅ Cari oluşturma isteği başarıyla gönderildi.\n\n" +
                "Gönderilen Body:\n" +
                JSON.stringify(cleanedBody, null, 2) +
                "\n\nAPI Yanıtı:\n" +
                JSON.stringify(responseData, null, 2),
            },
          ],
        };
      } catch (error: any) {
        // Hata mesajını API yanıtından veya JS hatasından al
        const mesaj =
          error?.response?.data?.message ||
          error?.response?.data ||
          error?.message ||
          "Bilinmeyen hata";

        const statusKod = error?.response?.status ?? "N/A";

        // Hatayı logla
        logError(
          "cari_olustur_custom",
          statusKod,
          typeof mesaj === "string" ? mesaj : JSON.stringify(mesaj),
          Date.now() - startTime,
        );

        // Claude Desktop'a gösterilecek hata mesajı
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text:
                `❌ cari_olustur_custom çalıştırılamadı.\n` +
                `HTTP Durum: ${statusKod}\n` +
                `Hata: ${JSON.stringify(mesaj, null, 2)}`,
            },
          ],
        };
      }
    },
  );
}
