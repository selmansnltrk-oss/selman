# Defter Mini

Küçük işletmeler için Türkçe, çevrimdışı gelir–gider ve **tahmini işletme sonucu** takibi. Electron + React + TypeScript + Tailwind CSS + SQLite (sql.js) + Recharts.

## Wix entegrasyonu geliştirme dalı

Bu daldaki sürüm Wix üyelik kontrolü içerir. **Canlı Wix bağlantısı henüz kurulmadı; varsayılan durumda uygulama finans ekranlarını açmaz.** Mevcut aboneliksiz çalışan sürüm `main` dalındadır. Kurulumdan önce mevcut uygulamanızdan yedek alın. OAuth Client ID ve gerçek backend hosting adresi sağlandıktan sonra canlı doğrulama yapılacaktır.

Giriş akışı, güvenlik tasarımı, incelenen resmi SDK belgeleri, ortam değişkenleri ve Wix’te yapılacak ilk işlem için [Wix entegrasyon kılavuzunu](docs/WIX_INTEGRATION.md) okuyun. Sunucu sırları yalnızca `server/.env`/hosting secret manager içinde tutulur; uygulamaya gömülmez. Aşağıdaki eski çevrimdışı kullanım açıklamaları artık yalnızca finans verilerinin yerel tutulmasını ifade eder; giriş ve düzenli abonelik kontrolü internet gerektirir.

## Hızlı başlangıç

Windows’ta Node.js 24 LTS kurulduktan sonra **BASLAT.cmd** dosyasına çift tıklayabilirsiniz. İlk kurulum internet gerektirir. Bu başlatıcı npm sürümlerinin atladığı Electron ve esbuild kurulum adımlarını da çalıştırır.

Terminalden çalıştırmak için Node.js 24 LTS ve npm gerekir. Mevcut depoda çalışın; bu bulut ortamı zaten yalıtılmıştır, ayrıca Git worktree oluşturmayın.

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

NSIS kurulum dosyası `release/Defter Mini Setup 1.3.0.exe` altında oluşur. Bu bulut çalışmasında Windows kurulum dosyası üretilmedi; Linux dizin paketi ve Linux Electron çalışma akışı doğrulandı. Windows'ta kurulum/kaldırma, güncelleme ve SmartScreen davranışı ayrıca test edilmelidir. Dağıtım imzası/sertifikası bu sürümde yapılandırılmadı. Uygulama verileri kurulum dizininde tutulmaz; güncellemeler kullanıcı veritabanının üzerine yazmaz. Programı güncellemeden önce yedek alın.

## Kullanım

1. **Ayarlar:** işletme bilgileri, aylık giderler, komisyonlar ve kalıcı personel listesi. Tutarlar günlük maliyete göre personel şablonuna girilir. Kaydet düğmesiyle kalıcı olur. Ayarlar yeni günlere uygulanır; geçmiş kayıtlar oran ve gider anlık görüntülerini korur. Ayar kaydedildiğinde bugünün taslağına ve henüz kaydedilmemiş güne komisyon/sabit gider/vergi bilgileri, giriş tutarları korunarak uygulanır. Günlük kaydı tekrar kaydedin. Geçmiş bir günde yeni ayarları kullanmak için İcmal → Güncel ayarları uygula → Hesapla → Günü kaydet yolunu izleyin.
2. **İcmal:** tarihi seçin, satışları, POS tahsilatlarını, personel maliyetlerini ve günlük giderleri girin. Hesapla sonucu gösterir; Günü kaydet hesaplar ve kalıcılaştırır. Aynı gün için kayıt varsa güncelleme onayı gerekir. Personel günlük ekrandan da eklenebilir; şablonun sonraki günlere taşınması için Ayarlar bölümünü kaydedin.
3. **Kasa:** tek gün için iki tarih alanına aynı tarihi girin veya aralık/hazır dönem seçin. Bir günlük kayda tıklayın; ayrıntıları görüntüleyin, Düzenle ile İcmal'e dönün. Silme onaylıdır.
4. **Yedekleme:** Ayarlar → Yedek al / Geri yükle. JSON yedeği ayarları ve günlük kayıtları içerir; harici bir yerde güvenle saklayın. İçe aktarma doğrulanır ve mevcut kayıtları değiştirmek için onay ister. Masaüstü geri yükleme öncesinde `geri-yukleme-oncesi.json` güvenlik kopyası da oluşturulur. Bu dosya bir önceki geri yüklemeye aittir; düzenli yedek yerine geçmez.

