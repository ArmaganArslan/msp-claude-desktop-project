# Aaro ERP MCP Server

Bu proje, **Aaro ERP** sistemini [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) aracılığıyla LLM'lere (Claude, vb.) bağlayan, yüksek otomasyonlu bir "Bridge" sunucusudur. 

Geleneksel MCP sunucularından farklı olarak, her endpoint'i tek tek tanımlamak yerine **Orval** ve **OpenAPI** kullanarak tüm ERP yeteneklerini dinamik ve tip güvenli bir şekilde dışarı açar.

---

## 🚀 Öne Çıkan Özellikler

- **3 Adımlı Akıllı İş Akışı:** LLM, binlerce endpoint arasında kaybolmak yerine; önce arar, sonra detayları öğrenir ve en son çağrıyı yapar.
- **Otomatik Kod Üretimi:** Orval ile ERP Swagger dosyasından 40.000+ satırlık tip güvenli handler ve şema seti saniyeler içinde üretilir.
- **Canlı Data Bağlantısı:** Gerçek zamanlı ERP verilerine erişim ve işlem yeteneği.
- **İnsanca Açıklamalar:** API alan isimlerini (örn: `CariBorc`) LLM'in anlayacağı açıklamalara (`Cari hesabın toplam borç bakiyesi`) otomatik dönüştüren metadata katmanı.

---

## 🛠️ Teknik Mimari

Proje üç ana katmandan oluşur:

1.  **Generation (Üretim):** `orval` paketi Swagger'ı okur ve `src/api/` altına handler'ları basar.
2.  **Post-Processing (İşleme):** Custom scriptler (`scripts/`) bu kodları Node.js ESM uyumlu hale getirir ve bir "Tool Kataloğu" oluşturur.
3.  **Registry (Kayıt):** `src/registry/tool-registry.ts` bu kataloğu bellek üzerine (RAM) alır ve Fuse.js ile süper hızlı arama imkanı sunar.

---

## 📋 Kullanım Senaryosu (Mandatory Workflow)

Claude (veya başka bir istemci) şu akışı takip etmek zorundadır:

1.  **`search_api_tools`**: Kullanıcı "Stokları listele" dediğinde, LLM önce bu tool ile uygun API endpoint'ini bulur.
2.  **`get_tool_details`**: Bulunan tool'un hangi parametreleri (Path, Query, Body) aldığını ve bu alanların ne anlama geldiğini öğrenir.
3.  **`call_api_tool`**: Öğrendiği doğru parametrelerle gerçek API çağrısını gerçekleştirir.

---

## ⚙️ Kurulum ve Geliştirme

### Başlangıç
```bash
# Bağımlılıkları yükle
npm install

# .env dosyasını yapılandır (API_TOKEN ekleyin)
cp .env.example .env

# İlk kod üretimini yap
npm run generate

# Derle
npm run build
```

### Önemli Komutlar
- `npm run dev`: Geliştirme modunda (TSX) çalıştırır.
- `npm run generate`: Swagger'dan kod üretir ve katalogları günceller.
- `npm run typecheck`: Tip hatalarını denetler.
- `npm run logs`: API trafik loglarını canlı izler.

---

## 🌐 Sunucu ve Canlıya Geçiş (Deployment)

Bu projeyi bir sunucuda canlıya almak için gereksinimler:

- **Runtime:** Node.js v18+ (ESM desteği için).
- **RAM:** Minimum **1 GB** (2 GB önerilir). Kataloglar ve arama indeksi RAM'de tutulur.
- **Sunucu Tipi:** VPS / VDS önerilir (Long-running process ve SSE bağlantısı için).
- **Bağlantı:** HTTPS (SSL) zorunludur. Nginx veya Caddy reverse proxy kullanılması önerilir.
- **Transport:** Canlıda `Stdio` yerine `SSE` (Server-Sent Events) kullanılmalıdır.

---

## 🛡️ Güvenlik

- Tüm istekler `Authorization: Bearer <TOKEN>` başlığı ile imzalanır.
- Hassas bilgiler `.env` dosyasında tutulur ve Git'e commit edilmez.
- Loglar `logs/requests.log` dosyasında takip edilebilir.
