import { getToken, patients } from "@/api";
import { getLang, setLang, type Lang } from "@/lib/translate";

export default function LanguageSwitcher() {
  const lang = getLang();

  async function change(next: Lang) {
    if (getToken()) {
      try { await patients.updateLanguage(next); } catch { /* guests / non-patients: ignore */ }
    }
    setLang(next);
  }

  return (
    <select
      value={lang}
      onChange={(e) => void change(e.target.value as Lang)}
      className="notranslate rounded-md border border-gray-200 px-2 py-1 text-sm bg-white"
      translate="no"
      aria-label="Language"
    >
      <option value="en">English</option>
      <option value="ta">{"\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD"}</option>
    </select>
  );
}
