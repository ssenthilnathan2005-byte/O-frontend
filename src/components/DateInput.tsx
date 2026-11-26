import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { fmtDate, parseDMY } from "@/lib/formatDate";

type Props = {
  value?: string;
  onChange?: (e: any) => void;
  className?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  id?: string;
  placeholder?: string;
  [k: string]: any;
};

// ---- masked dd/mm/yyyy editing: the slashes are permanent, each part is edited on its own ----
type Seg = [string, string, string];
const LEN = [2, 2, 4];
const START = [0, 3, 6];
const EMPTY = (): Seg => ["", "", ""];

function segsFromIso(v?: string): Seg {
  const t = fmtDate(v || "");
  return /^\d\d\/\d\d\/\d{4}$/.test(t) ? [t.slice(0, 2), t.slice(3, 5), t.slice(6)] : EMPTY();
}
const isEmpty = (s: Seg) => !s[0] && !s[1] && !s[2];
const render = (s: Seg) => s.map((x, i) => x + "_".repeat(LEN[i] - x.length)).join("/");
const segAt = (pos: number) => (pos <= 2 ? 0 : pos <= 5 ? 1 : 2);

/** Types one character into part `idx`. Returns the part the cursor should be in afterwards. */
function typeChar(s: Seg, idx: number, ch: string): number {
  if (/\d/.test(ch)) {
    let str = s[idx];
    if (str.length >= LEN[idx]) str = ""; // a full part starts over
    if (str === "" && ((idx === 0 && ch > "3") || (idx === 1 && ch > "1"))) str = "0" + ch;
    else str += ch;
    s[idx] = str;
    return str.length >= LEN[idx] && idx < 2 ? idx + 1 : idx;
  }
  if (/[\/.\-\s]/.test(ch) && idx < 2) {
    if (s[idx].length === 1) s[idx] = "0" + s[idx];
    return idx + 1;
  }
  return idx;
}

/** One edit (typing, backspace, delete, paste) -> new parts + where the cursor goes. */
function applyEdit(segs: Seg, a: number, b: number, kind: "text" | "back" | "del" | "paste", data: string, hasText: boolean) {
  const spansAll = hasText && b - a >= 3;
  const s: Seg = spansAll ? EMPTY() : [segs[0], segs[1], segs[2]];
  let idx = segAt(spansAll ? 0 : a);
  let caret = 0;
  const sel = !spansAll && b > a; // a selection inside one part
  if (kind === "back") {
    if (spansAll) { return { s, caret: 0 }; }
    if (sel) { s[idx] = ""; return { s, caret: START[idx] }; }
    let k = idx;
    if ((a === START[k] && k > 0) || (s[k] === "" && k > 0)) k -= 1;
    s[k] = s[k].slice(0, -1);
    return { s, caret: START[k] + s[k].length };
  }
  if (kind === "del") {
    if (spansAll) return { s, caret: 0 };
    s[idx] = "";
    return { s, caret: START[idx] };
  }
  let text = data;
  if (kind === "paste") {
    const iso = /^\s*(\d{4})-(\d{2})-(\d{2})/.exec(data);
    if (iso) { return { s: [iso[3], iso[2], iso[1]] as Seg, caret: 10 }; }
    const digits = data.replace(/\D/g, "");
    if (digits.length === 8) return { s: [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)] as Seg, caret: 10 };
    text = digits;
    s[0] = s[1] = s[2] = "";
    idx = 0;
  } else if (sel) {
    s[idx] = "";
  }
  let moved = false;
  for (const ch of text) {
    const n = typeChar(s, idx, ch);
    moved = n !== idx;
    idx = n;
  }
  caret = moved ? START[idx] : START[idx] + s[idx].length;
  return { s, caret };
}

