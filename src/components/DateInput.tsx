import { useEffect, useRef, useState } from "react";
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

/** Drop-in for <input type="date">: shows dd/mm/yyyy, value and onChange stay yyyy-mm-dd. */
export default function DateInput({ value = "", onChange, className = "", min, max, disabled, id, placeholder, ...rest }: Props) {
  const [text, setText] = useState(fmtDate(value));
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => { setText(fmtDate(value)); }, [value]);

  const emit = (iso: string) => onChange && onChange({ target: { value: iso }, currentTarget: { value: iso } });

  return (
    <div className={"relative inline-block " + className}>
      <input
        id={id}
        {...rest}
        type="text"
        inputMode="numeric"
        disabled={disabled}
        placeholder={placeholder || "dd/mm/yyyy"}
        value={text}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          const iso = parseDMY(t);
          if (iso) emit(iso);
          else if (t === "") emit("");
        }}
        onBlur={() => setText(fmtDate(value))}
        className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 pr-9 text-sm"
      />
      <button type="button" disabled={disabled} tabIndex={-1} onClick={() => (picker.current as any)?.showPicker?.()} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
        <Calendar className="w-4 h-4" />
      </button>
      <input ref={picker} type="date" tabIndex={-1} aria-hidden value={value} min={min} max={max}
        onChange={(e) => emit(e.target.value)}
        className="absolute inset-0 opacity-0 pointer-events-none" />
    </div>
  );
}
