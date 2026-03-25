/**
 * ─── Swagger Auto-Generator Konfigürasyonu ────────────────────────────────────
 *
 * Buraya sadece MCP tool olarak kayıt etmek istediğimiz endpoint'leri yazıyoruz.
 * Tüm Swagger'ı değil, sadece bizim seçtiklerimizi sisteme dahil ediyoruz.
 *
 * Her giriş:
 *   path    → Swagger'daki endpoint yolu (ör: "/CariHareketleri")
 *   method  → HTTP metodu (sadece "get" destekleniyor şu an)
 *   toolName → Claude'un göreceği tool adı (MCP standardında snake_case)
 *   description → Claude'a bu tool'un ne işe yaradığını anlatan kısa açıklama
 *                 (boş bırakılırsa Swagger'daki summary/description kullanılır)
 */

// EndpointConfig adında bir TypeScript interface tanımlıyoruz.
// Bu interface, MCP server'da kullanılacak bir API endpoint'inin
// temel yapı bilgisini (config) tanımlamak için kullanılır.
export interface EndpointConfig {
  // API endpoint'inin path bilgisini tutar.
  // Örnek:
  // "/api/Cari"
  // "/api/CariHareketleri"
  // "/api/CariHareketleri/Pivot"
  path: string;

  // HTTP method bilgisini tutar.
  method: "get" | "delete";
  
  // MCP server'da oluşturulacak tool'un adı.
  // Claude Desktop bu ismi görür ve bu isimle tool'u çağırır.
  // Örnek:
  // "cari_listele"
  // "cari_hareketleri_listele"
  toolName: string;
  
  // Tool açıklaması (description).
  // Eğer burada bir açıklama verilirse Swagger'daki açıklamayı override eder.
  // Eğer boş bırakılırsa Swagger dokümanındaki description otomatik kullanılır.
  // Bu yüzden opsiyonel (?)
  description?: string;
}

export const WHITELISTED_ENDPOINTS: EndpointConfig[] = [

  // ! CARİ
  // ! ✅ /api/CariHareketleri
  {
    path: "/api/CariHareketleri",
    method: "get",
    toolName: "cari_hareketleri_listele",
    description:
      "ERP sisteminden cari hesap hareketlerini getirir. Müşteri/tedarikçi ekstresi, borç/alacak durumları ve finansal raporlama için kullanılır.",
  },
  // ! ✅ /api/CariHareketleri/Pivot
  {
    path: "/api/CariHareketleri/Pivot",
    method: "get",
    toolName: "cari_hareketleri_pivot",
    description:
      "Cari hareketleri pivot (özet/çapraz tablo) formatında getirir. Dönemsel karşılaştırma ve toplu analiz için idealdir.",
  },
  // ! ✅  /api/Cari/Bakiye
  {
    path: "/api/Cari/Bakiye",
    method: "get",
    toolName: "cari_bakiye",
    description:
      "Cari hesapların güncel bakiyelerini getirir. Müşteri ve tedarikçi borç/alacak durumlarını görmek için kullanılır.",
  },
  // ! ✅ /api/Cari/{id} GET
  {
    path: "/api/Cari/{id}",
    method: "get",
    toolName: "cari_getir",
    description:
      "ERP sisteminden ID'ye göre tek bir cari kartın detay bilgisini getirir.",
  },
  // ! ✅ /api/Cari/{id} DELETE
  {
    path: "/api/Cari/{id}",
    method: "delete",
    toolName: "cari_sil",
    description:
      "ERP sisteminde belirtilen ID'ye sahip cari kartı siler veya pasifleştirir. Bağlı hareketi olan cariler tamamen silinemez, yalnızca pasifleştirilebilir.",
  },
  // ! ✅ /api/Cari
  {
    path: "/api/Cari",
    method: "get",
    toolName: "cari_listele",
    description:
      "ERP sistemindeki cari hesap kartlarını listeler. Müşteri ve tedarikçi bilgilerini aramak ve sorgulamak için kullanılır.",
  },
  
  // ! STOK
  // ! ✅  /api/StokHareketleri
  {
    path: "/api/StokHareketleri",
    method: "get",
    toolName: "stok_hareketleri_listele",
    description:
      "ERP sisteminden stok (ürün) hareketlerini listeler. Ürün giriş-çıkışları, depo transferleri ve envanter geçmişi takibi için kullanılır.",
  },
  // ! ✅ /api/StokHareketleri/Pivot
  {
    path: "/api/StokHareketleri/Pivot",
    method: "get",
    toolName: "stok_hareketleri_pivot",
    description:
      "ERP sisteminden stok hareketlerini pivot (özet/çapraz tablo) formatında getirir.",
  },
  // ! ✅ /api/Stok
  {
  path: "/api/Stok",
  method: "get",
  toolName: "stok_listele",
  description:
    "ERP sistemindeki stok (ürün) kartlarını listeler. Ürün arama, filtreleme ve envanter inceleme için kullanılır.",
  },

];

/** Swagger JSON'un indirileceği URL */
export const SWAGGER_URL =
  process.env.SWAGGER_URL || "https://erp.aaro.com.tr/swagger/docs/v1";
