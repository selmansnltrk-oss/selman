import { useState } from "react";
import { Info, Plus, Trash2 } from "lucide-react";
import { MoneyInput, RateInput } from "./fields";
import { money, type Day } from "./model";
import { taxTotals, splitVat, type TaxSettings, type TaxResult } from "./tax";
import rules from "./tax-rules.json";
const methods = {
  progressive: "Yıllık artan oranlı gelir vergisi",
  corporate: "Kurumlar vergisi / özel oran",
  partners: "Ortakların pay ve statülerine göre",
  none: "Hesaplanamaz / yapılandırılmadı",
};
export function TaxSettingsCard({
  company,
  value: p,
  onChange,
}: {
  company: string;
  value: TaxSettings;
  onChange: (p: TaxSettings) => void;
}) {
  const set = (v: Partial<TaxSettings>) =>
    onChange({ ...p, ...v, confirmed: false });
  return (
    <section className="card tax-settings">
      <div className="card-heading">
        <h2>Vergi ayarları</h2>
        <span className="badge">Tahmini analiz</span>
      </div>
      <p className="helper">
        Şirket tipi: {company} · {methods[p.method]}. {rules.status}{" "}
        <a href="https://www.gib.gov.tr/" target="_blank" rel="noreferrer">
          GİB
        </a>
      </p>
      <label className="tax-check">
        <input
          type="checkbox"
          checked={p.enabled}
          onChange={(e) => set({ enabled: e.target.checked })}
        />{" "}
        Tahmini vergi analizini etkinleştir
      </label>
      <div className="form-grid">
        <label>
          Vergi yılı
          <input
            aria-label="Vergi yılı"
            type="number"
            min="2020"
            max="2100"
            value={p.year}
            onChange={(e) => set({ year: Number(e.target.value) })}
          />
        </label>
        <label>
          Hesaplama yöntemi
          <select
            value={p.method}
            onChange={(e) =>
              set({ method: e.target.value as TaxSettings["method"] })
            }
          >
            {Object.entries(methods).map(([v, n]) => (
              <option value={v} key={v}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          Özel / kurumlar vergi oranı
          <RateInput
            value={p.corporateRate}
            onChange={(corporateRate) => set({ corporateRate })}
          />
        </label>
        <label>
          Varsayılan satış KDV oranı
          <RateInput
            value={p.vatDefault}
            onChange={(vatDefault) => set({ vatDefault })}
          />
        </label>
        <label>
          Satış tutarı girişi
          <select
            value={p.vatIncluded ? "included" : "excluded"}
            onChange={(e) =>
              set({ vatIncluded: e.target.value === "included" })
            }
          >
            <option value="included">KDV dahil</option>
            <option value="excluded">KDV hariç</option>
          </select>
        </label>
        <label>
          Yıl açılış kümülatif matrahı (TL)
          <input
            aria-label="Yıl açılış matrahı"
            type="number"
            step="0.01"
            value={p.openingBase / 100}
            onChange={(e) =>
              set({ openingBase: Math.round(Number(e.target.value) * 100) })
            }
          />
        </label>
        <label>
          Devreden KDV açılış ayı
          <input
            type="month"
            value={p.openingMonth}
            onChange={(e) => set({ openingMonth: e.target.value })}
          />
        </label>
        <label>
          Devreden KDV açılış tutarı
          <MoneyInput
            label="Devreden KDV"
            value={p.openingVat}
            onChange={(openingVat) => set({ openingVat })}
          />
        </label>
      </div>
      <p className="helper">
        Yıl açılış matrahı, bu uygulamada kayıtlı ilk günden önceki kümülatif
        tahmindir; kayıtlı günleri tekrar dahil etmeyin. Negatif değer dönem
        zararını temsil eder. Devreden KDV, kayıtlı ilk ayın açılış kredisi
        olmalıdır.
      </p>
      <details>
        <summary>Gelir vergisi dilimleri ve özel durumlar</summary>
        <p className="helper">
          Tarife başlangıç verisi: {rules.year}. Sınırlar TL, oranlar yüzde. Son
          dilim sınırsızdır. Başka yıl seçildiğinde bu tablo otomatik
          güncellenmez; doğru tarifeyi girin ve teyit edin.
        </p>
        {p.brackets.map((b, i) => (
          <div className="config-row" key={i}>
            <label>
              {i + 1}. üst sınır{" "}
              {b.ceiling === null ? (
                <span>Sınırsız</span>
              ) : (
                <MoneyInput
                  label={`${i + 1}. dilim üst sınırı`}
                  value={b.ceiling}
                  onChange={(ceiling) =>
                    set({
                      brackets: p.brackets.map((x, j) =>
                        i === j ? { ...x, ceiling } : x,
                      ),
                    })
                  }
                />
              )}
            </label>
            <RateInput
              value={b.rate}
              onChange={(rate) =>
                set({
                  brackets: p.brackets.map((x, j) =>
                    i === j ? { ...x, rate } : x,
                  ),
                })
              }
            />
            {p.brackets.length > 1 && (
              <button
                className="icon-button"
                aria-label="Dilim sil"
                onClick={() =>
                  set({ brackets: p.brackets.filter((_, j) => j !== i) })
                }
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
        <button
          className="text-button"
          onClick={() =>
            set({
              brackets: [
                ...p.brackets.slice(0, -1),
                {
                  ceiling: (p.brackets.at(-2)?.ceiling ?? 0) + 10000000,
                  rate: 3500,
                },
                p.brackets.at(-1)!,
              ],
            })
          }
        >
          <Plus size={14} /> Dilim ekle
        </button>
        <div className="form-grid">
          <label>
            Ek aylık işveren SGK gideri
            <MoneyInput
              label="Ek aylık SGK"
              value={p.monthlySgk}
              onChange={(monthlySgk) => set({ monthlySgk })}
            />
          </label>
          <label>
            Aylık Bağ-Kur gideri
            <MoneyInput
              label="Aylık Bağ-Kur"
              value={p.monthlyBagkur}
              onChange={(monthlyBagkur) => set({ monthlyBagkur })}
            />
          </label>
        </div>
        <p className="helper">
          Personel satırındaki sigorta maliyetine dahil olmayan ek giderleri
          girin. Otomatik bordro veya prim hesabı yapılmaz. Maaş maliyetine brüt
          ücreti, sigortaya yalnızca ek işveren maliyetini yazın; net ödemeyi
          tekrar gider yazmayın.
        </p>
        <label className="tax-check">
          <input
            type="checkbox"
            checked={p.rentWithholding}
            onChange={(e) => set({ rentWithholding: e.target.checked })}
          />{" "}
          Kira stopajı uygulanır (kiraya veren ve işlem teyitli)
        </label>
        {p.rentWithholding && (
          <div className="form-grid">
            <label>
              Kira stopaj oranı
              <RateInput
                value={p.withholdingRate}
                onChange={(withholdingRate) => set({ withholdingRate })}
              />
            </label>
            <label>
              Ayarlardaki kira tutarı
              <select
                value={p.rentIsNet ? "net" : "gross"}
                onChange={(e) => set({ rentIsNet: e.target.value === "net" })}
              >
                <option value="gross">
                  Brüt kira · stopaj zaten maliyete dahil
                </option>
                <option value="net">
                  Net kira · stopaj brütleştirilerek eklenir
                </option>
              </select>
            </label>
          </div>
        )}
      </details>
      {p.method === "partners" && (
        <details open>
          <summary>Ortaklar · toplam pay %100 olmalı</summary>
          {p.partners.map((x, i) => (
            <div className="partner" key={i}>
              <div className="form-grid">
                <label>
                  Adı
                  <input
                    value={x.name}
                    onChange={(e) =>
                      set({
                        partners: p.partners.map((a, j) =>
                          i === j ? { ...a, name: e.target.value } : a,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Pay
                  <RateInput
                    value={x.share}
                    onChange={(share) =>
                      set({
                        partners: p.partners.map((a, j) =>
                          i === j ? { ...a, share } : a,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Vergi statüsü
                  <select
                    value={x.method}
                    onChange={(e) =>
                      set({
                        partners: p.partners.map((a, j) =>
                          i === j
                            ? {
                                ...a,
                                method: e.target.value as
                                  "corporate" | "progressive",
                              }
                            : a,
                        ),
                      })
                    }
                  >
                    <option value="progressive">Gelir vergisi</option>
                    <option value="corporate">Kurumlar vergisi</option>
                  </select>
                </label>
                <label>
                  Yıl açılış matrahı (TL)
                  <input
                    type="number"
                    step="0.01"
                    value={x.openingBase / 100}
                    onChange={(e) =>
                      set({
                        partners: p.partners.map((a, j) =>
                          i === j
                            ? {
                                ...a,
                                openingBase: Math.round(
                                  Number(e.target.value) * 100,
                                ),
                              }
                            : a,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Kurumlar oranı
                  <RateInput
                    value={x.corporateRate}
                    onChange={(corporateRate) =>
                      set({
                        partners: p.partners.map((a, j) =>
                          i === j ? { ...a, corporateRate } : a,
                        ),
                      })
                    }
                  />
                </label>
              </div>
              <button
                className="text-button"
                onClick={() =>
                  set({ partners: p.partners.filter((_, j) => i !== j) })
                }
              >
                Ortağı sil
              </button>
            </div>
          ))}
          <button
            className="text-button"
            onClick={() =>
              set({
                partners: [
                  ...p.partners,
                  {
                    name: "Yeni ortak",
                    share: 0,
                    method: "progressive",
                    openingBase: 0,
                    corporateRate: 2500,
                  },
                ],
              })
            }
          >
            <Plus size={14} /> Ortak ekle
          </button>
        </details>
      )}
      <label className="tax-check confirm">
        <input
          type="checkbox"
          checked={p.confirmed}
          onChange={(e) => onChange({ ...p, confirmed: e.target.checked })}
        />{" "}
        Vergi yılı, tarife, yöntem, açılış matrahı ve varsa ortak bilgilerini
        mali müşavirimle kontrol ettim.
      </label>
      <p className="helper">
        Her kayıtta profilin sürümü saklanır. İstisna, indirim, geçmiş zarar ve
        KKEG etkilerini İcmal’de matrah düzeltmesi olarak girin. Geçici vergi
        ödemeleri yıllık karşılıktan yeniden düşülmez.
      </p>
    </section>
  );
}
export function DayTaxInputs({
  day,
  onChange,
}: {
  day: Day;
  onChange: (d: Day) => void;
}) {
  const p = day.tax;
  if (!p?.enabled) return null;
  const adjustment = day.taxAdjustment ?? { additions: 0, deductions: 0 };
  return (
    <section className="card day-tax">
      <details>
        <summary>KDV ve günlük vergi bilgileri</summary>
        <p className="helper">
          Profil: {p.version} · {p.year} · {methods[p.method]}. Satış KDV
          oranını her kalemde kontrol edin; varsayılan oran bir mevzuat
          sınıflandırması değildir.
        </p>
        {day.incomes.map((i) => {
          const v = splitVat(
            i.amount,
            i.vat ?? p.vatDefault,
            i.vatIncluded ?? p.vatIncluded,
          );
          return (
            <div className="vat-line" key={i.id}>
              <span>{i.name}</span>
              <RateInput
                value={i.vat ?? p.vatDefault}
                onChange={(vat) =>
                  onChange({
                    ...day,
                    incomes: day.incomes.map((x) =>
                      x.id === i.id ? { ...x, vat } : x,
                    ),
                  })
                }
              />
              <select
                aria-label={i.name + " KDV girişi"}
                value={
                  (i.vatIncluded ?? p.vatIncluded) ? "included" : "excluded"
                }
                onChange={(e) =>
                  onChange({
                    ...day,
                    incomes: day.incomes.map((x) =>
                      x.id === i.id
                        ? { ...x, vatIncluded: e.target.value === "included" }
                        : x,
                    ),
                  })
                }
              >
                <option value="included">KDV dahil</option>
                <option value="excluded">KDV hariç</option>
              </select>
              <small>
                Hariç: {money(v.net)} · KDV: {money(v.vat)} · Dahil:{" "}
                {money(v.gross)}
              </small>
            </div>
          );
        })}
        <div className="vat-expenses">
          {day.expenses.map((e) => {
            const v = splitVat(e.amount, e.vat, true);
            return (
              <p key={e.id}>
                {e.description}: KDV hariç {money(v.net)} · KDV {money(v.vat)} ·
                Dahil {money(v.gross)} ·{" "}
                {e.invoice && e.vatDeductible
                  ? "İndirilebilir"
                  : "İndirim uygulanmaz"}
              </p>
            );
          })}
        </div>
        <div className="form-grid">
          <label>
            Matraha eklenecekler (KKEG vb.)
            <MoneyInput
              label="Matrah ilaveleri"
              value={adjustment.additions}
              onChange={(additions) =>
                onChange({
                  ...day,
                  taxAdjustment: { ...adjustment, additions },
                })
              }
            />
          </label>
          <label>
            Matrahtan indirilecekler / istisnalar
            <MoneyInput
              label="Matrah indirimleri"
              value={adjustment.deductions}
              onChange={(deductions) =>
                onChange({
                  ...day,
                  taxAdjustment: { ...adjustment, deductions },
                })
              }
            />
          </label>
          <label>
            Fiilen ödenen vergi (bilgi amaçlı)
            <MoneyInput
              label="Ödenen vergi"
              value={day.taxPaid ?? 0}
              onChange={(taxPaid) => onChange({ ...day, taxPaid })}
            />
          </label>
        </div>
        <p className="helper">
          Düzeltmeler yalnızca vergi matrahını etkiler; işletme giderini tekrar
          değiştirmez. Önceki dönem kayıplarını hem açılış matrahına hem günlük
          indirime tekrar yazmayın. SGK / Bağ-Kur payı:{" "}
          {money(day.taxCosts?.contributions ?? 0)}. Stopaj nakit yükümlülüğü:{" "}
          {money(day.taxCosts?.withholdingCash ?? 0)} (brüt kirada ikinci kez
          gider sayılmaz).
        </p>
      </details>
    </section>
  );
}
function Value({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="tax-value">
      <small>{label}</small>
      <strong
        className={
          value !== null && value < 0
            ? "text-red"
            : value !== null && label.toLowerCase().includes("sonuç")
              ? "text-green"
              : ""
        }
      >
        {value === null ? "Hesaplanamadı" : money(value)}
      </strong>
    </div>
  );
}
export function TaxSummary({ result: r }: { result: TaxResult }) {
  return (
    <section className="tax-summary">
      <h3>
        Vergi analizi <span>Tahmini</span>
      </h3>
      <div className="tax-values">
        <Value label="KDV dahil satış" value={r.grossRevenue} />
        <Value label="KDV hariç gelir" value={r.netRevenue} />
        <Value
          label="Toplam işletme giderleri"
          value={
            r.netRevenue !== null && r.before !== null
              ? r.netRevenue - r.before
              : null
          }
        />
        <Value label="Vergi öncesi sonuç" value={r.before} />
        <Value label="Gelir / kurumlar vergi karşılığı" value={r.reserve} />
        <Value label="Vergi sonrası sonuç" value={r.after} />
        <Value label="Hesaplanan KDV" value={r.outputVat} />
        <Value label="İndirilecek KDV" value={r.inputVat} />
        <Value label="Ayın birikimli KDV ödeme tahmini" value={r.vatDue} />
        <Value label="Sonraki aya devredecek KDV tahmini" value={r.vatCredit} />
      </div>
      {r.warnings.map((w) => (
        <p className="tax-warning" key={w}>
          <Info size={14} />
          {w}
        </p>
      ))}
      <p className="helper">
        KDV kârdan tekrar düşülmez. Sabit gider ve komisyonlar, belge bazında
        KDV detayı olmadığı için girilen brüt maliyetleriyle dikkate alınır. KDV
        indirimi yalnızca belgesi ve uygunluk onayı olan giderlere uygulanır.
        Resmi beyanname değildir.
      </p>
    </section>
  );
}
export function TaxReport({
  ledger,
  from,
  to,
}: {
  ledger: TaxResult[];
  from: string;
  to: string;
}) {
  const [detail, setDetail] = useState(false);
  const summary = taxTotals(ledger, from, to);
  const anchor =
    to || ledger.at(-1)?.date || new Date().toISOString().slice(0, 10);
  const month = taxTotals(
    ledger,
    anchor.slice(0, 7) + "-01",
    anchor.slice(0, 7) + "-31",
  );
  const year = taxTotals(
    ledger,
    anchor.slice(0, 4) + "-01-01",
    anchor.slice(0, 4) + "-12-31",
  );
  return (
    <section className="card tax-report">
      <div className="card-heading">
        <h2>Vergi ve KDV özeti</h2>
        <button className="text-button" onClick={() => setDetail(!detail)}>
          {detail ? "Ayrıntıyı gizle" : "Günlük karşılıklar"}
        </button>
      </div>
      <p className="helper">
        Aylık ve yıllık toplamlar bitiş tarihinin dönemine aittir. Hesaplar tüm
        geçmiş kayıtlardan yeniden oluşturulur; eksik profiller sonuç üretmez.
      </p>
      <div className="tax-values">
        <Value label="Seçilen dönem · vergi öncesi" value={summary.before} />
        <Value label="Seçilen dönem · karşılık" value={summary.reserve} />
        <Value label="Seçilen dönem · vergi sonrası" value={summary.after} />
        <Value
          label={`${anchor.slice(0, 7)} · aylık karşılık`}
          value={month.reserve}
        />
        <Value
          label={`${anchor.slice(0, 4)} · yıllık karşılık`}
          value={year.reserve}
        />
        <Value
          label="Seçilen dönem · KDV yükümlülük değişimi"
          value={summary.vat}
        />
        <Value label="Fiilen ödenen vergiler (bilgi)" value={summary.paid} />
      </div>
      {detail && (
        <div className="tax-table">
          {ledger
            .filter((r) => (!from || r.date >= from) && (!to || r.date <= to))
            .map((r) => (
              <div key={r.date}>
                <b>{r.date}</b>
                <span>
                  Karşılık:{" "}
                  {r.reserve === null ? "Hesaplanamadı" : money(r.reserve)}
                </span>
                <span>
                  Vergi sonrası:{" "}
                  {r.after === null ? "Hesaplanamadı" : money(r.after)}
                </span>
                {r.warnings.length > 0 && <small>{r.warnings.join(" ")}</small>}
              </div>
            ))}
        </div>
      )}
      <p className="helper">
        Negatif karşılık, önceki tahmini karşılığın azalmasıdır; vergi iadesi
        iddiası değildir. Ödenen vergiler analiz sonucundan ikinci kez düşülmez.
      </p>
    </section>
  );
}
