import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createErpClient } from "../erp/client.js";

/**
 * ─── Yardımcı Fonksiyon: addParam ───────────────────────────────────────────
 * Bu fonksiyon, API'ye göndereceğimiz parametreleri düzenlemek için kullanılır.
 * Gelen değer (value) undefined, null veya boş string ("") değilse, objeye ekler.
 * Neden kullanıyoruz? Çünkü Swagger bizden "Kisit.cariID" şeklinde bir isim (key) bekliyor, 
 * ve sadece dolu olan filtreleri göndermemiz gerekiyor. Boş filtreler API'de hataya yol açabilir.
 */
function addParam(
  params: Record<string, string | number | boolean>,
  key: string,
  value: string | number | boolean | undefined | null
) {
  if (value !== undefined && value !== null && value !== "") {
    params[key] = value;
  }
}

/**
 * ─── Zod Şeması (Tool Input Schema) ─────────────────────────────────────────
 * Claude'un bize hangi formatta veri göndereceğini burada tanımlıyoruz.
 * "z" nesnesi, 'zod' kütüphanesinden gelir ve veri doğrulaması (validation) yapar.
 * `.describe()` kısımları ÇOK ÖNEMLİDİR! Claude, bu açıklamaları okuyarak kullanıcıdan 
 * gelen cümlenin içinden hangi parametreyi çekeceğine karar verir.
 */
const CariHareketleriSchema = z.object({

  // Claude'un kendi token'ını geçebilmesi için esneklik sağlıyoruz.
  // Çoğu zaman kullanıcılar token vermez, .env dosyasından okunur.
  token: z.string().optional().describe(
    "Bearer token. Girilmezse .env'deki ERP_BEARER_TOKEN kullanılır."
  ),

  // ── Ana Cari Filtreleri ──
  // .int() -> tam sayı olmalı
  // .positive() -> 0 veya negatif olamaz
  // .optional() -> kullanıcının bu filtreyi vermesi zorunlu değil
  cariID: z.number().int().positive().optional().describe(
    "Cari hesabın ID'si. Belirli bir müşteri/tedarikçinin hareketlerini getirmek için kullanılır. (Örn: 948)"
  ),
  cariKodu: z.string().optional().describe(
    "Cari kodu ile filtreleme. (Örn: 'MUS001')"
  ),
  cariAdi: z.string().optional().describe(
    "Cari adı ile filtreleme. (Örn: 'ABC Ticaret Ltd.')"
  ),
  esnekAramaKisiti: z.string().optional().describe(
    "Esnek metin araması. Sistemdeki belge no, cari adı vb. metin alanlarının tümünde arar."
  ),

  // ── Tarih Filtreleri ──
  tarih: z.string().optional().describe(
    "Hareket tarihi. ISO 8601 formatında gönderilmelidir. (Örn: '2025-01-15T00:00:00')"
  ),
  vade: z.string().optional().describe(
    "Vade tarihi ile filtreleme. ISO 8601 formatında."
  ),
  yil: z.number().int().optional().describe(
    "Yıl bilgisi (Örn: 2025)"
  ),
  ay: z.number().int().min(1).max(12).optional().describe(
    "Ay bilgisi (1=Ocak, 12=Aralık)"
  ),

  // ... Diğer tüm parametreler benzer şekilde tanımlanır.
  belgeNo: z.string().optional().describe("Belge no. (Örn: 'FTR-2025-001')"),
  tipKodu: z.string().optional().describe("Hareket türünü belirten kod."),
  tipAdi: z.string().optional().describe("Hareket türü adı (Örn: 'Satış Faturası')"),
  
  tutar: z.number().optional().describe("Tam Tutar eşleşmesi (TL)"),
  bakiye: z.number().optional().describe("Tam Bakiye eşleşmesi (TL)"),
  dovizKodu: z.string().optional().describe("Döviz Kodu (Örn: USD, EUR)"),

  ulkeAdi: z.string().optional().describe("Ülke Adı"),
  ilAdi: z.string().optional().describe("İl/Şehir adına göre ara. (Örn: Ankara)"),
  ilceAdi: z.string().optional().describe("İlçe adına göre ara."),

  // ── Sayfalama (Pagination) ──
  // API'den binlerce kayıt gelip sistemi kilitlemesin diye yapıyoruz.
  sayfa: z.number().int().min(1).optional().default(1).describe(
    "İstenen sayfa numarası. Varsayılan 1."
  ),
  sayfaSatirSayisi: z.number().int().min(1).max(200).optional().default(50).describe(
    "Her sayfada kaç kayıt olacak? API'yi yormamak için maksimum 200 ile sınırlandırıldı."
  ),
  siralamaKisiti: z.string().optional().describe(
    "Sıralama kriteri. Örneğin azalan tarih için: 'Tarih:desc'"
  ),
});

/**
 * ─── Tool Kayıt Fonksiyonu ────────────────────────────────────────────────
 * Bu fonksiyon, index.ts tarafından çağrılır. 
 * 'server.tool' diyerek MCP Server'a yeni bir "yetenek" (tool) kazandırıyoruz.
 */
