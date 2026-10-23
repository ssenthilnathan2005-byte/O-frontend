import LanguageSwitcher from "../LanguageSwitcher";

// Phone-only top bar for the patient home screen (hidden from md and up).
export default function MobileHeader({ name, onAvatar }: { name: string; onAvatar: () => void }) {
  const initials =
    (name || "U")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => (w[0] ?? "").toUpperCase())
      .join("") || "U";

  return (
    <header className="md:hidden relative z-30 bg-white border-b border-slate-200 px-4 py-2.5 flex items-center gap-3">
      <img
        src="/assets/Logo.jpg"
        alt="Doctor Booked"
        className="w-9 h-9 rounded-full object-cover shrink-0"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
      <span className="text-base font-bold tracking-tight text-slate-900" translate="no">
        Doctor<span className="text-teal-700">Booked</span>
      </span>
      <div className="flex-1" />
      <LanguageSwitcher />
      <button
        type="button"
        onClick={onAvatar}
        aria-label="Account"
        className="w-9 h-9 rounded-full bg-teal-700 text-white text-xs font-bold flex items-center justify-center shrink-0"
      >
        {initials}
      </button>
    </header>
  );
}