## Hesaplama kuralları

- Para tam sayı **kuruş**, oranlar tam sayı **baz puan** olarak işlenir; her kesinti kuruşa yuvarlanır. Türkçe `2.749,45` veya `2749.45` girişi desteklenir.
- POS tutarları satış kaynağı değildir, girilen satışların kartla tahsil edilen alt kümesidir. Gelire eklenmez. Birden fazla POS toplamı girilen satış toplamını aşamaz. Platform komisyonu POS maliyetini de kapsıyorsa aynı tahsilatı ayrıca POS'a girmeyin.
- Net tahsilat modunda ilgili platform komisyonu tekrar düşülmez. Bu modda brüt ciro geri hesaplanmaz; rapor toplamı girilen brüt satış ve net tahsilatların toplamıdır. Bu durum sonuç ekranında belirtilir.
- Personel maliyeti ücret + prim + sigorta + diğer maliyet toplamıdır. Nakit ödeme/avans ayrı bilgi alanıdır, tekrar gider yazılmaz. Aylık maaşı günlük maliyete kullanıcı dönüştürür.
- Aylık kira + muhasebe + diğer sabit giderler Ayarlar’daki seçime göre ilgili ayın gerçek gün sayısına veya her ay 30’a bölünür; artık yıl desteklenir. Günlük pay en yakın kuruşa yuvarlanır; aylık toplamda birkaç kuruş yuvarlama farkı oluşabilir.
- Kurye ve diğer kesinti oranları girilen satış/tahsilat toplamına uygulanır. Aynı kesintiyi platform oranında da tanımlamayın.
- Gider tutarları **KDV dahil** girilir. Fiş/fatura ve kullanıcı tarafından girilen KDV oranı saklanır. Vergi analizi etkinleştirilip profili teyit edildiğinde, belgeye ek olarak “KDV indirilebilir” onayı verilen giderin KDV’si ayrıştırılır; fiş/fatura tek başına indirim varsayımı oluşturmaz. Belgesiz gider de tam tutarıyla maliyete dahil edilir.
- Tahmini sonuç = girilen gelir − platform/POS/kurye/diğer kesintiler − personel maliyeti − günlük giderler − sabit pay. Stok/satılan mal maliyeti girilmezse sonuç **gerçek net kâr değildir**. Ürün maliyetini gider kategorisi olarak girebilirsiniz; stok envanter muhasebesi bu sürümde bulunmaz.
- Kasa raporu finansal sonuç raporudur. Açılış bakiyesi, tahsilat vadeleri ve banka hareketleri izlenmediğinden fiili kasa bakiyesi sunmaz.

## Veriler ve mimari

- `src/model.ts`: ortak Zod şemaları, kuruş tabanlı hesap motoru, tarih filtreleri. `build:model` bu modülü Electron ana süreci için derler; UI ve IPC aynı doğrulamayı kullanır.
- `electron/main.cjs`: güvenli IPC, dosya diyalogları, yedek doğrulaması. `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`; IPC ana pencere ve ana çerçeveyle sınırlıdır. Harici pencere ve gezinme engellenir; içerik güvenlik politikası uygulanır.
- `electron/preload.cjs`: yalnızca izin verilen veri işlemlerini açar. Renderer dosya yoluna veya genel IPC erişimine sahip değildir.
- `electron/storage.cjs`: parametreli SQLite sorguları, atomik geçici dosya + yeniden adlandırma, başarısız yazmada bellek durumunu geri alma.
- Windows veritabanı: `%APPDATA%/defter-mini/defter-mini.sqlite` (Electron `app.getPath('userData')`). JSON yedekleri taşınabilir uygulama yedeğidir; canlı SQLite dosyasını elle düzenlemeyin.
- `src/storage.ts`: masaüstünde IPC'yi kullanır. Tarayıcı demosunda sql.js SQLite dosyası localStorage'a kaydedilir. Tarayıcı depolama kotası/silinmesi riski vardır; kalıcı işletme kullanımı için masaüstünü ve düzenli yedeklemeyi tercih edin.
- Finans varlıkları yereldir; üyelik girişi ve düzenli doğrulama internet gerektirir; yazı tipleri, grafikler, SQLite WASM ve uygulama varlıkları pakettedir. Ağ yalnızca geliştirme bağımlılıklarını indirmek için gerekir.
- Bu geliştirme dalı ayrı bir Wix üyelik backend’i kullanır. Ödeme uygulamada alınmaz; Wix web sitesinde gerçekleşir. Canlı bağlantı beklenmektedir.