export function registerCariHareketleriTools(server: McpServer) {
  server.tool(
    "cari_hareketleri_listele", // Tool'un adı. MCP standardında genelde küçük harf ve alt tire kullanılır.
    
    // Açıklama: Claude'a bu tool'un NE İŞE YARADIĞINI anlatıyoruz.
    // Çok kritik! Claude, kullanıcının "Cari hesap hareketlerini getir" cümlesiyle bu tool'u eşleştirir.
    `ERP sisteminden cari hesap hareketlerini getirir.
Müşteri/tedarikçi ekstresi, borç/alacak durumları ve finansal raporlama için kullanılır.
Tüm filtreler opsiyoneldir; birden fazla filtre birlikte kullanılabilir.`,

    // Zod Şeması: Claude'un doldurması gereken formun yapısını veriyoruz (yukarıda tanımlamıştık).
    // Ancak Typescript type error almamak için şema tipini tekrar inline olarak ya da schema referansını yayarak verebiliriz.
    // Kolaylık olsun diye schema objesinin içindeki '.shape' özelliğini kullanıyoruz.
    CariHareketleriSchema.shape,
    
    // Handler: Claude parametreleri toplayıp bize verdiğinde çalışacak asıl kod.
    async (input) => {
      try {
        // 1. API'ye göndereceğimiz parametre objesini oluşturuyoruz.
        const params: Record<string, string | number | boolean> = {};

        // 2. addParam yardımcı fonksiyonuyla Claude'dan gelen verileri 
        // AARO ERP backend'inin beklediği formata (Kisit.xxx) dönüştürüyoruz.
        addParam(params, "Kisit.cariID", input.cariID);
        addParam(params, "Kisit.kartKodu", input.cariKodu);
        addParam(params, "Kisit.kartAdi", input.cariAdi);
        addParam(params, "Kisit.esnekAramaKisiti", input.esnekAramaKisiti);

        addParam(params, "Kisit.tarih", input.tarih);
        addParam(params, "Kisit.vade", input.vade);
        addParam(params, "Kisit.yil", input.yil);
        addParam(params, "Kisit.ay", input.ay);

        addParam(params, "Kisit.belgeNo", input.belgeNo);
        addParam(params, "Kisit.tipKodu", input.tipKodu);
        addParam(params, "Kisit.tipAdi", input.tipAdi);

        addParam(params, "Kisit.tutar", input.tutar);
        addParam(params, "Kisit.bakiye", input.bakiye);
        addParam(params, "Kisit.dovizKodu", input.dovizKodu);

        addParam(params, "Kisit.ulkeAdi", input.ulkeAdi);
        addParam(params, "Kisit.ilAdi", input.ilAdi);
        addParam(params, "Kisit.ilceAdi", input.ilceAdi);

        addParam(params, "SayfalandirmaBilgisi.sayfa", input.sayfa);
        addParam(params, "SayfalandirmaBilgisi.sayfaSatirSayisi", input.sayfaSatirSayisi);
        addParam(params, "SayfalandirmaBilgisi.siralamaKisiti", input.siralamaKisiti);

        // 3. ERP Client oluşturuyoruz (axios üzerinden HTTP isteği yapmak için).
        // Eğer input.token varsa onu, yoksa .env'deki ERP_BEARER_TOKEN'ı kullanacak.
        const client = createErpClient(input.token);

        // 4. API'ye GET isteği atıyoruz. (Parametreleri URL query'sine ekler)
        const response = await client.get("/CariHareketleri", { params });
        const data = response.data;
        const kayitSayisi = Array.isArray(data?.sonuc) ? data.sonuc.length : "?";

        // 5. Başarılı sonuç döndür. Bu içerik doğrudan Claude'un "context"ine eklenecektir.
        // Claude bu veriyi okuyup kullanıcıya Türkçe/İngilizce insani bir cevap verecektir.
        return {
          content: [
            {
              type: "text",
              text:
                `✅ Cari Hareketleri başarıyla getirildi.\n` +
                `📊 Dönen kayıt sayısı: ${kayitSayisi}\n` +
                `📄 Sayfa: ${input.sayfa} | Sayfa başı: ${input.sayfaSatirSayisi}\n\n` +
                JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error: any) {
        // 6. Hata yakalama: Backend hata verirse (Token geçersiz vb.) onu da uygun formatta Claude'a iletiyoruz.
        const mesaj =
          error?.response?.data?.message ||
          error?.response?.data ||
          error?.message ||
          "Bilinmeyen hata";

        const statusKod = error?.response?.status ?? "N/A";

        return {
          // isError=true ayarı ile tool'un başarısız olduğunu Claude'a belirtiyoruz.
          isError: true,
          content: [
            {
              type: "text",
              text:
                `❌ Cari hareketleri getirilemedi.\n` +
                `HTTP Durum: ${statusKod}\n` +
                `Hata: ${JSON.stringify(mesaj, null, 2)}`,
            },
          ],
        };
      }
    }
  );
}