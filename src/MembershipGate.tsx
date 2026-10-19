import { useEffect, useState, type ReactNode } from "react";
import {
  BookOpen,
  ShieldCheck,
  ArrowUpRight,
  RefreshCw,
  LogOut,
  LockKeyhole,
  Check,
  Globe,
} from "lucide-react";
export interface MembershipState {
  phase: string;
  access: boolean;
  member?: { _id: string; name: string; email: string };
  subscription?: {
    planName: string;
    status: string;
    autoRenewCanceled: boolean;
    accessUntil: string | null;
    nextRenewal: string | null;
  };
  leaseUntil?: string;
  message?: string;
}
interface MembershipAPI {
  state(): Promise<MembershipState>;
  login(): Promise<MembershipState>;
  check(): Promise<MembershipState>;
  logout(): Promise<MembershipState>;
  website(): Promise<void>;
  subscribe(callback: (value: MembershipState) => void): () => void;
}
declare global {
  interface Window {
    defterMembership?: MembershipAPI;
  }
}
const signedOut: MembershipState = { phase: "unconfigured", access: false };
const date = (s: string) =>
  new Intl.DateTimeFormat("tr-TR", { dateStyle: "long" }).format(new Date(s));
export default function MembershipGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MembershipState>({
      ...signedOut,
      phase: "checking",
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const api = window.defterMembership;
  useEffect(() => {
    if (!api) {
      setState(signedOut);
      return;
    }
    const remove = api.subscribe(setState);
    api
      .state()
      .then(setState)
      .catch(() =>
        setState({
          phase: "error",
          access: false,
          message: "Üyelik durumu alınamadı.",
        }),
      );
    return remove;
  }, [api]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (
        state.access &&
        (!state.leaseUntil || Date.parse(state.leaseUntil) <= Date.now())
      )
        setState({
          ...state,
          phase: "error",
          access: false,
          message: "Abonelik kontrol süresi doldu. Tekrar kontrol edin.",
        });
    }, 1000);
    return () => clearInterval(timer);
  }, [state]);
  async function action(fn: () => Promise<MembershipState | void>) {
    setBusy(true);
    setError("");
    try {
      const next = await fn();
      if (next) setState(next);
    } catch {
      setError(
        "İşlem tamamlanamadı. İnternet bağlantısını kontrol edip tekrar deneyin.",
      );
    } finally {
      setBusy(false);
    }
  }
  const allowed =
    state.phase === "active" &&
    state.access &&
    !!state.leaseUntil &&
    Date.parse(state.leaseUntil) > Date.now();
  const website = () =>
    api
      ? action(() => api.website())
      : window.open(
          "https://www.deftermini.com/",
          "_blank",
          "noopener,noreferrer",
        );
  if (allowed)
    return (
      <>
        <div className="membership-toolbar">
          <span>
            <ShieldCheck size={14} />
            <b>{state.member?.name || state.member?.email}</b>
            <span className="membership-pill">
              {state.subscription?.planName} ·{" "}
              {state.subscription?.status === "CANCELED" ||
              state.subscription?.autoRenewCanceled
                ? "Yenileme iptal · dönem sonuna kadar aktif"
                : "Aktif"}
            </span>
            <small>
              {state.subscription?.accessUntil
                ? "Erişim bitişi: " + date(state.subscription.accessUntil)
                : state.subscription?.nextRenewal
                  ? "Sonraki dönem: " + date(state.subscription.nextRenewal)
                  : "Abonelik doğrulandı"}
            </small>
          </span>
          <div>
            <button
              disabled={busy}
              onClick={() => action(() => api!.check())}
              aria-label="Aboneliği kontrol et"
            >
              <RefreshCw size={13} />
            </button>
            <button
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    "Çıkış yapılsın mı? Kaydedilmemiş günlük girişleri önce kaydedin.",
                  )
                )
                  void action(() => api!.logout());
              }}
            >
              <LogOut size={13} /> Çıkış yap
            </button>
          </div>
        </div>
        {children}
      </>
    );
  const inactive = state.phase === "inactive";
  return (
    <main className="membership-page">
      <section className="membership-story">
        <div className="membership-brand">
          <BookOpen size={25} />
          <span>defter mini</span>
        </div>
        <div>
          <span className="membership-eyebrow">İŞİNİZİN GÜNLÜK ÖZETİ</span>
          <h1>
            Rakamlar net.
            <br />
            İşiniz kontrolünüzde.
          </h1>
          <p>
            Günlük gelirleriniz, giderleriniz ve işletmenizin tüm resmi. Defter
            Mini ile tek bir yerde.
          </p>
          <ul>
            <li>
              <Check size={17} /> Gelir, gider ve tahmini kâr takibi
            </li>
            <li>
              <Check size={17} /> Anlaşılır raporlar ve canlı grafikler
            </li>
            <li>
              <Check size={17} /> Bilgisayarınızda korunan finans kayıtları
            </li>
          </ul>
        </div>
        <small>
          <ShieldCheck size={15} /> Wix üzerinden güvenli giriş · Şifreniz
          uygulamaya verilmez.
        </small>
      </section>
      <section className="membership-login">
        <div className="membership-lock">
          <LockKeyhole size={25} />
        </div>
        <span className="section-kicker">DEFTER MİNİ ÜYELİĞİ</span>
        <h2>
          {inactive
            ? "Aktif aboneliğiniz bulunmuyor."
            : state.phase === "waiting"
              ? "Tarayıcınızda devam edin."
              : "İşletmenize hoş geldiniz."}
        </h2>
        <p>
          {inactive
            ? "Aylık veya yıllık üyeliğinizle tüm finans araçlarına erişebilirsiniz."
            : state.phase === "unconfigured"
              ? "Üyelik sunucusu henüz yapılandırılmadı. Bağlantı kurulana kadar finans ekranları kilitlidir. Mevcut kayıtlarınız korunuyor."
              : state.message ||
                "Deftermini.com hesabınızla giriş yapın. Üyeliğiniz güvenli sunucuda doğrulandıktan sonra uygulama açılır."}
        </p>
        {state.member && (
          <div className="membership-identity">
            {state.member.name}
            <small>{state.member.email}</small>
          </div>
        )}
        {(error ||
          state.phase === "error" ||
          state.phase === "different-account") && (
          <div className="alert error" role="alert">
            {error || state.message}
          </div>
        )}
        <div className="membership-actions">
          {!inactive && (
            <button
              className="button primary"
              disabled={
                busy ||
                !api ||
                state.phase === "unconfigured" ||
                state.phase === "waiting"
              }
              onClick={() => action(() => api!.login())}
            >
              Wix hesabıyla giriş yap <ArrowUpRight size={16} />
            </button>
          )}
          {inactive && (
            <button className="button primary" onClick={website}>
              Abonelik Satın Al <ArrowUpRight size={16} />
            </button>
          )}
          <button
            className="button secondary"
            disabled={busy || !api || state.phase === "unconfigured"}
            onClick={() => action(() => api!.check())}
          >
            <RefreshCw size={15} /> Tekrar Kontrol Et
          </button>
          {state.member && (
            <button
              className="text-button"
              disabled={busy}
              onClick={() => action(() => api!.logout())}
            >
              <LogOut size={14} /> Çıkış yap / Farklı hesap
            </button>
          )}
          {state.phase === "waiting" && (
            <button
              className="text-button"
              onClick={() => action(() => api!.logout())}
            >
              Girişi iptal et
            </button>
          )}
        </div>
        <div className="membership-plans">
          <div>
            <span>Aylık Üyelik</span>
            <strong>
              119 <small>TL/ay</small>
            </strong>
          </div>
          <div>
            <span>Yıllık Üyelik</span>
            <strong>
              899 <small>TL/yıl</small>
            </strong>
          </div>
        </div>
        <div className="membership-links">
          <button className="text-button" onClick={website}>
            <Globe size={14} /> Hesap oluştur
          </button>
          {!inactive && (
            <button className="text-button" onClick={website}>
              Abonelik satın al <ArrowUpRight size={14} />
            </button>
          )}
        </div>
        <p className="membership-note">
          Giriş ve düzenli abonelik kontrolü için internet gerekir. Finans
          verileri Wix’e gönderilmez; yerel SQLite veritabanınız korunur.
        </p>
      </section>
    </main>
  );
}
