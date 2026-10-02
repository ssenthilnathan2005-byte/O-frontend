const fs = require("fs");
const p = "src/components/ui/select.tsx";
let s = fs.readFileSync(p, "utf8");
if (s.includes("data-scrollfix")) throw new Error("already patched");

// 1. inline max height on the dropdown (does not depend on Tailwind syntax)
const m = /(\r?\n)(\s*)position=\{position\}(\r?\n)(\s*)\{\.\.\.props\}/.exec(s);
if (!m) throw new Error("Content props block not found");
const nl = m[1];
const add = nl + m[2] + 'data-scrollfix="1"' + nl + m[2] +
  'style={{ maxHeight: "min(320px, var(--radix-select-content-available-height))", ...(props as any).style }}';
s = s.slice(0, m.index) + add + s.slice(m.index);

// 2. Tailwind v4-only classes that v3 ignores
const a = "max-h-(--radix-select-content-available-height)";
const b = "origin-(--radix-select-content-transform-origin)";
if (!s.includes(a) || !s.includes(b)) throw new Error("v4 classes not found");
s = s.replace(a, "touch-pan-y overscroll-contain");
s = s.replace(b, "origin-[var(--radix-select-content-transform-origin)]");

// 3. remove fixed viewport height that blocks scrolling
s = s.replace("h-[var(--radix-select-trigger-height)] ", "");

fs.writeFileSync(p, s, "utf8");
console.log("patched select.tsx");
