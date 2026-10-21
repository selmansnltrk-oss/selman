# Güncel Windows uygulaması

Wix giriş ekranı ve tarayıcıdan OAuth/PKCE giriş akışı masaüstü kodunda bulunur. Abonelik backend tarafından kontrol edilir; doğrulama yoksa finans ekranları ve Electron veri IPC işlemleri kapalıdır. Eski bir EXE kendiliğinden güncellenmez. Backend'in gerçek adresi derleme sırasında pakete yazılır. Sunucu anahtarlarını masaüstüne koymayın.

## GitHub üzerinden EXE oluşturma (bilgisayara Node kurmadan)

1. Önce Render API'sini çalıştırın. Gerçek servis adresinde `/healthz` HTTP 200 dönmeli. Bu yalnızca API sağlığıdır; canlı Wix doğrulaması değildir.
2. Wix Headless istemcisinde izin verilen OAuth yönlendirme URI'si olarak bu gerçek HTTPS kök adresine `/auth/callback` ekleyin. Wix hosted login kullanılır.
3. GitHub deposunda **Actions → Windows uygulamasini olustur → Run workflow** seçin. Dal `main` olsun.
4. `backend_origin` alanına gerçek Render HTTPS kök adresini girin; sonunda `/` veya `/auth/callback` olmasın. Bu adres herkese açık bilgidir; gizli anahtar girilmez.
5. İşlem yeşil tamamlanınca açın. **Artifacts → Defter-Mini-Windows** dosyasını indirin (GitHub hesabıyla giriş gerekir).
6. ZIP'i çıkarın; içindeki `Defter Mini Setup ... .exe` kurulum dosyasını açın. Kurulumdan sonra Başlat menüsünden Defter Mini'yi çalıştırın. Wix hesabıyla giriş yapın.

Bu workflow henüz Windows üzerinde çalıştırılıp doğrulanmadı; başarılı çalışmadan indirme dosyası oluşmaz. Artifact 14 gün saklanır. Otomatik GitHub Release yayını ve kod imzalama yapılandırılmadı. İmzasız kurulum Windows tarafından uyarıyla gösterilebilir; yayıncı imzasıyla doğrulanmış sürüm değildir. Aktif aylık/yıllık Wix üyeliği ve gerçek hesapla giriş canlı olarak ayrıca test edilmelidir.

## Windows bilgisayarında oluşturma

Önce mevcut uygulamadaki finans kayıtlarınızın yedeğini alın. Node.js 24 kurun. Kaynak ZIP'ini çıkarıp proje klasöründe CMD açın. `.env.example` dosyasını `.env` adıyla kopyalayın. Şu satırın sağına gerçek Render HTTPS kök adresini yazın:

```dotenv
DEFTER_MEMBERSHIP_API_ORIGIN=
```

Ardından sırayla çalıştırın:

```cmd
npm ci
node node_modules/electron/install.js
node node_modules/esbuild/install.js
npm run dist:win
```

Kurulum EXE'si `release` klasöründe oluşur. Geliştirme sürümünü kurulum oluşturmadan açmak için `npm run desktop` veya `BASLAT.cmd` kullanın. Windows paketleme komutu backend adresi boşsa hata verir; masaüstü geliştirme komutu ise boş adreste güvenli kilit ekranını açar.

Render Environment ayarları masaüstündeki `.env` dosyasını kendiliğinden doldurmaz. Render adresi değişirse masaüstü yeniden paketlenmelidir. Ücretsiz Render yeniden başlatılınca oturum kaybolabilir; yeniden giriş gerekir. Yerel finans SQLite dosyası backend'e gönderilmez veya bu derleme işlemiyle silinmez.
