import type { ReactNode } from "react";
import type { Language } from "./contracts";

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function LanguageSelect({
  languages,
  value,
  onChange,
}: {
  languages: Language[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {languages.map((language) => (
        <option value={language.id} key={language.id}>
          {language.name} · {language.nativeName}
        </option>
      ))}
    </select>
  );
}
export function ErrorNotice({ error }: { error: string | null }) {
  return error ? (
    <div role="alert" className="error">
      {error}
    </div>
  ) : null;
}