/** Drop-in for <input type="date">: shows dd/mm/yyyy with permanent slashes; value and onChange stay yyyy-mm-dd. */
export default function DateInput({ value = "", onChange, className = "", min, max, disabled, id, placeholder, ...rest }: Props) {
  const [segs, setSegs] = useState<Seg>(() => segsFromIso(value));
  const [focused, setFocused] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const lastEmitted = useRef(value);
  const latest = useRef({ segs, onChange, min, max });
  latest.current = { segs, onChange, min, max };

  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    setSegs(segsFromIso(value));
    setInvalid(false);
  }, [value]);

  const fire = (iso: string) => {
    lastEmitted.current = iso;
    const cb = latest.current.onChange;
    if (cb) cb({ target: { value: iso }, currentTarget: { value: iso } });
  };
  const commit = (s: Seg) => {
    if (isEmpty(s)) { setInvalid(false); fire(""); return; }
    if (s[0].length === 2 && s[1].length === 2 && s[2].length === 4) {
      const iso = parseDMY(s.join("/"));
      const { min: mn, max: mx } = latest.current;
      if (!iso || (mn && iso < mn) || (mx && iso > mx)) { setInvalid(true); return; }
      setInvalid(false);
      fire(iso);
      return;
    }
    setInvalid(false);
  };

  // Take over typing so the slashes never move and each part is edited on its own.
  useEffect(() => {
    const el = input.current;
    if (!el || disabled) return;
    const handler = (ev: Event) => {
      const e = ev as InputEvent;
      const t = e.inputType;
      let kind: "text" | "back" | "del" | "paste" | null = null;
      let data = "";
      if (t === "insertText") { kind = "text"; data = e.data || ""; }
      else if (t === "insertFromPaste" || t === "insertFromDrop") { kind = "paste"; data = (e as any).dataTransfer?.getData("text") || e.data || ""; }
      else if (t === "deleteContentBackward") kind = "back";
      else if (t === "deleteContentForward" || t === "deleteByCut") kind = "del";
      if (!kind) return;
      e.preventDefault();
      const a = el.selectionStart ?? 0;
      const b = el.selectionEnd ?? a;
      const r = applyEdit(latest.current.segs, a, b, kind, data, el.value.length > 0 && !isEmpty(latest.current.segs));
      pendingCaret.current = r.caret;
      setSegs(r.s);
      commit(r.s);
    };
    el.addEventListener("beforeinput", handler);
    return () => el.removeEventListener("beforeinput", handler);
  }, [disabled]);

  useLayoutEffect(() => {
    const el = input.current;
    if (pendingCaret.current !== null && el && document.activeElement === el) {
      try { el.setSelectionRange(pendingCaret.current, pendingCaret.current); } catch { /* ignore */ }
    }
    pendingCaret.current = null;
  });

  const shown = isEmpty(segs) && !focused ? "" : render(segs);

  // keep only layout classes (width, margin ...) on the wrapper so the box and the icon stay aligned
  const layout = className
    .split(/\s+/)
    .filter((c) => c && /^(w-|min-w-|max-w-|flex|grow|shrink|basis-|self-|-?m[trblxy]?-|col-|row-|order-|block$|inline|hidden)/.test(c.replace(/^([a-z0-9]+:)+/, "")))
    .join(" ");

  return (
    <div className={"relative inline-block min-w-[9.5rem] align-middle " + layout}>
      <input
        ref={input}
        id={id}
        {...rest}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder || "dd/mm/yyyy"}
        value={shown}
        aria-invalid={invalid || undefined}
        onFocus={() => {
          setFocused(true);
          if (isEmpty(segs)) pendingCaret.current = 0;
        }}
        onChange={(e) => {
          // fallback for keyboards that bypass the editing above
          const d = e.target.value.replace(/\D/g, "");
          const s: Seg = [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)];
          setSegs(s);
          commit(s);
        }}
        onBlur={() => {
          setFocused(false);
          const s = latest.current.segs;
          const full = s[0].length === 2 && s[1].length === 2 && s[2].length === 4;
          if (!isEmpty(s) && (!full || invalid)) { setSegs(segsFromIso(value)); setInvalid(false); }
        }}
        className={
          "h-10 w-full rounded-md border bg-white pl-3 pr-10 text-sm text-gray-900 tabular-nums outline-none focus:ring-2 focus:ring-teal-500/30 " +
          (invalid ? "border-red-400 focus:border-red-500" : "border-gray-200 focus:border-teal-500") +
          (disabled ? " opacity-60 cursor-not-allowed" : "")
        }
      />
      <button
        type="button"
        disabled={disabled}
        tabIndex={-1}
        aria-label="Pick date"
        onClick={() => { try { (picker.current as any)?.showPicker?.(); } catch { picker.current?.click(); } }}
        className="absolute right-0 top-0 h-full w-10 flex items-center justify-center text-gray-400 hover:text-gray-600"
      >
        <Calendar className="w-4 h-4" />
      </button>
      <input
        ref={picker}
        type="date"
        tabIndex={-1}
        aria-hidden
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const v = e.target.value;
          setSegs(segsFromIso(v));
          setInvalid(false);
          fire(v);
        }}
        className="absolute inset-0 opacity-0 pointer-events-none"
      />
    </div>
  );
}
