# Wix üyelik entegrasyonu — kurulum ve doğrulama

## Durum

Kod ve test altyapısı hazırdır. **Canlı Wix giriş/abonelik doğrulaması yapılmadı.** OAuth Client ID kullanıcı tarafından sağlandı ve sunucu ortam ayarlarına eklendi. HTTPS backend adresi henüz belirlenmedi; callback domaini uydurulmadı. Varsayılan üretim derlemesi finans ekranlarını kilitler. Çalışan aboneliksiz 1.2 sürümüne devam etmek için `main` dalını kullanın; Wix entegrasyonu ayrı geliştirme dalındadır.

Bu entegrasyon eski uygulamayı yeniden oluşturmaz. React finans ekranları, kuruş tabanlı hesap/vergi motorları ve SQLite şeması aynı kalır. Giriş kontrolü onların dışına, finans verisi yetkilendirmesi Electron ana sürecine eklenir. Sunucu, finans kayıtlarını almaz.

## Wix OAuth uygulaması ve mevcut istemci

1. Wix Dashboard’da **Defter Mini** sitesini açın. Site ID: `ece5420a-0b61-4879-8872-0e899f7628b5`.
2. Dashboard **Settings → Headless Settings → OAuth apps** bölümünü arayın. Arayüz dilinize göre **Ayarlar → Headless ayarları → OAuth uygulamaları** olarak görünebilir. Menüde bulunmuyorsa dashboard aramasında `Headless` veya `OAuth` arayın. Wix arayüzünün bu sitede hangi seçenekleri gösterdiği henüz doğrulanmadı; **Members/Site Üyeleri** listesi veya **Wix App Market developer app** kimliği bu client değildir.
3. **Create OAuth app / OAuth uygulaması oluştur** seçeneğiyle bu siteye bağlı bir OAuth client oluşturun. Uygulama adı örneğin **Defter Mini Windows** olabilir.
4. **Client ID** değerini alın. Client ID genel kimlik bilgisidir; gizli API anahtarı veya kullanıcı şifresi değildir.
5. Gerçek HTTPS backend adresi kararlaştırıldıktan sonra aynı OAuth uygulamasında yetkili yönlendirme adresini **`<PUBLIC_ORIGIN>/auth/callback`** olarak ekleyeceğiz. Şimdilik gerçek olmayan bir callback adresi girmeyin. SDK’nın Redirects giriş akışında istenen izinli origin/post-flow adreslerine de aynı gerçek backend origin/callback adresi eklenecek.

**Client ID tamamlandı:** `7b23a54e-e11b-4d43-b738-e5704e8723e6`. `server/.env` ve `server/.env.example` içinde `WIX_CLIENT_ID` olarak ayarlandı. Masaüstü yalnızca backend originini kullanır; bu Client ID’nin Electron ortamına eklenmesi gerekmez. Hosting adresi, callback ve sunucu anahtarı sonraki kurulum adımlarıdır. Yönetici API anahtarı bu çözümde kullanılmaz; istenmemelidir. Gizli değerleri sohbet yerine hosting sağlayıcısının secret/env ayarlarına girin.

Wix’in standart site hesabıyla giriş yapıldığı ve Pricing Plans siparişlerinin aynı site/OAuth client kapsamından döndüğü ilk canlı doğrulamada kontrol edilecek. Bu sitede Headless/OAuth seçeneği yoksa farklı uygulama kimliğiyle devam etmeyin; Wix’in siteye sunduğu güncel Headless veya Velo seçeneği ayrıca değerlendirilmelidir.

## Wix’teki üç alanın mevcut kodla ilişkisi

Henüz gerçek bir `PUBLIC_ORIGIN` tanımlanmadı. Dolayısıyla kesin bir tam callback URL’si yoktur. `server/src/config.ts` ve `server/src/service.ts`, callback’i `PUBLIC_ORIGIN + "/auth/callback"` olarak oluşturur. `server/src/http.ts` yalnızca bu `/auth/callback` yolunu karşılar; Wix web sitesi bu Node endpoint’ini kendiliğinden barındırmaz.

