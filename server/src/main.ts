import { ConfigurationError, loadConfig } from "./config.js";
import { Store } from "./store.js";
import { WixProvider } from "./wix.js";
import { MembershipService } from "./service.js";
import { createMembershipServer } from "./http.js";
let stage = "configuration";
try {
  const c = loadConfig();
  stage = "database";
  const store = new Store(c.DATABASE_PATH, c.key);
  stage = "service";
  const provider = new WixProvider(c.WIX_CLIENT_ID),
    service = new MembershipService(store, provider, c.PUBLIC_ORIGIN),
    server = createMembershipServer(service, c.PUBLIC_ORIGIN);
  server.requestTimeout = 20_000;
  server.headersTimeout = 15_000;
  server.on("error", (error: NodeJS.ErrnoException) => {
    const reason = error.code === "EADDRINUSE" ? "port kullanımda" :
      error.code === "EACCES" ? "port bağlama izni yok" :
      error.code === "ENOTFOUND" || error.code === "EADDRNOTAVAIL" ? "HOST çözümlenemiyor veya bu makineye ait değil" : "HTTP dinleyicisi açılamadı";
    console.error(`Backend başlatılamadı [listen]: HOST/PORT: ${reason}. Render için HOST=0.0.0.0; PORT otomatik sağlanmalı.`);
    store.close();
    process.exitCode = 1;
  });
  server.listen(c.PORT, c.HOST, () =>
    console.log(
      `Defter Mini membership backend listening on ${c.HOST}:${c.PORT}. Wix connection is not yet verified.`,
    ),
  );
  const stop = () =>
    server.close(() => {
      store.close();
      process.exit(0);
    });
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
} catch (error) {
  if (error instanceof ConfigurationError) {
    for (const problem of error.problems)
      console.error(`Backend başlatılamadı [configuration]: ${problem}`);
  } else {
    const reason = stage === "database"
      ? "DATABASE_PATH: SQLite oturum deposu açılamadı; dizin yazma iznini ve dosyayı kontrol edin. Ücretsiz Render için :memory: kullanın."
      : "Servis oluşturulamadı; Node 24 ve sunucu bağımlılıklarını kontrol edin.";
    console.error(`Backend başlatılamadı [${stage}]: ${reason}`);
  }
  process.exitCode = 1;
}
