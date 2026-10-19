# Defter Mini

Küçük işletmeler için Türkçe, çevrimdışı gelir–gider ve **tahmini işletme sonucu** takibi. Electron + React + TypeScript + Tailwind CSS + SQLite (sql.js) + Recharts.

## Hızlı başlangıç

Node.js 22.12+ veya 24 LTS ve npm gerekir. Mevcut depoda çalışın; bu bulut ortamı zaten yalıtılmıştır, ayrıca Git worktree oluşturmayın.

```sh
npm ci
npm run desktop:dev
```

Üretim derlemesini masaüstünde açmak için:

```sh
npm run desktop
```

Tarayıcı demosu: `npm run dev`. Ekrandaki **Demoyu dene** düğmesi mevcut günleri değiştirmeden son yedi gün için örnek kayıt ekler. Hiç kayıt yoksa örnek işletme ayarlarını da kurar. Sıfır tutarlı yeni kayıt başlangıçtır; demo verisi otomatik eklenmez.

## Windows kurulum dosyası

Windows 10/11 x64 üzerinde Node.js 24 LTS yükleyin, terminalde bu proje klasörünü açın:

```powershell
npm ci
npm test
npm run dist:win
```

NSIS kurulum dosyası `release/Defter Mini Setup 1.0.0.exe` altında oluşur. Bu bulut çalışmasında Windows kurulum dosyası üretilmedi; Linux dizin paketi ve Linux Electron çalışma akışı doğrulandı. Windows'ta kurulum/kaldırma, güncelleme ve SmartScreen davranışı ayrıca test edilmelidir. Dağıtım imzası/sertifikası bu sürümde yapılandırılmadı. Uygulama verileri kurulum dizininde tutulmaz; güncellemeler kullanıcı veritabanının üzerine yazmaz. Programı güncellemeden önce yedek alın.

## Kullanım

1. **Ayarlar:** işletme bilgileri, aylık giderler, komisyonlar ve kalıcı personel listesi. Tutarlar günlük maliyete göre personel şablonuna girilir. Kaydet düğmesiyle kalıcı olur. Ayarlar yeni günlere uygulanır; geçmiş kayıtlar oran ve gider anlık görüntülerini korur. Henüz kaydedilmemiş, değişiklik yapılmamış gün ayar kaydından sonra yenilenir.
2. **İcmal:** tarihi seçin, satışları, POS tahsilatlarını, personel maliyetlerini ve günlük giderleri girin. Hesapla sonucu gösterir; Günü kaydet hesaplar ve kalıcılaştırır. Aynı gün için kayıt varsa güncelleme onayı gerekir. Personel günlük ekrandan da eklenebilir; şablonun sonraki günlere taşınması için Ayarlar bölümünü kaydedin.
3. **Kasa:** tek gün için iki tarih alanına aynı tarihi girin veya aralık/hazır dönem seçin. Bir günlük kayda tıklayın; ayrıntıları görüntüleyin, Düzenle ile İcmal'e dönün. Silme onaylıdır.
4. **Yedekleme:** Ayarlar → Yedek al / Geri yükle. JSON yedeği ayarları ve günlük kayıtları içerir; harici bir yerde güvenle saklayın. İçe aktarma doğrulanır ve mevcut kayıtları değiştirmek için onay ister. Masaüstü geri yükleme öncesinde `geri-yukleme-oncesi.json` güvenlik kopyası da oluşturulur. Bu dosya bir önceki geri yüklemeye aittir; düzenli yedek yerine geçmez.

## Hesaplama kuralları