| Wix alanı                                       | Mevcut akışta gereklilik                                                                                                                                                                                     | Girilecek değer / mevcut durum                                                                                                                                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| İzin verilen yönlendirme domainleri             | Kodda genel `callbacks.postFlowUrl`, checkout veya özel dönüş sayfası kullanılmıyor. Bu akışta ayrıca böyle bir domain gereksinimi oluşturulmadı; OAuth callback’i aşağıdaki URI listesiyle yetkilendirilir. | Şimdilik ek domain girmeyin. Hosting seçildiğinde bu alan da kullanılacaksa yalnızca gerçek dönüş sunucusunun hostname’i eklenir; henüz belirlenmedi.                                                   |
| İzin verilen yetkilendirme yönlendirme URI’leri | **OAuth girişi için gerekli.**                                                                                                                                                                               | Gerçek backend HTTPS origininin sonuna **`/auth/callback`** eklenmiş tam URL. `PUBLIC_ORIGIN` boş olduğu için şu anda Wix’e yapıştırılacak kesin URL üretilemez. Şablonu literal değer olarak girmeyin. |
| Giriş URL’si                                    | **Mevcut hosted giriş akışında gerekli değil.**                                                                                                                                                              | **Boş bırakın.** Özel login sayfası geliştirilmiyor; Wix’in hazır giriş sayfası kullanılıyor. `/auth/start/<id>` her denemede değişir ve bu alana yazılacak sabit giriş URL’si değildir.                |

Resmi Redirects SDK’sındaki `CallbackParams.loginUrl` açıklaması: “The URL for a custom login page implemented outside of Wix. Default: If you don't specify a URL, a Wix login page is used.” Aynı tipte `postFlowUrl` açıklaması auth yönlendirmesinde bunun yerine `options.auth.authRequest.redirectUri` kullanılmasını söyler. `server/src/wix.ts` resmi `getAuthUrl` akışını kullanır; bu özel callback/login alanlarını göndermemektedir.

**İstemci gizli anahtarı gerekmez.** SDK `OAuthStrategy({clientId})` ve authorization-code/S256 PKCE kullanır; mevcut token değişiminde `clientSecret` parametresi yoktur. `SERVER_DATA_KEY` ise sunucu SQLite oturumlarını şifrelemek için sonradan üretilecek ayrı bir anahtardır; Wix Client Secret değildir. Yönetici API anahtarı da kullanılmaz.

Sonraki gerekli bilgi, backend’in çalışacağı gerçek HTTPS hosting adresidir. Backend, `www.deftermini.com` altında fiilen yayımlanıp `/auth/callback` isteği bu servise yönlendirilmeden o domaini callback olarak kullanmayın.

## İncelenen güncel resmi API yüzeyi

19 Ekim 2026 tarihinde npm registry’den Wix’in resmi güncel paketleri ve içlerindeki API belgeleri/TypeScript tanımları okundu:

- `@wix/sdk@1.21.18`: `OAuthStrategy.generateOAuthData`, `getAuthUrl({responseMode:'query'})`, `getMemberTokens`, `renewToken`. Kaynak dosyaları `build/auth/oauth2/OAuthStrategy.js` ve `types.d.ts`. Wix Redirects API üzerinden hosted giriş, S256 PKCE, state ve authorization code kullanılır.
- `@wix/members@1.0.533` → `@wix/auto_sdk_members_members@1.0.141`: `members.getCurrentMember({fieldsets:['FULL']})`. Onaylı (`APPROVED`) Wix üyesinin kimliği sunucuda alınır.
- `@wix/pricing-plans@1.0.422` → `@wix/auto_sdk_pricing-plans_orders@1.0.138`: **`orders.memberListOrders`**. Bu çağrı yalnızca oturumdaki üyenin siparişlerini döndürür. Yönetim amaçlı `managementListOrders` kullanılmaz. Paketler `server/package-lock.json` içinde sabitlenmiştir.

