import { useState } from "react";
import { parseMoney } from "./model";
export function MoneyInput({
  value,
  onChange,
  label = "Tutar",
}: {
  value: number;
  onChange: (v: number) => void;
  label?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  return (
    <div className={"money-input " + (invalid ? "invalid" : "")}>
      <input
        aria-label={label}
        inputMode="decimal"
        value={
          draft ??
          (value
            ? new Intl.NumberFormat("tr-TR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }).format(value / 100)
            : "")
        }
        placeholder="0,00"
        onChange={(e) => {
          const s = e.target.value;
          setDraft(s);
          try {
            onChange(parseMoney(s));
            setInvalid(false);
          } catch {
            setInvalid(true);
          }
        }}
        onBlur={() => {
          if (!invalid) setDraft(null);
        }}
        aria-invalid={invalid}
      />
      <span>₺</span>
      {invalid && <small>Geçerli bir tutar girin</small>}
    </div>
  );
}
export function RateInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="rate-input">
      <input
        aria-label="Komisyon yüzdesi"
        type="number"
        min="0"
        max="100"
        step="0.01"
        value={value / 100}
        onChange={(e) => onChange(Math.round(Number(e.target.value) * 100))}
      />
      <span>%</span>
    </div>
  );
}
