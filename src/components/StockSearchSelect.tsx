import { useState } from "react";

export type StockOption = { id: string; label: string; outOfStock?: boolean };

type Props = {
  value: string;
  options: StockOption[];
  onChange: (id: string) => void;
  placeholder?: string;
};

export default function StockSearchSelect({ value, options, onChange, placeholder = "Search stock item..." }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);

  const selected = options.find(o => o.id === value);
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = options
    .filter(o => words.every(w => o.label.toLowerCase().includes(w)))
    .sort((a, b) => Number(!!a.outOfStock) - Number(!!b.outOfStock))
    .slice(0, 50);

  const choose = (id: string) => {
    onChange(id);
    setOpen(false);
    setQ("");
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={open ? q : (selected?.label ?? "")}
        placeholder={placeholder}
        onFocus={e => { setOpen(true); setQ(""); setHi(0); e.currentTarget.select(); }}
        onBlur={() => setOpen(false)}
        onChange={e => { setQ(e.target.value); setHi(0); setOpen(true); }}
        onKeyDown={e => {
          if (e.key === "ArrowDown") { e.preventDefault(); setHi(h => Math.min(h + 1, matches.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); if (matches[hi]) choose(matches[hi].id); }
          else if (e.key === "Escape") { setOpen(false); (e.currentTarget as HTMLInputElement).blur(); }
        }}
        className="w-full border border-gray-200 rounded-md text-xs px-2 py-1.5 pr-7 bg-white"
      />
      {value && !open && (
        <button type="button" aria-label="Clear stock item"
          onMouseDown={e => { e.preventDefault(); onChange(""); }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm leading-none">
          &times;
        </button>
      )}
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg">
          {matches.length === 0 && <p className="px-2 py-2 text-xs text-gray-400">No matching stock item</p>}
          {matches.map((o, n) => (
            <button key={o.id} type="button"
              onMouseDown={e => { e.preventDefault(); choose(o.id); }}
              onMouseEnter={() => setHi(n)}
              className={"w-full text-left px-2 py-1.5 text-xs " + (n === hi ? "bg-teal-50" : "") + (o.outOfStock ? " text-gray-400" : " text-gray-800")}>
              {o.label}{o.outOfStock ? " \u2013 out of stock" : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