Resmi kaynaklar: [Wix SDK npm](https://www.npmjs.com/package/@wix/sdk), [Pricing Plans npm](https://www.npmjs.com/package/@wix/pricing-plans), [Members npm](https://www.npmjs.com/package/@wix/members), [Wix Developers](https://dev.wix.com/).

`dev.wix.com` belge sayfaları bu cloud ortamının egress proxy’sinden 403 döndüğü için web sayfası üzerinden ayrıca doğrulanamadı. İnceleme resmi paketlerin güncel API açıklamaları ve gerçek kaynak kodundan yapıldı; eski/kaldırılmış endpoint isimleri tahmin edilmedi. Cloud ağ taslağına `dev.wix.com`, `www.wixapis.com`, `www.wix.com`, `manage.wix.com`, `www.deftermini.com` alan adları eklendi. Taslak kaydı canlı ağ kuralının veya Wix bağlantısının çalıştığını kanıtlamaz; ortam ayarlarında inceleyip kaydetmek ve ortamı yayımlamak gerekir. Backend için seçilecek hosting domaini ayrıca izinli olmalıdır.

## Akış

1. Electron ana süreci 32 rastgele baytlık bir cihaz doğrulayıcısı üretir; sunucuya sadece SHA-256 challenge gönderir.
2. Sunucu kısa süreli giriş denemesi oluşturur. Electron sistem tarayıcısında yalnızca kendi yapılandırılmış backend’inin `/auth/start/<id>` adresini açar.
3. Backend resmi Wix SDK ile **kendi PKCE verifier/state** değerlerini oluşturur; tarayıcıyı Wix hosted girişine yönlendirir. Şifre uygulamada toplanmaz; kayıt olma ve satın alma web sitesinde yapılır.
4. Wix gerçek HTTPS callback’e code/state döndürür. Backend state’i tek kullanımlık tüketir, PKCE ile kodu token’a çevirir ve üye kimliğini `getCurrentMember` ile doğrular.
5. Electron aynı giriş denemesini cihaz verifier’ı ile sorgular. Verifier eşleşmeden oturum verilmez. Başarılı değişim tek kullanımlıktır, giriş denemesi 10 dakikada silinir.
6. Electron’a Wix token’ları değil, backend’in rastgele opaque oturum anahtarı verilir. Her durum sorgusunda backend Wix’ten üye kimliğini ve üyenin abonelik siparişlerini tekrar alır; istemciden gelen memberId kullanılmaz.
7. Wix access token süresi dolarken sunucu resmi `renewToken` çağrısını kullanır. Kimlik değişimi veya oturum iptali kabul edilmez. Sunucu oturumu en çok 30 gün sürer, çıkışta silinir.

## Erişim politikası

Yalnızca şu iki plan kabul edilir:

| Plan          | Plan ID                                | Gösterim fiyatı |
| ------------- | -------------------------------------- | --------------- |
| Aylık Üyelik  | `8ca42153-8cfb-4f1a-ad5a-7819a781ec42` | 119 TL/ay       |
| Yıllık Üyelik | `77a5c1a3-b8b6-4669-b346-570a06a05778` | 899 TL/yıl      |

Fiyat erişim ispatı değildir. `buyer.memberId` doğrulanmış üyeyle ayrıca eşleşir. İleri başlangıç, bitmiş/bozuk tarih, `PAUSED`, `ENDED`, `DRAFT`, `PENDING`, bilinmeyen durum ve aktif pause dönemi engellenir. Genel olarak ödeme `PAID` olmalıdır. Wix’in açıkça `currentCycle.index=0`, `NOT_APPLICABLE` ve gelecekteki dönem bitişi bildirdiği süreli denemeler de desteklenir. Ödeme `FAILED`, `UNPAID`, `REFUNDED` veya `PENDING` ise ihtiyatlı biçimde erişim verilmez; başarısız ödeme için uygulama kendi sınırsız tolerans dönemi yaratmaz. Özel Wix tahsilat/retry/grace kuralı isteniyorsa gerçek site siparişleriyle ayrıca doğrulanmalıdır.

İptal `NEXT_PAYMENT_DATE` ise ve gerçek `endDate` gelecekteyse ödenmiş dönemin bitimine kadar erişim korunur. `IMMEDIATELY` iptali ve bitiş tarihi olmayan iptal kabul edilmez. Aktif, iptal edilene kadar geçerli düzenli siparişte `endDate` boş olabilir; uygulama 30/365 gün ekleyerek sahte bitiş oluşturmaz.

Başlangıçta, iki dakikada bir ve uyku dönüşünde backend kontrol edilir. Verilen erişim en fazla beş dakikadır, bilinen dönem/bitiş tarihinden ileriye gitmez. İnternet/API hatası kontrol sırasında erişimi kapatır; yeniden başlatmada eski erişim hakkı diskten geri yüklenmez. Monotonik sayaç ve duvar saati birlikte denetlenir. Sadece giriş ekranı değil, SQLite okuma/yazma/yedek/geri yükleme IPC çağrıları da ana süreçte kontrol edilir.

## Güvenli saklama ve yerel veri

- Backend Node.js 24 + yerleşik SQLite kullanır. Wix token’ları ve giriş akışı sırları `SERVER_DATA_KEY` ile AES-256-GCM şifrelenir. Backend opaque oturum anahtarını düz metin anahtar olarak değil SHA-256 özetiyle indeksler.
- Windows’ta Electron `safeStorage`/DPAPI, backend oturum anahtarını şifreler. Renderer’a bearer token verilmez; genel fetch/IPC veya dosya sistemi yetkisi açılmaz.
- Güvenli OS şifrelemesi yoksa düz metin oturum saklama yapılmaz. Linux’ta `basic_text` backend kabul edilmez.
- Finans veritabanı adı/yeri değiştirilmedi. İlk **başarılı ve aktif** üye kontrolünde bu bilgisayardaki veri alanı o üyeye hash ile bağlanır (`membership-owner.json`); başka üye aynı yerel kayıtları göremez. Bu bağ yedek geri yüklemeyle silinmez. İlk girişin mevcut kayıtların sahibinin hesabıyla yapılması gerekir.
- Çıkış finans kayıtlarını silmez. `membership-session.bin` oturum kasası silinir. Ağ yokken sunucudaki iptal isteği tamamlanamayabilir; yerel oturum yine kapanır, sunucu oturumu son kullanma tarihine tabidir.
- SQLite yedekleri finans verisini içerir; sunucu şifreleme anahtarını, Wix token’larını veya üyelik oturumunu içermez. Veri sahibini değiştirmek için owner dosyasını silmek bir ürün akışı değildir; hesap/veri aktarımı ayrıca güvenli olarak tasarlanmalıdır.

## Backend’i kurma

Node.js **24** gereklidir. Backend’i mevcut Wix sitesinden ayrı, kalıcı disk ve HTTPS reverse proxy sunabilen bir hostta çalıştırın. Geçici/sunucusuz dosya sisteminde bu SQLite oturum deposunu dağıtmayın.

```sh
cd server
npm ci
# server/.env.example içeriğini server/.env dosyasına kopyalayın.
# WIX_CLIENT_ID, PUBLIC_ORIGIN ve SERVER_DATA_KEY değerlerini gerçek yapılandırmayla doldurun.
npm run build
npm start
```

`SERVER_DATA_KEY`, hostun secret manager’ında saklanacak 32 bayt base64 anahtardır. Yerel olarak kendiniz üretmek için:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Bu değeri sohbete, Git’e veya Electron paketine koymayın. Değiştirmek mevcut şifreli oturumları okunamaz yapar; anahtar ve backend veritabanı güvenli biçimde birlikte yedeklenmelidir.

Hostta HTTPS sonlandırılmalı, `/v1/*` ve `/auth/*` bu tek Node servisine yönlenmeli, `/auth/callback` sorgu parametreleri access log’a yazılmamalıdır. Proxy body limitini 8 KB, istek süresini en az 20 saniye olarak ayarlayın. Uygulama socket IP başına dakika başına 120 istek sınırı uygular; arkasındaki proxy aynı IP’yi paylaşacağından üretim reverse proxy’sinde ayrıca gerçek istemci IP’sine göre rate limit konmalıdır. `X-Forwarded-For` körü körüne güvenilmez. Tek instance + tek kalıcı SQLite dosyası için tasarlanmıştır; çok instance için paylaşılan kalıcı DB/rate limiter adaptasyonu gerekir.

`GET /healthz` servis çalışıyor mu kontrolüdür; `wixConnectionChecked:false` döndürür, Wix’e bağlı olduğunun kanıtı değildir. İlk gerçek OAuth giriş ve `/v1/session` sorgusu bağlantı kontrolüdür.

## Electron’u gerçek backend’e bağlama

Kök `.env.example` dosyasını kök `.env` olarak kopyalayın. **Yalnızca genel backend HTTPS originini** `DEFTER_MEMBERSHIP_API_ORIGIN` alanına yazın. Wix client ID veya sunucu anahtarı bu dosyada bulunmaz.

```sh
npm ci
npm run desktop
# Windows installer, canlı testlerden sonra:
npm run dist:win
```

`build:membership` sadece genel origin bilgisini `electron/membership-config.json` dosyasına üretir. Sunucu klasörü, `.env` dosyaları ve sunucu sırları Electron `build.files` kapsamına dahil değildir. Callback backend üzerindedir; masaüstünde custom URI veya açık localhost portu gerekmemektedir. Üretim istemcisi yalnızca HTTPS kabul eder.

## Yapılan testler ve kalan canlı doğrulama

- `npm test`: hesap/vergi/SQLite testleri + üyelik politikası, OAuth state/cihaz kanıtı/tekrar kullanım, üye sahipliği, ağ hatası, çıkış, HTTP bearer/origin kontrolleri ve şifreli kalıcılık testleri.
- `npm run server:build`: resmi SDK tipleriyle TypeScript backend derlemesi.
- `npm run build`: üretim Electron/React varlıkları ve TypeScript.
- `npm run test:e2e`: yapılandırılmamış ekranın kilidi, abonelik yok/var/geri çekilme senaryoları ve mevcut üç finans iş akışı. Yetkili finans testleri **yalnızca test dosyasındaki tarayıcı fixture’ını** kullanır; bu dosya üretim paketine dahil değildir.
- `npm run test:desktop`: gerçek Electron’da oturumsuz finans IPC çağrılarının reddi ve önceden oluşturulan SQLite dosyasının değişmemesi. Linux’ta sanal/grafik ekran gerekir. Canlı Wix bağlantısını sınamaz.
- Eski `npm run test:desktop:finance` yetkili masaüstü akışının yardımcısıdır; artık geçerli backend oturumu olmadan çalışması beklenmez. Üretimde abonelik kilidini atlayan test modu/env bayrağı yoktur.

Canlı OAuth client + host sağlandıktan sonra iki plan, aboneliksiz hesap, iptal edilen ama ödenmiş dönemi süren hesap, süresi biten hesap, başarısız tahsilat, restart, çıkış ve ağ kesintisi **gerçek Wix verileriyle** test edilecek. Bu adımlar tamamlanmadan entegrasyonu canlıya hazır kabul etmeyin. Sistem tarayıcısındaki Wix oturumu çıkışta otomatik silinmez; uygulama backend oturumu silinir ve sonraki hosted giriş `prompt:'login'` kullanır.

## Dosya haritası

- Yeni backend: `server/src/config.ts`, `wix.ts`, `policy.ts`, `store.ts`, `service.ts`, `http.ts`, `main.ts`; `server/package.json`, kilit dosyası, TypeScript yapılandırması, `server/.env.example`, Dockerfile ve dockerignore.
- Yeni masaüstü parçaları: `electron/membership.cjs`, `electron/session-vault.cjs`, `scripts/write-membership-config.cjs`, kök `.env.example`. `electron/main.cjs` IPC yetkilendirmesi, `electron/preload.cjs` sınırlı üyelik köprüsü için güncellendi.
- Arayüz: yeni `src/MembershipGate.tsx`; `src/main.tsx` ve `src/style.css` giriş ekranı/üyelik çubuğu için güncellendi. İcmal/Ayarlar/Kasa bileşenleri ve hesap motorları değiştirilmedi.
- Testler: `tests/membership.test.ts`, `tests/membership-controller.test.ts`, `e2e/membership.spec.ts`, testlere özel `e2e/fixtures.ts`, `scripts/desktop-membership.cjs`. Mevcut finans uçtan uca testleri sadece test fixture’ına bağlandı.
- Dokümantasyon ve komutlar: README, bu kılavuz, kök package scripts/lockfile ve gitignore. Dockerfile hazırlandı ancak bu görevde Docker imajı veya Windows kurulum dosyası oluşturulmadı.

Son yerel sonuç: 70 otomatik birim/entegrasyon testi ve 5 tarayıcı testi geçti; gerçek Electron kilit/IPC/SQLite koruma kontrolü geçti. Test doubles yalnızca test dosyalarında kullanıldı. Hiçbir sonuç gerçek Wix aboneliğinin doğrulandığı anlamına gelmez.
