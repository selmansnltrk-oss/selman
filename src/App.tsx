import { useConfirm } from "./ConfirmDialog";
import { useEffect, useState, type ReactNode } from "react";
import {
  BookOpen,
  LayoutDashboard,
  Wallet,
  Settings2,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  CalendarDays,
  Check,
  Download,
  Upload,
  Calculator,
  Save,
  Info,
  Receipt,
  Users,
  Store,
  TrendingUp,
  Search,
  ShieldCheck,
  X,
  Pencil,
  FlaskConical,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { connect, type API } from "./storage";
import { MoneyInput, RateInput } from "./fields";
import { taxProfile, taxLedger, taxTotals } from "./tax";
import {
  TaxSettingsCard,
  DayTaxInputs,
  TaxSummary,
  TaxReport,
  NetResult,
} from "./TaxUI";
import {
  defaults,
  visibleIncomes,
  newDay,
  calculate,
  money,
  humanDate,
  today,
  uid,
  applySettingsToDay,
  settingsSchema,
  type Settings,
  type Day,
  type Employee,
  rangeDays,
  summarize,
} from "./model";
const colors = [
  "#7958ff",
  "#16c5ce",
  "#ffac42",
  "#f45c9b",
  "#3b8cff",
  "#37c993",
];
function Card({
  title,
  icon,
  extra,
  children,
  className = "",
}: {
  title: string;
  icon?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={"card " + className}>
      <div className="card-heading">
        <div className="card-title">
          {icon}
          <h2>{title}</h2>
        </div>
        {extra}
      </div>
      {children}
    </section>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <Receipt size={28} />
      <p>{children}</p>
    </div>
  );
}
function Stat({
  label,
  value,
  kind = "neutral",
  sub,
}: {
  label: string;
  value: number;
  kind?: string;
  sub?: string;
}) {
  return (
    <div className={"stat " + kind}>
      <div className="stat-label">
        {label}
        <span>
          {kind === "positive" ? (
            <TrendingUp size={16} />
          ) : kind === "negative" ? (
            <ArrowDownRight size={16} />
          ) : (
            <ArrowUpRight size={16} />
          )}
        </span>
      </div>
      <strong>{money(value)}</strong>
      <small>{sub}</small>
    </div>
  );
}
function employee(name = ""): Employee {
  return {
    id: uid(),
    name,
    wage: 0,
    bonus: 0,
    insurance: 0,
    other: 0,
    payment: 0,
  };
}
export default function App() {
  const confirm = useConfirm();
  const [api, setApi] = useState<API | null>(null);
  const [settings, setSettings] = useState<Settings>(defaults);
  const [settingsDraft, setSettingsDraft] = useState<Settings>(defaults);
  const [day, setDay] = useState<Day>(newDay(defaults));
  const [days, setDays] = useState<Day[]>([]);
  const [tab, setTab] = useState("İcmal");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [computed, setComputed] = useState<ReturnType<typeof calculate> | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [personName, setPersonName] = useState("");
  const [expenseName, setExpenseName] = useState("");
  const [conflict, setConflict] = useState(false);
  const [from, setFrom] = useState(today().slice(0, 7) + "-01");
  const [to, setTo] = useState(today());
  const [filter, setFilter] = useState({
    from: today().slice(0, 7) + "-01",
    to: today(),
  });
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    connect()
      .then(async (a) => {
        const s = (await a.getSettings()) ?? defaults;
        const d = await a.listDays();
        if (active) {
          setApi(a);
          setSettings(s);
          setSettingsDraft(s);
          setDays(d);
          setDay(d.find((x) => x.date === today()) ?? newDay(s));
        }
      })
      .catch((e) => setError("Veritabanı açılamadı: " + e.message));
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty || settingsDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, settingsDirty]);
  const notify = (s: string) => {
    setNotice(s);
    setError("");
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message.startsWith("[")
            ? "Bilgileri kontrol edin. Boş ad, negatif tutar veya geçersiz oran bulunuyor."
            : e.message
          : "İşlem tamamlanamadı",
      );
    } finally {
      setBusy(false);
    }
  };
  const refresh = async () => {
    if (api) setDays(await api.listDays());
  };
  const change = (d: Day) => {
    setDay(d);
    setDirty(true);
    setComputed(null);
  };
  const updateSettings = (s: Settings) => {
    setSettingsDraft(s);
    setSettingsDirty(true);
  };
  const allowLeave = async () =>
    !dirty ||
    (await confirm(
      "Kaydedilmemiş günlük değişiklikler var. Değişiklikler bırakılsın mı?",
    ));
  const openDay = async (date: string) => {
    if (!(await allowLeave())) return;
    setDay(days.find((d) => d.date === date) ?? newDay(settings, date));
    setDirty(false);
    setComputed(null);
    setTab("İcmal");
  };
  const saveDay = async (overwrite = false) => {
    if (!api) return;
    if (document.querySelector(".money-input.invalid")) {
      setError("Hatalı tutarları düzeltin.");
      return;
    }
    await run(async () => {
      const result = calculate(day);
      const response = await api.saveDay(day, overwrite);
      if (response.conflict) {
        setConflict(true);
        return;
      }
      setComputed(result);
      setConflict(false);
      setDirty(false);
      await refresh();
      notify("Günün kaydı güvenle saklandı.");
    });
  };
  const addPerson = () => {
    if (!personName.trim()) {
      setError("Personel adını girin.");
      return;
    }
    const e = employee(personName.trim());
    change({ ...day, employees: [...day.employees, e] });
    updateSettings({
      ...settingsDraft,
      employees: [...settingsDraft.employees, e],
    });
    setPersonName("");
    notify(
      "Personel eklendi. Sonraki günlerde kullanmak için Ayarlar’ı kaydedin.",
    );
  };
  const addExpense = () => {
    if (!expenseName.trim()) {
      setError("Gider açıklamasını girin.");
      return;
    }
    change({
      ...day,
      expenses: [
        ...day.expenses,
        {
          id: uid(),
          description: expenseName.trim(),
          amount: 0,
          category: "Malzeme",
          invoice: false,
          vat: 0,
          date: day.date,
        },
      ],
    });
    setExpenseName("");
  };
  const loadDemo = () =>
    run(async () => {
      if (!api) return;
      if (dirty || settingsDirty) {
        if (
          !(await confirm(
            "Kaydedilmemiş değişiklikler bırakılıp demo eklensin mi?",
          ))
        )
          return;
      }
      const s: Settings = {
        ...defaults,
        name: "Zeytin Kafe",
        rent: 3000000,
        accounting: 300000,
        fixed: 150000,
        channels: defaults.channels.map((c, i) => ({
          ...c,
          rate: [1800, 1500, 1200, 1000, 0][i],
        })),
        pos: [{ id: "pos", name: "Mağaza POS", rate: 200 }],
        employees: [
          { ...employee("Elif Yılmaz"), wage: 85000, insurance: 15000 },
          { ...employee("Can Demir"), wage: 75000, insurance: 12000 },
        ],
      };
      const existing = new Set(days.map((d) => d.date));
      let count = 0;
      for (let i = 0; i < 7; i++) {
        const dt = new Date();
        dt.setDate(dt.getDate() - i);
        const date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
        if (existing.has(date)) continue;
        const d = newDay(s, date);
        d.incomes = d.incomes.map((c, j) => ({
          ...c,
          amount: [274945, 150000, 75000, 45000, 500000][j] + i * 1730,
        }));
        d.pos[0].amount = 200000;
        d.employees[0].bonus = 10000;
        d.expenses = [
          {
            id: uid(),
            description: "Günlük malzeme alımı",
            amount: 95000 + i * 2100,
            category: "Malzeme",
            invoice: true,
            vat: 1000,
            date,
          },
          {
            id: uid(),
            description: "Temizlik malzemeleri",
            amount: 15000,
            category: "Temizlik",
            invoice: false,
            vat: 0,
            date,
          },
        ];
        await api.saveDay(d);
        count++;
      }
      if (!days.length) {
        await api.saveSettings(s);
        setSettings(s);
        setSettingsDraft(s);
      }
      const list = await api.listDays();
      setDays(list);
      setDay(list.find((d) => d.date === today()) ?? newDay(settings));
      setComputed(null);
      setDirty(false);
      if (!days.length) setSettingsDirty(false);
      notify(`${count} örnek gün eklendi. Mevcut kayıtlar korundu.`);
    });
  const filtered = rangeDays(days, filter.from, filter.to);
  const summary = summarize(filtered);
  const ledger = taxLedger(days);
  const byDate = new Map(ledger.map((r) => [r.date, r]));
  const periodTax = taxTotals(ledger, filter.from, filter.to);
  const hasFinal = periodTax.after !== null;
  const netProfit = filtered.reduce(
    (a, d) => a + Math.max(0, byDate.get(d.date)?.after ?? 0),
    0,
  );
  const netLoss = filtered.reduce(
    (a, d) => a + Math.max(0, -(byDate.get(d.date)?.after ?? 0)),
    0,
  );

  const selectedDay = filtered.find((d) => d.date === selected);
  const distribution = new Map<string, number>();
  for (const d of filtered)
    for (const i of d.incomes)
      distribution.set(i.name, (distribution.get(i.name) ?? 0) + i.amount);
  const pie = [...distribution]
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value: value / 100 }));
  const expenseDist = [
    ["Platform komisyonu", "platform"],
    ["POS komisyonu", "pos"],
    ["Personel", "personnel"],
    ["Diğer giderler", "expenses"],
    ["Sabit giderler", "fixed"],
    ["Kurye", "courier"],
    ["Diğer kesintiler", "other"],
  ]
    .map(([name, key]) => ({
      name,
      value:
        filtered.reduce(
          (a, d) =>
            a + Number(calculate(d)[key as keyof ReturnType<typeof calculate>]),
          0,
        ) / 100,
    }))
    .filter((x) => x.value > 0);
  const applyPreset = (v: string) => {
    const now = new Date(),
      start = new Date(now),
      end = new Date(now);
    if (v === "week") start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    if (v === "month") start.setDate(1);
    if (v === "last") {
      start.setMonth(start.getMonth() - 1, 1);
      end.setDate(0);
    }
    if (v === "year") {
      start.setMonth(0, 1);
    }
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const f = v === "all" ? "" : fmt(start),
      t = v === "all" ? "" : fmt(end);
    setFrom(f);
    setTo(t);
    setFilter({ from: f, to: t });
    setSelected(null);
  };
  const title =
    tab === "İcmal"
      ? "Her gün, daha net bir tablo."
      : tab === "Kasa"
        ? "İşinizin büyük resmini görün."
        : "İşletmenize göre, size özel.";
  return (
    <div className="app">
      <header>
        <div className="header-inner">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setTab("İcmal");
            }}
          >
            <div className="brand-icon">
              <BookOpen size={23} />
            </div>
            <span>
              defter<span className="brand-light">mini</span>
              <small>İŞİNİZİN GÜNLÜK ÖZETİ</small>
            </span>
          </a>
          <nav>
            {[
              ["İcmal", LayoutDashboard],
              ["Kasa", Wallet],
              ["Ayarlar", Settings2],
            ].map(([name, Icon]) => (
              <button
                key={String(name)}
                className={tab === name ? "active" : ""}
                onClick={() => setTab(String(name))}
              >
                <Icon size={17} />
                {String(name)}
              </button>
            ))}
          </nav>
          <div className="business">
            <span className="business-avatar">
              {settings.name.slice(0, 1).toUpperCase()}
            </span>
            <span>
              {settings.name}
              <small>{settings.type}</small>
            </span>
            <span className="local-dot" title="Yerel veritabanı" />
          </div>
        </div>
      </header>
      <main>
        <div className="page-intro">
          <div>
            <div className="eyebrow">İŞİNİZ KONTROLÜNÜZDE</div>
            <h1>{title}</h1>
            <p>
              {tab === "İcmal"
                ? "Gelirlerinizi ve giderlerinizi ekleyin, günün sonucunu birlikte görelim."
                : tab === "Kasa"
                  ? "Geçmiş kayıtlarınız, finansal özetleriniz ve tüm detaylar tek yerde."
                  : "Bir kez tanımlayın, günlük takibiniz kolaylaşsın."}
            </p>
          </div>
          <div className="intro-actions">
            <span className="offline">
              <ShieldCheck size={14} /> Verileriniz bu cihazda
            </span>
            <button
              className="button secondary small"
              onClick={loadDemo}
              disabled={busy || !api}
            >
              <FlaskConical size={14} /> Demoyu dene
            </button>
          </div>
        </div>
        {error && (
          <div className="alert error" role="alert">
            <Info size={18} />
            <span>{error}</span>
            <button onClick={() => setError("")} aria-label="Uyarıyı kapat">
              <X size={16} />
            </button>
          </div>
        )}
        {notice && (
          <div className="toast" role="status">
            <Check size={17} />
            {notice}
          </div>
        )}
        {!api && (
          <div className="alert">
            <Info size={18} /> Veritabanı hazırlanıyor…
          </div>
        )}
        {tab === "İcmal" && (
          <>
            <div className="day-toolbar">
              <div>
                <span className="section-kicker">GÜNLÜK İCMAL</span>
                <span className={"badge " + (dirty ? "amber" : "")}>
                  {dirty
                    ? "Kaydedilmemiş değişiklikler"
                    : days.some((d) => d.date === day.date)
                      ? "Kayıtlı gün"
                      : "Yeni kayıt"}
                </span>
              </div>
              <div className="date-control">
                <button
                  aria-label="Önceki gün"
                  onClick={async () => {
                    const d = new Date(day.date + "T12:00:00");
                    d.setDate(d.getDate() - 1);
                    openDay(
                      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
                    );
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
                <CalendarDays size={16} />
                <input
                  aria-label="İcmal tarihi"
                  type="date"
                  value={day.date}
                  onChange={(e) => {
                    if (e.target.value) openDay(e.target.value);
                  }}
                />
                <button
                  aria-label="Sonraki gün"
                  onClick={async () => {
                    const d = new Date(day.date + "T12:00:00");
                    d.setDate(d.getDate() + 1);
                    openDay(
                      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
                    );
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div className="settings-apply">
              <p>Güne kaydedilen komisyonlar ve sabit giderler kullanılır.</p>
              <button
                className="button secondary small"
                onClick={async () => {
                  if (
                    await confirm(
                      "Güncel komisyonlar, sabit giderler ve vergi profili bu güne uygulansın mı? Girilen tutarlar korunur.",
                    )
                  ) {
                    change(applySettingsToDay(day, settings));
                    notify(
                      "Güncel ayarlar güne uygulandı. Hesaplayıp kaydedebilirsiniz.",
                    );
                  }
                }}
              >
                Güncel ayarları uygula
              </button>
            </div>
            <div className="entry-grid">
              <Card
                title="Gelirler"
                icon={
                  <div className="icon-tile green">
                    <ArrowDownRight size={19} />
                  </div>
                }
                extra={<span className="muted tiny">01</span>}
              >
                <p className="card-description">
                  Satış kanallarına göre günlük gelirleriniz
                </p>
                <div className="incomes">
                  {visibleIncomes(day).map((inc, index) => (
                    <div className="income-row" key={inc.id}>
                      <div className="income-label">
                        <span className={"channel-logo channel-" + index}>
                          {inc.name.slice(0, 1)}
                        </span>
                        <div>
                          <label htmlFor={"mode-" + inc.id}>{inc.name}</label>
                          <select
                            id={"mode-" + inc.id}
                            value={inc.mode}
                            onChange={(e) =>
                              change({
                                ...day,
                                incomes: day.incomes.map((i) =>
                                  i.id === inc.id
                                    ? {
                                        ...i,
                                        mode: e.target.value as "gross" | "net",
                                      }
                                    : i,
                                ),
                              })
                            }
                          >
                            <option value="gross">
                              Brüt satış · %{inc.rate / 100}
                            </option>
                            <option value="net">
                              Net tahsilat · kesinti uygulanmaz
                            </option>
                          </select>
                        </div>
                      </div>
                      <MoneyInput
                        label={inc.name + " geliri"}
                        value={inc.amount}
                        onChange={(amount) =>
                          change({
                            ...day,
                            incomes: day.incomes.map((i) =>
                              i.id === inc.id ? { ...i, amount } : i,
                            ),
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
                <div className="sub-total">
                  <span>Girilen satış toplamı</span>
                  <b>{money(day.incomes.reduce((a, i) => a + i.amount, 0))}</b>
                </div>
                <div className="divider" />
                <h3 className="minor-title">
                  POS tahsilatları <span>Satışa eklenmez</span>
                </h3>
                <p className="helper">
                  Yukarıdaki satışların kartla tahsil edilen kısmı. Platformun
                  komisyonuna POS kesintisi zaten dahilse buraya tekrar
                  girmeyin.
                </p>
                {day.pos.map((p) => (
                  <div className="pos-row" key={p.id}>
                    <div>
                      <span>{p.name}</span>
                      <small>%{p.rate / 100} komisyon</small>
                    </div>
                    <MoneyInput
                      label={p.name + " tahsilat"}
                      value={p.amount}
                      onChange={(amount) =>
                        change({
                          ...day,
                          pos: day.pos.map((x) =>
                            x.id === p.id ? { ...x, amount } : x,
                          ),
                        })
                      }
                    />
                  </div>
                ))}
                <button
                  className="text-button"
                  onClick={() => setTab("Ayarlar")}
                >
                  <Settings2 size={14} /> Satış kanallarını düzenle
                </button>
              </Card>
              <Card
                title="Personel"
                icon={
                  <div className="icon-tile purple">
                    <Users size={19} />
                  </div>
                }
                extra={
                  <span className="count">{day.employees.length} kişi</span>
                }
              >
                <p className="card-description">
                  Günün emek ve personel maliyetleri
                </p>
                <div className="add-line">
                  <input
                    aria-label="Yeni personel adı"
                    placeholder="Personel adı"
                    value={personName}
                    onChange={(e) => setPersonName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addPerson();
                    }}
                  />
                  <button
                    className="square-button"
                    aria-label="Personel ekle"
                    onClick={addPerson}
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <div className="personnel-list">
                  {!day.employees.length && (
                    <Empty>
                      Henüz personel eklenmedi.
                      <br />
                      Ekibinizi bir kez tanımlayın.
                    </Empty>
                  )}
                  {day.employees.map((e, i) => (
                    <div className="employee" key={e.id}>
                      <div className="employee-head">
                        <span className="avatar">
                          {e.name
                            .split(" ")
                            .map((s) => s[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <input
                          aria-label="Personel adı"
                          value={e.name}
                          onChange={(ev) =>
                            change({
                              ...day,
                              employees: day.employees.map((x) =>
                                x.id === e.id
                                  ? { ...x, name: ev.target.value }
                                  : x,
                              ),
                            })
                          }
                        />
                        <button
                          className="icon-button danger"
                          aria-label={e.name + " sil"}
                          onClick={async () => {
                            if (
                              await confirm(
                                "Personel bu günlük kayıttan çıkarılsın mı?",
                              )
                            )
                              change({
                                ...day,
                                employees: day.employees.filter(
                                  (x) => x.id !== e.id,
                                ),
                              });
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="employee-fields">
                        {[
                          ["Günlük ücret", "wage"],
                          ["Prim", "bonus"],
                          ["Sigorta", "insurance"],
                          ["Diğer maliyet", "other"],
                        ].map(([label, key]) => (
                          <label key={key}>
                            {label}
                            <MoneyInput
                              label={e.name + " " + label}
                              value={e[key as keyof Employee] as number}
                              onChange={(amount) =>
                                change({
                                  ...day,
                                  employees: day.employees.map((x, j) =>
                                    j === i ? { ...x, [key]: amount } : x,
                                  ),
                                })
                              }
                            />
                          </label>
                        ))}
                      </div>
                      <details>
                        <summary>Nakit ödeme / avans</summary>
                        <MoneyInput
                          label={e.name + " nakit ödeme"}
                          value={e.payment}
                          onChange={(payment) =>
                            change({
                              ...day,
                              employees: day.employees.map((x) =>
                                x.id === e.id ? { ...x, payment } : x,
                              ),
                            })
                          }
                        />
                        <small className="helper">
                          Bilgi amaçlıdır; maliyete tekrar eklenmez. Tam kasa
                          bakiyesi bu sürümde hesaplanmaz.
                        </small>
                      </details>
                    </div>
                  ))}
                </div>
                <div className="sub-total">
                  <span>Personel maliyeti</span>
                  <b>
                    {money(
                      day.employees.reduce(
                        (a, e) => a + e.wage + e.bonus + e.insurance + e.other,
                        0,
                      ),
                    )}
                  </b>
                </div>
              </Card>
              <Card
                title="Giderler"
                icon={
                  <div className="icon-tile orange">
                    <Receipt size={19} />
                  </div>
                }
                extra={
                  <span className="count">{day.expenses.length} kalem</span>
                }
              >
                <p className="card-description">
                  Küçük harcamalar, eksiksiz bir hesap
                </p>
                <div className="add-line">
                  <input
                    aria-label="Yeni gider açıklaması"
                    placeholder="Örn. malzeme, elektrik, temizlik"
                    value={expenseName}
                    onChange={(e) => setExpenseName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addExpense();
                    }}
                  />
                  <button
                    className="square-button"
                    aria-label="Gider ekle"
                    onClick={addExpense}
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <div className="expenses-list">
                  {!day.expenses.length && (
                    <Empty>
                      Bugün için gider eklenmedi.
                      <br />
                      Harcamalarınızı buradan ekleyin.
                    </Empty>
                  )}
                  {day.expenses.map((e) => (
                    <div className="expense" key={e.id}>
                      <div className="expense-head">
                        <input
                          aria-label="Gider açıklaması"
                          value={e.description}
                          onChange={(ev) =>
                            change({
                              ...day,
                              expenses: day.expenses.map((x) =>
                                x.id === e.id
                                  ? { ...x, description: ev.target.value }
                                  : x,
                              ),
                            })
                          }
                        />
                        <button
                          className="icon-button danger"
                          aria-label={e.description + " sil"}
                          onClick={async () => {
                            if (await confirm("Bu gider silinsin mi?"))
                              change({
                                ...day,
                                expenses: day.expenses.filter(
                                  (x) => x.id !== e.id,
                                ),
                              });
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="expense-main">
                        <select
                          aria-label="Gider kategorisi"
                          value={e.category}
                          onChange={(ev) =>
                            change({
                              ...day,
                              expenses: day.expenses.map((x) =>
                                x.id === e.id
                                  ? { ...x, category: ev.target.value }
                                  : x,
                              ),
                            })
                          }
                        >
                          {[
                            "Malzeme",
                            "Elektrik",
                            "Su",
                            "Doğalgaz",
                            "Temizlik",
                            "Ulaşım",
                            "Stok / ürün maliyeti",
                            "Diğer",
                          ].map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                        <MoneyInput
                          label={e.description + " tutarı"}
                          value={e.amount}
                          onChange={(amount) =>
                            change({
                              ...day,
                              expenses: day.expenses.map((x) =>
                                x.id === e.id ? { ...x, amount } : x,
                              ),
                            })
                          }
                        />
                      </div>
                      <div className="expense-footer">
                        <label>
                          <input
                            type="checkbox"
                            checked={e.invoice}
                            onChange={(ev) =>
                              change({
                                ...day,
                                expenses: day.expenses.map((x) =>
                                  x.id === e.id
                                    ? {
                                        ...x,
                                        invoice: ev.target.checked,
                                        vat: ev.target.checked ? x.vat : 0,
                                      }
                                    : x,
                                ),
                              })
                            }
                          />{" "}
                          Fiş / fatura var
                        </label>
                        {e.invoice && (
                          <div className="vat">
                            KDV{" "}
                            <RateInput
                              value={e.vat}
                              onChange={(vat) =>
                                change({
                                  ...day,
                                  expenses: day.expenses.map((x) =>
                                    x.id === e.id ? { ...x, vat } : x,
                                  ),
                                })
                              }
                            />
                          </div>
                        )}
                      </div>
                      {e.invoice && (
                        <label className="tax-check">
                          <input
                            type="checkbox"
                            checked={e.vatDeductible ?? false}
                            onChange={(ev) =>
                              change({
                                ...day,
                                expenses: day.expenses.map((x) =>
                                  x.id === e.id
                                    ? { ...x, vatDeductible: ev.target.checked }
                                    : x,
                                ),
                              })
                            }
                          />{" "}
                          KDV indirilebilir (belge ve işlem uygun)
                        </label>
                      )}
                      <input
                        className="expense-date"
                        aria-label="Gider tarihi"
                        type="date"
                        value={e.date}
                        onChange={(ev) =>
                          change({
                            ...day,
                            expenses: day.expenses.map((x) =>
                              x.id === e.id
                                ? { ...x, date: ev.target.value }
                                : x,
                            ),
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
                <div className="sub-total">
                  <span>Günlük diğer giderler</span>
                  <b>{money(day.expenses.reduce((a, e) => a + e.amount, 0))}</b>
                </div>
                <div className="tip">
                  <Info size={15} />
                  <span>
                    Tutarları KDV dahil girin. Vergi modülünde KDV indirimi için
                    belge ve ayrıca “KDV indirilebilir” onayı gerekir.
                  </span>
                </div>
              </Card>
            </div>
            <div className="fixed-strip">
              <div>
                <div className="icon-tile">
                  <Store size={18} />
                </div>
                <span>
                  Günlük sabit gider payı
                  <small>
                    Kira, muhasebe ve diğer aylık giderlerin günlük payı
                  </small>
                </span>
              </div>
              <b>{money(day.fixed)}</b>
              <button className="text-button" onClick={() => setTab("Ayarlar")}>
                Ayarlar <ChevronRight size={14} />
              </button>
            </div>
            {day.fixedDetails && (
              <div className="fixed-detail">
                Kira: {money(day.fixedDetails.rent)} · Muhasebe:{" "}
                {money(day.fixedDetails.accounting)} · Diğer:{" "}
                {money(day.fixedDetails.other)} · Bölünen gün:{" "}
                {day.fixedDetails.days}
              </div>
            )}
            <DayTaxInputs day={day} onChange={change} />
            <div className="note-line">
              <label htmlFor="note">Günün notu</label>
              <input
                id="note"
                placeholder="Bugüne dair kısa bir not ekleyin (isteğe bağlı)"
                value={day.note}
                maxLength={2000}
                onChange={(e) => change({ ...day, note: e.target.value })}
              />
            </div>
            <section className="result-panel">
              <div className="result-heading">
                <div>
                  <span className="section-kicker">GÜNÜN SONUCU</span>
                  <h2>Rakamlar sizin için konuşsun.</h2>
                </div>
                <div className="button-row">
                  <button
                    className="button secondary"
                    disabled={busy || !api}
                    onClick={async () => {
                      if (document.querySelector(".money-input.invalid")) {
                        setError("Hatalı tutarları düzeltin.");
                        return;
                      }
                      try {
                        setComputed(calculate(day));
                        setError("");
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    <Calculator size={16} /> Hesapla
                  </button>
                  <button
                    className="button primary"
                    disabled={busy || !api}
                    onClick={() => saveDay()}
                  >
                    <Save size={16} />
                    {busy ? "Kaydediliyor…" : "Günü kaydet"}
                  </button>
                </div>
              </div>
              {computed ? (
                <>
                  <NetResult
                    {...(() => {
                      const r = taxLedger([
                        ...days.filter((d) => d.date !== day.date),
                        day,
                      ]).find((r) => r.date === day.date)!;
                      return {
                        gross: r.grossRevenue ?? computed.gross,
                        income: r.netRevenue,
                        after: r.after,
                        before: r.before,
                        reserve: r.reserve,
                      };
                    })()}
                  />
                  <div className="result-stats">
                    <Stat
                      label={
                        computed.hasNet
                          ? "Girilen satış / tahsilat"
                          : "Günlük brüt ciro"
                      }
                      value={computed.gross}
                      sub="Satış kanallarının toplamı"
                    />
                    <Stat
                      label="Hesaplanan gider"
                      value={computed.total}
                      kind="negative"
                      sub="Komisyonlar ve tüm maliyetler"
                    />
                    <Stat
                      label={
                        day.tax?.enabled
                          ? "KDV dahil ara sonuç"
                          : "Tahmini işletme sonucu"
                      }
                      value={computed.result}
                      kind={computed.result >= 0 ? "positive" : "negative"}
                      sub={
                        day.tax?.enabled
                          ? "KDV ve vergi analizi aşağıdadır"
                          : computed.result >= 0
                            ? "Bugün artıdasınız"
                            : "Bugün giderler gelirleri aştı"
                      }
                    />
                  </div>
                  <div className="breakdown">
                    {[
                      ["Platform", computed.platform],
                      ["POS", computed.pos],
                      ["Personel", computed.personnel],
                      ["Günlük gider", computed.expenses],
                      ["Sabit pay", computed.fixed],
                      ["Kurye", computed.courier],
                      ["Diğer kesinti", computed.other],
                      ["Ek SGK / Bağ-Kur", day.taxCosts?.contributions ?? 0],
                      ["Ek kira stopajı", day.taxCosts?.withholding ?? 0],
                    ].map(([label, n]) => (
                      <span key={String(label)}>
                        {label}
                        <b>{money(Number(n))}</b>
                      </span>
                    ))}
                  </div>
                  {day.tax?.enabled ? (
                    <TaxSummary
                      result={taxLedger([
                        ...days.filter((d) => d.date !== day.date),
                        day,
                      ]).find((r) => r.date === day.date)!}
                    />
                  ) : (
                    <p className="helper">
                      Vergi analizi kapalı. Ayarlar bölümünden
                      etkinleştirebilirsiniz.
                    </p>
                  )}
                  {computed.hasNet && (
                    <p className="helper">
                      Net tahsilat girilen kanallar için brüt ciro bilinmez;
                      gösterilen toplam brüt satış ile net tahsilatların
                      karışımıdır. Bu kanallarda platform komisyonu tekrar
                      düşülmemiştir.
                    </p>
                  )}
                </>
              ) : (
                <div className="result-placeholder">
                  <Calculator size={22} />
                  <span>
                    Girişleriniz hazır olduğunda <b>Hesapla</b> butonuna
                    tıklayın.
                  </span>
                </div>
              )}
              <p className="disclaimer">
                <Info size={14} /> Bu sonuç tahminidir. Stok / satılan ürün
                maliyeti ve vergiler eksikse gerçek net kârı göstermez.
              </p>
            </section>
          </>
        )}
        {tab === "Kasa" && (
          <>
            <div className="report-toolbar">
              <div className="filter-dates">
                <CalendarDays size={16} />
                <input
                  aria-label="Başlangıç tarihi"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
                <span>—</span>
                <input
                  aria-label="Bitiş tarihi"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
                <button
                  className="button primary small"
                  onClick={async () => {
                    if (from && to && from > to) {
                      setError("Başlangıç tarihi bitişten sonra olamaz.");
                      return;
                    }
                    setFilter({ from, to });
                    setSelected(null);
                  }}
                >
                  <Search size={14} /> Filtrele
                </button>
              </div>
              <select
                aria-label="Hazır tarih aralığı"
                defaultValue="month"
                onChange={(e) => applyPreset(e.target.value)}
              >
                <option value="today">Bugün</option>
                <option value="week">Bu hafta</option>
                <option value="month">Bu ay</option>
                <option value="last">Geçen ay</option>
                <option value="year">Bu yıl</option>
                <option value="all">Tüm zamanlar</option>
              </select>
            </div>
            <TaxReport ledger={ledger} from={filter.from} to={filter.to} />
            <div className="report-stats">
              <Stat
                label="Toplam ciro / tahsilat"
                value={summary.gross}
                sub={`${filtered.length} günlük kayıt`}
              />
              <Stat
                label="Toplam hesaplanan gider"
                value={summary.total}
                kind="negative"
                sub="Tüm maliyet ve kesintiler"
              />
              <Stat
                label={
                  hasFinal
                    ? "Vergi sonrası kârlı günler"
                    : "KDV dahil kârlı günler (ara)"
                }
                value={hasFinal ? netProfit : summary.profit}
                kind="positive"
              />
              <Stat
                label={
                  hasFinal
                    ? "Vergi sonrası zararlı günler"
                    : "KDV dahil zararlı günler (ara)"
                }
                value={hasFinal ? netLoss : summary.loss}
                kind="negative"
              />
              <Stat
                label={hasFinal ? "Dönem net sonucu" : "KDV dahil ara sonuç"}
                value={periodTax.after ?? summary.result}
                kind={
                  (periodTax.after ?? summary.result) >= 0
                    ? "positive"
                    : "negative"
                }
              />
            </div>

            <div className="report-grid">
              <Card
                title="Günlük kayıtlar"
                icon={<CalendarDays size={18} />}
                extra={<span className="count">{filtered.length} gün</span>}
              >
                <div className="record-list">
                  {!filtered.length && (
                    <Empty>Bu tarih aralığında kayıt yok.</Empty>
                  )}
                  {filtered.map((d) => {
                    const c = calculate(d);
                    const final = byDate.get(d.date)?.after;
                    const shown = final ?? c.result;
                    return (
                      <button
                        key={d.date}
                        className={
                          "record " + (selected === d.date ? "selected" : "")
                        }
                        onClick={() => setSelected(d.date)}
                      >
                        <span>
                          <b>{humanDate(d.date)}</b>
                          <small>
                            {d.expenses.length} gider · {d.employees.length}{" "}
                            personel ·{" "}
                            {final === null || final === undefined
                              ? "Vergi hariç ara sonuç"
                              : "Tüm gider ve vergiler sonrası"}
                          </small>
                        </span>
                        <span
                          className={shown >= 0 ? "text-green" : "text-red"}
                        >
                          {money(shown)}
                          <ChevronRight size={14} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Card>
              <div className="charts">
                <Card
                  title="Gelir dağılımı"
                  extra={<span className="muted tiny">KANALLARA GÖRE</span>}
                >
                  {pie.length ? (
                    <>
                      <div className="donut">
                        <ResponsiveContainer width="100%" height={215}>
                          <PieChart>
                            <Pie
                              isAnimationActive={false}
                              data={pie}
                              dataKey="value"
                              innerRadius={68}
                              outerRadius={94}
                              paddingAngle={3}
                              stroke="none"
                            >
                              {pie.map((_, i) => (
                                <Cell
                                  key={i}
                                  fill={colors[i % colors.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(v) => money(Number(v) * 100)}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="donut-center">
                          <small>Toplam gelir</small>
                          <b>{money(summary.gross)}</b>
                        </div>
                      </div>
                      <div className="legend">
                        {pie.map((p, i) => (
                          <div key={p.name}>
                            <span
                              style={{ background: colors[i % colors.length] }}
                            />
                            {p.name}
                            <b>{money(p.value * 100)}</b>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <Empty>Grafik için gelir kaydı ekleyin.</Empty>
                  )}
                </Card>
                <Card title="Gider dağılımı">
                  {expenseDist.length ? (
                    <>
                      <ResponsiveContainer width="100%" height={190}>
                        <PieChart>
                          <Pie
                            isAnimationActive={false}
                            data={expenseDist}
                            dataKey="value"
                            outerRadius={80}
                            stroke="none"
                          >
                            {expenseDist.map((_, i) => (
                              <Cell key={i} fill={colors[i % colors.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v) => money(Number(v) * 100)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="legend">
                        {expenseDist.map((p, i) => (
                          <div key={p.name}>
                            <span
                              style={{ background: colors[i % colors.length] }}
                            />
                            {p.name}
                            <b>{money(p.value * 100)}</b>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <Empty>Henüz gider verisi yok.</Empty>
                  )}
                </Card>
              </div>
            </div>
            <Card
              title="Günlük sonuç eğilimi"
              icon={<TrendingUp size={18} />}
              className="trend-card"
            >
              {filtered.length ? (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart
                    data={[...filtered].reverse().map((d) => ({
                      date: d.date.slice(5).split("-").reverse().join("."),
                      sonuç: hasFinal
                        ? byDate.get(d.date)!.after! / 100
                        : calculate(d).result / 100,
                    }))}
                  >
                    <defs>
                      <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="#7958ff"
                          stopOpacity={0.2}
                        />
                        <stop
                          offset="100%"
                          stopColor="#7958ff"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="4 4"
                      vertical={false}
                      stroke="#edf0ed"
                    />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      tickFormatter={(v) =>
                        new Intl.NumberFormat("tr-TR", {
                          notation: "compact",
                        }).format(v)
                      }
                    />
                    <Tooltip formatter={(v) => money(Number(v) * 100)} />
                    <Area
                      isAnimationActive={false}
                      type="monotone"
                      dataKey="sonuç"
                      name={
                        hasFinal
                          ? "Tüm gider ve vergiler sonrası"
                          : "KDV dahil ara sonuç"
                      }
                      stroke="#7958ff"
                      fill="url(#area)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <Empty>Kaydedilen günlerin eğilimi burada görünecek.</Empty>
              )}
            </Card>
            {selectedDay && (
              <Card
                title={humanDate(selectedDay.date) + " · Günün ayrıntısı"}
                extra={
                  <div className="button-row">
                    <button
                      className="button secondary small"
                      onClick={() => openDay(selectedDay.date)}
                    >
                      <Pencil size={14} /> Düzenle
                    </button>
                    <button
                      className="button danger small"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          if (api && (await api.deleteDay(selectedDay.date))) {
                            await refresh();
                            setSelected(null);
                            if (day.date === selectedDay.date) {
                              setDay(newDay(settings, day.date));
                              setDirty(false);
                              setComputed(null);
                            }
                            notify("Günlük kayıt silindi.");
                          }
                        })
                      }
                    >
                      <Trash2 size={14} /> Sil
                    </button>
                  </div>
                }
                className="detail-card"
              >
                <TaxSummary
                  result={taxLedger(days).find(
                    (r) => r.date === selectedDay.date,
                  )!}
                />
                <div className="day-detail">
                  <div>
                    <h3>Gelirler</h3>
                    {selectedDay.incomes.map((i) => (
                      <div key={i.id}>
                        <span>
                          {i.name}{" "}
                          <small>({i.mode === "net" ? "net" : "brüt"})</small>
                        </span>
                        <b>{money(i.amount)}</b>
                      </div>
                    ))}
                    <h3>POS tahsilatı (gelire eklenmez)</h3>
                    {selectedDay.pos.map((p) => (
                      <div key={p.id}>
                        <span>{p.name}</span>
                        <b>{money(p.amount)}</b>
                      </div>
                    ))}
                  </div>
                  <div>
                    <h3>Personel maliyetleri</h3>
                    {selectedDay.employees.map((e) => (
                      <div key={e.id}>
                        <span>{e.name}</span>
                        <b>{money(e.wage + e.bonus + e.insurance + e.other)}</b>
                      </div>
                    ))}
                    <h3>Giderler</h3>
                    {selectedDay.expenses.map((e) => (
                      <div key={e.id}>
                        <span>
                          {e.description}
                          <small>
                            {e.category} · {humanDate(e.date)} ·{" "}
                            {e.invoice
                              ? "Faturalı · KDV %" + e.vat / 100
                              : "Belgesiz"}
                          </small>
                        </span>
                        <b>{money(e.amount)}</b>
                      </div>
                    ))}
                  </div>
                  <div>
                    <h3>Hesap özeti</h3>
                    {Object.entries({
                      Ciro: calculate(selectedDay).gross,
                      "Platform komisyonu": calculate(selectedDay).platform,
                      "POS komisyonu": calculate(selectedDay).pos,
                      "Sabit pay": selectedDay.fixed,
                      "Kurye kesintisi": calculate(selectedDay).courier,
                      "Diğer kesintiler": calculate(selectedDay).other,
                      "Personel nakit ödemesi (bilgi)":
                        calculate(selectedDay).payments,
                      "Toplam gider": calculate(selectedDay).total,
                      "Tahmini sonuç": calculate(selectedDay).result,
                    }).map(([k, v]) => (
                      <div key={k}>
                        <span>{k}</span>
                        <b>{money(v)}</b>
                      </div>
                    ))}
                  </div>
                </div>
                {selectedDay.note && (
                  <p className="saved-note">Not: {selectedDay.note}</p>
                )}
              </Card>
            )}
            <p className="disclaimer">
              <Info size={14} /> Rapor tahmini işletme sonucudur; açılış
              bakiyesi ve tahsilat vadeleri izlenmediği için gerçek kasa
              bakiyesi değildir. Net tahsilat girilen günlerde brüt ciro tam
              bilinmez.
            </p>
          </>
        )}
        {tab === "Ayarlar" && (
          <>
            <div className="settings-heading">
              <span className="section-kicker">İŞLETME AYARLARI</span>
              {settingsDirty && (
                <span className="badge amber">Kaydedilmemiş değişiklikler</span>
              )}
            </div>
            <div className="settings-grid">
              <Card title="İşletme bilgileri" icon={<Store size={18} />}>
                <div className="form-grid">
                  <label>
                    İşletme adı
                    <input
                      value={settingsDraft.name}
                      onChange={(e) =>
                        updateSettings({
                          ...settingsDraft,
                          name: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    İşletme türü
                    <select
                      aria-label="İşletme türü"
                      value={settingsDraft.type}
                      onChange={(e) =>
                        updateSettings({
                          ...settingsDraft,
                          type: e.target.value,
                        })
                      }
                    >
                      {[
                        "Restoran / Kafe",
                        "Kafe / Restoran",
                        "Market",
                        "Berber / Kuaför",
                        "Mağaza",
                        "Diğer",
                      ].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Şirket tipi
                    <select
                      aria-label="Şirket tipi"
                      value={settingsDraft.company}
                      onChange={(e) =>
                        updateSettings({
                          ...settingsDraft,
                          company: e.target.value,
                          tax: {
                            ...(settingsDraft.tax ??
                              taxProfile(e.target.value)),
                            method: taxProfile(e.target.value).method,
                            confirmed: false,
                          },
                        })
                      }
                    >
                      {[
                        "Şahıs",
                        "Limited",
                        "Anonim",
                        "Adi Ortaklık",
                        "Diğer",
                      ].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    İşletme adresi <span className="muted">(isteğe bağlı)</span>
                    <input
                      value={settingsDraft.address}
                      onChange={(e) =>
                        updateSettings({
                          ...settingsDraft,
                          address: e.target.value,
                        })
                      }
                    />
                  </label>
                </div>
              </Card>
              <Card title="Aylık sabit giderler" icon={<Receipt size={18} />}>
                <label className="basis-select">
                  Günlük dağıtım yöntemi
                  <select
                    aria-label="Sabit gider gün esası"
                    value={settingsDraft.fixedBasis ?? "calendar"}
                    onChange={(e) =>
                      updateSettings({
                        ...settingsDraft,
                        fixedBasis: e.target.value as "calendar" | "30",
                      })
                    }
                  >
                    <option value="calendar">Ayın gerçek gün sayısı</option>
                    <option value="30">Her ay 30 gün</option>
                  </select>
                </label>
                <div className="form-grid">
                  {[
                    ["Aylık kira", "rent"],
                    ["Muhasebe ücreti", "accounting"],
                    ["Diğer sabit giderler", "fixed"],
                  ].map(([label, key]) => (
                    <label key={key}>
                      {label}
                      <MoneyInput
                        value={
                          settingsDraft[key as "rent" | "accounting" | "fixed"]
                        }
                        onChange={(amount) =>
                          updateSettings({ ...settingsDraft, [key]: amount })
                        }
                      />
                    </label>
                  ))}
                </div>
                <div className="tip">
                  <Info size={16} />
                  <span>
                    İlgili ayın gerçek gün sayısına bölünür. Kaydedilmiş geçmiş
                    günlerin maliyetleri korunur.
                  </span>
                </div>
              </Card>
              <TaxSettingsCard
                company={settingsDraft.company}
                value={settingsDraft.tax ?? taxProfile(settingsDraft.company)}
                onChange={(tax) => updateSettings({ ...settingsDraft, tax })}
              />
              <Card
                title="Satış kanalları"
                icon={<ArrowDownRight size={18} />}
                extra={
                  <button
                    className="text-button"
                    onClick={() =>
                      updateSettings({
                        ...settingsDraft,
                        channels: [
                          ...settingsDraft.channels,
                          { id: uid(), name: "Yeni kanal", rate: 0 },
                        ],
                      })
                    }
                  >
                    <Plus size={15} /> Kanal ekle
                  </button>
                }
              >
                <p className="card-description">
                  Brüt satış üzerinden uygulanacak komisyonlar
                </p>
                {settingsDraft.channels.map((c) => (
                  <div className="config-row" key={c.id}>
                    <input
                      aria-label="Kanal adı"
                      value={c.name}
                      onChange={(e) =>
                        updateSettings({
                          ...settingsDraft,
                          channels: settingsDraft.channels.map((x) =>
                            x.id === c.id ? { ...x, name: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <RateInput
                      value={c.rate}
                      onChange={(rate) =>
                        updateSettings({
                          ...settingsDraft,
                          channels: settingsDraft.channels.map((x) =>
                            x.id === c.id ? { ...x, rate } : x,
                          ),
                        })
                      }
                    />
                    <button
                      className="icon-button danger"
                      aria-label={c.name + " kanalını sil"}
                      onClick={async () => {
                        if (
                          await confirm(
                            "Kanal ayarlardan silinsin mi? Geçmiş kayıtlar korunur.",
                          )
                        )
                          updateSettings({
                            ...settingsDraft,
                            channels: settingsDraft.channels.filter(
                              (x) => x.id !== c.id,
                            ),
                          });
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </Card>
              <Card
                title="POS ve diğer kesintiler"
                icon={<Wallet size={18} />}
                extra={
                  <button
                    className="text-button"
                    onClick={() =>
                      updateSettings({
                        ...settingsDraft,
                        pos: [
                          ...settingsDraft.pos,
                          { id: uid(), name: "Yeni POS", rate: 0 },
                        ],
                      })
                    }
                  >
                    <Plus size={15} /> POS ekle
                  </button>
                }
              >
                {settingsDraft.pos.map((p) => (
                  <div className="config-row" key={p.id}>
                    <input
                      aria-label="POS adı"
                      value={p.name}
                      onChange={(e) =>
                        updateSettings({
                          ...settingsDraft,
                          pos: settingsDraft.pos.map((x) =>
                            x.id === p.id ? { ...x, name: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <RateInput
                      value={p.rate}
                      onChange={(rate) =>
                        updateSettings({
                          ...settingsDraft,
                          pos: settingsDraft.pos.map((x) =>
                            x.id === p.id ? { ...x, rate } : x,
                          ),
                        })
                      }
                    />
                    <button
                      className="icon-button danger"
                      aria-label={p.name + " sil"}
                      onClick={async () => {
                        if (await confirm("POS ayarlardan silinsin mi?"))
                          updateSettings({
                            ...settingsDraft,
                            pos: settingsDraft.pos.filter((x) => x.id !== p.id),
                          });
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <div className="divider" />
                <div className="form-grid">
                  <label>
                    Kurye modeli
                    <select
                      value={settingsDraft.courierModel}
                      onChange={(e) =>
                        updateSettings({
                          ...settingsDraft,
                          courierModel: e.target.value,
                        })
                      }
                    >
                      {[
                        "Yok",
                        "İşletme kuryesi",
                        "Platform kuryesi",
                        "Harici kurye",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Kurye kesintisi
                    <RateInput
                      value={settingsDraft.courierRate}
                      onChange={(courierRate) =>
                        updateSettings({ ...settingsDraft, courierRate })
                      }
                    />
                  </label>
                  <label>
                    Diğer kesinti oranı
                    <RateInput
                      value={settingsDraft.otherRate}
                      onChange={(otherRate) =>
                        updateSettings({ ...settingsDraft, otherRate })
                      }
                    />
                  </label>
                </div>
                <p className="helper">
                  Kurye ve diğer oranlar, girilen satış / tahsilat toplamına
                  uygulanır. Platform komisyonuna dahil kesintileri tekrar
                  tanımlamayın.
                </p>
              </Card>
              <Card
                title="Kayıtlı personel"
                icon={<Users size={18} />}
                extra={
                  <button
                    className="text-button"
                    onClick={() =>
                      updateSettings({
                        ...settingsDraft,
                        employees: [
                          ...settingsDraft.employees,
                          employee("Yeni personel"),
                        ],
                      })
                    }
                  >
                    <Plus size={15} /> Personel ekle
                  </button>
                }
                className="settings-personnel"
              >
                <p className="card-description">
                  Yeni günlük kayıtlara otomatik eklenir. Maaşları günlük
                  maliyet olarak tanımlayın.
                </p>
                {!settingsDraft.employees.length && (
                  <Empty>Kalıcı personel listeniz henüz boş.</Empty>
                )}
                {settingsDraft.employees.map((p) => (
                  <div className="personnel-config" key={p.id}>
                    <div className="config-row">
                      <input
                        aria-label="Kayıtlı personel adı"
                        value={p.name}
                        onChange={(e) =>
                          updateSettings({
                            ...settingsDraft,
                            employees: settingsDraft.employees.map((x) =>
                              x.id === p.id
                                ? { ...x, name: e.target.value }
                                : x,
                            ),
                          })
                        }
                      />
                      <button
                        className="icon-button danger"
                        aria-label={p.name + " personelini sil"}
                        onClick={async () => {
                          if (
                            await confirm(
                              "Personel kalıcı listeden silinsin mi? Geçmiş günler korunur.",
                            )
                          )
                            updateSettings({
                              ...settingsDraft,
                              employees: settingsDraft.employees.filter(
                                (x) => x.id !== p.id,
                              ),
                            });
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="employee-fields">
                      {[
                        ["Günlük ücret", "wage"],
                        ["Prim", "bonus"],
                        ["Sigorta", "insurance"],
                        ["Diğer", "other"],
                      ].map(([label, key]) => (
                        <label key={key}>
                          {label}
                          <MoneyInput
                            value={p[key as keyof Employee] as number}
                            onChange={(amount) =>
                              updateSettings({
                                ...settingsDraft,
                                employees: settingsDraft.employees.map((x) =>
                                  x.id === p.id ? { ...x, [key]: amount } : x,
                                ),
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </Card>
              <Card
                title="Yedekleme ve veri güvenliği"
                icon={<ShieldCheck size={18} />}
              >
                <p className="card-description">
                  Verileriniz size ait. Düzenli yedek alarak güvende tutun.
                </p>
                <div className="backup-note">
                  <div className="icon-tile green">
                    <ShieldCheck size={25} />
                  </div>
                  <p>
                    {window.defter
                      ? "Verileriniz bu bilgisayardaki SQLite veritabanında saklanır. Uygulama güncellemeleri kayıtlarınızı silmez."
                      : "Tarayıcı demosu SQLite verilerini bu tarayıcıda saklar. Tarayıcı verilerini temizlemek kayıtları siler; kalıcı kullanım için masaüstü sürümünü kullanın."}
                  </p>
                </div>
                <div className="button-row">
                  <button
                    className="button secondary"
                    disabled={busy || !api}
                    onClick={() =>
                      run(async () => {
                        if (await api?.backup())
                          notify("Yedek dosyası oluşturuldu.");
                      })
                    }
                  >
                    <Download size={16} /> Yedek al
                  </button>
                  <button
                    className="button secondary"
                    disabled={busy || !api}
                    onClick={() =>
                      run(async () => {
                        if (!(await allowLeave())) return;
                        if (
                          settingsDirty &&
                          !(await confirm(
                            "Kaydedilmemiş ayarlar bırakılıp geri yükleme yapılsın mı?",
                          ))
                        )
                          return;
                        if (api && (await api.restore())) {
                          const s = (await api.getSettings()) ?? defaults;
                          setSettings(s);
                          setSettingsDraft(s);
                          const list = await api.listDays();
                          setDays(list);
                          setDay(
                            list.find((d) => d.date === today()) ?? newDay(s),
                          );
                          setDirty(false);
                          setSettingsDirty(false);
                          setComputed(null);
                          notify("Yedek geri yüklendi.");
                        }
                      })
                    }
                  >
                    <Upload size={16} /> Geri yükle
                  </button>
                </div>
                <p className="helper">
                  Yedekler finansal verilerinizi içerir. Güvenli bir yerde
                  saklayın. Geri yükleme mevcut verilerin yerine geçer.
                </p>
              </Card>
            </div>
            <div className="settings-save">
              <p>
                <ShieldCheck size={16} /> Yeni ayarlar bugünün taslağına hemen
                uygulanır; günlük kaydı tekrar kaydedin. Geçmiş günlerde “Güncel
                ayarları uygula” seçeneğini kullanın.
              </p>
              <button
                className="button primary"
                disabled={busy || !api}
                onClick={() =>
                  run(async () => {
                    if (!api) return;
                    if (document.querySelector(".money-input.invalid"))
                      throw Error("Hatalı tutarları düzeltin.");
                    const s = settingsSchema.parse({
                      ...settingsDraft,
                      tax: settingsDraft.tax
                        ? {
                            ...settingsDraft.tax,
                            version: `TR-${settingsDraft.tax.year}-${Date.now()}`,
                          }
                        : undefined,
                    });
                    await api.saveSettings(s);
                    setSettings(s);
                    setSettingsDirty(false);
                    if (
                      day.date === today() ||
                      !days.some((d) => d.date === day.date)
                    ) {
                      setDay({
                        ...applySettingsToDay(day, s),
                        ...(!days.some((d) => d.date === day.date)
                          ? { businessType: s.type }
                          : {}),
                      });
                      setDirty(true);
                      setComputed(null);
                    }
                    notify("İşletme ayarlarınız kaydedildi.");
                  })
                }
              >
                <Save size={16} /> Ayarları kaydet
              </button>
            </div>
          </>
        )}
        <footer>
          <span>
            <BookOpen size={14} /> defter mini{" "}
            <span className="footer-dot">·</span> Küçük adımlar, sağlam bir
            işletme.
          </span>
          <span>
            <span className="local-dot" /> Çevrimdışı çalışır{" "}
            <span className="footer-dot">·</span> v1.2
          </span>
        </footer>
      </main>
      {conflict && (
        <div className="modal-backdrop">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="conflict-title"
          >
            <div className="icon-tile orange">
              <CalendarDays size={23} />
            </div>
            <h2 id="conflict-title">Bu gün için bir kayıt var</h2>
            <p>
              {humanDate(day.date)} tarihli mevcut kaydı yeni bilgilerle
              değiştirmek istiyor musunuz?
            </p>
            <div className="button-row">
              <button
                className="button secondary"
                onClick={() => setConflict(false)}
              >
                Vazgeç
              </button>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => saveDay(true)}
              >
                Kaydı güncelle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
