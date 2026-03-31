# AARO ERP MCP Server

AARO ERP sistemini **Claude Desktop** ile entegre eden bir [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server'ıdır.

Claude, bu server aracılığıyla ERP API'sine doğal dil komutlarıyla erişebilir: cari sorgulama, oluşturma, güncelleme, silme; stok, banka hesabı ve hareket işlemleri gibi pek çok operasyonu gerçekleştirebilir.

---

## 🧱 Teknoloji Yığını

| Paket | Sürüm | Amaç |
|---|---|---|
| `@modelcontextprotocol/sdk` | ^1.27.1 | MCP server altyapısı (Claude Desktop ile iletişim) |
| `axios` | ^1.13.6 | ERP API'sine HTTP istekleri |
| `zod` | * | Tool parametre validasyonu ve şema üretimi |
| `typescript` | ^5.9.3 | Tip güvenliği |
| `tsx` | ^4.21.0 | Geliştirme modunda TypeScript'i derlemeden çalıştırma |

---

## 📁 Proje Yapısı

```
msp-claude-desktop-project/
├── src/
│   ├── index.ts                        # ⭐ Server giriş noktası — tool'lar burada kaydedilir
│   ├── logger.ts                       # İstek/yanıt loglarını dosyaya yazar
│   ├── swagger.json                    # Yerel Swagger dökümantasyonu (ağ bağlantısı gerekmez)
│   │
│   ├── swagger/
│   │   ├── config.ts                   # SWAGGER_URL ve whitelist konfigürasyonu
│   │   ├── generator.ts                # Swagger → MCP Tool otomatik dönüştürücü
│   │   ├── loader.ts                   # Swagger JSON okuyucu (yerel dosya veya URL)
│   │   ├── types.ts                    # EndpointConfig tip tanımı
│   │   └── endpoints/
│   │       ├── index.ts                # Tüm endpoint gruplarını birleştirir
│   │       ├── cari.ts                 # Cari hesap endpoint'leri
│   │       ├── stok.ts                 # Stok / ürün endpoint'leri
│   │       ├── bankahesap.ts           # Banka hesabı endpoint'leri
│   │       └── bankahareketleri.ts     # Banka hareketi endpoint'leri
│   │
│   ├── tools/
│   │   └── cariOlusturCustom.ts        # Manuel yazılmış özel tool (cari oluşturma)
│   │
│   └── erp/
│       └── client.ts                   # Axios tabanlı ERP API istemcisi
│
├── logs/
│   └── requests.log                    # API istek/yanıt logları
│
├── .env                                # API token ve URL bilgileri (Git'e gitmez!)
├── .env.example                        # .env şablonu
├── tsconfig.json
└── package.json
```

---

## ⚙️ Kurulum

### 1. Bağımlılıkları Yükle

```bash
npm install
```

### 2. `.env` Dosyasını Oluştur

```bash
cp .env.example .env
```

`.env` içeriği:

```env
ERP_BASE_URL=https://erp.aaro.com.tr
ERP_BEARER_TOKEN=buraya_token_gelecek
```

> `SWAGGER_URL` tanımlamanıza gerek yok. Sistem varsayılan olarak `src/swagger.json` yerel dosyasını kullanır.  
> Canlı Swagger URL'si kullanmak isterseniz: `SWAGGER_URL=https://erp.aaro.com.tr/swagger/docs/v1`

### 3. Build Al (Production için)

```bash
npm run build
```

---

## 🖥️ Claude Desktop Entegrasyonu

`claude_desktop_config.json` dosyasına aşağıdaki bloğu ekleyin:

```json
{
  "mcpServers": {
    "aaro-erp": {
      "command": "npx",
      "args": [
        "tsx",
        "C:/Users/KULLANICI_ADI/Desktop/msp-claude-desktop-project/src/index.ts"
      ]
    }
  }
}
```

> Dosya genellikle şurada bulunur:  
> `%APPDATA%\Claude\claude_desktop_config.json`

Claude Desktop'ı **yeniden başlattıktan** sonra tool'lar aktif olur.

---

## 🛠️ Mevcut Tool'lar

### 📋 Cari (Müşteri / Tedarikçi)

| Tool Adı | Method | Endpoint | Açıklama |
|---|---|---|---|
| `cari_olustur_custom` | POST | `/api/Cari` | Yeni cari oluşturur (Tip adıyla, ID gerekmez) |
| `cari_listele` | GET | `/api/Cari` | Tüm cari kartları listeler |
| `cari_getir` | GET | `/api/Cari/{id}` | ID'ye göre cari detayını getirir |
| `cari_guncelle` | PUT | `/api/Cari/{id}` | Cari kartını günceller |
| `cari_kayit_kaldir` | DELETE | `/api/Cari/{id}` | Cari kaydını kaldırır |
| `cari_min_liste` | GET | `/api/Cari/MinListe` | Hafif/hızlı cari listesi |
| `cari_gruplu_liste` | GET | `/api/Cari/GrupluListe` | Gruplandırılmış cari listesi |
| `cari_bakiye` | GET | `/api/Cari/Bakiye` | Güncel borç/alacak bakiyeleri |
| `cari_onay_durumu_getir` | GET | `/api/Cari/{id}/OnayDurumu` | Cari onay durumu |
| `cari_degisim_gecmisi_getir` | GET | `/api/Cari/{id}/DegisiklikGecmisi` | Değişiklik geçmişi |
| `cari_belgeleri_getir` | GET | `/api/Cari/{id}/Belgeler` | Cari belgelerini listeler |
| `cari_belge_ekle` | POST | `/api/Cari/{id}/BelgeEkle` | Cariye belge ekler |
| `cari_belge_kaldir` | DELETE | `/api/Cari/{id}/BelgeSil/{BelgeID}` | Cari belgesini kaldırır |
| `cari_notlarini_getir` | GET | `/api/Cari/{id}/Notlar` | Cari notlarını getirir |
| `cari_not_ekle` | POST | `/api/Cari/{id}/NotEkle` | Cariye not ekler |
| `cari_not_kaldir` | DELETE | `/api/Cari/{id}/NotSil/{NotID}` | Cari notunu kaldırır |
| `cari_hareketleri_listele` | GET | `/api/CariHareketleri` | Cari hesap hareketleri |
| `cari_hareketleri_pivot` | GET | `/api/CariHareketleri/Pivot` | Pivot formatında hareketler |

### 📦 Stok

| Tool Adı | Method | Endpoint | Açıklama |
|---|---|---|---|
| `stok_listele` | GET | `/api/Stok` | Stok kartlarını listeler |
| `stok_getir` | GET | `/api/Stok/{id}` | ID'ye göre stok detayı |
| `stok_guncelle` | PUT | `/api/Stok/{id}` | Stok kartını günceller |
| `stok_hareketleri_listele` | GET | `/api/StokHareketleri` | Stok hareketleri |
| `stok_hareketleri_pivot` | GET | `/api/StokHareketleri/Pivot` | Pivot formatında stok hareketleri |

### 🏦 Banka

| Tool Adı | Method | Endpoint | Açıklama |
|---|---|---|---|
| `banka_hesap_listele` | GET | `/api/BankaHesap` | Banka hesaplarını listeler |
| `banka_hareketleri_listele` | GET | `/api/BankaHareketleri` | Banka hareketlerini listeler |

---

## 💬 Kullanım Örnekleri (Claude Desktop)

```
Müşteri tipinde "ABC Ticaret A.Ş." adıyla yeni bir cari oluştur
```
```
Tüm cari kartlarını listele
```
```
ID'si 42 olan cariyi getir
```
```
42 numaralı carinin adını "XYZ Ltd. Şti." olarak güncelle
```
```
Son cari hareketlerini göster
```
```
Stok kartlarını listele
```
```
Banka hesaplarını getir
```

---

## ➕ Yeni Endpoint Ekleme

Sisteme yeni bir API endpoint'i eklemek için:

### Adım 1 — İlgili endpoint dosyasını düzenle

`src/swagger/endpoints/` altındaki uygun dosyayı aç (örn. `cari.ts`) ve yeni bir giriş ekle:

```typescript
{
  path: "/api/Cari/{id}/OzelIslem",
  method: "get",
  toolName: "cari_ozel_islem",
  source: "cari.ts",
  description: "Cari karta ait özel işlemi getirir.",
},
```

### Adım 2 — Yeni bir grup oluşturmak istiyorsan

1. `src/swagger/endpoints/yenimodul.ts` dosyası oluştur
2. `YENIMODUL_ENDPOINTS` listesini export et
3. `src/swagger/endpoints/index.ts`'e import edip `...YENIMODUL_ENDPOINTS` ekle

### Adım 3 — Custom (Manuel) Tool Eklemek İstersen

Swagger'ın yetersiz kaldığı veya kullanıcıya daha anlaşılır deneyim sunmak istediğin durumlarda:

1. `src/tools/yeniTool.ts` dosyası oluştur
2. `registerYeniTool(server: McpServer)` fonksiyonunu export et
3. `src/index.ts`'de import edip `registerYeniTool(server)` olarak çağır

> Parametre şeması Swagger'dan **otomatik** üretilir. PUT/POST için `body` alanı da otomatik eklenir.

---

## 🔧 Geliştirme Komutları

```bash
# Geliştirme modunda çalıştır (build gerekmez, değişiklikler anında geçerli)
npm run dev

# TypeScript tip kontrolü yap (derleme yapmadan hata tespiti)
npm run typecheck

# Production build (dist/ klasörüne derler)
npm run build

# Derlenmiş versiyonu çalıştır
npm run start

# API loglarını canlı olarak takip et
npm run logs
```

---

## 📝 Loglama

Her API isteği ve yanıtı `logs/requests.log` dosyasına yazılır. Logları canlı izlemek için:

```bash
npm run logs
```

---

## 🔐 Güvenlik Notları

- `.env` dosyası asla Git'e commit edilmemelidir (`.gitignore`'da mevcut)
- Bearer token her API çağrısında `Authorization: Bearer <token>` header'ı ile gönderilir
- **DELETE işlemleri geri alınamaz** — bağlı hareketi olan cariler silinmez, yalnızca pasifleştirilir
- **PUT işlemleri kalıcıdır** — güncelleme yapmadan önce mevcut kayıt ilgili `_getir` tool'u ile kontrol edilebilir
