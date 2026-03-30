import type { EndpointConfig } from "../types.js";

export const CARI_ENDPOINTS: EndpointConfig[] = [
  // 🔍 /api/CariHareketleri GET
  {
    path: "/api/CariHareketleri",
    method: "get",
    toolName: "cari_hareketleri_listele",
    description:
      "ERP sisteminden cari hesap hareketlerini getirir. Müşteri/tedarikçi ekstresi, borç/alacak durumları ve finansal raporlama için kullanılır.",
  },
  // 🔍 /api/Cari/MinListe GET
  {
    path: "/api/Cari/MinListe",
    method: "get",
    toolName: "cari_min_liste",
    description:
      "Cari hesapların temel bilgilerini içeren hafif listeyi getirir. " +
      "Hızlı arama, seçim listeleri ve performans odaklı işlemler için kullanılır.",
  },
  // 🔍 /api/Cari/GrupluListe GET
  {
    path: "/api/Cari/GrupluListe",
    method: "get",
    toolName: "cari_gruplu_liste",
    description:
      "Cari hesapları belirli alanlara göre gruplandırarak listeler. " +
      "Bölge, plasiyer, kategori gibi alanlara göre analiz yapılmasını sağlar. " +
      "Bu tool raporlama ve veri analizi amaçlı kullanılmalıdır.",
  },

  // 🔍 /api/Cari/{id}/OnayDurumu GET
  {
    path: "/api/Cari/{id}/OnayDurumu",
    method: "get",
    toolName: "cari_onay_durumu_getir",
    description:
      "Belirtilen ID'ye sahip cari kartın onay durumunu getirir. " +
      "Onay bilgileri ve mevcut durum ERP API'den alınarak kullanıcıya iletilir.",
  },

  // 🔍 /api/Cari/{id}/DegisiklikGecmisi GET
  {
    path: "/api/Cari/{id}/DegisiklikGecmisi",
    method: "get",
    toolName: "cari_degisim_gecmisi_getir",
    description:
      "Belirtilen ID'ye sahip cari kartın değişiklik geçmişini getirir. " +
      "Yapılan değişiklikler, eski ve yeni değerler ile birlikte listelenir. " +
      "Bu tool audit ve geçmiş inceleme amaçlı kullanılmalıdır.",
  },

  // 🔍 /api/Cari/{id}/Belgeler GET
  {
    path: "/api/Cari/{id}/Belgeler",
    method: "get",
    toolName: "cari_belgeleri_getir",
    description:
      "Belirtilen ID'ye sahip cari kartına ait belgeleri ve dokümanları getirir. " +
      "Dosya bilgileri ve ilişkili belgeler ERP API'den alınarak kullanıcıya iletilir.",
  },
  // ➕ /api/Cari/{id}/BelgeEkle POST
  {
    path: "/api/Cari/{id}/BelgeEkle",
    method: "post",
    toolName: "cari_belge_ekle",
    description:
      "Belirtilen ID'ye sahip cari karta yeni bir belge ekler. " +
      "Belge bilgileri ve dosya içeriği ERP API'ye gönderilir. " +
      "İşlem sonucu kullanıcıya iletilir.",
  },
  // ❌ /api/Cari/{id}/BelgeSil/{BelgeID} DELETE
  {
    path: "/api/Cari/{id}/BelgeSil/{BelgeID}",
    method: "delete",
    toolName: "cari_belge_kaldir",
    description:
      "Belirtilen cari kaydına ait belgeyi kaldırmak için ERP API'ye istek gönderir. " +
      "Bu işlem geri alınamayabilir. " +
      "Yalnızca kullanıcı açıkça ilgili belgenin kaldırılmasını istediğinde kullanılmalıdır. " +
      "İşlem sonucu kullanıcıya iletilir.",
  },
  // 🔍 /api/Cari/{id}/Notlar GET
  {
    path: "/api/Cari/{id}/Notlar",
    method: "get",
    toolName: "cari_notlarini_getir",
    description:
      "Belirtilen ID'ye sahip cari kartına ait notları getirir. " +
      "Kayda eklenmiş açıklama, yorum ve serbest metin notları ERP API'den alınarak kullanıcıya iletilir.",
  },
  // ➕ /api/Cari/{id}/NotEkle POST
  {
    path: "/api/Cari/{id}/NotEkle",
    method: "post",
    toolName: "cari_not_ekle",
    description:
      "Belirtilen ID'ye sahip cari kartına yeni bir not ekler. " +
      "Not içeriği ERP API'ye gönderilir and işlem sonucu kullanıcıya iletilir.",
  },

  // ❌ /api/Cari/{id}/NotSil/{NotID} DELETE
  {
    path: "/api/Cari/{id}/NotSil/{NotID}",
    method: "delete",
    toolName: "cari_not_kaldir",
    description:
      "Belirtilen cari kaydına ait notu kaldırmak için ERP API'ye istek gönderir. " +
      "Bu işlem geri alınamayabilir. " +
      "Yalnızca kullanıcı açıkça ilgili notun kaldırılmasını istediğinde kullanılmalıdır. " +
      "İşlem sonucu kullanıcıya iletilir.",
  },
  // 🔍 /api/CariHareketleri/Pivot GET
  {
    path: "/api/CariHareketleri/Pivot",
    method: "get",
    toolName: "cari_hareketleri_pivot",
    description:
      "Cari hareketleri pivot (özet/çapraz tablo) formatında getirir. Dönemsel karşılaştırma ve toplu analiz için idealdir.",
  },
  // 🔍 /api/Cari/Bakiye GET
  {
    path: "/api/Cari/Bakiye",
    method: "get",
    toolName: "cari_bakiye",
    description:
      "Cari hesapların güncel bakiyelerini getirir. Müşteri ve tedarikçi borç/alacak durumlarını görmek için kullanılır.",
  },
  // 🔍 /api/Cari/{id} GET
  {
    path: "/api/Cari/{id}",
    method: "get",
    toolName: "cari_getir",
    description:
      "ERP sisteminden ID'ye göre tek bir cari kartın detay bilgisini getirir.",
  },
  // ✏️ /api/Cari/{id} PUT
  {
    path: "/api/Cari/{id}",
    method: "put",
    toolName: "cari_guncelle",
    description:
      "ERP sisteminde belirtilen ID'ye sahip cari kartı günceller. " +
      "Güncellenecek alanları 'body' parametresi olarak JSON string formatında gönderin. " +
      'Örnek: \'{"Adi":"Yeni Ad", "CariKodu":"05001234567"}\'',
  },
  // ❌ /api/Cari/{id} DELETE
  {
    path: "/api/Cari/{id}",
    method: "delete",
    toolName: "cari_kayit_kaldir",
    description:
      "Belirtilen ID'ye sahip cari kaydı için ERP API'sine istek gönderir. " +
      "İşlem sonucunda API'den dönen yanıt kullanıcıya iletilir.",
  },
  // 🔍 /api/Cari GET
  {
    path: "/api/Cari",
    method: "get",
    toolName: "cari_listele",
    description:
      "ERP sistemindeki cari hesap kartlarını listeler. Müşteri ve tedarikçi bilgilerini aramak ve sorgulamak için kullanılır.",
  },
];
