# Render ücretsiz backend kurulumu

Bu servis yalnızca Node üyelik API'sini çalıştırır; Electron çalıştırılmaz.

| Render alanı | Değer |
| --- | --- |
| Branch | `main` |
| Language / Runtime | `Node` (Docker seçmeyin) |
| Root Directory | `server` |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/healthz` |
| Instance Type | Free |

Environment Variables bölümüne aşağıdaki değerleri girin:

```dotenv
NODE_VERSION=24
NODE_ENV=production
HOST=0.0.0.0
WIX_CLIENT_ID=7b23a54e-e11b-4d43-b738-e5704e8723e6
WIX_SITE_ID=ece5420a-0b61-4879-8872-0e899f7628b5
DATABASE_PATH=:memory:
ALLOW_LOCAL_HTTP=false
```

Ayrıca **SERVER_DATA_KEY** zorunludur. Kendi bilgisayarınızda CMD'de şu komutu çalıştırın:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Çıkan değeri yalnızca Render'daki `SERVER_DATA_KEY` VALUE alanına yapıştırın. Sohbete veya GitHub'a göndermeyin. Bu Wix istemci gizli anahtarı değildir; sunucunun AES-256-GCM şifreleme anahtarıdır. OAuth/PKCE için Wix client secret kullanılmaz.

`PORT` ve `RENDER_EXTERNAL_URL` değişkenlerini Render kendisi sağlar; elle eklemeyin. Kod `process.env.PORT` değerinde ve `0.0.0.0` üzerinde dinler. `PUBLIC_ORIGIN` girilmezse kod gerçek `RENDER_EXTERNAL_URL` adresini kullanır. Özel domain kullanıyorsanız `PUBLIC_ORIGIN` değerini gerçekten bu servise bağladığınız HTTPS kök adresi olarak ayrıca tanımlayabilirsiniz; yol eklemeyin.

Dağıtımdan sonra Render'ın gösterdiği gerçek HTTPS adresinin sonuna `/auth/callback` ekleyerek Wix Headless istemcisinin izin verilen yetkilendirme yönlendirme URI'lerine girin. Servis adı/URL henüz bilinmediği için burada adres uydurulmamıştır. Wix hosted login kullanılır; özel Giriş URL'si gerekmez. Masaüstü derlemesinin kök `.env` dosyasında `DEFTER_MEMBERSHIP_API_ORIGIN` bu gerçek backend originine ayarlanmalı ve uygulama yeniden paketlenmelidir. Bu değişken Render backend ayarı değildir.

## Ücretsiz planda veri ve kullanılabilirlik

Ücretsiz Render Web Service kalıcı disk sunmaz. Dosyaya SQLite yazmak yeniden dağıtım/instance değişiminde kaybolabilir. Bu nedenle bu kurulum **bilinçli olarak bellekte SQLite** kullanır (`:memory:`). Her yeniden başlatmada, dağıtımda veya boşta kalıp uyuyup yeniden açılmada sunucu oturumları ve devam eden OAuth işlemleri kaybolur; kullanıcı yeniden giriş yapmalıdır. Erişim bu sırada doğrulanmadan açılmaz.

Finans SQLite dosyası kullanıcı bilgisayarında kalır. İcmal, Kasa, Ayarlar kayıtları backend'e taşınmaz; backend oturum kaybı bunları silmez. Aboneliklerin asıl kaynağı Wix'tir. Kalıcı oturum isteyen üretim kurulumu için ücretli kalıcı disk üzerinde SQLite veya kod adaptasyonuyla harici kalıcı veritabanı gerekir. Mevcut kod harici PostgreSQL bağlantısını desteklemez. SQLite ile tek instance kullanın.

Ücretsiz servis soğuk başlangıcı istemci zaman aşımına neden olabilir; servis açıldıktan sonra Tekrar Kontrol Et/giriş işlemini tekrar deneyin. Bu ücretsiz kurulum kesintisiz erişim garantisi vermez. Sunucu proxy socket IP'sine göre hız sınırı uygular; yoğun çok kullanıcılı üretim için güvenilir proxy/rate limiter yapılandırması ayrıca gerekir.

`/healthz` HTTP 200 döndürmesi yalnızca API'nin çalıştığını gösterir; Wix bağlantısını doğrulamaz (`wixConnectionChecked:false`). Kök `/` adresinin 404 vermesi normaldir; bu bir web arayüzü değildir. Gerçek Wix girişinin, aylık/yıllık aboneliğin ve iptal/sona erme durumlarının canlı testi ayrıca yapılmalıdır. Bu depodaki yerel testler gerçek Wix testinin yerine geçmez.

Resmi Render referansları: [Node sürümü](https://render.com/docs/node-version), [ortam değişkenleri](https://render.com/docs/environment-variables), [ücretsiz servis sınırları](https://render.com/docs/free), [port bağlama](https://render.com/docs/web-services#port-binding).