## Doğrulama

```sh
npm test               # Finans + vergi + SQLite + üyelik güvenlik testleri
npm run build          # ortak model, TypeScript ve üretim varlıkları
npm run test:e2e       # Üyelik kilidi + mevcut finans iş akışları
npm run test:desktop   # Electron üyelik kilidi, IPC engeli, SQLite koruma
```

Tarayıcı testleri sistemde `/usr/bin/chromium` varsa kullanır; başka sistemlerde önce `npx playwright install chromium` çalıştırın. `PLAYWRIGHT_EXECUTABLE_PATH` ile kurulu Chromium yolu verilebilir. Masaüstü testi grafik ekran gerektirir; Linux'ta DISPLAY veya sanal X ekranı gerekir. Test ayrı geçici kullanıcı veri dizininde çalışır, kişisel kayıtları kullanmaz. Linux CI için `CI=1` yalnızca test başlatıcısına `--no-sandbox` ekler; uygulamanın BrowserWindow sandbox ayarı açık kalır. Normal kullanımda bu bayrağı eklemeyin.

Linux dizin paketi:

```sh
npm run dist:linux
```

Ağ proxy'si olan bulut ortamlarında Electron indirmesi için `ELECTRON_GET_USE_PROXY=1` ve `GLOBAL_AGENT_HTTPS_PROXY`/`GLOBAL_AGENT_HTTP_PROXY` mevcut proxy değişkenlerinden aktarılabilir. TLS ve indirme checksum doğrulamasını kapatmayın. Bulut için tekrar kullanılabilir kurulum komutları `scripts/cloud-install.sh` içindedir.

## 1.1 — vergi analizi ve güncelleme

Açık gri, beyaz ve mavi görünüm; yerel sistem yazı tipleri kullanır: macOS’ta Apple sistem fontu, Windows’ta Segoe UI Variable / Segoe UI. Harici Apple font dosyası dağıtılmaz.

**Var olan verilerle güncelleme:** Önce eski uygulamada Ayarlar → Yedek al. Güncel kaynak ZIP’ini yeni klasöre çıkarın, `BASLAT.cmd` dosyasını çalıştırın. Uygulama kimliği ve userData yolu değiştirilmedi; kullanıcı veritabanı korunur. Eski günlük kayıtlar ve eski JSON yedekleri yeni isteğe bağlı alanlar olmadan açılır. `node_modules`, `dist` veya uygulama veritabanını yeni kaynak ZIP’ine kopyalamanız gerekmez. Kullanıcı veritabanını silmeyin.

### Vergi kuralları ve güven sınırı

`src/tax-rules.json`, kullanıcının sağladığı 2026 başlangıç verisini içerir: genel kurumlar vergisi %25, ticari kazanç tarifesi 190.000 / 400.000 / 1.000.000 / 5.300.000 TL sınırları ve %15 / 20 / 27 / 35 / 40 dilimleri. **Bu görevde resmi kaynaktan doğrulanmadı; resmi veya bütün özel durumları kapsayan mevzuat veritabanı değildir.** Ayarlarda düzenlenebilir; başka yıl seçmek tarifeyi otomatik güncellemez. Etkinleştirme ve yıl/tarife/açılış matrahı teyidi yapılana kadar vergi sonuçları “Hesaplanamadı” gösterilir. Kaydedilen her ayarda ayrı profil sürümü oluşturulur; günler kendi tarife anlık görüntülerini saklar.

