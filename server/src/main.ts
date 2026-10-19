import { loadConfig } from "./config.js";
import { Store } from "./store.js";
import { WixProvider } from "./wix.js";
import { MembershipService } from "./service.js";
import { createMembershipServer } from "./http.js";
try {
  const c = loadConfig(),
    store = new Store(c.DATABASE_PATH, c.key),
    provider = new WixProvider(c.WIX_CLIENT_ID),
    service = new MembershipService(store, provider, c.PUBLIC_ORIGIN),
    server = createMembershipServer(service, c.PUBLIC_ORIGIN);
  server.requestTimeout = 20_000;
  server.headersTimeout = 15_000;
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
} catch {
  console.error(
    "Backend başlatılamadı. .env içindeki WIX_CLIENT_ID, PUBLIC_ORIGIN ve SERVER_DATA_KEY ayarlarını kontrol edin. Gizli değerleri paylaşmayın.",
  );
  process.exitCode = 1;
}
