const fs = require("fs");
const p = "src/components/ui/select.tsx";
let s = fs.readFileSync(p, "utf8");

const a = "max-h-(--radix-select-content-available-height)";
const b = "origin-(--radix-select-content-transform-origin)";
if (!s.includes(a) || !s.includes(b)) throw new Error("classes not found (already patched?)");

s = s.replace(a, "max-h-[min(var(--radix-select-content-available-height),60vh)] touch-pan-y overscroll-contain");
s = s.replace(b, "origin-[var(--radix-select-content-transform-origin)]");
fs.writeFileSync(p, s, "utf8");
console.log("patched select.tsx");