`src/tax-policy.ts` doğrulama/profil/KDV ayrıştırmasını, `src/tax.ts` bağımsız tahmini vergi analizini içerir. Şahısta yıllık kümülatif matrahın artan oranlı vergi farkı, limited/anonimde gider ve matrah düzeltmeleri sonrası dönem kazancının vergi farkı karşılık olarak hesaplanır. Negatif fark tahmini karşılık iptalidir; resmi iade değildir. Adi ortaklıkta her ortağın payı, statüsü ve açılış matrahı gerekir; ortaklık kendiliğinden kurumlar vergisi mükellefi varsayılmaz.

Açılış matrahı, uygulamada kayıtlı ilk günden önceki aynı yılın kümülatif tahminidir; kayıtlı günleri içermemelidir. KKEG/istisna/indirimler günlük matrah düzeltmesidir. İlgili geçmiş yıl zararlarının kullanılabilirliğini muhasebeciniz belirler. Geçmiş kayıt değişince kaynak veriler tarihe göre yeniden hesaplanır, sonraki günlerin karşılıkları Kasa’da otomatik değişir. Eksik vergi profili olan önceki kayıt varsa kümülatif karşılık hesaplanamaz; önce o kaydı tamamlayın. Uygulama dışındaki günlerin doğruluğu açılış matrahını teyit eden kullanıcıya bağlıdır.

KDV her kalemde net/KDV/brüt ayrıştırılır. Net platform tahsilatından brüt fatura bilinmediği için KDV ve vergi sonucu üretilmez. Gelir KDV’si ve onaylı gider KDV’si farkından aylık tahmini yükümlülük ve kredi hesaplanır; negatif bakiye sonraki aya taşınır. Açılış devreden KDV kayıtlı ilk ayın kredisi olmalıdır. İleri dönem hesapları önceki ayda eksik veri varsa bloke edilir. KDV tutarı vergi sonrası sonuçtan yeniden düşülmez. Kasa’daki dönem KDV değeri günlük aylık yükümlülük değişimlerinin toplamıdır, aynı birikimli bakiye her gün tekrar toplanmaz.

Sabit gider/komisyonlar belge bazında KDV detayına sahip olmadığından girilen brüt maliyetleriyle analiz edilir, otomatik KDV indirimleri yaratılmaz. Günlük giderler KDV dahil girilir; indirim belgesi/işlem uygunluğu kullanıcı onayı gerektirir. KDV istisnaları, tevkifat, yurt dışı işlemler, mahsup ve özel beyan dönemleri otomatik çözülmez.

Kira stopajı yalnızca açıkça etkinleştirilirse hesaplanır. Brüt kirada stopaj maliyete ikinci kez eklenmez; net kirada oran üzerinden brütleştirme farkı günlük gider olur. Ek SGK/Bağ-Kur giderlerini personel maliyetine zaten yazdıysanız bu alana tekrar yazmayın. Bordro otomasyonu yapılmaz. Fiilen ödenen vergi, geçici vergi mahsubu veya avans ayrı bilgi alanıdır ve karşılık hesabından ikinci kez düşülmez.

Tüm sonuçlar işletme analizi içindir; resmi beyanname, net vergi borcu, gerçek net kâr veya fiili kasa bakiyesi iddiası yoktur.

## 1.2 — belirgin net sonuç ve web sitesiyle uyumlu görünüm

İcmal’de Hesapla sonrasında ve Kasa’da seçilen dönemin başında **Tüm giderler ve vergiler sonrası** kâr/zarar kartı bulunur. Aynı vergi motorunun `after` sonucu kullanılır: KDV ayrıştırılmış faaliyet sonucu eksi gelir/kurumlar vergisi karşılığı. KDV ödemesi veya ödenen vergi tekrar düşülmez. Eksik vergi bilgisi varsa sıfır kâr gösterilmez, “Hesaplanamadı” yazılır. Kasa’nın KDV dahil ara sonucu ayrı etiketlidir.

Görünüm, paylaşılan web sitesi referansına göre lacivert üst menü, mor/turkuaz geçişler ve açık kartlarla yenilendi. Grafikler canlı mor, turkuaz, turuncu, pembe, mavi ve yeşil renklerle çizilir.

Günlük kayıt listesi, kârlı/zararlı gün toplamları ve eğilim grafiği de vergi hesabı tam olduğunda tüm gider ve vergiler sonrası sonucu kullanır. Eksik vergi verilerinde ara değerler açıkça etiketlenir. Kâr, zarar ve başabaş durumları arayüz testinde doğrulanır.
