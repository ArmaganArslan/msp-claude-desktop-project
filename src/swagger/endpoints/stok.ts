import type { EndpointConfig } from "../types.js";

export const STOK_ENDPOINTS: EndpointConfig[] = [
  // 🔍 /api/StokHareketleri GET
  {
    path: "/api/StokHareketleri",
    method: "get",
    toolName: "stok_hareketleri_listele",
    description:
      "ERP sisteminden stok (ürün) hareketlerini listeler. Ürün giriş-çıkışları, depo transferleri ve envanter geçmişi takibi için kullanılır.",
  },
  // 🔍 /api/StokHareketleri/Pivot GET
  {
    path: "/api/StokHareketleri/Pivot",
    method: "get",
    toolName: "stok_hareketleri_pivot",
    description:
      "ERP sisteminden stok hareketlerini pivot (özet/çapraz tablo) formatında getirir.",
  },
  // 🔍 /api/Stok GET
  {
    path: "/api/Stok",
    method: "get",
    toolName: "stok_listele",
    description:
      "ERP sistemindeki stok (ürün) kartlarını listeler. Ürün arama, filtreleme ve envanter inceleme için kullanılır.",
  },
  // 🔍 /api/Stok/MinListe GET
  {
    path: "/api/Stok/MinListe",
    method: "get",
    toolName: "stok_min_liste",
    description:
      "Minimum stok seviyesinin altına düşmüş ürünleri listeler. Kritik stok takibi, yenileme planlaması ve uyarı raporları için kullanılır.",
  },
  // 🔍 /api/Stok/StokMiktarListe GET
  {
    path: "/api/Stok/StokMiktarListe",
    method: "get",
    toolName: "stok_miktar_liste",
    description:
      "Stokların depo bazlı miktar bilgilerini getirir. " +
      "Belirli stoklar veya filtreler ile sorgulanabilir. " +
      "ERP API'den dönen stok miktar listesi kullanıcıya iletilir.",
  },

  // 🔍 /api/Stok/{id} GET
  {
    path: "/api/Stok/{id}",
    method: "get",
    toolName: "stok_detay_getir",
    description:
      "Belirtilen stok ID'sine sahip stok kartının detay bilgilerini getirir. " +
      "⚠️ Buradaki 'id' bir STOK kartı ID'sidir; cari, sipariş veya başka bir kayıt ID'siyle karıştırılmamalıdır. " +
      "ERP API'den dönen stok bilgisi kullanıcıya iletilir.",
  },
  // ✏️ /api/Stok/{id} PUT
  {
    path: "/api/Stok/{id}",
    method: "put",
    toolName: "stok_guncelle",
    description:
      "ERP sisteminde belirtilen stok ID'sine sahip stok kartını günceller. " +
      "⚠️ Buradaki 'id' bir STOK kartı ID'sidir; cari veya başka bir kayıt ID'siyle karıştırılmamalıdır. " +
      "Güncellenecek alanları 'body' parametresi olarak JSON string formatında gönderin. " +
      "Örnek: '{\"Adi\":\"Yeni Stok\", \"Barkod\":\"1234567890\"}'",
  },
  // ❌ /api/Stok/{id} DELETE
  {
    path: "/api/Stok/{id}",
    method: "delete",
    toolName: "stok_kayit_kaldir",
    description:
      "Belirtilen stok ID'sine sahip stok kaydı için ERP API'ye kaldırma isteği gönderir. " +
      "⚠️ Buradaki 'id' bir STOK kartı ID'sidir; cari veya başka bir kayıt ID'siyle karıştırılmamalıdır. " +
      "Bu işlem geri alınamayabilir. " +
      "Yalnızca kullanıcı açıkça bu kaydın kaldırılmasını istediğinde kullanılmalıdır. " +
      "İşlem sonucu kullanıcıya iletilir.",
  },

  // ➕ /api/Stok POST
  {
    path: "/api/Stok",
    method: "post",
    toolName: "stok_olustur",
    description:
      "Yeni bir stok kartı oluşturur. " +
      "Stok bilgilerini 'body' parametresi olarak JSON string formatında gönderin. " +
      "Örnek: '{\"Adi\":\"Yeni Ürün\", \"Barkod\":\"1234567890\"}'",
  },
  // 🔍 /api/Stok/List GET
  {
    path: "/api/Stok/Liste",
    method: "get",
    toolName: "stok_liste_esnek",
    description:
      "Stok kayıtları üzerinde gelişmiş ve esnek sorgulama yapar. " +
      "Kolon seçimi (Sutunlar), filtre (Kisit) ve sıralama (SiralamaKisiti) parametreleri desteklenir. " +
      "Bu tool yalnızca özel filtreleme ve gelişmiş sorgular gerektiğinde kullanılmalıdır. " +
      "Basit listeleme için standart stok listeleme tool'u tercih edilmelidir.",
  },
  // 🔍 /api/Stok/List GET
  {
    path: "/api/Stok/GrupluListe",
    method: "get",
    toolName: "stok_gruplu_liste",
    description:
      "Stok kayıtlarını belirli alanlara göre gruplandırarak listeler. " +
      "Kategori, tip veya diğer alanlara göre gruplanmış stok verileri getirir. " +
      "Bu tool raporlama ve analiz amaçlı kullanılmalıdır.",
  },
  // 🔍 /api/Stok/{id}/OnayDurumu GET
  {
    path: "/api/Stok/{id}/OnayDurumu",
    method: "get",
    toolName: "stok_onay_durumu_getir",
    description:
      "Belirtilen ID'ye sahip stok kartının onay durumunu getirir. " +
      "Onay bilgileri ve mevcut durum ERP API'den alınarak kullanıcıya iletilir.",
  },
  // 🔍 /api/Stok/{id}/DegisiklikGecmisi GET
  {
    path: "/api/Stok/{id}/DegisiklikGecmisi",
    method: "get",
    toolName: "stok_degisim_gecmisi_getir",
    description:
      "Belirtilen ID'ye sahip stok kartının değişiklik geçmişini getirir. " +
      "Yapılan değişiklikler, eski ve yeni değerler ile birlikte listelenir. " +
      "Bu tool audit ve geçmiş inceleme amaçlı kullanılmalıdır.",
  },
  // 🔍 /api/Stok/{id}/Belgeler GET
  {
    path: "/api/Stok/{id}/Belgeler",
    method: "get",
    toolName: "stok_belgeleri_getir",
    description:
      "Belirtilen ID'ye sahip stok kartına ait belgeleri ve dokümanları getirir. " +
      "Dosya bilgileri ve ilişkili belgeler ERP API'den alınarak kullanıcıya iletilir.",
  },

  // 🔍 /api/Stok/{id}/Belgeler GET
  {
    path: "/api/Stok/{id}/BelgeSil/{BelgeID}",
    method: "delete",
    toolName: "stok_belge_kaldir",
    description:
      "Belirtilen stok kaydına ait belgeyi kaldırmak için ERP API'ye istek gönderir. " +
      "Bu işlem geri alınamayabilir. " +
      "Yalnızca kullanıcı açıkça ilgili belgenin kaldırılmasını istediğinde kullanılmalıdır. " +
      "İşlem sonucu kullanıcıya iletilir.",
  },

  // 🔍 /api/Stok/{id}/Notlar GET
  {
    path: "/api/Stok/{id}/Notlar",
    method: "get",
    toolName: "stok_notlarini_getir",
    description:
      "Belirtilen ID'ye sahip stok kartına ait notları getirir. " +
      "Kayda eklenmiş açıklama, yorum ve serbest metin notları ERP API'den alınarak kullanıcıya iletilir.",
  },
  // ➕ /api/Stok/{id}/Notlar POST
  {
    path: "/api/Stok/{id}/NotEkle",
    method: "post",
    toolName: "stok_not_ekle",
    description:
      "Belirtilen ID'ye sahip stok kartına yeni bir not ekler. " +
      "Not içeriği ERP API'ye gönderilir ve işlem sonucu kullanıcıya iletilir.",
  },
  // ❌ /api/Stok/{id}/Notlar DELETE
  {
    path: "/api/Stok/{id}/NotSil/{NotID}",
    method: "delete",
    toolName: "stok_not_kaldir",
    description:
      "Belirtilen stok kaydına ait notu kaldırmak için ERP API'ye istek gönderir. " +
      "Bu işlem geri alınamayabilir. " +
      "Yalnızca kullanıcı açıkça ilgili notun kaldırılmasını istediğinde kullanılmalıdır. " +
      "İşlem sonucu kullanıcıya iletilir.",
  },
];
