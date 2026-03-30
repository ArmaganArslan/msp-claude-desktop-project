import type { EndpointConfig } from "../types.js";

export const BANKAHESAP_ENDPOINTS: EndpointConfig[] = [
  // 🔍 /api/BankaHesap/MinListe GET
  {
    path: "/api/BankaHesap/MinListe",
    method: "get",
    toolName: "banka_hesap_min_liste",
    description:
      "Banka hesaplarının temel bilgilerini içeren hafif listeyi getirir. " +
      "Hızlı seçim, arama ve filtreleme işlemleri için kullanılır.",
  },
  // ❌ /api/BankaHesap/{id} DELETE
  {
    path: "/api/BankaHesap/{id}",
    method: "delete",
    toolName: "banka_hesap_kaldir",
    description:
      "Belirtilen ID'ye sahip banka hesap kaydı için ERP API'ye kaldırma isteği gönderir. " +
      "Bu işlem geri alınamayabilir. " +
      "Yalnızca kullanıcı açıkça ilgili banka hesabının kaldırılmasını istediğinde kullanılmalıdır. " +
      "İşlem sonucu kullanıcıya iletilir.",
  },
  // 🔍 /api/BankaHesap/{id} GET
  {
    path: "/api/BankaHesap/{id}",
    method: "get",
    toolName: "banka_hesap_detay_getir",
    description:
      "Belirtilen ID'ye sahip banka hesap kaydının detay bilgilerini getirir. " +
      "Hesap bilgileri ERP API'den alınarak kullanıcıya iletilir.",
  },
  // ✏️ /api/BankaHesap/{id} PUT
  {
    path: "/api/BankaHesap/{id}",
    method: "put",
    toolName: "banka_hesap_guncelle",
    description:
      "Belirtilen ID'ye sahip banka hesap kaydını günceller. " +
      "Güncellenecek alanları Swagger modeline uygun şekilde gönderin. " +
      "Yalnızca kullanıcı açıkça güncelleme istediğinde kullanılmalıdır. " +
      "İşlem sonucu ERP API'den alınarak kullanıcıya iletilir.",
  },
  // 🔍 /api/BankaHesap GET
  {
    path: "/api/BankaHesap",
    method: "get",
    toolName: "banka_hesap_liste",
    description:
      "Banka hesaplarını listeler. " +
      "Filtreleme ve sayfalama parametreleri kullanılabilir.",
  },
  // ✔️ /api/BankaHesap/Onayla POST
  {
    path: "/api/BankaHesap/Onayla",
    method: "post",
    toolName: "banka_hesap_onayla",
    description:
      "Banka hesap kaydını onaylar. " +
      "Onaylanacak kayıt bilgilerini Swagger modeline uygun şekilde gönderin. " +
      "İşlem sonucu ERP API'den alınarak kullanıcıya iletilir.",
  },
  // ✔️ /api/BankaHesap/Reddet POST
  {
    path: "/api/BankaHesap/Reddet",
    method: "post",
    toolName: "banka_hesap_reddet",
    description:
      "Banka hesap kaydını reddeder. " +
      "Reddedilecek kayıt bilgilerini Swagger modeline uygun şekilde gönderin. " +
      "İşlem sonucu ERP API'den alınarak kullanıcıya iletilir.",
  },
  // 🔍 /api/BankaHesap/Liste GET
  {
    path: "/api/BankaHesap/Liste",
    method: "get",
    toolName: "banka_hesap_liste_detay",
    description:
      "Banka hesaplarını gelişmiş filtreleme, arama ve sayfalama seçenekleriyle listeler. " +
      "Query parametreleri kullanılarak sonuçlar daraltılabilir.",
  },

  // ! /api/BankaHesap/Liste Start
  // ! /api/BankaHesap/Liste End
  // 🔍 /api/BankaHesap/GrupluListe GET
  {
    path: "/api/BankaHesap/GrupluListe",
    method: "get",
    toolName: "banka_hesap_gruplu_liste",
    description:
      "Banka hesaplarını belirli alanlara göre gruplanmış şekilde listeler. " +
      "Gruplama ve filtreleme için query parametreleri kullanılabilir.",
  },
  // 🔍 /api/BankaHesap/{id}/OnayDurumu GET
  {
    path: "/api/BankaHesap/{id}/OnayDurumu",
    method: "get",
    toolName: "banka_hesap_onay_durumu_getir",
    description:
      "Belirtilen ID'ye sahip banka hesap kaydının onay durumunu getirir. " +
      "Kaydın onaylı, beklemede veya reddedilmiş olup olmadığı bilgisini sağlar.",
  },
  // 🔍 /api/BankaHesap/{id}/Belgeler GET
  {
    path: "/api/BankaHesap/{id}/Belgeler",
    method: "get",
    toolName: "banka_hesap_belgeleri_getir",
    description:
      "Belirtilen ID'ye sahip banka hesap kaydına ait belgeleri getirir. " +
      "Doküman, dosya ve ilişkili belge bilgileri ERP API'den alınarak kullanıcıya iletilir.",
  },
  // ➕ /api/BankaHesap/{id}/BelgeEkle POST
  {
    path: "/api/BankaHesap/{id}/BelgeEkle",
    method: "post",
    toolName: "banka_hesap_belge_ekle",
    description:
      "Seçilen banka hesap kaydına yeni bir belge ekler. " +
      "Belge içeriği ve ilgili bilgiler body üzerinden Swagger modeline uygun biçimde gönderilir. " +
      "Servisten dönen yanıt aynen kullanıcıya iletilir.",
  },
  // ❌ /api/BankaHesap/{id}/BelgeSil/{BelgeID} DELETE
  {
    path: "/api/BankaHesap/{id}/BelgeSil/{BelgeID}",
    method: "delete",
    toolName: "banka_hesap_belge_sil",
    description:
      "Belirtilen banka hesap kaydına ait bir belgeyi siler. " +
      "Silinecek belge ID'si (BelgeID) ve ilgili banka hesap ID'si (id) path parametreleri üzerinden gönderilmelidir. " +
      "Bu işlem geri alınamaz. " +
      "Servisten dönen yanıt aynen kullanıcıya iletilir.",
  },
  // 🔍 /api/BankaHesap/{id}/Notlar GET
  {
    path: "/api/BankaHesap/{id}/Notlar",
    method: "get",
    toolName: "banka_hesap_notlari_getir",
    description:
      "Belirtilen ID'ye sahip banka hesap kaydına ait notları getirir. " +
      "Tüm not kayıtları ERP API'den alınarak kullanıcıya iletilir. " +
      "Notlar, ilgili banka hesap kaydıyla ilişkilendirilmiş açıklama ve kayıt bilgilerini içerir.",
  },

  // ➕ /api/BankaHesap/{id}/NotEkle POST
  {
    path: "/api/BankaHesap/{id}/NotEkle",
    method: "post",
    toolName: "banka_hesap_not_ekle",
    description:
      "Belirtilen ID'ye sahip banka hesap kaydı için yeni bir not ekler. " +
      "Not içeriği ve ilgili bilgiler body üzerinden Swagger modeline uygun biçimde gönderilmelidir. " +
      "Eklenen not, ilgili banka hesap kaydı ile ilişkilendirilir. " +
      "Servisten dönen yanıt aynen kullanıcıya iletilir.",
  },

  // ❌ /api/BankaHesap/{id}/NotSil/{NotID} DELETE
  {
    path: "/api/BankaHesap/{id}/NotSil/{NotID}",
    method: "delete",
    toolName: "banka_hesap_not_sil",
    description:
      "Belirtilen banka hesap kaydına ait bir notu siler. " +
      "Silinecek not ID'si (NotID) ve ilgili banka hesap ID'si (id) path parametreleri üzerinden gönderilmelidir. " +
      "Bu işlem geri alınamaz. " +
      "Servisten dönen yanıt aynen kullanıcıya iletilir.",
  },
];