- Para tam sayı **kuruş**, oranlar tam sayı **baz puan** olarak işlenir; her kesinti kuruşa yuvarlanır. Türkçe `2.749,45` veya `2749.45` girişi desteklenir.
- POS tutarları satış kaynağı değildir, girilen satışların kartla tahsil edilen alt kümesidir. Gelire eklenmez. Birden fazla POS toplamı girilen satış toplamını aşamaz. Platform komisyonu POS maliyetini de kapsıyorsa aynı tahsilatı ayrıca POS'a girmeyin.
- Net tahsilat modunda ilgili platform komisyonu tekrar düşülmez. Bu modda brüt ciro geri hesaplanmaz; rapor toplamı girilen brüt satış ve net tahsilatların toplamıdır. Bu durum sonuç ekranında belirtilir.
- Personel maliyeti ücret + prim + sigorta + diğer maliyet toplamıdır. Nakit ödeme/avans ayrı bilgi alanıdır, tekrar gider yazılmaz. Aylık maaşı günlük maliyete kullanıcı dönüştürür.
- Aylık kira + muhasebe + diğer sabit giderler ilgili ayın gerçek gün sayısına bölünür; artık yıl desteklenir. Günlük pay en yakın kuruşa yuvarlanır; aylık toplamda birkaç kuruş yuvarlama farkı oluşabilir.
- Kurye ve diğer kesinti oranları girilen satış/tahsilat toplamına uygulanır. Aynı kesintiyi platform oranında da tanımlamayın.
- Gider tutarları **KDV dahil** girilir. Fiş/fatura ve kullanıcı tarafından girilen KDV oranı saklanır; KDV indirimi veya gelir/kurumlar vergisi hesaplanmaz. Belgesiz gider de tam tutarıyla maliyete dahil edilir.
- Tahmini sonuç = girilen gelir − platform/POS/kurye/diğer kesintiler − personel maliyeti − günlük giderler − sabit pay. Stok/satılan mal maliyeti girilmezse sonuç **gerçek net kâr değildir**. Ürün maliyetini gider kategorisi olarak girebilirsiniz; stok envanter muhasebesi bu sürümde bulunmaz.
- Kasa raporu finansal sonuç raporudur. Açılış bakiyesi, tahsilat vadeleri ve banka hareketleri izlenmediğinden fiili kasa bakiyesi sunmaz.

## Veriler ve mimari

- `src/model.ts`: ortak Zod şemaları, kuruş tabanlı hesap motoru, tarih filtreleri. `build:model` bu modülü Electron ana süreci için derler; UI ve IPC aynı doğrulamayı kullanır.
- `electron/main.cjs`: güvenli IPC, dosya diyalogları, yedek doğrulaması. `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`; IPC ana pencere ve ana çerçeveyle sınırlıdır. Harici pencere ve gezinme engellenir; içerik güvenlik politikası uygulanır.
- `electron/preload.cjs`: yalnızca izin verilen veri işlemlerini açar. Renderer dosya yoluna veya genel IPC erişimine sahip değildir.
- `electron/storage.cjs`: parametreli SQLite sorguları, atomik geçici dosya + yeniden adlandırma, başarısız yazmada bellek durumunu geri alma.
- Windows veritabanı: `%APPDATA%/defter-mini/defter-mini.sqlite` (Electron `app.getPath('userData')`). JSON yedekleri taşınabilir uygulama yedeğidir; canlı SQLite dosyasını elle düzenlemeyin.
- `src/storage.ts`: masaüstünde IPC'yi kullanır. Tarayıcı demosunda sql.js SQLite dosyası localStorage'a kaydedilir. Tarayıcı depolama kotası/silinmesi riski vardır; kalıcı işletme kullanımı için masaüstünü ve düzenli yedeklemeyi tercih edin.
- İnternet uygulamanın günlük kullanımı için gerekmez; yazı tipleri, grafikler, SQLite WASM ve uygulama varlıkları pakettedir. Ağ yalnızca geliştirme bağımlılıklarını indirmek için gerekir.
- Üyelik, lisans ve ödeme servisi yoktur; veri erişimi arayüzünün arkasına gelecekte ayrı modül eklenebilir.

## Doğrulama

```sh
npm test               # 12 hesap testi + SQLite entegrasyon testi
npm run build          # ortak model, TypeScript ve üretim varlıkları
npm run test:e2e       # 2 gerçek tarayıcı iş akışı testi
npm run test:desktop   # üretim derlemesinde Electron/IPC/kapanıp açılma kontrolü
```

Tarayıcı testleri sistemde `/usr/bin/chromium` varsa kullanır; başka sistemlerde önce `npx playwright install chromium` çalıştırın. `PLAYWRIGHT_EXECUTABLE_PATH` ile kurulu Chromium yolu verilebilir. Masaüstü testi grafik ekran gerektirir; Linux'ta DISPLAY veya sanal X ekranı gerekir. Test ayrı geçici kullanıcı veri dizininde çalışır, kişisel kayıtları kullanmaz. Linux CI için `CI=1` yalnızca test başlatıcısına `--no-sandbox` ekler; uygulamanın BrowserWindow sandbox ayarı açık kalır. Normal kullanımda bu bayrağı eklemeyin.

Linux dizin paketi:

```sh
npm run dist:linux
```

Ağ proxy'si olan bulut ortamlarında Electron indirmesi için `ELECTRON_GET_USE_PROXY=1` ve `GLOBAL_AGENT_HTTPS_PROXY`/`GLOBAL_AGENT_HTTP_PROXY` mevcut proxy değişkenlerinden aktarılabilir. TLS ve indirme checksum doğrulamasını kapatmayın. Bulut için tekrar kullanılabilir kurulum komutları `scripts/cloud-install.sh` içindedir.
